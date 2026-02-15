from pydantic import BaseModel, EmailStr
from typing import Optional, Dict
from datetime import datetime

class CondominioBase(BaseModel):
    nombre: str
    direccion: str
    comuna: Optional[str] = None
    region: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[EmailStr] = None
    configuracion: Optional[Dict] = {}
    logo_url: Optional[str] = None

class CondominioCreate(CondominioBase):
    pass

class CondominioUpdate(BaseModel):
    nombre: Optional[str] = None
    direccion: Optional[str] = None
    comuna: Optional[str] = None
    region: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[EmailStr] = None
    configuracion: Optional[Dict] = None
    logo_url: Optional[str] = None

class CondominioResponse(CondominioBase):
    id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
