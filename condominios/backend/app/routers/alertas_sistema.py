"""
Alertas del sistema — fallos de servicios, dispositivos offline, errores críticos
GET    /api/alertas-sistema                → listar alertas (admin/conserje)
POST   /api/alertas-sistema                → crear alerta (internal o manual)
PATCH  /api/alertas-sistema/{id}/ack       → acknowledge alerta
PATCH  /api/alertas-sistema/{id}/resolver  → marcar resuelta
DELETE /api/alertas-sistema/{id}           → eliminar (admin)
GET    /api/alertas-sistema/resumen        → count by nivel (para header badge)
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional
from pydantic import BaseModel
from app.core.database import get_db
from app.core.dependencies import get_current_user

router = APIRouter(prefix="/api/alertas-sistema", tags=["Alertas Sistema"])


def _ensure_table(db: Session):
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS alertas_sistema (
            id SERIAL PRIMARY KEY,
            tenant_id INTEGER NOT NULL,
            tipo VARCHAR(60) NOT NULL,
            nivel VARCHAR(20) DEFAULT 'info',
            titulo VARCHAR(200) NOT NULL,
            descripcion TEXT,
            servicio VARCHAR(100),
            resuelta BOOLEAN DEFAULT false,
            acknowledged BOOLEAN DEFAULT false,
            acknowledged_by VARCHAR(200),
            acknowledged_at TIMESTAMPTZ,
            resuelta_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    """))
    db.commit()


TIPOS = [
    "dispositivo_offline",
    "servicio_caido",
    "error_email",
    "error_base_datos",
    "conexion_perdida",
    "acceso_denegado_repetido",
    "sensor_fallo",
    "camara_offline",
    "alarma_sin_resolver",
    "otro"
]

NIVELES = ["info", "advertencia", "critico", "error"]


class AlertaSistemaCreate(BaseModel):
    tipo: str
    nivel: str = "info"
    titulo: str
    descripcion: Optional[str] = None
    servicio: Optional[str] = None


@router.get("")
def listar_alertas(
    resuelta: Optional[bool] = None,
    nivel: Optional[str] = None,
    limit: int = 100,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    tenant_id = current_user["tenant_id"]
    _ensure_table(db)
    sql = "SELECT * FROM alertas_sistema WHERE tenant_id=:tid"
    params: dict = {"tid": tenant_id}
    if resuelta is not None:
        sql += " AND resuelta=:res"; params["res"] = resuelta
    if nivel:
        sql += " AND nivel=:niv"; params["niv"] = nivel
    sql += " ORDER BY created_at DESC LIMIT :lim"; params["lim"] = limit
    rows = db.execute(text(sql), params).fetchall()
    result = []
    for r in rows:
        d = dict(r._mapping)
        d["created_at"] = str(d.get("created_at") or "")
        d["acknowledged_at"] = str(d.get("acknowledged_at") or "")
        d["resuelta_at"] = str(d.get("resuelta_at") or "")
        result.append(d)
    return result


@router.get("/resumen")
def resumen_alertas(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_id = current_user["tenant_id"]
    _ensure_table(db)
    rows = db.execute(text(
        "SELECT nivel, COUNT(*) as total FROM alertas_sistema "
        "WHERE tenant_id=:tid AND resuelta=false GROUP BY nivel"
    ), {"tid": tenant_id}).fetchall()
    result = {"info": 0, "advertencia": 0, "critico": 0, "error": 0, "total": 0}
    for r in rows:
        d = dict(r._mapping)
        nivel = d["nivel"]
        if nivel in result:
            result[nivel] = d["total"]
        result["total"] += d["total"]
    return result


@router.post("", status_code=201)
def crear_alerta(body: AlertaSistemaCreate, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_id = current_user["tenant_id"]
    _ensure_table(db)
    if body.servicio:
        existing = db.execute(text(
            "SELECT id FROM alertas_sistema WHERE tenant_id=:tid AND tipo=:tipo "
            "AND servicio=:srv AND resuelta=false LIMIT 1"
        ), {"tid": tenant_id, "tipo": body.tipo, "srv": body.servicio}).fetchone()
        if existing:
            return {"id": existing._mapping["id"], "duplicate": True}

    row = db.execute(text(
        "INSERT INTO alertas_sistema (tenant_id,tipo,nivel,titulo,descripcion,servicio) "
        "VALUES (:tid,:tipo,:niv,:tit,:desc,:srv) RETURNING id"
    ), {
        "tid": tenant_id, "tipo": body.tipo, "niv": body.nivel,
        "tit": body.titulo, "desc": body.descripcion, "srv": body.servicio
    }).fetchone()
    db.commit()
    return {"id": row._mapping["id"]}


@router.patch("/{alerta_id}/ack")
def acknowledge_alerta(alerta_id: int, acknowledged_by: Optional[str] = None, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    db.execute(text(
        "UPDATE alertas_sistema SET acknowledged=true, acknowledged_by=:by, acknowledged_at=NOW() WHERE id=:id"
    ), {"by": acknowledged_by or current_user.get("nombre_completo", "sistema"), "id": alerta_id})
    db.commit()
    return {"ok": True}


@router.patch("/{alerta_id}/resolver")
def resolver_alerta(alerta_id: int, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    db.execute(text(
        "UPDATE alertas_sistema SET resuelta=true, acknowledged=true, resuelta_at=NOW() WHERE id=:id"
    ), {"id": alerta_id})
    db.commit()
    return {"ok": True}


@router.delete("/{alerta_id}")
def eliminar_alerta(alerta_id: int, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    db.execute(text("DELETE FROM alertas_sistema WHERE id=:id"), {"id": alerta_id})
    db.commit()
    return {"ok": True}


# ── Auto-create from semáforo ─────────────────────────────────────────────────
def auto_alerta_dispositivo(db: Session, tenant_id: int, nombre: str, ip: str):
    """Called by sistema.py estado endpoint when a device goes rojo."""
    try:
        _ensure_table(db)
        existing = db.execute(text(
            "SELECT id FROM alertas_sistema WHERE tenant_id=:tid AND tipo='dispositivo_offline' "
            "AND servicio=:srv AND resuelta=false LIMIT 1"
        ), {"tid": tenant_id, "srv": ip}).fetchone()
        if not existing:
            db.execute(text(
                "INSERT INTO alertas_sistema (tenant_id,tipo,nivel,titulo,descripcion,servicio) "
                "VALUES (:tid,'dispositivo_offline','error',:tit,:desc,:srv)"
            ), {
                "tid": tenant_id,
                "tit": "Dispositivo offline: " + nombre,
                "desc": "No se pudo conectar al dispositivo " + nombre + " (" + ip + ")",
                "srv": ip
            })
            db.commit()
    except Exception:
        db.rollback()


def auto_resolver_dispositivo(db: Session, tenant_id: int, ip: str):
    """Called when device comes back online."""
    try:
        _ensure_table(db)
        db.execute(text(
            "UPDATE alertas_sistema SET resuelta=true, resuelta_at=NOW() "
            "WHERE tenant_id=:tid AND tipo='dispositivo_offline' AND servicio=:srv AND resuelta=false"
        ), {"tid": tenant_id, "srv": ip})
        db.commit()
    except Exception:
        db.rollback()
