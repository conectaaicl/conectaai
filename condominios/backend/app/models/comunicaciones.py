"""
Modelos base del futuro Centro de Comunicacion. Sobreviven del antiguo
app/models/whatsapp360.py (que se elimino junto con el CRM de WhatsApp que
nunca se conecto a nada real): PlantillaMensaje y Automatizacion ya tenian
el esquema correcto para reusar, asi que se movieron aqui en vez de
recrearlos.
"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, ARRAY
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from app.core.database import Base


class PlantillaMensaje(Base):
    __tablename__ = "plantillas_mensajes"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey('tenants.id'), nullable=False, index=True)
    nombre = Column(String(255), nullable=False)
    contenido = Column(Text, nullable=False)
    variables = Column(ARRAY(Text))
    canal = Column(String(50))
    categoria = Column(String(50))
    activa = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    # WhatsApp Business (Meta) exige plantillas pre-aprobadas fuera de la
    # ventana de 24h -- estos campos quedan listos para cuando se sincronicen
    # las plantillas reales aprobadas por Meta.
    meta_template_name = Column(String(255), nullable=True)
    meta_language_code = Column(String(10), nullable=True)
    meta_status = Column(String(30), nullable=True)  # pending | approved | rejected


class Automatizacion(Base):
    __tablename__ = "automatizaciones"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey('tenants.id'), nullable=False, index=True)
    nombre = Column(String(255), nullable=False)
    descripcion = Column(Text)
    trigger_tipo = Column(String(100), nullable=False)
    trigger_config = Column(JSONB, default={})
    condiciones = Column(JSONB, default=[])
    acciones = Column(JSONB, nullable=False, default=[])
    activa = Column(Boolean, default=True)
    ejecutado_count = Column(Integer, default=0)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
