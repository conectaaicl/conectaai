from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.models.condominio import Condominio
from app.models.estructura import Torre, Piso, Departamento, Estacionamiento, Bodega  # ✅ CORREGIDO
from app.models.persona import Persona
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

@router.post("", response_model=CondominioResponse)
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


@router.get("", response_model=List[CondominioResponse])
def listar_condominios(tenant_id: int = 1, db: Session = Depends(get_db)):
    """Listar todos los condominios del tenant"""
    return db.query(Condominio).filter(Condominio.tenant_id == tenant_id).all()


@router.get("/departamentos", response_model=List[DepartamentoResponse])
def listar_todos_departamentos(tenant_id: int = 1, db: Session = Depends(get_db)):
    """Listar todos los departamentos de un tenant (para selects y resúmenes)"""
    return db.query(Departamento).filter(Departamento.tenant_id == tenant_id).order_by(Departamento.numero).all()


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




@router.get("/{condominio_id}/resumen")
def get_condominio_resumen(condominio_id: int, tenant_id: int = 1, db: Session = Depends(get_db)):
    """Obtener resumen del condominio"""
    c = db.query(Condominio).filter(Condominio.id == condominio_id, Condominio.tenant_id == tenant_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Condominio no encontrado")
    torres = db.query(Torre).filter(Torre.condominio_id == condominio_id).all()
    torre_ids = [t.id for t in torres]
    piso_ids = [p.id for p in db.query(Piso).filter(Piso.torre_id.in_(torre_ids)).all()] if torre_ids else []
    deptos = db.query(Departamento).filter(Departamento.piso_id.in_(piso_ids)).count() if piso_ids else 0
    estac = db.query(Estacionamiento).filter(Estacionamiento.condominio_id == condominio_id).count()
    bodegas = db.query(Bodega).filter(Bodega.condominio_id == condominio_id).count()
    personas = db.query(Persona).filter(Persona.tenant_id == tenant_id, Persona.estado == "activo").count()
    cond_dict = {col.name: getattr(c, col.name) for col in c.__table__.columns}
    for k, v in cond_dict.items():
        if hasattr(v, "isoformat"):
            cond_dict[k] = v.isoformat()
    return {
        "condominio": cond_dict,
        "stats": {
            "torres": len(torres),
            "pisos": len(piso_ids),
            "departamentos": deptos,
            "estacionamientos": estac,
            "bodegas": bodegas,
            "residentes_activos": personas
        }
    }


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



import os
import uuid
from fastapi import UploadFile, File as FastFile

LOGO_DIR = "/var/www/conectaai/condominios/uploads/logos"
os.makedirs(LOGO_DIR, exist_ok=True)

@router.post("/{condominio_id}/upload-logo")
async def upload_condominio_logo(condominio_id: int, file: UploadFile = FastFile(...), db: Session = Depends(get_db)):
    """Subir logo para un condominio"""
    condominio = db.query(Condominio).filter(Condominio.id == condominio_id).first()
    if not condominio:
        raise HTTPException(status_code=404, detail="Condominio no encontrado")

    ext = os.path.splitext(file.filename or "logo.png")[1].lower()
    if ext not in [".png", ".jpg", ".jpeg", ".webp"]:
        raise HTTPException(status_code=400, detail="Solo se aceptan PNG, JPG o WebP")

    filename = f"cond_{condominio_id}_{uuid.uuid4().hex[:8]}{ext}"
    path = os.path.join(LOGO_DIR, filename)

    content = await file.read()
    with open(path, "wb") as f:
        f.write(content)

    logo_url = f"/uploads/logos/{filename}"
    condominio.logo_url = logo_url
    db.commit()

    return {"url": logo_url, "condominio_id": condominio_id}
