from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc, distinct
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models import HistorialEvento
from typing import Optional

router = APIRouter(prefix="/api/historial", tags=["historial"])

@router.get("")
def get_historial(modulo: Optional[str]=None, accion: Optional[str]=None,
                  usuario: Optional[str]=None, page: int=1, limit: int=50,
                  current_user: dict = Depends(get_current_user), db: Session=Depends(get_db)):
    tenant_id = current_user["tenant_id"]
    q = db.query(HistorialEvento).filter(HistorialEvento.tenant_id == tenant_id)
    if modulo: q = q.filter(HistorialEvento.modulo == modulo)
    if accion: q = q.filter(HistorialEvento.accion.ilike(f"%{accion}%"))
    if usuario: q = q.filter(HistorialEvento.usuario_nombre.ilike(f"%{usuario}%"))
    total = q.count()
    items = q.order_by(desc(HistorialEvento.fecha)).offset((page-1)*limit).limit(limit).all()
    return {"total": total, "page": page, "items": [
        {"id": i.id, "modulo": i.modulo, "accion": i.accion, "descripcion": i.descripcion,
         "usuario_nombre": i.usuario_nombre, "entidad_id": i.entidad_id,
         "fecha": i.fecha.isoformat() if i.fecha else None}
        for i in items
    ]}

@router.get("/modulos")
def get_modulos(current_user: dict = Depends(get_current_user), db: Session=Depends(get_db)):
    tenant_id = current_user["tenant_id"]
    rows = db.query(distinct(HistorialEvento.modulo)).filter(HistorialEvento.tenant_id==tenant_id).all()
    return [r[0] for r in rows if r[0]]

@router.post("/configurar-clave")
def configurar_clave(data: dict, current_user: dict = Depends(get_current_user), db: Session=Depends(get_db)):
    tenant_id = current_user["tenant_id"]
    from app.models import SistemaConfig
    nueva = data.get("nueva_clave","")
    tenant_id = data.get("tenant_id")
    if not tenant_id or len(nueva) < 6:
        raise HTTPException(400, "Clave debe tener al menos 6 caracteres")
    import bcrypt
    hashed = bcrypt.hashpw(nueva.encode(), bcrypt.gensalt()).decode()
    cfg = db.query(SistemaConfig).filter(SistemaConfig.tenant_id==tenant_id, SistemaConfig.clave=="historial_delete_key").first()
    if cfg:
        cfg.valor = hashed
    else:
        db.add(SistemaConfig(tenant_id=tenant_id, clave="historial_delete_key", valor=hashed))
    db.commit()
    return {"ok": True}

@router.post("/borrar")
def borrar_historial(data: dict, current_user: dict = Depends(get_current_user), db: Session=Depends(get_db)):
    tenant_id = current_user["tenant_id"]
    from app.models import SistemaConfig
    import bcrypt
    tenant_id = data.get("tenant_id")
    clave = data.get("clave","")
    modulo = data.get("modulo")
    if not tenant_id or not clave:
        raise HTTPException(400, "tenant_id y clave requeridos")
    cfg = db.query(SistemaConfig).filter(SistemaConfig.tenant_id==tenant_id, SistemaConfig.clave=="historial_delete_key").first()
    if not cfg or not cfg.valor:
        raise HTTPException(403, "No hay clave configurada. Configúrela en Ajustes primero.")
    if not bcrypt.checkpw(clave.encode(), cfg.valor.encode()):
        raise HTTPException(403, "Clave incorrecta")
    q = db.query(HistorialEvento).filter(HistorialEvento.tenant_id==tenant_id)
    if modulo: q = q.filter(HistorialEvento.modulo==modulo)
    count = q.count()
    q.delete(synchronize_session=False)
    db.commit()
    return {"ok": True, "eliminados": count}
