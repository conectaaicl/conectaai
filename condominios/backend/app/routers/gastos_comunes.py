from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional
from datetime import datetime, date
from pydantic import BaseModel
import os
import httpx

from app.core.database import get_db

router = APIRouter(prefix="/api/gastos-comunes", tags=["Gastos Comunes"])

MAIL_API_URL = os.getenv("MAIL_API_URL", "http://localhost:3004/api/send")

# -------------------------------------------------
# DB INIT
# -------------------------------------------------

def _create_tables(db: Session):
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS gastos_periodos (
            id SERIAL PRIMARY KEY,
            tenant_id INTEGER NOT NULL,
            condominio_id INTEGER,
            periodo VARCHAR(7) NOT NULL,
            estado VARCHAR(20) DEFAULT 'borrador',
            total_monto DECIMAL(12,2) DEFAULT 0,
            total_cobros INTEGER DEFAULT 0,
            notas TEXT,
            emitido_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    """))
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS gastos_cobros (
            id SERIAL PRIMARY KEY,
            tenant_id INTEGER NOT NULL,
            periodo_id INTEGER REFERENCES gastos_periodos(id) ON DELETE CASCADE,
            departamento_id INTEGER,
            persona_id INTEGER,
            depto_numero VARCHAR(20),
            nombre_residente VARCHAR(200),
            concepto VARCHAR(200) NOT NULL,
            monto DECIMAL(12,2) NOT NULL,
            estado VARCHAR(20) DEFAULT 'pendiente',
            fecha_vencimiento DATE,
            fecha_pago TIMESTAMPTZ,
            metodo_pago VARCHAR(50),
            comprobante_url TEXT,
            notas TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    """))
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS gastos_items (
            id SERIAL PRIMARY KEY,
            tenant_id INTEGER NOT NULL,
            periodo_id INTEGER REFERENCES gastos_periodos(id) ON DELETE CASCADE,
            concepto VARCHAR(200) NOT NULL,
            monto_total DECIMAL(12,2) NOT NULL,
            tipo_distribucion VARCHAR(20) DEFAULT 'igualitaria',
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    """))
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS gastos_fondo_reserva (
            id SERIAL PRIMARY KEY,
            tenant_id INTEGER NOT NULL,
            condominio_id INTEGER,
            saldo DECIMAL(12,2) DEFAULT 0,
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
    """))
    db.commit()


# -------------------------------------------------
# SCHEMAS
# -------------------------------------------------

class PeriodoCreate(BaseModel):
    tenant_id: int
    condominio_id: Optional[int] = None
    periodo: str
    notas: Optional[str] = None


class ItemCreate(BaseModel):
    tenant_id: int
    concepto: str
    monto_total: float
    tipo_distribucion: str = "igualitaria"


class DistribuirBody(BaseModel):
    tenant_id: int
    fecha_vencimiento: str  # YYYY-MM-DD


class PagarBody(BaseModel):
    metodo_pago: str
    comprobante_url: Optional[str] = None


class FondoUpdate(BaseModel):
    tenant_id: int
    saldo: float
    motivo: Optional[str] = None


# -------------------------------------------------
# HELPERS
# -------------------------------------------------

def _ensure_tables(db: Session):
    try:
        db.execute(text("SELECT 1 FROM gastos_periodos LIMIT 1"))
    except Exception:
        db.rollback()
        _create_tables(db)


def _fmt_row(row):
    if row is None:
        return None
    d = dict(row._mapping)
    for k, v in d.items():
        if isinstance(v, datetime):
            d[k] = v.isoformat()
        elif isinstance(v, date):
            d[k] = v.isoformat()
    return d


# -------------------------------------------------
# PERIODOS
# -------------------------------------------------

@router.get("/periodos")
def list_periodos(tenant_id: int, db: Session = Depends(get_db)):
    _ensure_tables(db)
    rows = db.execute(text("""
        SELECT p.*,
               COALESCE(SUM(c.monto),0) AS monto_calculado,
               COUNT(c.id) AS cobros_count
        FROM gastos_periodos p
        LEFT JOIN gastos_cobros c ON c.periodo_id = p.id
        WHERE p.tenant_id = :tid
        GROUP BY p.id
        ORDER BY p.periodo DESC
    """), {"tid": tenant_id}).fetchall()
    return [_fmt_row(r) for r in rows]


