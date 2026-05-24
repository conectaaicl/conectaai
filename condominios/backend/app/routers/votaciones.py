from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel
import json
from app.core.database import get_db
from app.models.votacion import Votacion, VotoRespuesta

router = APIRouter(prefix="/api/votaciones", tags=["Votaciones"])


# ─── Schemas ────────────────────────────────────────────────────────────────

class VotacionCreate(BaseModel):
    tenant_id: int
    condominio_id: Optional[int] = None
    titulo: str
    descripcion: Optional[str] = None
    opciones: List[str]
    fecha_inicio: datetime
    fecha_fin: datetime


class VotoCreate(BaseModel):
    departamento_id: Optional[int] = None
    persona_id: Optional[int] = None
    opcion_elegida: str


def votacion_to_dict(v: Votacion) -> dict:
    try:
        opciones = json.loads(v.opciones) if v.opciones else []
    except Exception:
        opciones = []
    return {
        "id": v.id,
        "tenant_id": v.tenant_id,
        "condominio_id": v.condominio_id,
        "titulo": v.titulo,
        "descripcion": v.descripcion,
        "opciones": opciones,
        "estado": v.estado,
        "fecha_inicio": v.fecha_inicio.isoformat() if v.fecha_inicio else None,
        "fecha_fin": v.fecha_fin.isoformat() if v.fecha_fin else None,
        "created_at": v.created_at.isoformat() if v.created_at else None,
    }


# ─── Endpoints ──────────────────────────────────────────────────────────────

@router.post("", status_code=201)
def crear_votacion(body: VotacionCreate, db: Session = Depends(get_db)):
    """Create a new voting."""
    data = body.dict()
    data["opciones"] = json.dumps(data["opciones"])
    votacion = Votacion(**data)
    db.add(votacion)
    db.commit()
    db.refresh(votacion)
    return votacion_to_dict(votacion)


@router.get("")
def listar_votaciones(
    tenant_id: Optional[int] = Query(None),
    estado: Optional[str] = Query(None),
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    """List votaciones with optional filters."""
    q = db.query(Votacion)
    if tenant_id:
        q = q.filter(Votacion.tenant_id == tenant_id)
    if estado:
        q = q.filter(Votacion.estado == estado)
    items = q.order_by(Votacion.created_at.desc()).offset(skip).limit(limit).all()
    return [votacion_to_dict(v) for v in items]


@router.get("/{votacion_id}/resultados")
def resultados_votacion(votacion_id: int, db: Session = Depends(get_db)):
    """Get voting results with participation percentage."""
    votacion = db.query(Votacion).filter(Votacion.id == votacion_id).first()
    if not votacion:
        raise HTTPException(status_code=404, detail="Votación no encontrada")

    try:
        opciones = json.loads(votacion.opciones) if votacion.opciones else []
    except Exception:
        opciones = []

    votos = db.query(VotoRespuesta).filter(VotoRespuesta.votacion_id == votacion_id).all()
    total_votos = len(votos)

    resultados: dict = {op: 0 for op in opciones}
    for voto in votos:
        if voto.opcion_elegida in resultados:
            resultados[voto.opcion_elegida] += 1
        else:
            resultados[voto.opcion_elegida] = resultados.get(voto.opcion_elegida, 0) + 1

    # Participation based on unique departamentos that voted vs total (simplified)
    departamentos_votantes = len(set(v.departamento_id for v in votos if v.departamento_id))

    return {
        "votacion": votacion_to_dict(votacion),
        "resultados": resultados,
        "total_votos": total_votos,
        "departamentos_votantes": departamentos_votantes,
        "participacion_pct": round(departamentos_votantes / max(total_votos, 1) * 100, 2),
    }


@router.post("/{votacion_id}/votar", status_code=201)
def votar(votacion_id: int, body: VotoCreate, db: Session = Depends(get_db)):
    """Cast a vote; one vote per departamento_id enforced."""
    votacion = db.query(Votacion).filter(Votacion.id == votacion_id).first()
    if not votacion:
        raise HTTPException(status_code=404, detail="Votación no encontrada")
    if votacion.estado != "activa":
        raise HTTPException(status_code=400, detail="La votación no está activa")

    # Duplicate check per departamento
    if body.departamento_id:
        existing = db.query(VotoRespuesta).filter(
            VotoRespuesta.votacion_id == votacion_id,
            VotoRespuesta.departamento_id == body.departamento_id,
        ).first()
        if existing:
            raise HTTPException(status_code=409, detail="Este departamento ya emitió su voto")

    # Validate option
    try:
        opciones = json.loads(votacion.opciones) if votacion.opciones else []
    except Exception:
        opciones = []
    if opciones and body.opcion_elegida not in opciones:
        raise HTTPException(status_code=400, detail=f"Opción inválida. Opciones: {opciones}")

    respuesta = VotoRespuesta(
        votacion_id=votacion_id,
        departamento_id=body.departamento_id,
        persona_id=body.persona_id,
        opcion_elegida=body.opcion_elegida,
    )
    db.add(respuesta)
    db.commit()
    db.refresh(respuesta)
    return {
        "id": respuesta.id,
        "votacion_id": respuesta.votacion_id,
        "opcion_elegida": respuesta.opcion_elegida,
        "created_at": respuesta.created_at.isoformat() if respuesta.created_at else None,
    }


@router.patch("/{votacion_id}/cerrar")
def cerrar_votacion(votacion_id: int, db: Session = Depends(get_db)):
    """Close a voting."""
    votacion = db.query(Votacion).filter(Votacion.id == votacion_id).first()
    if not votacion:
        raise HTTPException(status_code=404, detail="Votación no encontrada")
    votacion.estado = "cerrada"
    db.commit()
    db.refresh(votacion)
    return votacion_to_dict(votacion)
