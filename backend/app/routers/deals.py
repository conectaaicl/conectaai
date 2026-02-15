from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.deal import Deal
from app.models.user import User
from app.sales.service import assign_seller_round_robin

router = APIRouter(prefix="/deals", tags=["Deals"])


@router.get("")
def get_deals(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Deal).filter(Deal.company_id == current_user.company_id)

    if current_user.role != "admin":
        query = query.filter(Deal.assigned_user_id == current_user.id)

    deals = query.all()

    return [
        {
            "id": d.id,
            "title": d.title,
            "amount": d.amount_estimated,
            "currency": d.currency,
            "status": d.stage,
            "probability": d.probability,
            "assigned_user_id": d.assigned_user_id,
            "created_at": d.created_at,
        }
        for d in deals
    ]


@router.post("")
def create_deal(
    title: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    assigned_user_id = assign_seller_round_robin(
        db=db,
        company_id=current_user.company_id,
    )

    deal = Deal(
        title=title,
        company_id=current_user.company_id,
        stage="new",
        assigned_user_id=assigned_user_id,
    )

    db.add(deal)
    db.commit()
    db.refresh(deal)

    return {
        "id": deal.id,
        "title": deal.title,
        "assigned_user_id": deal.assigned_user_id,
        "status": deal.stage,
    }
