from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import os

app = FastAPI(
    title="ConectaAI Condominios API",
    description="API REAL para gestión de condominios con WhatsApp 360",
    version="2.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://login.conectaai.cl",
        "https://sistema.conectaai.cl",
        "https://dashboard.conectaai.cl"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Uploads
UPLOAD_DIR = Path("/opt/conectaai/uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

# Importar routers
from app.routers import auth, personas, condominios, finanzas, personal, admin, whatsapp360, usuarios

# Registrar routers
app.include_router(auth.router)
app.include_router(usuarios.router)  # ✅ NUEVO
app.include_router(whatsapp360.router)
app.include_router(personas.router)
app.include_router(condominios.router)
app.include_router(finanzas.router)
app.include_router(personal.router)
app.include_router(admin.router)

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
