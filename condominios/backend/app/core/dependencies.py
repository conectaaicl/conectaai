"""
Dependencias centralizadas de autenticación para el sistema de condominios.

Todas las rutas protegidas deben usar get_current_user como Depends.
El tenant_id SIEMPRE se extrae del JWT — nunca se acepta como query param.
"""
import os as _os

import jwt
from fastapi import Depends, HTTPException, Request
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database import get_db

_SECRET_KEY = _os.getenv("SECRET_KEY", "")
_ALGORITHM = "HS256"


def get_current_user(request: Request, db: Session = Depends(get_db)) -> dict:
    """
    Valida la sesión (cookie 'session' o header Authorization Bearer).
    Retorna dict con id, email, nombre_completo, role, rol, activo, tenant_id.
    Lanza 401 si no autenticado o sesión inválida.
    """
    token = request.cookies.get("session")
    if not token:
        auth = request.headers.get("authorization", "")
        token = auth[7:] if auth.startswith("Bearer ") else None
    if not token:
        raise HTTPException(status_code=401, detail="No autenticado")
    try:
        payload = jwt.decode(token, _SECRET_KEY, algorithms=[_ALGORITHM])
        uid = int(payload["sub"])
    except Exception:
        raise HTTPException(status_code=401, detail="Sesión inválida o expirada")
    row = db.execute(
        text("SELECT id, email, nombre_completo, rol, activo, tenant_id FROM usuarios WHERE id=:uid AND activo=true"),
        {"uid": uid},
    ).fetchone()
    if not row:
        raise HTTPException(status_code=401, detail="Usuario no encontrado o inactivo")
    return {
        "id": row[0], "email": row[1], "nombre_completo": row[2],
        "role": row[3], "rol": row[3], "activo": row[4], "tenant_id": row[5],
    }


def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    """Exige rol admin, jefe o gerente."""
    if current_user.get("rol") not in ("admin", "jefe", "gerente", "superadmin"):
        raise HTTPException(status_code=403, detail="Acceso restringido a administradores")
    return current_user


def require_superadmin(request: Request, db: Session = Depends(get_db)) -> dict:
    """Exige rol superadmin via cookie sa_session."""
    token = request.cookies.get("sa_session")
    if not token:
        raise HTTPException(status_code=401, detail="No autenticado como superadmin")
    try:
        payload = jwt.decode(token, _SECRET_KEY, algorithms=[_ALGORITHM])
        uid = int(payload["sub"])
    except Exception:
        raise HTTPException(status_code=401, detail="Sesión de superadmin inválida")
    row = db.execute(
        text("SELECT id, email, nombre_completo, rol, activo FROM usuarios WHERE id=:uid AND activo=true"),
        {"uid": uid},
    ).fetchone()
    if not row or row[3] != "superadmin":
        raise HTTPException(status_code=403, detail="Solo superadmin puede realizar esta operación")
    return {"id": row[0], "email": row[1], "nombre_completo": row[2], "rol": row[3]}
