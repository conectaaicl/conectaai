from datetime import datetime, timedelta
from typing import Optional
import os

from jose import jwt
from passlib.context import CryptContext
from passlib.exc import UnknownHashError

# ==========================
# CONFIG JWT
# ==========================

JWT_SECRET = os.getenv("JWT_SECRET", "conectaai-dev-secret")
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(
    os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60")
)

# ==========================
# PASSWORD CONTEXT
# ==========================

pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto"
)

# ==========================
# PASSWORD HELPERS (SEGURO)
# ==========================

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verifica password usando bcrypt.
    Si el password almacenado NO es un hash válido,
    devuelve False en vez de lanzar excepción (evita 500).
    """
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except (ValueError, UnknownHashError):
        # Password no hasheado o hash inválido
        return False


def get_password_hash(password: str) -> str:
    """
    Genera hash bcrypt para almacenar en DB
    """
    return pwd_context.hash(password)

# ==========================
# JWT TOKEN
# ==========================

def create_access_token(
    data: dict,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """
    Crea JWT de acceso
    """
    to_encode = data.copy()

    expire = datetime.utcnow() + (
        expires_delta
        if expires_delta
        else timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    to_encode.update({"exp": expire})

    encoded_jwt = jwt.encode(
        to_encode,
        JWT_SECRET,
        algorithm=ALGORITHM,
    )

    return encoded_jwt
