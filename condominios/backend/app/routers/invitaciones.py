"""
Invitaciones de acceso por link (flujo tipo Safecard).

El residente crea la visita (tabla visitas_qr) y comparte el link publico /i/<token>.
El visitante abre el link, ingresa su celular (queda ligado a la invitacion; otro
celular no puede usarla) y ve su codigo QR. En porteria se escanea el QR
(/acceso/qr/<token>): el ingreso es de un solo uso y avisa al residente por push
y al conserje por el feed en vivo.
"""
import os
import re
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.acceso import VisitaQR

router = APIRouter(prefix="/api/invitacion", tags=["Invitaciones de acceso"])

_SCHEMA_OK = False


def _ensure_schema(db: Session):
    global _SCHEMA_OK
    if _SCHEMA_OK:
        return
    db.execute(text("ALTER TABLE visitas_qr ADD COLUMN IF NOT EXISTS celular_visitante VARCHAR(30)"))
    db.execute(text("ALTER TABLE visitas_qr ADD COLUMN IF NOT EXISTS activado_en TIMESTAMPTZ"))
    db.execute(text("ALTER TABLE visitas_qr ADD COLUMN IF NOT EXISTS vistas INTEGER DEFAULT 0"))
    db.commit()
    _SCHEMA_OK = True


def norm_celular(raw: str) -> str:
    """+56 9 1234 5678 / 912345678 / 56912345678 -> 56912345678"""
    d = re.sub(r"\D", "", raw or "")
    if len(d) == 9 and d.startswith("9"):
        d = "56" + d
    if len(d) == 8:
        d = "569" + d
    if len(d) < 11 or len(d) > 15:
        raise HTTPException(400, "Ingresa un celular válido (9 dígitos)")
    return d


def base_url(request: Request) -> str:
    host = request.headers.get("x-forwarded-host") or request.headers.get("host") or "condo.conectaai.cl"
    proto = request.headers.get("x-forwarded-proto") or "https"
    return f"{proto}://{host.split(',')[0].strip()}"


def estado_efectivo(v: VisitaQR) -> str:
    if v.estado in ("pendiente", "aprobado") and v.fecha_visita and v.fecha_visita < datetime.utcnow():
        return "expirado"
    return v.estado


def contexto(db: Session, v: VisitaQR) -> dict:
    """Nombre del condominio, unidad y anfitrion para mostrar en la invitacion."""
    row = db.execute(text("""
        SELECT c.nombre, c.direccion, c.tenant_id,
               d.numero, t.nombre AS torre,
               COALESCE(NULLIF(t2.metadata->>'brand_name',''), t2.nombre) AS marca
        FROM condominios c
        LEFT JOIN departamentos d ON d.id = :did
        LEFT JOIN pisos pi ON pi.id = d.piso_id
        LEFT JOIN torres t ON t.id = pi.torre_id
        LEFT JOIN tenants t2 ON t2.id = c.tenant_id
        WHERE c.id = :cid
    """), {"cid": v.condominio_id, "did": v.departamento_id}).fetchone()
    anfitrion = None
    if v.creado_por:
        a = db.execute(text("SELECT nombre_completo FROM residentes_portal WHERE id=:id"), {"id": v.creado_por}).fetchone()
        anfitrion = a[0] if a else None
    return {
        "condominio": row[0] if row else "Condominio",
        "direccion": row[1] if row else None,
        "tenant_id": row[2] if row else None,
        "unidad": row[3] if row else None,
        "torre": row[4] if row else None,
        "marca": row[5] if row else None,
        "anfitrion": anfitrion,
    }


def _visita(db: Session, token: str) -> VisitaQR:
    _ensure_schema(db)
    v = db.query(VisitaQR).filter(VisitaQR.qr_token == token).first()
    if not v:
        raise HTTPException(404, "Invitación no encontrada")
    return v


