from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Routers reales del proyecto
from app.api.health import router as health_router
from app.routers.auth import router as auth_router
from app.routers.me import router as me_router
from app.routers.deals import router as deals_router
from app.routers.leads import router as leads_router
from app.routers.quotes import router as quotes_router
from app.routers.actions import router as actions_router
from app.routers.whatsapp_webhook import router as whatsapp_router
from app.ai.router import router as ai_router

app = FastAPI(
    title="ConectaAI CORE",
    version="1.0.0",
)

# =========================
# CORS (FRONTEND)
# =========================
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://164.68.127.8:3000",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========================
# ROUTERS
# =========================
app.include_router(health_router)
app.include_router(auth_router)
app.include_router(me_router)
app.include_router(deals_router)
app.include_router(leads_router)
app.include_router(quotes_router)
app.include_router(actions_router)
app.include_router(whatsapp_router)
app.include_router(ai_router)


# Branding
from app.routers.branding import router as branding_router
app.include_router(branding_router)

# Google Calendar OAuth
from app.routers.google_auth import router as google_auth_router
app.include_router(google_auth_router)

# Upload de archivos
from app.routers.upload import router as upload_router
app.include_router(upload_router)

# Servir archivos estáticos
from fastapi.staticfiles import StaticFiles
app.mount("/uploads", StaticFiles(directory="/opt/conectaai/backend/uploads"), name="uploads")

# Admin Panel
from app.routers.admin import router as admin_router
app.include_router(admin_router)
