"""
Clave que administracion deja a conserjeria para autorizar acciones sensibles
sin un admin presente (aprobar visitas, borrar encomiendas). Se guarda como hash
bcrypt en tenants.metadata->>'clave_visitas_hash' y se define desde el panel admin.
"""
import bcrypt
from sqlalchemy import text
from sqlalchemy.orm import Session
from fastapi import HTTPException


def clave_configurada(db: Session, tenant_id: int) -> bool:
    row = db.execute(text("SELECT metadata->>'clave_visitas_hash' FROM tenants WHERE id=:tid"), {"tid": tenant_id}).fetchone()
    return bool(row and row[0])


def exigir_clave_admin(db: Session, tenant_id: int, clave: str | None):
    """Lanza 400/401 si no hay clave configurada o no coincide."""
    row = db.execute(text("SELECT metadata->>'clave_visitas_hash' FROM tenants WHERE id=:tid"), {"tid": tenant_id}).fetchone()
    h = row[0] if row else None
    if not h:
        raise HTTPException(400, "Administracion aun no ha definido la clave de conserjeria")
    if not clave or len(clave) < 4 or not bcrypt.checkpw(clave.encode(), h.encode()):
        raise HTTPException(401, "Clave de administracion incorrecta")


def es_admin(current_user: dict) -> bool:
    return current_user.get("rol") in ("admin", "administrador", "superadmin", "jefe", "gerente")
