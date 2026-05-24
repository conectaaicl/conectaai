import json
import os
from datetime import datetime, date
from typing import Optional, Any
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
from app.core.database import get_db
from app.routers.auth import get_current_user

router = APIRouter(prefix="/api/facial", tags=["Reconocimiento Facial"])

MARCAS = ["zkteco", "hikvision", "dahua", "otro"]

def _ensure_tables(db: Session):
    db.execute(text('''
        CREATE TABLE IF NOT EXISTS dispositivos_facial (
            id SERIAL PRIMARY KEY,
            tenant_id INTEGER NOT NULL,
            nombre VARCHAR(200) NOT NULL,
            marca VARCHAR(30) NOT NULL,
            modelo VARCHAR(100),
            serial_number VARCHAR(100),
            ip VARCHAR(45),
            puerto INTEGER DEFAULT 80,
            usuario VARCHAR(100),
            puerta_id INTEGER,
            ubicacion VARCHAR(200),
            activo BOOLEAN DEFAULT true,
            config JSONB,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    '''))
    db.execute(text('''
        CREATE TABLE IF NOT EXISTS registros_facial (
            id SERIAL PRIMARY KEY,
            tenant_id INTEGER NOT NULL,
            dispositivo_id INTEGER,
            dispositivo_serial VARCHAR(100),
            marca VARCHAR(30),
            persona_id INTEGER,
            persona_nombre VARCHAR(200),
            puerta_id INTEGER,
            resultado VARCHAR(20) DEFAULT 'desconocido',
            similitud FLOAT,
            evento_tipo VARCHAR(50),
            evento_raw JSONB,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    '''))
    db.execute(text('''
        CREATE TABLE IF NOT EXISTS personas_facial (
            id SERIAL PRIMARY KEY,
            tenant_id INTEGER NOT NULL,
            persona_id INTEGER NOT NULL UNIQUE,
            zkteco_pin VARCHAR(50),
            hikvision_face_id VARCHAR(100),
            dahua_person_id VARCHAR(100),
            foto_url TEXT,
            activo BOOLEAN DEFAULT true,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    '''))
    db.commit()

def _log_event(db, tenant_id, marca, dispositivo_serial, persona_id, persona_nombre,
               puerta_id, resultado, similitud, evento_tipo, evento_raw, dispositivo_id=None):
    try:
        db.execute(text(
            "INSERT INTO registros_facial (tenant_id,dispositivo_id,dispositivo_serial,marca,"
            "persona_id,persona_nombre,puerta_id,resultado,similitud,evento_tipo,evento_raw) "
            "VALUES (:tid,:did,:serial,:marca,:pid,:pnm,:puerta,:result,:sim,:tipo,:raw)"
        ), {
            "tid": tenant_id, "did": dispositivo_id, "serial": dispositivo_serial,
            "marca": marca, "pid": persona_id, "pnm": persona_nombre,
            "puerta": puerta_id, "result": resultado, "sim": similitud,
            "tipo": evento_tipo, "raw": json.dumps(evento_raw) if evento_raw else None
        })
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"[facial] log_event error: {e}")

def _get_dispositivo_by_serial(db, serial, tenant_id=None):
    q = "SELECT * FROM dispositivos_facial WHERE serial_number=:s"
    params = {"s": serial}
    if tenant_id:
        q += " AND tenant_id=:tid"; params["tid"] = tenant_id
    row = db.execute(text(q), params).fetchone()
    return dict(row._mapping) if row else None

def _get_persona_by_pin(db, pin, tenant_id):
    row = db.execute(text(
        "SELECT pf.persona_id, p.nombre_completo FROM personas_facial pf "
        "JOIN personas p ON p.id=pf.persona_id "
        "WHERE pf.zkteco_pin=:pin AND pf.tenant_id=:tid AND pf.activo=true"
    ), {"pin": pin, "tid": tenant_id}).fetchone()
    return dict(row._mapping) if row else None

def _get_persona_by_hik_face(db, face_id, tenant_id):
    row = db.execute(text(
        "SELECT pf.persona_id, p.nombre_completo FROM personas_facial pf "
        "JOIN personas p ON p.id=pf.persona_id "
        "WHERE pf.hikvision_face_id=:fid AND pf.tenant_id=:tid AND pf.activo=true"
    ), {"fid": face_id, "tid": tenant_id}).fetchone()
    return dict(row._mapping) if row else None

def _get_persona_by_dahua_id(db, person_id, tenant_id):
    row = db.execute(text(
        "SELECT pf.persona_id, p.nombre_completo FROM personas_facial pf "
        "JOIN personas p ON p.id=pf.persona_id "
        "WHERE pf.dahua_person_id=:pid AND pf.tenant_id=:tid AND pf.activo=true"
    ), {"pid": person_id, "tid": tenant_id}).fetchone()
    return dict(row._mapping) if row else None

