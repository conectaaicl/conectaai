"""
Sistema router — health/status semáforo for all services and TCP devices.
GET /api/sistema/estado  → checks all connections, returns color-coded status
GET /api/sistema/dispositivos  → list registered TCP devices
POST /api/sistema/dispositivos  → register a new device
PUT /api/sistema/dispositivos/{id}  → update device
DELETE /api/sistema/dispositivos/{id}  → remove device
POST /api/sistema/dispositivos/{id}/test  → test single device connection
POST /api/sistema/dispositivos/{id}/comando  → send open/lock/unlock command
"""
import asyncio
import socket
import os
import time
import json
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional, List
from pydantic import BaseModel
from app.core.database import get_db

router = APIRouter(prefix="/api/sistema", tags=["Sistema"])

# ── Schemas ──────────────────────────────────────────────────────────────────

class DispositivoCreate(BaseModel):
    tenant_id: int
    nombre: str
    tipo: str  # controlador_puerta | lector_rfid | lector_huella | panel_alarma | camara
    ip: str
    puerto: int
    protocolo: str = "tcp"  # tcp | onvif | rtsp
    modelo: Optional[str] = None
    ubicacion: Optional[str] = None
    puerta_id: Optional[int] = None  # link to puertas table
    activo: bool = True
    config_extra: Optional[dict] = None  # e.g. {"password": "1234", "device_id": 1}

class DispositivoUpdate(BaseModel):
    nombre: Optional[str] = None
    ip: Optional[str] = None
    puerto: Optional[int] = None
    protocolo: Optional[str] = None
    modelo: Optional[str] = None
    ubicacion: Optional[str] = None
    activo: Optional[bool] = None
    config_extra: Optional[dict] = None

class ComandoRequest(BaseModel):
    comando: str  # abrir | bloquear | desbloquear | reiniciar
    duracion_segundos: int = 5  # for abrir (hold time)


# ── DB helpers (creates table if not exists) ─────────────────────────────────

