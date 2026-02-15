from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.branding import CompanyBranding
from app.schemas.branding import BrandingResponse, BrandingUpdate

router = APIRouter(prefix="/api/branding", tags=["Branding"])

@router.get("/company/{company_id}", response_model=BrandingResponse)
def get_company_branding(
    company_id: int,
    db: Session = Depends(get_db)
):
    branding = db.query(CompanyBranding).filter(
        CompanyBranding.company_id == company_id
    ).first()
    
    if not branding:
        return BrandingResponse(
            id=0,
            company_id=company_id,
            brand_name="ConectaAI",
            logo_url=None,
            favicon_url=None,
            primary_color="#7c3aed",
            secondary_color="#3b82f6",
            accent_color="#ec4899",
            subdomain=None,
            custom_domain=None,
            support_email=None,
            support_phone=None
        )
    
    return branding

@router.put("/company/{company_id}", response_model=BrandingResponse)
def update_company_branding(
    company_id: int,
    branding_data: BrandingUpdate,
    db: Session = Depends(get_db)
):
    branding = db.query(CompanyBranding).filter(
        CompanyBranding.company_id == company_id
    ).first()
    
    if not branding:
        raise HTTPException(status_code=404, detail="Branding no encontrado. Use POST para crear.")
    
    for field, value in branding_data.model_dump(exclude_unset=True).items():
        setattr(branding, field, value)
    
    db.commit()
    db.refresh(branding)
    
    return branding

@router.post("/company/{company_id}", response_model=BrandingResponse)
def create_company_branding(
    company_id: int,
    branding_data: BrandingUpdate,
    db: Session = Depends(get_db)
):
    existing = db.query(CompanyBranding).filter(
        CompanyBranding.company_id == company_id
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Branding ya existe. Use PUT para actualizar.")
    
    branding = CompanyBranding(
        company_id=company_id,
        **branding_data.model_dump(exclude_unset=True)
    )
    db.add(branding)
    db.commit()
    db.refresh(branding)
    
    return branding
