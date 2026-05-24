from sqlalchemy import Column, Integer, DateTime, ForeignKey, UniqueConstraint, String
from sqlalchemy.sql import func
from app.core.database import Base

class AvisoLectura(Base):
    __tablename__ = "aviso_lecturas"
    id = Column(Integer, primary_key=True, index=True)
    aviso_id = Column(Integer, ForeignKey("avisos.id"), nullable=False)
    persona_id = Column(Integer, nullable=True)
    residente_rut = Column(String(20), nullable=True)
    fecha_lectura = Column(DateTime(timezone=True), server_default=func.now())
    __table_args__ = (UniqueConstraint('aviso_id', 'residente_rut', name='uq_aviso_residente'),)