def _ensure_table(db: Session):
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS dispositivos_tcp (
            id SERIAL PRIMARY KEY,
            tenant_id INTEGER NOT NULL,
            nombre VARCHAR(100) NOT NULL,
            tipo VARCHAR(50) NOT NULL,
            ip VARCHAR(45) NOT NULL,
            puerto INTEGER NOT NULL,
            protocolo VARCHAR(20) DEFAULT 'tcp',
            modelo VARCHAR(100),
            ubicacion VARCHAR(200),
            puerta_id INTEGER,
            activo BOOLEAN DEFAULT true,
            config_extra JSONB,
            ultimo_estado VARCHAR(20) DEFAULT 'desconocido',
            ultima_comprobacion TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
    """))
    db.commit()


def _ping_tcp(ip: str, port: int, timeout: float = 2.0) -> dict:
    """Returns {ok, latency_ms, error}"""
    t0 = time.monotonic()
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(timeout)
        result = s.connect_ex((ip, port))
        s.close()
        latency = round((time.monotonic() - t0) * 1000, 1)
        if result == 0:
            return {"ok": True, "latency_ms": latency, "error": None}
        else:
            return {"ok": False, "latency_ms": latency, "error": f"Connection refused (code {result})"}
    except socket.timeout:
        return {"ok": False, "latency_ms": round((time.monotonic() - t0) * 1000, 1), "error": "Timeout"}
    except Exception as e:
        return {"ok": False, "latency_ms": round((time.monotonic() - t0) * 1000, 1), "error": str(e)}


def _ping_http(url: str, timeout: float = 3.0) -> dict:
    """Returns {ok, latency_ms, error}"""
    import httpx
    t0 = time.monotonic()
    try:
        r = httpx.get(url, timeout=timeout, follow_redirects=True)
        latency = round((time.monotonic() - t0) * 1000, 1)
        return {"ok": r.status_code < 500, "latency_ms": latency, "error": None if r.status_code < 500 else f"HTTP {r.status_code}"}
    except Exception as e:
        return {"ok": False, "latency_ms": round((time.monotonic() - t0) * 1000, 1), "error": str(e)}


def _semaforo(ok: bool, latency_ms: float) -> str:
    if not ok:
        return "rojo"
    if latency_ms > 500:
        return "amarillo"
    return "verde"


# ── Routes ───────────────────────────────────────────────────────────────────

@router.get("/estado")
def estado_sistema(tenant_id: int = 1, db: Session = Depends(get_db)):
    """Semáforo global: checks all services and TCP devices for this tenant."""
    _ensure_table(db)
    checks = []

    # 1. Backend itself (we're here, so it's up)
    checks.append({
        "nombre": "Backend API",
        "tipo": "servicio",
        "estado": "verde",
        "latency_ms": 0,
        "detalle": "OK"
    })

    # 2. Database
    t0 = time.monotonic()
    try:
        db.execute(text("SELECT 1"))
        db_latency = round((time.monotonic() - t0) * 1000, 1)
        db_ok = True
    except Exception as e:
        db_latency = round((time.monotonic() - t0) * 1000, 1)
        db_ok = False
    checks.append({
        "nombre": "Base de Datos",
        "tipo": "servicio",
        "estado": _semaforo(db_ok, db_latency),
        "latency_ms": db_latency,
        "detalle": "PostgreSQL OK" if db_ok else "Error DB"
    })

    # 3. WhatsApp / messaging service
    wa_url = os.getenv("WA_URL", "")
    if wa_url:
        wa = _ping_http(wa_url + "/health")
        checks.append({
            "nombre": "WhatsApp360",
            "tipo": "servicio",
            "estado": _semaforo(wa["ok"], wa["latency_ms"]),
            "latency_ms": wa["latency_ms"],
            "detalle": wa["error"] or "OK"
        })

    # 4. Mail service
    mail_url = os.getenv("MAIL_API_URL", "").replace("/api/send", "/health")
    if mail_url and mail_url.startswith("http"):
        mail = _ping_http(mail_url)
        checks.append({
            "nombre": "Servicio Email",
            "tipo": "servicio",
            "estado": _semaforo(mail["ok"], mail["latency_ms"]),
            "latency_ms": mail["latency_ms"],
            "detalle": mail["error"] or "OK"
        })

    # 5. TCP Devices for this tenant
    dispositivos = db.execute(text(
        "SELECT * FROM dispositivos_tcp WHERE tenant_id=:tid AND activo=true ORDER BY nombre"
    ), {"tid": tenant_id}).fetchall()

    for dev in dispositivos:
        d = dict(dev._mapping)
        ping = _ping_tcp(d["ip"], d["puerto"])
        estado = _semaforo(ping["ok"], ping["latency_ms"])

        # Update last status in DB (fire and forget)
        try:
            db.execute(text(
                "UPDATE dispositivos_tcp SET ultimo_estado=:est, ultima_comprobacion=NOW() WHERE id=:id"
            ), {"est": estado, "id": d["id"]})
            db.commit()
        except Exception:
            db.rollback()

        tipo_label = {
            "controlador_puerta": "Controlador",
            "lector_rfid": "Lector RFID",
            "lector_huella": "Biométrico",
            "panel_alarma": "Panel Alarma",
            "camara": "Cámara"
        }.get(d["tipo"], d["tipo"])

        checks.append({
            "id": d["id"],
            "nombre": d["nombre"],
            "tipo": tipo_label,
            "ip": d["ip"],
            "puerto": d["puerto"],
            "protocolo": d["protocolo"],
            "ubicacion": d.get("ubicacion"),
            "modelo": d.get("modelo"),
            "estado": estado,
            "latency_ms": ping["latency_ms"],
            "detalle": ping["error"] or f"{d['ip']}:{d['puerto']}"
        })

    total = len(checks)
    rojos = sum(1 for c in checks if c["estado"] == "rojo")
    amarillos = sum(1 for c in checks if c["estado"] == "amarillo")
    verdes = total - rojos - amarillos

    return {
        "resumen": {
            "estado_general": "rojo" if rojos > 0 else ("amarillo" if amarillos > 0 else "verde"),
            "verde": verdes,
            "amarillo": amarillos,
            "rojo": rojos,
            "total": total
        },
        "checks": checks
    }


@router.get("/dispositivos")
def list_dispositivos(tenant_id: int, db: Session = Depends(get_db)):
    _ensure_table(db)
    rows = db.execute(text(
        "SELECT * FROM dispositivos_tcp WHERE tenant_id=:tid ORDER BY nombre"
    ), {"tid": tenant_id}).fetchall()
    return [dict(r._mapping) for r in rows]


@router.post("/dispositivos", status_code=201)
def crear_dispositivo(body: DispositivoCreate, db: Session = Depends(get_db)):
    _ensure_table(db)
    row = db.execute(text(
        "INSERT INTO dispositivos_tcp (tenant_id,nombre,tipo,ip,puerto,protocolo,modelo,ubicacion,puerta_id,activo,config_extra) "
        "VALUES (:tid,:nom,:tipo,:ip,:port,:proto,:modelo,:ubic,:pid,:activo,:cfg) RETURNING id"
    ), {
        "tid": body.tenant_id, "nom": body.nombre, "tipo": body.tipo,
        "ip": body.ip, "port": body.puerto, "proto": body.protocolo,
        "modelo": body.modelo, "ubic": body.ubicacion, "pid": body.puerta_id,
        "activo": body.activo, "cfg": json.dumps(body.config_extra) if body.config_extra else None
    }).fetchone()
    db.commit()
    return {"id": row._mapping["id"], "nombre": body.nombre}


@router.put("/dispositivos/{dispositivo_id}")
def actualizar_dispositivo(dispositivo_id: int, body: DispositivoUpdate, db: Session = Depends(get_db)):
    _ensure_table(db)
    updates = {k: v for k, v in body.model_dump(exclude_unset=True).items()}
    if not updates:
        raise HTTPException(400, "No hay campos para actualizar")
    if "config_extra" in updates and updates["config_extra"] is not None:
        updates["config_extra"] = json.dumps(updates["config_extra"])
    set_clause = ", ".join(f"{k}=:{k}" for k in updates)
    updates["id"] = dispositivo_id
    updates["updated_at"] = "NOW()"
    db.execute(text(f"UPDATE dispositivos_tcp SET {set_clause}, updated_at=NOW() WHERE id=:id"), updates)
    db.commit()
    return {"ok": True}


@router.delete("/dispositivos/{dispositivo_id}")
def eliminar_dispositivo(dispositivo_id: int, db: Session = Depends(get_db)):
    _ensure_table(db)
    db.execute(text("DELETE FROM dispositivos_tcp WHERE id=:id"), {"id": dispositivo_id})
    db.commit()
    return {"ok": True}


@router.post("/dispositivos/{dispositivo_id}/test")
def test_dispositivo(dispositivo_id: int, db: Session = Depends(get_db)):
    _ensure_table(db)
    row = db.execute(text("SELECT * FROM dispositivos_tcp WHERE id=:id"), {"id": dispositivo_id}).fetchone()
    if not row:
        raise HTTPException(404, "Dispositivo no encontrado")
    d = dict(row._mapping)
    ping = _ping_tcp(d["ip"], d["puerto"])
    estado = _semaforo(ping["ok"], ping["latency_ms"])
    try:
        db.execute(text(
            "UPDATE dispositivos_tcp SET ultimo_estado=:est, ultima_comprobacion=NOW() WHERE id=:id"
        ), {"est": estado, "id": dispositivo_id})
        db.commit()
    except Exception:
        db.rollback()
    return {
        "id": dispositivo_id,
        "nombre": d["nombre"],
        "ip": d["ip"],
        "puerto": d["puerto"],
        "estado": estado,
        **ping
    }


@router.post("/dispositivos/{dispositivo_id}/comando")
def enviar_comando(dispositivo_id: int, body: ComandoRequest, db: Session = Depends(get_db)):
    """
    Send TCP command to a door controller.
    Currently implements a generic Wiegand/ZKTeco-style TCP command frame.
    For production, replace with vendor-specific SDK call.
    """
    _ensure_table(db)
    row = db.execute(text("SELECT * FROM dispositivos_tcp WHERE id=:id"), {"id": dispositivo_id}).fetchone()
    if not row:
        raise HTTPException(404, "Dispositivo no encontrado")
    d = dict(row._mapping)

    # Verify device is reachable first
    ping = _ping_tcp(d["ip"], d["puerto"])
    if not ping["ok"]:
        raise HTTPException(503, f"Dispositivo no alcanzable: {ping['error']}")

    # Generic command mapping — vendor-specific implementation needed per device
    COMMANDS = {
        "abrir": b"\x01\x01\x00" + bytes([body.duracion_segundos]),
        "bloquear": b"\x01\x02\x00\x00",
        "desbloquear": b"\x01\x03\x00\x00",
        "reiniciar": b"\x01\xFF\x00\x00",
    }
    cmd_bytes = COMMANDS.get(body.comando)
    if cmd_bytes is None:
        raise HTTPException(400, f"Comando desconocido. Válidos: {list(COMMANDS.keys())}")

    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(5.0)
        s.connect((d["ip"], d["puerto"]))
        s.sendall(cmd_bytes)
        # Try to read response (optional)
        try:
            response = s.recv(64)
        except Exception:
            response = b""
        s.close()
        return {
            "ok": True,
            "dispositivo": d["nombre"],
            "comando": body.comando,
            "respuesta_hex": response.hex() if response else None
        }
    except Exception as e:
        raise HTTPException(500, f"Error enviando comando: {str(e)}")


# ══════════════════════════════════════════════════════════════════════════════
# EVENTOS EN TIEMPO REAL (SSE + recepción desde dispositivos)
# ══════════════════════════════════════════════════════════════════════════════

# Per-tenant SSE subscriber queues: {tenant_id: [Queue, ...]}
_sse_queues: dict = {}

# Lazy import to avoid circular: scanner._scan_queues for RFID scan sessions
def _get_scan_queues() -> dict:
    try:
        from app.routers.scanner import _scan_queues
        return _scan_queues
    except Exception:
        return {}


def _ensure_eventos_table(db: Session):
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS eventos_dispositivo (
            id SERIAL PRIMARY KEY,
            tenant_id INTEGER NOT NULL,
            dispositivo_id INTEGER,
            tipo VARCHAR(50) NOT NULL,
            card_uid VARCHAR(100),
            persona_id INTEGER,
            persona_nombre VARCHAR(200),
            puerta_id INTEGER,
            resultado VARCHAR(20) DEFAULT 'desconocido',
            detalle TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    """))
    db.commit()


