from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
from pydantic import BaseModel
from app.core.database import get_db
from app.models.incidencia import Incidencia

router = APIRouter(prefix="/api/incidencias", tags=["Incidencias"])


# ─── Schemas ────────────────────────────────────────────────────────────────

class IncidenciaCreate(BaseModel):
    tenant_id: int
    condominio_id: Optional[int] = None
    departamento_id: Optional[int] = None
    titulo: str
    descripcion: Optional[str] = None
    categoria: str = "general"
    prioridad: str = "media"
    reportado_por: Optional[int] = None
    asignado_a: Optional[int] = None
    costo_estimado: float = 0
    imagen_url: Optional[str] = None


class IncidenciaUpdate(BaseModel):
    estado: Optional[str] = None
    asignado_a: Optional[int] = None
    notas_resolucion: Optional[str] = None
    costo_real: Optional[float] = None
    fecha_resolucion: Optional[datetime] = None
    prioridad: Optional[str] = None
    categoria: Optional[str] = None


def incidencia_to_dict(i: Incidencia) -> dict:
    return {
        "id": i.id,
        "tenant_id": i.tenant_id,
        "condominio_id": i.condominio_id,
        "departamento_id": i.departamento_id,
        "titulo": i.titulo,
        "descripcion": i.descripcion,
        "categoria": i.categoria,
        "prioridad": i.prioridad,
        "estado": i.estado,
        "reportado_por": i.reportado_por,
        "asignado_a": i.asignado_a,
        "costo_estimado": float(i.costo_estimado) if i.costo_estimado else 0,
        "costo_real": float(i.costo_real) if i.costo_real else 0,
        "imagen_url": i.imagen_url,
        "fecha_resolucion": i.fecha_resolucion.isoformat() if i.fecha_resolucion else None,
        "notas_resolucion": i.notas_resolucion,
        "created_at": i.created_at.isoformat() if i.created_at else None,
        "updated_at": i.updated_at.isoformat() if i.updated_at else None,
    }


# ─── Endpoints ──────────────────────────────────────────────────────────────

@router.post("", status_code=201)
def crear_incidencia(body: IncidenciaCreate, db: Session = Depends(get_db)):
    """Create a new incidence/maintenance report."""
    incidencia = Incidencia(**body.dict())
    db.add(incidencia)
    db.commit()
    db.refresh(incidencia)
    return incidencia_to_dict(incidencia)


@router.get("/stats")
def stats_incidencias(tenant_id: int = Query(...), db: Session = Depends(get_db)):
    """Statistics: total, por_estado, por_categoria, por_prioridad."""
    q = db.query(Incidencia).filter(Incidencia.tenant_id == tenant_id)
    all_items = q.all()
    total = len(all_items)

    por_estado: dict = {}
    por_categoria: dict = {}
    por_prioridad: dict = {}

    for item in all_items:
        por_estado[item.estado] = por_estado.get(item.estado, 0) + 1
        por_categoria[item.categoria] = por_categoria.get(item.categoria, 0) + 1
        por_prioridad[item.prioridad] = por_prioridad.get(item.prioridad, 0) + 1

    return {
        "total": total,
        "por_estado": por_estado,
        "por_categoria": por_categoria,
        "por_prioridad": por_prioridad,
    }


@router.get("")
def listar_incidencias(
    tenant_id: Optional[int] = Query(None),
    estado: Optional[str] = Query(None),
    categoria: Optional[str] = Query(None),
    condominio_id: Optional[int] = Query(None),
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    """List incidences with optional filters."""
    q = db.query(Incidencia)
    if tenant_id:
        q = q.filter(Incidencia.tenant_id == tenant_id)
    if estado:
        q = q.filter(Incidencia.estado == estado)
    if categoria:
        q = q.filter(Incidencia.categoria == categoria)
    if condominio_id:
        q = q.filter(Incidencia.condominio_id == condominio_id)
    items = q.order_by(Incidencia.created_at.desc()).offset(skip).limit(limit).all()
    return [incidencia_to_dict(i) for i in items]


@router.get("/{incidencia_id}")
def obtener_incidencia(incidencia_id: int, db: Session = Depends(get_db)):
    """Get incidence by ID."""
    item = db.query(Incidencia).filter(Incidencia.id == incidencia_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Incidencia no encontrada")
    return incidencia_to_dict(item)


@router.patch("/{incidencia_id}")
def actualizar_incidencia(incidencia_id: int, body: IncidenciaUpdate, db: Session = Depends(get_db)):
    """Update incidence (estado, asignado_a, notas_resolucion, costo_real)."""
    item = db.query(Incidencia).filter(Incidencia.id == incidencia_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Incidencia no encontrada")
    for field, value in body.dict(exclude_unset=True).items():
        setattr(item, field, value)
    # Auto-set fecha_resolucion when marking as resuelta
    if body.estado in ("resuelta", "cerrada") and not item.fecha_resolucion:
        item.fecha_resolucion = datetime.now()
    db.commit()
    db.refresh(item)
    return incidencia_to_dict(item)