@router.post("/periodos", status_code=201)
def create_periodo(body: PeriodoCreate, db: Session = Depends(get_db)):
    _ensure_tables(db)
    row = db.execute(text("""
        INSERT INTO gastos_periodos (tenant_id, condominio_id, periodo, notas)
        VALUES (:tid, :cid, :periodo, :notas)
        RETURNING *
    """), {"tid": body.tenant_id, "cid": body.condominio_id,
           "periodo": body.periodo, "notas": body.notas}).fetchone()
    db.commit()
    return _fmt_row(row)


@router.get("/periodos/{id}")
def get_periodo(id: int, db: Session = Depends(get_db)):
    _ensure_tables(db)
    periodo = db.execute(text("SELECT * FROM gastos_periodos WHERE id=:id"), {"id": id}).fetchone()
    if not periodo:
        raise HTTPException(404, "Periodo no encontrado")
    items = db.execute(text("SELECT * FROM gastos_items WHERE periodo_id=:id ORDER BY created_at"), {"id": id}).fetchall()
    summary = db.execute(text("""
        SELECT
            COUNT(*) FILTER (WHERE estado='pendiente') AS pendiente_count,
            COUNT(*) FILTER (WHERE estado='pagado') AS pagado_count,
            COUNT(*) FILTER (WHERE estado='vencido') AS vencido_count,
            COUNT(*) FILTER (WHERE estado='exento') AS exento_count,
            COALESCE(SUM(monto) FILTER (WHERE estado='pagado'),0) AS monto_pagado,
            COALESCE(SUM(monto) FILTER (WHERE estado='pendiente'),0) AS monto_pendiente,
            COALESCE(SUM(monto),0) AS monto_total
        FROM gastos_cobros WHERE periodo_id=:id
    """), {"id": id}).fetchone()
    return {
        **_fmt_row(periodo),
        "items": [_fmt_row(i) for i in items],
        "summary": _fmt_row(summary)
    }


@router.patch("/periodos/{id}/emitir")
def emitir_periodo(id: int, tenant_id: int, db: Session = Depends(get_db)):
    _ensure_tables(db)
    periodo = db.execute(text("SELECT * FROM gastos_periodos WHERE id=:id"), {"id": id}).fetchone()
    if not periodo:
        raise HTTPException(404, "Periodo no encontrado")
    if periodo._mapping["estado"] == "cerrado":
        raise HTTPException(400, "Periodo ya cerrado")

    now = datetime.utcnow()
    db.execute(text("""
        UPDATE gastos_periodos SET estado='emitido', emitido_at=:now WHERE id=:id
    """), {"now": now, "id": id})
    db.commit()

    # Send email notifications (non-blocking, best effort)
    try:
        cobros = db.execute(text("""
            SELECT c.*, p.email, p.nombre_completo AS persona_nombre
            FROM gastos_cobros c
            LEFT JOIN personas p ON p.id = c.persona_id
            WHERE c.periodo_id = :pid AND c.persona_id IS NOT NULL
        """), {"pid": id}).fetchall()

        periodo_str = periodo._mapping["periodo"]

        by_persona: dict = {}
        for cobro in cobros:
            cm = dict(cobro._mapping)
            email_addr = cm.get("email")
            if not email_addr:
                continue
            key = email_addr
            if key not in by_persona:
                by_persona[key] = {
                    "email": email_addr,
                    "nombre": cm.get("persona_nombre") or cm.get("nombre_residente") or "Residente",
                    "depto": cm.get("depto_numero", ""),
                    "cobros": []
                }
            by_persona[key]["cobros"].append(cm)

        for info in by_persona.values():
            rows_html = "".join(
                "<tr><td style='padding:8px;border:1px solid #e2e8f0'>{}</td>"
                "<td style='padding:8px;border:1px solid #e2e8f0;text-align:right'>${:,.0f}</td>"
                "<td style='padding:8px;border:1px solid #e2e8f0'>{}</td></tr>".format(
                    c["concepto"], float(c["monto"]), c.get("fecha_vencimiento", "")
                )
                for c in info["cobros"]
            )
            total = sum(float(c["monto"]) for c in info["cobros"])
            html = (
                "<div style='font-family:sans-serif;max-width:600px'>"
                "<h2 style='color:#4f46e5'>Gastos Comunes {}</h2>"
                "<p>Estimado/a <strong>{}</strong> &mdash; Depto {}</p>"
                "<table style='width:100%;border-collapse:collapse;margin:16px 0'>"
                "<thead><tr style='background:#f1f5f9'>"
                "<th style='padding:8px;border:1px solid #e2e8f0;text-align:left'>Concepto</th>"
                "<th style='padding:8px;border:1px solid #e2e8f0;text-align:right'>Monto</th>"
                "<th style='padding:8px;border:1px solid #e2e8f0;text-align:left'>Vencimiento</th>"
                "</tr></thead><tbody>{}</tbody>"
                "<tfoot><tr style='background:#f8fafc;font-weight:bold'>"
                "<td style='padding:8px;border:1px solid #e2e8f0'>Total</td>"
                "<td style='padding:8px;border:1px solid #e2e8f0;text-align:right'>${:,.0f}</td>"
                "<td style='padding:8px;border:1px solid #e2e8f0'></td>"
                "</tr></tfoot></table>"
                "<p style='color:#64748b;font-size:0.875rem'>Mensaje automatico del sistema de condominios.</p>"
                "</div>"
            ).format(periodo_str, info["nombre"], info["depto"], rows_html, total)

            try:
                httpx.post(MAIL_API_URL, json={
                    "to": info["email"],
                    "subject": "Gastos Comunes {} - Depto {}".format(periodo_str, info["depto"]),
                    "html": html
                }, timeout=5.0)
            except Exception:
                pass
    except Exception:
        pass

    return {"ok": True, "estado": "emitido"}


