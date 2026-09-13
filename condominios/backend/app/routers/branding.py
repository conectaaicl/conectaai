"""
Branding por tenant (nombre, logo, favicon, colores) + subida de archivos.
Persisten en tenants.* y en /app/uploads (montado desde el host, servido por nginx en /uploads/).
"""
import os, secrets
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
from app.core.database import get_db
from app.core.dependencies import get_current_user

router = APIRouter(tags=["Branding"])
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "/app/uploads"))
ALLOWED = {"image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "image/svg+xml": ".svg", "image/x-icon": ".ico", "image/vnd.microsoft.icon": ".ico"}


class BrandingIn(BaseModel):
    brand_name: Optional[str] = None
    logo_url: Optional[str] = None
    favicon_url: Optional[str] = None
    primary_color: Optional[str] = None
    secondary_color: Optional[str] = None
    accent_color: Optional[str] = None


def _row(db: Session, tid: int) -> dict:
    r = db.execute(text("SELECT id, nombre, logo_url, favicon_url, color_primario, color_secundario, color_acento, metadata FROM tenants WHERE id=:t"), {"t": tid}).fetchone()
    if not r:
        raise HTTPException(404, "Tenant no encontrado")
    meta = r[7] or {}
    return {"company_id": r[0], "brand_name": meta.get("brand_name") or r[1], "logo_url": r[2], "favicon_url": r[3],
            "primary_color": r[4] or "#0F766E", "secondary_color": r[5] or "#3b82f6", "accent_color": r[6] or "#14B8A6"}


@router.get("/api/branding/company/{company_id}")
def get_branding(company_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    # company_id se ignora: siempre el tenant de la sesion
    return _row(db, current_user["tenant_id"])


@router.get("/api/branding/publico")
def get_branding_publico(db: Session = Depends(get_db)):
    """Sin sesion: solo lo necesario para pintar login/portal (se resuelve por dominio)."""
    return {"ok": True}


@router.put("/api/branding/company/{company_id}")
def put_branding(company_id: int, body: BrandingIn, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    if current_user.get("rol") not in ("admin", "administrador", "superadmin"):
        raise HTTPException(403, "Solo administracion")
    tid = current_user["tenant_id"]
    sets, params = [], {"t": tid}
    for col, key in (("logo_url", "logo_url"), ("favicon_url", "favicon_url"), ("color_primario", "primary_color"),
                     ("color_secundario", "secondary_color"), ("color_acento", "accent_color")):
        v = getattr(body, key)
        if v is not None:
            sets.append(f"{col}=:{key}"); params[key] = v
    if body.brand_name is not None:
        sets.append("metadata = COALESCE(metadata,'{}'::jsonb) || jsonb_build_object('brand_name', CAST(:bn AS text))"); params["bn"] = body.brand_name
    if sets:
        db.execute(text(f"UPDATE tenants SET {', '.join(sets)}, updated_at=NOW() WHERE id=:t"), params)
        db.commit()
    return _row(db, tid)


async def _guardar(file: UploadFile, tid: int, carpeta: str) -> str:
    ext = ALLOWED.get(file.content_type or "")
    if not ext:
        raise HTTPException(400, "Formato no permitido (PNG, JPG, WEBP, SVG o ICO)")
    data = await file.read()
    if len(data) > 3 * 1024 * 1024:
        raise HTTPException(400, "Máximo 3 MB")
    d = UPLOAD_DIR / carpeta / str(tid)
    d.mkdir(parents=True, exist_ok=True)
    name = secrets.token_hex(6) + ext
    (d / name).write_bytes(data)
    return f"/uploads/{carpeta}/{tid}/{name}"


@router.post("/api/upload/logo")
async def upload_logo(file: UploadFile = File(...), db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    url = await _guardar(file, current_user["tenant_id"], "branding")
    db.execute(text("UPDATE tenants SET logo_url=:u, updated_at=NOW() WHERE id=:t"), {"u": url, "t": current_user["tenant_id"]}); db.commit()
    return {"url": url}


@router.post("/api/upload/favicon")
async def upload_favicon(file: UploadFile = File(...), db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    url = await _guardar(file, current_user["tenant_id"], "branding")
    db.execute(text("UPDATE tenants SET favicon_url=:u, updated_at=NOW() WHERE id=:t"), {"u": url, "t": current_user["tenant_id"]}); db.commit()
    return {"url": url}
