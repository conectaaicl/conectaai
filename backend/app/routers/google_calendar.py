from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.core.services.require_feature import require_feature

router = APIRouter(
    prefix="/google-calendar",
    tags=["Google Calendar"],
    dependencies=[Depends(require_feature("calendarios"))],
)


@router.get("/status")
def calendar_status():
    """
    Endpoint simple para validar acceso por feature flag.
    Luego aquí conectamos OAuth real con Google.
    """
    return {
        "connected": False,
        "message": "Google Calendar feature enabled",
    }


@router.post("/sync")
def sync_calendar(
    db: Session = Depends(get_db),
):
    """
    Placeholder de sync.
    Aquí irá:
    - OAuth Google
    - Crear / actualizar eventos
    - Vincular con appointments
    """
    return {
        "ok": True,
        "message": "Calendar sync started",
    }
