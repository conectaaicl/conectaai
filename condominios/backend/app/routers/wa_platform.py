"""
WhatsApp Meta Cloud API — Platform-level router.
The platform is a Meta Tech Provider with ONE System User Token.
Multiple tenants each have their own wa_phone_number_id stored in the tenants table.

Prefix:  /api/wa
Tags:    ["whatsapp"]
"""

import os
import hmac
import hashlib
import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Query
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
import httpx
import jwt as _jwt

from app.core.database import get_db

router = APIRouter(prefix="/api/wa", tags=["whatsapp"])

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

META_SYSTEM_TOKEN: str = os.getenv("META_SYSTEM_TOKEN", "")
META_VERIFY_TOKEN: str = os.getenv("META_VERIFY_TOKEN", "conectaai_wa_2026")
APP_URL: str = os.getenv("APP_URL", "https://condominios.conectaai.cl")
SECRET_KEY: str = os.getenv("SECRET_KEY", "")
ALGORITHM = "HS256"

# ---------------------------------------------------------------------------
# Auth helper
# ---------------------------------------------------------------------------

def _get_session(request: Request) -> dict:
    """Decode the 'session' cookie and return its JWT payload."""
    token = request.cookies.get("session")
    if not token:
        raise HTTPException(status_code=401, detail="No autenticado")
    try:
        payload = _jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except Exception:
        raise HTTPException(status_code=401, detail="Sesion invalida")


def _require_admin(payload: dict) -> dict:
    """Raise 403 if the session role is neither admin nor superadmin."""
    role = payload.get("role", "")
    if role not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Acceso denegado — solo administradores")
    return payload


# ---------------------------------------------------------------------------
# Core WhatsApp send helper
# ---------------------------------------------------------------------------

def _send_wa_text(phone_number_id: str, to: str, text_body: str) -> tuple:
    """
    Send a plain-text WhatsApp message via the Meta Cloud API.

    Returns (True, message_id) on success or (False, error_detail) on failure.
    """
    if not META_SYSTEM_TOKEN:
        return (False, "META_SYSTEM_TOKEN no configurado")

    url = "https://graph.facebook.com/v20.0/{}/messages".format(phone_number_id)
    headers = {
        "Authorization": "Bearer " + META_SYSTEM_TOKEN,
        "Content-Type": "application/json",
    }
    body = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": to,
        "type": "text",
        "text": {
            "preview_url": False,
            "body": text_body,
        },
    }

    try:
        resp = httpx.post(url, json=body, headers=headers, timeout=10.0)
        data = resp.json()
        if resp.status_code == 200:
            # Successful response: {"messages": [{"id": "wamid.xxx"}]}
            messages = data.get("messages", [])
            message_id = messages[0].get("id", "") if messages else ""
            return (True, message_id)
        else:
            error = data.get("error", {})
            detail = error.get("message", str(data))
            return (False, detail)
    except Exception as exc:
        return (False, str(exc))


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class SendBody(BaseModel):
    phone_number_id: str
    to: str
    message: str


class NotificarResidenteBody(BaseModel):
    mensaje: str


class WaConfigPatch(BaseModel):
    wa_phone_number_id: Optional[str] = None
    wa_activo: Optional[bool] = None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/webhook", response_class=PlainTextResponse)
def webhook_verify(
    hub_mode: Optional[str] = Query(None, alias="hub.mode"),
    hub_verify_token: Optional[str] = Query(None, alias="hub.verify_token"),
    hub_challenge: Optional[str] = Query(None, alias="hub.challenge"),
):
    """
    Meta webhook verification challenge.
    Meta sends GET with hub.mode=subscribe, hub.verify_token, hub.challenge.
    We must return hub.challenge as plain text if the token matches.
    """
    if hub_mode == "subscribe" and hub_verify_token == META_VERIFY_TOKEN:
        return PlainTextResponse(content=hub_challenge or "")
    raise HTTPException(status_code=403, detail="Verify token mismatch")


