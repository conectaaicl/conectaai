from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from app.core.database import Base


class Persona(Base):
    __tablename__ = "personas"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey('tenants.id'), nullable=False, index=True)
    nombre_completo = Column(String, nullable=False)
    rut = Column(String, unique=True, nullable=False, index=True)
    telefono = Column(String, nullable=False)
    email = Column(String, nullable=False)
    roles = Column(JSONB, default=[], nullable=False)
    estado = Column(String, default="activo")
    datos_contacto = Column(JSONB, default={})
    observaciones = Column(Text, nullable=True)
    foto_url = Column(String, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
