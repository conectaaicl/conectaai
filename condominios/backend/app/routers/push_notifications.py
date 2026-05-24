"""
Web Push Notifications VAPID
POST   /api/push/subscribe          → guardar suscripcion push
DELETE /api/push/subscribe          → eliminar suscripcion
POST   /api/push/send/{persona_id}  → enviar push a residente específico
POST   /api/push/broadcast          → enviar push a todos los residentes del tenant
GET    /api/push/vapid-public-key   → retorna VAPID public key para el frontend
GET    /api/push/stats              → total suscripciones
POST   /api/push/test               → enviar push de prueba al admin
"""
import os
import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional
from pydantic import BaseModel
from app.core.database import get_db
from app.routers.auth import get_current_user

router = APIRouter(prefix="/api/push", tags=["Push Notifications"])

VAPID_PUBLIC = os.getenv("VAPID_PUBLIC_KEY", "")
VAPID_PRIVATE = os.getenv("VAPID_PRIVATE_KEY", "")
VAPID_EMAIL = os.getenv("VAPID_EMAIL", "mailto:admin@conectaai.cl")


def _ensure_table(db: Session):
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS push_subscriptions (
            id SERIAL PRIMARY KEY,
            tenant_id INTEGER NOT NULL,
            persona_id INTEGER,
            endpoint TEXT NOT NULL UNIQUE,
            p256dh TEXT NOT NULL,
            auth TEXT NOT NULL,
            user_agent TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            last_used TIMESTAMPTZ
        )
    """))
    db.commit()


class PushSubscribeRequest(BaseModel):
    tenant_id: int
    persona_id: Optional[int] = None
    endpoint: str
    p256dh: str
    auth: str
    user_agent: Optional[str] = None


class PushSendRequest(BaseModel):
    tenant_id: int
    titulo: str
    mensaje: str
    url: Optional[str] = None
    icono: Optional[str] = "/favicon.svg"


def _send_push(endpoint: str, p256dh: str, auth_key: str, payload: dict) -> bool:
    """Send Web Push with pywebpush 2.x"""
    if not VAPID_PRIVATE or not VAPID_PUBLIC:
        return False
    try:
        from pywebpush import webpush, WebPushException
        webpush(
            subscription_info={
                "endpoint": endpoint,
                "keys": {"p256dh": p256dh, "auth": auth_key}
            },
            data=json.dumps(payload, ensure_ascii=False),
            vapid_private_key=VAPID_PRIVATE,
            vapid_claims={"sub": VAPID_EMAIL}
        )
        return True
    except Exception as e:
        err = str(e)[:200]
        if "410" in err or "404" in err:
            return False   # subscription gone
        print(f"Push error: {err}")
        return False


@router.get("/vapid-public-key")
def get_vapid_public_key():
    if not VAPID_PUBLIC:
        raise HTTPException(503, "Push notifications no configuradas (sin VAPID_PUBLIC_KEY)")
    return {"public_key": VAPID_PUBLIC}


@router.post("/subscribe", status_code=201)
def subscribe(body: PushSubscribeRequest, db: Session = Depends(get_db)):
    _ensure_table(db)
    db.execute(text(
        "INSERT INTO push_subscriptions (tenant_id, persona_id, endpoint, p256dh, auth, user_agent) "
        "VALUES (:tid, :pid, :ep, :p256, :auth, :ua) "
        "ON CONFLICT (endpoint) DO UPDATE SET "
        "persona_id=:pid, p256dh=:p256, auth=:auth, last_used=NOW()"
    ), {
        "tid": body.tenant_id, "pid": body.persona_id,
        "ep": body.endpoint, "p256": body.p256dh, "auth": body.auth,
        "ua": body.user_agent
    })
    db.commit()
    return {"ok": True, "message": "Suscripción registrada"}


@router.delete("/subscribe")
def unsubscribe(endpoint: str, db: Session = Depends(get_db)):
    db.execute(text("DELETE FROM push_subscriptions WHERE endpoint=:ep"), {"ep": endpoint})
    db.commit()
    return {"ok": True}


@router.get("/stats")
def stats(tenant_id: int = 1, db: Session = Depends(get_db)):
    _ensure_table(db)
    total = db.execute(
        text("SELECT COUNT(*) FROM push_subscriptions WHERE tenant_id=:tid"), {"tid": tenant_id}
    ).fetchone()[0]
    activos = db.execute(
        text("SELECT COUNT(*) FROM push_subscriptions WHERE tenant_id=:tid AND last_used > NOW()-INTERVAL '30 days'"),
        {"tid": tenant_id}
    ).fetchone()[0]
    configurado = bool(VAPID_PUBLIC and VAPID_PRIVATE)
    return {"total": int(total), "activos_30d": int(activos), "configurado": configurado,
            "vapid_public": VAPID_PUBLIC[:20] + "..." if VAPID_PUBLIC else None}


@router.post("/send/{persona_id}")
def send_to_persona(
    persona_id: int,
    body: PushSendRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    if current_user.get("rol") not in ("admin", "administrador", "superadmin", "conserje"):
        raise HTTPException(403, "Sin permisos")
    _ensure_table(db)
    subs = db.execute(text(
        "SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE persona_id=:pid AND tenant_id=:tid"
    ), {"pid": persona_id, "tid": body.tenant_id}).fetchall()

    if not subs:
        return {"enviados": 0, "total": 0, "mensaje": "Sin dispositivos registrados"}

    payload = {"titulo": body.titulo, "mensaje": body.mensaje,
               "url": body.url or "/portal/avisos", "icono": body.icono}
    sent, dead = 0, []
    for sub in subs:
        m = sub._mapping
        if _send_push(m["endpoint"], m["p256dh"], m["auth"], payload):
            sent += 1
            db.execute(text("UPDATE push_subscriptions SET last_used=NOW() WHERE endpoint=:ep"), {"ep": m["endpoint"]})
        else:
            dead.append(m["endpoint"])
    for ep in dead:
        try:
            db.execute(text("DELETE FROM push_subscriptions WHERE endpoint=:ep"), {"ep": ep})
        except Exception:
            pass
    db.commit()
    return {"enviados": sent, "total": len(subs), "fallidos": len(dead)}


@router.post("/broadcast")
def broadcast(
    body: PushSendRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    if current_user.get("rol") not in ("admin", "administrador", "superadmin"):
        raise HTTPException(403, "Solo administradores pueden enviar broadcast")
    _ensure_table(db)
    subs = db.execute(text(
        "SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE tenant_id=:tid"
    ), {"tid": body.tenant_id}).fetchall()

    if not subs:
        return {"enviados": 0, "total": 0, "mensaje": "Sin dispositivos registrados"}

    payload = {"titulo": body.titulo, "mensaje": body.mensaje,
               "url": body.url or "/portal/avisos", "icono": body.icono}
    sent, dead = 0, []
    for sub in subs:
        m = sub._mapping
        if _send_push(m["endpoint"], m["p256dh"], m["auth"], payload):
            sent += 1
        else:
            dead.append(m["endpoint"])
    for ep in dead:
        try:
            db.execute(text("DELETE FROM push_subscriptions WHERE endpoint=:ep"), {"ep": ep})
        except Exception:
            pass
    db.commit()
    return {"enviados": sent, "total": len(subs), "fallidos": len(dead)}


@router.post("/test")
def test_push(
    body: PushSendRequest,
    endpoint: str,
    p256dh: str,
    auth: str,
    current_user: dict = Depends(get_current_user)
):
    """Test push to a specific subscription (for debugging)"""
    if current_user.get("rol") not in ("admin", "superadmin"):
        raise HTTPException(403, "Sin permisos")
    payload = {"titulo": body.titulo, "mensaje": body.mensaje, "url": body.url or "/"}
    ok = _send_push(endpoint, p256dh, auth, payload)
    return {"ok": ok}
