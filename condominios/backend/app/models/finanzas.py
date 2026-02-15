from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from app.core.database import Base

class GastoComun(Base):
    __tablename__ = "gastos_comunes"
    
    id = Column(Integer, primary_key=True, index=True)
    departamento_id = Column(Integer, ForeignKey("departamentos.id", ondelete="CASCADE"), nullable=False)
    mes = Column(Integer, nullable=False)
    anio = Column(Integer, nullable=False)
    monto_base = Column(Float, nullable=False)
    multas = Column(Float, default=0)
    intereses = Column(Float, default=0)
    otros_cargos = Column(Float, default=0)
    descuentos = Column(Float, default=0)
    monto_total = Column(Float, nullable=False)
    estado = Column(String, default="pendiente")
    fecha_vencimiento = Column(DateTime, nullable=False)
    fecha_pago = Column(DateTime, nullable=True)
    detalle = Column(JSONB, default={})
    observaciones = Column(Text, nullable=True)
    comprobante_url = Column(String, nullable=True)
    metodo_pago = Column(String, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

class Multa(Base):
    __tablename__ = "multas"
    
    id = Column(Integer, primary_key=True, index=True)
    departamento_id = Column(Integer, ForeignKey("departamentos.id", ondelete="CASCADE"), nullable=False)
    concepto = Column(String, nullable=False)
    monto = Column(Float, nullable=False)
    fecha_aplicacion = Column(DateTime, nullable=False)
    estado = Column(String, default="pendiente")
    observaciones = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

class Pago(Base):
    __tablename__ = "pagos"
    
    id = Column(Integer, primary_key=True, index=True)
    departamento_id = Column(Integer, ForeignKey("departamentos.id", ondelete="CASCADE"), nullable=False)
    gasto_comun_id = Column(Integer, ForeignKey("gastos_comunes.id"), nullable=True)
    monto = Column(Float, nullable=False)
    fecha_pago = Column(DateTime, nullable=False)
    metodo_pago = Column(String, nullable=False)
    comprobante_url = Column(String, nullable=True)
    observaciones = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
