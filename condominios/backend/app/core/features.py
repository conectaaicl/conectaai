"""Feature flag dependency for FastAPI routes."""
import os
import jwt
from fastapi import Request, HTTPException
from sqlalchemy import text
from app.core.database import SessionLocal

SECRET_KEY = os.getenv("SECRET_KEY", "")
ALGORITHM = "HS256"


def check_feature(feature_key: str):
    """
    FastAPI dependency factory.
    Raises HTTP 403 if the current tenant does not have the given feature active.
    Superadmin role bypasses all feature checks.

    Usage:
        @router.get("/something", dependencies=[Depends(check_feature("puertas"))])
        def my_route(): ...
    """
    async def _check(request: Request):
        token = request.cookies.get("session")
        if not token:
            auth = request.headers.get("authorization", "")
            token = auth[7:] if auth.startswith("Bearer ") else None
        if not token:
            raise HTTPException(403, f"Feature '{feature_key}' requiere autenticacion")
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        except Exception:
            raise HTTPException(403, "Token invalido")

        rol = payload.get("rol", payload.get("role", ""))
        if rol == "superadmin":
            return True  # superadmin bypasses all feature checks

        tenant_id = payload.get("tenant_id")
        if not tenant_id:
            raise HTTPException(403, "No hay tenant en la sesion")

        db = SessionLocal()
        try:
            row = db.execute(text(
                "SELECT activo FROM tenant_features "
                "WHERE tenant_id=:tid AND feature_key=:fk"
            ), {"tid": tenant_id, "fk": feature_key}).fetchone()
            if not row or not row[0]:
                raise HTTPException(
                    403,
                    f"Feature '{feature_key}' no esta habilitado para este tenant"
                )
        finally:
            db.close()
        return True

    return _check