def payload(db: Session, v: VisitaQR, request: Request, revelar_qr: bool) -> dict:
    ctx = contexto(db, v)
    est = estado_efectivo(v)
    cel = getattr(v, "celular_visitante", None)
    data = {
        "token": v.qr_token,
        "visitante": v.nombre_visitante,
        "motivo": v.motivo,
        "estado": est,
        "valida_hasta": v.fecha_visita.isoformat() if v.fecha_visita else None,
        "hora_entrada": v.hora_entrada.isoformat() if v.hora_entrada else None,
        "activada": bool(cel),
        "celular_oculto": (f"•••• {cel[-4:]}" if cel else None),
        **{k: ctx[k] for k in ("condominio", "direccion", "unidad", "torre", "anfitrion", "marca")},
    }
    if revelar_qr:
        # El QR contiene la URL que escanea porteria; el visitante nunca ve el token "crudo" fuera del QR.
        data["qr_data"] = f"{base_url(request)}/acceso/qr/{v.qr_token}"
    return data


@router.get("/{token}")
def ver_invitacion(token: str, request: Request, db: Session = Depends(get_db)):
    """Publico. Muestra los datos de la invitacion; el QR solo se entrega si ya fue activada."""
    v = _visita(db, token)
    try:
        db.execute(text("UPDATE visitas_qr SET vistas = COALESCE(vistas,0)+1 WHERE id=:id"), {"id": v.id}); db.commit()
    except Exception:
        db.rollback()
    return payload(db, v, request, revelar_qr=bool(getattr(v, "celular_visitante", None)))


class ActivarIn(BaseModel):
    celular: str


@router.post("/{token}/activar")
def activar_invitacion(token: str, body: ActivarIn, request: Request, db: Session = Depends(get_db)):
    """Publico. Liga la invitacion al celular del visitante y entrega el QR.
    Si ya esta ligada a otro celular, se rechaza (una invitacion = una persona)."""
    v = _visita(db, token)
    est = estado_efectivo(v)
    if est in ("expirado", "rechazado", "cancelado"):
        raise HTTPException(410, "Esta invitación ya no está vigente. Pide una nueva a quien te invitó.")
    cel = norm_celular(body.celular)
    actual = getattr(v, "celular_visitante", None)
    if actual and actual != cel:
        raise HTTPException(403, "Esta invitación ya fue activada desde otro celular.")
    if not actual:
        db.execute(text("UPDATE visitas_qr SET celular_visitante=:c, activado_en=NOW() WHERE id=:id"), {"c": cel, "id": v.id})
        db.commit(); db.refresh(v)
        _avisar_anfitrion(db, v, "Tu visita activó su invitación", f"{v.nombre_visitante} ya tiene su código QR de acceso.")
    return payload(db, v, request, revelar_qr=True)


# ─── Avisos (usados tambien por accesos.py al registrar el ingreso) ─────────

def _avisar_anfitrion(db: Session, v: VisitaQR, titulo: str, mensaje: str):
    """Push al residente que invito (residentes_portal.id == visitas_qr.creado_por)."""
    if not v.creado_por:
        return
    try:
        from app.routers.push_notifications import _send_push, _ensure_table
        _ensure_table(db)
        tid = contexto(db, v)["tenant_id"]
        subs = db.execute(text("SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE persona_id=:pid AND tenant_id=:tid"),
                          {"pid": v.creado_por, "tid": tid}).fetchall()
        for s in subs:
            m = s._mapping
            _send_push(m["endpoint"], m["p256dh"], m["auth"], {"titulo": titulo, "mensaje": mensaje, "url": "/portal/qr", "icono": "/icon-192.png"})
    except Exception:
        pass


def _avisar_conserje(db: Session, v: VisitaQR, accion: str):
    """Evento en el feed en vivo de la Central del conserje."""
    try:
        from app.routers.sistema import _publish_evento
        ctx = contexto(db, v)
        unidad = f" · {ctx['torre'] or ''} {ctx['unidad'] or ''}".strip(" ·") if ctx["unidad"] else ""
        _publish_evento(ctx["tenant_id"], {
            "tipo": "visita_qr", "accion": accion, "nombre": v.nombre_visitante,
            "persona_nombre": v.nombre_visitante, "puerta": "Portería", "estado": "permitido",
            "detalle": f"Invitación QR{unidad}", "timestamp": datetime.utcnow().isoformat(),
        })
    except Exception:
        pass
