from pydantic import BaseModel
from datetime import datetime

# ===============================
# MENSAJE REAL (ENVÍO)
# ===============================
class WhatsAppMessage(BaseModel):
    to: str
    message: str

# ===============================
# MENSAJE MOCK (ENTRANTE)
# ===============================
class WhatsAppMockMessage(BaseModel):
    from_number: str
    message: str
    timestamp: datetime | None = None
