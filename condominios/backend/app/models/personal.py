from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Boolean, Text, Date
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from app.core.database import Base

class Turno(Base):
    __tablename__ = "turnos"
    
    id = Column(Integer, primary_key=True, index=True)
    persona_id = Column(Integer, ForeignKey("personas.id", ondelete="CASCADE"), nullable=False)
    
    # Turno
    tipo = Column(String, nullable=False)  # diurno, nocturno, fin_semana
    fecha_inicio = Column(DateTime, nullable=False)
    fecha_fin = Column(DateTime, nullable=False)
    
    # Detalles
    horas_programadas = Column(Float, default=8)
    observaciones = Column(Text, nullable=True)
    estado = Column(String, default="programado")  # programado, cumplido, ausente, reemplazado
    
    created_at = Column(DateTime, server_default=func.now())

class Asistencia(Base):
    __tablename__ = "asistencias"
    
    id = Column(Integer, primary_key=True, index=True)
    persona_id = Column(Integer, ForeignKey("personas.id", ondelete="CASCADE"), nullable=False)
    
    fecha = Column(Date, nullable=False)
    hora_entrada = Column(DateTime, nullable=True)
    hora_salida = Column(DateTime, nullable=True)
    
    # Estado
    estado = Column(String, default="presente")  # presente, ausente, tarde, permiso, licencia
    minutos_tarde = Column(Integer, default=0)
    horas_trabajadas = Column(Float, default=0)
    
    # Ubicación (GPS check-in)
    lat_entrada = Column(Float, nullable=True)
    lng_entrada = Column(Float, nullable=True)
    lat_salida = Column(Float, nullable=True)
    lng_salida = Column(Float, nullable=True)
    
    observaciones = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

class Sueldo(Base):
    __tablename__ = "sueldos"
    
    id = Column(Integer, primary_key=True, index=True)
    persona_id = Column(Integer, ForeignKey("personas.id", ondelete="CASCADE"), nullable=False)
    
    # Período
    mes = Column(Integer, nullable=False)
    anio = Column(Integer, nullable=False)
    
    # Haberes
    sueldo_base = Column(Float, nullable=False)
    horas_extra = Column(Float, default=0)
    bonos = Column(JSONB, default=[])  # [{concepto: "Bono puntualidad", monto: 50000}]
    total_haberes = Column(Float, nullable=False)
    
    # Descuentos
    adelantos = Column(Float, default=0)
    multas = Column(Float, default=0)
    otros_descuentos = Column(JSONB, default=[])  # [{concepto: "Descuento X", monto: 10000}]
    total_descuentos = Column(Float, default=0)
    
    # Líquido
    liquido_pagar = Column(Float, nullable=False)
    
    # Estado
    estado = Column(String, default="pendiente")  # pendiente, pagado
    fecha_pago = Column(DateTime, nullable=True)
    metodo_pago = Column(String, nullable=True)
    comprobante_url = Column(String, nullable=True)
    
    observaciones = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

class Adelanto(Base):
    __tablename__ = "adelantos"
    
    id = Column(Integer, primary_key=True, index=True)
    persona_id = Column(Integer, ForeignKey("personas.id", ondelete="CASCADE"), nullable=False)
    
    monto = Column(Float, nullable=False)
    motivo = Column(Text, nullable=False)
    
    # Estado
    estado = Column(String, default="solicitado")  # solicitado, aprobado, rechazado, pagado
    fecha_solicitud = Column(DateTime, server_default=func.now())
    fecha_aprobacion = Column(DateTime, nullable=True)
    fecha_pago = Column(DateTime, nullable=True)
    
    # Descuento
    descontar_en_mes = Column(Integer, nullable=True)
    descontar_en_anio = Column(Integer, nullable=True)
    descontado = Column(Boolean, default=False)
    
    aprobado_por = Column(String, nullable=True)
    observaciones = Column(Text, nullable=True)

class Evaluacion(Base):
    __tablename__ = "evaluaciones"
    
    id = Column(Integer, primary_key=True, index=True)
    persona_id = Column(Integer, ForeignKey("personas.id", ondelete="CASCADE"), nullable=False)
    
    tipo = Column(String, nullable=False)  # mensual, incidente, felicitacion
    fecha = Column(Date, nullable=False)
    
    # Calificación (1-5)
    puntualidad = Column(Integer, nullable=True)
    desempeno = Column(Integer, nullable=True)
    actitud = Column(Integer, nullable=True)
    presentacion = Column(Integer, nullable=True)
    
    promedio = Column(Float, nullable=True)
    
    # Detalles
    comentarios = Column(Text, nullable=True)
    incidente_descripcion = Column(Text, nullable=True)
    medidas_tomadas = Column(Text, nullable=True)
    
    evaluador = Column(String, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

class Documento(Base):
    __tablename__ = "documentos_personal"
    
    id = Column(Integer, primary_key=True, index=True)
    persona_id = Column(Integer, ForeignKey("personas.id", ondelete="CASCADE"), nullable=False)
    
    tipo = Column(String, nullable=False)  # contrato, liquidacion, certificado, carta_amonestacion
    nombre = Column(String, nullable=False)
    descripcion = Column(Text, nullable=True)
    
    archivo_url = Column(String, nullable=False)
    fecha_emision = Column(Date, nullable=False)
    fecha_vencimiento = Column(Date, nullable=True)
    
    estado = Column(String, default="vigente")  # vigente, vencido, anulado
    created_at = Column(DateTime, server_default=func.now())

class Equipamiento(Base):
    __tablename__ = "equipamiento"
    
    id = Column(Integer, primary_key=True, index=True)
    persona_id = Column(Integer, ForeignKey("personas.id", ondelete="CASCADE"), nullable=False)
    
    tipo = Column(String, nullable=False)  # uniforme, herramienta, equipo_seguridad
    descripcion = Column(String, nullable=False)
    
    fecha_entrega = Column(Date, nullable=False)
    fecha_devolucion = Column(Date, nullable=True)
    
    estado = Column(String, default="entregado")  # entregado, devuelto, perdido, danado
    condicion = Column(String, nullable=True)  # bueno, regular, malo
    
    costo = Column(Float, nullable=True)
    descontar_si_pierde = Column(Boolean, default=True)
    
    observaciones = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

class Vacacion(Base):
    __tablename__ = "vacaciones"
    
    id = Column(Integer, primary_key=True, index=True)
    persona_id = Column(Integer, ForeignKey("personas.id", ondelete="CASCADE"), nullable=False)
    
    fecha_inicio = Column(Date, nullable=False)
    fecha_fin = Column(Date, nullable=False)
    dias_solicitados = Column(Integer, nullable=False)
    
    estado = Column(String, default="solicitado")  # solicitado, aprobado, rechazado, tomado
    fecha_solicitud = Column(DateTime, server_default=func.now())
    fecha_respuesta = Column(DateTime, nullable=True)
    
    motivo_rechazo = Column(Text, nullable=True)
    aprobado_por = Column(String, nullable=True)
    
    created_at = Column(DateTime, server_default=func.now())
