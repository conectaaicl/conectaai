from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Float, JSON
from sqlalchemy.sql import func
from app.core.database import Base

class OrdenTrabajo(Base):
    __tablename__ = "ordenes_trabajo"
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, nullable=False)
    condominio_id = Column(Integer, ForeignKey("condominios.id"), nullable=True)
    titulo = Column(String(200), nullable=False)
    descripcion = Column(Text, nullable=True)
    tipo = Column(String(50), default="mantencion")  # mantencion/reparacion/emergencia/limpieza/inspeccion
    prioridad = Column(String(20), default="media")  # baja/media/alta/urgente
    estado = Column(String(30), default="abierta")  # abierta/asignada/en_progreso/completada/cerrada
    asignado_a = Column(String(150), nullable=True)
    proveedor = Column(String(150), nullable=True)
    costo_estimado = Column(Float, nullable=True)
    costo_real = Column(Float, nullable=True)
    fotos = Column(JSON, default=list)
    notas_cierre = Column(Text, nullable=True)
    fecha_estimada = Column(DateTime(timezone=True), nullable=True)
    fecha_inicio = Column(DateTime(timezone=True), nullable=True)
    fecha_cierre = Column(DateTime(timezone=True), nullable=True)
    creado_en = Column(DateTime(timezone=True), server_default=func.now())
    actualizado_en = Column(DateTime(timezone=True), onupdate=func.now())
