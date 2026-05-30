from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import os

app = FastAPI(
    redirect_slashes=False,
    title="ConectaAI Condominios API",
    description="API REAL para gestión de condominios con WhatsApp 360",
    version="2.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3005",
        "https://conectaai.cl",
        "https://www.conectaai.cl",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── IP-based rate limiting for login ──────────────────────────────────────────
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request as StarletteRequest
from starlette.responses import JSONResponse
import time
from collections import defaultdict
import threading

_ip_login_attempts: dict = defaultdict(list)
_ip_lock = threading.Lock()
_LOGIN_WINDOW = 300
_LOGIN_MAX = 20

class LoginRateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: StarletteRequest, call_next):
        if request.url.path == "/api/auth/login" and request.method == "POST":
            ip = request.headers.get("X-Forwarded-For", request.client.host or "").split(",")[0].strip()
            now = time.time()
            with _ip_lock:
                _ip_login_attempts[ip] = [t for t in _ip_login_attempts[ip] if now - t < _LOGIN_WINDOW]
                if len(_ip_login_attempts[ip]) >= _LOGIN_MAX:
                    return JSONResponse(
                        {"detail": "Demasiados intentos de login. Intenta en 5 minutos."},
                        status_code=429,
                        headers={"Retry-After": "300"}
                    )
                _ip_login_attempts[ip].append(now)
        return await call_next(request)

app.add_middleware(LoginRateLimitMiddleware)

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: StarletteRequest, call_next):
        if request.url.path in ("/docs", "/redoc", "/openapi.json"):
            from starlette.responses import Response as SR
            return SR(status_code=403, content="Forbidden")
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response

app.add_middleware(SecurityHeadersMiddleware)

# Security headers middleware
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: StarletteRequest, call_next):
        if request.url.path in ("/docs", "/redoc", "/openapi.json"):
            from starlette.responses import Response as SR
            return SR(status_code=403, content="Forbidden")
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response

app.add_middleware(SecurityHeadersMiddleware)


# Uploads
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "/app/uploads"))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")


from app.core.database import engine, Base

@app.on_event("startup")
def startup_event():
    """Create all tables on startup"""
    import app.models  # noqa - triggers all model imports
    Base.metadata.create_all(bind=engine)

# Importar routers
from app.routers import auth, personas, sistema, condominios, finanzas, personal, admin, whatsapp360, usuarios, portal, reservas, avisos, accesos, incidencias, votaciones, puertas, rfid
from app.routers import paquetes, ordenes, documentos, avisos_lectura, recordatorios

# Registrar routers
app.include_router(auth.router)
app.include_router(usuarios.router)  # ✅ NUEVO
app.include_router(whatsapp360.router)
app.include_router(personas.router)
app.include_router(puertas.router)
app.include_router(rfid.router)
app.include_router(paquetes.router)
app.include_router(ordenes.router)
app.include_router(documentos.router)
app.include_router(avisos_lectura.router)
app.include_router(recordatorios.router)
app.include_router(condominios.router)
app.include_router(finanzas.router)
app.include_router(personal.router)
app.include_router(admin.router)
app.include_router(portal.router)
app.include_router(reservas.router)
app.include_router(avisos.router)
app.include_router(sistema.router)
app.include_router(accesos.router)
app.include_router(incidencias.router)
app.include_router(votaciones.router)
from app.routers import historial as historial_router
from app.routers import portal_auth
from app.routers import portal_pagos, portal_dashboard
app.include_router(historial_router.router)
app.include_router(portal_auth.router)
app.include_router(portal_pagos.router)
app.include_router(portal_dashboard.router)


from app.routers import remuneraciones, asambleas, proveedores, pagos_online, whatsapp_bot
app.include_router(remuneraciones.router)
app.include_router(asambleas.router)
app.include_router(proveedores.router)
app.include_router(pagos_online.router)
app.include_router(whatsapp_bot.router)

from app.routers import superadmin as superadmin_router
app.include_router(superadmin_router.router)

from app.routers import scanner as scanner_router
app.include_router(scanner_router.router)

from app.routers import biometrico as biometrico_router
app.include_router(biometrico_router.router)

from app.routers import notificaciones_auto
from app.routers.mail_config import router as mail_config_router
from app.routers.wa_platform import router as wa_router
from app.routers.pagos_flow import router as pagos_flow_router
from app.routers.pagos_mp import router as pagos_mp_router
from app.routers.notif_config import router as notif_config_router
app.include_router(notificaciones_auto.router)
app.include_router(mail_config_router)
app.include_router(wa_router)
app.include_router(pagos_flow_router)
app.include_router(pagos_mp_router)
app.include_router(notif_config_router)

from app.routers.camaras_alarmas import router_camaras, router_alarmas
from app.routers.multas import router as multas_router
from app.routers.mascotas import router as mascotas_router
from app.routers.checklist import router as checklist_router
from app.routers.push_notifications import router as push_router
from app.routers.visitas import router as visitas_router, router_estac
from app.routers.paqueteria import router as paqueteria_router
from app.routers.conserje import router as conserje_router
from app.routers.admin_users import router as admin_users_router
from app.routers.alertas_sistema import router as alertas_sistema_router
app.include_router(visitas_router)
app.include_router(router_estac)
app.include_router(paqueteria_router)
app.include_router(conserje_router)
app.include_router(admin_users_router)
app.include_router(alertas_sistema_router)

app.include_router(router_camaras)
app.include_router(router_alarmas)
app.include_router(push_router)
app.include_router(multas_router)
app.include_router(mascotas_router)
app.include_router(checklist_router)
from app.routers import noc as noc_router
app.include_router(noc_router.router)


from app.routers.ia_chat import router as ia_chat_router
from app.routers.anomalias import router as anomalias_router
app.include_router(ia_chat_router)
app.include_router(anomalias_router)

from app.routers import resumenes as resumenes_router
app.include_router(resumenes_router.router)
from app.routers import gastos_comunes as gastos_comunes_router
app.include_router(gastos_comunes_router.router)
from app.routers import migracion as migracion_router
app.include_router(migracion_router.router)
from app.routers import reportes as reportes_router
from app.routers import sii_facturacion as sii_router
from app.routers import portal_extendido as portal_ext_router
from app.routers import pagos_config as pagos_config_router
from app.routers import presupuesto as presupuesto_router
from app.routers import facial_recognition as facial_router
app.include_router(reportes_router.router)
app.include_router(sii_router.router)
app.include_router(portal_ext_router.router)
app.include_router(pagos_config_router.router)
app.include_router(presupuesto_router.router)
app.include_router(facial_router.router)
from app.routers import features as features_router
app.include_router(features_router.router)

@app.get("/")
def root():
    return {
        "app": "ConectaAI - WhatsApp 360",
        "version": "2.0.0",
        "status": "PRODUCCIÓN REAL",
        "endpoints": {
            "auth": "/api/auth/login",
            "usuarios": "/api/usuarios",
            "whatsapp360": "/api/whatsapp360",
            "personas": "/api/personas",
            "condominios": "/api/condominios",
            "finanzas": "/api/finanzas",
            "personal": "/api/personal",
            "admin": "/api/admin"
        }
    }


@app.get("/health")
def health():
    return {"status": "healthy", "whatsapp360": "active"}

from app.routers import ventas as ventas_router
app.include_router(ventas_router.router)
