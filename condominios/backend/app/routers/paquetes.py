from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models import Paquete, Persona
from datetime import datetime
from typing import Optional
import httpx, os

router = APIRouter(prefix="/api/condominios", tags=["paquetes"])

MAIL_API = "http://localhost:3004/api/send"
MAIL_KEY = os.getenv("MAIL_API_KEY", "")


async def notify_resident(email: str, nombre: str, descripcion: str):
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            body = descripcion or "Sin descripcion"
            await client.post(
                MAIL_API,
                headers={"Authorization": f"Bearer {MAIL_KEY}"},
                json={
                    "to": email,
                    "subject": "Paquete recibido en porteria",
                    "html": "<p>Hola " + nombre + ",</p><p>Tienes un paquete esperandote en porteria: <strong>" + body + "</strong></p>",
                    "text": f"Hola {nombre}, tienes un paquete en porteria: {body}",
                },
            )
    except Exception:
        pass


@router.get("/paquetes")
def list_paquetes(
    tenant_id: int,
    condominio_id: Optional[int] = None,
    estado: Optional[str] = None,
    db: Session = Depends(get_db),
):
    q = db.query(Paquete).filter(Paquete.tenant_id == tenant_id)
    if condominio_id:
        q = q.filter(Paquete.condominio_id == condominio_id)
    if estado:
        q = q.filter(Paquete.estado == estado)
    return q.order_by(Paquete.creado_en.desc()).all()


@router.post("/paquetes")
async def create_paquete(data: dict, db: Session = Depends(get_db)):
    p = Paquete(**{k: v for k, v in data.items() if hasattr(Paquete, k)})
    p.estado = "pendiente"
    db.add(p)
    db.commit()
    db.refresh(p)
    if p.departamento_id:
        import asyncio
        persona = (
            db.query(Persona)
            .filter(Persona.tenant_id == p.tenant_id, Persona.estado == "activo")
            .first()
        )
        if persona and persona.email:
            asyncio.create_task(
                notify_resident(persona.email, persona.nombre_completo, p.descripcion or "")
            )
            p.estado = "notificado"
            db.commit()
    return p


@router.put("/paquetes/{paquete_id}/estado")
def update_estado(paquete_id: int, data: dict, db: Session = Depends(get_db)):
    p = db.query(Paquete).filter(Paquete.id == paquete_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Paquete no encontrado")
    p.estado = data.get("estado", p.estado)
    if p.estado == "retirado":
        p.fecha_retiro = datetime.utcnow()
    db.commit()
    return p


@router.delete("/paquetes/{paquete_id}")
def delete_paquete(paquete_id: int, db: Session = Depends(get_db)):
    p = db.query(Paquete).filter(Paquete.id == paquete_id).first()
    if p:
        db.delete(p)
        db.commit()
    return {"ok": True}
