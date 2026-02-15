from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc, and_, or_
from typing import List, Optional
from datetime import datetime

from app.core.database import get_db
from app.models.whatsapp360 import Conversacion, Mensaje, Lead, Integracion, PlantillaMensaje
from app.schemas.whatsapp360 import (
    ConversacionCreate, ConversacionUpdate, ConversacionResponse,
    MensajeCreate, MensajeResponse,
    LeadCreate, LeadUpdate, LeadResponse,
    IntegracionCreate, IntegracionResponse,
    PlantillaCreate, PlantillaResponse
)

router = APIRouter(prefix="/api/whatsapp360", tags=["WhatsApp 360"])

# ============================================
# CONVERSACIONES
# ============================================

@router.post("/conversaciones", response_model=ConversacionResponse)
def crear_conversacion(conversacion: ConversacionCreate, db: Session = Depends(get_db)):
    """Crear nueva conversación"""
    nueva_conversacion = Conversacion(**conversacion.dict())
    db.add(nueva_conversacion)
    db.commit()
    db.refresh(nueva_conversacion)
    return nueva_conversacion


@router.get("/conversaciones", response_model=List[ConversacionResponse])
def listar_conversaciones(
    tenant_id: int = Query(1),
    estado: Optional[str] = None,
    canal: Optional[str] = None,
    asignado_a: Optional[int] = None,
    limit: int = Query(50, le=100),
    db: Session = Depends(get_db)
):
    """Listar conversaciones con filtros"""
    query = db.query(Conversacion).filter(Conversacion.tenant_id == tenant_id)
    
    if estado:
        query = query.filter(Conversacion.estado == estado)
    if canal:
        query = query.filter(Conversacion.canal == canal)
    if asignado_a:
        query = query.filter(Conversacion.asignado_a == asignado_a)
    
    conversaciones = query.order_by(desc(Conversacion.ultima_interaccion)).limit(limit).all()
    return conversaciones


@router.get("/conversaciones/{conversacion_id}", response_model=ConversacionResponse)
def obtener_conversacion(conversacion_id: int, db: Session = Depends(get_db)):
    """Obtener conversación por ID"""
    conversacion = db.query(Conversacion).filter(Conversacion.id == conversacion_id).first()
    if not conversacion:
        raise HTTPException(status_code=404, detail="Conversación no encontrada")
    return conversacion


@router.patch("/conversaciones/{conversacion_id}", response_model=ConversacionResponse)
def actualizar_conversacion(
    conversacion_id: int, 
    datos: ConversacionUpdate, 
    db: Session = Depends(get_db)
):
    """Actualizar conversación"""
    conversacion = db.query(Conversacion).filter(Conversacion.id == conversacion_id).first()
    if not conversacion:
        raise HTTPException(status_code=404, detail="Conversación no encontrada")
    
    for campo, valor in datos.dict(exclude_unset=True).items():
        setattr(conversacion, campo, valor)
    
    conversacion.updated_at = datetime.now()
    db.commit()
    db.refresh(conversacion)
    return conversacion


# ============================================
# MENSAJES
# ============================================

@router.post("/mensajes", response_model=MensajeResponse)
def crear_mensaje(mensaje: MensajeCreate, db: Session = Depends(get_db)):
    """Crear nuevo mensaje"""
    # Verificar que la conversación existe
    conversacion = db.query(Conversacion).filter(Conversacion.id == mensaje.conversacion_id).first()
    if not conversacion:
        raise HTTPException(status_code=404, detail="Conversación no encontrada")
    
    nuevo_mensaje = Mensaje(**mensaje.dict())
    db.add(nuevo_mensaje)
    
    # Actualizar última interacción de la conversación
    conversacion.ultima_interaccion = datetime.now()
    
    db.commit()
    db.refresh(nuevo_mensaje)
    return nuevo_mensaje


@router.get("/mensajes/{conversacion_id}", response_model=List[MensajeResponse])
def listar_mensajes(
    conversacion_id: int,
    limit: int = Query(100, le=500),
    db: Session = Depends(get_db)
):
    """Listar mensajes de una conversación"""
    mensajes = db.query(Mensaje).filter(
        Mensaje.conversacion_id == conversacion_id
    ).order_by(Mensaje.created_at).limit(limit).all()
    
    return mensajes


@router.patch("/mensajes/{mensaje_id}/leer")
def marcar_leido(mensaje_id: int, db: Session = Depends(get_db)):
    """Marcar mensaje como leído"""
    mensaje = db.query(Mensaje).filter(Mensaje.id == mensaje_id).first()
    if not mensaje:
        raise HTTPException(status_code=404, detail="Mensaje no encontrado")
    
    mensaje.leido = True
    db.commit()
    return {"success": True}


# ============================================
# LEADS
# ============================================

