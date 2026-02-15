from pydantic import BaseModel, EmailStr, Field
from typing import Optional, Dict
from datetime import datetime

class BrandingBase(BaseModel):
    brand_name: str = Field(..., min_length=1, max_length=100)
    logo_url: Optional[str] = None
    favicon_url: Optional[str] = None
    primary_color: str = Field(default='#2563eb', pattern=r'^#[0-9A-Fa-f]{6}$')
    secondary_color: str = Field(default='#7c3aed', pattern=r'^#[0-9A-Fa-f]{6}$')
    accent_color: str = Field(default='#ec4899', pattern=r'^#[0-9A-Fa-f]{6}$')
    subdomain: Optional[str] = Field(None, pattern=r'^[a-z0-9-]+$')
    custom_domain: Optional[str] = None
    support_email: Optional[EmailStr] = None
    support_phone: Optional[str] = None
    features: Optional[Dict] = {}
    smtp_config: Optional[Dict] = {}

class BrandingCreate(BrandingBase):
    pass

class BrandingUpdate(BaseModel):
    brand_name: Optional[str] = None
    logo_url: Optional[str] = None
    favicon_url: Optional[str] = None
    primary_color: Optional[str] = None
    secondary_color: Optional[str] = None
    accent_color: Optional[str] = None
    subdomain: Optional[str] = None
    custom_domain: Optional[str] = None
    support_email: Optional[EmailStr] = None
    support_phone: Optional[str] = None
    features: Optional[Dict] = None
    smtp_config: Optional[Dict] = None

class BrandingResponse(BrandingBase):
    id: int
    company_id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class BrandingPublic(BaseModel):
    """Información pública de marca (sin datos sensibles)"""
    brand_name: str
    logo_url: Optional[str]
    favicon_url: Optional[str]
    primary_color: str
    secondary_color: str
    accent_color: str
    support_email: Optional[str]
    support_phone: Optional[str]
    
    class Config:
        from_attributes = True
