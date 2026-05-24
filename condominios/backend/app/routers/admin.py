from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.routers.auth import get_current_user
from app.models.tenant import Tenant
from app.schemas.tenant import TenantCreate, TenantUpdate, TenantResponse, TenantConfig
import shutil
import os
from pathlib import Path

router = APIRouter(prefix="/api/admin/tenants", tags=["Admin - Tenants"])

UPLOAD_DIR = Path("/opt/conectaai/uploads/tenants")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# ============ CRUD TENANTS ============

@router.post("", response_model=TenantResponse)
def crear_tenant(tenant: TenantCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    if current_user.get('role') not in ('superadmin', 'admin'):
        raise HTTPException(status_code=403, detail='Acceso denegado')
    """Crear nuevo tenant (cliente)"""
    
    # Verificar que subdominio no exista
    existing = db.query(Tenant).filter(Tenant.subdominio == tenant.subdominio).first()
    if existing:
        raise HTTPException(status_code=400, detail="Subdominio ya existe")
    
    db_tenant = Tenant(**tenant.model_dump())
    db.add(db_tenant)
    db.commit()
    db.refresh(db_tenant)
    
    # Crear carpeta para uploads
    tenant_dir = UPLOAD_DIR / str(db_tenant.id)
    tenant_dir.mkdir(exist_ok=True)
    
    return db_tenant

@router.get("", response_model=List[TenantResponse])
def listar_tenants(
    skip: int = 0,
    limit: int = 100,
    estado: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Listar todos los tenants"""
    query = db.query(Tenant)
    
    if estado:
        query = query.filter(Tenant.estado == estado)
    
    return query.offset(skip).limit(limit).all()

@router.get("/{tenant_id}", response_model=TenantResponse)
def obtener_tenant(tenant_id: int, db: Session = Depends(get_db)):
    """Obtener tenant por ID"""
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant no encontrado")
    return tenant

@router.put("/{tenant_id}", response_model=TenantResponse)
def actualizar_tenant(
    tenant_id: int,
    tenant_update: TenantUpdate,
    db: Session = Depends(get_db)
):
    """Actualizar tenant"""
    db_tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not db_tenant:
        raise HTTPException(status_code=404, detail="Tenant no encontrado")
    
    for key, value in tenant_update.model_dump(exclude_unset=True).items():
        setattr(db_tenant, key, value)
    
    db.commit()
    db.refresh(db_tenant)
    return db_tenant

@router.delete("/{tenant_id}")
def eliminar_tenant(tenant_id: int, db: Session = Depends(get_db)):
    """Eliminar tenant (CUIDADO: Elimina todos sus datos en cascada)"""
    if tenant_id == 1:
        raise HTTPException(status_code=403, detail="No se puede eliminar el tenant demo")
    
    db_tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not db_tenant:
        raise HTTPException(status_code=404, detail="Tenant no encontrado")
    
    db.delete(db_tenant)
    db.commit()
    
    return {"message": f"Tenant {tenant_id} eliminado correctamente"}

# ============ UPLOAD ARCHIVOS ============

@router.post("/{tenant_id}/upload-logo")
async def upload_logo(
    tenant_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """Upload logo del tenant"""
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant no encontrado")
    
    # Validar tipo de archivo
    if not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="Solo se permiten imágenes")
    
    # Guardar archivo
    tenant_dir = UPLOAD_DIR / str(tenant_id)
    tenant_dir.mkdir(exist_ok=True)
    
    file_extension = file.filename.split('.')[-1]
    file_path = tenant_dir / f"logo.{file_extension}"
    
    with file_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Actualizar URL en BD
    logo_url = f"/uploads/tenants/{tenant_id}/logo.{file_extension}"
    tenant.logo_url = logo_url
    db.commit()
    
    return {"logo_url": logo_url}

@router.post("/{tenant_id}/upload-favicon")
async def upload_favicon(
    tenant_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """Upload favicon del tenant"""
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant no encontrado")
    
    # Guardar archivo
    tenant_dir = UPLOAD_DIR / str(tenant_id)
    tenant_dir.mkdir(exist_ok=True)
    
    file_extension = file.filename.split('.')[-1]
    file_path = tenant_dir / f"favicon.{file_extension}"
    
    with file_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Actualizar URL en BD
    favicon_url = f"/uploads/tenants/{tenant_id}/favicon.{file_extension}"
    tenant.favicon_url = favicon_url
    db.commit()
    
    return {"favicon_url": favicon_url}

# ============ CONFIG PÚBLICA (PARA FRONTEND) ============

@router.get("/{tenant_id}/config", response_model=TenantConfig)
def obtener_config_tenant(tenant_id: int, db: Session = Depends(get_db)):
    """Obtener configuración pública del tenant (para marca blanca)"""
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant no encontrado")
    
    return TenantConfig(
        id=tenant.id,
        nombre=tenant.nombre,
        subdominio=tenant.subdominio,
        logo_url=tenant.logo_url,
        favicon_url=tenant.favicon_url,
        color_primario=tenant.color_primario,
        color_secundario=tenant.color_secundario,
        color_acento=tenant.color_acento
    )
