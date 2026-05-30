import os
import json
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional
from app.core.database import get_db
from app.core.dependencies import get_current_user, require_admin

router = APIRouter(prefix="/api/anomalias", tags=["Anomalias"])

CREATE_TABLE_SQL = (
    "CREATE TABLE IF NOT EXISTS anomalias_detectadas ("
    "id SERIAL PRIMARY KEY, "
    "tenant_id INTEGER NOT NULL, "
    "tipo VARCHAR(100) NOT NULL, "
    "descripcion TEXT NOT NULL, "
    "severidad VARCHAR(20) DEFAULT 'media', "
    "entidad_tipo VARCHAR(50), "
    "entidad_id INTEGER, "
    "datos_json JSONB, "
    "revisada BOOLEAN DEFAULT false, "
    "falso_positivo BOOLEAN DEFAULT false, "
    "created_at TIMESTAMPTZ DEFAULT NOW())"
)


def _ensure_table(db):
    db.execute(text(CREATE_TABLE_SQL))
    db.commit()


def _crear_anomalia(db, tenant_id, tipo, descripcion, severidad, entidad_tipo, entidad_id, datos):
    existing = db.execute(text(
        "SELECT id FROM anomalias_detectadas "
        "WHERE tenant_id=:tid AND tipo=:tipo AND revisada=false "
        "AND created_at >= NOW() - INTERVAL '1 hour' "
        "AND descripcion=:desc LIMIT 1"
    ), {"tid": tenant_id, "tipo": tipo, "desc": descripcion}).fetchone()
    if existing:
        return
    db.execute(text(
        "INSERT INTO anomalias_detectadas "
        "(tenant_id, tipo, descripcion, severidad, entidad_tipo, entidad_id, datos_json) "
        "VALUES (:tid, :tipo, :desc, :sev, :et, :eid, :datos)"
    ), {
        "tid": tenant_id, "tipo": tipo, "desc": descripcion, "sev": severidad,
        "et": entidad_tipo, "eid": entidad_id,
        "datos": json.dumps(datos, default=str)
    })
    db.commit()
    if severidad == "critica":
        try:
            db.execute(text(
                "INSERT INTO alertas_sistema (tenant_id, tipo, nivel, titulo, descripcion) "
                "VALUES (:tid, 'acceso_sospechoso', 'critico', :tit, :desc)"
            ), {"tid": tenant_id, "tit": "Anomalia detectada: " + tipo, "desc": descripcion})
            db.commit()
        except Exception:
            db.rollback()


def detectar_accesos_nocturnos(db, tenant_id):
    try:
        rows = db.execute(text(
            "SELECT * FROM historial_eventos "
            "WHERE tenant_id=:tid AND modulo='acceso' AND resultado='permitido' "
            "AND EXTRACT(HOUR FROM created_at) BETWEEN 0 AND 5 "
            "AND created_at >= NOW() - INTERVAL '24 hours'"
        ), {"tid": tenant_id}).fetchall()
        for r in rows:
            d = dict(r._mapping)
            _crear_anomalia(db, tenant_id, "acceso_nocturno",
                            "Acceso RFID entre 00:00-05:00: " + (d.get("descripcion") or ""),
                            "alta", "rfid", d["id"], d)
    except Exception:
        db.rollback()


def detectar_intentos_fallidos(db, tenant_id):
    try:
        rows = db.execute(text(
            "SELECT descripcion, COUNT(*) as intentos, MAX(created_at) as ultimo "
            "FROM historial_eventos "
            "WHERE tenant_id=:tid AND modulo='acceso' AND resultado LIKE '%denegado%' "
            "AND created_at >= NOW() - INTERVAL '30 minutes' "
            "GROUP BY descripcion HAVING COUNT(*) >= 3"
        ), {"tid": tenant_id}).fetchall()
        for r in rows:
            d = dict(r._mapping)
            msg = "3+ accesos denegados en 30 min: " + str(d.get("descripcion", ""))
            _crear_anomalia(db, tenant_id, "intentos_fallidos_repetidos",
                            msg, "critica", "rfid", None, d)
    except Exception:
        db.rollback()


def detectar_visitas_prolongadas(db, tenant_id):
    try:
        rows = db.execute(text(
            "SELECT * FROM visitas "
            "WHERE tenant_id=:tid AND hora_salida IS NULL "
            "AND hora_entrada < NOW() - INTERVAL '12 hours'"
        ), {"tid": tenant_id}).fetchall()
        for r in rows:
            d = dict(r._mapping)
            msg = ("Visita sin salida despues de 12h: " + str(d.get("nombre_visitante", ""))
                   + " Depto " + str(d.get("depto_destino", "")))
            _crear_anomalia(db, tenant_id, "visita_prolongada",
                            msg, "media", "visita", d["id"], d)
    except Exception:
        db.rollback()


