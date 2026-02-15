from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.deal import Deal
from app.services.pdf import generate_quote_pdf

router = APIRouter(tags=["quotes"])

@router.get("/quotes/{deal_id}/pdf")
def download_quote_pdf(
    deal_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    deal = db.query(Deal).filter(Deal.id == deal_id).first()

    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")

    deal_data = {
        "id": deal.id,
        "title": deal.title,
        "amount": deal.amount_estimated,
        "currency": deal.currency,
        "status": deal.stage,
    }

    pdf_bytes = generate_quote_pdf(deal_data)

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="cotizacion_deal_{deal.id}.pdf"'
        },
    )
