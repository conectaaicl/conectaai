from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.sql import func
from app.core.database import Base

class Votacion(Base):
    __tablename__ = "votaciones"
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    condominio_id = Column(Integer, ForeignKey("condominios.id"), nullable=True)
    titulo = Column(String, nullable=False)
    descripcion = Column(Text)
    opciones = Column(Text)  # JSON string: ["A favor", "En contra", "Abstención"]
    estado = Column(String, default="activa")  # activa, cerrada
    fecha_inicio = Column(DateTime, nullable=False)
    fecha_fin = Column(DateTime, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class VotoRespuesta(Base):
    __tablename__ = "voto_respuestas"
    id = Column(Integer, primary_key=True, index=True)
    votacion_id = Column(Integer, ForeignKey("votaciones.id"), nullable=False)
    departamento_id = Column(Integer, ForeignKey("departamentos.id"), nullable=True)
    persona_id = Column(Integer, ForeignKey("personas.id"), nullable=True)
    opcion_elegida = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
