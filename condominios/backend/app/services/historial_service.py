from sqlalchemy.orm import Session
from app.models import HistorialEvento

def log_evento(db: Session, tenant_id: int, modulo: str, accion: str,
               descripcion: str, usuario_nombre: str = "Sistema",
               entidad_id: int = None, metadata: dict = None):
    try:
        db.add(HistorialEvento(
            tenant_id=tenant_id, modulo=modulo, accion=accion,
            descripcion=descripcion, usuario_nombre=usuario_nombre,
            entidad_id=entidad_id, metadata_json=metadata
        ))
        db.commit()
    except Exception:
        try:
            db.rollback()
        except:
            pass
