from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.core.services.require_feature import require_feature
from app.models.appointment import Appointment

router = APIRouter(
    prefix="/appointments",
    tags=["Appointments"],
    dependencies=[Depends(require_feature("ventas"))],
)


@router.post("/")
def create_appointment(
    payload: dict,
    db: Session = Depends(get_db),
):
    appointment = Appointment(**payload)
    db.add(appointment)
    db.commit()
    db.refresh(appointment)
    return {
        "id": appointment.id,
        "created": True,
    }


@router.get("/")
def list_appointments(
    db: Session = Depends(get_db),
):
    appointments = db.query(Appointment).all()
    return [
        {
            "id": a.id,
        }
        for a in appointments
    ]


@router.get("/{appointment_id}")
def get_appointment(
    appointment_id: int,
    db: Session = Depends(get_db),
):
    appointment = (
        db.query(Appointment)
        .filter(Appointment.id == appointment_id)
        .first()
    )

    if not appointment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Appointment not found",
        )

    return {
        "id": appointment.id,
    }


@router.delete("/{appointment_id}")
def delete_appointment(
    appointment_id: int,
    db: Session = Depends(get_db),
):
    appointment = (
        db.query(Appointment)
        .filter(Appointment.id == appointment_id)
        .first()
    )

    if not appointment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Appointment not found",
        )

    db.delete(appointment)
    db.commit()
    return {"ok": True}
