from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, extract
from typing import List, Optional
from datetime import datetime, date, timedelta
from app.core.database import get_db
from app.models.personal import Turno, Asistencia, Sueldo, Adelanto, Evaluacion, Equipamiento, Vacacion
from app.models.persona import Persona
from app.schemas.personal import *

router = APIRouter(prefix="/api/personal", tags=["Personal"])

# ============ TURNOS ============
@router.post("/turnos", response_model=TurnoResponse)
def crear_turno(turno: TurnoCreate, db: Session = Depends(get_db)):
    """Crear nuevo turno"""
    db_turno = Turno(**turno.model_dump())
    db.add(db_turno)
    db.commit()
    db.refresh(db_turno)
    return db_turno

@router.get("/turnos", response_model=List[TurnoResponse])
def listar_turnos(
    persona_id: Optional[int] = None,
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    db: Session = Depends(get_db)
):
    """Listar turnos con filtros"""
    query = db.query(Turno)
    
    if persona_id:
        query = query.filter(Turno.persona_id == persona_id)
    if fecha_desde:
        query = query.filter(Turno.fecha_inicio >= fecha_desde)
    if fecha_hasta:
        query = query.filter(Turno.fecha_fin <= fecha_hasta)
    
    return query.order_by(Turno.fecha_inicio.desc()).all()

# ============ ASISTENCIAS ============
@router.post("/asistencias/check-in")
def registrar_entrada(
    persona_id: int,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    db: Session = Depends(get_db)
):
    """Registrar entrada (check-in)"""
    hoy = date.today()
    asistencia = db.query(Asistencia).filter(
        and_(Asistencia.persona_id == persona_id, Asistencia.fecha == hoy)
    ).first()
    
    ahora = datetime.now()
    
    if asistencia:
        asistencia.hora_entrada = ahora
        asistencia.lat_entrada = lat
        asistencia.lng_entrada = lng
    else:
        asistencia = Asistencia(
            persona_id=persona_id,
            fecha=hoy,
            hora_entrada=ahora,
            lat_entrada=lat,
            lng_entrada=lng
        )
        db.add(asistencia)
    
    # Calcular si llegó tarde (suponiendo que debe entrar a las 8:00 AM)
    hora_limite = datetime.combine(hoy, datetime.min.time()).replace(hour=8)
    if ahora > hora_limite:
        minutos_tarde = int((ahora - hora_limite).total_seconds() / 60)
        asistencia.minutos_tarde = minutos_tarde
        asistencia.estado = "tarde"
    
    db.commit()
    db.refresh(asistencia)
    return asistencia

@router.post("/asistencias/check-out")
def registrar_salida(
    persona_id: int,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    db: Session = Depends(get_db)
):
    """Registrar salida (check-out)"""
    hoy = date.today()
    asistencia = db.query(Asistencia).filter(
        and_(Asistencia.persona_id == persona_id, Asistencia.fecha == hoy)
    ).first()
    
    if not asistencia:
        raise HTTPException(status_code=404, detail="No se encontró entrada registrada")
    
    ahora = datetime.now()
    asistencia.hora_salida = ahora
    asistencia.lat_salida = lat
    asistencia.lng_salida = lng
    
    # Calcular horas trabajadas
    if asistencia.hora_entrada:
        delta = ahora - asistencia.hora_entrada
        asistencia.horas_trabajadas = delta.total_seconds() / 3600
    
    db.commit()
    db.refresh(asistencia)
    return asistencia

@router.get("/asistencias", response_model=List[AsistenciaResponse])
def listar_asistencias(
    persona_id: Optional[int] = None,
    fecha_desde: Optional[date] = None,
    fecha_hasta: Optional[date] = None,
    db: Session = Depends(get_db)
):
    """Listar asistencias"""
    query = db.query(Asistencia)
    
    if persona_id:
        query = query.filter(Asistencia.persona_id == persona_id)
    if fecha_desde:
        query = query.filter(Asistencia.fecha >= fecha_desde)
    if fecha_hasta:
        query = query.filter(Asistencia.fecha <= fecha_hasta)
    
    return query.order_by(Asistencia.fecha.desc()).all()

