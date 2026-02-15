from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.core.services.require_feature import require_feature
from app.models.lead import Lead
from app.schemas.lead import LeadCreate, LeadOut

router = APIRouter(
    prefix="/leads",
    tags=["Leads"],
    dependencies=[Depends(require_feature("ventas"))],
)


@router.post("/", response_model=LeadOut)
def create_lead(
    lead_in: LeadCreate,
    db: Session = Depends(get_db),
):
    lead = Lead(**lead_in.dict())
    db.add(lead)
    db.commit()
    db.refresh(lead)
    return lead


@router.get("/", response_model=list[LeadOut])
def list_leads(
    db: Session = Depends(get_db),
):
    return db.query(Lead).all()


@router.get("/{lead_id}", response_model=LeadOut)
def get_lead(
    lead_id: int,
    db: Session = Depends(get_db),
):
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found",
        )
    return lead


@router.delete("/{lead_id}")
def delete_lead(
    lead_id: int,
    db: Session = Depends(get_db),
):
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found",
        )

    db.delete(lead)
    db.commit()
    return {"ok": True}
