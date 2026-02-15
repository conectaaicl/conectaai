from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import datetime, date

# TURNOS
class TurnoBase(BaseModel):
    persona_id: int
    tipo: str
    fecha_inicio: datetime
    fecha_fin: datetime
    horas_programadas: float = 8
    observaciones: Optional[str] = None

class TurnoCreate(TurnoBase):
    pass

class TurnoResponse(TurnoBase):
    id: int
    estado: str
    created_at: datetime
    class Config:
        from_attributes = True

# ASISTENCIAS
class AsistenciaBase(BaseModel):
    persona_id: int
    fecha: date
    hora_entrada: Optional[datetime] = None
    hora_salida: Optional[datetime] = None
    estado: str = "presente"
    observaciones: Optional[str] = None

class AsistenciaCreate(AsistenciaBase):
    pass

class AsistenciaResponse(AsistenciaBase):
    id: int
    minutos_tarde: int
    horas_trabajadas: float
    created_at: datetime
    class Config:
        from_attributes = True

# SUELDOS
class BonusDescuento(BaseModel):
    concepto: str
    monto: float

class SueldoBase(BaseModel):
    persona_id: int
    mes: int
    anio: int
    sueldo_base: float
    horas_extra: float = 0
    bonos: List[BonusDescuento] = []
    adelantos: float = 0
    multas: float = 0
    otros_descuentos: List[BonusDescuento] = []

class SueldoCreate(SueldoBase):
    pass

class SueldoResponse(SueldoBase):
    id: int
    total_haberes: float
    total_descuentos: float
    liquido_pagar: float
    estado: str
    fecha_pago: Optional[datetime] = None
    created_at: datetime
    class Config:
        from_attributes = True

# ADELANTOS
class AdelantoBase(BaseModel):
    persona_id: int
    monto: float
    motivo: str

class AdelantoCreate(AdelantoBase):
    pass

class AdelantoResponse(AdelantoBase):
    id: int
    estado: str
    fecha_solicitud: datetime
    fecha_aprobacion: Optional[datetime] = None
    descontado: bool
    class Config:
        from_attributes = True

# EVALUACIONES
class EvaluacionBase(BaseModel):
    persona_id: int
    tipo: str
    fecha: date
    puntualidad: Optional[int] = None
    desempeno: Optional[int] = None
    actitud: Optional[int] = None
    presentacion: Optional[int] = None
    comentarios: Optional[str] = None

class EvaluacionCreate(EvaluacionBase):
    pass

class EvaluacionResponse(EvaluacionBase):
    id: int
    promedio: Optional[float] = None
    created_at: datetime
    class Config:
        from_attributes = True

# EQUIPAMIENTO
class EquipamientoBase(BaseModel):
    persona_id: int
    tipo: str
    descripcion: str
    fecha_entrega: date
    costo: Optional[float] = None

class EquipamientoCreate(EquipamientoBase):
    pass

class EquipamientoResponse(EquipamientoBase):
    id: int
    estado: str
    condicion: Optional[str] = None
    fecha_devolucion: Optional[date] = None
    class Config:
        from_attributes = True
