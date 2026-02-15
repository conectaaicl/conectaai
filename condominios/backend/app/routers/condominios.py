from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.models.condominio import Condominio
from app.models.estructura import Torre, Piso, Departamento  # ✅ CORREGIDO
from app.schemas.estructura import (
    CondominioCreate,
    CondominioUpdate,
    CondominioResponse,
    TorreCreate,
    TorreResponse,
    DepartamentoCreate,
    DepartamentoResponse,
    DepartamentoUpdate
)

router = APIRouter(prefix="/api/condominios", tags=["condominios"])


# ==========================================
# CONDOMINIOS
# ==========================================

@router.post("/", response_model=CondominioResponse)
def crear_condominio(condominio: CondominioCreate, db: Session = Depends(get_db)):
    """Crear nuevo condominio"""
    # Convertir a dict
    condominio_data = condominio.model_dump()
    
    # ✅ Asegurar tenant_id
    if 'tenant_id' not in condominio_data or condominio_data['tenant_id'] is None:
        condominio_data['tenant_id'] = 1
    
    db_condominio = Condominio(**condominio_data)
    db.add(db_condominio)
    db.commit()
    db.refresh(db_condominio)
    return db_condominio


@router.get("/", response_model=List[CondominioResponse])
def listar_condominios(tenant_id: int = 1, db: Session = Depends(get_db)):
    """Listar todos los condominios del tenant"""
    return db.query(Condominio).filter(Condominio.tenant_id == tenant_id).all()


@router.get("/{condominio_id}", response_model=CondominioResponse)
def obtener_condominio(condominio_id: int, db: Session = Depends(get_db)):
    """Obtener condominio por ID"""
    condominio = db.query(Condominio).filter(Condominio.id == condominio_id).first()
    if not condominio:
        raise HTTPException(status_code=404, detail="Condominio no encontrado")
    return condominio


@router.put("/{condominio_id}", response_model=CondominioResponse)
def actualizar_condominio(
    condominio_id: int,
    condominio: CondominioUpdate,
    db: Session = Depends(get_db)
):
    """Actualizar condominio"""
    db_condominio = db.query(Condominio).filter(Condominio.id == condominio_id).first()
    if not db_condominio:
        raise HTTPException(status_code=404, detail="Condominio no encontrado")
    
    # Actualizar campos
    update_data = condominio.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_condominio, field, value)
    
    db.commit()
    db.refresh(db_condominio)
    return db_condominio


@router.delete("/{condominio_id}")
def eliminar_condominio(condominio_id: int, db: Session = Depends(get_db)):
    """Eliminar condominio"""
    condominio = db.query(Condominio).filter(Condominio.id == condominio_id).first()
    if not condominio:
        raise HTTPException(status_code=404, detail="Condominio no encontrado")
    
    db.delete(condominio)
    db.commit()
    return {"message": "Condominio eliminado exitosamente"}


# ==========================================
# TORRES
# ==========================================

@router.post("/{condominio_id}/torres", response_model=TorreResponse)
def crear_torre(
    condominio_id: int,
    torre: TorreCreate,
    db: Session = Depends(get_db)
):
    """Crear torre con sus pisos automáticamente"""

    # Verificar que el condominio existe
    condominio = db.query(Condominio).filter(Condominio.id == condominio_id).first()
    if not condominio:
        raise HTTPException(status_code=404, detail="Condominio no encontrado")

    # Crear torre
    db_torre = Torre(
        condominio_id=condominio_id,
        nombre=torre.nombre,
        numero_pisos=torre.numero_pisos,
        tenant_id=condominio.tenant_id  # ✅ Heredar tenant_id del condominio
    )
    db.add(db_torre)
    db.commit()
    db.refresh(db_torre)

    # Crear pisos automáticamente
    for i in range(1, torre.numero_pisos + 1):
        piso = Piso(
            torre_id=db_torre.id,
            numero=i,
            tenant_id=condominio.tenant_id  # ✅ Heredar tenant_id
        )
        db.add(piso)

    db.commit()

    return db_torre


@router.get("/{condominio_id}/torres", response_model=List[TorreResponse])
def listar_torres(condominio_id: int, db: Session = Depends(get_db)):
    """Listar torres de un condominio"""
    torres = db.query(Torre).filter(Torre.condominio_id == condominio_id).all()
    return torres


