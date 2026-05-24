from sqlalchemy import Column, Integer, String, DateTime, Float, Text, Boolean, ForeignKey
from sqlalchemy.sql import func
from app.core.database import Base

class Asamblea(Base):
    __tablename__ = "asambleas"
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, nullable=False, index=True)
    condominio_id = Column(Integer, nullable=True)
    titulo = Column(String(200), nullable=False)
    descripcion = Column(Text, nullable=True)
    tipo = Column(String(30), default="ordinaria")  # ordinaria/extraordinaria/emergencia
    fecha_programada = Column(DateTime(timezone=True), nullable=True)
    fecha_realizada = Column(DateTime(timezone=True), nullable=True)
    quorum_requerido_pct = Column(Float, default=50.0)
    quorum_alcanzado_pct = Column(Float, nullable=True)
    total_unidades = Column(Integer, default=0)
    unidades_presentes = Column(Integer, default=0)
    estado = Column(String(30), default="programada")  # programada/en_curso/realizada/cancelada
    link_videoconferencia = Column(String(500), nullable=True)
    acta_url = Column(String(500), nullable=True)
    acta_aprobada = Column(Boolean, default=False)
    creado_en = Column(DateTime(timezone=True), server_default=func.now())

class ParticipanteAsamblea(Base):
    __tablename__ = "participantes_asamblea"
    id = Column(Integer, primary_key=True, index=True)
    asamblea_id = Column(Integer, ForeignKey("asambleas.id"), nullable=False)
    departamento_id = Column(Integer, nullable=True)
    nombre = Column(String(150), nullable=False)
    rut = Column(String(20), nullable=True)
    tipo = Column(String(30), default="propietario")  # propietario/arrendatario/poder
    metodo = Column(String(20), default="presencial")  # presencial/online/poder
    poder_otorgado_por = Column(String(150), nullable=True)
    rut_poderdante = Column(String(20), nullable=True)
    hora_ingreso = Column(DateTime(timezone=True), server_default=func.now())
    confirmado = Column(Boolean, default=True)