def _auto_abrir_puerta(db, puerta_id):
    try:
        row = db.execute(text(
            "SELECT id FROM puertas WHERE id=:id AND activa=true"
        ), {"id": puerta_id}).fetchone()
        if not row:
            return
        db.execute(text("UPDATE puertas SET estado='abierta' WHERE id=:id"), {"id": puerta_id})
        db.execute(text(
            "INSERT INTO registros_puerta (puerta_id,accion,resultado,metodo) "
            "VALUES (:pid,'abrir','ok','facial') ON CONFLICT DO NOTHING"
        ), {"pid": puerta_id})
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"[facial] auto_abrir error: {e}")


@router.post("/webhook/zkteco")
async def webhook_zkteco(request: Request, db: Session = Depends(get_db)):
    _ensure_tables(db)
    try:
        body = await request.json()
    except Exception:
        form = await request.form()
        body = dict(form)

    device_sn = body.get("DevSN") or body.get("sn") or "unknown"
    data = body.get("data") or []
    if isinstance(data, str):
        try: data = json.loads(data)
        except: data = []

    dispositivo = _get_dispositivo_by_serial(db, device_sn)
    tenant_id = dispositivo["tenant_id"] if dispositivo else 1
    dispositivo_id = dispositivo["id"] if dispositivo else None
    puerta_id = dispositivo["puerta_id"] if dispositivo else None

    results = []
    for record in (data if isinstance(data, list) else [data]):
        pin = str(record.get("pin") or record.get("Pin") or "")
        verify = int(record.get("verify") or record.get("Verify") or 0)
        if verify not in (15, 16, 14):
            continue
        persona = _get_persona_by_pin(db, pin, tenant_id) if pin else None
        resultado = "reconocido" if persona else "desconocido"
        _log_event(db, tenant_id, "zkteco", device_sn,
                   persona["persona_id"] if persona else None,
                   persona["nombre_completo"] if persona else None,
                   puerta_id, resultado, 1.0 if persona else None, "facial_zkteco", record, dispositivo_id)
        if persona and puerta_id:
            _auto_abrir_puerta(db, puerta_id)
        results.append({"pin": pin, "resultado": resultado})
    return {"ok": True, "procesados": len(results), "resultados": results}

@router.post("/webhook/hikvision")
async def webhook_hikvision(request: Request, db: Session = Depends(get_db)):
    _ensure_tables(db)
    ct = request.headers.get("content-type", "")
    if "multipart" in ct:
        form = await request.form()
        body = {}
        for key in form:
            try: body = json.loads(form[key]); break
            except: pass
    else:
        try: body = await request.json()
        except: body = {}

    device_id = (body.get("deviceID") or
                 request.headers.get("X-Device-Serial") or "unknown")
    dispositivo = _get_dispositivo_by_serial(db, device_id)
    tenant_id = dispositivo["tenant_id"] if dispositivo else 1
    dispositivo_id = dispositivo["id"] if dispositivo else None
    puerta_id = dispositivo["puerta_id"] if dispositivo else None

    events = body.get("Events") or body.get("events") or [body]
    results = []
    for ev in events:
        ev_type = ev.get("eventType") or ev.get("EventType") or ""
        if "FACE" not in ev_type.upper() and "face" not in str(ev).lower():
            continue
        face_list = ev.get("FaceRecognitionAlertList") or ev.get("FaceDetectionAlertList") or [ev]
        if isinstance(face_list, dict):
            inner = face_list.get("FaceRecognitionAlert") or face_list.get("FaceDetectionAlert")
            face_list = [inner] if inner else [face_list]
        for fa in face_list:
            face_id = str(fa.get("faceID") or fa.get("FaceID") or fa.get("UserID") or "")
            similarity = float(fa.get("similarity") or fa.get("Similarity") or 0)
            persona = _get_persona_by_hik_face(db, face_id, tenant_id) if face_id else None
            resultado = "reconocido" if (persona and similarity >= 0.7) else "desconocido"
            _log_event(db, tenant_id, "hikvision", device_id,
                       persona["persona_id"] if persona else None,
                       persona["nombre_completo"] if persona else None,
                       puerta_id, resultado, similarity, "facial_hikvision", ev, dispositivo_id)
            if persona and similarity >= 0.7 and puerta_id:
                _auto_abrir_puerta(db, puerta_id)
            results.append({"face_id": face_id, "resultado": resultado, "similitud": similarity})
    return {"ok": True, "procesados": len(results)}

