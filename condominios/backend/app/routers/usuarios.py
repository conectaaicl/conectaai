from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.database import get_db
from app.core.dependencies import get_current_user
from pydantic import BaseModel
from typing import Optional
import bcrypt

router = APIRouter(prefix="/api/usuarios", tags=["usuarios"])

class UsuarioUpdate(BaseModel):
    nombre_completo: Optional[str] = None
    email: Optional[str] = None
    telefono: Optional[str] = None
    cargo: Optional[str] = None
    empresa: Optional[str] = None
    rut_empresa: Optional[str] = None
    direccion_empresa: Optional[str] = None
    sitio_web: Optional[str] = None
    logo_url: Optional[str] = None

class PasswordUpdate(BaseModel):
    password_actual: str
    password_nueva: str

def hash_password(password: str) -> str:
    """Hash password con bcrypt"""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verificar password con bcrypt"""
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

@router.patch("/{user_id}")
def actualizar_usuario(
    user_id: int,
    datos: UsuarioUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Actualizar datos del usuario"""
    
    # Construir query dinámicamente solo con campos que vienen
    updates = []
    params = {"user_id": user_id}
    
    if datos.nombre_completo is not None:
        updates.append("nombre_completo = :nombre_completo")
        params["nombre_completo"] = datos.nombre_completo
    
    if datos.email is not None:
        updates.append("email = :email")
        params["email"] = datos.email
    
    if datos.telefono is not None:
        updates.append("telefono = :telefono")
        params["telefono"] = datos.telefono
    
    if datos.cargo is not None:
        updates.append("cargo = :cargo")
        params["cargo"] = datos.cargo
    
    if datos.empresa is not None:
        updates.append("empresa = :empresa")
        params["empresa"] = datos.empresa
    
    if datos.rut_empresa is not None:
        updates.append("rut_empresa = :rut_empresa")
        params["rut_empresa"] = datos.rut_empresa
    
    if datos.direccion_empresa is not None:
        updates.append("direccion_empresa = :direccion_empresa")
        params["direccion_empresa"] = datos.direccion_empresa
    
    if datos.sitio_web is not None:
        updates.append("sitio_web = :sitio_web")
        params["sitio_web"] = datos.sitio_web
    
    if datos.logo_url is not None:
        updates.append("logo_url = :logo_url")
        params["logo_url"] = datos.logo_url
    
    if not updates:
        raise HTTPException(status_code=400, detail="No hay datos para actualizar")
    
    query = f"UPDATE usuarios SET {', '.join(updates)} WHERE id = :user_id"
    
    try:
        db.execute(text(query), params)
        db.commit()
        
        # Retornar usuario actualizado
        result = db.execute(
            text("SELECT id, email, nombre_completo, telefono, cargo, empresa, rut_empresa, direccion_empresa, sitio_web, logo_url, rol, tenant_id FROM usuarios WHERE id = :user_id"),
            {"user_id": user_id}
        ).fetchone()
        
        if not result:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
        
        return {
            "id": result[0],
            "email": result[1],
            "nombre_completo": result[2],
            "telefono": result[3],
            "cargo": result[4],
            "empresa": result[5],
            "rut_empresa": result[6],
            "direccion_empresa": result[7],
            "sitio_web": result[8],
            "logo_url": result[9],
            "rol": result[10],
            "tenant_id": result[11]
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al actualizar usuario: {str(e)}")

@router.patch("/{user_id}/password")
def cambiar_password(
    user_id: int,
    datos: PasswordUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Cambiar contraseña del usuario"""
    
    # Obtener usuario
    result = db.execute(
        text("SELECT password_hash FROM usuarios WHERE id = :user_id"),
        {"user_id": user_id}
    ).fetchone()
    
    if not result:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    password_hash_actual = result[0]
    
    # Verificar contraseña actual
    if not verify_password(datos.password_actual, password_hash_actual):
        raise HTTPException(status_code=401, detail="Contraseña actual incorrecta")
    
    # Hash nueva contraseña
    nuevo_hash = hash_password(datos.password_nueva)
    
    # Actualizar
    try:
        db.execute(
            text("UPDATE usuarios SET password_hash = :password_hash WHERE id = :user_id"),
            {"password_hash": nuevo_hash, "user_id": user_id}
        )
        db.commit()
        
        return {"success": True, "message": "Contraseña actualizada correctamente"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al cambiar contraseña: {str(e)}")
