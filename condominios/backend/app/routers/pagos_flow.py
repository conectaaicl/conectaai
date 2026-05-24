"""
Flow.cl — per-tenant credentials.
Each tenant stores their own Flow API key/secret (encrypted with Fernet).
Money goes directly to the tenant's bank account.
"""
import os, hmac, hashlib, time
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Form
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
import httpx, jwt as _jwt
from cryptography.fernet import Fernet, InvalidToken
from app.core.database import get_db

router = APIRouter(prefix="/api/pagos/flow", tags=["pagos_flow"])

FLOW_API_URL = os.getenv("FLOW_API_URL", "https://www.flow.cl/api")
APP_URL = os.getenv("APP_URL", "https://conectaai.cl")
SECRET_KEY = os.getenv("SECRET_KEY", "")
FERNET_KEY = os.getenv("FERNET_KEY", "")
ALGORITHM = "HS256"


def _fernet() -> Fernet:
    if not FERNET_KEY:
        raise HTTPException(422, "FERNET_KEY no configurado en el servidor")
    return Fernet(FERNET_KEY.encode())


def encrypt_val(val: str) -> str:
    return _fernet().encrypt(val.encode()).decode()


def decrypt_val(enc: str) -> str:
    try:
        return _fernet().decrypt(enc.encode()).decode()
    except (InvalidToken, Exception):
        raise HTTPException(422, "No se pudo descifrar credencial — verifique la clave del servidor")


def _get_session(request: Request) -> dict:
    token = request.cookies.get("session")
    if not token:
        raise HTTPException(401, "No autenticado")
    try:
        return _jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except Exception:
        raise HTTPException(401, "Sesion invalida")


def _sign(params: dict, secret: str) -> str:
    keys = sorted(params.keys())
    msg = "".join(k + str(params[k]) for k in keys)
    return hmac.new(secret.encode(), msg.encode(), hashlib.sha256).hexdigest()


def _order_id(tipo: str, ref_id: int, tenant_id: int) -> str:
    return "COND-{}-{}-{}-{}".format(tipo, ref_id, tenant_id, int(time.time() * 1000))


def _get_tenant_creds(db: Session, departamento_id: int) -> dict:
    row = db.execute(text("""
        SELECT t.id, t.flow_activo, t.mp_activo,
               t.flow_api_key_enc, t.flow_secret_enc,
               t.mp_access_token_enc
        FROM departamentos d
        JOIN tenants t ON t.id = d.tenant_id
        WHERE d.id = :did LIMIT 1
    """), {"did": departamento_id}).fetchone()
    if not row:
        raise HTTPException(404, "Departamento no encontrado")
    return dict(row._mapping)


def _residente_email(db: Session, departamento_id: int) -> str:
    row = db.execute(text("""
        SELECT email FROM residentes_portal
        WHERE departamento_id = :did AND activo = true
        ORDER BY id DESC LIMIT 1
    """), {"did": departamento_id}).fetchone()
    return (dict(row._mapping).get("email") or "") if row else ""


def _call_flow(endpoint: str, params: dict, api_key: str, secret: str) -> dict:
    params["apiKey"] = api_key
    params["s"] = _sign(params, secret)
    url = FLOW_API_URL.rstrip("/") + "/" + endpoint.lstrip("/")
    try:
        resp = httpx.post(url, data=params, timeout=15)
        data = resp.json()
    except Exception as e:
        raise HTTPException(502, "Error conectando con Flow: " + str(e))
    if resp.status_code >= 400:
        raise HTTPException(502, "Flow error: " + data.get("message", str(data)))
    return data


class GastoBody(BaseModel):
    gasto_comun_id: int

class MultaBody(BaseModel):
    multa_id: int


@router.post("/create-gasto")
def create_gasto(body: GastoBody, request: Request, db: Session = Depends(get_db)):
    _get_session(request)
    gasto = db.execute(text(
        "SELECT id, departamento_id, monto_total, descripcion, estado FROM gastos_comunes WHERE id=:id"
    ), {"id": body.gasto_comun_id}).fetchone()
    if not gasto:
        raise HTTPException(404, "Gasto no encontrado")
    g = dict(gasto._mapping)
    if g["estado"] == "pagado":
        raise HTTPException(422, "Este gasto ya fue pagado")

    tenant = _get_tenant_creds(db, g["departamento_id"])
    if not tenant["flow_activo"]:
        raise HTTPException(422, "Flow no activado — activa Flow en Integraciones primero")
    if not tenant["flow_api_key_enc"] or not tenant["flow_secret_enc"]:
        raise HTTPException(422, "Credenciales Flow no configuradas — ingresalas en Integraciones")

    api_key = decrypt_val(tenant["flow_api_key_enc"])
    secret = decrypt_val(tenant["flow_secret_enc"])
    email = _residente_email(db, g["departamento_id"]) or "pagos@conectaai.cl"
    order = _order_id("GC", g["id"], tenant["id"])

    data = _call_flow("/payment/create", {
        "commerceOrder": order,
        "subject": g.get("descripcion") or "Gasto Comun",
        "currency": "CLP",
        "amount": int(float(g["monto_total"])),
        "email": email,
        "urlConfirmation": APP_URL + "/api/pagos/flow/confirm",
        "urlReturn": APP_URL + "/portal/pago-resultado",
    }, api_key, secret)

    return {"url": data.get("url"), "token": data.get("token"), "order": order}


