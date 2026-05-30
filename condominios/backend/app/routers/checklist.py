"""
Checklist de Rondas del Conserje
GET    /api/checklist/plantillas           → listar plantillas
POST   /api/checklist/plantillas           → crear plantilla con items
GET    /api/checklist/plantillas/{id}      → detalle plantilla
DELETE /api/checklist/plantillas/{id}      → desactivar plantilla
POST   /api/checklist/rondas              → iniciar ronda
GET    /api/checklist/rondas              → historial de rondas
GET    /api/checklist/rondas/{id}         → detalle ronda con respuestas
PATCH  /api/checklist/rondas/{id}/item/{item_id}    → responder item
PATCH  /api/checklist/rondas/{id}/finalizar         → marcar ronda completa
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional, List
from pydantic import BaseModel
from app.core.database import get_db
from app.core.dependencies import get_current_user

router = APIRouter(prefix="/api/checklist", tags=["Checklist"])


def _ensure_tables(db: Session):
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS checklist_plantillas (
            id SERIAL PRIMARY KEY,
            tenant_id INTEGER NOT NULL,
            nombre VARCHAR(200) NOT NULL,
            turno VARCHAR(20) DEFAULT 'cualquiera',
            activo BOOLEAN DEFAULT true,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    """))
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS checklist_items (
            id SERIAL PRIMARY KEY,
            plantilla_id INTEGER REFERENCES checklist_plantillas(id) ON DELETE CASCADE,
            tenant_id INTEGER NOT NULL,
            orden INTEGER NOT NULL,
            descripcion VARCHAR(300) NOT NULL,
            zona VARCHAR(100),
            obligatorio BOOLEAN DEFAULT true
        )
    """))
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS checklist_rondas (
            id SERIAL PRIMARY KEY,
            tenant_id INTEGER NOT NULL,
            plantilla_id INTEGER REFERENCES checklist_plantillas(id),
            conserje_id INTEGER,
            conserje_nombre VARCHAR(200),
            turno VARCHAR(20),
            fecha_inicio TIMESTAMPTZ DEFAULT NOW(),
            fecha_fin TIMESTAMPTZ,
            estado VARCHAR(20) DEFAULT 'en_curso',
            items_total INTEGER DEFAULT 0,
            items_completados INTEGER DEFAULT 0,
            notas_generales TEXT
        )
    """))
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS checklist_respuestas (
            id SERIAL PRIMARY KEY,
            ronda_id INTEGER REFERENCES checklist_rondas(id) ON DELETE CASCADE,
            item_id INTEGER REFERENCES checklist_items(id),
            tenant_id INTEGER NOT NULL,
            estado VARCHAR(20) NOT NULL,
            notas TEXT,
            foto_url TEXT,
            respondido_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(ronda_id, item_id)
        )
    """))
    db.commit()


class ItemCreate(BaseModel):
    orden: int
    descripcion: str
    zona: Optional[str] = None
    obligatorio: bool = True


class PlantillaCreate(BaseModel):
    tenant_id: int
    nombre: str
    turno: str = "cualquiera"
    items: List[ItemCreate] = []


class RondaCreate(BaseModel):
    tenant_id: int
    plantilla_id: int
    conserje_id: Optional[int] = None
    conserje_nombre: str
    turno: Optional[str] = None


class RespuestaItem(BaseModel):
    estado: str   # ok | problema | na
    notas: Optional[str] = None
    foto_url: Optional[str] = None


@router.get("/plantillas")
def listar_plantillas(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_id = current_user["tenant_id"]
    _ensure_tables(db)
    rows = db.execute(text(
        "SELECT p.*, COUNT(i.id) as total_items FROM checklist_plantillas p "
        "LEFT JOIN checklist_items i ON i.plantilla_id=p.id "
        "WHERE p.tenant_id=:tid AND p.activo=true GROUP BY p.id ORDER BY p.nombre"
    ), {"tid": tenant_id}).fetchall()
    result = []
    for r in rows:
        d = dict(r._mapping)
        d["created_at"] = str(d.get("created_at") or "")
        result.append(d)
    return result


@router.post("/plantillas", status_code=201)
def crear_plantilla(body: PlantillaCreate, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_id = current_user["tenant_id"]
    _ensure_tables(db)
    row = db.execute(text(
        "INSERT INTO checklist_plantillas (tenant_id, nombre, turno) "
        "VALUES (:tid, :nom, :turno) RETURNING id"
    ), {"tid": body.tenant_id, "nom": body.nombre, "turno": body.turno}).fetchone()
    pid = row._mapping["id"]
    for item in body.items:
        db.execute(text(
            "INSERT INTO checklist_items (plantilla_id, tenant_id, orden, descripcion, zona, obligatorio) "
            "VALUES (:pid, :tid, :ord, :desc, :zona, :oblig)"
        ), {"pid": pid, "tid": body.tenant_id, "ord": item.orden,
            "desc": item.descripcion, "zona": item.zona, "oblig": item.obligatorio})
    db.commit()
    return {"id": pid}


@router.get("/plantillas/{plantilla_id}")
def get_plantilla(plantilla_id: int, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_id = current_user["tenant_id"]
    _ensure_tables(db)
    p = db.execute(text("SELECT * FROM checklist_plantillas WHERE id=:id"),
                   {"id": plantilla_id}).fetchone()
    if not p:
        raise HTTPException(404, "Plantilla no encontrada")
    items = db.execute(text(
        "SELECT * FROM checklist_items WHERE plantilla_id=:pid ORDER BY orden"
    ), {"pid": plantilla_id}).fetchall()
    return {**dict(p._mapping), "items": [dict(i._mapping) for i in items]}


@router.delete("/plantillas/{plantilla_id}")
def eliminar_plantilla(plantilla_id: int, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_id = current_user["tenant_id"]
    db.execute(text("UPDATE checklist_plantillas SET activo=false WHERE id=:id"),
               {"id": plantilla_id})
    db.commit()
    return {"ok": True}


@router.post("/rondas", status_code=201)
def iniciar_ronda(body: RondaCreate, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_id = current_user["tenant_id"]
    _ensure_tables(db)
    items = db.execute(text(
        "SELECT COUNT(*) as c FROM checklist_items WHERE plantilla_id=:pid"
    ), {"pid": body.plantilla_id}).fetchone()
    total = int(items._mapping["c"]) if items else 0
    row = db.execute(text(
        "INSERT INTO checklist_rondas (tenant_id, plantilla_id, conserje_id, conserje_nombre, turno, items_total) "
        "VALUES (:tid, :pid, :cid, :cnom, :turno, :total) RETURNING id"
    ), {"tid": body.tenant_id, "pid": body.plantilla_id, "cid": body.conserje_id,
        "cnom": body.conserje_nombre, "turno": body.turno, "total": total}).fetchone()
    db.commit()
    ronda_id = row._mapping["id"]
    # Return items to fill
    items_list = db.execute(text(
        "SELECT * FROM checklist_items WHERE plantilla_id=:pid ORDER BY orden"
    ), {"pid": body.plantilla_id}).fetchall()
    return {"id": ronda_id, "items": [dict(i._mapping) for i in items_list]}


@router.get("/rondas")
def listar_rondas(
    fecha: Optional[str] = None,
    limit: int = 50,
    current_user: dict = Depends(get_current_user), db: Session = Depends(get_db),
):
    tenant_id = current_user["tenant_id"]
    _ensure_tables(db)
    sql = ("SELECT r.*, p.nombre as plantilla_nombre FROM checklist_rondas r "
           "LEFT JOIN checklist_plantillas p ON p.id=r.plantilla_id "
           "WHERE r.tenant_id=:tid")
    params: dict = {"tid": tenant_id}
    if fecha:
        sql += " AND DATE(r.fecha_inicio)=:fecha"
        params["fecha"] = fecha
    sql += " ORDER BY r.fecha_inicio DESC LIMIT :lim"
    params["lim"] = limit
    rows = db.execute(text(sql), params).fetchall()
    result = []
    for r in rows:
        d = dict(r._mapping)
        d["fecha_inicio"] = str(d.get("fecha_inicio") or "")
        d["fecha_fin"] = str(d.get("fecha_fin") or "")
        result.append(d)
    return result


@router.get("/rondas/{ronda_id}")
def get_ronda(ronda_id: int, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_id = current_user["tenant_id"]
    _ensure_tables(db)
    ronda = db.execute(text("SELECT * FROM checklist_rondas WHERE id=:id"),
                       {"id": ronda_id}).fetchone()
    if not ronda:
        raise HTTPException(404, "Ronda no encontrada")
    d = dict(ronda._mapping)
    d["fecha_inicio"] = str(d.get("fecha_inicio") or "")
    d["fecha_fin"] = str(d.get("fecha_fin") or "")
    # Items + responses
    items = db.execute(text(
        "SELECT i.*, r.estado as resp_estado, r.notas as resp_notas, r.foto_url as resp_foto, r.respondido_at "
        "FROM checklist_items i "
        "LEFT JOIN checklist_respuestas r ON r.item_id=i.id AND r.ronda_id=:rid "
        "WHERE i.plantilla_id=:pid ORDER BY i.orden"
    ), {"rid": ronda_id, "pid": d["plantilla_id"]}).fetchall()
    d["items"] = [dict(i._mapping) for i in items]
    return d


@router.patch("/rondas/{ronda_id}/item/{item_id}")
def responder_item(ronda_id: int, item_id: int, body: RespuestaItem,
                   current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_id = current_user["tenant_id"]
    if body.estado not in ("ok", "problema", "na"):
        raise HTTPException(400, "Estado debe ser: ok, problema, na")
    db.execute(text(
        "INSERT INTO checklist_respuestas (ronda_id, item_id, tenant_id, estado, notas, foto_url) "
        "SELECT :rid, :iid, tenant_id, :est, :notas, :foto FROM checklist_rondas WHERE id=:rid "
        "ON CONFLICT (ronda_id, item_id) DO UPDATE SET estado=:est, notas=:notas, foto_url=:foto, respondido_at=NOW()"
    ), {"rid": ronda_id, "iid": item_id, "est": body.estado,
        "notas": body.notas, "foto": body.foto_url})
    # Update count
    count = db.execute(text(
        "SELECT COUNT(*) as c FROM checklist_respuestas WHERE ronda_id=:rid"
    ), {"rid": ronda_id}).fetchone()
    db.execute(text("UPDATE checklist_rondas SET items_completados=:c WHERE id=:id"),
               {"c": int(count._mapping["c"]), "id": ronda_id})
    db.commit()
    return {"ok": True}


@router.patch("/rondas/{ronda_id}/finalizar")
def finalizar_ronda(ronda_id: int, notas: Optional[str] = None,
                    current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_id = current_user["tenant_id"]
    db.execute(text(
        "UPDATE checklist_rondas SET estado='completada', fecha_fin=NOW(), notas_generales=:notas WHERE id=:id"
    ), {"notas": notas, "id": ronda_id})
    db.commit()
    return {"ok": True}
