from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from app.core.database import Base

class Puerta(Base):
    __tablename__ = "puertas"
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey('tenants.id'), nullable=False)
    condominio_id = Column(Integer, ForeignKey('condominios.id'), nullable=True)
    nombre = Column(String, nullable=False)          # "Puerta Principal", "Portón Visitas"
    descripcion = Column(String, nullable=True)
    tipo = Column(String, default="puerta")          # puerta, porton, barrera, ascensor
    ubicacion = Column(String, nullable=True)        # "Entrada Norte", "Estacionamiento B1"
    activa = Column(Boolean, default=True)
    estado = Column(String, default="cerrada")       # cerrada, abierta
    modo = Column(String, default="normal")          # normal, libre_paso, bloqueada
    webhook_url = Column(String, nullable=True)      # URL del controlador hardware (Raspberry, Arduino, etc)
    webhook_secret = Column(String, nullable=True)
    tiempo_apertura_seg = Column(Integer, default=5) # segundos que queda abierta automáticamente
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class RegistroAccesoPuerta(Base):
    __tablename__ = "registros_acceso_puertas"
    id = Column(Integer, primary_key=True, index=True)
    puerta_id = Column(Integer, ForeignKey('puertas.id'), nullable=False)
    tenant_id = Column(Integer, ForeignKey('tenants.id'), nullable=False)
    tipo_evento = Column(String, nullable=False)     # abrir, cerrar, libre_paso, bloquear, acceso_tarjeta, acceso_denegado
    metodo = Column(String, default="manual")        # manual, tarjeta_rfid, app, automatico
    uid_tarjeta = Column(String, nullable=True)      # UID de la tarjeta si fue acceso por RFID
    usuario_id = Column(Integer, ForeignKey('usuarios.id'), nullable=True)
    descripcion = Column(String, nullable=True)
    exitoso = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
