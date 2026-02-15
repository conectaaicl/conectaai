from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class TenantBase(BaseModel):
    nombre: str
    subdominio: str
    email_contacto: str
    telefono: Optional[str] = None
    color_primario: str = '#3498db'
    color_secundario: str = '#2ecc71'
    color_acento: str = '#e74c3c'
    plan: str = 'basico'
    limite_condominios: int = 1
    limite_departamentos: int = 50

class TenantCreate(TenantBase):
    pass

class TenantUpdate(BaseModel):
    nombre: Optional[str] = None
    email_contacto: Optional[str] = None
    telefono: Optional[str] = None
    logo_url: Optional[str] = None
    favicon_url: Optional[str] = None
    color_primario: Optional[str] = None
    color_secundario: Optional[str] = None
    color_acento: Optional[str] = None
    plan: Optional[str] = None
    estado: Optional[str] = None
    limite_condominios: Optional[int] = None
    limite_departamentos: Optional[int] = None

class TenantResponse(TenantBase):
    id: int
    logo_url: Optional[str] = None
    favicon_url: Optional[str] = None
    estado: str
    fecha_inicio: datetime
    fecha_vencimiento: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class TenantConfig(BaseModel):
    """Config pública para frontend"""
    id: int
    nombre: str
    subdominio: str
    logo_url: Optional[str] = None
    favicon_url: Optional[str] = None
    color_primario: str
    color_secundario: str
    color_acento: str
