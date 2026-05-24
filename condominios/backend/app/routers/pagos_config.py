"""
Configuracion de pagos (Flow + MercadoPago) por tenant.
Guarda las API keys encriptadas con Fernet.
"""
import os
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
from typing import Optional
from cryptography.fernet import Fernet, InvalidToken
from app.core.database import get_db
import jwt as _jwt

router = APIRouter(prefix="/api/pagos/config", tags=["pagos_config"])

SECRET_KEY = os.getenv("SECRET_KEY", "")
FERNET_KEY = os.getenv("FERNET_KEY", "")
ALGORITHM = "HS256"


def _fernet():
    if not FERNET_KEY:
        raise HTTPException(422, "FERNET_KEY no configurado")
    return Fernet(FERNET_KEY.encode())


def _enc(val: str) -> str:
    return _fernet().encrypt(val.encode()).decode()


def _dec(enc: str) -> str:
    try:
        return _fernet().decrypt(enc.encode()).decode()
    except (InvalidToken, Exception):
        return ""


def _get_session(request: Request) -> dict:
    token = request.cookies.get("session")
    if not token:
        raise HTTPException(401, "No autenticado")
    try:
        return _jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except Exception:
        raise HTTPException(401, "Token invalido")


def _require_admin(request: Request) -> dict:
    payload = _get_session(request)
    if payload.get("rol") not in ("admin", "superadmin"):
        raise HTTPException(403, "Solo administradores")
    return payload


class PaymentConfigIn(BaseModel):
    # Flow
    flow_activo: Optional[bool] = None
    flow_api_key: Optional[str] = None
    flow_secret: Optional[str] = None
    # MP
    mp_activo: Optional[bool] = None
    mp_access_token: Optional[str] = None
    mp_public_key: Optional[str] = None


@router.get("")
def get_payment_config(tenant_id: int, request: Request, db: Session = Depends(get_db)):
    """Obtener config de pagos (sin devolver los secrets en claro)"""
    _require_admin(request)
    row = db.execute(text("""
        SELECT id, flow_activo, mp_activo,
               CASE WHEN flow_api_key_enc IS NOT NULL AND flow_api_key_enc != '' THEN true ELSE false END as flow_configured,
               CASE WHEN mp_access_token_enc IS NOT NULL AND mp_access_token_enc != '' THEN true ELSE false END as mp_configured,
               mp_public_key_enc
        FROM tenants WHERE id = :tid
    """), {"tid": tenant_id}).fetchone()

    if not row:
        raise HTTPException(404, "Tenant no encontrado")

    mp_pub = ""
    if row.mp_public_key_enc:
        mp_pub = _dec(row.mp_public_key_enc)

    return {
        "tenant_id": tenant_id,
        "flow_activo": row.flow_activo or False,
        "flow_configured": row.flow_configured,
        "mp_activo": row.mp_activo or False,
        "mp_configured": row.mp_configured,
        "mp_public_key": mp_pub,
    }


@router.patch("")
def update_payment_config(
    tenant_id: int,
    body: PaymentConfigIn,
    request: Request,
    db: Session = Depends(get_db)
):
    """Actualizar config de pagos por tenant"""
    _require_admin(request)

    sets = []
    params = {"tid": tenant_id}

    if body.flow_activo is not None:
        sets.append("flow_activo = :flow_activo")
        params["flow_activo"] = body.flow_activo

    if body.flow_api_key and body.flow_api_key.strip():
        sets.append("flow_api_key_enc = :flow_api_key_enc")
        params["flow_api_key_enc"] = _enc(body.flow_api_key.strip())

    if body.flow_secret and body.flow_secret.strip():
        sets.append("flow_secret_enc = :flow_secret_enc")
        params["flow_secret_enc"] = _enc(body.flow_secret.strip())

    if body.mp_activo is not None:
        sets.append("mp_activo = :mp_activo")
        params["mp_activo"] = body.mp_activo

    if body.mp_access_token and body.mp_access_token.strip():
        sets.append("mp_access_token_enc = :mp_access_token_enc")
        params["mp_access_token_enc"] = _enc(body.mp_access_token.strip())

    if body.mp_public_key and body.mp_public_key.strip():
        sets.append("mp_public_key_enc = :mp_public_key_enc")
        params["mp_public_key_enc"] = _enc(body.mp_public_key.strip())

    if not sets:
        return {"ok": True, "message": "Nada que actualizar"}

    sets.append("updated_at = NOW()")
    db.execute(text(f"UPDATE tenants SET {', '.join(sets)} WHERE id = :tid"), params)
    db.commit()

    return {"ok": True, "message": "Configuracion de pagos actualizada"}
