from sqlalchemy import Column, Integer, String, DateTime, JSON, Text
from sqlalchemy.sql import func
from app.core.database import Base

class HistorialEvento(Base):
    __tablename__ = "historial_eventos"
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, nullable=False, index=True)
    modulo = Column(String(80), nullable=False)
    accion = Column(String(80), nullable=False)
    descripcion = Column(Text, nullable=False)
    usuario_nombre = Column(String(150), nullable=True)
    entidad_id = Column(Integer, nullable=True)
    metadata_json = Column(JSON, nullable=True)
    ip_address = Column(String(50), nullable=True)
    fecha = Column(DateTime(timezone=True), server_default=func.now(), index=True)
