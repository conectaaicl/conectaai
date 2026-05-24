"""
Mercado Pago — per-tenant credentials.
Each tenant stores their own MP access_token (encrypted with Fernet).
"""
import os, time
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
import httpx, jwt as _jwt
from cryptography.fernet import Fernet, InvalidToken
from app.core.database import get_db

router = APIRouter(prefix="/api/pagos/mp", tags=["pagos_mp"])

APP_URL = os.getenv("APP_URL", "https://conectaai.cl")
SECRET_KEY = os.getenv("SECRET_KEY", "")
FERNET_KEY = os.getenv("FERNET_KEY", "")
ALGORITHM = "HS256"
MP_API = "https://api.mercadopago.com"


def _fernet() -> Fernet:
    if not FERNET_KEY:
        raise HTTPException(422, "FERNET_KEY no configurado")
    return Fernet(FERNET_KEY.encode())


def decrypt_val(enc: str) -> str:
    try:
        return _fernet().decrypt(enc.encode()).decode()
    except (InvalidToken, Exception):
        raise HTTPException(422, "No se pudo descifrar credencial MP")


def _get_session(request: Request) -> dict:
    token = request.cookies.get("session")
    if not token:
        raise HTTPException(401, "No autenticado")
    try:
        return _jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except Exception:
        raise HTTPException(401, "Sesion invalida")


