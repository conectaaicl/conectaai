"""
Módulo Cámaras — registro y snapshots de cámaras IP (sin ffmpeg)
Módulo Alarmas — zonas, armado/desarmado, alertas, notificaciones
"""
import os
import time
import socket
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional
from pydantic import BaseModel
import httpx
from app.core.database import get_db
from app.core.dependencies import get_current_user

router_camaras = APIRouter(prefix="/api/camaras", tags=["Cámaras"])
router_alarmas = APIRouter(prefix="/api/alarmas", tags=["Alarmas"])

# ────────────────────────────────────────────────────────────────────────────
# HELPERS
# ────────────────────────────────────────────────────────────────────────────

def _ensure_tables(db: Session):
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS camaras (
            id SERIAL PRIMARY KEY,
            tenant_id INTEGER NOT NULL,
            nombre VARCHAR(100) NOT NULL,
            ubicacion VARCHAR(200),
            ip VARCHAR(45) NOT NULL,
            puerto INTEGER DEFAULT 80,
            rtsp_url VARCHAR(500),
            snapshot_url VARCHAR(500),
            onvif_puerto INTEGER DEFAULT 8000,
            usuario VARCHAR(100),
            password VARCHAR(100),
            modelo VARCHAR(100),
            activa BOOLEAN DEFAULT true,
            ultimo_estado VARCHAR(20) DEFAULT 'desconocido',
            ultima_comprobacion TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS zonas_alarma (
            id SERIAL PRIMARY KEY,
            tenant_id INTEGER NOT NULL,
            condominio_id INTEGER,
            nombre VARCHAR(100) NOT NULL,
            descripcion TEXT,
            tipo VARCHAR(50) DEFAULT 'perimetro',
            estado VARCHAR(20) DEFAULT 'desarmada',
            activa BOOLEAN DEFAULT true,
            horario_auto_armar VARCHAR(5),
            horario_auto_desarmar VARCHAR(5),
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS alertas_alarma (
            id SERIAL PRIMARY KEY,
            tenant_id INTEGER NOT NULL,
            zona_id INTEGER REFERENCES zonas_alarma(id) ON DELETE SET NULL,
            tipo VARCHAR(50) NOT NULL,
            descripcion TEXT,
            nivel VARCHAR(20) DEFAULT 'media',
            resuelta BOOLEAN DEFAULT false,
            notificado BOOLEAN DEFAULT false,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            resuelta_at TIMESTAMPTZ
        )
    """))
    db.commit()


def _notificar_alerta(db, tenant_id: int, zona_nombre: str, tipo: str, descripcion: str):
    try:
        mail_url = os.getenv("MAIL_API_URL", "http://localhost:3004/api/send")
        mail_key = os.getenv("MAIL_API_KEY", "")
        admins = db.execute(text(
            "SELECT email FROM personas WHERE tenant_id=:tid AND estado='activo' "
            "AND roles && ARRAY['administrador','sub_administrador']::text[] "
            "AND email IS NOT NULL AND email!='' LIMIT 5"
        ), {"tid": tenant_id}).fetchall()
        html = (
            "<h2 style='color:red'>&#x1F6A8; ALERTA DE ALARMA</h2>"
            "<p><b>Zona:</b> " + zona_nombre + "</p>"
            "<p><b>Tipo:</b> " + tipo + "</p>"
            "<p><b>Descripcion:</b> " + descripcion + "</p>"
            "<p style='color:#888;font-size:12px'>ConectaAI Seguridad</p>"
        )
        for admin in admins:
            try:
                httpx.post(mail_url,
                    json={"to": admin._mapping["email"], "from": "seguridad@conectaai.cl",
                          "subject": "ALERTA: " + tipo + " en " + zona_nombre, "html": html},
                    headers={"Authorization": "Bearer " + mail_key}, timeout=5)
            except Exception:
                pass
    except Exception:
        pass


# ════════════════════════════════════════════════════════════════════════════
# CÁMARAS
# ════════════════════════════════════════════════════════════════════════════

class CamaraCreate(BaseModel):
    nombre: str
    ubicacion: Optional[str] = None
    ip: str
    puerto: int = 80
    rtsp_url: Optional[str] = None
    snapshot_url: Optional[str] = None
    onvif_puerto: int = 8000
    usuario: Optional[str] = None
    password: Optional[str] = None
    modelo: Optional[str] = None

class CamaraUpdate(BaseModel):
    nombre: Optional[str] = None
    ubicacion: Optional[str] = None
    ip: Optional[str] = None
    puerto: Optional[int] = None
    rtsp_url: Optional[str] = None
    snapshot_url: Optional[str] = None
    usuario: Optional[str] = None
    password: Optional[str] = None
    modelo: Optional[str] = None
    activa: Optional[bool] = None


@router_camaras.get("")
def list_camaras(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_id = current_user["tenant_id"]
    _ensure_tables(db)
    rows = db.execute(text(
        "SELECT id,nombre,ubicacion,ip,puerto,rtsp_url,snapshot_url,onvif_puerto,"
        "modelo,activa,ultimo_estado,ultima_comprobacion::text FROM camaras "
        "WHERE tenant_id=:tid ORDER BY nombre"
    ), {"tid": tenant_id}).fetchall()
    return [dict(r._mapping) for r in rows]


@router_camaras.post("", status_code=201)
def crear_camara(body: CamaraCreate, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_id = current_user["tenant_id"]
    _ensure_tables(db)
    row = db.execute(text(
        "INSERT INTO camaras (tenant_id,nombre,ubicacion,ip,puerto,rtsp_url,snapshot_url,"
        "onvif_puerto,usuario,password,modelo) "
        "VALUES (:tid,:nom,:ubic,:ip,:port,:rtsp,:snap,:onvif,:user,:pass,:mod) RETURNING id"
    ), {
        "tid": tenant_id, "nom": body.nombre, "ubic": body.ubicacion,
        "ip": body.ip, "port": body.puerto, "rtsp": body.rtsp_url,
        "snap": body.snapshot_url, "onvif": body.onvif_puerto,
        "user": body.usuario, "pass": body.password, "mod": body.modelo
    }).fetchone()
    db.commit()
    return {"id": row._mapping["id"], "nombre": body.nombre}


@router_camaras.put("/{camara_id}")
def actualizar_camara(camara_id: int, body: CamaraUpdate, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    updates = {k: v for k, v in body.model_dump(exclude_unset=True).items()}
    if not updates:
        raise HTTPException(400, "Sin cambios")
    set_clause = ", ".join(f"{k}=:{k}" for k in updates)
    updates["id"] = camara_id
    db.execute(text(f"UPDATE camaras SET {set_clause} WHERE id=:id"), updates)
    db.commit()
    return {"ok": True}


@router_camaras.delete("/{camara_id}")
def eliminar_camara(camara_id: int, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    db.execute(text("DELETE FROM camaras WHERE id=:id"), {"id": camara_id})
    db.commit()
    return {"ok": True}


@router_camaras.get("/{camara_id}/snapshot")
def snapshot_camara(camara_id: int, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Proxy the camera snapshot image to avoid CORS/auth issues."""
    _ensure_tables(db)
    row = db.execute(text("SELECT * FROM camaras WHERE id=:id"), {"id": camara_id}).fetchone()
    if not row:
        raise HTTPException(404, "Camara no encontrada")
    d = dict(row._mapping)

    snap_url = d.get("snapshot_url")
    if not snap_url:
        base = "http://" + d["ip"] + ":" + str(d["puerto"])
        snap_url = base + "/snapshot.jpg"

    auth = None
    if d.get("usuario") and d.get("password"):
        auth = (d["usuario"], d["password"])

    try:
        r = httpx.get(snap_url, auth=auth, timeout=8, follow_redirects=True)
        if r.status_code == 200:
            try:
                db.execute(text("UPDATE camaras SET ultimo_estado='verde', ultima_comprobacion=NOW() WHERE id=:id"), {"id": camara_id})
                db.commit()
            except Exception:
                db.rollback()
            ct = r.headers.get("content-type", "image/jpeg")
            return StreamingResponse(iter([r.content]), media_type=ct)
        raise HTTPException(r.status_code, "Camera returned " + str(r.status_code))
    except httpx.ConnectError:
        try:
            db.execute(text("UPDATE camaras SET ultimo_estado='rojo', ultima_comprobacion=NOW() WHERE id=:id"), {"id": camara_id})
            db.commit()
        except Exception:
            db.rollback()
        raise HTTPException(503, "No se puede conectar a la camara")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))


