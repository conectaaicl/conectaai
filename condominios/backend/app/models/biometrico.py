from sqlalchemy import Column, Integer, String, DateTime, Boolean, Float, Text, ForeignKey
from sqlalchemy.sql import func
from app.core.database import Base

class DispositivoBiometrico(Base):
    __tablename__ = "dispositivos_biometricos"
    id = Column(Integer, primary_key=True)
    tenant_id = Column(Integer, nullable=False)
    nombre = Column(String(100))
    tipo = Column(String(50))              # huella / rfid / dual
    ubicacion = Column(String(200))
    device_id = Column(String(100), unique=True)  # hardware identifier
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime, default=func.now())

class HuellaDigital(Base):
    __tablename__ = "huellas_digitales"
    id = Column(Integer, primary_key=True)
    tenant_id = Column(Integer, nullable=False)
    empleado_id = Column(Integer, nullable=False)
    empleado_nombre = Column(String(200))
    dedo = Column(String(30), default="indice_der")
    template_hash = Column(String(500))
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime, default=func.now())

class RegistroBiometrico(Base):
    __tablename__ = "registros_biometricos"
    id = Column(Integer, primary_key=True)
    tenant_id = Column(Integer, nullable=False)
    empleado_id = Column(Integer, nullable=True)
    empleado_nombre = Column(String(200))
    dispositivo_id = Column(String(100))
    tipo = Column(String(20))          # entrada / salida / descanso_inicio / descanso_fin
    metodo = Column(String(20))        # huella / rfid / manual
    tarjeta_uid = Column(String(100))  # for RFID events
    verificado = Column(Boolean, default=True)
    observacion = Column(Text)
    fecha_hora = Column(DateTime, default=func.now())
    created_at = Column(DateTime, default=func.now())