@router.post("/webhook")
async def webhook_receive(request: Request, db: Session = Depends(get_db)):
    """
    Receive incoming WhatsApp messages from Meta.
    Logs each message to the wa_incoming_messages table (best effort).
    Always returns HTTP 200 so Meta does not retry.
    """
    try:
        body = await request.json()
    except Exception:
        # If body cannot be parsed, still return 200
        return {"status": "ok"}

    try:
        entries = body.get("entry", [])
        for entry in entries:
            changes = entry.get("changes", [])
            for change in changes:
                value = change.get("value", {})
                phone_number_id = value.get("metadata", {}).get("phone_number_id", "")
                messages = value.get("messages", [])
                contacts = value.get("contacts", [])

                # Build a contact name lookup
                contact_map: dict = {}
                for contact in contacts:
                    wa_id = contact.get("wa_id", "")
                    name = contact.get("profile", {}).get("name", "")
                    if wa_id:
                        contact_map[wa_id] = name

                for msg in messages:
                    try:
                        from_number = msg.get("from", "")
                        msg_id = msg.get("id", "")
                        msg_type = msg.get("type", "text")
                        timestamp = msg.get("timestamp", "")
                        sender_name = contact_map.get(from_number, "")

                        # Extract text body when available
                        text_content = ""
                        if msg_type == "text":
                            text_content = msg.get("text", {}).get("body", "")
                        elif msg_type == "image":
                            text_content = "[imagen]"
                        elif msg_type == "audio":
                            text_content = "[audio]"
                        elif msg_type == "document":
                            text_content = "[documento]"
                        elif msg_type == "location":
                            loc = msg.get("location", {})
                            text_content = "[ubicacion: {}, {}]".format(
                                loc.get("latitude", ""), loc.get("longitude", "")
                            )
                        else:
                            text_content = "[{}]".format(msg_type)

                        # Ensure log table exists and insert
                        db.execute(text("""
                            CREATE TABLE IF NOT EXISTS wa_incoming_messages (
                                id SERIAL PRIMARY KEY,
                                phone_number_id VARCHAR(50),
                                from_number VARCHAR(30),
                                sender_name VARCHAR(200),
                                message_id VARCHAR(200),
                                message_type VARCHAR(30),
                                content TEXT,
                                raw_ts VARCHAR(20),
                                received_at TIMESTAMPTZ DEFAULT NOW()
                            )
                        """))
                        db.execute(text("""
                            INSERT INTO wa_incoming_messages
                              (phone_number_id, from_number, sender_name,
                               message_id, message_type, content, raw_ts)
                            VALUES
                              (:pnid, :from_n, :sname,
                               :mid, :mtype, :content, :ts)
                        """), {
                            "pnid": phone_number_id,
                            "from_n": from_number,
                            "sname": sender_name,
                            "mid": msg_id,
                            "mtype": msg_type,
                            "content": text_content,
                            "ts": timestamp,
                        })
                        db.commit()
                    except Exception:
                        try:
                            db.rollback()
                        except Exception:
                            pass
    except Exception:
        pass

    return {"status": "ok"}


@router.post("/send")
def send_message(request: Request, body: SendBody, db: Session = Depends(get_db)):
    """
    Internal endpoint: send a WhatsApp text message on behalf of a tenant.
    Requires session cookie auth (any role except residente).
    """
    payload = _get_session(request)
    role = payload.get("role", "")
    if role == "residente":
        raise HTTPException(status_code=403, detail="Acceso denegado")

    ok, result = _send_wa_text(body.phone_number_id, body.to, body.message)
    if ok:
        return {"ok": True, "message_id": result}
    else:
        return {"ok": False, "error": result}


