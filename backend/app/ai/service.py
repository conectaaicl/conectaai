from sqlalchemy.orm import Session

from app.db.database import SessionLocal
from app.sales.service import SalesOrchestrator


class AIDecisionService:
    def decide(self, from_number: str, message: str):
        text = message.lower()

        db: Session = SessionLocal()

        try:
            sales = SalesOrchestrator()

            if "info" in text or "información" in text:
                result = sales.process_incoming_message(
                    db=db,
                    from_number=from_number,
                    message=message,
                )

                return {
                    "action": "reply",
                    "reply": "Hola 👋 Claro, dime qué información necesitas.",
                    "create_lead": True,
                    "assign_to": "ventas",
                    "lead_id": result["lead_id"],
                    "deal_id": result["deal_id"],
                }

            if "precio" in text or "valor" in text:
                result = sales.process_incoming_message(
                    db=db,
                    from_number=from_number,
                    message=message,
                )

                return {
                    "action": "reply",
                    "reply": "Te ayudo con precios 💰 ¿qué servicio te interesa?",
                    "create_lead": True,
                    "assign_to": "ventas",
                    "lead_id": result["lead_id"],
                    "deal_id": result["deal_id"],
                }

            return {
                "action": "reply",
                "reply": "Hola 👋 ¿en qué te puedo ayudar?",
                "create_lead": False,
            }

        finally:
            db.close()


