from sqlalchemy import Column, Integer, String, DateTime, Boolean
from sqlalchemy.sql import func
from app.core.database import Base

class Tenant(Base):
    __tablename__ = "tenants"
    
    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, nullable=False)
    subdominio = Column(String, unique=True, nullable=False, index=True)
    email_contacto = Column(String, nullable=False)
    telefono = Column(String)
    
    # Marca Blanca
    logo_url = Column(String)
    favicon_url = Column(String)
    color_primario = Column(String, default='#3498db')
    color_secundario = Column(String, default='#2ecc71')
    color_acento = Column(String, default='#e74c3c')
    
    # Planes
    plan = Column(String, default='basico')
    estado = Column(String, default='activo')
    fecha_inicio = Column(DateTime, default=func.now())
    fecha_vencimiento = Column(DateTime)
    limite_condominios = Column(Integer, default=1)
    limite_departamentos = Column(Integer, default=50)
    
    # SMTP
    smtp_host = Column(String)
    smtp_port = Column(Integer)
    smtp_user = Column(String)
    smtp_password = Column(String)
    
    # Metadata
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
