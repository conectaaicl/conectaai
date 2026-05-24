from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models import GastoComun
from typing import Optional
import os, hashlib, hmac, time, httpx

router = APIRouter(prefix="/api/portal/pago", tags=["pagos_online"])

# Webpay Plus - Transbank
WEBPAY_API_KEY = os.getenv("WEBPAY_API_KEY", "")
WEBPAY_COMMERCE_CODE = os.getenv("WEBPAY_COMMERCE_CODE", "597055555532")  # test code
WEBPAY_BASE_URL = os.getenv("WEBPAY_BASE_URL", "https://webpay3gint.transbank.cl")  # staging
APP_URL = os.getenv("APP_URL", "https://conectaai.cl")

@router.post("/webpay/iniciar")
async def webpay_iniciar(data: dict, db: Session=Depends(get_db)):
    """Initiate Webpay Plus transaction"""
    if not WEBPAY_API_KEY:
        raise HTTPException(503, "Webpay no configurado. Configure WEBPAY_API_KEY y WEBPAY_COMMERCE_CODE en variables de entorno.")
    gasto_id = data.get("gasto_id")
    tenant_id = data.get("tenant_id")
    buy_order = f"GC{gasto_id}{int(time.time())}"[-26:]
    session_id = f"S{tenant_id}{gasto_id}"
    gasto = db.query(GastoComun).filter(GastoComun.id==gasto_id).first()
    if not gasto: raise HTTPException(404, "Gasto no encontrado")
    amount = int(gasto.monto_total or 0)
    return_url = f"{APP_URL}/portal/pago-resultado"
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"{WEBPAY_BASE_URL}/rswebpaytransaction/api/webpay/v1.2/transactions",
                headers={
                    "Tbk-Api-Key-Id": WEBPAY_COMMERCE_CODE,
                    "Tbk-Api-Key-Secret": WEBPAY_API_KEY,
                    "Content-Type": "application/json"
                },
                json={"buy_order": buy_order, "session_id": session_id, "amount": amount, "return_url": return_url}
            )
        if resp.status_code != 200: raise HTTPException(502, f"Error Webpay: {resp.text}")
        result = resp.json()
        return {"url": result["url"], "token": result["token"], "monto": amount}
    except HTTPException: raise
    except Exception as e:
        raise HTTPException(502, f"Error conectando con Webpay: {str(e)}")

@router.post("/webpay/confirmar")
async def webpay_confirmar(data: dict, db: Session=Depends(get_db)):
    """Confirm Webpay transaction after redirect"""
    token = data.get("token_ws") or data.get("token")
    if not token: raise HTTPException(400, "Token requerido")
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.put(
                f"{WEBPAY_BASE_URL}/rswebpaytransaction/api/webpay/v1.2/transactions/{token}",
                headers={"Tbk-Api-Key-Id": WEBPAY_COMMERCE_CODE, "Tbk-Api-Key-Secret": WEBPAY_API_KEY}
            )
        result = resp.json()
        if result.get("response_code") == 0:
            return {"ok": True, "estado": "aprobado", "monto": result.get("amount"), "auth_code": result.get("authorization_code")}
        return {"ok": False, "estado": "rechazado", "detalle": result.get("response_code")}
    except Exception as e:
        raise HTTPException(502, f"Error confirmando pago: {str(e)}")

# Khipu payment
KHIPU_RECEIVER_ID = os.getenv("KHIPU_RECEIVER_ID", "")
KHIPU_SECRET = os.getenv("KHIPU_SECRET", "")

@router.post("/khipu/iniciar")
async def khipu_iniciar(data: dict, db: Session=Depends(get_db)):
    """Create Khipu payment link"""
    if not KHIPU_RECEIVER_ID or not KHIPU_SECRET:
        raise HTTPException(503, "Khipu no configurado. Configure KHIPU_RECEIVER_ID y KHIPU_SECRET.")
    gasto_id = data.get("gasto_id")
    gasto = db.query(GastoComun).filter(GastoComun.id==gasto_id).first()
    if not gasto: raise HTTPException(404)
    amount = int(gasto.monto_total or 0)
    subject = f"Gastos comunes período {gasto.periodo}"
    return_url = f"{APP_URL}/portal/pago-resultado"
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                "https://khipu.com/api/2.0/payments",
                headers={"Authorization": f"Bearer {KHIPU_SECRET}", "Content-Type": "application/x-www-form-urlencoded"},
                data={
                    "receiver_id": KHIPU_RECEIVER_ID,
                    "subject": subject,
                    "currency": "CLP",
                    "amount": str(amount),
                    "return_url": return_url,
                    "notify_url": f"{APP_URL}/api/portal/pago/khipu/webhook"
                }
            )
        if resp.status_code not in (200, 201): raise HTTPException(502, f"Error Khipu: {resp.text}")
        result = resp.json()
        return {"url": result.get("payment_url"), "payment_id": result.get("payment_id"), "monto": amount}
    except HTTPException: raise
    except Exception as e:
        raise HTTPException(502, f"Error conectando con Khipu: {str(e)}")

@router.post("/khipu/webhook")
async def khipu_webhook(request: Request, db: Session=Depends(get_db)):
    """Receive Khipu payment confirmation"""
    return {"ok": True}