@router.patch("/periodos/{id}/cerrar")
def cerrar_periodo(id: int, db: Session = Depends(get_db)):
    _ensure_tables(db)
    periodo = db.execute(text("SELECT * FROM gastos_periodos WHERE id=:id"), {"id": id}).fetchone()
    if not periodo:
        raise HTTPException(404, "Periodo no encontrado")
    db.execute(text("UPDATE gastos_periodos SET estado='cerrado' WHERE id=:id"), {"id": id})
    db.commit()
    return {"ok": True, "estado": "cerrado"}


@router.delete("/periodos/{id}")
def delete_periodo(id: int, db: Session = Depends(get_db)):
    _ensure_tables(db)
    periodo = db.execute(text("SELECT estado FROM gastos_periodos WHERE id=:id"), {"id": id}).fetchone()
    if not periodo:
        raise HTTPException(404, "Periodo no encontrado")
    if periodo._mapping["estado"] != "borrador":
        raise HTTPException(400, "Solo se pueden eliminar periodos en estado borrador")
    db.execute(text("DELETE FROM gastos_periodos WHERE id=:id"), {"id": id})
    db.commit()
    return {"ok": True}


# -------------------------------------------------
# ITEMS
# -------------------------------------------------

@router.post("/periodos/{periodo_id}/items", status_code=201)
def add_item(periodo_id: int, body: ItemCreate, db: Session = Depends(get_db)):
    _ensure_tables(db)
    row = db.execute(text("""
        INSERT INTO gastos_items (tenant_id, periodo_id, concepto, monto_total, tipo_distribucion)
        VALUES (:tid, :pid, :concepto, :monto, :dist)
        RETURNING *
    """), {"tid": body.tenant_id, "pid": periodo_id, "concepto": body.concepto,
           "monto": body.monto_total, "dist": body.tipo_distribucion}).fetchone()
    db.commit()
    return _fmt_row(row)


@router.delete("/items/{id}")
def delete_item(id: int, db: Session = Depends(get_db)):
    _ensure_tables(db)
    db.execute(text("DELETE FROM gastos_items WHERE id=:id"), {"id": id})
    db.commit()
    return {"ok": True}


