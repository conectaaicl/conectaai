from pydantic import BaseModel, EmailStr
from typing import List, Optional, Dict
from datetime import datetime


class PersonaBase(BaseModel):
    nombre_completo: str
    rut: str
    telefono: str
    email: EmailStr
    roles: List[str] = []
    estado: str = "activo"
    datos_contacto: Optional[Dict] = {}
    observaciones: Optional[str] = None
    foto_url: Optional[str] = None


class PersonaCreate(PersonaBase):
    tenant_id: Optional[int] = 1  # Por defecto tenant 1


class PersonaUpdate(BaseModel):
    nombre_completo: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[EmailStr] = None
    roles: Optional[List[str]] = None
    estado: Optional[str] = None
    datos_contacto: Optional[Dict] = None
    observaciones: Optional[str] = None
    foto_url: Optional[str] = None


class PersonaResponse(PersonaBase):
    id: int
    tenant_id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
