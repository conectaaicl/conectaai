import os
import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.database import get_db
import jwt

router = APIRouter(prefix="/api/mail", tags=["mail"])

MAIL_API_URL = os.getenv("MAIL_API_URL", "http://localhost:3004/api/send")
MAIL_API_URL_PUBLIC = os.getenv("MAIL_API_URL_PUBLIC", "https://mail.conectaai.cl")
MAIL_API_KEY = os.getenv("MAIL_API_KEY", "")
MAIL_FROM = os.getenv("MAIL_FROM", "no-reply@conectaai.cl")
SECRET_KEY = os.getenv("SECRET_KEY", "")
ALGORITHM = "HS256"


def _get_current_user(request: Request):
    token = request.cookies.get("session")
    if not token:
        raise HTTPException(401, "No autenticado")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except Exception:
        raise HTTPException(401, "Sesion invalida")


@router.get("/status")
async def mail_status():
    """Check connectivity to mail.conectaai.cl and return provider status."""
    provider_name = "mail.conectaai.cl"
    from_email = MAIL_FROM

    try:
        # Hit the send endpoint with a dummy preflight to test auth
        resp = httpx.post(
            MAIL_API_URL,
            json={"to": "__test__@invalid.x", "subject": "ping", "html": "ping", "text": "ping"},
            headers={"Authorization": "Bearer " + MAIL_API_KEY},
            timeout=5,
        )
        # Accept any response (even 4xx) — just reachability + auth matters
        connected = resp.status_code < 500
        last_code = resp.status_code
    except Exception as e:
        connected = False
        last_code = 0

    return {
        "connected": connected,
        "provider": provider_name,
        "from_email": from_email,
        "api_url_public": MAIL_API_URL_PUBLIC,
        "status_code": last_code,
    }


@router.post("/test")
async def mail_test(request: Request):
    """Send a real test email to the authenticated admin user."""
    user = _get_current_user(request)
    email = user.get("email", "")
    nombre = user.get("nombre_completo", user.get("sub", "Admin"))

    if not email or "@" not in email:
        raise HTTPException(400, "Usuario sin email valido")

    html = (
        '<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;">'
        '<div style="background:#5b3ef5;padding:20px;border-radius:8px 8px 0 0;">'
        '<h1 style="color:white;margin:0;font-size:20px;">ConectaAI Condominios</h1>'
        '</div>'
        '<div style="background:#fff;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">'
        '<h2 style="color:#1e1b4b;margin-top:0;">Prueba de correo exitosa</h2>'
        '<p>Hola <strong>' + nombre + '</strong>,</p>'
        '<p>El proveedor de correo <strong>mail.conectaai.cl</strong> esta correctamente configurado '
        'y puede enviar notificaciones a los residentes de su condominio.</p>'
        '<p style="margin-top:24px;color:#6b7280;font-size:12px;">ConectaAI — Sistema de Gestion de Condominios</p>'
        '</div></div>'
    )

    try:
        resp = httpx.post(
            MAIL_API_URL,
            json={"to": email, "subject": "Prueba de correo — ConectaAI Condominios", "html": html, "text": "Prueba de correo exitosa."},
            headers={"Authorization": "Bearer " + MAIL_API_KEY},
            timeout=10,
        )
        if resp.status_code < 300:
            return {"ok": True, "message": "Correo de prueba enviado a " + email}
        else:
            return {"ok": False, "message": "Error del servidor de correo: " + str(resp.status_code)}
    except Exception as e:
        return {"ok": False, "message": "No se pudo conectar: " + str(e)}
