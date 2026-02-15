from fastapi import APIRouter, Request
from app.core.config import settings

router = APIRouter(
    prefix="/whatsapp/webhook",
    tags=["WhatsApp"]
)

@router.get("/")
def verify_webhook(
    hub_mode: str,
    hub_challenge: str,
    hub_verify_token: str,
):
    if (
        settings.WHATSAPP_VERIFY_TOKEN
        and hub_verify_token == settings.WHATSAPP_VERIFY_TOKEN
    ):
        return int(hub_challenge)

    return {"error": "Invalid verify token"}

@router.post("/")
async def receive_message(request: Request):
    payload = await request.json()
    print("📩 WhatsApp Webhook Payload:")
    print(payload)
    return {"status": "received"}