@router.post("/webhook/dahua")
async def webhook_dahua(request: Request, db: Session = Depends(get_db)):
    _ensure_tables(db)
    try: body = await request.json()
    except:
        try: form = await request.form(); body = {"raw": dict(form)}
        except: body = {}

    device_sn = (request.headers.get("X-Serial") or
                 body.get("SerialNumber") or body.get("DeviceID") or "unknown")
    dispositivo = _get_dispositivo_by_serial(db, device_sn)
    tenant_id = dispositivo["tenant_id"] if dispositivo else 1
    dispositivo_id = dispositivo["id"] if dispositivo else None
    puerta_id = dispositivo["puerta_id"] if dispositivo else None

    events = body.get("Events") or body.get("events") or [body]
    results = []
    for ev in events:
        code = ev.get("Code") or ev.get("code") or ""
        if "FaceRecognition" not in code and "face" not in code.lower():
            continue
        data = ev.get("Data") or ev.get("data") or {}
        candidates = data.get("Candidates") or [data]
        for cand in candidates:
            person_id = str(cand.get("PersonId") or cand.get("personId") or cand.get("UserID") or "")
            person_name = cand.get("PersonName") or cand.get("personName") or ""
            similarity = float(cand.get("Similarity") or cand.get("similarity") or 0)
            persona = _get_persona_by_dahua_id(db, person_id, tenant_id) if person_id else None
            if not persona and person_name:
                row = db.execute(text(
                    "SELECT id as persona_id, nombre_completo FROM personas "
                    "WHERE tenant_id=:tid AND nombre_completo ILIKE :nm LIMIT 1"
                ), {"tid": tenant_id, "nm": "%" + person_name + "%"}).fetchone()
                if row: persona = dict(row._mapping)
            resultado = "reconocido" if (persona and similarity >= 0.6) else "desconocido"
            _log_event(db, tenant_id, "dahua", device_sn,
                       persona["persona_id"] if persona else None,
                       persona["nombre_completo"] if persona else None,
                       puerta_id, resultado, similarity, "facial_dahua", ev, dispositivo_id)
            if persona and similarity >= 0.6 and puerta_id:
                _auto_abrir_puerta(db, puerta_id)
            results.append({"person_id": person_id, "resultado": resultado, "similitud": similarity})
    return {"ok": True, "procesados": len(results)}


class DispositivoFacialCreate(BaseModel):
    tenant_id: int
    nombre: str
    marca: str
    modelo: Optional[str] = None
    serial_number: Optional[str] = None
    ip: Optional[str] = None
    puerto: int = 80
    usuario: Optional[str] = None
    puerta_id: Optional[int] = None
    ubicacion: Optional[str] = None

@router.get("/dispositivos")
def listar_dispositivos_facial(tenant_id: int, db: Session = Depends(get_db),
                               current_user: dict = Depends(get_current_user)):
    _ensure_tables(db)
    rows = db.execute(text(
        "SELECT df.*, p.nombre as puerta_nombre FROM dispositivos_facial df "
        "LEFT JOIN puertas p ON p.id=df.puerta_id "
        "WHERE df.tenant_id=:tid AND df.activo=true ORDER BY df.id DESC"
    ), {"tid": tenant_id}).fetchall()
    return [dict(r._mapping) for r in rows]

@router.post("/dispositivos", status_code=201)
def crear_dispositivo_facial(body: DispositivoFacialCreate,
                              db: Session = Depends(get_db),
                              current_user: dict = Depends(get_current_user)):
    _ensure_tables(db)
    if body.marca not in MARCAS:
        raise HTTPException(400, f"Marca invalida. Validas: {', '.join(MARCAS)}")
    row = db.execute(text(
        "INSERT INTO dispositivos_facial (tenant_id,nombre,marca,modelo,serial_number,"
        "ip,puerto,usuario,puerta_id,ubicacion) "
        "VALUES (:tid,:nom,:marca,:mod,:sn,:ip,:prt,:usr,:puerta,:ubic) RETURNING id"
    ), {"tid": body.tenant_id, "nom": body.nombre, "marca": body.marca,
        "mod": body.modelo, "sn": body.serial_number, "ip": body.ip,
        "prt": body.puerto, "usr": body.usuario,
        "puerta": body.puerta_id, "ubic": body.ubicacion}).fetchone()
    db.commit()
    return {"ok": True, "id": row._mapping["id"]}

@router.delete("/dispositivos/{dispositivo_id}")
def eliminar_dispositivo_facial(dispositivo_id: int, db: Session = Depends(get_db),
                                 current_user: dict = Depends(get_current_user)):
    _ensure_tables(db)
    db.execute(text("UPDATE dispositivos_facial SET activo=false WHERE id=:id"), {"id": dispositivo_id})
    db.commit()
    return {"ok": True}

