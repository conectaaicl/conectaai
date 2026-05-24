from fastapi import APIRouter, Request, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models import ResidentePortal, GastoComun
from sqlalchemy import or_
from datetime import datetime
import os, hmac, hashlib, httpx

router = APIRouter(prefix="/api/whatsapp", tags=["whatsapp"])

WA_TOKEN = os.getenv("WHATSAPP_TOKEN", "")
WA_PHONE_ID = os.getenv("WHATSAPP_PHONE_ID", "")
WA_VERIFY_TOKEN = os.getenv("WHATSAPP_VERIFY_TOKEN", "conectaai_wa_2026")
APP_URL = os.getenv("APP_URL", "https://conectaai.cl")

async def send_wa_message(to: str, text: str):
    """Send WhatsApp message via Meta Cloud API"""
    if not WA_TOKEN or not WA_PHONE_ID: return
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(
                f"https://graph.facebook.com/v18.0/{WA_PHONE_ID}/messages",
                headers={"Authorization": f"Bearer {WA_TOKEN}", "Content-Type": "application/json"},
                json={"messaging_product": "whatsapp", "to": to, "type": "text", "text": {"body": text}}
            )
    except:
        pass

def get_residente_by_phone(phone: str, db: Session):
    """Find resident by phone number"""
    phone_clean = phone.replace("+","").replace(" ","").replace("-","")
    if phone_clean.startswith("56"): phone_clean = phone_clean[2:]
    return db.query(ResidentePortal).filter(
        ResidentePortal.telefono.ilike(f"%{phone_clean}%"),
        ResidentePortal.activo==True
    ).first()

@router.get("/webhook")
async def wa_verify(request: Request):
    """WhatsApp webhook verification"""
    params = dict(request.query_params)
    if params.get("hub.verify_token") == WA_VERIFY_TOKEN:
        return int(params.get("hub.challenge", 0))
    raise HTTPException(403)

@router.post("/webhook")
async def wa_webhook(request: Request, db: Session=Depends(get_db)):
    """Receive and process WhatsApp messages"""
    try:
        body = await request.json()
        entry = body.get("entry", [{}])[0]
        changes = entry.get("changes", [{}])[0]
        value = changes.get("value", {})
        messages = value.get("messages", [])

        for msg in messages:
            if msg.get("type") != "text": continue
            phone = msg["from"]
            text = msg["text"]["body"].strip().lower()
            residente = get_residente_by_phone(phone, db)

            if not residente:
                await send_wa_message(phone, "Hola! No encontramos una cuenta asociada a tu número. Regístrate en " + APP_URL + "/portal/registro")
                continue

            nombre = residente.nombre_completo.split()[0]

            if any(w in text for w in ["hola","inicio","menu","ayuda","help"]):
                reply = "Hola " + nombre + "! Soy el asistente de tu condominio.\n\nPuedes consultar:\n- deuda: Tu estado de cuenta\n- pagar: Link de pago\n- avisos: Últimas novedades\n- visita: Generar acceso para visita"

            elif any(w in text for w in ["deuda","cuenta","gastos","cuanto debo","estado"]):
                gastos = db.query(GastoComun).filter(
                    GastoComun.tenant_id==residente.tenant_id,
                    GastoComun.estado.in_(["pendiente","atrasado"]),
                    or_(GastoComun.departamento_id==residente.departamento_id, GastoComun.departamento_id==None)
                ).all()
                if not gastos:
                    reply = nombre + ", estás al día con tus gastos comunes!"
                else:
                    total = sum(g.monto_total or 0 for g in gastos)
                    reply = nombre + ", tienes " + str(len(gastos)) + " gasto(s) pendiente(s):\n"
                    for g in gastos[:3]:
                        reply += "- " + str(g.periodo) + ": $" + "{:,.0f}".format(g.monto_total) + " (" + str(g.estado) + ")\n"
                    reply += "\nTotal: $" + "{:,.0f}".format(total) + "\n\nEscribe pagar para ver opciones de pago."

            elif any(w in text for w in ["pagar","pago","link pago"]):
                reply = nombre + ", para pagar tus gastos comunes ingresa a:\n" + APP_URL + "/portal/cuenta\n\nPuedes pagar con Webpay o Khipu."

            elif any(w in text for w in ["avisos","noticias","novedad","aviso"]):
                from app.models import Aviso
                avs = db.query(Aviso).filter(Aviso.tenant_id==residente.tenant_id).order_by(Aviso.creado_en.desc()).limit(3).all()
                if not avs:
                    reply = "No hay avisos recientes."
                else:
                    reply = "Últimos avisos de tu condominio:\n\n"
                    for a in avs:
                        reply += str(a.titulo) + "\n" + (a.cuerpo or "")[:100] + "...\n\n"

            elif any(w in text for w in ["visita","qr","invitado","acceso"]):
                reply = nombre + ", genera un QR de acceso para tu visita en:\n" + APP_URL + "/portal/qr\n\nEl enlace es válido por 24 horas."

            else:
                reply = "Hola " + nombre + "! No entendí tu consulta. Escribe menu para ver las opciones disponibles."

            await send_wa_message(phone, reply)
    except Exception:
        pass  # Never fail WhatsApp webhooks
    return {"status": "ok"}