@router.delete("/torres/{torre_id}")
def eliminar_torre(torre_id: int, db: Session = Depends(get_db)):
    """Eliminar torre y todos sus pisos y departamentos"""
    torre = db.query(Torre).filter(Torre.id == torre_id).first()
    if not torre:
        raise HTTPException(status_code=404, detail="Torre no encontrada")
    
    # Eliminar pisos asociados (y departamentos en cascada)
    db.query(Piso).filter(Piso.torre_id == torre_id).delete()
    
    # Eliminar torre
    db.delete(torre)
    db.commit()
    
    return {"message": "Torre eliminada exitosamente"}


# ==========================================
# PISOS
# ==========================================

@router.get("/torres/{torre_id}/pisos")
def listar_pisos(torre_id: int, db: Session = Depends(get_db)):
    """Listar pisos de una torre con sus departamentos"""
    torre = db.query(Torre).filter(Torre.id == torre_id).first()
    if not torre:
        raise HTTPException(status_code=404, detail="Torre no encontrada")
    
    pisos = db.query(Piso).filter(Piso.torre_id == torre_id).order_by(Piso.numero.desc()).all()
    
    # Agregar departamentos a cada piso
    pisos_con_deptos = []
    for piso in pisos:
        deptos = db.query(Departamento).filter(Departamento.piso_id == piso.id).all()
        pisos_con_deptos.append({
            "id": piso.id,
            "numero": piso.numero,
            "torre_id": piso.torre_id,
            "departamentos": [
                {
                    "id": d.id,
                    "numero": d.numero,
                    "propietario_id": d.propietario_id,
                    "residente_id": d.residente_id,
                    "estado": d.estado,
                    "metraje": d.metraje,
                    "dormitorios": d.dormitorios,
                    "banos": d.banos
                }
                for d in deptos
            ]
        })
    
    return {
        "torre": {
            "id": torre.id,
            "nombre": torre.nombre,
            "numero_pisos": torre.numero_pisos,
            "condominio_id": torre.condominio_id
        },
        "pisos": pisos_con_deptos
    }


# ==========================================
# DEPARTAMENTOS
# ==========================================

@router.post("/pisos/{piso_id}/departamentos", response_model=DepartamentoResponse)
def crear_departamento(
    piso_id: int,
    depto: DepartamentoCreate,
    db: Session = Depends(get_db)
):
    """Crear departamento"""
    # Verificar que el piso existe
    piso = db.query(Piso).filter(Piso.id == piso_id).first()
    if not piso:
        raise HTTPException(status_code=404, detail="Piso no encontrado")

    depto_data = depto.model_dump()
    db_depto = Departamento(
        piso_id=piso_id,
        tenant_id=piso.tenant_id,  # ✅ Heredar tenant_id del piso
        **depto_data
    )
    db.add(db_depto)
    db.commit()
    db.refresh(db_depto)
    return db_depto


@router.get("/pisos/{piso_id}/departamentos", response_model=List[DepartamentoResponse])
def listar_departamentos(piso_id: int, db: Session = Depends(get_db)):
    """Listar departamentos de un piso"""
    deptos = db.query(Departamento).filter(Departamento.piso_id == piso_id).all()
    return deptos


@router.put("/departamentos/{depto_id}", response_model=DepartamentoResponse)
def actualizar_departamento(
    depto_id: int,
    depto: DepartamentoUpdate,
    db: Session = Depends(get_db)
):
    """Actualizar departamento"""
    db_depto = db.query(Departamento).filter(Departamento.id == depto_id).first()
    if not db_depto:
        raise HTTPException(status_code=404, detail="Departamento no encontrado")
    
    # Actualizar campos
    update_data = depto.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_depto, field, value)
    
    db.commit()
    db.refresh(db_depto)
    return db_depto


@router.delete("/departamentos/{depto_id}")
def eliminar_departamento(depto_id: int, db: Session = Depends(get_db)):
    """Eliminar departamento"""
    depto = db.query(Departamento).filter(Departamento.id == depto_id).first()
    if not depto:
        raise HTTPException(status_code=404, detail="Departamento no encontrado")
    
    db.delete(depto)
    db.commit()
    return {"message": "Departamento eliminado exitosamente"}
