from sqlalchemy.orm import Session
from app.models.lead import Lead

DEFAULT_COMPANY_ID = 1  # ⚠️ asegúrate que esta company exista en la DB


def create_lead_internal(
    *,
    db: Session,
    company_id: int,
    name: str | None = None,
    phone: str | None = None,
    source: str | None = None,
):
    lead = Lead(
        company_id=company_id,
        name=name,
        phone=phone,
        source=source,
        status="new",
    )

    db.add(lead)
    db.commit()
    db.refresh(lead)

    return lead