class EventoCreate(BaseModel):
    tenant_id: int
    dispositivo_id: Optional[int] = None
    tipo: str  # rfid_swipe | huella | panico | puerta_abierta | puerta_cerrada | acceso_denegado
    card_uid: Optional[str] = None
    puerta_id: Optional[int] = None
    detalle: Optional[str] = None


def _match_rfid(db: Session, card_uid: str, tenant_id: int) -> dict:
    """Returns {persona_id, persona_nombre, nombre_titular, resultado}"""
    try:
        row = db.execute(text(
            "SELECT t.id, t.uid, t.nombre_titular, t.persona_id, t.activa "
            "FROM tarjetas_rfid t "
            "WHERE t.uid = :uid AND t.tenant_id = :tid LIMIT 1"
        ), {"uid": card_uid, "tid": tenant_id}).fetchone()
        if not row:
            return {"persona_id": None, "persona_nombre": "Desconocido (" + card_uid + ")", "resultado": "denegado_desconocido"}
        d = dict(row._mapping)
        if not d.get("activa"):
            return {"persona_id": d.get("persona_id"), "persona_nombre": d.get("nombre_titular") or "Tarjeta inactiva", "resultado": "denegado_inactiva"}
        nombre = d.get("nombre_titular") or ""
        if d.get("persona_id"):
            p = db.execute(text("SELECT nombre_completo FROM personas WHERE id=:pid LIMIT 1"), {"pid": d["persona_id"]}).fetchone()
            if p:
                nombre = p._mapping["nombre_completo"] or nombre
        return {"persona_id": d.get("persona_id"), "persona_nombre": nombre or "Sin nombre", "resultado": "permitido"}
    except Exception:
        return {"persona_id": None, "persona_nombre": "Error lookup", "resultado": "error"}


