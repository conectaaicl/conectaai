from pydantic import BaseModel
from typing import Optional
from datetime import datetime


# ==========================================
# CONDOMINIOS
# ==========================================

class CondominioBase(BaseModel):
    nombre: str
    direccion: str
    comuna: Optional[str] = None
    region: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    configuracion: Optional[dict] = {}
    logo_url: Optional[str] = None


class CondominioCreate(CondominioBase):
    tenant_id: Optional[int] = 1


class CondominioUpdate(BaseModel):
    nombre: Optional[str] = None
    direccion: Optional[str] = None
    comuna: Optional[str] = None
    region: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    configuracion: Optional[dict] = None
    logo_url: Optional[str] = None


class CondominioResponse(CondominioBase):
    id: int
    tenant_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ==========================================
# TORRES
# ==========================================

class TorreCreate(BaseModel):
    nombre: str
    numero_pisos: int


class TorreResponse(BaseModel):
    id: int
    condominio_id: int
    tenant_id: int
    nombre: str
    numero_pisos: int
    created_at: datetime

    class Config:
        from_attributes = True


# ==========================================
# PISOS
# ==========================================

class PisoResponse(BaseModel):
    id: int
    torre_id: int
    tenant_id: int
    numero: int
    created_at: datetime

    class Config:
        from_attributes = True


# ==========================================
# DEPARTAMENTOS
# ==========================================

class DepartamentoCreate(BaseModel):
    numero: str
    metraje: Optional[float] = None
    dormitorios: Optional[int] = None
    banos: Optional[int] = None
    estado: str = "disponible"


class DepartamentoUpdate(BaseModel):
    numero: Optional[str] = None
    metraje: Optional[float] = None
    dormitorios: Optional[int] = None
    banos: Optional[int] = None
    propietario_id: Optional[int] = None
    residente_id: Optional[int] = None
    estado: Optional[str] = None


class DepartamentoResponse(BaseModel):
    id: int
    piso_id: int
    tenant_id: int
    numero: str
    metraje: Optional[float]
    dormitorios: Optional[int]
    banos: Optional[int]
    propietario_id: Optional[int] = None
    residente_id: Optional[int] = None
    estado: str
    created_at: datetime

    class Config:
        from_attributes = True