@router.post("/leads", response_model=LeadResponse)
def crear_lead(lead: LeadCreate, db: Session = Depends(get_db)):
    """Crear nuevo lead"""
    nuevo_lead = Lead(**lead.dict())
    db.add(nuevo_lead)
    db.commit()
    db.refresh(nuevo_lead)
    return nuevo_lead


@router.get("/leads", response_model=List[LeadResponse])
def listar_leads(
    tenant_id: int = Query(1),
    estado: Optional[str] = None,
    temperatura: Optional[str] = None,
    asignado_a: Optional[int] = None,
    limit: int = Query(50, le=100),
    db: Session = Depends(get_db)
):
    """Listar leads con filtros"""
    query = db.query(Lead).filter(Lead.tenant_id == tenant_id)
    
    if estado:
        query = query.filter(Lead.estado == estado)
    if temperatura:
        query = query.filter(Lead.temperatura == temperatura)
    if asignado_a:
        query = query.filter(Lead.asignado_a == asignado_a)
    
    leads = query.order_by(desc(Lead.created_at)).limit(limit).all()
    return leads


@router.get("/leads/{lead_id}", response_model=LeadResponse)
def obtener_lead(lead_id: int, db: Session = Depends(get_db)):
    """Obtener lead por ID"""
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead no encontrado")
    return lead


@router.patch("/leads/{lead_id}", response_model=LeadResponse)
def actualizar_lead(lead_id: int, datos: LeadUpdate, db: Session = Depends(get_db)):
    """Actualizar lead"""
    lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead no encontrado")
    
    for campo, valor in datos.dict(exclude_unset=True).items():
        setattr(lead, campo, valor)
    
    lead.updated_at = datetime.now()
    db.commit()
    db.refresh(lead)
    return lead


# ============================================
# INTEGRACIONES
# ============================================

@router.post("/integraciones", response_model=IntegracionResponse)
def crear_integracion(integracion: IntegracionCreate, db: Session = Depends(get_db)):
    """Crear nueva integración"""
    nueva_integracion = Integracion(**integracion.dict())
    db.add(nueva_integracion)
    db.commit()
    db.refresh(nueva_integracion)
    return nueva_integracion


@router.get("/integraciones", response_model=List[IntegracionResponse])
def listar_integraciones(tenant_id: int = Query(1), db: Session = Depends(get_db)):
    """Listar integraciones del tenant"""
    integraciones = db.query(Integracion).filter(
        Integracion.tenant_id == tenant_id
    ).all()
    return integraciones


# ============================================
# PLANTILLAS
# ============================================

@router.post("/plantillas", response_model=PlantillaResponse)
def crear_plantilla(plantilla: PlantillaCreate, db: Session = Depends(get_db)):
    """Crear plantilla de mensaje"""
    nueva_plantilla = PlantillaMensaje(**plantilla.dict())
    db.add(nueva_plantilla)
    db.commit()
    db.refresh(nueva_plantilla)
    return nueva_plantilla


@router.get("/plantillas", response_model=List[PlantillaResponse])
def listar_plantillas(
    tenant_id: int = Query(1),
    categoria: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Listar plantillas"""
    query = db.query(PlantillaMensaje).filter(PlantillaMensaje.tenant_id == tenant_id)
    
    if categoria:
        query = query.filter(PlantillaMensaje.categoria == categoria)
    
    plantillas = query.filter(PlantillaMensaje.activa == True).all()
    return plantillas


# ============================================
# ESTADÍSTICAS
# ============================================

@router.get("/stats")
def obtener_estadisticas(tenant_id: int = Query(1), db: Session = Depends(get_db)):
    """Obtener estadísticas del WhatsApp 360"""
    
    # Conversaciones
    total_conversaciones = db.query(Conversacion).filter(Conversacion.tenant_id == tenant_id).count()
    conversaciones_activas = db.query(Conversacion).filter(
        and_(Conversacion.tenant_id == tenant_id, Conversacion.estado == 'activa')
    ).count()
    
    # Leads
    total_leads = db.query(Lead).filter(Lead.tenant_id == tenant_id).count()
    leads_calientes = db.query(Lead).filter(
        and_(Lead.tenant_id == tenant_id, Lead.temperatura == 'caliente')
    ).count()
    leads_ganados = db.query(Lead).filter(
        and_(Lead.tenant_id == tenant_id, Lead.estado == 'ganado')
    ).count()
    
    # Mensajes
    total_mensajes = db.query(Mensaje).join(Conversacion).filter(
        Conversacion.tenant_id == tenant_id
    ).count()
    
    return {
        "conversaciones": {
            "total": total_conversaciones,
            "activas": conversaciones_activas
        },
        "leads": {
            "total": total_leads,
            "calientes": leads_calientes,
            "ganados": leads_ganados
        },
        "mensajes": {
            "total": total_mensajes
        }
    }
