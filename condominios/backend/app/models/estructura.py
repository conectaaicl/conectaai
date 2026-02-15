from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Float
from sqlalchemy.sql import func
from app.core.database import Base


class Torre(Base):
    __tablename__ = "torres"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey('tenants.id'), nullable=False, index=True)
    condominio_id = Column(Integer, ForeignKey("condominios.id", ondelete="CASCADE"), nullable=False)
    nombre = Column(String, nullable=False)
    numero_pisos = Column(Integer, nullable=False)
    created_at = Column(DateTime, server_default=func.now())


class Piso(Base):
    __tablename__ = "pisos"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey('tenants.id'), nullable=False, index=True)
    torre_id = Column(Integer, ForeignKey("torres.id", ondelete="CASCADE"), nullable=False)
    numero = Column(Integer, nullable=False)
    created_at = Column(DateTime, server_default=func.now())


class Departamento(Base):
    __tablename__ = "departamentos"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey('tenants.id'), nullable=False, index=True)
    piso_id = Column(Integer, ForeignKey("pisos.id", ondelete="CASCADE"), nullable=False)
    numero = Column(String, nullable=False)
    propietario_id = Column(Integer, ForeignKey("personas.id"), nullable=True)
    residente_id = Column(Integer, ForeignKey("personas.id"), nullable=True)
    metraje = Column(Float, nullable=True)
    dormitorios = Column(Integer, nullable=True)
    banos = Column(Integer, nullable=True)
    estado = Column(String, default="disponible")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class Estacionamiento(Base):
    __tablename__ = "estacionamientos"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey('tenants.id'), nullable=False, index=True)
    condominio_id = Column(Integer, ForeignKey("condominios.id", ondelete="CASCADE"), nullable=False)
    numero = Column(String, nullable=False)
    departamento_id = Column(Integer, ForeignKey("departamentos.id"), nullable=True)
    created_at = Column(DateTime, server_default=func.now())


class Bodega(Base):
    __tablename__ = "bodegas"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey('tenants.id'), nullable=False, index=True)
    condominio_id = Column(Integer, ForeignKey("condominios.id", ondelete="CASCADE"), nullable=False)
    numero = Column(String, nullable=False)
    departamento_id = Column(Integer, ForeignKey("departamentos.id"), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
