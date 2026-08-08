from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models import AvisoLectura

router = APIRouter(prefix="/api/condominios", tags=["avisos_lectura"])


def _require_aviso_del_tenant(db: Session, aviso_id: int, tenant_id: int):
    """FLUJO-04: evita leer/marcar lecturas de un aviso de otro tenant adivinando el id."""
    from sqlalchemy import text
    row = db.execute(text("SELECT id FROM avisos WHERE id=:aid AND tenant_id=:tid"), {"aid": aviso_id, "tid": tenant_id}).fetchone()
    if not row:
        from fastapi import HTTPException
        raise HTTPException(404, "Aviso no encontrado")


@router.post("/avisos/{aviso_id}/leer")
def registrar_lectura(aviso_id: int, data: dict, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_id = current_user["tenant_id"]
    _require_aviso_del_tenant(db, aviso_id, tenant_id)
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
def get_lecturas(aviso_id: int, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_id = current_user["tenant_id"]
    _require_aviso_del_tenant(db, aviso_id, tenant_id)
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