def _get_tenant_creds(db: Session, departamento_id: int) -> dict:
    row = db.execute(text("""
        SELECT t.id, t.mp_activo, t.mp_access_token_enc, t.mp_public_key_enc
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
    if not tenant["mp_activo"]:
        raise HTTPException(422, "Mercado Pago no activado")
    if not tenant["mp_access_token_enc"]:
        raise HTTPException(422, "Credenciales MP no configuradas")

    access_token = decrypt_val(tenant["mp_access_token_enc"])
    email = _residente_email(db, g["departamento_id"]) or "pagos@conectaai.cl"
    ext_ref = "COND-GC-{}-{}".format(g["id"], tenant["id"])

    try:
        resp = httpx.post(
            MP_API + "/checkout/preferences",
            json={
                "items": [{"id": "GC-" + str(g["id"]), "title": g.get("descripcion") or "Gasto Comun",
                           "quantity": 1, "unit_price": float(g["monto_total"]), "currency_id": "CLP"}],
                "payer": {"email": email},
                "back_urls": {
                    "success": APP_URL + "/portal/pago-resultado?estado=ok",
                    "failure": APP_URL + "/portal/pago-resultado?estado=error",
                    "pending": APP_URL + "/portal/pago-resultado?estado=pendiente",
                },
                "auto_return": "approved",
                "notification_url": APP_URL + "/api/pagos/mp/webhook",
                "external_reference": ext_ref,
            },
            headers={"Authorization": "Bearer " + access_token,
                     "X-Idempotency-Key": ext_ref + "-" + str(int(time.time()))},
            timeout=15,
        )
        data = resp.json()
    except Exception as e:
        raise HTTPException(502, "Error conectando con Mercado Pago: " + str(e))

    if resp.status_code >= 400:
        raise HTTPException(502, "MP error: " + data.get("message", str(data)))

    return {
        "preference_id": data.get("id"),
        "init_point": data.get("init_point"),
        "sandbox_init_point": data.get("sandbox_init_point"),
    }


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
    if not tenant["mp_activo"]:
        raise HTTPException(422, "Mercado Pago no activado")
    if not tenant["mp_access_token_enc"]:
        raise HTTPException(422, "Credenciales MP no configuradas")

    access_token = decrypt_val(tenant["mp_access_token_enc"])
    email = _residente_email(db, m["departamento_id"]) or "pagos@conectaai.cl"
    ext_ref = "COND-MU-{}-{}".format(m["id"], tenant["id"])

    try:
        resp = httpx.post(
            MP_API + "/checkout/preferences",
            json={
                "items": [{"id": "MU-" + str(m["id"]), "title": m.get("descripcion") or "Multa",
                           "quantity": 1, "unit_price": float(m["monto"]), "currency_id": "CLP"}],
                "payer": {"email": email},
                "back_urls": {
                    "success": APP_URL + "/portal/pago-resultado?estado=ok",
                    "failure": APP_URL + "/portal/pago-resultado?estado=error",
                    "pending": APP_URL + "/portal/pago-resultado?estado=pendiente",
                },
                "auto_return": "approved",
                "notification_url": APP_URL + "/api/pagos/mp/webhook",
                "external_reference": ext_ref,
            },
            headers={"Authorization": "Bearer " + access_token,
                     "X-Idempotency-Key": ext_ref + "-" + str(int(time.time()))},
            timeout=15,
        )
        data = resp.json()
    except Exception as e:
        raise HTTPException(502, "Error conectando con Mercado Pago: " + str(e))

    if resp.status_code >= 400:
        raise HTTPException(502, "MP error: " + data.get("message", str(data)))

    return {
        "preference_id": data.get("id"),
        "init_point": data.get("init_point"),
        "sandbox_init_point": data.get("sandbox_init_point"),
    }


@router.post("/webhook")
async def mp_webhook(request: Request, db: Session = Depends(get_db)):
    """MP IPN — always returns 200."""
    try:
        body = await request.json()
        if body.get("type") != "payment":
            return {"status": "ok"}

        payment_id = body.get("data", {}).get("id")
        if not payment_id:
            return {"status": "ok"}

        # Find the correct tenant's access token by parsing ext_ref from payment data
        # We don't know which tenant until we fetch the payment, so fetch with a public endpoint first
        # Actually MP doesn't have unauthenticated payment lookup — we need to try each tenant
        tenants = db.execute(text(
            "SELECT id, mp_access_token_enc FROM tenants WHERE mp_activo=true AND mp_access_token_enc IS NOT NULL"
        )).fetchall()

        payment = None
        used_tenant_id = None
        fernet_obj = Fernet(FERNET_KEY.encode()) if FERNET_KEY else None
        for t in tenants:
            try:
                td = dict(t._mapping)
                at = fernet_obj.decrypt(td["mp_access_token_enc"].encode()).decode()
                resp = httpx.get(
                    MP_API + "/v1/payments/" + str(payment_id),
                    headers={"Authorization": "Bearer " + at},
                    timeout=10,
                )
                if resp.status_code == 200:
                    payment = resp.json()
                    used_tenant_id = td["id"]
                    break
            except Exception:
                continue

        if not payment or payment.get("status") != "approved":
            return {"status": "ok"}

        ext_ref: str = payment.get("external_reference", "")
        amount = float(payment.get("transaction_amount", 0))
        parts = ext_ref.split("-")
        if len(parts) < 4:
            return {"status": "ok"}

        tipo = parts[1]
        ref_id = int(parts[2])
        depto_id = None

        if tipo == "GC":
            row = db.execute(text("SELECT departamento_id FROM gastos_comunes WHERE id=:id"), {"id": ref_id}).fetchone()
            if row:
                depto_id = row[0]
            db.execute(text(
                "UPDATE gastos_comunes SET estado='pagado', fecha_pago=NOW(), metodo_pago='mercadopago' WHERE id=:id AND estado!='pagado'"
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
                monto, fecha_pago, metodo_pago, descripcion, mp_payment_id, mp_external_reference, mp_status)
            VALUES (:tid, :did, :gcid, :mulid, :monto, NOW(), 'mercadopago', :desc, :mpid, :ext, 'approved')
        """), {
            "tid": used_tenant_id, "did": depto_id,
            "gcid": ref_id if tipo == "GC" else None,
            "mulid": ref_id if tipo == "MU" else None,
            "monto": amount, "desc": "Pago MP — " + ext_ref,
            "mpid": str(payment_id), "ext": ext_ref,
        })
        db.commit()
    except Exception:
        try:
            db.rollback()
        except Exception:
            pass
    return {"status": "ok"}


@router.get("/status/{payment_id}")
def mp_status(payment_id: str, request: Request, db: Session = Depends(get_db)):
    _get_session(request)
    row = db.execute(text(
        "SELECT mp_status, monto, metodo_pago, fecha_pago FROM pagos WHERE mp_payment_id=:mpid LIMIT 1"
    ), {"mpid": payment_id}).fetchone()
    if row:
        return dict(row._mapping)
    return {"mp_status": "not_found"}