@router.post("/notificar-residente/{residente_id}")
def notificar_residente(
    residente_id: int,
    body: NotificarResidenteBody,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Send a WhatsApp message to a specific resident.
    Looks up the resident's phone from residentes_portal and the tenant's
    wa_phone_number_id from the tenant config (via departamento → condominio → tenant).
    Requires session cookie.
    """
    _get_session(request)

    # Look up resident phone and wa_phone_number_id
    row = db.execute(text("""
        SELECT
            rp.telefono,
            rp.nombre_completo,
            t.wa_phone_number_id,
            t.wa_activo
        FROM residentes_portal rp
        JOIN departamentos d ON d.id = rp.departamento_id
        JOIN condominios c ON c.id = d.condominio_id
        JOIN tenants t ON t.id = c.tenant_id
        WHERE rp.id = :rid
        LIMIT 1
    """), {"rid": residente_id}).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Residente no encontrado")

    rm = dict(row._mapping)
    telefono: str = rm.get("telefono") or ""
    wa_phone_number_id: str = rm.get("wa_phone_number_id") or ""
    wa_activo: bool = bool(rm.get("wa_activo", False))

    if not telefono:
        raise HTTPException(status_code=422, detail="El residente no tiene telefono registrado")
    if not wa_phone_number_id:
        raise HTTPException(status_code=422, detail="El condominio no tiene Phone Number ID de WhatsApp configurado")
    if not wa_activo:
        raise HTTPException(status_code=422, detail="WhatsApp no esta activado para este condominio")

    ok, result = _send_wa_text(wa_phone_number_id, telefono, body.mensaje)
    if ok:
        return {"ok": True, "message_id": result}
    else:
        return {"ok": False, "error": result}


@router.get("/config")
def get_wa_config(request: Request, db: Session = Depends(get_db)):
    """
    Get the current tenant's WhatsApp configuration.
    Returns wa_phone_number_id and wa_activo from the tenants table.
    Requires session.
    """
    payload = _get_session(request)
    tenant_id = int(payload.get("tenant_id", 0))
    if not tenant_id:
        raise HTTPException(status_code=400, detail="tenant_id no encontrado en sesion")

    row = db.execute(text("""
        SELECT wa_phone_number_id, wa_activo
        FROM tenants
        WHERE id = :tid
        LIMIT 1
    """), {"tid": tenant_id}).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Tenant no encontrado")

    rm = dict(row._mapping)
    return {
        "wa_phone_number_id": rm.get("wa_phone_number_id"),
        "wa_activo": bool(rm.get("wa_activo", False)),
    }


@router.patch("/config")
def update_wa_config(
    body: WaConfigPatch,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Update the current tenant's WhatsApp configuration.
    Only admin and superadmin roles may call this endpoint.
    """
    payload = _get_session(request)
    _require_admin(payload)
    tenant_id = int(payload.get("tenant_id", 0))
    if not tenant_id:
        raise HTTPException(status_code=400, detail="tenant_id no encontrado en sesion")

    updates = []
    params: dict = {"tid": tenant_id}

    if body.wa_phone_number_id is not None:
        updates.append("wa_phone_number_id = :wa_phone_number_id")
        params["wa_phone_number_id"] = body.wa_phone_number_id
    if body.wa_activo is not None:
        updates.append("wa_activo = :wa_activo")
        params["wa_activo"] = body.wa_activo

    if not updates:
        raise HTTPException(status_code=400, detail="Nada que actualizar")

    db.execute(text(
        "UPDATE tenants SET " + ", ".join(updates) + " WHERE id = :tid"
    ), params)
    db.commit()
    return {"ok": True}


@router.post("/config/test")
def test_wa_config(request: Request, db: Session = Depends(get_db)):
    """
    Send a test WhatsApp message to the tenant's own phone number.
    Validates that the Meta Cloud API integration is working correctly.
    Requires session.
    """
    payload = _get_session(request)
    tenant_id = int(payload.get("tenant_id", 0))
    if not tenant_id:
        raise HTTPException(status_code=400, detail="tenant_id no encontrado en sesion")

    row = db.execute(text("""
        SELECT wa_phone_number_id, wa_activo, telefono
        FROM tenants
        WHERE id = :tid
        LIMIT 1
    """), {"tid": tenant_id}).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Tenant no encontrado")

    rm = dict(row._mapping)
    wa_phone_number_id: str = rm.get("wa_phone_number_id") or ""
    wa_activo: bool = bool(rm.get("wa_activo", False))
    telefono: str = rm.get("telefono") or ""

    if not wa_phone_number_id:
        return {"ok": False, "detail": "Phone Number ID de WhatsApp no configurado"}
    if not wa_activo:
        return {"ok": False, "detail": "WhatsApp no esta activado para este condominio"}
    if not telefono:
        return {"ok": False, "detail": "Telefono del condominio no registrado"}

    test_msg = (
        "ConectaAI - Prueba de WhatsApp exitosa. "
        "Su integracion funciona correctamente."
    )
    ok, result = _send_wa_text(wa_phone_number_id, telefono, test_msg)
    if ok:
        return {"ok": True, "detail": "Mensaje de prueba enviado correctamente", "message_id": result}
    else:
        return {"ok": False, "detail": result}