@router.get("/registros")
def listar_registros(tenant_id: int, limit: int = 100, marca: Optional[str] = None,
                     resultado: Optional[str] = None, db: Session = Depends(get_db),
                     current_user: dict = Depends(get_current_user)):
    _ensure_tables(db)
    sql = "SELECT * FROM registros_facial WHERE tenant_id=:tid"
    params: dict = {"tid": tenant_id}
    if marca: sql += " AND marca=:marca"; params["marca"] = marca
    if resultado: sql += " AND resultado=:resultado"; params["resultado"] = resultado
    sql += " ORDER BY created_at DESC LIMIT :lim"; params["lim"] = limit
    rows = db.execute(text(sql), params).fetchall()
    return [dict(r._mapping) for r in rows]

class PersonaFacialCreate(BaseModel):
    tenant_id: int
    zkteco_pin: Optional[str] = None
    hikvision_face_id: Optional[str] = None
    dahua_person_id: Optional[str] = None
    foto_url: Optional[str] = None

@router.get("/personas/{persona_id}/facial")
def get_persona_facial(persona_id: int, tenant_id: int, db: Session = Depends(get_db),
                        current_user: dict = Depends(get_current_user)):
    _ensure_tables(db)
    row = db.execute(text(
        "SELECT * FROM personas_facial WHERE persona_id=:pid AND tenant_id=:tid"
    ), {"pid": persona_id, "tid": tenant_id}).fetchone()
    if not row: return {"registrado": False}
    d = dict(row._mapping); d["registrado"] = True
    return d

@router.post("/personas/{persona_id}/facial")
def registrar_persona_facial(persona_id: int, body: PersonaFacialCreate,
                              db: Session = Depends(get_db),
                              current_user: dict = Depends(get_current_user)):
    _ensure_tables(db)
    existing = db.execute(text(
        "SELECT id FROM personas_facial WHERE persona_id=:pid AND tenant_id=:tid"
    ), {"pid": persona_id, "tid": body.tenant_id}).fetchone()
    if existing:
        sets = []; params: dict = {"pid": persona_id, "tid": body.tenant_id}
        if body.zkteco_pin is not None: sets.append("zkteco_pin=:pin"); params["pin"] = body.zkteco_pin
        if body.hikvision_face_id is not None: sets.append("hikvision_face_id=:hfid"); params["hfid"] = body.hikvision_face_id
        if body.dahua_person_id is not None: sets.append("dahua_person_id=:dpid"); params["dpid"] = body.dahua_person_id
        if body.foto_url is not None: sets.append("foto_url=:foto"); params["foto"] = body.foto_url
        if sets:
            db.execute(text(f"UPDATE personas_facial SET {','.join(sets)} WHERE persona_id=:pid AND tenant_id=:tid"), params)
        db.commit()
        return {"ok": True, "accion": "actualizado"}
    else:
        db.execute(text(
            "INSERT INTO personas_facial (tenant_id,persona_id,zkteco_pin,hikvision_face_id,dahua_person_id,foto_url) "
            "VALUES (:tid,:pid,:pin,:hfid,:dpid,:foto)"
        ), {"tid": body.tenant_id, "pid": persona_id,
            "pin": body.zkteco_pin, "hfid": body.hikvision_face_id,
            "dpid": body.dahua_person_id, "foto": body.foto_url})
        db.commit()
        return {"ok": True, "accion": "creado"}

@router.get("/stats")
def stats_facial(tenant_id: int, db: Session = Depends(get_db),
                  current_user: dict = Depends(get_current_user)):
    _ensure_tables(db)
    from datetime import date
    hoy = date.today().isoformat()
    rows = db.execute(text(
        "SELECT resultado, marca, COUNT(*) as total FROM registros_facial "
        "WHERE tenant_id=:tid AND DATE(created_at)=:hoy GROUP BY resultado, marca"
    ), {"tid": tenant_id, "hoy": hoy}).fetchall()
    stats = {"reconocido": 0, "desconocido": 0, "denegado": 0, "por_marca": {}}
    for r in rows:
        d = dict(r._mapping)
        stats[d["resultado"]] = stats.get(d["resultado"], 0) + d["total"]
        marca = d["marca"] or "otro"
        stats["por_marca"][marca] = stats["por_marca"].get(marca, 0) + d["total"]
    total = db.execute(text(
        "SELECT COUNT(*) FROM personas_facial WHERE tenant_id=:tid AND activo=true"
    ), {"tid": tenant_id}).scalar()
    stats["personas_registradas"] = total or 0
    return stats
