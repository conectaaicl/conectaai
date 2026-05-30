from sqlalchemy import Column, Integer, String, Numeric, Text, Date, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from sqlalchemy import DateTime
from app.core.database import Base


class Deal(Base):
    __tablename__ = "deals"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    cliente = Column(String(255), nullable=False)
    contacto = Column(String(255))
    email = Column(String(255))
    telefono = Column(String(50))
    origen = Column(String(100), default="manual")
    etapa = Column(String(50), nullable=False, default="prospecto")
    monto = Column(Numeric(15, 2), nullable=False, default=0)
    probabilidad = Column(Integer, nullable=False, default=20)
    notas = Column(Text)
    lead_id = Column(Integer, ForeignKey("leads.id"), nullable=True)
    asignado_a = Column(Integer, ForeignKey("usuarios.id"), nullable=True)
    fecha_cierre_estimada = Column(Date, nullable=True)
    ultimo_contacto = Column(DateTime(timezone=True), server_default=func.now())
    metadata_ = Column("metadata", JSONB, default={})
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Cotizacion(Base):
    __tablename__ = "cotizaciones"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    deal_id = Column(Integer, ForeignKey("deals.id", ondelete="CASCADE"), nullable=True)
    numero = Column(String(50), nullable=False)
    items = Column(JSONB, nullable=False, default=[])
    subtotal = Column(Numeric(15, 2), nullable=False, default=0)
    descuento = Column(Numeric(15, 2), nullable=False, default=0)
    iva = Column(Numeric(15, 2), nullable=False, default=0)
    total = Column(Numeric(15, 2), nullable=False, default=0)
    estado = Column(String(50), nullable=False, default="borrador")
    notas = Column(Text)
    valida_hasta = Column(Date, nullable=True)
    pdf_url = Column(String(500), nullable=True)
    metadata_ = Column("metadata", JSONB, default={})
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
