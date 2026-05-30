"""
Multas — registro y notificación de infracciones a residentes
GET    /api/multas               → listar
POST   /api/multas               → crear + notificar
PATCH  /api/multas/{id}/notificar → reenviar notificación
PATCH  /api/multas/{id}/pagar    → marcar pagada
PATCH  /api/multas/{id}/anular   → anular
GET    /api/multas/resumen        → stats
"""
import os
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional
from pydantic import BaseModel
from app.core.database import get_db
from app.core.dependencies import get_current_user
import httpx

router = APIRouter(prefix="/api/multas", tags=["Multas"])

TIPOS = ["ruido", "mascotas", "basura", "estacionamiento", "visitas", "reglamento", "otro"]


def _ensure_table(db: Session):
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS multas (
            id SERIAL PRIMARY KEY,
            tenant_id INTEGER NOT NULL,
            persona_id INTEGER,
            departamento_id INTEGER,
            depto_numero VARCHAR(20),
            nombre_infractor VARCHAR(200),
            tipo VARCHAR(100) NOT NULL,
            descripcion TEXT NOT NULL,
            monto DECIMAL(10,2) DEFAULT 0,
            estado VARCHAR(20) DEFAULT 'pendiente',
            fecha_infraccion DATE NOT NULL,
            fecha_notificacion TIMESTAMPTZ,
            fecha_resolucion TIMESTAMPTZ,
            notificado_por VARCHAR(200),
            evidencia_url TEXT,
            notas_resolucion TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    """))
    db.commit()


def _send_multa_email(db: Session, tenant_id: int, depto: str, monto: float,
                      tipo: str, descripcion: str, fecha: str):
    try:
        row = db.execute(text(
            "SELECT email, nombre_completo FROM personas WHERE tenant_id=:tid "
            "AND datos_contacto->>'departamento'=:dn AND estado='activo' LIMIT 1"
        ), {"tid": tenant_id, "dn": str(depto)}).fetchone()
        if not row or not row._mapping.get("email"):
            return
        mail_url = os.getenv("MAIL_API_URL", "http://localhost:3004/api/send")
        mail_key = os.getenv("MAIL_API_KEY", "")
        nombre = row._mapping.get("nombre_completo") or "Residente"
        html = (
            "<div style='font-family:sans-serif;max-width:520px'>"
            "<h2 style='color:#dc2626'>Notificacion de Multa</h2>"
            "<p>Estimado/a <b>" + nombre + "</b>,</p>"
            "<p>Se ha registrado una infraccion en el condominio:</p>"
            "<table style='border-collapse:collapse;width:100%'>"
            "<tr><td style='padding:8px;border:1px solid #e5e7eb'><b>Tipo</b></td>"
            "<td style='padding:8px;border:1px solid #e5e7eb'>" + tipo + "</td></tr>"
            "<tr><td style='padding:8px;border:1px solid #e5e7eb'><b>Descripcion</b></td>"
            "<td style='padding:8px;border:1px solid #e5e7eb'>" + descripcion + "</td></tr>"
            "<tr><td style='padding:8px;border:1px solid #e5e7eb'><b>Monto</b></td>"
            "<td style='padding:8px;border:1px solid #e5e7eb'>$" + str(int(monto)) + "</td></tr>"
            "<tr><td style='padding:8px;border:1px solid #e5e7eb'><b>Fecha</b></td>"
            "<td style='padding:8px;border:1px solid #e5e7eb'>" + fecha + "</td></tr>"
            "</table>"
            "<p style='color:#6b7280;font-size:13px;margin-top:16px'>ConectaAI Condominios</p></div>"
        )
        httpx.post(
            mail_url,
            json={"to": row._mapping["email"], "from": "no-reply@conectaai.cl",
                  "subject": "Notificacion de Multa - Depto " + depto, "html": html},
            headers={"Authorization": "Bearer " + mail_key},
            timeout=6,
        )
    except Exception:
        pass


class MultaCreate(BaseModel):
    tenant_id: int
    persona_id: Optional[int] = None
    depto_numero: str
    nombre_infractor: Optional[str] = None
    tipo: str
    descripcion: str
    monto: float = 0
    fecha_infraccion: str
    notificado_por: Optional[str] = None
    evidencia_url: Optional[str] = None


@router.get("")
def listar_multas(
    estado: Optional[str] = None,
    depto: Optional[str] = None,
    tipo: Optional[str] = None,
    limit: int = 100,
    current_user: dict = Depends(get_current_user), db: Session = Depends(get_db),
):
    tenant_id = current_user["tenant_id"]
    _ensure_table(db)
    sql = "SELECT * FROM multas WHERE tenant_id=:tid"
    p: dict = {"tid": tenant_id}
    if estado:
        sql += " AND estado=:est"
        p["est"] = estado
    if depto:
        sql += " AND depto_numero ILIKE :dep"
        p["dep"] = "%" + depto + "%"
    if tipo:
        sql += " AND tipo=:tipo"
        p["tipo"] = tipo
    sql += " ORDER BY created_at DESC LIMIT :lim"
    p["lim"] = limit
    rows = db.execute(text(sql), p).fetchall()
    result = []
    for r in rows:
        d = dict(r._mapping)
        for f in ["created_at", "fecha_notificacion", "fecha_resolucion", "fecha_infraccion"]:
            d[f] = str(d.get(f) or "")
        result.append(d)
    return result


@router.post("", status_code=201)
def crear_multa(body: MultaCreate, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_id = current_user["tenant_id"]
    _ensure_table(db)
    if body.tipo not in TIPOS:
        raise HTTPException(400, "Tipo invalido. Validos: " + ", ".join(TIPOS))
    row = db.execute(text(
        "INSERT INTO multas (tenant_id,persona_id,depto_numero,nombre_infractor,tipo,descripcion,"
        "monto,fecha_infraccion,notificado_por,evidencia_url,fecha_notificacion,estado) "
        "VALUES (:tid,:pid,:dep,:nom,:tipo,:desc,:monto,:fecha,:npor,:ev,NOW(),'notificada') RETURNING id"
    ), {
        "tid": body.tenant_id, "pid": body.persona_id, "dep": body.depto_numero,
        "nom": body.nombre_infractor, "tipo": body.tipo, "desc": body.descripcion,
        "monto": body.monto, "fecha": body.fecha_infraccion, "npor": body.notificado_por,
        "ev": body.evidencia_url,
    }).fetchone()
    db.commit()
    _send_multa_email(db, body.tenant_id, body.depto_numero, body.monto,
                      body.tipo, body.descripcion, body.fecha_infraccion)
    return {"id": row._mapping["id"]}


@router.patch("/{multa_id}/notificar")
def notificar_multa(multa_id: int, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_id = current_user["tenant_id"]
    m = db.execute(text("SELECT * FROM multas WHERE id=:id"), {"id": multa_id}).fetchone()
    if not m:
        raise HTTPException(404, "Multa no encontrada")
    d = dict(m._mapping)
    db.execute(text("UPDATE multas SET estado='notificada', fecha_notificacion=NOW() WHERE id=:id"),
               {"id": multa_id})
    db.commit()
    _send_multa_email(db, d["tenant_id"], d.get("depto_numero") or "",
                      float(d.get("monto") or 0), d["tipo"], d["descripcion"],
                      str(d.get("fecha_infraccion") or ""))
    return {"ok": True}


@router.patch("/{multa_id}/pagar")
def pagar_multa(multa_id: int, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_id = current_user["tenant_id"]
    db.execute(text(
        "UPDATE multas SET estado='pagada', fecha_resolucion=NOW() WHERE id=:id"
    ), {"id": multa_id})
    db.commit()
    return {"ok": True}


@router.patch("/{multa_id}/anular")
def anular_multa(multa_id: int, motivo: Optional[str] = "", current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_id = current_user["tenant_id"]
    db.execute(text(
        "UPDATE multas SET estado='anulada', fecha_resolucion=NOW(), notas_resolucion=:m WHERE id=:id"
    ), {"m": motivo, "id": multa_id})
    db.commit()
    return {"ok": True}


@router.get("/resumen")
def resumen_multas(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_id = current_user["tenant_id"]
    _ensure_table(db)
    rows = db.execute(text(
        "SELECT estado, COUNT(*) as total, COALESCE(SUM(monto),0) as monto_total "
        "FROM multas WHERE tenant_id=:tid GROUP BY estado"
    ), {"tid": tenant_id}).fetchall()
    res = {"pendiente": 0, "notificada": 0, "apelada": 0, "pagada": 0, "anulada": 0,
           "monto_pendiente": 0.0}
    for r in rows:
        d = dict(r._mapping)
        if d["estado"] in res:
            res[d["estado"]] = int(d["total"])
        if d["estado"] in ("pendiente", "notificada"):
            res["monto_pendiente"] += float(d["monto_total"])
    return res
