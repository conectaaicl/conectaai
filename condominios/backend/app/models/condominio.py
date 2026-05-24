from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float, Date
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from app.core.database import Base


class Condominio(Base):
    __tablename__ = "condominios"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey('tenants.id'), nullable=False, index=True)
    nombre = Column(String, nullable=False)
    direccion = Column(String, nullable=False)
    comuna = Column(String, nullable=True)
    region = Column(String, nullable=True)
    telefono = Column(String, nullable=True)
    email = Column(String, nullable=True)
    configuracion = Column(JSONB, default={})
    logo_url = Column(String, nullable=True)
    # Administration info
    administrador_nombre = Column(String(150), nullable=True)
    administrador_rut = Column(String(20), nullable=True)
    empresa_administradora = Column(String(150), nullable=True)
    administrador_telefono = Column(String(30), nullable=True)
    administrador_email = Column(String(120), nullable=True)
    contrato_inicio = Column(Date, nullable=True)
    # Building details
    rut_condominio = Column(String(20), nullable=True)
    tipo = Column(String(50), nullable=True, default='edificio')
    anno_construccion = Column(Integer, nullable=True)
    metros_totales = Column(Float, nullable=True)
    telefono_contacto = Column(String(30), nullable=True)
    email_contacto = Column(String(120), nullable=True)
    ciudad = Column(String(100), nullable=True)
    website = Column(String(200), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
