from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from app.core.database import Base


class TarjetaRFID(Base):
    __tablename__ = "tarjetas_rfid"
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey('tenants.id'), nullable=False)
    uid = Column(String, nullable=False, index=True)   # UID hex: "A3:F2:01:CC"
    tipo_tarjeta = Column(String, default="mifare")     # mifare_classic, mifare_desfire, hid, em4100, iso14443a, bip, bancaria, otro
    descripcion = Column(String, nullable=True)         # "Tarjeta de acceso Ana García"
    nombre_titular = Column(String, nullable=True)
    persona_id = Column(Integer, ForeignKey('personas.id'), nullable=True)
    categoria = Column(String, default="residente")     # residente, propietario, visita, personal_admin, personal_aseo, personal_seguridad, proveedor
    activa = Column(Boolean, default=True)
    fecha_vencimiento = Column(DateTime, nullable=True)
    notas = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class PermisoAccesoRFID(Base):
    __tablename__ = "permisos_acceso_rfid"
    id = Column(Integer, primary_key=True, index=True)
    tarjeta_id = Column(Integer, ForeignKey('tarjetas_rfid.id'), nullable=False)
    puerta_id = Column(Integer, ForeignKey('puertas.id'), nullable=False)
    habilitado = Column(Boolean, default=True)
    # horario_json: {"lun":{"inicio":"07:00","fin":"22:00"}, "todos":{"inicio":"00:00","fin":"23:59"}}
    horario_json = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
