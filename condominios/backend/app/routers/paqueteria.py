"""
Paquetería — registro de encomiendas y notificación a residentes
POST   /api/paqueteria              → registrar paquete → email + push al residente
PATCH  /api/paqueteria/{id}/entregar→ marcar entregado
GET    /api/paqueteria              → listar (con filtros)
GET    /api/paqueteria/pendientes   → solo pendientes por depto (para Central)
DELETE /api/paqueteria/{id}         → eliminar registro (admin)
"""
import os
import time
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional
from pydantic import BaseModel
from app.core.database import get_db
from app.core.dependencies import get_current_user
import httpx

router = APIRouter(prefix="/api/paqueteria", tags=["Paquetería"])

CARRIERS = [
    "chilexpress", "bluexpress", "mercadolibre", "aliexpress",
    "correos_chile", "starken", "dhl", "fedex", "ups",
    "shein", "amazon", "temu", "otro"
]

CARRIER_LABELS = {
    "chilexpress": "Chilexpress", "bluexpress": "Bluexpress",
    "mercadolibre": "MercadoLibre", "aliexpress": "AliExpress",
    "correos_chile": "Correos de Chile", "starken": "Starken",
    "dhl": "DHL", "fedex": "FedEx", "ups": "UPS",
    "shein": "Shein", "amazon": "Amazon", "temu": "Temu", "otro": "Otro"
}


