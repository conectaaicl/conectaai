from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Optional
from datetime import datetime, date
from pydantic import BaseModel
import os
import httpx

from app.core.database import get_db
from app.core.dependencies import get_current_user

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
    db.execute(text("ALTER TABLE gastos_periodos ADD COLUMN IF NOT EXISTS metodo_distribucion VARCHAR(20) DEFAULT 'igualitaria'"))
    db.execute(text("ALTER TABLE gastos_periodos ADD COLUMN IF NOT EXISTS fecha_vencimiento DATE"))
    db.execute(text("ALTER TABLE departamentos ADD COLUMN IF NOT EXISTS alicuota NUMERIC(8,4)"))
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
    tenant_id: Optional[int] = None
    condominio_id: Optional[int] = None
    periodo: str
    notas: Optional[str] = None


class ItemCreate(BaseModel):
    tenant_id: Optional[int] = None
    concepto: str
    monto_total: float
    tipo_distribucion: str = "igualitaria"


class DistribuirBody(BaseModel):
    tenant_id: Optional[int] = None
    fecha_vencimiento: str  # YYYY-MM-DD
    metodo: str = "igualitaria"   # igualitaria | metraje | alicuota


class ItemSimple(BaseModel):
    concepto: str
    monto_total: float


class PeriodoCompletoCreate(BaseModel):
    periodo: str
    fecha_vencimiento: str
    metodo: str = "igualitaria"
    notas: Optional[str] = None
    items: List[ItemSimple]
    condominio_id: Optional[int] = None


class ProrrateoItem(BaseModel):
    departamento_id: int
    metraje: Optional[float] = None
    alicuota: Optional[float] = None


class ProrrateoBody(BaseModel):
    items: List[ProrrateoItem]


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

METODOS = {"igualitaria": "Partes iguales", "metraje": "Por metros cuadrados", "alicuota": "Por alicuota (%)"}


def _periodo_del_tenant(db: Session, periodo_id: int, tenant_id: int):
    row = db.execute(text("SELECT * FROM gastos_periodos WHERE id=:id AND tenant_id=:tid"), {"id": periodo_id, "tid": tenant_id}).fetchone()
    if not row:
        raise HTTPException(404, "Periodo no encontrado")
    return row


def _deptos_tenant(db: Session, tenant_id: int):
    return [dict(r._mapping) for r in db.execute(text("""
        SELECT d.id, d.numero, d.metraje, d.alicuota, d.propietario_id, d.residente_id,
               p.nombre_completo AS propietario_nombre, r.nombre_completo AS residente_nombre
        FROM departamentos d
        LEFT JOIN personas p ON p.id = d.propietario_id
        LEFT JOIN personas r ON r.id = d.residente_id
        WHERE d.tenant_id = :tid
        ORDER BY length(d.numero), d.numero
    """), {"tid": tenant_id}).fetchall()]


def _pesos(deptos: list, metodo: str):
    """Devuelve {depto_id: peso} normalizado a 1. Lanza 400 si faltan datos para el metodo."""
    if metodo not in METODOS:
        raise HTTPException(400, f"Metodo invalido. Opciones: {list(METODOS)}")
    if metodo == "igualitaria":
        n = len(deptos)
        return {d["id"]: 1.0 / n for d in deptos}
    campo = "metraje" if metodo == "metraje" else "alicuota"
    faltan = [d["numero"] for d in deptos if not d.get(campo) or float(d[campo]) <= 0]
    if faltan:
        etiqueta = "metros cuadrados" if metodo == "metraje" else "alicuota"
        raise HTTPException(400, f"Faltan {etiqueta} en {len(faltan)} unidad(es): {', '.join(faltan[:8])}{'...' if len(faltan) > 8 else ''}. Completalos en el paso de reparto.")
    total = sum(float(d[campo]) for d in deptos)
    return {d["id"]: float(d[campo]) / total for d in deptos}