def _publish_evento(tenant_id: int, evento_data: dict):
    """Put event into all subscriber queues for this tenant (non-blocking)."""
    queues = _sse_queues.get(tenant_id, [])
    payload = json.dumps(evento_data, default=str)
    for q in list(queues):
        try:
            q.put_nowait(payload)
        except Exception:
            pass


@router.post("/eventos", status_code=201)
def recibir_evento(body: EventoCreate, db: Session = Depends(get_db)):
    """
    Endpoint for device controllers to push events.
    Matches RFID card to persona, writes to historial, publishes to SSE stream.
    """
    _ensure_eventos_table(db)

    persona_id = None
    persona_nombre = None
    resultado = "desconocido"

    # RFID matching
    if body.card_uid:
        match = _match_rfid(db, body.card_uid, body.tenant_id)
        persona_id = match["persona_id"]
        persona_nombre = match["persona_nombre"]
        resultado = match["resultado"]
    else:
        resultado = "ok"

    # Insert raw event
    row = db.execute(text(
        "INSERT INTO eventos_dispositivo "
        "(tenant_id, dispositivo_id, tipo, card_uid, persona_id, persona_nombre, puerta_id, resultado, detalle) "
        "VALUES (:tid, :did, :tipo, :uid, :pid, :pnom, :puerid, :res, :det) RETURNING id, created_at"
    ), {
        "tid": body.tenant_id, "did": body.dispositivo_id, "tipo": body.tipo,
        "uid": body.card_uid, "pid": persona_id, "pnom": persona_nombre,
        "puerid": body.puerta_id, "res": resultado, "det": body.detalle
    }).fetchone()
    db.commit()
    evento_id = row._mapping["id"]
    created_at = row._mapping["created_at"]

    # Write to historial_eventos
    try:
        from app.models import HistorialEvento
        desc = (body.tipo.replace("_", " ").title() +
                (": " + persona_nombre if persona_nombre else "") +
                (" [" + body.card_uid + "]" if body.card_uid else "") +
                (" → " + resultado if resultado != "ok" else ""))
        hist = HistorialEvento(
            tenant_id=body.tenant_id,
            modulo="acceso",
            accion=body.tipo,
            descripcion=desc,
            usuario_nombre=persona_nombre,
            entidad_id=persona_id,
            metadata_json={"dispositivo_id": body.dispositivo_id, "card_uid": body.card_uid,
                           "puerta_id": body.puerta_id, "resultado": resultado}
        )
        db.add(hist)
        db.commit()
    except Exception:
        db.rollback()


    # Update door physical state
    if body.tipo in ("puerta_abierta", "puerta_cerrada") and body.puerta_id:
        nuevo_estado = "abierta" if body.tipo == "puerta_abierta" else "cerrada"
        try:
            db.execute(text("UPDATE puertas SET estado=:est WHERE id=:pid"),
                       {"est": nuevo_estado, "pid": body.puerta_id})
            db.commit()
        except Exception:
            db.rollback()

    # Build broadcast payload
    evento_data = {
        "id": evento_id,
        "tipo": body.tipo,
        "card_uid": body.card_uid,
        "persona_nombre": persona_nombre,
        "persona_id": persona_id,
        "resultado": resultado,
        "dispositivo_id": body.dispositivo_id,
        "puerta_id": body.puerta_id,
        "detalle": body.detalle,
        "created_at": str(created_at),
    }
    _publish_evento(body.tenant_id, evento_data)

    # Forward RFID events to any active scan sessions
    if body.tipo in ("rfid_acceso", "rfid_denegado", "rfid_desconocido", "rfid_swipe"):
        scan_qs = _get_scan_queues()
        payload = json.dumps(evento_data, default=str)
        for sq in list(scan_qs.get(body.tenant_id, [])):
            try:
                sq.put_nowait(payload)
            except Exception:
                pass

    return {"id": evento_id, "persona_nombre": persona_nombre, "resultado": resultado}


