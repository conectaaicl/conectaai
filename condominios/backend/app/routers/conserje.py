"""
Conserje — gestión de usuarios conserje por el admin del edificio
POST   /api/conserje/usuarios          → crear cuenta conserje (solo admin)
GET    /api/conserje/usuarios          → listar conserjes del tenant (solo admin)
PUT    /api/conserje/usuarios/{id}     → actualizar nombre/email/clave
DELETE /api/conserje/usuarios/{id}     → desactivar/eliminar (solo admin)
POST   /api/conserje/usuarios/{id}/reset-password → resetear clave
"""
import os
import bcrypt
import secrets
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional
from pydantic import BaseModel
from app.core.database import get_db
from app.routers.auth import get_current_user, hash_password, create_token

router = APIRouter(prefix="/api/conserje", tags=["Conserje"])


class ConserjeCreate(BaseModel):
    tenant_id: Optional[int] = None   # ignorado salvo superadmin
    nombre_completo: str
    email: str
    password: str
    turno: Optional[str] = None      # mañana | tarde | noche | rotativo
    telefono: Optional[str] = None
    condominio_ids: Optional[list] = None  # which condominios this conserje manages
    cargo: Optional[str] = None      # conserje | guardia | mantenimiento | limpieza | jardinero

class ConserjeUpdate(BaseModel):
    nombre_completo: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    turno: Optional[str] = None
    telefono: Optional[str] = None
    activo: Optional[bool] = None



def _tenant_efectivo(current_user: dict, tenant_id_solicitado=None) -> int:
    """Nunca confiar en el tenant_id del cliente: solo superadmin puede operar sobre otro tenant."""
    if current_user.get("rol") == "superadmin" and tenant_id_solicitado:
        return int(tenant_id_solicitado)
    return int(current_user["tenant_id"])

def _require_admin(current_user: dict):
    if current_user.get("rol") not in ("admin", "administrador", "superadmin"):
        raise HTTPException(403, "Solo administradores pueden gestionar conserjes")


@router.get("/usuarios")
def listar_conserjes(
    request: Request,
    tenant_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    _require_admin(current_user)
    tenant_id = _tenant_efectivo(current_user, tenant_id)
    rows = db.execute(text(
        "SELECT id, email, nombre_completo, activo, last_login::text, created_at::text, "
        "COALESCE((extra->>'turno'),'') as turno, "
        "COALESCE((extra->>'telefono'),'') as telefono, "
        "COALESCE((extra->>'cargo'),'conserje') as cargo "
        "FROM usuarios WHERE tenant_id=:tid AND rol='conserje' ORDER BY nombre_completo"
    ), {"tid": tenant_id}).fetchall()
    return [dict(r._mapping) for r in rows]


@router.post("/usuarios", status_code=201)
def crear_conserje(
    body: ConserjeCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    _require_admin(current_user)

    email = body.email.strip().lower()
    existing = db.execute(text("SELECT id FROM usuarios WHERE email=:e"), {"e": email}).fetchone()
    if existing:
        raise HTTPException(409, "Ya existe un usuario con ese email")

    if len(body.password) < 6:
        raise HTTPException(400, "La contraseña debe tener al menos 6 caracteres")

    import json
    extra = {}
    if body.turno: extra["turno"] = body.turno
    if body.telefono: extra["telefono"] = body.telefono
    if body.condominio_ids: extra["condominio_ids"] = body.condominio_ids
    if body.cargo: extra["cargo"] = body.cargo
    tenant_id = _tenant_efectivo(current_user, body.tenant_id)

    row = db.execute(text(
        "INSERT INTO usuarios (tenant_id, email, password_hash, nombre_completo, rol, activo, extra) "
        "VALUES (:tid, :email, :pw, :nom, 'conserje', true, :extra) RETURNING id"
    ), {
        "tid": tenant_id, "email": email,
        "pw": hash_password(body.password),
        "nom": body.nombre_completo,
        "extra": json.dumps(extra) if extra else None
    }).fetchone()
    db.commit()
    return {"id": row._mapping["id"], "email": email, "nombre_completo": body.nombre_completo}


@router.put("/usuarios/{usuario_id}")
def actualizar_conserje(
    usuario_id: int,
    body: ConserjeUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    _require_admin(current_user)
    updates = {}
    if body.nombre_completo is not None: updates["nombre_completo"] = body.nombre_completo
    if body.email is not None: updates["email"] = body.email.strip().lower()
    if body.password is not None:
        if len(body.password) < 6:
            raise HTTPException(400, "Contraseña demasiado corta")
        updates["password_hash"] = hash_password(body.password)
    if body.activo is not None: updates["activo"] = body.activo
    if not updates:
        raise HTTPException(400, "Sin campos para actualizar")
    set_clause = ", ".join(f"{k}=:{k}" for k in updates)
    updates["id"] = usuario_id
    updates["tid"] = _tenant_efectivo(current_user)
    res = db.execute(text(f"UPDATE usuarios SET {set_clause}, updated_at=NOW() WHERE id=:id AND rol='conserje' AND tenant_id=:tid"), updates)
    db.commit()
    if res.rowcount == 0:
        raise HTTPException(404, "Conserje no encontrado en este condominio")
    return {"ok": True}


@router.delete("/usuarios/{usuario_id}")
def eliminar_conserje(
    usuario_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    _require_admin(current_user)
    res = db.execute(text("UPDATE usuarios SET activo=false WHERE id=:id AND rol='conserje' AND tenant_id=:tid"),
                     {"id": usuario_id, "tid": _tenant_efectivo(current_user)})
    db.commit()
    if res.rowcount == 0:
        raise HTTPException(404, "Conserje no encontrado en este condominio")
    return {"ok": True}


@router.post("/usuarios/{usuario_id}/reset-password")
def reset_password_conserje(
    usuario_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    _require_admin(current_user)
    new_pass = secrets.token_urlsafe(8)
    res = db.execute(text("UPDATE usuarios SET password_hash=:pw, failed_attempts=0, locked_until=NULL WHERE id=:id AND rol='conserje' AND tenant_id=:tid"),
                     {"pw": hash_password(new_pass), "id": usuario_id, "tid": _tenant_efectivo(current_user)})
    db.commit()
    if res.rowcount == 0:
        raise HTTPException(404, "Conserje no encontrado en este condominio")
    return {"ok": True, "nueva_password": new_pass}
