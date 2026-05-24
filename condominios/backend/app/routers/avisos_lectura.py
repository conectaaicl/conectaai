from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models import AvisoLectura

router = APIRouter(prefix="/api/condominios", tags=["avisos_lectura"])


@router.post("/avisos/{aviso_id}/leer")
def registrar_lectura(aviso_id: int, data: dict, db: Session = Depends(get_db)):
    rut = data.get("residente_rut", "")
    persona_id = data.get("persona_id")
    existing = (
        db.query(AvisoLectura)
        .filter(
            AvisoLectura.aviso_id == aviso_id,
            AvisoLectura.residente_rut == rut,
        )
        .first()
    )
    if not existing:
        lectura = AvisoLectura(
            aviso_id=aviso_id, persona_id=persona_id, residente_rut=rut
        )
        db.add(lectura)
        db.commit()
    return {"ok": True}


@router.get("/avisos/{aviso_id}/lecturas")
def get_lecturas(aviso_id: int, db: Session = Depends(get_db)):
    lecturas = (
        db.query(AvisoLectura)
        .filter(AvisoLectura.aviso_id == aviso_id)
        .all()
    )
    return {
        "total": len(lecturas),
        "lecturas": [
            {
                "persona_id": l.persona_id,
                "residente_rut": l.residente_rut,
                "fecha_lectura": l.fecha_lectura.isoformat() if l.fecha_lectura else None,
            }
            for l in lecturas
        ],
    }