@router.post("/create-multa")
def create_multa(body: MultaBody, request: Request, db: Session = Depends(get_db)):
    _get_session(request)
    multa = db.execute(text(
        "SELECT id, departamento_id, monto, descripcion, estado FROM multas WHERE id=:id"
    ), {"id": body.multa_id}).fetchone()
    if not multa:
        raise HTTPException(404, "Multa no encontrada")
    m = dict(multa._mapping)
    if m["estado"] in ("pagada", "pagado"):
        raise HTTPException(422, "Esta multa ya fue pagada")

    tenant = _get_tenant_creds(db, m["departamento_id"])
    if not tenant["flow_activo"]:
        raise HTTPException(422, "Flow no activado")
    if not tenant["flow_api_key_enc"] or not tenant["flow_secret_enc"]:
        raise HTTPException(422, "Credenciales Flow no configuradas")

    api_key = decrypt_val(tenant["flow_api_key_enc"])
    secret = decrypt_val(tenant["flow_secret_enc"])
    email = _residente_email(db, m["departamento_id"]) or "pagos@conectaai.cl"
    order = _order_id("MU", m["id"], tenant["id"])

    data = _call_flow("/payment/create", {
        "commerceOrder": order,
        "subject": m.get("descripcion") or "Multa",
        "currency": "CLP",
        "amount": int(float(m["monto"])),
        "email": email,
        "urlConfirmation": APP_URL + "/api/pagos/flow/confirm",
        "urlReturn": APP_URL + "/portal/pago-resultado",
    }, api_key, secret)

    return {"url": data.get("url"), "token": data.get("token"), "order": order}


@router.post("/confirm")
async def flow_confirm(request: Request, db: Session = Depends(get_db)):
    """Flow IPN — always returns 200."""
    try:
        form = await request.form()
        token = form.get("token", "")
        if not token:
            return {"status": "ok"}

        # We need to find which tenant this order belongs to to get their credentials.
        # Parse token to get status — but we don't know the api_key yet.
        # Strategy: look up the order in pagos to find tenant, else scan tenants.
        # Simpler: parse commerceOrder from Flow response after we identify the tenant.
        # Since Flow POSTs only the token, we query all tenants with flow credentials
        # and try until one works (most installs have 1-5 tenants).
        tenants = db.execute(text(
            "SELECT id, flow_api_key_enc, flow_secret_enc FROM tenants WHERE flow_activo=true AND flow_api_key_enc IS NOT NULL"
        )).fetchall()

        flow_data = None
        used_tenant_id = None
        for t in tenants:
            try:
                td = dict(t._mapping)
                ak = decrypt_val(td["flow_api_key_enc"])
                sk = decrypt_val(td["flow_secret_enc"])
                params = {"token": token, "apiKey": ak}
                params["s"] = _sign(params, sk)
                url = FLOW_API_URL.rstrip("/") + "/payment/getStatus"
                resp = httpx.post(url, data=params, timeout=10)
                if resp.status_code == 200:
                    flow_data = resp.json()
                    used_tenant_id = td["id"]
                    break
            except Exception:
                continue

        if not flow_data:
            return {"status": "ok"}

        status = int(flow_data.get("status", 0))
        order: str = flow_data.get("commerceOrder", "")
        amount = float(flow_data.get("amount", 0))

        if status == 2:  # paid
            parts = order.split("-")
            if len(parts) >= 5:
                tipo = parts[1]
                ref_id = int(parts[2])

                depto_id = None
                if tipo == "GC":
                    row = db.execute(text("SELECT departamento_id FROM gastos_comunes WHERE id=:id"), {"id": ref_id}).fetchone()
                    if row:
                        depto_id = row[0]
                    db.execute(text(
                        "UPDATE gastos_comunes SET estado='pagado', fecha_pago=NOW(), metodo_pago='flow' WHERE id=:id AND estado!='pagado'"
                    ), {"id": ref_id})
                elif tipo == "MU":
                    row = db.execute(text("SELECT departamento_id FROM multas WHERE id=:id"), {"id": ref_id}).fetchone()
                    if row:
                        depto_id = row[0]
                    db.execute(text(
                        "UPDATE multas SET estado='pagada', fecha_resolucion=NOW() WHERE id=:id"
                    ), {"id": ref_id})

                db.execute(text("""
                    INSERT INTO pagos (tenant_id, departamento_id, gasto_comun_id, multa_id,
                        monto, fecha_pago, metodo_pago, descripcion, flow_order, flow_token, flow_status)
                    VALUES (:tid, :did, :gcid, :mulid, :monto, NOW(), 'flow', :desc, :order, :tok, :fstat)
                    ON CONFLICT DO NOTHING
                """), {
                    "tid": used_tenant_id, "did": depto_id,
                    "gcid": ref_id if tipo == "GC" else None,
                    "mulid": ref_id if tipo == "MU" else None,
                    "monto": amount, "desc": "Pago Flow — " + order,
                    "order": order, "tok": token, "fstat": status,
                })
                db.commit()
    except Exception:
        try:
            db.rollback()
        except Exception:
            pass
    return {"status": "ok"}


@router.get("/result")
def flow_result(token: Optional[str] = None):
    return {"status": "ok", "token": token, "detail": "Revisa tu portal para ver el estado del pago"}