def detectar_horario_inusual_puertas(db, tenant_id):
    try:
        rows = db.execute(text(
            "SELECT * FROM historial_eventos "
            "WHERE tenant_id=:tid AND modulo IN ('puerta','acceso') AND accion='abierta' "
            "AND EXTRACT(HOUR FROM created_at) BETWEEN 1 AND 4 "
            "AND created_at >= NOW() - INTERVAL '24 hours'"
        ), {"tid": tenant_id}).fetchall()
        for r in rows:
            d = dict(r._mapping)
            _crear_anomalia(db, tenant_id, "apertura_horario_inusual",
                            "Puerta abierta entre 01:00-04:00: " + (d.get("descripcion") or ""),
                            "alta", "acceso", d["id"], d)
    except Exception:
        db.rollback()


def _run_all_detections(db, tenant_id):
    _ensure_table(db)
    before = db.execute(text(
        "SELECT COUNT(*) FROM anomalias_detectadas WHERE tenant_id=:tid"
    ), {"tid": tenant_id}).scalar() or 0

    detectar_accesos_nocturnos(db, tenant_id)
    detectar_intentos_fallidos(db, tenant_id)
    detectar_visitas_prolongadas(db, tenant_id)
    detectar_horario_inusual_puertas(db, tenant_id)

    after = db.execute(text(
        "SELECT COUNT(*) FROM anomalias_detectadas WHERE tenant_id=:tid"
    ), {"tid": tenant_id}).scalar() or 0
    return int(after - before)


@router.post("/analizar")
async def analizar(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_id = current_user["tenant_id"]
    nuevas = _run_all_detections(db, tenant_id)
    return {"nuevas": nuevas, "mensaje": str(nuevas) + " nuevas anomalias detectadas"}


@router.get("")
async def listar(
    revisada: Optional[bool] = Query(None),
    severidad: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    tenant_id = current_user["tenant_id"]
    _ensure_table(db)
    conditions = ["tenant_id=:tid"]
    params = {"tid": tenant_id}
    if revisada is not None:
        conditions.append("revisada=:revisada")
        params["revisada"] = revisada
    if severidad:
        conditions.append("severidad=:severidad")
        params["severidad"] = severidad
    where = " AND ".join(conditions)
    sql = "SELECT * FROM anomalias_detectadas WHERE " + where + " ORDER BY created_at DESC LIMIT 200"
    rows = db.execute(text(sql), params).fetchall()
    result = []
    for r in rows:
        d = dict(r._mapping)
        for k, v in d.items():
            if hasattr(v, "isoformat"):
                d[k] = str(v)
        result.append(d)
    return result


@router.patch("/{anomalia_id}/revisar")
async def revisar(anomalia_id: int, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    _ensure_table(db)
    db.execute(text("UPDATE anomalias_detectadas SET revisada=true WHERE id=:id"), {"id": anomalia_id})
    db.commit()
    return {"ok": True}


@router.patch("/{anomalia_id}/falso-positivo")
async def falso_positivo(anomalia_id: int, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    _ensure_table(db)
    db.execute(text(
        "UPDATE anomalias_detectadas SET falso_positivo=true, revisada=true WHERE id=:id"
    ), {"id": anomalia_id})
    db.commit()
    return {"ok": True}


@router.get("/resumen")
async def resumen(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_id = current_user["tenant_id"]
    _ensure_table(db)
    rows = db.execute(text(
        "SELECT severidad, COUNT(*) as total "
        "FROM anomalias_detectadas "
        "WHERE tenant_id=:tid AND revisada=false "
        "GROUP BY severidad"
    ), {"tid": tenant_id}).fetchall()
    counts = {"critica": 0, "alta": 0, "media": 0, "baja": 0}
    for r in rows:
        d = dict(r._mapping)
        counts[d["severidad"]] = int(d["total"])
    counts["total"] = sum(counts.values())
    return counts


@router.post("/analizar-todos")
async def analizar_todos(current_user: dict = Depends(require_admin), db: Session = Depends(get_db)):
    _ensure_table(db)
    tenants = db.execute(text("SELECT id FROM tenants")).fetchall()
    results = {}
    for t in tenants:
        tid = t[0]
        nuevas = _run_all_detections(db, tid)
        results[str(tid)] = nuevas
    total = sum(results.values())
    return {"tenants_procesados": len(results), "total_nuevas": total, "detalle": results}
