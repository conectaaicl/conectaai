from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
import os
import shutil
from datetime import datetime
import uuid

router = APIRouter(prefix="/api/upload", tags=["Upload"])

UPLOAD_DIR = "/opt/conectaai/backend/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(f"{UPLOAD_DIR}/logos", exist_ok=True)
os.makedirs(f"{UPLOAD_DIR}/favicons", exist_ok=True)

ALLOWED_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.svg', '.ico'}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB

@router.post("/logo")
async def upload_logo(file: UploadFile = File(...)):
    """Subir logo de empresa"""
    
    # Validar extensión
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Formato no permitido. Use: {ALLOWED_EXTENSIONS}")
    
    # Generar nombre único
    filename = f"{uuid.uuid4()}{ext}"
    filepath = os.path.join(UPLOAD_DIR, "logos", filename)
    
    # Guardar archivo
    try:
        with open(filepath, "wb") as buffer:
            content = await file.read()
            
            # Validar tamaño
            if len(content) > MAX_FILE_SIZE:
                raise HTTPException(status_code=400, detail="Archivo demasiado grande (máx 5MB)")
            
            buffer.write(content)
        
        # URL pública
        url = f"/uploads/logos/{filename}"
        
        return {
            "success": True,
            "filename": filename,
            "url": url,
            "size": len(content)
        }
    except Exception as e:
        if os.path.exists(filepath):
            os.remove(filepath)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/favicon")
async def upload_favicon(file: UploadFile = File(...)):
    """Subir favicon"""
    
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in {'.ico', '.png'}:
        raise HTTPException(status_code=400, detail="Solo .ico o .png para favicon")
    
    filename = f"{uuid.uuid4()}{ext}"
    filepath = os.path.join(UPLOAD_DIR, "favicons", filename)
    
    try:
        with open(filepath, "wb") as buffer:
            content = await file.read()
            if len(content) > MAX_FILE_SIZE:
                raise HTTPException(status_code=400, detail="Archivo demasiado grande")
            buffer.write(content)
        
        url = f"/uploads/favicons/{filename}"
        return {"success": True, "filename": filename, "url": url}
    except Exception as e:
        if os.path.exists(filepath):
            os.remove(filepath)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/logos/{filename}")
def get_logo(filename: str):
    """Servir logo"""
    filepath = os.path.join(UPLOAD_DIR, "logos", filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Logo no encontrado")
    return FileResponse(filepath)

@router.get("/favicons/{filename}")
def get_favicon(filename: str):
    """Servir favicon"""
    filepath = os.path.join(UPLOAD_DIR, "favicons", filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Favicon no encontrado")
    return FileResponse(filepath)
