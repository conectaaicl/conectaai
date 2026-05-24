from sqlalchemy import Column, Integer, String, DateTime, Float, Text, Boolean, Date
from sqlalchemy.sql import func
from app.core.database import Base

class Proveedor(Base):
    __tablename__ = "proveedores"
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, nullable=False, index=True)
    condominio_id = Column(Integer, nullable=True)
    nombre = Column(String(200), nullable=False)
    rut = Column(String(20), nullable=True)
    giro = Column(String(150), nullable=True)
    categoria = Column(String(80), nullable=True)  # electricidad/plomeria/ascensores/limpieza/jardineria/seguridad/otros
    contacto_nombre = Column(String(150), nullable=True)
    telefono = Column(String(30), nullable=True)
    email = Column(String(120), nullable=True)
    direccion = Column(String(200), nullable=True)
    sitio_web = Column(String(200), nullable=True)
    contrato_url = Column(String(500), nullable=True)
    contrato_inicio = Column(Date, nullable=True)
    contrato_fin = Column(Date, nullable=True)
    seguro_responsabilidad_url = Column(String(500), nullable=True)
    seguro_vencimiento = Column(Date, nullable=True)
    calificacion_promedio = Column(Float, nullable=True)
    activo = Column(Boolean, default=True)
    notas = Column(Text, nullable=True)
    creado_en = Column(DateTime(timezone=True), server_default=func.now())

class CalificacionProveedor(Base):
    __tablename__ = "calificaciones_proveedor"
    id = Column(Integer, primary_key=True, index=True)
    proveedor_id = Column(Integer, nullable=False, index=True)
    tenant_id = Column(Integer, nullable=False)
    nota = Column(Integer, nullable=False)  # 1-5
    comentario = Column(Text, nullable=True)
    servicio = Column(String(200), nullable=True)
    creado_en = Column(DateTime(timezone=True), server_default=func.now())
