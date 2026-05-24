from sqlalchemy import Column, Integer, String, DateTime, Boolean
from sqlalchemy.sql import func
from app.core.database import Base

class ResidentePortal(Base):
    __tablename__ = "residentes_portal"
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, nullable=False, index=True)
    rut = Column(String(20), nullable=False, index=True)
    nombre_completo = Column(String(150), nullable=False)
    email = Column(String(120), nullable=True)
    telefono = Column(String(30), nullable=True)
    password_hash = Column(String(255), nullable=False)
    departamento_id = Column(Integer, nullable=True)
    condominio_id = Column(Integer, nullable=True)
    activo = Column(Boolean, default=True)
    ultimo_login = Column(DateTime(timezone=True), nullable=True)
    failed_attempts = Column(Integer, default=0)
    locked_until = Column(DateTime(timezone=True), nullable=True)
    creado_en = Column(DateTime(timezone=True), server_default=func.now())
