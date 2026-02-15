import requests
from app.core.config import settings

# ===============================
# WHATSAPP REAL (CLOUD)
# ===============================
class WhatsAppService:
    BASE_URL = "https://graph.facebook.com/v18.0"

    def send_message(self, to: str, message: str):
        url = f"{self.BASE_URL}/{settings.WHATSAPP_PHONE_ID}/messages"

        payload = {
            "messaging_product": "whatsapp",
            "to": to,
            "type": "text",
            "text": {"body": message},
        }

        headers = {
            "Authorization": f"Bearer {settings.WHATSAPP_TOKEN}",
            "Content-Type": "application/json",
        }

        response = requests.post(url, json=payload, headers=headers)
        response.raise_for_status()
        return response.json()

# ===============================
# WHATSAPP MOCK (ENTRANTE)
# ===============================
class WhatsAppMockService:
    def receive_message(self, from_number: str, message: str):
        print("📩 WhatsApp MOCK recibido")
        print("From:", from_number)
        print("Message:", message)

        return {
            "status": "mock_received",
            "from": from_number,
            "message": message,
        }