@router_camaras.post("/{camara_id}/test")
def test_camara(camara_id: int, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    _ensure_tables(db)
    row = db.execute(text("SELECT * FROM camaras WHERE id=:id"), {"id": camara_id}).fetchone()
    if not row:
        raise HTTPException(404, "Camara no encontrada")
    d = dict(row._mapping)
    t0 = time.monotonic()
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(3.0)
        result = s.connect_ex((d["ip"], d["puerto"]))
        s.close()
        latency = round((time.monotonic() - t0) * 1000, 1)
        ok = result == 0
    except Exception:
        ok = False
        latency = round((time.monotonic() - t0) * 1000, 1)
    estado = "verde" if ok else "rojo"
    try:
        db.execute(text("UPDATE camaras SET ultimo_estado=:est, ultima_comprobacion=NOW() WHERE id=:id"), {"est": estado, "id": camara_id})
        db.commit()
    except Exception:
        db.rollback()
    return {"ok": ok, "estado": estado, "latency_ms": latency, "ip": d["ip"], "puerto": d["puerto"]}


# ════════════════════════════════════════════════════════════════════════════
# ALARMAS
# ════════════════════════════════════════════════════════════════════════════

class ZonaCreate(BaseModel):
    condominio_id: Optional[int] = None
    nombre: str
    descripcion: Optional[str] = None
    tipo: str = "perimetro"
    horario_auto_armar: Optional[str] = None
    horario_auto_desarmar: Optional[str] = None

class ZonaUpdate(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    tipo: Optional[str] = None
    horario_auto_armar: Optional[str] = None
    horario_auto_desarmar: Optional[str] = None
    activa: Optional[bool] = None

class ArmadoRequest(BaseModel):
    estado: str

class AlertaCreate(BaseModel):
    zona_id: Optional[int] = None
    tipo: str
    descripcion: Optional[str] = None
    nivel: str = "media"


@router_alarmas.get("/zonas")
def list_zonas(condominio_id: Optional[int] = None, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_id = current_user["tenant_id"]
    _ensure_tables(db)
    sql = "SELECT * FROM zonas_alarma WHERE tenant_id=:tid"
    params: dict = {"tid": tenant_id}
    if condominio_id:
        sql += " AND condominio_id=:cid"
        params["cid"] = condominio_id
    sql += " ORDER BY nombre"
    rows = db.execute(text(sql), params).fetchall()
    return [dict(r._mapping) for r in rows]


@router_alarmas.post("/zonas", status_code=201)
def crear_zona(body: ZonaCreate, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_id = current_user["tenant_id"]
    _ensure_tables(db)
    row = db.execute(text(
        "INSERT INTO zonas_alarma (tenant_id,condominio_id,nombre,descripcion,tipo,"
        "horario_auto_armar,horario_auto_desarmar) "
        "VALUES (:tid,:cid,:nom,:desc,:tipo,:armar,:desarmar) RETURNING id"
    ), {
        "tid": tenant_id, "cid": body.condominio_id, "nom": body.nombre,
        "desc": body.descripcion, "tipo": body.tipo,
        "armar": body.horario_auto_armar, "desarmar": body.horario_auto_desarmar
    }).fetchone()
    db.commit()
    return {"id": row._mapping["id"], "nombre": body.nombre}


@router_alarmas.put("/zonas/{zona_id}")
def actualizar_zona(zona_id: int, body: ZonaUpdate, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    updates = {k: v for k, v in body.model_dump(exclude_unset=True).items()}
    if not updates:
        raise HTTPException(400, "Sin cambios")
    set_clause = ", ".join(f"{k}=:{k}" for k in updates) + ", updated_at=NOW()"
    updates["id"] = zona_id
    db.execute(text(f"UPDATE zonas_alarma SET {set_clause} WHERE id=:id"), updates)
    db.commit()
    return {"ok": True}


@router_alarmas.delete("/zonas/{zona_id}")
def eliminar_zona(zona_id: int, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    db.execute(text("DELETE FROM zonas_alarma WHERE id=:id"), {"id": zona_id})
    db.commit()
    return {"ok": True}


@router_alarmas.patch("/zonas/{zona_id}/estado")
def cambiar_estado_zona(zona_id: int, body: ArmadoRequest, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    _ensure_tables(db)
    if body.estado not in ("armada", "desarmada", "parcial"):
        raise HTTPException(400, "Estado invalido")
    zona = db.execute(text("SELECT * FROM zonas_alarma WHERE id=:id"), {"id": zona_id}).fetchone()
    if not zona:
        raise HTTPException(404, "Zona no encontrada")
    z = dict(zona._mapping)
    db.execute(text("UPDATE zonas_alarma SET estado=:est, updated_at=NOW() WHERE id=:id"), {"est": body.estado, "id": zona_id})
    db.commit()
    return {"ok": True, "zona": z["nombre"], "estado": body.estado}


@router_alarmas.get("/alertas")
def list_alertas(resuelta: Optional[bool] = None, limit: int = 50, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_id = current_user["tenant_id"]
    _ensure_tables(db)
    sql = ("SELECT a.*, z.nombre as zona_nombre FROM alertas_alarma a "
           "LEFT JOIN zonas_alarma z ON z.id=a.zona_id "
           "WHERE a.tenant_id=:tid")
    params: dict = {"tid": tenant_id}
    if resuelta is not None:
        sql += " AND a.resuelta=:res"
        params["res"] = resuelta
    sql += " ORDER BY a.created_at DESC LIMIT :lim"
    params["lim"] = limit
    rows = db.execute(text(sql), params).fetchall()
    result = []
    for r in rows:
        d = dict(r._mapping)
        if d.get("created_at"):
            d["created_at"] = str(d["created_at"])
        if d.get("resuelta_at"):
            d["resuelta_at"] = str(d["resuelta_at"])
        result.append(d)
    return result


@router_alarmas.post("/alertas", status_code=201)
def crear_alerta(body: AlertaCreate, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_id = current_user["tenant_id"]
    _ensure_tables(db)
    row = db.execute(text(
        "INSERT INTO alertas_alarma (tenant_id,zona_id,tipo,descripcion,nivel) "
        "VALUES (:tid,:zid,:tipo,:desc,:nivel) RETURNING id"
    ), {
        "tid": tenant_id, "zid": body.zona_id,
        "tipo": body.tipo, "desc": body.descripcion, "nivel": body.nivel
    }).fetchone()
    db.commit()
    alerta_id = row._mapping["id"]

    zona_nombre = "Sin zona"
    if body.zona_id:
        z = db.execute(text("SELECT nombre FROM zonas_alarma WHERE id=:id"), {"id": body.zona_id}).fetchone()
        if z:
            zona_nombre = z._mapping["nombre"]

    if body.nivel in ("alta", "critica"):
        _notificar_alerta(db, tenant_id, zona_nombre, body.tipo, body.descripcion or "")
        db.execute(text("UPDATE alertas_alarma SET notificado=true WHERE id=:id"), {"id": alerta_id})
        db.commit()

    return {"id": alerta_id, "notificado": body.nivel in ("alta", "critica")}


@router_alarmas.patch("/alertas/{alerta_id}/resolver")
def resolver_alerta(alerta_id: int, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    db.execute(text("UPDATE alertas_alarma SET resuelta=true, resuelta_at=NOW() WHERE id=:id"), {"id": alerta_id})
    db.commit()
    return {"ok": True}


@router_alarmas.post("/panico")
def boton_panico(zona_id: Optional[int] = None, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_id = current_user["tenant_id"]
    _ensure_tables(db)
    row = db.execute(text(
        "INSERT INTO alertas_alarma (tenant_id,zona_id,tipo,descripcion,nivel,notificado) "
        "VALUES (:tid,:zid,'panico','Boton de panico activado','critica',false) RETURNING id"
    ), {"tid": tenant_id, "zid": zona_id}).fetchone()
    db.commit()
    zona_nombre = "General"
    if zona_id:
        z = db.execute(text("SELECT nombre FROM zonas_alarma WHERE id=:id"), {"id": zona_id}).fetchone()
        if z:
            zona_nombre = z._mapping["nombre"]
    _notificar_alerta(db, tenant_id, zona_nombre, "PANICO", "Boton de panico activado manualmente")
    db.execute(text("UPDATE alertas_alarma SET notificado=true WHERE id=:id"), {"id": row._mapping["id"]})
    db.commit()
    return {"ok": True, "alerta_id": row._mapping["id"], "mensaje": "Alerta de panico enviada"}
