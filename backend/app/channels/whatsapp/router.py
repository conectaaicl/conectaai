from fastapi import APIRouter
from app.channels.whatsapp.schemas import (
    WhatsAppMessage,
    WhatsAppMockMessage,
)
from app.channels.whatsapp.service import (
    WhatsAppService,
    WhatsAppMockService,
)

router = APIRouter(
    prefix="/whatsapp",
    tags=["WhatsApp"]
)

# ===============================
# ENVÍO REAL (Cloud / luego)
# ===============================
@router.post("/send")
def send_whatsapp(data: WhatsAppMessage):
    service = WhatsAppService()
    return service.send_message(data.to, data.message)

# ===============================
# MOCK — MENSAJE ENTRANTE
# ===============================
@router.post("/mock")
def mock_whatsapp(data: WhatsAppMockMessage):
    service = WhatsAppMockService()
    return service.receive_message(
        data.from_number,
        data.message
    )
