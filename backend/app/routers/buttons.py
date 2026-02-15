from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.models.button import Button
from app.models.company_button import CompanyButton

router = APIRouter(
    prefix="/api/buttons",
    tags=["Buttons"]
)

# Botones base (globales)
@router.get("/base")
def list_base_buttons(db: Session = Depends(get_db)):
    return db.query(Button).filter(Button.active == True).all()

# Botones por empresa (marca blanca)
@router.get("/company/{company_id}")
def list_company_buttons(company_id: int, db: Session = Depends(get_db)):
    return (
        db.query(CompanyButton)
        .filter(
            CompanyButton.company_id == company_id,
            CompanyButton.enabled == True
        )
        .order_by(CompanyButton.order.asc())
        .all()
    )
