"""
Admin Users — gestión de usuarios administrador por el superadmin
POST   /api/admin-users          → crear cuenta admin
GET    /api/admin-users          → listar admins del tenant
PUT    /api/admin-users/{id}     → actualizar nombre/email/clave
DELETE /api/admin-users/{id}     → desactivar admin
POST   /api/admin-users/{id}/reset-password → resetear clave con nueva aleatoria
"""
import json
import secrets
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional
from pydantic import BaseModel
from app.core.database import get_db
from app.routers.auth import get_current_user, hash_password

router = APIRouter(prefix="/api/admin-users", tags=["Admin Users"])


class AdminUserCreate(BaseModel):
    tenant_id: int
    nombre_completo: str
    email: str
    password: str
    cargo: Optional[str] = None
    telefono: Optional[str] = None


class AdminUserUpdate(BaseModel):
    nombre_completo: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    cargo: Optional[str] = None
    telefono: Optional[str] = None
    activo: Optional[bool] = None


def _require_superadmin(current_user: dict):
    if current_user.get("rol") not in ("superadmin",):
        raise HTTPException(403, "Solo superadmin puede gestionar administradores")


@router.get("")
def listar_admins(
    tenant_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    _require_superadmin(current_user)
    rows = db.execute(text(
        "SELECT id, email, nombre_completo, activo, last_login::text, created_at::text, "
        "COALESCE((extra->>'cargo'),'') as cargo, "
        "COALESCE((extra->>'telefono'),'') as telefono "
        "FROM usuarios WHERE tenant_id=:tid AND rol='admin' ORDER BY nombre_completo"
    ), {"tid": tenant_id}).fetchall()
    return [dict(r._mapping) for r in rows]


@router.post("", status_code=201)
def crear_admin(
    body: AdminUserCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    _require_superadmin(current_user)

    email = body.email.strip().lower()
    existing = db.execute(text("SELECT id FROM usuarios WHERE email=:e"), {"e": email}).fetchone()
    if existing:
        raise HTTPException(409, "Ya existe un usuario con ese email")

    if len(body.password) < 6:
        raise HTTPException(400, "La contrasena debe tener al menos 6 caracteres")

    extra = {}
    if body.cargo: extra["cargo"] = body.cargo
    if body.telefono: extra["telefono"] = body.telefono

    row = db.execute(text(
        "INSERT INTO usuarios (tenant_id, email, password_hash, nombre_completo, rol, activo, extra) "
        "VALUES (:tid, :email, :pw, :nom, 'admin', true, :extra) RETURNING id"
    ), {
        "tid": body.tenant_id, "email": email,
        "pw": hash_password(body.password),
        "nom": body.nombre_completo,
        "extra": json.dumps(extra) if extra else None
    }).fetchone()
    db.commit()
    return {"id": row._mapping["id"], "email": email, "nombre_completo": body.nombre_completo}


@router.put("/{usuario_id}")
def actualizar_admin(
    usuario_id: int,
    body: AdminUserUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    _require_superadmin(current_user)
    updates = {}
    if body.nombre_completo is not None: updates["nombre_completo"] = body.nombre_completo
    if body.email is not None: updates["email"] = body.email.strip().lower()
    if body.password is not None:
        if len(body.password) < 6:
            raise HTTPException(400, "Contrasena demasiado corta")
        updates["password_hash"] = hash_password(body.password)
    if body.activo is not None: updates["activo"] = body.activo
    if body.cargo is not None or body.telefono is not None:
        row = db.execute(text("SELECT extra FROM usuarios WHERE id=:id"), {"id": usuario_id}).fetchone()
        extra = json.loads(row._mapping["extra"] or "{}") if row else {}
        if body.cargo is not None: extra["cargo"] = body.cargo
        if body.telefono is not None: extra["telefono"] = body.telefono
        updates["extra"] = json.dumps(extra)
    if not updates:
        raise HTTPException(400, "Sin campos para actualizar")
    set_clause = ", ".join(f"{k}=:{k}" for k in updates)
    updates["id"] = usuario_id
    db.execute(text(f"UPDATE usuarios SET {set_clause}, updated_at=NOW() WHERE id=:id AND rol='admin'"), updates)
    db.commit()
    return {"ok": True}


@router.delete("/{usuario_id}")
def eliminar_admin(
    usuario_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    _require_superadmin(current_user)
    db.execute(text("UPDATE usuarios SET activo=false WHERE id=:id AND rol='admin'"), {"id": usuario_id})
    db.commit()
    return {"ok": True}


@router.post("/{usuario_id}/reset-password")
def reset_password_admin(
    usuario_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    _require_superadmin(current_user)
    new_pass = secrets.token_urlsafe(10)
    db.execute(text("UPDATE usuarios SET password_hash=:pw WHERE id=:id AND rol='admin'"),
               {"pw": hash_password(new_pass), "id": usuario_id})
    db.commit()
    return {"ok": True, "nueva_password": new_pass}
