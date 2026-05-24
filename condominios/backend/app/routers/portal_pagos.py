"""
Portal Pagos — residentes pueden pagar sus gastos comunes via Flow o MP.
Auth: Bearer JWT (portal session, no cookie).
"""
import os, hmac, hashlib, time
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
import httpx, jwt as _jwt
from cryptography.fernet import Fernet, InvalidToken
from app.core.database import get_db

router = APIRouter(prefix="/api/portal/pagos", tags=["portal_pagos"])

SECRET_KEY  = os.getenv("SECRET_KEY", "")
FERNET_KEY  = os.getenv("FERNET_KEY", "")
APP_URL     = os.getenv("APP_URL", "https://conectaai.cl")
FLOW_API_URL= os.getenv("FLOW_API_URL", "https://www.flow.cl/api")
MP_API      = "https://api.mercadopago.com"

security = HTTPBearer(auto_error=False)


# ── helpers ───────────────────────────────────────────────────────────

def _get_residente(creds: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    if not creds:
        raise HTTPException(401, "No autenticado")
    try:
        p = _jwt.decode(creds.credentials, SECRET_KEY, algorithms=["HS256"])
        if p.get("role") != "residente":
            raise HTTPException(403, "Acceso denegado")
        return p
    except _jwt.ExpiredSignatureError:
        raise HTTPException(401, "Sesión expirada")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(401, "Token inválido")


def _fernet() -> Fernet:
    if not FERNET_KEY:
        raise HTTPException(422, "FERNET_KEY no configurado")
    return Fernet(FERNET_KEY.encode())


def _decrypt(enc: str) -> str:
    try:
        return _fernet().decrypt(enc.encode()).decode()
    except (InvalidToken, Exception):
        raise HTTPException(422, "Error al descifrar credencial")


def _get_gasto(gasto_id: int, depto_id: int, db: Session) -> dict:
    row = db.execute(text("""
        SELECT gc.id, gc.departamento_id, gc.monto_total, gc.descripcion,
               gc.estado, gc.periodo, gc.anio, gc.mes
        FROM gastos_comunes gc
        WHERE gc.id = :gid AND gc.departamento_id = :did
    """), {"gid": gasto_id, "did": depto_id}).fetchone()
    if not row:
        raise HTTPException(404, "Gasto no encontrado o no pertenece a tu departamento")
    g = dict(row._mapping)
    if g["estado"] == "pagado":
        raise HTTPException(422, "Este gasto ya fue pagado")
    return g


def _tenant_creds(depto_id: int, db: Session) -> dict:
    row = db.execute(text("""
        SELECT t.id AS tenant_id,
               t.flow_activo, t.flow_api_key_enc, t.flow_secret_enc,
               t.mp_activo,   t.mp_access_token_enc, t.mp_public_key_enc
        FROM departamentos d
        JOIN tenants t ON t.id = d.tenant_id
        WHERE d.id = :did LIMIT 1
    """), {"did": depto_id}).fetchone()
    if not row:
        raise HTTPException(404, "Departamento no encontrado")
    return dict(row._mapping)


def _residente_email(residente_id: int, db: Session) -> str:
    row = db.execute(text(
        "SELECT email FROM residentes_portal WHERE id=:rid"
    ), {"rid": residente_id}).fetchone()
    return (dict(row._mapping).get("email") or "") if row else ""


def _sign_flow(params: dict, secret: str) -> str:
    keys = sorted(params.keys())
    msg = "".join(k + str(params[k]) for k in keys)
    return hmac.new(secret.encode(), msg.encode(), hashlib.sha256).hexdigest()


def _order_id(tenant_id: int, gasto_id: int) -> str:
    return "PORTAL-GC-{}-{}-{}".format(tenant_id, gasto_id, int(time.time() * 1000))


def _add_indexes(db: Session):
    stmts = [
        "CREATE INDEX IF NOT EXISTS idx_res_portal_rut ON residentes_portal(rut, tenant_id)",
        "CREATE INDEX IF NOT EXISTS idx_res_portal_depto ON residentes_portal(departamento_id)",
        "CREATE INDEX IF NOT EXISTS idx_gc_depto_estado ON gastos_comunes(departamento_id, estado)",
        "CREATE INDEX IF NOT EXISTS idx_gc_anio_mes ON gastos_comunes(anio, mes, departamento_id)",
    ]
    for s in stmts:
        try:
            db.execute(text(s))
        except Exception:
            pass
    try:
        db.commit()
    except Exception:
        db.rollback()


# ── schemas ──────────────────────────────────────────────────────────

class PagoBody(BaseModel):
    gasto_comun_id: int


# ── endpoints ────────────────────────────────────────────────────────

@router.get("/metodos")
def metodos_disponibles(
    residente: dict = Depends(_get_residente),
    db: Session = Depends(get_db)
):
    """Retorna qué métodos de pago están habilitados para el tenant del residente."""
    _add_indexes(db)
    depto_id = residente.get("depto_id", 0)
    if not depto_id:
        return {"flow": False, "mp": False}
    creds = _tenant_creds(depto_id, db)
    return {
        "flow": bool(creds.get("flow_activo") and creds.get("flow_api_key_enc")),
        "mp":   bool(creds.get("mp_activo")   and creds.get("mp_access_token_enc")),
    }


@router.post("/flow/iniciar")
def iniciar_flow(
    body: PagoBody,
    residente: dict = Depends(_get_residente),
    db: Session = Depends(get_db)
):
    """Inicia pago Flow para un gasto comun del residente autenticado."""
    depto_id     = residente.get("depto_id", 0)
    residente_id = int(residente.get("sub", 0))

    gasto  = _get_gasto(body.gasto_comun_id, depto_id, db)
    creds  = _tenant_creds(depto_id, db)

    if not creds["flow_activo"]:
        raise HTTPException(422, "Flow no está activado para este condominio")
    if not creds["flow_api_key_enc"] or not creds["flow_secret_enc"]:
        raise HTTPException(422, "Credenciales Flow no configuradas — contacte a la administración")

    api_key = _decrypt(creds["flow_api_key_enc"])
    secret  = _decrypt(creds["flow_secret_enc"])
    email   = _residente_email(residente_id, db) or "pagos@conectaai.cl"
    order   = _order_id(creds["tenant_id"], gasto["id"])

    desc = gasto.get("descripcion") or "Gasto Común"
    if gasto.get("periodo"):
        desc = desc + " - " + str(gasto["periodo"])

    params = {
        "commerceOrder": order,
        "subject":       desc,
        "currency":      "CLP",
        "amount":        int(float(gasto["monto_total"])),
        "email":         email,
        "urlConfirmation": APP_URL + "/api/pagos/flow/confirm",
        "urlReturn":       APP_URL + "/portal/pago-resultado",
    }
    params["apiKey"] = api_key
    params["s"]      = _sign_flow(params, secret)

    url = FLOW_API_URL.rstrip("/") + "/payment/create"
    try:
        resp = httpx.post(url, data=params, timeout=15)
        data = resp.json()
    except Exception as e:
        raise HTTPException(502, "Error conectando con Flow: " + str(e))
    if resp.status_code >= 400:
        raise HTTPException(502, "Flow error: " + data.get("message", str(data)))

    flow_url = data.get("url") + "?token=" + data.get("token", "") if data.get("url") else None
    return {"url": flow_url, "token": data.get("token"), "order": order}


@router.post("/mp/iniciar")
def iniciar_mp(
    body: PagoBody,
    residente: dict = Depends(_get_residente),
    db: Session = Depends(get_db)
):
    """Inicia pago Mercado Pago para un gasto comun del residente autenticado."""
    depto_id     = residente.get("depto_id", 0)
    residente_id = int(residente.get("sub", 0))

    gasto = _get_gasto(body.gasto_comun_id, depto_id, db)
    creds = _tenant_creds(depto_id, db)

    if not creds["mp_activo"]:
        raise HTTPException(422, "Mercado Pago no está activado para este condominio")
    if not creds["mp_access_token_enc"]:
        raise HTTPException(422, "Credenciales MP no configuradas — contacte a la administración")

    access_token = _decrypt(creds["mp_access_token_enc"])
    email        = _residente_email(residente_id, db) or "pagos@conectaai.cl"
    ext_ref      = "PORTAL-GC-{}-{}".format(gasto["id"], creds["tenant_id"])

    desc = gasto.get("descripcion") or "Gasto Común"
    if gasto.get("periodo"):
        desc = desc + " - " + str(gasto["periodo"])

    payload = {
        "items": [{
            "title":      desc,
            "quantity":   1,
            "unit_price": float(gasto["monto_total"]),
            "currency_id": "CLP",
        }],
        "payer":          {"email": email},
        "external_reference": ext_ref,
        "back_urls": {
            "success": APP_URL + "/portal/pago-resultado?status=ok",
            "failure": APP_URL + "/portal/pago-resultado?status=error",
            "pending": APP_URL + "/portal/pago-resultado?status=pending",
        },
        "auto_return":    "approved",
        "notification_url": APP_URL + "/api/pagos/mp/webhook",
    }
    try:
        resp = httpx.post(
            MP_API + "/checkout/preferences",
            json=payload,
            headers={"Authorization": "Bearer " + access_token},
            timeout=15,
        )
        data = resp.json()
    except Exception as e:
        raise HTTPException(502, "Error conectando con Mercado Pago: " + str(e))
    if resp.status_code >= 400:
        raise HTTPException(502, "MP error: " + str(data.get("message", data)))

    return {"url": data.get("init_point"), "sandbox_url": data.get("sandbox_init_point"), "ref": ext_ref}