def _distribuir_items(db: Session, tenant_id: int, periodo_id: int, items: list, metodo: str, fecha_venc: str):
    deptos = _deptos_tenant(db, tenant_id)
    if not deptos:
        raise HTTPException(400, "No hay departamentos registrados en este condominio")
    pesos = _pesos(deptos, metodo)
    db.execute(text("DELETE FROM gastos_cobros WHERE periodo_id=:pid AND tenant_id=:tid"), {"pid": periodo_id, "tid": tenant_id})
    creados = 0
    for im in items:
        total_item = float(im["monto_total"])
        for d in deptos:
            monto = round(total_item * pesos[d["id"]], 0)
            persona_id = d.get("residente_id") or d.get("propietario_id")
            nombre = d.get("residente_nombre") or d.get("propietario_nombre") or "Sin asignar"
            db.execute(text("""
                INSERT INTO gastos_cobros (tenant_id, periodo_id, departamento_id, persona_id, depto_numero,
                                           nombre_residente, concepto, monto, estado, fecha_vencimiento)
                VALUES (:tid, :pid, :did, :persona_id, :dnum, :nombre, :concepto, :monto, 'pendiente', :fvenc)
            """), {"tid": tenant_id, "pid": periodo_id, "did": d["id"], "persona_id": persona_id, "dnum": d["numero"],
                   "nombre": nombre, "concepto": im["concepto"], "monto": monto, "fvenc": fecha_venc})
            creados += 1
    total_monto = sum(float(im["monto_total"]) for im in items)
    db.execute(text("UPDATE gastos_periodos SET total_monto=:m, total_cobros=:c, metodo_distribucion=:met, fecha_vencimiento=:fv WHERE id=:id AND tenant_id=:tid"),
               {"m": total_monto, "c": creados, "met": metodo, "fv": fecha_venc, "id": periodo_id, "tid": tenant_id})
    return creados, total_monto, len(deptos)

_SCHEMA_OK = False

