"""
WhatsApp Business Cloud API (Meta oficial) -- reemplaza las 3 implementaciones
anteriores (whatsapp_bot.py muerto, whatsapp360.py CRM sin envio real,
wa_platform.py via Evolution API no oficial), todas eliminadas.

Queda construido y desplegado pero INACTIVO hasta que Meta apruebe los
permisos de la cuenta de WhatsApp Business: sin META_APP_ID/META_APP_SECRET
en el entorno y sin credenciales por tenant, enviar_whatsapp_meta() lanza un
error explicito en vez de fallar en silencio o simular un envio.

Cada tenant puede conectar su propia cuenta de WhatsApp Business (su propio
Business Account ID + Phone Number ID + token) -- ConectaAI actua como
plataforma que administra esas conexiones, no como un unico numero
compartido. El token de cada tenant se guarda cifrado con Fernet (mismo
patron que Flow/Mercado Pago en notif_config.py).

La configuracion de credenciales (waba_id/phone_number_id/token, activar o
desactivar) vive en notif_config.py junto a Flow y Mercado Pago -- mismo
panel de administracion, mismo patron de credenciales cifradas.

GET  /api/webhooks/whatsapp-meta            -> Meta: verificacion del webhook (hub.challenge)
POST /api/webhooks/whatsapp-meta            -> Meta: mensajes/estados entrantes
"""
import os

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.routers.notif_config import _fernet

router = APIRouter(tags=["whatsapp_meta"])

META_APP_ID = os.getenv("META_APP_ID", "")
META_APP_SECRET = os.getenv("META_APP_SECRET", "")
META_VERIFY_TOKEN = os.getenv("META_VERIFY_TOKEN", "")
META_GRAPH_VERSION = "v20.0"


def _decrypt(enc: str) -> str:
    return _fernet().decrypt(enc.encode()).decode()


class ConfigError(Exception):
    def __init__(self, mensaje: str):
        self.mensaje = mensaje


def _get_tenant_wa_config(db: Session, tenant_id: int) -> dict:
    row = db.execute(text(
        "SELECT meta_waba_id, meta_phone_number_id, meta_access_token_enc, meta_activo "
        "FROM tenants WHERE id=:tid"
    ), {"tid": tenant_id}).fetchone()
    if not row:
        raise ConfigError("Tenant no encontrado")
    return dict(row._mapping)


async def enviar_whatsapp_meta(db: Session, tenant_id: int, telefono: str, mensaje: str) -> dict:
    """
    Envia un mensaje de texto real via WhatsApp Cloud API. Pensado para ser
    llamado desde otros modulos (avisos, recordatorios, futuro Centro de
    Comunicacion) una vez Meta apruebe la cuenta -- hoy lanza ConfigError
    con un mensaje claro en vez de fallar silenciosamente o simular envio.
    """
    if not META_APP_ID or not META_APP_SECRET:
        raise ConfigError("WhatsApp Business (Meta) aun no esta aprobado a nivel de app -- falta META_APP_ID/META_APP_SECRET")

    cfg = _get_tenant_wa_config(db, tenant_id)
    if not cfg["meta_activo"]:
        raise ConfigError("WhatsApp Business no esta activado para este condominio")
    if not cfg["meta_phone_number_id"] or not cfg["meta_access_token_enc"]:
        raise ConfigError("Faltan credenciales de WhatsApp Business para este condominio")

    token = _decrypt(cfg["meta_access_token_enc"])
    url = f"https://graph.facebook.com/{META_GRAPH_VERSION}/{cfg['meta_phone_number_id']}/messages"
    payload = {
        "messaging_product": "whatsapp",
        "to": telefono,
        "type": "text",
        "text": {"body": mensaje},
    }

    estado, meta_message_id, error = "enviado", None, None
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(url, json=payload, headers={"Authorization": f"Bearer {token}"})
            data = r.json()
            if r.status_code >= 400:
                estado, error = "error", data.get("error", {}).get("message", "Error desconocido de Meta")
            else:
                meta_message_id = data.get("messages", [{}])[0].get("id")
    except Exception as e:
        estado, error = "error", str(e)

    db.execute(text(
        "INSERT INTO whatsapp_mensajes_meta (tenant_id, direccion, telefono, tipo, contenido, meta_message_id, estado, error) "
        "VALUES (:tid, 'saliente', :tel, 'text', :msg, :mid, :est, :err)"
    ), {"tid": tenant_id, "tel": telefono, "msg": mensaje, "mid": meta_message_id, "est": estado, "err": error})
    db.commit()

    if estado == "error":
        raise ConfigError(f"Error enviando WhatsApp: {error}")
    return {"ok": True, "meta_message_id": meta_message_id}


# ── Webhook de Meta ──────────────────────────────────────────────────────

@router.get("/api/webhooks/whatsapp-meta")
def verificar_webhook(request: Request):
    """Handshake de verificacion que exige Meta al registrar la URL del webhook."""
    params = request.query_params
    if params.get("hub.mode") == "subscribe" and params.get("hub.verify_token") == META_VERIFY_TOKEN:
        return Response(content=params.get("hub.challenge", ""), media_type="text/plain")
    raise HTTPException(403, "Token de verificacion invalido")


@router.post("/api/webhooks/whatsapp-meta")
async def recibir_webhook(request: Request, db: Session = Depends(get_db)):
    """
    Mensajes/estados entrantes de Meta. El phone_number_id que viene en el
    payload identifica a que tenant pertenece (cada tenant tiene el suyo).
    Hoy solo registra en whatsapp_mensajes_meta -- la logica de respuesta
    automatica/bandeja unificada queda para el Centro de Comunicacion.
    """
    body = await request.json()
    try:
        for entry in body.get("entry", []):
            for change in entry.get("changes", []):
                value = change.get("value", {})
                phone_number_id = value.get("metadata", {}).get("phone_number_id")
                if not phone_number_id:
                    continue
                tenant_row = db.execute(text(
                    "SELECT id FROM tenants WHERE meta_phone_number_id = :pid"
                ), {"pid": phone_number_id}).fetchone()
                if not tenant_row:
                    continue
                tenant_id = tenant_row[0]

                for msg in value.get("messages", []):
                    contenido = msg.get("text", {}).get("body") if msg.get("type") == "text" else f"[{msg.get('type')}]"
                    db.execute(text(
                        "INSERT INTO whatsapp_mensajes_meta (tenant_id, direccion, telefono, tipo, contenido, meta_message_id, estado) "
                        "VALUES (:tid, 'entrante', :tel, :tipo, :contenido, :mid, 'recibido')"
                    ), {"tid": tenant_id, "tel": msg.get("from"), "tipo": msg.get("type", "text"),
                        "contenido": contenido, "mid": msg.get("id")})

                for status in value.get("statuses", []):
                    db.execute(text(
                        "UPDATE whatsapp_mensajes_meta SET estado = :est WHERE meta_message_id = :mid"
                    ), {"est": status.get("status"), "mid": status.get("id")})
        db.commit()
    except Exception:
        db.rollback()
    return {"status": "ok"}
