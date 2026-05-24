from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.core.database import Base

class Aviso(Base):
    __tablename__ = "avisos"
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    condominio_id = Column(Integer, ForeignKey("condominios.id"), nullable=True)
    titulo = Column(String, nullable=False)
    contenido = Column(Text, nullable=False)
    tipo = Column(String, default="informativo")  # informativo, urgente, mantencion, reserva
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_by = Column(Integer, nullable=True)
