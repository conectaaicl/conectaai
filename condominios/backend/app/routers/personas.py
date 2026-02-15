from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.models.persona import Persona
from app.schemas.persona import PersonaCreate, PersonaUpdate, PersonaResponse

router = APIRouter(prefix="/api/personas", tags=["personas"])


@router.post("/", response_model=PersonaResponse)
def crear_persona(persona: PersonaCreate, db: Session = Depends(get_db)):
    """Crear nueva persona (propietario, residente, conserje, etc)"""
    
    # Verificar RUT único
    existing = db.query(Persona).filter(Persona.rut == persona.rut).first()
    if existing:
        raise HTTPException(status_code=400, detail="RUT ya existe")
    
    # Convertir el schema Pydantic a dict
    persona_data = persona.model_dump()
    
    # Asegurar que tenant_id esté presente (usar 1 por defecto si no viene)
    if 'tenant_id' not in persona_data or persona_data['tenant_id'] is None:
        persona_data['tenant_id'] = 1
    
    # ✅ NUEVO: Crear departamento automáticamente si se proporcionan datos
    datos_contacto = persona_data.get('datos_contacto', {})
    if datos_contacto.get('torre') and datos_contacto.get('piso') and datos_contacto.get('departamento'):
        from app.models.estructura import Torre, Piso, Departamento
        
        torre_nombre = datos_contacto['torre']
        piso_numero = int(datos_contacto['piso'])
        depto_numero = datos_contacto['departamento']
        condominio_id = datos_contacto.get('condominio_id')
        
        if condominio_id:
            # Buscar la torre
            torre = db.query(Torre).filter(
                Torre.condominio_id == int(condominio_id),
                Torre.nombre == torre_nombre
            ).first()
            
            if torre:
                # Buscar el piso
                piso = db.query(Piso).filter(
                    Piso.torre_id == torre.id,
                    Piso.numero == piso_numero
                ).first()
                
                if piso:
                    # Verificar si el departamento ya existe
                    depto_existente = db.query(Departamento).filter(
                        Departamento.piso_id == piso.id,
                        Departamento.numero == depto_numero
                    ).first()
                    
                    if not depto_existente:
                        # Crear el departamento automáticamente
                        nuevo_depto = Departamento(
                            piso_id=piso.id,
                            tenant_id=persona_data['tenant_id'],
                            numero=depto_numero,
                            estado="ocupado"
                        )
                        db.add(nuevo_depto)
                        db.commit()
    
    # Crear la persona
    db_persona = Persona(**persona_data)
    db.add(db_persona)
    db.commit()
    db.refresh(db_persona)
    
    return db_persona


@router.get("/", response_model=List[PersonaResponse])
def listar_personas(
    rol: Optional[str] = None,
    estado: Optional[str] = None,
    tenant_id: int = 1,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """Listar personas con filtros opcionales"""
    query = db.query(Persona)

    # Filtrar por tenant_id
    query = query.filter(Persona.tenant_id == tenant_id)

    if rol:
        # Buscar en array JSON
        query = query.filter(Persona.roles.contains([rol]))

    if estado:
        query = query.filter(Persona.estado == estado)

    personas = query.offset(skip).limit(limit).all()
    return personas


@router.get("/{persona_id}", response_model=PersonaResponse)
def obtener_persona(persona_id: int, db: Session = Depends(get_db)):
    """Obtener persona por ID"""
    persona = db.query(Persona).filter(Persona.id == persona_id).first()
    if not persona:
        raise HTTPException(status_code=404, detail="Persona no encontrada")
    return persona


@router.put("/{persona_id}", response_model=PersonaResponse)
def actualizar_persona(
    persona_id: int,
    persona_update: PersonaUpdate,
    db: Session = Depends(get_db)
):
    """Actualizar persona existente"""
    persona = db.query(Persona).filter(Persona.id == persona_id).first()
    if not persona:
        raise HTTPException(status_code=404, detail="Persona no encontrada")
    
    # Actualizar solo campos proporcionados
    update_data = persona_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(persona, field, value)
    
    db.commit()
    db.refresh(persona)
    return persona


@router.delete("/{persona_id}")
def eliminar_persona(persona_id: int, db: Session = Depends(get_db)):
    """Eliminar persona (soft delete - cambia estado a 'inactivo')"""
    persona = db.query(Persona).filter(Persona.id == persona_id).first()
    if not persona:
        raise HTTPException(status_code=404, detail="Persona no encontrada")
    
    persona.estado = "inactivo"
    db.commit()
    
    return {"message": "Persona eliminada exitosamente"}


@router.post("/{persona_id}/roles")
def agregar_rol(persona_id: int, rol: str, db: Session = Depends(get_db)):
    """Agregar rol a persona"""
    persona = db.query(Persona).filter(Persona.id == persona_id).first()
    if not persona:
        raise HTTPException(status_code=404, detail="Persona no encontrada")

    if rol not in persona.roles:
        persona.roles = persona.roles + [rol]
        db.commit()
        db.refresh(persona)

    return persona


@router.delete("/{persona_id}/roles/{rol}")
def quitar_rol(persona_id: int, rol: str, db: Session = Depends(get_db)):
    """Quitar rol de persona"""
    persona = db.query(Persona).filter(Persona.id == persona_id).first()
    if not persona:
        raise HTTPException(status_code=404, detail="Persona no encontrada")

    if rol in persona.roles:
        persona.roles = [r for r in persona.roles if r != rol]
        db.commit()
        db.refresh(persona)

    return persona
