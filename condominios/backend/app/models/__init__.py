from app.models.tenant import Tenant
from app.models.usuario import Usuario
from app.models.condominio import Condominio
from app.models.estructura import Torre, Piso, Departamento, Estacionamiento, Bodega
from app.models.persona import Persona
from app.models.finanzas import GastoComun, Multa, Pago
from app.models.personal import Turno, Asistencia, Sueldo, Adelanto, Evaluacion, Documento, Equipamiento, Vacacion
from app.models.whatsapp360 import Conversacion, Mensaje, Lead, Integracion, PlantillaMensaje, Automatizacion
from app.models.aviso import Aviso
from app.models.reserva import EspacioComun, Reserva
from app.models.acceso import VisitaQR
from app.models.incidencia import Incidencia
from app.models.votacion import Votacion, VotoRespuesta
from app.models.puerta import Puerta, RegistroAccesoPuerta
from app.models.rfid import TarjetaRFID, PermisoAccesoRFID
from .paquete import Paquete
from .orden_trabajo import OrdenTrabajo
from .documento import Documento
from .aviso_lectura import AvisoLectura

from sqlalchemy import Column, Integer, String, Text
from app.core.database import Base as _Base

class SistemaConfig(_Base):
    __tablename__ = "sistema_config"
    id = Column(Integer, primary_key=True)
    tenant_id = Column(Integer, nullable=False)
    clave = Column(String(100), nullable=False)
    valor = Column(Text, nullable=True)

from .historial import HistorialEvento
from .residente_portal import ResidentePortal
from .remuneracion import LiquidacionSueldo
from .asamblea import Asamblea, ParticipanteAsamblea
from .proveedor import Proveedor, CalificacionProveedor

from .biometrico import DispositivoBiometrico, HuellaDigital, RegistroBiometrico