def _ensure_table(db: Session):
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS paqueteria (
            id SERIAL PRIMARY KEY,
            tenant_id INTEGER NOT NULL,
            condominio_id INTEGER,
            carrier VARCHAR(50) NOT NULL,
            tracking_number VARCHAR(100),
            depto_destino VARCHAR(20) NOT NULL,
            nombre_destinatario VARCHAR(200),
            persona_id INTEGER,
            persona_email VARCHAR(200),
            descripcion TEXT,
            estado VARCHAR(20) DEFAULT 'pendiente',
            notificado BOOLEAN DEFAULT false,
            registrado_por INTEGER,
            registrado_por_nombre VARCHAR(200),
            recibido_at TIMESTAMPTZ DEFAULT NOW(),
            entregado_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    """))
    db.commit()


def _lookup_residente(db, tenant_id: int, depto_numero: str, condominio_id: Optional[int] = None):
    """Find persona linked to an apartment."""
    try:
        sql = ("SELECT id, nombre_completo, email FROM personas "
               "WHERE tenant_id=:tid AND estado='activo' "
               "AND datos_contacto->>'departamento'=:dn")
        params: dict = {"tid": tenant_id, "dn": str(depto_numero)}
        if condominio_id:
            sql += " AND datos_contacto->>'condominio_id'=:cid"
            params["cid"] = str(condominio_id)
        sql += " LIMIT 1"
        row = db.execute(text(sql), params).fetchone()
        if row:
            return dict(row._mapping)
    except Exception:
        pass
    return None


def _enviar_notificacion_paquete(db, tenant_id: int, paquete_id: int, carrier: str,
                                  depto: str, nombre: str, email: str, tracking: Optional[str]):
    """Send email + create in-app notification."""
    carrier_label = CARRIER_LABELS.get(carrier, carrier)
    mail_url = os.getenv("MAIL_API_URL", "http://localhost:3004/api/send")
    mail_key = os.getenv("MAIL_API_KEY", "")

    html = (
        "<div style='font-family:sans-serif;max-width:480px;margin:0 auto'>"
        "<h2 style='color:#1e40af'>&#x1F4E6; Tienes un paquete esperándote</h2>"
        "<p>Hola <b>" + (nombre or "residente") + "</b>,</p>"
        "<p>Ha llegado un paquete a conserjería:</p>"
        "<table style='border-collapse:collapse;width:100%'>"
        "<tr><td style='padding:8px;border:1px solid #e2e8f0'><b>Transportista</b></td>"
        "<td style='padding:8px;border:1px solid #e2e8f0'>" + carrier_label + "</td></tr>"
        + ("<tr><td style='padding:8px;border:1px solid #e2e8f0'><b>N° Seguimiento</b></td>"
           "<td style='padding:8px;border:1px solid #e2e8f0;font-family:monospace'>" + str(tracking) + "</td></tr>" if tracking else "")
        + "<tr><td style='padding:8px;border:1px solid #e2e8f0'><b>Departamento</b></td>"
        "<td style='padding:8px;border:1px solid #e2e8f0'>" + str(depto) + "</td></tr>"
        "</table>"
        "<p style='margin-top:16px;color:#64748b;font-size:14px'>"
        "Por favor retíralo en conserjería durante el horario de atención.</p>"
        "<p style='color:#94a3b8;font-size:12px'>ConectaAI Condominios</p>"
        "</div>"
    )

    if email:
        try:
            httpx.post(mail_url,
                json={"to": email, "from": "no-reply@conectaai.cl",
                      "subject": "📦 Paquete de " + carrier_label + " en conserjería - Depto " + str(depto),
                      "html": html},
                headers={"Authorization": "Bearer " + mail_key}, timeout=8)
        except Exception:
            pass

    # In-app notification via notificaciones table
    try:
        db.execute(text(
            "INSERT INTO notificaciones (tenant_id,persona_id,tipo,titulo,mensaje,leida,created_at) "
            "VALUES (:tid,:pid,'paquete','📦 Paquete en conserjería',:msg,false,NOW()) "
            "ON CONFLICT DO NOTHING"
        ), {
            "tid": tenant_id,
            "pid": None,  # will be updated below
            "msg": "Tienes un paquete de " + carrier_label + " esperando en conserjería. Depto " + str(depto)
        })
        db.commit()
    except Exception:
        db.rollback()
        # Try creating a minimal notif
        try:
            db.execute(text(
                "INSERT INTO notificaciones_paquete (tenant_id,paquete_id,depto,mensaje,leida,created_at) "
                "VALUES (:tid,:pid,:depto,:msg,false,NOW())"
            ), {"tid": tenant_id, "pid": paquete_id, "depto": depto,
                "msg": "Paquete de " + carrier_label + " en conserjería"})
            db.commit()
        except Exception:
            db.rollback()


# ── Routes ────────────────────────────────────────────────────────────────────

class PaqueteCreate(BaseModel):
    tenant_id: int
    condominio_id: Optional[int] = None
    carrier: str
    tracking_number: Optional[str] = None
    depto_destino: str
    nombre_destinatario: Optional[str] = None
    descripcion: Optional[str] = None
    registrado_por: Optional[int] = None
    registrado_por_nombre: Optional[str] = None


@router.post("", status_code=201)
def registrar_paquete(body: PaqueteCreate, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_id = current_user["tenant_id"]
    _ensure_table(db)

    if body.carrier not in CARRIERS:
        raise HTTPException(400, "Carrier inválido. Válidos: " + ", ".join(CARRIERS))

    # Lookup resident
    residente = _lookup_residente(db, body.tenant_id, body.depto_destino, body.condominio_id)
    persona_id = residente["id"] if residente else None
    persona_email = residente.get("email") if residente else None
    nombre_dest = body.nombre_destinatario or (residente.get("nombre_completo") if residente else None)

    row = db.execute(text(
        "INSERT INTO paqueteria (tenant_id,condominio_id,carrier,tracking_number,"
        "depto_destino,nombre_destinatario,persona_id,persona_email,descripcion,"
        "registrado_por,registrado_por_nombre) "
        "VALUES (:tid,:cid,:carrier,:track,:depto,:nom,:pid,:email,:desc,:regid,:regnm) "
        "RETURNING id, recibido_at"
    ), {
        "tid": body.tenant_id, "cid": body.condominio_id,
        "carrier": body.carrier, "track": body.tracking_number,
        "depto": body.depto_destino, "nom": nombre_dest,
        "pid": persona_id, "email": persona_email,
        "desc": body.descripcion, "regid": body.registrado_por, "regnm": body.registrado_por_nombre
    }).fetchone()
    db.commit()
    paquete_id = row._mapping["id"]

    # Send notification
    _enviar_notificacion_paquete(
        db, body.tenant_id, paquete_id, body.carrier,
        body.depto_destino, nombre_dest or "", persona_email or "",
        body.tracking_number
    )

    # Mark as notified
    try:
        db.execute(text("UPDATE paqueteria SET notificado=true WHERE id=:id"), {"id": paquete_id})
        db.commit()
    except Exception:
        db.rollback()

    return {
        "id": paquete_id,
        "recibido_at": str(row._mapping["recibido_at"]),
        "persona_nombre": nombre_dest,
        "persona_email": persona_email,
        "notificado": bool(persona_email)
    }


@router.patch("/{paquete_id}/entregar")
def marcar_entregado(paquete_id: int, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_id = current_user["tenant_id"]
    p = db.execute(text("SELECT * FROM paqueteria WHERE id=:id"), {"id": paquete_id}).fetchone()
    if not p:
        raise HTTPException(404, "Paquete no encontrado")
    db.execute(text("UPDATE paqueteria SET estado='entregado', entregado_at=NOW() WHERE id=:id"), {"id": paquete_id})
    db.commit()
    return {"ok": True}


@router.get("")
def listar_paquetes(
    condominio_id: Optional[int] = None,
    estado: Optional[str] = None,
    depto: Optional[str] = None,
    limit: int = 100,
    current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)
):
    tenant_id = current_user["tenant_id"]
    _ensure_table(db)
    sql = "SELECT * FROM paqueteria WHERE tenant_id=:tid"
    params: dict = {"tid": tenant_id}
    if condominio_id:
        sql += " AND condominio_id=:cid"; params["cid"] = condominio_id
    if estado:
        sql += " AND estado=:est"; params["est"] = estado
    if depto:
        sql += " AND depto_destino ILIKE :depto"; params["depto"] = "%" + depto + "%"
    sql += " ORDER BY recibido_at DESC LIMIT :lim"; params["lim"] = limit
    rows = db.execute(text(sql), params).fetchall()
    result = []
    for r in rows:
        d = dict(r._mapping)
        d["recibido_at"] = str(d.get("recibido_at") or "")
        d["entregado_at"] = str(d.get("entregado_at") or "")
        result.append(d)
    return result


@router.get("/pendientes")
def pendientes_por_depto(condominio_id: Optional[int] = None, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """For Central page: pending packages grouped by apartment."""
    tenant_id = current_user["tenant_id"]
    _ensure_table(db)
    sql = ("SELECT depto_destino, nombre_destinatario, carrier, tracking_number, "
           "recibido_at::text, id FROM paqueteria WHERE tenant_id=:tid AND estado='pendiente'")
    params: dict = {"tid": tenant_id}
    if condominio_id:
        sql += " AND condominio_id=:cid"; params["cid"] = condominio_id
    sql += " ORDER BY recibido_at DESC"
    rows = db.execute(text(sql), params).fetchall()
    return [dict(r._mapping) for r in rows]


@router.delete("/{paquete_id}")
def eliminar_paquete(paquete_id: int, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_id = current_user["tenant_id"]
    db.execute(text("DELETE FROM paqueteria WHERE id=:id"), {"id": paquete_id})
    db.commit()
    return {"ok": True}


@router.get("/carriers")
def get_carriers():
    tenant_id = current_user["tenant_id"]
    return [{"value": k, "label": v} for k, v in CARRIER_LABELS.items()]
