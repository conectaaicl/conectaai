from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime

class DetalleGasto(BaseModel):
    concepto: str
    categoria: Optional[str] = None
    monto: float
    descripcion: Optional[str] = ""

class GastoComunBase(BaseModel):
    departamento_id: Optional[int] = None
    mes: int
    anio: int
    monto_base: float
    multas: float = 0
    intereses: float = 0
    otros_cargos: float = 0
    descuentos: float = 0
    monto_total: float
    estado: str = "pendiente"
    fecha_vencimiento: str
    categoria: Optional[str] = None
    descripcion: Optional[str] = None
    detalle: List[DetalleGasto] = []
    observaciones: Optional[str] = None

class GastoComunCreate(GastoComunBase):
    pass

class GastoComunUpdate(BaseModel):
    monto_base: Optional[float] = None
    multas: Optional[float] = None
    intereses: Optional[float] = None
    otros_cargos: Optional[float] = None
    descuentos: Optional[float] = None
    monto_total: Optional[float] = None
    estado: Optional[str] = None
    fecha_vencimiento: Optional[str] = None
    fecha_pago: Optional[datetime] = None
    categoria: Optional[str] = None
    descripcion: Optional[str] = None
    detalle: Optional[List[DetalleGasto]] = None
    observaciones: Optional[str] = None
    comprobante_url: Optional[str] = None
    metodo_pago: Optional[str] = None

class GastoComunResponse(GastoComunBase):
    id: int
    fecha_pago: Optional[datetime] = None
    comprobante_url: Optional[str] = None
    metodo_pago: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
