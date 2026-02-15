from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, Date, ForeignKey, ARRAY
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from app.core.database import Base

# Importar modelo Usuario para que SQLAlchemy lo reconozca
from app.models.usuario import Usuario  # ✅ IMPORTANTE

class Conversacion(Base):
    __tablename__ = "conversaciones"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey('tenants.id'), nullable=False, index=True)
    canal = Column(String(50), nullable=False)
    contacto_nombre = Column(String(255))
    contacto_telefono = Column(String(50))
    contacto_email = Column(String(255))
    estado = Column(String(50), default='activa')
    asignado_a = Column(Integer, ForeignKey('usuarios.id'))
    ultima_interaccion = Column(DateTime, server_default=func.now())
    etiquetas = Column(ARRAY(Text))
    meta_data = Column('metadata', JSONB, default={})
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class Mensaje(Base):
    __tablename__ = "mensajes"
    
    id = Column(Integer, primary_key=True, index=True)
    conversacion_id = Column(Integer, ForeignKey('conversaciones.id', ondelete='CASCADE'), nullable=False)
    tipo = Column(String(50), nullable=False)
    contenido = Column(Text)
    direccion = Column(String(20), nullable=False)
    enviado_por = Column(String(50), nullable=False)
    agente_id = Column(Integer, ForeignKey('usuarios.id'))
    leido = Column(Boolean, default=False)
    meta_data = Column('metadata', JSONB, default={})
    created_at = Column(DateTime, server_default=func.now())


class Lead(Base):
    __tablename__ = "leads"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey('tenants.id'), nullable=False, index=True)
    conversacion_id = Column(Integer, ForeignKey('conversaciones.id'))
    nombre = Column(String(255))
    email = Column(String(255))
    telefono = Column(String(50), nullable=False)
    canal_origen = Column(String(50))
    estado = Column(String(50), default='nuevo')
    temperatura = Column(String(20), default='frio')
    interes = Column(Text)
    puntaje = Column(Integer, default=0)
    asignado_a = Column(Integer, ForeignKey('usuarios.id'))
    fecha_proximo_contacto = Column(Date)
    notas = Column(Text)
    meta_data = Column('metadata', JSONB, default={})
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class Integracion(Base):
    __tablename__ = "integraciones"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey('tenants.id'), nullable=False, index=True)
    tipo = Column(String(50), nullable=False)
    nombre = Column(String(255), nullable=False)
    config = Column(JSONB, nullable=False, default={})
    webhook_url = Column(String(500))
    activa = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


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