# ============ SUELDOS ============
@router.post("/sueldos", response_model=SueldoResponse)
def crear_sueldo(sueldo: SueldoCreate, db: Session = Depends(get_db)):
    """Generar liquidación de sueldo"""
    
    # Calcular totales
    total_bonos = sum(b['monto'] for b in sueldo.bonos) if sueldo.bonos else 0
    total_haberes = sueldo.sueldo_base + sueldo.horas_extra + total_bonos
    
    total_otros_desc = sum(d['monto'] for d in sueldo.otros_descuentos) if sueldo.otros_descuentos else 0
    total_descuentos = sueldo.adelantos + sueldo.multas + total_otros_desc
    
    liquido = total_haberes - total_descuentos
    
    db_sueldo = Sueldo(
        **sueldo.model_dump(),
        total_haberes=total_haberes,
        total_descuentos=total_descuentos,
        liquido_pagar=liquido
    )
    
    db.add(db_sueldo)
    db.commit()
    db.refresh(db_sueldo)
    
    return db_sueldo

@router.get("/sueldos", response_model=List[SueldoResponse])
def listar_sueldos(
    persona_id: Optional[int] = None,
    mes: Optional[int] = None,
    anio: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Listar sueldos"""
    query = db.query(Sueldo)
    
    if persona_id:
        query = query.filter(Sueldo.persona_id == persona_id)
    if mes:
        query = query.filter(Sueldo.mes == mes)
    if anio:
        query = query.filter(Sueldo.anio == anio)
    
    return query.order_by(Sueldo.created_at.desc()).all()

@router.post("/sueldos/{sueldo_id}/pagar")
def pagar_sueldo(sueldo_id: int, metodo_pago: str, db: Session = Depends(get_db)):
    """Marcar sueldo como pagado"""
    sueldo = db.query(Sueldo).filter(Sueldo.id == sueldo_id).first()
    if not sueldo:
        raise HTTPException(status_code=404, detail="Sueldo no encontrado")
    
    sueldo.estado = "pagado"
    sueldo.fecha_pago = datetime.now()
    sueldo.metodo_pago = metodo_pago
    
    db.commit()
    return {"message": "Sueldo marcado como pagado"}

# ============ ADELANTOS ============
@router.post("/adelantos", response_model=AdelantoResponse)
def solicitar_adelanto(adelanto: AdelantoCreate, db: Session = Depends(get_db)):
    """Solicitar adelanto"""
    db_adelanto = Adelanto(**adelanto.model_dump())
    db.add(db_adelanto)
    db.commit()
    db.refresh(db_adelanto)
    return db_adelanto

@router.post("/adelantos/{adelanto_id}/aprobar")
def aprobar_adelanto(adelanto_id: int, aprobador: str, db: Session = Depends(get_db)):
    """Aprobar adelanto"""
    adelanto = db.query(Adelanto).filter(Adelanto.id == adelanto_id).first()
    if not adelanto:
        raise HTTPException(status_code=404, detail="Adelanto no encontrado")
    
    adelanto.estado = "aprobado"
    adelanto.fecha_aprobacion = datetime.now()
    adelanto.aprobado_por = aprobador
    
    # Auto-asignar mes de descuento (próximo mes)
    hoy = date.today()
    if hoy.month == 12:
        adelanto.descontar_en_mes = 1
        adelanto.descontar_en_anio = hoy.year + 1
    else:
        adelanto.descontar_en_mes = hoy.month + 1
        adelanto.descontar_en_anio = hoy.year
    
    db.commit()
    return {"message": "Adelanto aprobado"}

@router.get("/adelantos", response_model=List[AdelantoResponse])
def listar_adelantos(
    persona_id: Optional[int] = None,
    estado: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Listar adelantos"""
    query = db.query(Adelanto)
    
    if persona_id:
        query = query.filter(Adelanto.persona_id == persona_id)
    if estado:
        query = query.filter(Adelanto.estado == estado)
    
    return query.order_by(Adelanto.fecha_solicitud.desc()).all()

# ============ EVALUACIONES ============
@router.post("/evaluaciones", response_model=EvaluacionResponse)
def crear_evaluacion(evaluacion: EvaluacionCreate, db: Session = Depends(get_db)):
    """Crear evaluación"""
    
    # Calcular promedio si tiene calificaciones
    calificaciones = [
        evaluacion.puntualidad,
        evaluacion.desempeno,
        evaluacion.actitud,
        evaluacion.presentacion
    ]
    califs_validas = [c for c in calificaciones if c is not None]
    
    promedio = sum(califs_validas) / len(califs_validas) if califs_validas else None
    
    db_eval = Evaluacion(
        **evaluacion.model_dump(),
        promedio=promedio
    )
    
    db.add(db_eval)
    db.commit()
    db.refresh(db_eval)
    
    return db_eval

@router.get("/evaluaciones", response_model=List[EvaluacionResponse])
def listar_evaluaciones(
    persona_id: Optional[int] = None,
    tipo: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Listar evaluaciones"""
    query = db.query(Evaluacion)
    
    if persona_id:
        query = query.filter(Evaluacion.persona_id == persona_id)
    if tipo:
        query = query.filter(Evaluacion.tipo == tipo)
    
    return query.order_by(Evaluacion.fecha.desc()).all()

# ============ EQUIPAMIENTO ============
@router.post("/equipamiento", response_model=EquipamientoResponse)
def registrar_equipamiento(equip: EquipamientoCreate, db: Session = Depends(get_db)):
    """Registrar entrega de equipamiento"""
    db_equip = Equipamiento(**equip.model_dump())
    db.add(db_equip)
    db.commit()
    db.refresh(db_equip)
    return db_equip

@router.get("/equipamiento", response_model=List[EquipamientoResponse])
def listar_equipamiento(
    persona_id: Optional[int] = None,
    estado: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Listar equipamiento"""
    query = db.query(Equipamiento)
    
    if persona_id:
        query = query.filter(Equipamiento.persona_id == persona_id)
    if estado:
        query = query.filter(Equipamiento.estado == estado)
    
    return query.all()

# ============ REPORTES ============
@router.get("/reportes/resumen-mensual")
def resumen_mensual(mes: int, anio: int, db: Session = Depends(get_db)):
    """Resumen mensual de personal"""
    
    # Total en sueldos
    total_sueldos = db.query(func.sum(Sueldo.liquido_pagar)).filter(
        and_(Sueldo.mes == mes, Sueldo.anio == anio)
    ).scalar() or 0
    
    # Adelantos del mes
    total_adelantos = db.query(func.sum(Adelanto.monto)).filter(
        and_(
            Adelanto.estado == "aprobado",
            extract('month', Adelanto.fecha_aprobacion) == mes,
            extract('year', Adelanto.fecha_aprobacion) == anio
        )
    ).scalar() or 0
    
    # Asistencias
    total_asistencias = db.query(Asistencia).filter(
        and_(
            extract('month', Asistencia.fecha) == mes,
            extract('year', Asistencia.fecha) == anio
        )
    ).count()
    
    tardanzas = db.query(Asistencia).filter(
        and_(
            extract('month', Asistencia.fecha) == mes,
            extract('year', Asistencia.fecha) == anio,
            Asistencia.estado == "tarde"
        )
    ).count()
    
    ausencias = db.query(Asistencia).filter(
        and_(
            extract('month', Asistencia.fecha) == mes,
            extract('year', Asistencia.fecha) == anio,
            Asistencia.estado == "ausente"
        )
    ).count()
    
    return {
        "mes": mes,
        "anio": anio,
        "total_sueldos": float(total_sueldos),
        "total_adelantos": float(total_adelantos),
        "total_asistencias": total_asistencias,
        "tardanzas": tardanzas,
        "ausencias": ausencias,
        "puntualidad_porcentaje": round(((total_asistencias - tardanzas) / total_asistencias * 100) if total_asistencias > 0 else 0, 2)
    }

@router.get("/reportes/personal-activo")
def personal_activo(db: Session = Depends(get_db)):
    """Lista de personal activo con estadísticas"""
    
    # Obtener todas las personas activas
    personas_activas = db.query(Persona).filter(Persona.estado == "activo").all()
    
    # Roles que consideramos "personal"
    ROLES_PERSONAL = ['conserje', 'aseo', 'mantencion', 'administrador']
    
    # Filtrar personas que tengan al menos un rol de personal
    personal = [p for p in personas_activas if any(rol in ROLES_PERSONAL for rol in (p.roles or []))]
    
    resultado = []
    hoy = date.today()
    
    for p in personal:
        # Asistencias del mes actual
        asistencias_mes = db.query(Asistencia).filter(
            and_(
                Asistencia.persona_id == p.id,
                extract('month', Asistencia.fecha) == hoy.month,
                extract('year', Asistencia.fecha) == hoy.year
            )
        ).count()
        
        # Adelantos pendientes
        adelantos_pendientes = db.query(func.sum(Adelanto.monto)).filter(
            and_(
                Adelanto.persona_id == p.id,
                Adelanto.estado == "aprobado",
                Adelanto.descontado == False
            )
        ).scalar() or 0
        
        # Evaluación promedio
        eval_promedio = db.query(func.avg(Evaluacion.promedio)).filter(
            Evaluacion.persona_id == p.id
        ).scalar()
        
        resultado.append({
            "id": p.id,
            "nombre": p.nombre_completo,
            "rut": p.rut,
            "roles": p.roles,
            "asistencias_mes": asistencias_mes,
            "adelantos_pendientes": float(adelantos_pendientes),
            "evaluacion_promedio": round(float(eval_promedio), 2) if eval_promedio else None
        })
    
    return resultado
