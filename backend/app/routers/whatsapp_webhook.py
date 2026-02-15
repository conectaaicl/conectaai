from fastapi import APIRouter, Request, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
import pytz

from app.core.database import get_db
from app.sales.service import SalesOrchestrator
from app.models.deal import Deal
from app.services.whatsapp_service import WhatsAppService

router = APIRouter(prefix="/webhooks/whatsapp", tags=["WhatsApp"])

VERIFY_TOKEN = "conectaai_verify"
TZ = pytz.timezone("America/Santiago")


def is_business_hours():
    now = datetime.now(TZ)
    return 9 <= now.hour < 18  # 09:00 a 18:00


@router.get("")
def verify_webhook(
    hub_mode: str,
    hub_challenge: str,
    hub_verify_token: str,
):
    if hub_mode == "subscribe" and hub_verify_token == VERIFY_TOKEN:
        return int(hub_challenge)
    raise HTTPException(status_code=403, detail="Verification failed")


@router.post("")
async def receive_message(request: Request):
    payload = await request.json()

    try:
        entry = payload["entry"][0]
        change = entry["changes"][0]
        value = change["value"]
        message = value["messages"][0]

        phone = message["from"]
        text = message["text"]["body"]

    except Exception:
        return {"status": "ignored"}

    company_id = 1

    db: Session = next(get_db())

    orchestrator = SalesOrchestrator(db=db, company_id=company_id)
    assigned_user_id = orchestrator.assign_seller()

    deal = Deal(
        title=f"WhatsApp {phone}: {text[:30]}",
        company_id=company_id,
        stage="new",
        assigned_user_id=assigned_user_id,
    )

    db.add(deal)
    db.commit()
    db.refresh(deal)

    whatsapp = WhatsAppService()

    if is_business_hours():
        reply = "👋 Gracias por escribir a ConectaAI. Un asesor te contactará en breve."
    else:
        reply = (
            "👋 Gracias por escribir a ConectaAI.\n"
            "Nuestro horario es de lunes a viernes de 09:00 a 18:00.\n"
            "Te contactaremos apenas retomemos actividades."
        )

    whatsapp.send_text(to=phone, text=reply)

    return {
        "status": "deal_created",
        "deal_id": deal.id,
        "assigned_user_id": assigned_user_id,
        "business_hours": is_business_hours(),
    }
