from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Numeric
from sqlalchemy.sql import func
from app.core.database import Base

class Incidencia(Base):
    __tablename__ = "incidencias"
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    condominio_id = Column(Integer, ForeignKey("condominios.id"), nullable=True)
    departamento_id = Column(Integer, ForeignKey("departamentos.id"), nullable=True)
    titulo = Column(String, nullable=False)
    descripcion = Column(Text)
    categoria = Column(String, default="general")  # electricidad, agua, ascensor, limpieza, seguridad, general
    prioridad = Column(String, default="media")  # baja, media, alta, urgente
    estado = Column(String, default="abierta")  # abierta, en_proceso, resuelta, cerrada
    reportado_por = Column(Integer)  # persona_id
    asignado_a = Column(Integer)  # empleado_id
    costo_estimado = Column(Numeric(10,2), default=0)
    costo_real = Column(Numeric(10,2), default=0)
    imagen_url = Column(String)
    fecha_resolucion = Column(DateTime)
    notas_resolucion = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
