from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text
from sqlalchemy.sql import func
from app.core.database import Base

class Documento(Base):
    __tablename__ = "documentos"
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, nullable=False)
    condominio_id = Column(Integer, nullable=True)
    titulo = Column(String(200), nullable=False)
    descripcion = Column(Text, nullable=True)
    categoria = Column(String(80), default="otro")  # reglamento/acta/contrato/seguro/financiero/otro
    archivo_url = Column(String(500), nullable=False)
    nombre_archivo = Column(String(255), nullable=True)
    tamano_bytes = Column(Integer, nullable=True)
    visible_residentes = Column(Boolean, default=True)
    subido_por = Column(String(150), nullable=True)
    creado_en = Column(DateTime(timezone=True), server_default=func.now())
