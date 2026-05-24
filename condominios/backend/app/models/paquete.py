from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from app.core.database import Base

class Paquete(Base):
    __tablename__ = "paquetes"
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, nullable=False)
    condominio_id = Column(Integer, ForeignKey("condominios.id"), nullable=True)
    departamento_id = Column(Integer, ForeignKey("departamentos.id"), nullable=True)
    remitente = Column(String(150), nullable=True)
    descripcion = Column(String(255), nullable=True)
    codigo_seguimiento = Column(String(100), nullable=True)
    estado = Column(String(30), default="pendiente")  # pendiente/notificado/retirado
    notas = Column(Text, nullable=True)
    fecha_recepcion = Column(DateTime(timezone=True), server_default=func.now())
    fecha_retiro = Column(DateTime(timezone=True), nullable=True)
    creado_en = Column(DateTime(timezone=True), server_default=func.now())
