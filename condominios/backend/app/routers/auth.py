from fastapi import APIRouter, Depends, HTTPException, Form, Response, Request, Cookie
from sqlalchemy.orm import Session
from app.core.database import get_db
import bcrypt
import jwt
from datetime import datetime, timedelta
from typing import Optional

router = APIRouter(prefix="/api/auth", tags=["auth"])

SECRET_KEY = "conectaai_secret_key_2026_cambiar_en_produccion"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 7

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verificar password con bcrypt"""
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Crear token JWT"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

@router.post("/login")
async def login(
    response: Response,
    email: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db)
):
    """LOGIN REAL"""
    from sqlalchemy import text
    
    result = db.execute(
        text("SELECT id, email, password_hash, nombre_completo, rol, tenant_id, activo FROM usuarios WHERE email = :email"),
        {"email": email}
    ).fetchone()
    
    if not result:
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    
    user_id, user_email, password_hash, nombre_completo, rol, tenant_id, activo = result
    
    if not activo:
        raise HTTPException(status_code=403, detail="Usuario inactivo")
    
    if not verify_password(password, password_hash):
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    
    access_token = create_access_token(
        data={
            "user_id": user_id,
            "email": user_email,
            "tenant_id": tenant_id,
            "rol": rol
        }
    )
    
    response.set_cookie(
        key="session",
        value=access_token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=ACCESS_TOKEN_EXPIRE_DAYS * 24 * 60 * 60
    )
    
    return {
        "success": True,
        "message": "Login exitoso",
        "user": {
            "id": user_id,
            "email": user_email,
            "nombre_completo": nombre_completo,
            "rol": rol,
            "tenant_id": tenant_id
        },
        "token": access_token
    }

@router.post("/logout")
async def logout(response: Response):
    """LOGOUT"""
    response.delete_cookie(key="session")
    return {"success": True, "message": "Sesión cerrada"}

@router.get("/me")
async def get_current_user(
    request: Request,
    session: Optional[str] = Cookie(None),
    db: Session = Depends(get_db)
):
    """Usuario actual CON INFO DEL TENANT"""
    
    # Intentar obtener la cookie de diferentes formas
    token = session
    
    # Si no está en Cookie, buscar en headers
    if not token:
        cookie_header = request.headers.get("cookie", "")
        for cookie in cookie_header.split(";"):
            cookie = cookie.strip()
            if cookie.startswith("session="):
                token = cookie.split("=", 1)[1]
                break
    
    if not token:
        raise HTTPException(status_code=401, detail="No autenticado")
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("user_id")
        
        from sqlalchemy import text
        
        # Obtener usuario Y datos del tenant en una sola query
        result = db.execute(
            text("""
                SELECT 
                    u.id, u.email, u.nombre_completo, u.rol, u.tenant_id,
                    u.telefono, u.cargo, u.empresa,
                    t.nombre as tenant_nombre,
                    t.modulos_activos,
                    t.plan,
                    t.logo_url,
                    t.color_primario,
                    t.color_secundario
                FROM usuarios u
                JOIN tenants t ON u.tenant_id = t.id
                WHERE u.id = :user_id
            """),
            {"user_id": user_id}
        ).fetchone()
        
        if not result:
            raise HTTPException(status_code=401, detail="Usuario no encontrado")
        
        return {
            "id": result[0],
            "email": result[1],
            "nombre_completo": result[2],
            "rol": result[3],
            "tenant_id": result[4],
            "telefono": result[5],
            "cargo": result[6],
            "empresa": result[7],
            "tenant": {
                "nombre": result[8],
                "modulos_activos": result[9] or [],
                "plan": result[10],
                "logo_url": result[11],
                "color_primario": result[12],
                "color_secundario": result[13]
            }
        }
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except jwt.JWTError as e:
        raise HTTPException(status_code=401, detail=f"Token inválido: {str(e)}")