@router.post("/periodos/{periodo_id}/distribuir")
def distribuir(periodo_id: int, body: DistribuirBody, db: Session = Depends(get_db)):
    _ensure_tables(db)
    periodo = db.execute(text("SELECT * FROM gastos_periodos WHERE id=:id"), {"id": periodo_id}).fetchone()
    if not periodo:
        raise HTTPException(404, "Periodo no encontrado")

    items = db.execute(text("SELECT * FROM gastos_items WHERE periodo_id=:pid"), {"pid": periodo_id}).fetchall()
    if not items:
        raise HTTPException(400, "No hay items de gasto para distribuir")

    deptos = db.execute(text("""
        SELECT d.id, d.numero, d.propietario_id, d.residente_id,
               p.nombre_completo AS propietario_nombre, p.email AS propietario_email,
               r.nombre_completo AS residente_nombre, r.email AS residente_email
        FROM departamentos d
        LEFT JOIN personas p ON p.id = d.propietario_id
        LEFT JOIN personas r ON r.id = d.residente_id
        WHERE d.tenant_id = :tid
        ORDER BY d.numero
    """), {"tid": body.tenant_id}).fetchall()

    if not deptos:
        raise HTTPException(400, "No hay departamentos registrados para este tenant")

    n_deptos = len(deptos)
    fecha_venc = body.fecha_vencimiento
    cobros_created = 0

    db.execute(text("DELETE FROM gastos_cobros WHERE periodo_id=:pid"), {"pid": periodo_id})

    for item in items:
        im = dict(item._mapping)
        monto_por_depto = round(float(im["monto_total"]) / n_deptos, 0)

        for depto in deptos:
            dm = dict(depto._mapping)
            persona_id = dm.get("residente_id") or dm.get("propietario_id")
            nombre = dm.get("residente_nombre") or dm.get("propietario_nombre") or "Sin asignar"

            db.execute(text("""
                INSERT INTO gastos_cobros
                  (tenant_id, periodo_id, departamento_id, persona_id, depto_numero,
                   nombre_residente, concepto, monto, estado, fecha_vencimiento)
                VALUES
                  (:tid, :pid, :did, :persona_id, :dnum,
                   :nombre, :concepto, :monto, 'pendiente', :fvenc)
            """), {
                "tid": body.tenant_id,
                "pid": periodo_id,
                "did": dm["id"],
                "persona_id": persona_id,
                "dnum": dm["numero"],
                "nombre": nombre,
                "concepto": im["concepto"],
                "monto": monto_por_depto,
                "fvenc": fecha_venc
            })
            cobros_created += 1

    total_monto = sum(float(dict(im._mapping)["monto_total"]) for im in items)
    db.execute(text("""
        UPDATE gastos_periodos SET total_monto=:monto, total_cobros=:cobros WHERE id=:id
    """), {"monto": total_monto, "cobros": cobros_created, "id": periodo_id})
    db.commit()

    return {"ok": True, "cobros_created": cobros_created, "total_monto": total_monto}


# -------------------------------------------------
# COBROS
# -------------------------------------------------

@router.get("/cobros")
def list_cobros(
    tenant_id: int,
    periodo_id: Optional[int] = None,
    estado: Optional[str] = None,
    depto: Optional[str] = None,
    db: Session = Depends(get_db)
):
    _ensure_tables(db)
    conditions = ["c.tenant_id = :tid"]
    params: dict = {"tid": tenant_id}
    if periodo_id:
        conditions.append("c.periodo_id = :pid")
        params["pid"] = periodo_id
    if estado:
        conditions.append("c.estado = :estado")
        params["estado"] = estado
    if depto:
        conditions.append("c.depto_numero ILIKE :depto")
        params["depto"] = "%" + depto + "%"

    where = " AND ".join(conditions)
    rows = db.execute(text(
        "SELECT c.*, gp.periodo FROM gastos_cobros c "
        "LEFT JOIN gastos_periodos gp ON gp.id = c.periodo_id "
        "WHERE {} ORDER BY c.fecha_vencimiento DESC, c.depto_numero".format(where)
    ), params).fetchall()
    return [_fmt_row(r) for r in rows]


