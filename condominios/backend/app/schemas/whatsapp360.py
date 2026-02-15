from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, date

# ============================================
# CONVERSACIONES
# ============================================
class ConversacionBase(BaseModel):
    canal: str
    contacto_nombre: Optional[str] = None
    contacto_telefono: Optional[str] = None
    contacto_email: Optional[str] = None
    estado: Optional[str] = 'activa'
    asignado_a: Optional[int] = None
    etiquetas: Optional[List[str]] = []

class ConversacionCreate(ConversacionBase):
    tenant_id: int = 1

class ConversacionUpdate(BaseModel):
    estado: Optional[str] = None
    asignado_a: Optional[int] = None
    etiquetas: Optional[List[str]] = None

class ConversacionResponse(ConversacionBase):
    id: int
    tenant_id: int
    ultima_interaccion: datetime
    created_at: datetime
    
    class Config:
        from_attributes = True

# ============================================
# MENSAJES
# ============================================
class MensajeBase(BaseModel):
    tipo: str
    contenido: Optional[str] = None
    direccion: str
    enviado_por: str
    agente_id: Optional[int] = None
    leido: Optional[bool] = False

class MensajeCreate(MensajeBase):
    conversacion_id: int

class MensajeResponse(MensajeBase):
    id: int
    conversacion_id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

# ============================================
# LEADS
# ============================================
class LeadBase(BaseModel):
    nombre: Optional[str] = None
    email: Optional[str] = None
    telefono: str
    canal_origen: Optional[str] = None
    estado: Optional[str] = 'nuevo'
    temperatura: Optional[str] = 'frio'
    interes: Optional[str] = None
    puntaje: Optional[int] = 0
    asignado_a: Optional[int] = None
    fecha_proximo_contacto: Optional[date] = None
    notas: Optional[str] = None

class LeadCreate(LeadBase):
    tenant_id: int = 1
    conversacion_id: Optional[int] = None

class LeadUpdate(BaseModel):
    nombre: Optional[str] = None
    email: Optional[str] = None
    estado: Optional[str] = None
    temperatura: Optional[str] = None
    puntaje: Optional[int] = None
    asignado_a: Optional[int] = None
    notas: Optional[str] = None

class LeadResponse(LeadBase):
    id: int
    tenant_id: int
    conversacion_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

# ============================================
# INTEGRACIONES
# ============================================
class IntegracionBase(BaseModel):
    tipo: str
    nombre: str
    config: Dict[str, Any]
    webhook_url: Optional[str] = None
    activa: Optional[bool] = True

class IntegracionCreate(IntegracionBase):
    tenant_id: int = 1

class IntegracionResponse(IntegracionBase):
    id: int
    tenant_id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

# ============================================
# PLANTILLAS
# ============================================
class PlantillaBase(BaseModel):
    nombre: str
    contenido: str
    variables: Optional[List[str]] = []
    canal: Optional[str] = None
    categoria: Optional[str] = None
    activa: Optional[bool] = True

class PlantillaCreate(PlantillaBase):
    tenant_id: int = 1

class PlantillaResponse(PlantillaBase):
    id: int
    tenant_id: int
    created_at: datetime
    
    class Config:
        from_attributes = True
