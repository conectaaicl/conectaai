from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime, timedelta

from app.core.deps import get_current_user
from app.core.database import SessionLocal
from app.models.google_integration import GoogleIntegration
from app.services.google_calendar_service import create_google_event

router = APIRouter(
    prefix="/api/google",
    tags=["Google Test"]
)


@router.post("/test-event")
def create_test_event(user=Depends(get_current_user)):
    """
    Crea un evento de prueba en Google Calendar
    para verificar OAuth + permisos + tokens.
    """

    db = SessionLocal()

    integration = (
        db.query(GoogleIntegration)
        .filter_by(company_id=user.company_id)
        .first()
    )

    if not integration:
        db.close()
        raise HTTPException(
            status_code=400,
            detail="Google Calendar no está conectado para esta empresa"
        )

    now = datetime.utcnow()
    start_time = now + timedelta(minutes=5)
    end_time = start_time + timedelta(minutes=30)

    event = create_google_event(
        integration=integration,
        title="🧪 Test ConectaAI – Google Calendar",
        description="Evento de prueba automático desde ConectaAI",
        start_time=start_time,
        end_time=end_time,
    )

    db.close()

    return {
        "message": "Evento de prueba creado",
        "google_event_id": event.get("id"),
        "htmlLink": event.get("htmlLink"),
    }