@router.patch("/cobros/{id}/pagar")
def pagar_cobro(id: int, body: PagarBody, db: Session = Depends(get_db)):
    _ensure_tables(db)
    cobro = db.execute(text("SELECT * FROM gastos_cobros WHERE id=:id"), {"id": id}).fetchone()
    if not cobro:
        raise HTTPException(404, "Cobro no encontrado")
    db.execute(text("""
        UPDATE gastos_cobros SET estado='pagado', fecha_pago=NOW(),
               metodo_pago=:mp, comprobante_url=:curl WHERE id=:id
    """), {"mp": body.metodo_pago, "curl": body.comprobante_url, "id": id})
    db.commit()
    return {"ok": True}


@router.patch("/cobros/{id}/exentar")
def exentar_cobro(id: int, db: Session = Depends(get_db)):
    _ensure_tables(db)
    db.execute(text("UPDATE gastos_cobros SET estado='exento' WHERE id=:id"), {"id": id})
    db.commit()
    return {"ok": True}


@router.get("/resumen")
def resumen(tenant_id: int, periodo_id: Optional[int] = None, db: Session = Depends(get_db)):
    _ensure_tables(db)
    conditions = ["tenant_id = :tid"]
    params: dict = {"tid": tenant_id}
    if periodo_id:
        conditions.append("periodo_id = :pid")
        params["pid"] = periodo_id
    where = " AND ".join(conditions)

    row = db.execute(text(
        "SELECT "
        "COUNT(*) AS total_count, "
        "COALESCE(SUM(monto),0) AS total_monto, "
        "COUNT(*) FILTER (WHERE estado='pendiente') AS pendiente_count, "
        "COALESCE(SUM(monto) FILTER (WHERE estado='pendiente'),0) AS pendiente_monto, "
        "COUNT(*) FILTER (WHERE estado='pagado') AS pagado_count, "
        "COALESCE(SUM(monto) FILTER (WHERE estado='pagado'),0) AS pagado_monto, "
        "COUNT(*) FILTER (WHERE estado='vencido') AS vencido_count, "
        "COALESCE(SUM(monto) FILTER (WHERE estado='vencido'),0) AS vencido_monto, "
        "COUNT(*) FILTER (WHERE estado='exento') AS exento_count "
        "FROM gastos_cobros WHERE {}".format(where)
    ), params).fetchone()
    return _fmt_row(row)


# -------------------------------------------------
# FONDO DE RESERVA
# -------------------------------------------------

@router.get("/fondo")
def get_fondo(tenant_id: int, db: Session = Depends(get_db)):
    _ensure_tables(db)
    row = db.execute(text("""
        SELECT * FROM gastos_fondo_reserva WHERE tenant_id=:tid ORDER BY id LIMIT 1
    """), {"tid": tenant_id}).fetchone()
    if not row:
        return {"tenant_id": tenant_id, "saldo": 0.0}
    return _fmt_row(row)


@router.patch("/fondo")
def update_fondo(body: FondoUpdate, db: Session = Depends(get_db)):
    _ensure_tables(db)
    existing = db.execute(text("""
        SELECT id FROM gastos_fondo_reserva WHERE tenant_id=:tid LIMIT 1
    """), {"tid": body.tenant_id}).fetchone()

    if existing:
        db.execute(text("""
            UPDATE gastos_fondo_reserva SET saldo=:saldo, updated_at=NOW() WHERE tenant_id=:tid
        """), {"saldo": body.saldo, "tid": body.tenant_id})
    else:
        db.execute(text("""
            INSERT INTO gastos_fondo_reserva (tenant_id, saldo) VALUES (:tid, :saldo)
        """), {"tid": body.tenant_id, "saldo": body.saldo})
    db.commit()
    return {"ok": True, "saldo": body.saldo}


# -------------------------------------------------
# PORTAL RESIDENTE
# -------------------------------------------------

@router.get("/portal/gastos")
def portal_gastos(persona_id: int, tenant_id: int, db: Session = Depends(get_db)):
    _ensure_tables(db)
    rows = db.execute(text("""
        SELECT c.*, gp.periodo
        FROM gastos_cobros c
        LEFT JOIN gastos_periodos gp ON gp.id = c.periodo_id
        WHERE c.persona_id = :pid AND c.tenant_id = :tid
        ORDER BY c.fecha_vencimiento DESC
    """), {"pid": persona_id, "tid": tenant_id}).fetchall()
    return [_fmt_row(r) for r in rows]
