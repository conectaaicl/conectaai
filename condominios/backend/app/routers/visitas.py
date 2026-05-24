"""
Visitas y Estacionamientos de visita
POST   /api/visitas                      → registrar entrada
PATCH  /api/visitas/{id}/salida          → marcar salida
GET    /api/visitas                      → listar (activas o historial)
GET    /api/visitas/activas              → solo sin salida (para Central)

POST   /api/estacionamientos             → asignar spot a visita
PATCH  /api/estacionamientos/{id}/liberar→ liberar spot
GET    /api/estacionamientos             → listar spots
GET    /api/estacionamientos/config      → spots configurados del condominio
POST   /api/estacionamientos/config      → crear/editar spots (admin)
"""
import os
import time
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional
from pydantic import BaseModel
from app.core.database import get_db
import httpx

router = APIRouter(prefix="/api/visitas", tags=["Visitas"])
router_estac = APIRouter(prefix="/api/estacionamientos", tags=["Estacionamientos"])


# ── Tables ───────────────────────────────────────────────────────────────────

def _ensure_tables(db: Session):
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS visitas (
            id SERIAL PRIMARY KEY,
            tenant_id INTEGER NOT NULL,
            condominio_id INTEGER,
            nombre_visitante VARCHAR(200) NOT NULL,
            rut_visitante VARCHAR(20),
            telefono_visitante VARCHAR(20),
            depto_destino VARCHAR(20),
            nombre_residente VARCHAR(200),
            motivo VARCHAR(100) DEFAULT 'visita',
            patente VARCHAR(20),
            tipo_vehiculo VARCHAR(50),
            spot_asignado VARCHAR(20),
            registrado_por INTEGER,
            registrado_por_nombre VARCHAR(200),
            entrada_at TIMESTAMPTZ DEFAULT NOW(),
            salida_at TIMESTAMPTZ,
            observaciones TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS estacionamientos_config (
            id SERIAL PRIMARY KEY,
            tenant_id INTEGER NOT NULL,
            condominio_id INTEGER,
            codigo VARCHAR(20) NOT NULL,
            descripcion VARCHAR(100),
            tipo VARCHAR(30) DEFAULT 'visita',
            activo BOOLEAN DEFAULT true,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(tenant_id, codigo)
        );

        CREATE TABLE IF NOT EXISTS estacionamientos_ocupacion (
            id SERIAL PRIMARY KEY,
            tenant_id INTEGER NOT NULL,
            spot_codigo VARCHAR(20) NOT NULL,
            visita_id INTEGER REFERENCES visitas(id) ON DELETE SET NULL,
            patente VARCHAR(20),
            nombre_conductor VARCHAR(200),
            entrada_at TIMESTAMPTZ DEFAULT NOW(),
            salida_at TIMESTAMPTZ,
            activo BOOLEAN DEFAULT true
        )
    """))
    db.commit()


# ── Schemas ───────────────────────────────────────────────────────────────────

class VisitaCreate(BaseModel):
    tenant_id: int
    condominio_id: Optional[int] = None
    nombre_visitante: str
    rut_visitante: Optional[str] = None
    telefono_visitante: Optional[str] = None
    depto_destino: Optional[str] = None
    nombre_residente: Optional[str] = None
    motivo: str = "visita"          # visita | delivery | proveedor | tecnico | otro
    patente: Optional[str] = None
    tipo_vehiculo: Optional[str] = None  # auto | moto | camioneta | furgon
    spot_asignado: Optional[str] = None
    registrado_por: Optional[int] = None
    registrado_por_nombre: Optional[str] = None
    observaciones: Optional[str] = None

class EstacConfigCreate(BaseModel):
    tenant_id: int
    condominio_id: Optional[int] = None
    codigos: list  # ["E1","E2","E3","V-A","V-B"]
    tipo: str = "visita"

class EstacOcupar(BaseModel):
    tenant_id: int
    spot_codigo: str
    visita_id: Optional[int] = None
    patente: Optional[str] = None
    nombre_conductor: Optional[str] = None


# ── VISITAS routes ────────────────────────────────────────────────────────────

@router.post("", status_code=201)
def crear_visita(body: VisitaCreate, db: Session = Depends(get_db)):
    _ensure_tables(db)
    row = db.execute(text(
        "INSERT INTO visitas (tenant_id,condominio_id,nombre_visitante,rut_visitante,"
        "telefono_visitante,depto_destino,nombre_residente,motivo,patente,"
        "tipo_vehiculo,spot_asignado,registrado_por,registrado_por_nombre,observaciones) "
        "VALUES (:tid,:cid,:nom,:rut,:tel,:depto,:res,:motivo,:pat,:tveh,:spot,:regid,:regnm,:obs) "
        "RETURNING id, entrada_at"
    ), {
        "tid": body.tenant_id, "cid": body.condominio_id,
        "nom": body.nombre_visitante, "rut": body.rut_visitante,
        "tel": body.telefono_visitante, "depto": body.depto_destino,
        "res": body.nombre_residente, "motivo": body.motivo,
        "pat": body.patente, "tveh": body.tipo_vehiculo,
        "spot": body.spot_asignado, "regid": body.registrado_por,
        "regnm": body.registrado_por_nombre, "obs": body.observaciones
    }).fetchone()
    db.commit()

    # Si viene con spot, ocuparlo automáticamente
    if body.spot_asignado and body.patente:
        try:
            db.execute(text(
                "INSERT INTO estacionamientos_ocupacion "
                "(tenant_id,spot_codigo,visita_id,patente,nombre_conductor) "
                "VALUES (:tid,:spot,:vid,:pat,:nom)"
            ), {"tid": body.tenant_id, "spot": body.spot_asignado,
                "vid": row._mapping["id"], "pat": body.patente,
                "nom": body.nombre_visitante})
            db.commit()
        except Exception:
            db.rollback()

    return {
        "id": row._mapping["id"],
        "entrada_at": str(row._mapping["entrada_at"]),
        "nombre_visitante": body.nombre_visitante
    }


@router.patch("/{visita_id}/salida")
def registrar_salida(visita_id: int, db: Session = Depends(get_db)):
    _ensure_tables(db)
    v = db.execute(text("SELECT * FROM visitas WHERE id=:id"), {"id": visita_id}).fetchone()
    if not v:
        raise HTTPException(404, "Visita no encontrada")
    d = dict(v._mapping)
    db.execute(text("UPDATE visitas SET salida_at=NOW() WHERE id=:id"), {"id": visita_id})
    # Liberar estacionamiento si corresponde
    db.execute(text("UPDATE estacionamientos_ocupacion SET salida_at=NOW(), activo=false WHERE visita_id=:vid AND activo=true"), {"vid": visita_id})
    db.commit()
    return {"ok": True, "nombre_visitante": d["nombre_visitante"]}


@router.get("")
def listar_visitas(
    tenant_id: int,
    condominio_id: Optional[int] = None,
    activas: Optional[bool] = None,
    depto: Optional[str] = None,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    _ensure_tables(db)
    sql = "SELECT * FROM visitas WHERE tenant_id=:tid"
    params: dict = {"tid": tenant_id}
    if condominio_id:
        sql += " AND condominio_id=:cid"; params["cid"] = condominio_id
    if activas is True:
        sql += " AND salida_at IS NULL"
    elif activas is False:
        sql += " AND salida_at IS NOT NULL"
    if depto:
        sql += " AND depto_destino ILIKE :depto"; params["depto"] = "%" + depto + "%"
    sql += " ORDER BY entrada_at DESC LIMIT :lim"; params["lim"] = limit
    rows = db.execute(text(sql), params).fetchall()
    result = []
    for r in rows:
        d = dict(r._mapping)
        d["entrada_at"] = str(d.get("entrada_at") or "")
        d["salida_at"] = str(d.get("salida_at") or "")
        d["created_at"] = str(d.get("created_at") or "")
        result.append(d)
    return result


@router.get("/activas")
def visitas_activas(tenant_id: int, condominio_id: Optional[int] = None, db: Session = Depends(get_db)):
    """Quick endpoint for the Central page: visitors currently in the building."""
    _ensure_tables(db)
    sql = "SELECT id,nombre_visitante,rut_visitante,depto_destino,nombre_residente,motivo,spot_asignado,patente,entrada_at::text FROM visitas WHERE tenant_id=:tid AND salida_at IS NULL"
    params: dict = {"tid": tenant_id}
    if condominio_id:
        sql += " AND condominio_id=:cid"; params["cid"] = condominio_id
    sql += " ORDER BY entrada_at DESC"
    rows = db.execute(text(sql), params).fetchall()
    return [dict(r._mapping) for r in rows]


# ── ESTACIONAMIENTOS routes ───────────────────────────────────────────────────

@router_estac.get("/config")
def listar_config(tenant_id: int, condominio_id: Optional[int] = None, db: Session = Depends(get_db)):
    _ensure_tables(db)
    sql = "SELECT * FROM estacionamientos_config WHERE tenant_id=:tid AND activo=true"
    params: dict = {"tid": tenant_id}
    if condominio_id:
        sql += " AND condominio_id=:cid"; params["cid"] = condominio_id
    sql += " ORDER BY codigo"
    rows = db.execute(text(sql), params).fetchall()
    return [dict(r._mapping) for r in rows]


@router_estac.post("/config", status_code=201)
def crear_config(body: EstacConfigCreate, db: Session = Depends(get_db)):
    _ensure_tables(db)
    creados = 0
    for codigo in body.codigos:
        try:
            db.execute(text(
                "INSERT INTO estacionamientos_config (tenant_id,condominio_id,codigo,tipo) "
                "VALUES (:tid,:cid,:cod,:tipo) ON CONFLICT (tenant_id,codigo) DO NOTHING"
            ), {"tid": body.tenant_id, "cid": body.condominio_id, "cod": str(codigo).strip(), "tipo": body.tipo})
            creados += 1
        except Exception:
            pass
    db.commit()
    return {"creados": creados}


@router_estac.get("")
def listar_ocupacion(tenant_id: int, condominio_id: Optional[int] = None, solo_activos: bool = True, db: Session = Depends(get_db)):
    """Returns spots with their current occupation status."""
    _ensure_tables(db)
    # Config spots
    cfg_sql = "SELECT codigo, descripcion FROM estacionamientos_config WHERE tenant_id=:tid AND activo=true"
    cfg_params: dict = {"tid": tenant_id}
    if condominio_id:
        cfg_sql += " AND condominio_id=:cid"; cfg_params["cid"] = condominio_id
    cfg_sql += " ORDER BY codigo"
    spots = {r._mapping["codigo"]: {"codigo": r._mapping["codigo"], "descripcion": r._mapping.get("descripcion"), "ocupado": False, "ocupacion": None}
             for r in db.execute(text(cfg_sql), cfg_params).fetchall()}

    # Ocupados
    ocp = db.execute(text(
        "SELECT * FROM estacionamientos_ocupacion WHERE tenant_id=:tid AND activo=true ORDER BY entrada_at DESC"
    ), {"tid": tenant_id}).fetchall()
    for r in ocp:
        d = dict(r._mapping)
        d["entrada_at"] = str(d.get("entrada_at") or "")
        codigo = d["spot_codigo"]
        if codigo in spots:
            spots[codigo]["ocupado"] = True
            spots[codigo]["ocupacion"] = d
        else:
            # Spot occupied but not in config (manual assignment)
            spots[codigo] = {"codigo": codigo, "descripcion": None, "ocupado": True, "ocupacion": d}

    return list(spots.values())


@router_estac.post("", status_code=201)
def ocupar_spot(body: EstacOcupar, db: Session = Depends(get_db)):
    _ensure_tables(db)
    # Check if already occupied
    existing = db.execute(text(
        "SELECT id FROM estacionamientos_ocupacion WHERE tenant_id=:tid AND spot_codigo=:spot AND activo=true LIMIT 1"
    ), {"tid": body.tenant_id, "spot": body.spot_codigo}).fetchone()
    if existing:
        raise HTTPException(409, "Spot ya está ocupado")
    row = db.execute(text(
        "INSERT INTO estacionamientos_ocupacion (tenant_id,spot_codigo,visita_id,patente,nombre_conductor) "
        "VALUES (:tid,:spot,:vid,:pat,:nom) RETURNING id"
    ), {"tid": body.tenant_id, "spot": body.spot_codigo, "vid": body.visita_id,
        "pat": body.patente, "nom": body.nombre_conductor}).fetchone()
    db.commit()
    return {"id": row._mapping["id"], "spot": body.spot_codigo}


@router_estac.patch("/{ocupacion_id}/liberar")
def liberar_spot(ocupacion_id: int, db: Session = Depends(get_db)):
    db.execute(text("UPDATE estacionamientos_ocupacion SET salida_at=NOW(), activo=false WHERE id=:id"), {"id": ocupacion_id})
    db.commit()
    return {"ok": True}