@router.get("/eventos")
def listar_eventos(tenant_id: int, limit: int = 50, db: Session = Depends(get_db)):
    """Recent events for initial page load."""
    _ensure_eventos_table(db)
    rows = db.execute(text(
        "SELECT * FROM eventos_dispositivo WHERE tenant_id=:tid ORDER BY created_at DESC LIMIT :lim"
    ), {"tid": tenant_id, "lim": limit}).fetchall()
    result = []
    for r in rows:
        d = dict(r._mapping)
        d["created_at"] = str(d.get("created_at", ""))
        result.append(d)
    return result


@router.get("/eventos/stream")
async def stream_eventos(tenant_id: int, request: Request):
    """
    Server-Sent Events stream. Frontend subscribes here; device events are pushed in real-time.
    """
    q: asyncio.Queue = asyncio.Queue(maxsize=100)
    _sse_queues.setdefault(tenant_id, []).append(q)

    async def generator():
        try:
            while True:
                if await request.is_disconnected():
                    break
                try:
                    data = await asyncio.wait_for(q.get(), timeout=25.0)
                    yield "data: " + data + "\n\n"
                except asyncio.TimeoutError:
                    yield ": heartbeat\n\n"
        finally:
            try:
                _sse_queues.get(tenant_id, []).remove(q)
            except ValueError:
                pass

    return StreamingResponse(
        generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        }
    )
