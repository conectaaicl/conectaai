from sqlalchemy import Column, String, ForeignKey, DateTime, Integer
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from app.core.database import Base

class CompanyBranding(Base):
    __tablename__ = "company_branding"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    
    # Identidad visual
    brand_name = Column(String(100), nullable=False)
    logo_url = Column(String(500))
    favicon_url = Column(String(500))
    
    # Colores (hex)
    primary_color = Column(String(7), default='#2563eb')
    secondary_color = Column(String(7), default='#7c3aed')
    accent_color = Column(String(7), default='#ec4899')
    
    # Dominios
    subdomain = Column(String(50), unique=True, index=True)
    custom_domain = Column(String(100), unique=True, index=True)
    
    # Contacto
    support_email = Column(String(100))
    support_phone = Column(String(20))
    
    # Configuración modular
    features = Column(JSONB, server_default='{}')
    smtp_config = Column(JSONB, server_default='{}')
    
    # Timestamps
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
