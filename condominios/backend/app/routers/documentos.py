from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models import Documento
from typing import Optional
import os, shutil, uuid

router = APIRouter(prefix="/api/condominios", tags=["documentos"])
UPLOAD_DIR = "/app/uploads"


@router.get("/documentos")
def list_documentos(
    condominio_id: Optional[int] = None,
    categoria: Optional[str] = None,
    current_user: dict = Depends(get_current_user), db: Session = Depends(get_db),
):
    tenant_id = current_user["tenant_id"]
    q = db.query(Documento).filter(Documento.tenant_id == tenant_id)
    if condominio_id:
        q = q.filter(Documento.condominio_id == condominio_id)
    if categoria:
        q = q.filter(Documento.categoria == categoria)
    return q.order_by(Documento.creado_en.desc()).all()


@router.post("/documentos/upload")
async def upload_documento(
    condominio_id: Optional[int] = Form(None),
    titulo: str = Form(...),
    descripcion: Optional[str] = Form(None),
    categoria: str = Form("otro"),
    visible_residentes: bool = Form(True),
    subido_por: Optional[str] = Form(None),
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    tenant_id = current_user["tenant_id"]
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    ext = os.path.splitext(file.filename)[1] if file.filename else ""
    fname = f"doc_{uuid.uuid4().hex}{ext}"
    fpath = os.path.join(UPLOAD_DIR, fname)
    with open(fpath, "wb") as f:
        shutil.copyfileobj(file.file, f)
    size = os.path.getsize(fpath)
    doc = Documento(
        tenant_id=tenant_id,
        condominio_id=condominio_id,
        titulo=titulo,
        descripcion=descripcion,
        categoria=categoria,
        archivo_url=f"/uploads/{fname}",
        nombre_archivo=file.filename,
        tamano_bytes=size,
        visible_residentes=visible_residentes,
        subido_por=subido_por,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


@router.post("/documentos")
def create_documento_url(data: dict, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_id = current_user["tenant_id"]
    doc = Documento(**{k: v for k, v in data.items() if hasattr(Documento, k)})
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


@router.put("/documentos/{doc_id}")
def update_documento(doc_id: int, data: dict, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_id = current_user["tenant_id"]
    doc = db.query(Documento).filter(Documento.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    for k, v in data.items():
        if hasattr(doc, k):
            setattr(doc, k, v)
    db.commit()
    return doc


@router.delete("/documentos/{doc_id}")
def delete_documento(doc_id: int, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_id = current_user["tenant_id"]
    doc = db.query(Documento).filter(Documento.id == doc_id).first()
    if doc:
        if doc.archivo_url and doc.archivo_url.startswith("/uploads/"):
            fpath = "/app" + doc.archivo_url
            try:
                os.remove(fpath)
            except Exception:
                pass
        db.delete(doc)
        db.commit()
    return {"ok": True}
