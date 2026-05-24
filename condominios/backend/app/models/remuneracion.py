from sqlalchemy import Column, Integer, String, DateTime, Float, Text, Boolean, ForeignKey
from sqlalchemy.sql import func
from app.core.database import Base

class LiquidacionSueldo(Base):
    __tablename__ = "liquidaciones_sueldo"
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, nullable=False, index=True)
    persona_id = Column(Integer, ForeignKey("personas.id"), nullable=True)
    condominio_id = Column(Integer, nullable=True)
    # Identificación
    rut_trabajador = Column(String(20), nullable=False)
    nombre_trabajador = Column(String(150), nullable=False)
    cargo = Column(String(100), nullable=True)
    periodo = Column(String(7), nullable=False)  # YYYY-MM
    # Haberes
    sueldo_base = Column(Float, default=0)
    gratificacion = Column(Float, default=0)
    horas_extra = Column(Integer, default=0)
    horas_extra_monto = Column(Float, default=0)
    bono_colacion = Column(Float, default=0)
    bono_movilizacion = Column(Float, default=0)
    otros_haberes = Column(Float, default=0)
    total_haberes = Column(Float, default=0)
    sueldo_imponible = Column(Float, default=0)
    # Descuentos legales
    afp_nombre = Column(String(50), nullable=True)
    afp_tasa = Column(Float, default=10.0)
    afp_monto = Column(Float, default=0)
    salud_tipo = Column(String(20), default="fonasa")  # fonasa/isapre
    salud_nombre = Column(String(50), nullable=True)
    salud_tasa = Column(Float, default=7.0)
    salud_monto = Column(Float, default=0)
    cesantia_trabajador = Column(Float, default=0)
    cesantia_empleador = Column(Float, default=0)
    impuesto_unico = Column(Float, default=0)
    otros_descuentos = Column(Float, default=0)
    total_descuentos = Column(Float, default=0)
    # Resultado
    liquido_pagar = Column(Float, default=0)
    # Estado
    estado = Column(String(30), default="borrador")  # borrador/aprobado/pagado
    observaciones = Column(Text, nullable=True)
    fecha_pago = Column(DateTime(timezone=True), nullable=True)
    creado_en = Column(DateTime(timezone=True), server_default=func.now())
    actualizado_en = Column(DateTime(timezone=True), onupdate=func.now())
