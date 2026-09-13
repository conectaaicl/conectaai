"""
Cortafuegos de tenant: muchos routers antiguos leen `tenant_id` del body/query.
Este middleware garantiza que, para sesiones admin/conserje, ese tenant_id
coincida con el del JWT. Superadmin (cookie sa_session o rol superadmin) queda exento.
Es una red de seguridad global; los routers nuevos deben seguir usando el JWT.
"""
import json
import os

import jwt
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

_SECRET = os.getenv("SECRET_KEY", "")
_EXEMPT_PREFIXES = ("/api/portal", "/api/superadmin", "/api/auth", "/api/scanner", "/api/mantenciones/publico", "/api/invitacion", "/api/ventas-terreno", "/api/demo", "/api/health", "/docs", "/redoc", "/openapi.json")


def _session_tenant(request: Request):
    token = request.cookies.get("session")
    if not token:
        auth = request.headers.get("authorization", "")
        token = auth[7:] if auth.startswith("Bearer ") else None
    if not token:
        return None, None
    try:
        p = jwt.decode(token, _SECRET, algorithms=["HS256"])
    except Exception:
        return None, None
    return p.get("tenant_id"), p.get("rol") or p.get("role")


_VITRINA_OK = ("/api/auth/logout", "/api/portal/auth/", "/api/push/", "/api/login", "/api/logout")


def _demo_gate(request: Request, path: str):
    """Tenants demo: bloquea escrituras cuando vencio (modo vitrina) y registra uso.
    Devuelve una Response para cortar, o None para seguir."""
    try:
        from app.routers.ventas_demo import estado_demo, registrar_uso, _CACHE, _CACHE_TTL
        import time as _t
        tid, rol = _session_tenant(request)
        if tid is None:
            return None
        c = _CACHE.get(tid)
        if c and _t.time() - c[2] < _CACHE_TTL and not c[0]:
            return None  # cache fresco: no es demo
        from app.core.database import SessionLocal
        db = SessionLocal()
        try:
            est = estado_demo(db, tid)
            if not est["demo"]:
                return None
            if est["vencido"] and request.method not in ("GET", "HEAD", "OPTIONS") and not path.startswith(_VITRINA_OK):
                return JSONResponse({"detail": "Demo finalizado: puedes seguir viendo el sistema, pero no modificarlo. Escríbenos para activarlo en tu edificio.",
                                     "demo_vitrina": True}, status_code=423)
            registrar_uso(db, tid, rol or "?", path, request.method)
        finally:
            db.close()
    except Exception:
        return None
    return None


class TenantGuardMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if path.startswith("/api/") and not path.startswith(("/api/demo", "/api/ventas-terreno", "/api/superadmin", "/api/health")):
            gate = _demo_gate(request, path)
            if gate is not None:
                return gate
        if not path.startswith("/api/") or path.startswith(_EXEMPT_PREFIXES):
            return await call_next(request)

        tid, rol = _session_tenant(request)
        if tid is None or rol == "superadmin" or request.cookies.get("sa_session"):
            return await call_next(request)

        # query string
        q = request.query_params.get("tenant_id")
        if q and q.isdigit() and int(q) not in (0, int(tid)):
            return JSONResponse({"detail": "tenant_id no corresponde a tu sesion"}, status_code=403)

        # JSON body (solo se inspecciona el nivel superior)
        if request.method in ("POST", "PUT", "PATCH", "DELETE") and "application/json" in request.headers.get("content-type", ""):
            body = await request.body()
            if body:
                try:
                    data = json.loads(body)
                    bt = data.get("tenant_id") if isinstance(data, dict) else None
                    if bt is not None and str(bt).isdigit() and int(bt) not in (0, int(tid)):
                        return JSONResponse({"detail": "tenant_id no corresponde a tu sesion"}, status_code=403)
                except ValueError:
                    pass

            async def receive():
                return {"type": "http.request", "body": body, "more_body": False}
            request = Request(request.scope, receive)

        return await call_next(request)
