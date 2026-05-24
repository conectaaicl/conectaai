"""
/api/admin/integraciones — Integration config per tenant.
Handles WA, Flow, MP toggles + encrypted credential storage.
"""
import os
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
import jwt as _jwt
from cryptography.fernet import Fernet, InvalidToken
from app.core.database import get_db

router = APIRouter(prefix="/api/admin/integraciones", tags=["integraciones"])

SECRET_KEY = os.getenv("SECRET_KEY", "")
FERNET_KEY = os.getenv("FERNET_KEY", "")
META_SYSTEM_TOKEN = os.getenv("META_SYSTEM_TOKEN", "")
MAIL_API_KEY = os.getenv("MAIL_API_KEY", "")
ALGORITHM = "HS256"


def _fernet() -> Fernet:
    if not FERNET_KEY:
        raise HTTPException(422, "FERNET_KEY no configurado")
    return Fernet(FERNET_KEY.encode())


def encrypt_val(val: str) -> str:
    return _fernet().encrypt(val.encode()).decode()


def _mask(enc: Optional[str]) -> bool:
    return bool(enc)


def _get_session(request: Request) -> dict:
    token = request.cookies.get("session")
    if not token:
        raise HTTPException(401, "No autenticado")
    try:
        return _jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except Exception:
        raise HTTPException(401, "Sesion invalida")


def _require_admin(request: Request) -> dict:
    payload = _get_session(request)
    if payload.get("rol") not in ("admin", "superadmin"):
        raise HTTPException(403, "Solo administradores")
    return payload


def _get_tenant(db: Session, tenant_id: int) -> dict:
    row = db.execute(text(
        "SELECT id, wa_phone_number_id, wa_activo, flow_activo, mp_activo, "
        "flow_api_key_enc, flow_secret_enc, mp_access_token_enc, mp_public_key_enc "
        "FROM tenants WHERE id=:tid"
    ), {"tid": tenant_id}).fetchone()
    if not row:
        raise HTTPException(404, "Tenant no encontrado")
    return dict(row._mapping)


@router.get("/")
def get_config(request: Request, db: Session = Depends(get_db)):
    payload = _get_session(request)
    tid = payload.get("tenant_id") or 1
    t = _get_tenant(db, tid)
    return {
        "wa": {
            "activo": bool(t["wa_activo"]),
            "phone_number_id": t["wa_phone_number_id"],
            "token_configured": bool(META_SYSTEM_TOKEN),
        },
        "flow": {
            "activo": bool(t["flow_activo"]),
            "credentials_configured": _mask(t["flow_api_key_enc"]),
        },
        "mp": {
            "activo": bool(t["mp_activo"]),
            "credentials_configured": _mask(t["mp_access_token_enc"]),
        },
        "mail": {
            "activo": True,
            "provider": "mail.conectaai.cl",
            "key_configured": bool(MAIL_API_KEY),
        },
    }


class ToggleBody(BaseModel):
    wa_activo: Optional[bool] = None
    wa_phone_number_id: Optional[str] = None
    flow_activo: Optional[bool] = None
    mp_activo: Optional[bool] = None


@router.patch("/")
def update_config(body: ToggleBody, request: Request, db: Session = Depends(get_db)):
    payload = _require_admin(request)
    tid = payload.get("tenant_id") or 1
    sets = []
    vals: dict = {"tid": tid}
    if body.wa_activo is not None:
        sets.append("wa_activo=:wa_activo")
        vals["wa_activo"] = body.wa_activo
    if body.wa_phone_number_id is not None:
        sets.append("wa_phone_number_id=:wa_pid")
        vals["wa_pid"] = body.wa_phone_number_id.strip() or None
    if body.flow_activo is not None:
        sets.append("flow_activo=:flow_activo")
        vals["flow_activo"] = body.flow_activo
    if body.mp_activo is not None:
        sets.append("mp_activo=:mp_activo")
        vals["mp_activo"] = body.mp_activo
    if not sets:
        raise HTTPException(422, "Nada que actualizar")
    db.execute(text("UPDATE tenants SET " + ", ".join(sets) + " WHERE id=:tid"), vals)
    db.commit()
    return {"updated": [s.split("=")[0] for s in sets]}


class FlowCredsBody(BaseModel):
    api_key: str
    secret_key: str


@router.post("/credenciales/flow")
def save_flow_creds(body: FlowCredsBody, request: Request, db: Session = Depends(get_db)):
    payload = _require_admin(request)
    tid = payload.get("tenant_id") or 1
    if not body.api_key.strip() or not body.secret_key.strip():
        raise HTTPException(422, "API Key y Secret son requeridos")
    db.execute(text(
        "UPDATE tenants SET flow_api_key_enc=:ak, flow_secret_enc=:sk WHERE id=:tid"
    ), {"ak": encrypt_val(body.api_key.strip()),
        "sk": encrypt_val(body.secret_key.strip()),
        "tid": tid})
    db.commit()
    return {"ok": True, "detail": "Credenciales Flow guardadas correctamente"}


class MpCredsBody(BaseModel):
    access_token: str
    public_key: Optional[str] = None


@router.post("/credenciales/mp")
def save_mp_creds(body: MpCredsBody, request: Request, db: Session = Depends(get_db)):
    payload = _require_admin(request)
    tid = payload.get("tenant_id") or 1
    if not body.access_token.strip():
        raise HTTPException(422, "Access Token es requerido")
    pk_enc = encrypt_val(body.public_key.strip()) if body.public_key and body.public_key.strip() else None
    db.execute(text(
        "UPDATE tenants SET mp_access_token_enc=:at, mp_public_key_enc=:pk WHERE id=:tid"
    ), {"at": encrypt_val(body.access_token.strip()), "pk": pk_enc, "tid": tid})
    db.commit()
    return {"ok": True, "detail": "Credenciales Mercado Pago guardadas correctamente"}


@router.delete("/credenciales/flow")
def delete_flow_creds(request: Request, db: Session = Depends(get_db)):
    payload = _require_admin(request)
    tid = payload.get("tenant_id") or 1
    db.execute(text(
        "UPDATE tenants SET flow_api_key_enc=NULL, flow_secret_enc=NULL, flow_activo=false WHERE id=:tid"
    ), {"tid": tid})
    db.commit()
    return {"ok": True}


@router.delete("/credenciales/mp")
def delete_mp_creds(request: Request, db: Session = Depends(get_db)):
    payload = _require_admin(request)
    tid = payload.get("tenant_id") or 1
    db.execute(text(
        "UPDATE tenants SET mp_access_token_enc=NULL, mp_public_key_enc=NULL, mp_activo=false WHERE id=:tid"
    ), {"tid": tid})
    db.commit()
    return {"ok": True}