def _ensure_tables(db: Session):
    """Crea tablas si faltan y aplica las columnas nuevas (idempotente, una vez por proceso)."""
    global _SCHEMA_OK
    if _SCHEMA_OK:
        return
    try:
        _create_tables(db)
        _SCHEMA_OK = True
    except Exception:
        db.rollback()


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
def list_periodos(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    tenant_id = current_user["tenant_id"]
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
def create_periodo(body: PeriodoCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    _ensure_tables(db)
    row = db.execute(text("""
        INSERT INTO gastos_periodos (tenant_id, condominio_id, periodo, notas)
        VALUES (:tid, :cid, :periodo, :notas)
        RETURNING *
    """), {"tid": current_user["tenant_id"], "cid": body.condominio_id,
           "periodo": body.periodo, "notas": body.notas}).fetchone()
    db.commit()
    return _fmt_row(row)


@router.get("/periodos/{id}")
def get_periodo(id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    _ensure_tables(db)
    periodo = _periodo_del_tenant(db, id, current_user["tenant_id"])
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
def emitir_periodo(id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    tenant_id = current_user["tenant_id"]
    _ensure_tables(db)
    periodo = _periodo_del_tenant(db, id, tenant_id)
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
def cerrar_periodo(id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    _ensure_tables(db)
    _periodo_del_tenant(db, id, current_user["tenant_id"])
    db.execute(text("UPDATE gastos_periodos SET estado='cerrado' WHERE id=:id AND tenant_id=:tid"), {"id": id, "tid": current_user["tenant_id"]})
    db.commit()
    return {"ok": True, "estado": "cerrado"}


@router.delete("/periodos/{id}")
def delete_periodo(id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    _ensure_tables(db)
    periodo = _periodo_del_tenant(db, id, current_user["tenant_id"])
    if periodo._mapping["estado"] != "borrador":
        raise HTTPException(400, "Solo se pueden eliminar periodos en estado borrador")
    db.execute(text("DELETE FROM gastos_periodos WHERE id=:id AND tenant_id=:tid"), {"id": id, "tid": current_user["tenant_id"]})
    db.commit()
    return {"ok": True}


# -------------------------------------------------
# ITEMS
# -------------------------------------------------

@router.post("/periodos/{periodo_id}/items", status_code=201)
def add_item(periodo_id: int, body: ItemCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    _ensure_tables(db)
    _periodo_del_tenant(db, periodo_id, current_user["tenant_id"])
    row = db.execute(text("""
        INSERT INTO gastos_items (tenant_id, periodo_id, concepto, monto_total, tipo_distribucion)
        VALUES (:tid, :pid, :concepto, :monto, :dist)
        RETURNING *
    """), {"tid": current_user["tenant_id"], "pid": periodo_id, "concepto": body.concepto,
           "monto": body.monto_total, "dist": body.tipo_distribucion}).fetchone()
    db.commit()
    return _fmt_row(row)


@router.delete("/items/{id}")
def delete_item(id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    _ensure_tables(db)
    db.execute(text("DELETE FROM gastos_items WHERE id=:id AND tenant_id=:tid"), {"id": id, "tid": current_user["tenant_id"]})
    db.commit()
    return {"ok": True}


@router.post("/periodos/{periodo_id}/distribuir")
def distribuir(periodo_id: int, body: DistribuirBody, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    _ensure_tables(db)
    tenant_id = current_user["tenant_id"]
    _periodo_del_tenant(db, periodo_id, tenant_id)
    items = [dict(r._mapping) for r in db.execute(text("SELECT * FROM gastos_items WHERE periodo_id=:pid AND tenant_id=:tid"), {"pid": periodo_id, "tid": tenant_id}).fetchall()]
    if not items:
        raise HTTPException(400, "No hay items de gasto para distribuir")
    creados, total_monto, n = _distribuir_items(db, tenant_id, periodo_id, items, body.metodo, body.fecha_vencimiento)
    db.commit()
    return {"ok": True, "cobros_created": creados, "total_monto": total_monto, "departamentos": n, "metodo": body.metodo}



@router.post("/periodos/completo", status_code=201)
def crear_periodo_completo(body: PeriodoCompletoCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Crea el periodo, sus items y distribuye los cobros entre todas las unidades en un solo paso."""
    tenant_id = current_user["tenant_id"]
    _ensure_tables(db)
    if not body.items or any(i.monto_total <= 0 or not i.concepto.strip() for i in body.items):
        raise HTTPException(400, "Agrega al menos un gasto con concepto y monto mayor a 0")
    dup = db.execute(text("SELECT id FROM gastos_periodos WHERE tenant_id=:tid AND periodo=:p"), {"tid": tenant_id, "p": body.periodo}).fetchone()
    if dup:
        raise HTTPException(400, f"Ya existe un periodo {body.periodo}. Abrelo desde la lista para editarlo.")
    pid = db.execute(text("""
        INSERT INTO gastos_periodos (tenant_id, condominio_id, periodo, estado, notas, metodo_distribucion, fecha_vencimiento)
        VALUES (:tid, :cid, :p, 'borrador', :n, :met, :fv) RETURNING id
    """), {"tid": tenant_id, "cid": body.condominio_id, "p": body.periodo, "n": body.notas, "met": body.metodo, "fv": body.fecha_vencimiento}).scalar()
    items = []
    for it in body.items:
        db.execute(text("INSERT INTO gastos_items (tenant_id, periodo_id, concepto, monto_total, tipo_distribucion) VALUES (:tid, :pid, :c, :m, :t)"),
                   {"tid": tenant_id, "pid": pid, "c": it.concepto.strip(), "m": it.monto_total, "t": body.metodo})
        items.append({"concepto": it.concepto.strip(), "monto_total": it.monto_total})
    try:
        creados, total, n = _distribuir_items(db, tenant_id, pid, items, body.metodo, body.fecha_vencimiento)
    except HTTPException:
        db.rollback(); raise
    db.commit()
    return {"ok": True, "periodo_id": pid, "cobros_created": creados, "total_monto": total, "departamentos": n,
            "promedio_por_unidad": round(total / n, 0) if n else 0}


@router.get("/preview-distribucion")
def preview_distribucion(metodo: str = "igualitaria", total: float = 0, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Como quedaria repartido un total entre las unidades, sin guardar nada."""
    tenant_id = current_user["tenant_id"]
    _ensure_tables(db)
    deptos = _deptos_tenant(db, tenant_id)
    if not deptos:
        return {"ok": False, "detail": "No hay departamentos registrados", "unidades": []}
    try:
        pesos = _pesos(deptos, metodo)
    except HTTPException as e:
        return {"ok": False, "detail": e.detail, "unidades": [
            {"departamento_id": d["id"], "numero": d["numero"], "metraje": d.get("metraje"), "alicuota": float(d["alicuota"]) if d.get("alicuota") else None,
             "residente": d.get("residente_nombre") or d.get("propietario_nombre"), "monto": None} for d in deptos]}
    return {"ok": True, "metodo": metodo, "unidades": [
        {"departamento_id": d["id"], "numero": d["numero"], "metraje": d.get("metraje"), "alicuota": float(d["alicuota"]) if d.get("alicuota") else None,
         "residente": d.get("residente_nombre") or d.get("propietario_nombre"), "peso": round(pesos[d["id"]] * 100, 2),
         "monto": round(float(total) * pesos[d["id"]], 0)} for d in deptos]}


@router.put("/prorrateo")
def guardar_prorrateo(body: ProrrateoBody, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Guarda metraje y/o alicuota por unidad (solo unidades de este condominio)."""
    tenant_id = current_user["tenant_id"]
    _ensure_tables(db)
    n = 0
    for it in body.items:
        sets, params = [], {"id": it.departamento_id, "tid": tenant_id}
        if it.metraje is not None: sets.append("metraje=:m"); params["m"] = it.metraje
        if it.alicuota is not None: sets.append("alicuota=:a"); params["a"] = it.alicuota
        if not sets: continue
        n += db.execute(text(f"UPDATE departamentos SET {', '.join(sets)}, updated_at=NOW() WHERE id=:id AND tenant_id=:tid"), params).rowcount
    db.commit()
    return {"ok": True, "actualizados": n}


@router.get("/metodos")
def metodos():
    return [{"value": k, "label": v} for k, v in METODOS.items()]


# -------------------------------------------------
# COBROS
# -------------------------------------------------

@router.get("/cobros")
def list_cobros(
    periodo_id: Optional[int] = None,
    estado: Optional[str] = None,
    depto: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    tenant_id = current_user["tenant_id"]
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
def pagar_cobro(id: int, body: PagarBody, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    _ensure_tables(db)
    cobro = db.execute(text("SELECT * FROM gastos_cobros WHERE id=:id AND tenant_id=:tid"), {"id": id, "tid": current_user["tenant_id"]}).fetchone()
    if not cobro:
        raise HTTPException(404, "Cobro no encontrado")
    db.execute(text("""
        UPDATE gastos_cobros SET estado='pagado', fecha_pago=NOW(),
               metodo_pago=:mp, comprobante_url=:curl WHERE id=:id AND tenant_id=:tid
    """), {"mp": body.metodo_pago, "curl": body.comprobante_url, "id": id, "tid": current_user["tenant_id"]})
    db.commit()
    return {"ok": True}


@router.patch("/cobros/{id}/exentar")
def exentar_cobro(id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    _ensure_tables(db)
    db.execute(text("UPDATE gastos_cobros SET estado='exento' WHERE id=:id AND tenant_id=:tid"), {"id": id, "tid": current_user["tenant_id"]})
    db.commit()
    return {"ok": True}


@router.get("/resumen")
def resumen(periodo_id: Optional[int] = None, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    tenant_id = current_user["tenant_id"]
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
def get_fondo(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    tenant_id = current_user["tenant_id"]
    _ensure_tables(db)
    row = db.execute(text("""
        SELECT * FROM gastos_fondo_reserva WHERE tenant_id=:tid ORDER BY id LIMIT 1
    """), {"tid": tenant_id}).fetchone()
    if not row:
        return {"tenant_id": tenant_id, "saldo": 0.0}
    return _fmt_row(row)


@router.patch("/fondo")
def update_fondo(body: FondoUpdate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
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
def portal_gastos(persona_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    tenant_id = current_user["tenant_id"]
    _ensure_tables(db)
    rows = db.execute(text("""
        SELECT c.*, gp.periodo
        FROM gastos_cobros c
        LEFT JOIN gastos_periodos gp ON gp.id = c.periodo_id
        WHERE c.persona_id = :pid AND c.tenant_id = :tid
        ORDER BY c.fecha_vencimiento DESC
    """), {"pid": persona_id, "tid": tenant_id}).fetchall()
    return [_fmt_row(r) for r in rows]
