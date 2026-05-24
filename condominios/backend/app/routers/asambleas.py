from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.core.database import get_db
from app.models import Asamblea, ParticipanteAsamblea
from typing import Optional
from datetime import datetime

router = APIRouter(prefix="/api/condominios/asambleas", tags=["asambleas"])

@router.get("")
def list_asambleas(tenant_id: int, condominio_id: Optional[int]=None,
                   estado: Optional[str]=None, db: Session=Depends(get_db)):
    q = db.query(Asamblea).filter(Asamblea.tenant_id==tenant_id)
    if condominio_id: q = q.filter(Asamblea.condominio_id==condominio_id)
    if estado: q = q.filter(Asamblea.estado==estado)
    return q.order_by(desc(Asamblea.fecha_programada)).all()

@router.post("")
def create_asamblea(data: dict, db: Session=Depends(get_db)):
    a = Asamblea(**{k: v for k, v in data.items() if hasattr(Asamblea, k)})
    db.add(a); db.commit(); db.refresh(a); return a

@router.put("/{asamblea_id}")
def update_asamblea(asamblea_id: int, data: dict, db: Session=Depends(get_db)):
    a = db.query(Asamblea).filter(Asamblea.id==asamblea_id).first()
    if not a: raise HTTPException(404)
    for k, v in data.items():
        if hasattr(a, k): setattr(a, k, v)
    db.commit(); return a

@router.post("/{asamblea_id}/iniciar")
def iniciar_asamblea(asamblea_id: int, data: dict, db: Session=Depends(get_db)):
    a = db.query(Asamblea).filter(Asamblea.id==asamblea_id).first()
    if not a: raise HTTPException(404)
    a.estado = "en_curso"
    a.fecha_realizada = datetime.utcnow()
    a.total_unidades = data.get("total_unidades", a.total_unidades)
    db.commit(); return a

@router.post("/{asamblea_id}/cerrar")
def cerrar_asamblea(asamblea_id: int, db: Session=Depends(get_db)):
    a = db.query(Asamblea).filter(Asamblea.id==asamblea_id).first()
    if not a: raise HTTPException(404)
    participantes = db.query(ParticipanteAsamblea).filter(ParticipanteAsamblea.asamblea_id==asamblea_id).count()
    a.unidades_presentes = participantes
    a.quorum_alcanzado_pct = round((participantes / a.total_unidades * 100), 1) if a.total_unidades > 0 else 0
    a.estado = "realizada"
    db.commit()
    return {
        "asamblea": a,
        "quorum": a.quorum_alcanzado_pct,
        "quorum_requerido": a.quorum_requerido_pct,
        "quorum_ok": a.quorum_alcanzado_pct >= a.quorum_requerido_pct
    }

@router.get("/{asamblea_id}/participantes")
def get_participantes(asamblea_id: int, db: Session=Depends(get_db)):
    pts = db.query(ParticipanteAsamblea).filter(ParticipanteAsamblea.asamblea_id==asamblea_id).all()
    total = db.query(Asamblea).filter(Asamblea.id==asamblea_id).first()
    return {"participantes": pts, "total": len(pts), "quorum_requerido": total.quorum_requerido_pct if total else 50}

@router.post("/{asamblea_id}/participantes")
def add_participante(asamblea_id: int, data: dict, db: Session=Depends(get_db)):
    p = ParticipanteAsamblea(
        asamblea_id=asamblea_id,
        **{k: v for k, v in data.items() if hasattr(ParticipanteAsamblea, k) and k != "asamblea_id"}
    )
    db.add(p); db.commit(); db.refresh(p); return p

@router.delete("/{asamblea_id}/participantes/{pid}")
def remove_participante(asamblea_id: int, pid: int, db: Session=Depends(get_db)):
    p = db.query(ParticipanteAsamblea).filter(
        ParticipanteAsamblea.id==pid,
        ParticipanteAsamblea.asamblea_id==asamblea_id
    ).first()
    if p: db.delete(p); db.commit()
    return {"ok": True}

@router.delete("/{asamblea_id}")
def delete_asamblea(asamblea_id: int, db: Session=Depends(get_db)):
    a = db.query(Asamblea).filter(Asamblea.id==asamblea_id).first()
    if a: db.delete(a); db.commit()
    return {"ok": True}
