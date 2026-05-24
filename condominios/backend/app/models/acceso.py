from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from app.core.database import Base
import uuid

class VisitaQR(Base):
    __tablename__ = "visitas_qr"
    id = Column(Integer, primary_key=True, index=True)
    condominio_id = Column(Integer, ForeignKey("condominios.id"), nullable=False)
    departamento_id = Column(Integer, ForeignKey("departamentos.id"), nullable=True)
    nombre_visitante = Column(String, nullable=False)
    rut_visitante = Column(String)
    motivo = Column(String, default="visita")
    qr_token = Column(String, unique=True, nullable=False, default=lambda: str(uuid.uuid4()))
    estado = Column(String, default="pendiente")  # pendiente, aprobado, rechazado, expirado, ingresado
    fecha_visita = Column(DateTime, nullable=False)
    hora_entrada = Column(DateTime)
    hora_salida = Column(DateTime)
    notas = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    creado_por = Column(Integer)  # persona_id quien invita
