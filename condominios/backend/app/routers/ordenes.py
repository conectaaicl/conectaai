from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models import OrdenTrabajo
from datetime import datetime
from typing import Optional

router = APIRouter(prefix="/api/condominios", tags=["ordenes"])


@router.get("/ordenes")
def list_ordenes(
    tenant_id: int,
    condominio_id: Optional[int] = None,
    estado: Optional[str] = None,
    tipo: Optional[str] = None,
    db: Session = Depends(get_db),
):
    q = db.query(OrdenTrabajo).filter(OrdenTrabajo.tenant_id == tenant_id)
    if condominio_id:
        q = q.filter(OrdenTrabajo.condominio_id == condominio_id)
    if estado:
        q = q.filter(OrdenTrabajo.estado == estado)
    if tipo:
        q = q.filter(OrdenTrabajo.tipo == tipo)
    return q.order_by(OrdenTrabajo.creado_en.desc()).all()


@router.get("/ordenes/stats")
def get_stats(tenant_id: int, db: Session = Depends(get_db)):
    q = db.query(OrdenTrabajo).filter(OrdenTrabajo.tenant_id == tenant_id)
    total = q.count()
    abiertas = db.query(OrdenTrabajo).filter(
        OrdenTrabajo.tenant_id == tenant_id, OrdenTrabajo.estado == "abierta"
    ).count()
    en_progreso = db.query(OrdenTrabajo).filter(
        OrdenTrabajo.tenant_id == tenant_id,
        OrdenTrabajo.estado.in_(["asignada", "en_progreso"]),
    ).count()
    completadas = db.query(OrdenTrabajo).filter(
        OrdenTrabajo.tenant_id == tenant_id, OrdenTrabajo.estado == "completada"
    ).count()
    urgentes = db.query(OrdenTrabajo).filter(
        OrdenTrabajo.tenant_id == tenant_id,
        OrdenTrabajo.prioridad == "urgente",
        OrdenTrabajo.estado != "cerrada",
    ).count()
    return {
        "total": total,
        "abiertas": abiertas,
        "en_progreso": en_progreso,
        "completadas": completadas,
        "urgentes": urgentes,
    }


@router.post("/ordenes")
def create_orden(data: dict, db: Session = Depends(get_db)):
    o = OrdenTrabajo(**{k: v for k, v in data.items() if hasattr(OrdenTrabajo, k)})
    if not o.fecha_inicio:
        o.fecha_inicio = datetime.utcnow()
    db.add(o)
    db.commit()
    db.refresh(o)
    return o


@router.put("/ordenes/{orden_id}")
def update_orden(orden_id: int, data: dict, db: Session = Depends(get_db)):
    o = db.query(OrdenTrabajo).filter(OrdenTrabajo.id == orden_id).first()
    if not o:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    for k, v in data.items():
        if hasattr(o, k):
            setattr(o, k, v)
    if data.get("estado") in ("completada", "cerrada") and not o.fecha_cierre:
        o.fecha_cierre = datetime.utcnow()
    db.commit()
    return o


@router.delete("/ordenes/{orden_id}")
def delete_orden(orden_id: int, db: Session = Depends(get_db)):
    o = db.query(OrdenTrabajo).filter(OrdenTrabajo.id == orden_id).first()
    if o:
        db.delete(o)
        db.commit()
    return {"ok": True}
