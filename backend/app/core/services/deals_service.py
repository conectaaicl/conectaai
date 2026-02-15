from sqlalchemy.orm import Session
from app.models.deal import Deal

DEFAULT_COMPANY_ID = 1  # ⚠️ debe existir en DB


def create_deal_internal(
    *,
    db: Session,
    title: str,
    lead_id: int | None = None,
    stage: str | None = None,
    company_id: int | None = None,
):
    deal = Deal(
        company_id=company_id or DEFAULT_COMPANY_ID,
        title=title,
        lead_id=lead_id,
        stage=stage,
    )

    db.add(deal)
    db.commit()
    db.refresh(deal)

    return deal
