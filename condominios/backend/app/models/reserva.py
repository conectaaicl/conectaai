from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Numeric
from sqlalchemy.sql import func
from app.core.database import Base

class EspacioComun(Base):
    __tablename__ = "espacios_comunes"
    id = Column(Integer, primary_key=True, index=True)
    condominio_id = Column(Integer, ForeignKey("condominios.id"))
    nombre = Column(String, nullable=False)  # "Quincho", "Sala de Eventos", "Piscina", "Cancha"
    descripcion = Column(Text)
    capacidad = Column(Integer, default=0)
    precio_hora = Column(Numeric(10,2), default=0)
    requiere_pago = Column(String, default="no")  # si, no
    horario_inicio = Column(String, default="08:00")
    horario_fin = Column(String, default="22:00")
    activo = Column(String, default="si")

class Reserva(Base):
    __tablename__ = "reservas"
    id = Column(Integer, primary_key=True, index=True)
    espacio_id = Column(Integer, ForeignKey("espacios_comunes.id"))
    departamento_id = Column(Integer, ForeignKey("departamentos.id"), nullable=True)
    persona_id = Column(Integer, ForeignKey("personas.id"), nullable=True)
    fecha_inicio = Column(DateTime, nullable=False)
    fecha_fin = Column(DateTime, nullable=False)
    estado = Column(String, default="pendiente")  # pendiente, confirmada, cancelada
    monto_cobrado = Column(Numeric(10,2), default=0)
    notas = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
