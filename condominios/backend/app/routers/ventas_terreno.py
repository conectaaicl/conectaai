"""
Ventas Terreno PRO (ventas.conectaai.cl)

Pipeline comercial de condominios pensado para usarse de pie, desde una tablet:
edificios, visitas con GPS, cotizador por unidad, propuesta PDF personalizada,
demo clonado del Edificio Los Alamos con claves ligadas al correo del prospecto
(vence a los DEMO_DIAS dias -> modo vitrina) y telemetria de uso.

Autenticacion propia (tabla ventas_vendedores, cookie ventas_session). Todas las
rutas viven bajo /api/ventas; las publicas (/p/<token>, /publico/*) no requieren sesion.
"""
import base64
import io
import json
import os
import secrets
from datetime import datetime, date, timedelta, timezone
from pathlib import Path
from typing import Optional, List
from urllib.parse import quote

import bcrypt
import httpx
import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.routers import ventas_demo as demo

router = APIRouter(prefix="/api/ventas-terreno", tags=["Ventas terreno"])

SECRET = os.getenv("SECRET_KEY", "")
COOKIE = "ventas_session"
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "/app/uploads"))
MAIL_API_URL = os.getenv("MAIL_API_URL", "https://mail.conectaai.cl/api/send")
MAIL_API_KEY = os.getenv("MAIL_API_KEY", "")
EVOLUTION_API_URL = os.getenv("EVOLUTION_API_URL", "")
EVOLUTION_API_KEY = os.getenv("EVOLUTION_API_KEY", "")
EVOLUTION_INSTANCE = os.getenv("EVOLUTION_INSTANCE", "ventas")
VENTAS_URL = os.getenv("VENTAS_URL", "https://ventas.conectaai.cl")
MARCA = os.getenv("VENTAS_MARCA", "ConectaAI Condominios")
LOGO_CAI = UPLOAD_DIR / "branding" / "conectaai" / "logo.png"
LOGO_CAI_URL = f"{VENTAS_URL}/uploads/branding/conectaai/logo.png"

ETAPAS = ["visitado", "propuesta", "demo", "negociacion", "cliente", "perdido"]
RESULTADOS = {"no_estaba": "No estaba", "interesado": "Interesado — pidió propuesta", "tiene_sistema": "Ya tiene sistema",
              "rechazo": "Rechazó", "reunion": "Agendar reunión", "seguimiento": "Seguimiento"}
DOLORES = {
    "morosidad": ("Morosidad y cobranza", "Gastos comunes por unidad con prorrateo automático, estado de cuenta en la app del vecino, recordatorios y convenios de pago en cuotas desde los 3 meses vencidos."),
    "visitas": ("Visitas sin control", "El vecino invita por link: el visitante ingresa su celular y recibe un QR de un solo uso. Conserjería lo escanea y el vecino recibe el aviso de llegada."),
    "encomiendas": ("Encomiendas perdidas", "El conserje registra el paquete en segundos, el vecino recibe notificación y firma el retiro. Eliminar requiere clave del administrador."),
    "sin_app": ("Sin app para los vecinos", "Portal PWA instalable sin tiendas: gastos, pagos, visitas, encomiendas, reservas, votaciones, avisos y convenio, con el nombre de su edificio."),
    "asambleas": ("Asambleas y votaciones", "Votaciones digitales con trazabilidad y avisos masivos por correo/WhatsApp, alineado a la Ley 21.442."),
    "mantenciones": ("Mantenciones sin bitácora", "Sticker QR en ascensores y equipos: el técnico reporta y firma desde su celular; el informe llega al administrador con firma y próxima fecha."),
    "acceso_vehicular": ("Portón y estacionamientos", "TAG UHF/NFC en el auto del vecino y lector de patentes: el portón abre solo a autorizados y queda registro de cada acceso."),
    "conserjeria": ("Conserjería desordenada", "Panel táctil del conserje: central de eventos en vivo, visitas, encomiendas, reservas, incidencias y libro de novedades."),
}
MODULOS = [
    {"key": "base", "nombre": "Plan Pro (base)", "detalle": "Admin + Conserje + App vecinos: gastos comunes, convenios, visitas, encomiendas, reservas, avisos, votaciones, incidencias", "precio": 800, "base": True},
    {"key": "mantenciones", "nombre": "Mantenciones QR", "detalle": "Bitácora firmada por técnicos desde sticker QR/NFC", "precio": 150},
    {"key": "tag_vehicular", "nombre": "TAG vehicular UHF/NFC", "detalle": "Apertura automática de portón con TAG en el auto", "precio": 250},
    {"key": "lector_patentes", "nombre": "Lector de patentes", "detalle": "Cámara LPR integrada al portón", "precio": 300},
    {"key": "control_acceso", "nombre": "Control de acceso RFID", "detalle": "Tarjetas, llaveros y puertas TCP/IP", "precio": 200},
    {"key": "facial", "nombre": "Reconocimiento facial", "detalle": "Integración ZKTeco / Hikvision", "precio": 400},
    {"key": "whatsapp", "nombre": "WhatsApp oficial", "detalle": "Avisos y recordatorios por WhatsApp Business", "precio": 200},
]
MINIMO_MENSUAL = 40000

_SCHEMA_OK = False


def _ensure_schema(db: Session):
    global _SCHEMA_OK
    if _SCHEMA_OK:
        return
    db.execute(text("""
    CREATE TABLE IF NOT EXISTS ventas_vendedores (
        id SERIAL PRIMARY KEY, nombre VARCHAR(120) NOT NULL, email VARCHAR(160) UNIQUE NOT NULL, password_hash VARCHAR(255) NOT NULL,
        telefono VARCHAR(30), zona VARCHAR(120), rol VARCHAR(20) DEFAULT 'vendedor', activo BOOLEAN DEFAULT TRUE,
        ultimo_login TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW());
    ALTER TABLE ventas_vendedores ADD COLUMN IF NOT EXISTS usuario VARCHAR(60);
    CREATE TABLE IF NOT EXISTS ventas_edificios (
        id SERIAL PRIMARY KEY, nombre VARCHAR(160) NOT NULL, tipo VARCHAR(20) DEFAULT 'departamentos', direccion VARCHAR(255), comuna VARCHAR(80),
        lat DOUBLE PRECISION, lng DOUBLE PRECISION, unidades INTEGER, administrador_nombre VARCHAR(120), administrador_email VARCHAR(160),
        administrador_telefono VARCHAR(30), empresa_admin VARCHAR(160), etapa VARCHAR(20) DEFAULT 'visitado', motivo_perdida VARCHAR(160),
        dolores JSONB DEFAULT '[]'::jsonb, notas TEXT, foto_url VARCHAR(255), vendedor_id INTEGER REFERENCES ventas_vendedores(id),
        tenant_id INTEGER, proxima_accion VARCHAR(160), proxima_fecha DATE, valor_mensual INTEGER, origen VARCHAR(30) DEFAULT 'terreno',
        created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS ventas_visitas (
        id SERIAL PRIMARY KEY, edificio_id INTEGER REFERENCES ventas_edificios(id) ON DELETE CASCADE, vendedor_id INTEGER,
        fecha TIMESTAMPTZ DEFAULT NOW(), resultado VARCHAR(30), lat DOUBLE PRECISION, lng DOUBLE PRECISION, nota TEXT, foto_url VARCHAR(255),
        created_at TIMESTAMPTZ DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS ventas_propuestas (
        id SERIAL PRIMARY KEY, edificio_id INTEGER REFERENCES ventas_edificios(id) ON DELETE CASCADE, vendedor_id INTEGER,
        token VARCHAR(40) UNIQUE NOT NULL, modulos JSONB DEFAULT '[]'::jsonb, precio_unidad INTEGER, unidades INTEGER, total_mensual INTEGER,
        descuento_pct INTEGER DEFAULT 0, meses_gratis INTEGER DEFAULT 0, mensaje TEXT, pdf_path VARCHAR(255), demo_id INTEGER,
        enviado_email BOOLEAN DEFAULT FALSE, enviado_wa BOOLEAN DEFAULT FALSE, enviado_en TIMESTAMPTZ, abierto_en TIMESTAMPTZ, aperturas INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS ventas_demos (
        id SERIAL PRIMARY KEY, edificio_id INTEGER REFERENCES ventas_edificios(id) ON DELETE SET NULL, tenant_id INTEGER, subdominio VARCHAR(80),
        dominio VARCHAR(160), email VARCHAR(160), credenciales JSONB, inicia TIMESTAMPTZ DEFAULT NOW(), vence TIMESTAMPTZ, estado VARCHAR(20) DEFAULT 'activo',
        created_at TIMESTAMPTZ DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS ventas_eventos (
        id SERIAL PRIMARY KEY, tenant_id INTEGER, edificio_id INTEGER, propuesta_id INTEGER, tipo VARCHAR(30), rol VARCHAR(30), detalle VARCHAR(200),
        created_at TIMESTAMPTZ DEFAULT NOW());
    CREATE INDEX IF NOT EXISTS ix_ventas_eventos_tenant ON ventas_eventos(tenant_id, created_at DESC);
    """))
    db.commit()
    _SCHEMA_OK = True


# ─── Auth ────────────────────────────────────────────────────────────────────

def _token(v: dict) -> str:
    return jwt.encode({"sub": str(v["id"]), "email": v["email"], "rol": "vendedor", "vrol": v["rol"], "exp": datetime.now(timezone.utc) + timedelta(days=30)}, SECRET, algorithm="HS256")


def get_vendedor(request: Request, db: Session = Depends(get_db)) -> dict:
    _ensure_schema(db)
    tok = request.cookies.get(COOKIE)
    if not tok:
        auth = request.headers.get("authorization", "")
        tok = auth[7:] if auth.startswith("Bearer ") else None
    if not tok:
        raise HTTPException(401, "No autenticado")
    try:
        p = jwt.decode(tok, SECRET, algorithms=["HS256"])
        if p.get("rol") != "vendedor":
            raise ValueError
        vid = int(p["sub"])
    except Exception:
        raise HTTPException(401, "Sesión inválida")
    row = db.execute(text("SELECT id, nombre, email, telefono, zona, rol FROM ventas_vendedores WHERE id=:id AND activo"), {"id": vid}).fetchone()
    if not row:
        raise HTTPException(401, "Vendedor no encontrado")
    return dict(row._mapping)


class LoginIn(BaseModel):
    email: str
    password: str


@router.post("/auth/login")
def login(body: LoginIn, response: Response, db: Session = Depends(get_db)):
    _ensure_schema(db)
    row = db.execute(text("SELECT id, nombre, email, telefono, zona, rol, password_hash FROM ventas_vendedores WHERE (lower(email)=lower(:e) OR lower(usuario)=lower(:e)) AND activo"), {"e": body.email.strip()}).fetchone()
    if not row or not bcrypt.checkpw(body.password.encode(), row[6].encode()):
        raise HTTPException(401, "Correo o clave incorrectos")
    v = dict(row._mapping); v.pop("password_hash")
    db.execute(text("UPDATE ventas_vendedores SET ultimo_login=NOW() WHERE id=:id"), {"id": v["id"]}); db.commit()
    tok = _token(v)
    response.set_cookie(COOKIE, tok, httponly=True, secure=True, samesite="lax", max_age=60 * 60 * 24 * 30, path="/")
    return {"ok": True, "vendedor": v, "token": tok}


@router.post("/auth/logout")
def logout(response: Response):
    response.delete_cookie(COOKIE, path="/")
    return {"ok": True}


@router.get("/auth/me")
def me(v: dict = Depends(get_vendedor)):
    return v


class PasswordIn(BaseModel):
    actual: str
    nueva: str


@router.post("/auth/password")
def cambiar_password(body: PasswordIn, v: dict = Depends(get_vendedor), db: Session = Depends(get_db)):
    h = db.execute(text("SELECT password_hash FROM ventas_vendedores WHERE id=:id"), {"id": v["id"]}).scalar()
    if not bcrypt.checkpw(body.actual.encode(), h.encode()):
        raise HTTPException(400, "La clave actual no coincide")
    if len(body.nueva) < 8:
        raise HTTPException(400, "Mínimo 8 caracteres")
    db.execute(text("UPDATE ventas_vendedores SET password_hash=:h WHERE id=:id"), {"h": demo._hash(body.nueva), "id": v["id"]}); db.commit()
    return {"ok": True}


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _row(db, sql, **p):
    r = db.execute(text(sql), p).fetchone()
    return dict(r._mapping) if r else None


def _rows(db, sql, **p):
    return [dict(r._mapping) for r in db.execute(text(sql), p).fetchall()]


def _edificio(db: Session, eid: int, v: dict) -> dict:
    e = _row(db, "SELECT e.*, vd.nombre AS vendedor_nombre FROM ventas_edificios e LEFT JOIN ventas_vendedores vd ON vd.id=e.vendedor_id WHERE e.id=:id", id=eid)
    if not e:
        raise HTTPException(404, "Edificio no encontrado")
    if v["rol"] != "admin" and e["vendedor_id"] not in (None, v["id"]):
        raise HTTPException(403, "Este edificio es de otro vendedor")
    return e


def _precio(modulos: List[str], unidades: int, precio_unidad: Optional[int] = None, descuento_pct: int = 0) -> dict:
    keys = set(modulos or []) | {"base"}
    items = [m for m in MODULOS if m["key"] in keys]
    pu = precio_unidad if precio_unidad else sum(m["precio"] for m in items)
    total = max(pu * max(unidades or 0, 0), MINIMO_MENSUAL if unidades else 0)
    if descuento_pct:
        total = int(round(total * (100 - descuento_pct) / 100))
    return {"items": items, "precio_unidad": pu, "total_mensual": int(total), "unidades": unidades, "descuento_pct": descuento_pct}


def _telemetria(db: Session, tenant_id: Optional[int]) -> dict:
    if not tenant_id:
        return {"ingresos": 0, "modulos": [], "ultimo": None, "eventos": []}
    ev = _rows(db, "SELECT tipo, rol, detalle, created_at FROM ventas_eventos WHERE tenant_id=:t ORDER BY created_at DESC LIMIT 40", t=tenant_id)
    logins = _row(db, "SELECT COUNT(*) AS n, MAX(created_at) AS u FROM ventas_eventos WHERE tenant_id=:t AND tipo='demo_login'", t=tenant_id) or {}
    mods = _rows(db, "SELECT detalle, COUNT(*) AS n FROM ventas_eventos WHERE tenant_id=:t AND tipo IN ('demo_modulo','demo_accion') GROUP BY detalle ORDER BY n DESC LIMIT 8", t=tenant_id)
    return {"ingresos": logins.get("n", 0), "ultimo": logins.get("u"), "modulos": mods, "eventos": ev}


def _temperatura(t: dict, p: Optional[dict]) -> str:
    score = (t.get("ingresos") or 0) * 2 + len(t.get("modulos") or []) + ((p or {}).get("aperturas") or 0)
    return "caliente" if score >= 8 else "tibio" if score >= 3 else "frio"


# ─── Edificios ───────────────────────────────────────────────────────────────

class EdificioIn(BaseModel):
    nombre: str
    tipo: str = "departamentos"
    direccion: Optional[str] = None
    comuna: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    unidades: Optional[int] = None
    administrador_nombre: Optional[str] = None
    administrador_email: Optional[str] = None
    administrador_telefono: Optional[str] = None
    empresa_admin: Optional[str] = None
    dolores: List[str] = []
    notas: Optional[str] = None
    proxima_accion: Optional[str] = None
    proxima_fecha: Optional[date] = None
    # visita inicial (opcional): se registra junto con el edificio
    resultado: Optional[str] = None
    nota_visita: Optional[str] = None


@router.get("/edificios")
def listar_edificios(etapa: Optional[str] = None, q: Optional[str] = None, v: dict = Depends(get_vendedor), db: Session = Depends(get_db)):
    where, p = ["1=1"], {}
    if v["rol"] != "admin":
        where.append("(e.vendedor_id=:vid OR e.vendedor_id IS NULL)"); p["vid"] = v["id"]
    if etapa:
        where.append("e.etapa=:et"); p["et"] = etapa
    if q:
        where.append("(e.nombre ILIKE :q OR e.direccion ILIKE :q OR e.comuna ILIKE :q OR e.administrador_nombre ILIKE :q)"); p["q"] = f"%{q}%"
    return _rows(db, f"""
        SELECT e.*, (SELECT COUNT(*) FROM ventas_visitas x WHERE x.edificio_id=e.id) AS visitas,
               (SELECT MAX(fecha) FROM ventas_visitas x WHERE x.edificio_id=e.id) AS ultima_visita,
               (SELECT aperturas FROM ventas_propuestas pr WHERE pr.edificio_id=e.id ORDER BY id DESC LIMIT 1) AS aperturas,
               (SELECT vence FROM ventas_demos d WHERE d.edificio_id=e.id ORDER BY id DESC LIMIT 1) AS demo_vence,
               (SELECT estado FROM ventas_demos d WHERE d.edificio_id=e.id ORDER BY id DESC LIMIT 1) AS demo_estado
        FROM ventas_edificios e WHERE {' AND '.join(where)} ORDER BY e.updated_at DESC LIMIT 300""", **p)


@router.post("/edificios", status_code=201)
def crear_edificio(body: EdificioIn, v: dict = Depends(get_vendedor), db: Session = Depends(get_db)):
    _ensure_schema(db)
    etapa = "perdido" if body.resultado in ("rechazo", "tiene_sistema") else "visitado"
    eid = db.execute(text("""
        INSERT INTO ventas_edificios (nombre, tipo, direccion, comuna, lat, lng, unidades, administrador_nombre, administrador_email, administrador_telefono,
            empresa_admin, etapa, motivo_perdida, dolores, notas, vendedor_id, proxima_accion, proxima_fecha)
        VALUES (:nombre, :tipo, :direccion, :comuna, :lat, :lng, :unidades, :an, :ae, :at, :ea, :etapa, :mp, :dol, :notas, :vid, :pa, :pf) RETURNING id"""), {
        "nombre": body.nombre.strip(), "tipo": body.tipo, "direccion": body.direccion, "comuna": body.comuna, "lat": body.lat, "lng": body.lng,
        "unidades": body.unidades, "an": body.administrador_nombre, "ae": (body.administrador_email or "").strip().lower() or None, "at": body.administrador_telefono,
        "ea": body.empresa_admin, "etapa": etapa, "mp": RESULTADOS.get(body.resultado) if etapa == "perdido" else None, "dol": json.dumps(body.dolores),
        "notas": body.notas, "vid": v["id"], "pa": body.proxima_accion, "pf": body.proxima_fecha}).scalar()
    if body.resultado:
        db.execute(text("INSERT INTO ventas_visitas (edificio_id, vendedor_id, resultado, lat, lng, nota) VALUES (:e, :v, :r, :lat, :lng, :n)"),
                   {"e": eid, "v": v["id"], "r": body.resultado, "lat": body.lat, "lng": body.lng, "n": body.nota_visita})
    db.commit()
    return _edificio(db, eid, v)


class EdificioPatch(BaseModel):
    nombre: Optional[str] = None
    tipo: Optional[str] = None
    direccion: Optional[str] = None
    comuna: Optional[str] = None
    unidades: Optional[int] = None
    administrador_nombre: Optional[str] = None
    administrador_email: Optional[str] = None
    administrador_telefono: Optional[str] = None
    empresa_admin: Optional[str] = None
    etapa: Optional[str] = None
    motivo_perdida: Optional[str] = None
    dolores: Optional[List[str]] = None
    notas: Optional[str] = None
    proxima_accion: Optional[str] = None
    proxima_fecha: Optional[date] = None
    valor_mensual: Optional[int] = None
    vendedor_id: Optional[int] = None


@router.patch("/edificios/{eid}")
def editar_edificio(eid: int, body: EdificioPatch, v: dict = Depends(get_vendedor), db: Session = Depends(get_db)):
    _edificio(db, eid, v)
    data = {k: val for k, val in body.dict(exclude_unset=True).items()}
    if "etapa" in data and data["etapa"] not in ETAPAS:
        raise HTTPException(400, "Etapa inválida")
    if "vendedor_id" in data and v["rol"] != "admin":
        data.pop("vendedor_id")
    if "dolores" in data:
        data["dolores"] = json.dumps(data["dolores"])
    if "administrador_email" in data and data["administrador_email"]:
        data["administrador_email"] = data["administrador_email"].strip().lower()
    if not data:
        return _edificio(db, eid, v)
    sets = ", ".join(f"{k}=:{k}" for k in data) + ", updated_at=NOW()"
    db.execute(text(f"UPDATE ventas_edificios SET {sets} WHERE id=:id"), {**data, "id": eid}); db.commit()
    return _edificio(db, eid, v)


@router.get("/edificios/{eid}")
def detalle_edificio(eid: int, v: dict = Depends(get_vendedor), db: Session = Depends(get_db)):
    e = _edificio(db, eid, v)
    visitas = _rows(db, "SELECT x.*, vd.nombre AS vendedor_nombre FROM ventas_visitas x LEFT JOIN ventas_vendedores vd ON vd.id=x.vendedor_id WHERE edificio_id=:e ORDER BY fecha DESC", e=eid)
    props = _rows(db, "SELECT id, token, modulos, precio_unidad, unidades, total_mensual, descuento_pct, meses_gratis, enviado_email, enviado_wa, enviado_en, abierto_en, aperturas, demo_id, created_at FROM ventas_propuestas WHERE edificio_id=:e ORDER BY id DESC", e=eid)
    demos = _rows(db, "SELECT * FROM ventas_demos WHERE edificio_id=:e ORDER BY id DESC", e=eid)
    for d in demos:
        d["telemetria"] = _telemetria(db, d["tenant_id"])
        d["estado_actual"] = demo.estado_demo(db, d["tenant_id"]) if d["tenant_id"] else None
    for p in props:
        p["url"] = f"{VENTAS_URL}/p/{p['token']}"; p["pdf_url"] = f"{VENTAS_URL}/api/ventas-terreno/p/{p['token']}/pdf"
    t = demos[0]["telemetria"] if demos else {"ingresos": 0, "modulos": []}
    e["temperatura"] = _temperatura(t, props[0] if props else None)
    return {**e, "visitas": visitas, "propuestas": props, "demos": demos, "catalogo_dolores": DOLORES}


@router.delete("/edificios/{eid}", status_code=204)
def borrar_edificio(eid: int, v: dict = Depends(get_vendedor), db: Session = Depends(get_db)):
    if v["rol"] != "admin":
        raise HTTPException(403, "Solo el administrador de ventas puede eliminar")
    db.execute(text("DELETE FROM ventas_edificios WHERE id=:id"), {"id": eid}); db.commit()


# ─── Visitas ─────────────────────────────────────────────────────────────────

class VisitaIn(BaseModel):
    resultado: str
    nota: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    proxima_accion: Optional[str] = None
    proxima_fecha: Optional[date] = None
    dolores: Optional[List[str]] = None


@router.post("/edificios/{eid}/visitas", status_code=201)
def registrar_visita(eid: int, body: VisitaIn, v: dict = Depends(get_vendedor), db: Session = Depends(get_db)):
    e = _edificio(db, eid, v)
    if body.resultado not in RESULTADOS:
        raise HTTPException(400, "Resultado inválido")
    db.execute(text("INSERT INTO ventas_visitas (edificio_id, vendedor_id, resultado, lat, lng, nota) VALUES (:e, :v, :r, :lat, :lng, :n)"),
               {"e": eid, "v": v["id"], "r": body.resultado, "lat": body.lat, "lng": body.lng, "n": body.nota})
    sets, p = ["updated_at=NOW()"], {"id": eid}
    if body.resultado in ("rechazo", "tiene_sistema") and e["etapa"] not in ("cliente",):
        sets.append("etapa='perdido'"); sets.append("motivo_perdida=:mp"); p["mp"] = RESULTADOS[body.resultado]
    elif body.resultado in ("interesado", "reunion") and e["etapa"] == "perdido":
        sets.append("etapa='visitado'"); sets.append("motivo_perdida=NULL")
    if body.proxima_accion is not None:
        sets.append("proxima_accion=:pa"); p["pa"] = body.proxima_accion
    if body.proxima_fecha is not None:
        sets.append("proxima_fecha=:pf"); p["pf"] = body.proxima_fecha
    if body.dolores is not None:
        sets.append("dolores=:dol"); p["dol"] = json.dumps(body.dolores)
    if body.lat and not e.get("lat"):
        sets.append("lat=:lat"); sets.append("lng=:lng"); p["lat"] = body.lat; p["lng"] = body.lng
    db.execute(text(f"UPDATE ventas_edificios SET {', '.join(sets)} WHERE id=:id"), p); db.commit()
    return _edificio(db, eid, v)


# ─── Mi dia / pipeline ───────────────────────────────────────────────────────

@router.get("/hoy")
def hoy(v: dict = Depends(get_vendedor), db: Session = Depends(get_db)):
    _ensure_schema(db)
    mine = "" if v["rol"] == "admin" else "AND (e.vendedor_id=:vid OR e.vendedor_id IS NULL)"
    p = {"vid": v["id"]}
    k = _row(db, f"""SELECT
        (SELECT COUNT(*) FROM ventas_edificios e WHERE 1=1 {mine}) AS edificios,
        (SELECT COUNT(*) FROM ventas_visitas x JOIN ventas_edificios e ON e.id=x.edificio_id WHERE x.fecha::date = CURRENT_DATE {mine}) AS visitas_hoy,
        (SELECT COUNT(*) FROM ventas_propuestas pr JOIN ventas_edificios e ON e.id=pr.edificio_id WHERE pr.enviado_en IS NOT NULL {mine}) AS propuestas,
        (SELECT COUNT(*) FROM ventas_demos d JOIN ventas_edificios e ON e.id=d.edificio_id WHERE d.estado='activo' AND d.vence > NOW() {mine}) AS demos_activos,
        (SELECT COUNT(*) FROM ventas_edificios e WHERE e.etapa='cliente' AND date_trunc('month', e.updated_at)=date_trunc('month', NOW()) {mine}) AS cerrados_mes,
        (SELECT COALESCE(SUM(valor_mensual),0) FROM ventas_edificios e WHERE e.etapa IN ('propuesta','demo','negociacion') {mine}) AS valor_en_juego""", **p)
    tareas = []
    for e in _rows(db, f"SELECT e.id, e.nombre, e.unidades, e.proxima_accion, e.proxima_fecha, e.administrador_nombre, e.administrador_telefono FROM ventas_edificios e WHERE e.proxima_fecha <= CURRENT_DATE + 1 AND e.etapa NOT IN ('cliente','perdido') {mine} ORDER BY e.proxima_fecha", **p):
        tareas.append({"tipo": "accion", "edificio_id": e["id"], "titulo": f"{e['proxima_accion'] or 'Seguimiento'} — {e['nombre']}", "detalle": f"{e['administrador_nombre'] or ''} {e['administrador_telefono'] or ''}".strip(), "cuando": str(e["proxima_fecha"]), "urgente": e["proxima_fecha"] <= date.today()})
    for d in _rows(db, f"SELECT d.id, d.edificio_id, d.vence, d.tenant_id, e.nombre, e.unidades, e.administrador_nombre FROM ventas_demos d JOIN ventas_edificios e ON e.id=d.edificio_id WHERE d.estado='activo' AND d.vence < NOW() + INTERVAL '2 days' {mine} ORDER BY d.vence", **p):
        t = _telemetria(db, d["tenant_id"])
        tareas.append({"tipo": "demo_vence", "edificio_id": d["edificio_id"], "demo_id": d["id"], "titulo": f"Demo {'venció' if d['vence'] < datetime.now(timezone.utc) else 'vence pronto'} — {d['nombre']}", "detalle": f"{d['administrador_nombre'] or ''} · {t['ingresos']} ingresos · " + ", ".join(m['detalle'] for m in t['modulos'][:3]), "cuando": d["vence"].isoformat(), "urgente": True})
    for pr in _rows(db, f"SELECT pr.id, pr.edificio_id, pr.enviado_en, e.nombre, e.administrador_telefono FROM ventas_propuestas pr JOIN ventas_edificios e ON e.id=pr.edificio_id WHERE pr.enviado_en < NOW() - INTERVAL '3 days' AND pr.abierto_en IS NULL AND e.etapa IN ('propuesta','demo') {mine} ORDER BY pr.enviado_en LIMIT 10", **p):
        tareas.append({"tipo": "sin_abrir", "edificio_id": pr["edificio_id"], "titulo": f"Propuesta sin abrir — {pr['nombre']}", "detalle": f"Enviada {pr['enviado_en'].strftime('%d/%m')} · reenviar por WhatsApp", "cuando": pr["enviado_en"].isoformat(), "urgente": False})
    calientes = []
    for d in _rows(db, f"SELECT d.edificio_id, d.tenant_id, e.nombre, e.administrador_nombre FROM ventas_demos d JOIN ventas_edificios e ON e.id=d.edificio_id WHERE d.estado='activo' {mine} ORDER BY d.id DESC LIMIT 20", **p):
        t = _telemetria(db, d["tenant_id"])
        if _temperatura(t, None) == "caliente":
            calientes.append({"edificio_id": d["edificio_id"], "titulo": f"{d['nombre']} está probando en serio", "detalle": f"{t['ingresos']} ingresos · " + ", ".join(m['detalle'] for m in t['modulos'][:3]) + " · llámalo hoy"})
    recientes = _rows(db, f"SELECT e.id, e.nombre, e.comuna, e.etapa, e.unidades, e.updated_at FROM ventas_edificios e WHERE 1=1 {mine} ORDER BY e.updated_at DESC LIMIT 6", **p)
    return {"kpis": k, "tareas": tareas, "calientes": calientes, "recientes": recientes, "vendedor": v}


@router.get("/pipeline")
def pipeline(v: dict = Depends(get_vendedor), db: Session = Depends(get_db)):
    _ensure_schema(db)
    mine = "" if v["rol"] == "admin" else "AND (e.vendedor_id=:vid OR e.vendedor_id IS NULL)"
    rows = _rows(db, f"""SELECT e.id, e.nombre, e.comuna, e.tipo, e.unidades, e.etapa, e.valor_mensual, e.proxima_accion, e.proxima_fecha, e.updated_at, e.administrador_nombre,
        (SELECT aperturas FROM ventas_propuestas pr WHERE pr.edificio_id=e.id ORDER BY id DESC LIMIT 1) AS aperturas,
        (SELECT abierto_en FROM ventas_propuestas pr WHERE pr.edificio_id=e.id ORDER BY id DESC LIMIT 1) AS abierto_en,
        (SELECT enviado_en FROM ventas_propuestas pr WHERE pr.edificio_id=e.id ORDER BY id DESC LIMIT 1) AS enviado_en,
        (SELECT vence FROM ventas_demos d WHERE d.edificio_id=e.id ORDER BY id DESC LIMIT 1) AS demo_vence,
        (SELECT tenant_id FROM ventas_demos d WHERE d.edificio_id=e.id ORDER BY id DESC LIMIT 1) AS demo_tenant
        FROM ventas_edificios e WHERE 1=1 {mine} ORDER BY e.updated_at DESC""", vid=v["id"])
    cols = {et: [] for et in ETAPAS}
    for r in rows:
        if r["demo_tenant"]:
            t = _telemetria(db, r["demo_tenant"]); r["demo_ingresos"] = t["ingresos"]; r["temperatura"] = _temperatura(t, r)
        cols.setdefault(r["etapa"], []).append(r)
    valor = sum((r["valor_mensual"] or 0) for r in rows if r["etapa"] in ("propuesta", "demo", "negociacion"))
    return {"etapas": ETAPAS, "columnas": cols, "valor_en_juego": valor}


# ─── Cotizador / propuestas ──────────────────────────────────────────────────

@router.get("/modulos")
def modulos():
    return {"modulos": MODULOS, "dolores": DOLORES, "minimo_mensual": MINIMO_MENSUAL, "demo_dias": demo.DEMO_DIAS}


class CotizarIn(BaseModel):
    modulos: List[str] = []
    unidades: int
    precio_unidad: Optional[int] = None
    descuento_pct: int = 0


@router.post("/cotizar")
def cotizar(body: CotizarIn, v: dict = Depends(get_vendedor)):
    return _precio(body.modulos, body.unidades, body.precio_unidad, body.descuento_pct)


class PropuestaIn(BaseModel):
    modulos: List[str] = []
    unidades: Optional[int] = None
    precio_unidad: Optional[int] = None
    descuento_pct: int = 0
    meses_gratis: int = 0
    mensaje: Optional[str] = None
    con_demo: bool = True
    enviar_email: bool = True
    enviar_whatsapp: bool = False
    demo_dias: Optional[int] = None


@router.post("/edificios/{eid}/propuestas", status_code=201)
def crear_propuesta(eid: int, body: PropuestaIn, request: Request, v: dict = Depends(get_vendedor), db: Session = Depends(get_db)):
    e = _edificio(db, eid, v)
    unidades = body.unidades or e["unidades"]
    if not unidades:
        raise HTTPException(400, "Indica el número de unidades del edificio")
    if body.con_demo and not e["administrador_email"]:
        raise HTTPException(400, "El demo se liga al correo del administrador: agrégalo primero")
    if body.enviar_email and not e["administrador_email"]:
        raise HTTPException(400, "Falta el correo del administrador")
    pr = _precio(body.modulos, unidades, body.precio_unidad, body.descuento_pct)
    token = secrets.token_urlsafe(12)

    demo_row = None
    if body.con_demo:
        activo = _row(db, "SELECT * FROM ventas_demos WHERE edificio_id=:e AND estado='activo' ORDER BY id DESC LIMIT 1", e=eid)
        if activo and activo["vence"] and activo["vence"] > datetime.now(timezone.utc):
            demo_row = activo
        else:
            try:
                info = demo.clonar_tenant(db, nombre=e["nombre"], direccion=e["direccion"] or "", comuna=e["comuna"] or "", email_admin=e["administrador_email"],
                                          nombre_admin=e["administrador_nombre"] or "Administrador", unidades=unidades, tipo_unidad=e["tipo"], dias=body.demo_dias or demo.DEMO_DIAS)
            except Exception as ex:
                db.rollback()
                raise HTTPException(500, f"No se pudo crear el demo: {ex}")
            did = db.execute(text("INSERT INTO ventas_demos (edificio_id, tenant_id, subdominio, dominio, email, credenciales, vence, estado) VALUES (:e, :t, :s, :d, :em, :c, :v, 'activo') RETURNING id"),
                             {"e": eid, "t": info["tenant_id"], "s": info["subdominio"], "d": info["dominio"], "em": e["administrador_email"], "c": json.dumps(info), "v": info["vence"]}).scalar()
            db.commit()
            demo_row = _row(db, "SELECT * FROM ventas_demos WHERE id=:id", id=did)

    pid = db.execute(text("""INSERT INTO ventas_propuestas (edificio_id, vendedor_id, token, modulos, precio_unidad, unidades, total_mensual, descuento_pct, meses_gratis, mensaje, demo_id)
        VALUES (:e, :v, :tok, :m, :pu, :u, :tot, :dp, :mg, :msg, :did) RETURNING id"""),
        {"e": eid, "v": v["id"], "tok": token, "m": json.dumps([m["key"] for m in pr["items"]]), "pu": pr["precio_unidad"], "u": unidades, "tot": pr["total_mensual"],
         "dp": body.descuento_pct, "mg": body.meses_gratis, "msg": body.mensaje, "did": demo_row["id"] if demo_row else None}).scalar()
    db.commit()
    prop = _row(db, "SELECT * FROM ventas_propuestas WHERE id=:id", id=pid)

    # PDF
    try:
        pdf_bytes = _pdf_propuesta(prop, e, demo_row, v)
        d = UPLOAD_DIR / "ventas" / "propuestas"; d.mkdir(parents=True, exist_ok=True)
        path = d / f"{token}.pdf"; path.write_bytes(pdf_bytes)
        db.execute(text("UPDATE ventas_propuestas SET pdf_path=:p WHERE id=:id"), {"p": str(path), "id": pid}); db.commit()
    except Exception as ex:
        pdf_bytes = None
        print("PDF error:", ex)

    nueva_etapa = "demo" if demo_row else "propuesta"
    db.execute(text("UPDATE ventas_edificios SET etapa=CASE WHEN etapa IN ('negociacion','cliente') THEN etapa ELSE :et END, valor_mensual=:val, updated_at=NOW() WHERE id=:id"),
               {"et": nueva_etapa, "val": pr["total_mensual"], "id": eid}); db.commit()

    envio = _enviar_propuesta(db, prop, e, demo_row, v, pdf_bytes, email=body.enviar_email, whatsapp=body.enviar_whatsapp)
    return {"propuesta": {**prop, "url": f"{VENTAS_URL}/p/{token}", "pdf_url": f"{VENTAS_URL}/api/ventas-terreno/p/{token}/pdf"}, "demo": demo_row, "envio": envio, "precio": pr}


@router.get("/propuestas")
def listar_propuestas(v: dict = Depends(get_vendedor), db: Session = Depends(get_db)):
    """Todas las propuestas del vendedor (condominios + cortinas) para la seccion Propuestas."""
    _ensure_schema(db)
    mine = "" if v["rol"] == "admin" else "AND (e.vendedor_id=:vid OR e.vendedor_id IS NULL)"
    condo = _rows(db, f"""SELECT pr.id, pr.token, pr.precio_unidad, pr.unidades, pr.total_mensual, pr.enviado_email, pr.enviado_wa, pr.enviado_en, pr.abierto_en, pr.aperturas, pr.created_at,
        e.id AS edificio_id, e.nombre, e.comuna, e.etapa, e.administrador_nombre, e.administrador_email, e.administrador_telefono,
        d.dominio AS demo_dominio, d.vence AS demo_vence, d.estado AS demo_estado
        FROM ventas_propuestas pr JOIN ventas_edificios e ON e.id=pr.edificio_id LEFT JOIN ventas_demos d ON d.id=pr.demo_id WHERE 1=1 {mine} ORDER BY pr.id DESC LIMIT 200""", vid=v["id"])
    for p in condo:
        p["tipo"] = "condominio"; p["url"] = f"{VENTAS_URL}/p/{p['token']}"; p["pdf_url"] = f"{VENTAS_URL}/api/ventas-terreno/p/{p['token']}/pdf"; p["ficha"] = f"/ventas/edificios/{p['edificio_id']}"
    cort = []
    try:
        mine_l = mine.replace("e.vendedor_id", "l.vendedor_id")
        cort = _rows(db, f"""SELECT pr.id, pr.token, pr.niveles, pr.nivel_sugerido, pr.enviado_email, pr.enviado_wa, pr.enviado_en, pr.abierto_en, pr.aperturas, pr.aceptada_en, pr.nivel_aceptado, pr.created_at,
            l.id AS lead_id, l.nombre, l.comuna, l.etapa, l.telefono AS administrador_telefono, l.email AS administrador_email
            FROM ventas_cortinas_propuestas pr JOIN ventas_cortinas_leads l ON l.id=pr.lead_id WHERE 1=1 {mine_l} ORDER BY pr.id DESC LIMIT 200""", vid=v["id"])
    except Exception:
        db.rollback()
    for p in cort:
        niv = p["niveles"] or {}; k = p["nivel_aceptado"] or p["nivel_sugerido"]
        p["tipo"] = "cortinas"; p["total_mensual"] = None; p["total"] = (niv.get(k) or {}).get("total"); p["nivel"] = (niv.get(k) or {}).get("nombre")
        p["url"] = f"{VENTAS_URL}/tb/{p['token']}"; p["pdf_url"] = f"{VENTAS_URL}/api/ventas-terreno/cortinas/p/{p['token']}/pdf"; p["ficha"] = f"/ventas/cortinas/{p['lead_id']}"
    neg = []
    try:
        mine_n = mine.replace("e.vendedor_id", "n.vendedor_id")
        neg = _rows(db, f"""SELECT pr.id, pr.token, pr.items, pr.total_mensual, pr.total_setup, pr.enviado_email, pr.enviado_wa, pr.enviado_en, pr.abierto_en, pr.aperturas, pr.aceptada_en, pr.created_at,
            n.id AS negocio_id, n.nombre, n.comuna, n.etapa, n.telefono AS administrador_telefono, n.email AS administrador_email
            FROM ventas_negocios_propuestas pr JOIN ventas_negocios n ON n.id=pr.negocio_id WHERE 1=1 {mine_n} ORDER BY pr.id DESC LIMIT 200""", vid=v["id"])
    except Exception:
        db.rollback()
    for p in neg:
        p["tipo"] = "negocio"; p["productos"] = ", ".join(i["nombre"] for i in (p["items"] or []))
        p["url"] = f"{VENTAS_URL}/n/{p['token']}"; p["pdf_url"] = f"{VENTAS_URL}/api/ventas-terreno/negocios/p/{p['token']}/pdf"; p["ficha"] = f"/ventas/negocios/{p['negocio_id']}"
    todas = sorted(condo + cort + neg, key=lambda x: x["created_at"], reverse=True)
    return {"propuestas": todas, "resumen": {"total": len(todas), "abiertas": sum(1 for x in todas if x.get("aperturas")), "aceptadas": sum(1 for x in cort + neg if x.get("aceptada_en")),
            "sin_abrir": sum(1 for x in todas if x.get("enviado_en") and not x.get("abierto_en"))}}


@router.post("/propuestas/{pid}/reenviar")
def reenviar(pid: int, canal: str = "email", v: dict = Depends(get_vendedor), db: Session = Depends(get_db)):
    prop = _row(db, "SELECT * FROM ventas_propuestas WHERE id=:id", id=pid)
    if not prop:
        raise HTTPException(404, "Propuesta no encontrada")
    e = _edificio(db, prop["edificio_id"], v)
    d = _row(db, "SELECT * FROM ventas_demos WHERE id=:id", id=prop["demo_id"]) if prop["demo_id"] else None
    pdf = Path(prop["pdf_path"]).read_bytes() if prop.get("pdf_path") and Path(prop["pdf_path"]).exists() else None
    return _enviar_propuesta(db, prop, e, d, v, pdf, email=canal in ("email", "ambos"), whatsapp=canal in ("whatsapp", "ambos"))


def _mensaje_wa(prop: dict, e: dict, d: Optional[dict], v: dict) -> str:
    url = f"{VENTAS_URL}/p/{prop['token']}"
    txt = (f"Hola {e.get('administrador_nombre') or ''}! Soy {v['nombre']} de {MARCA}. Gracias por recibirme en {e['nombre']}.\n\n"
           f"Aquí está la propuesta para las {prop['unidades']} unidades: {url}\n")
    if d:
        c = d.get("credenciales") or {}
        if isinstance(c, str): c = json.loads(c)
        txt += (f"\nY tu demo en vivo por {demo.DEMO_DIAS} días, con el nombre de tu edificio:\n"
                f"👤 Administración: {c.get('admin', {}).get('url')}\n   usuario {c.get('admin', {}).get('email')} · clave {c.get('admin', {}).get('password')}\n"
                f"🛎️ Conserjería: {c.get('conserje', {}).get('url')}\n   usuario {c.get('conserje', {}).get('email')} · clave {c.get('conserje', {}).get('password')}\n"
                f"🏠 App vecinos: {c.get('residente', {}).get('url')}\n   RUT {c.get('residente', {}).get('rut')} · clave {c.get('residente', {}).get('password')}\n")
    txt += f"\nCualquier duda me escribes por aquí. {v.get('telefono') or ''}".rstrip()
    return txt


def _enviar_propuesta(db, prop, e, d, v, pdf_bytes, *, email: bool, whatsapp: bool) -> dict:
    out = {"email": None, "whatsapp": None, "wa_link": None}
    url = f"{VENTAS_URL}/p/{prop['token']}"
    if email and e.get("administrador_email"):
        cred_html = ""
        if d:
            c = d.get("credenciales") or {}
            if isinstance(c, str): c = json.loads(c)
            vence = d["vence"].strftime("%d/%m/%Y") if isinstance(d.get("vence"), datetime) else str(d.get("vence"))[:10]
            cred_html = ("<h3 style='margin:24px 0 8px;color:#0B1F2A'>Tu demo en vivo (" + f"{demo.DEMO_DIAS} días, hasta el {vence})</h3>"
                         "<p style='color:#35505C;font-size:14px'>Es una copia completa del sistema con el nombre de tu edificio y datos de muestra. Puedes tocar todo.</p>"
                         "<table style='width:100%;border-collapse:collapse;font-size:14px'>" +
                         "".join(f"<tr><td style='padding:10px;border-bottom:1px solid #eee'><b>{lbl}</b><br><a href='{c.get(k, {}).get('url')}'>{c.get(k, {}).get('url')}</a></td>"
                                 f"<td style='padding:10px;border-bottom:1px solid #eee'>{'RUT' if k == 'residente' else 'Usuario'}: <code>{c.get(k, {}).get('rut') or c.get(k, {}).get('email')}</code><br>Clave: <code>{c.get(k, {}).get('password')}</code></td></tr>"
                                 for k, lbl in (("admin", "Administración"), ("conserje", "Conserjería"), ("residente", "App de vecinos"))) + "</table>")
        html = (f"<div style='font-family:Inter,Arial,sans-serif;max-width:620px;margin:auto;background:#fff'>"
                f"<div style='background:#0B1F2A;color:#fff;padding:28px 28px 22px;border-radius:14px 14px 0 0'><img src='{LOGO_CAI_URL}' alt='ConectaAI' width='84' height='84' style='display:block;background:#fff;border-radius:16px;padding:6px;margin-bottom:14px'><p style='margin:0;font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:#7FD1C6'>Propuesta para</p>"
                f"<h1 style='margin:6px 0 0;font-size:26px'>{e['nombre']}</h1><p style='margin:6px 0 0;color:#B9C8CC'>{prop['unidades']} unidades · {e.get('comuna') or ''}</p></div>"
                f"<div style='border:1px solid #DDE4E6;border-top:none;padding:28px;border-radius:0 0 14px 14px'>"
                f"<p style='font-size:15px;color:#0B1F2A'>Hola {e.get('administrador_nombre') or ''},</p>"
                f"<p style='font-size:15px;color:#35505C'>{(prop.get('mensaje') or 'Gracias por recibirme. Te dejo la propuesta y un demo funcionando para que lo pruebes con tu equipo y tu comité.')}</p>"
                f"<p style='background:#DDF4F0;border-radius:12px;padding:14px 16px;color:#0F766E;font-size:15px'><b>${prop['precio_unidad']:,} por unidad al mes</b> · ${prop['total_mensual']:,} mensuales · sin costo de implementación · sin permanencia".replace(",", ".") + (f" · {prop['meses_gratis']} mes(es) gratis" if prop.get("meses_gratis") else "") + "</p>"
                f"<p style='margin:22px 0'><a href='{url}' style='background:#0F766E;color:#fff;padding:14px 22px;border-radius:10px;text-decoration:none;font-weight:700'>Ver propuesta completa</a></p>"
                + cred_html +
                f"<p style='margin-top:26px;font-size:14px;color:#35505C'>{v['nombre']} · {MARCA}<br>{v.get('telefono') or ''} · {v['email']}</p>"
                "<p style='font-size:11px;color:#9ca3af'>Adjuntamos la propuesta en PDF. Al vencer el demo podrás seguir viendo el sistema, pero no modificarlo.</p></div></div>")
        payload = {"to": e["administrador_email"], "from": "ventas@conectaai.cl", "reply_to": v["email"], "subject": f"Propuesta {MARCA} para {e['nombre']}" + (" + demo en vivo" if d else ""), "html": html}
        if pdf_bytes:
            payload["attachments"] = [{"filename": f"Propuesta-{demo.slugify(e['nombre'])}.pdf", "content": base64.b64encode(pdf_bytes).decode(), "contentType": "application/pdf"}]
        try:
            r = httpx.post(MAIL_API_URL, headers={"Authorization": "Bearer " + MAIL_API_KEY, "Content-Type": "application/json"}, json=payload, timeout=20.0)
            out["email"] = "enviado" if r.status_code < 300 else f"error {r.status_code}"
        except Exception as ex:
            out["email"] = f"error: {ex}"
        if out["email"] == "enviado":
            db.execute(text("UPDATE ventas_propuestas SET enviado_email=true, enviado_en=COALESCE(enviado_en, NOW()) WHERE id=:id"), {"id": prop["id"]}); db.commit()
    msg = _mensaje_wa(prop, e, d, v)
    tel = "".join(ch for ch in (e.get("administrador_telefono") or "") if ch.isdigit())
    if tel and len(tel) == 9: tel = "56" + tel
    out["wa_link"] = f"https://wa.me/{tel}?text={quote(msg)}" if tel else f"https://wa.me/?text={quote(msg)}"
    if whatsapp and tel and EVOLUTION_API_URL and EVOLUTION_API_KEY:
        try:
            r = httpx.post(f"{EVOLUTION_API_URL}/message/sendText/{EVOLUTION_INSTANCE}", headers={"apikey": EVOLUTION_API_KEY, "Content-Type": "application/json"},
                           json={"number": tel, "text": msg}, timeout=15.0)
            out["whatsapp"] = "enviado" if r.status_code < 300 else f"error {r.status_code}"
            if r.status_code < 300:
                db.execute(text("UPDATE ventas_propuestas SET enviado_wa=true, enviado_en=COALESCE(enviado_en, NOW()) WHERE id=:id"), {"id": prop["id"]}); db.commit()
        except Exception as ex:
            out["whatsapp"] = f"error: {ex}"
    return out


# ─── PDF ─────────────────────────────────────────────────────────────────────

def _pdf_propuesta(prop: dict, e: dict, d: Optional[dict], v: dict) -> bytes:
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas
    from reportlab.lib.colors import HexColor
    from reportlab.lib.utils import ImageReader
    import qrcode

    W, H = A4
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    INK, TEAL, MUT, SOFT = HexColor("#0B1F2A"), HexColor("#0F766E"), HexColor("#7A8F98"), HexColor("#DDF4F0")
    fmt = lambda n: "$" + f"{int(n):,}".replace(",", ".")
    mods = prop["modulos"] if isinstance(prop["modulos"], list) else json.loads(prop["modulos"] or "[]")
    items = [m for m in MODULOS if m["key"] in set(mods) | {"base"}]
    dol = e.get("dolores") or []
    if isinstance(dol, str): dol = json.loads(dol)

    def footer(n):
        if LOGO_CAI.exists():
            try: c.drawImage(ImageReader(str(LOGO_CAI)), W - 82, H - 62, 42, 42)
            except Exception: pass
        c.setFont("Helvetica", 8); c.setFillColor(MUT)
        c.drawString(40, 28, f"{MARCA} · Propuesta para {e['nombre']} · {datetime.now().strftime('%d/%m/%Y')}")
        c.drawRightString(W - 40, 28, f"{n}")

    def wrap(txt, width, font="Helvetica", size=10.5):
        from reportlab.pdfbase.pdfmetrics import stringWidth
        words, lines, cur = (txt or "").split(), [], ""
        for w in words:
            t = (cur + " " + w).strip()
            if stringWidth(t, font, size) <= width: cur = t
            else: lines.append(cur); cur = w
        if cur: lines.append(cur)
        return lines

    # 1. Portada
    c.setFillColor(INK); c.rect(0, 0, W, H, fill=1, stroke=0)
    c.setFillColor(TEAL); c.rect(0, H - 14, W, 14, fill=1, stroke=0)
    if LOGO_CAI.exists():
        c.setFillColor(HexColor("#FFFFFF")); c.roundRect(W - 190, H - 200, 140, 140, 18, fill=1, stroke=0)
        try: c.drawImage(ImageReader(str(LOGO_CAI)), W - 182, H - 192, 124, 124)
        except Exception: pass
    c.setFillColor(HexColor("#7FD1C6")); c.setFont("Helvetica-Bold", 11); c.drawString(50, H - 120, "PROPUESTA COMERCIAL")
    c.setFillColor(HexColor("#FFFFFF")); c.setFont("Helvetica-Bold", 34)
    y = H - 175
    for ln in wrap(e["nombre"], W - 260, "Helvetica-Bold", 30): c.drawString(50, y, ln); y -= 36
    c.setFont("Helvetica", 14); c.setFillColor(HexColor("#B9C8CC"))
    c.drawString(50, y - 6, f"{prop['unidades']} unidades · {e.get('tipo', 'departamentos').capitalize()}" + (f" · {e['comuna']}" if e.get("comuna") else ""))
    if e.get("direccion"): c.drawString(50, y - 26, e["direccion"])
    c.setFillColor(HexColor("#FFFFFF")); c.setFont("Helvetica-Bold", 22); c.drawString(50, 250, MARCA)
    c.setFont("Helvetica", 12); c.setFillColor(HexColor("#B9C8CC"))
    c.drawString(50, 228, "Administración · Conserjería · App de vecinos, en una sola plataforma.")
    c.drawString(50, 160, f"Preparada por {v['nombre']} · {v.get('telefono') or ''} · {v['email']}")
    c.drawString(50, 142, f"Válida por 15 días · {datetime.now().strftime('%d de %B de %Y')}")
    c.showPage()

    # 2. Lo que nos contaste
    c.setFillColor(TEAL); c.setFont("Helvetica-Bold", 11); c.drawString(50, H - 60, "LO QUE NOS CONTASTE")
    c.setFillColor(INK); c.setFont("Helvetica-Bold", 24); c.drawString(50, H - 90, "Tus prioridades y cómo las resolvemos")
    y = H - 130
    for k in (dol or ["morosidad", "visitas", "sin_app"]):
        if k not in DOLORES: continue
        t, desc = DOLORES[k]
        c.setFillColor(SOFT); c.roundRect(50, y - 62, W - 100, 70, 10, fill=1, stroke=0)
        c.setFillColor(INK); c.setFont("Helvetica-Bold", 13); c.drawString(64, y - 14, t)
        c.setFont("Helvetica", 10.5); c.setFillColor(HexColor("#35505C")); yy = y - 32
        for ln in wrap(desc, W - 130)[:3]: c.drawString(64, yy, ln); yy -= 14
        y -= 84
        if y < 120: break
    footer(2); c.showPage()

    # 3. Las tres apps
    c.setFillColor(TEAL); c.setFont("Helvetica-Bold", 11); c.drawString(50, H - 60, "CÓMO FUNCIONA")
    c.setFillColor(INK); c.setFont("Helvetica-Bold", 24); c.drawString(50, H - 90, "Tres aplicaciones, una sola base")
    apps = [("Administración", "Gastos comunes por unidad, morosidad y convenios, finanzas, presupuesto, visitas por aprobar, reservas, votaciones, mantenciones, vehículos y TAG, branding con tu logo."),
            ("Conserjería (tablet)", "Central de eventos en vivo, registro de visitas y encomiendas, aprobación con clave del administrador, reservas, incidencias, escaneo de QR de invitados."),
            ("Vecinos (app instalable)", "Estado de cuenta y pagos, invitaciones QR de un solo uso ligadas al celular del visitante, encomiendas, reservas, votaciones, avisos, convenio de pago, vehículos.")]
    y = H - 130
    for i, (t, desc) in enumerate(apps):
        c.setFillColor(INK if i == 0 else TEAL if i == 1 else HexColor("#2563EB")); c.roundRect(50, y - 96, W - 100, 104, 12, fill=1, stroke=0)
        c.setFillColor(HexColor("#FFFFFF")); c.setFont("Helvetica-Bold", 15); c.drawString(66, y - 22, t)
        c.setFont("Helvetica", 10.5); yy = y - 42
        for ln in wrap(desc, W - 140)[:4]: c.drawString(66, yy, ln); yy -= 14
        y -= 122
    c.setFillColor(HexColor("#35505C")); c.setFont("Helvetica", 10.5)
    c.drawString(50, y - 10, "Operativo en menos de una semana: cargamos tus unidades y vecinos, capacitamos al conserje en 30 minutos y")
    c.drawString(50, y - 24, "entregamos las claves de la app a cada vecino. Sin obras, sin permanencia, servidor propio en Chile.")
    footer(3); c.showPage()

    # 4. Inversion
    c.setFillColor(TEAL); c.setFont("Helvetica-Bold", 11); c.drawString(50, H - 60, "INVERSIÓN")
    c.setFillColor(INK); c.setFont("Helvetica-Bold", 24); c.drawString(50, H - 90, f"{fmt(prop['precio_unidad'])} por unidad al mes")
    y = H - 130
    c.setFont("Helvetica-Bold", 10); c.setFillColor(MUT); c.drawString(50, y, "MÓDULO"); c.drawRightString(W - 50, y, "POR UNIDAD / MES"); y -= 8
    c.setStrokeColor(HexColor("#DDE4E6")); c.line(50, y, W - 50, y); y -= 18
    for m in items:
        c.setFillColor(INK); c.setFont("Helvetica-Bold", 11); c.drawString(50, y, m["nombre"]); c.drawRightString(W - 50, y, "incluido" if m.get("base") and prop.get("precio_unidad") and len(items) == 1 else fmt(m["precio"]))
        c.setFont("Helvetica", 9.5); c.setFillColor(HexColor("#35505C")); y -= 13
        for ln in wrap(m["detalle"], W - 220, size=9.5)[:2]: c.drawString(50, y, ln); y -= 12
        y -= 10; c.line(50, y + 4, W - 50, y + 4); y -= 14
    c.setFillColor(INK); c.roundRect(50, y - 70, W - 100, 74, 12, fill=1, stroke=0)
    c.setFillColor(HexColor("#FFFFFF")); c.setFont("Helvetica-Bold", 20); c.drawString(66, y - 28, f"{fmt(prop['total_mensual'])} mensuales")
    c.setFont("Helvetica", 10.5); c.setFillColor(HexColor("#B9C8CC"))
    extra = f" · {prop['descuento_pct']}% de descuento aplicado" if prop.get("descuento_pct") else ""
    extra += f" · {prop['meses_gratis']} mes(es) gratis" if prop.get("meses_gratis") else ""
    c.drawString(66, y - 48, f"{prop['unidades']} unidades × {fmt(prop['precio_unidad'])} · implementación $0 · sin permanencia{extra}")
    y -= 100
    c.setFillColor(HexColor("#35505C")); c.setFont("Helvetica", 10)
    for ln in ["Incluye: hosting en servidor propio, respaldos diarios, soporte por WhatsApp, actualizaciones y capacitación inicial.",
               "Hardware (lectores RFID, TAG UHF, cámara LPR, terminales faciales) se cotiza por separado según el edificio.",
               "Valores en pesos chilenos, IVA incluido. Facturamos mensualmente al condominio."]:
        c.drawString(50, y, ln); y -= 15
    footer(4); c.showPage()

    # 5. Demo
    c.setFillColor(TEAL); c.setFont("Helvetica-Bold", 11); c.drawString(50, H - 60, "PRUÉBALO HOY")
    c.setFillColor(INK); c.setFont("Helvetica-Bold", 24); c.drawString(50, H - 90, "Tu demo en vivo" if d else "Agenda una demostración")
    if d:
        cred = d.get("credenciales") or {}
        if isinstance(cred, str): cred = json.loads(cred)
        vence = d["vence"].strftime("%d/%m/%Y") if isinstance(d.get("vence"), datetime) else str(d.get("vence"))[:10]
        c.setFont("Helvetica", 11); c.setFillColor(HexColor("#35505C"))
        for i, ln in enumerate(wrap(f"Creamos una copia completa del sistema con el nombre de {e['nombre']} y datos de muestra: 20 unidades, vecinos, visitas, encomiendas, gastos comunes emitidos, reservas y un reporte de mantención firmado. Puedes modificar todo durante {demo.DEMO_DIAS} días (hasta el {vence}); después seguirás pudiendo verlo.", W - 100, size=11)):
            c.drawString(50, H - 118 - i * 15, ln)
        y = H - 200
        for k, lbl, ic in (("admin", "Administración", "1"), ("conserje", "Conserjería", "2"), ("residente", "App de vecinos", "3")):
            cr = cred.get(k, {})
            c.setFillColor(SOFT); c.roundRect(50, y - 72, W - 100, 80, 10, fill=1, stroke=0)
            c.setFillColor(TEAL); c.circle(72, y - 30, 12, fill=1, stroke=0); c.setFillColor(HexColor("#FFFFFF")); c.setFont("Helvetica-Bold", 12); c.drawCentredString(72, y - 34, ic)
            c.setFillColor(INK); c.setFont("Helvetica-Bold", 13); c.drawString(94, y - 20, lbl)
            c.setFont("Helvetica", 9); c.setFillColor(HexColor("#35505C")); c.drawString(94, y - 34, cr.get("url", "")[:60])
            c.setFont("Helvetica-Bold", 10); c.setFillColor(INK)
            c.drawString(94, y - 48, f"{'RUT' if k == 'residente' else 'Usuario'}: {(cr.get('rut') or cr.get('email', ''))[:48]}")
            c.drawString(94, y - 62, f"Clave: {cr.get('password', '')}")
            try:
                img = qrcode.make(cr.get("url", ""), box_size=4, border=1).convert("RGB")
                c.drawImage(ImageReader(img), W - 118, y - 66, 60, 60)
            except Exception:
                pass
            y -= 96
        c.setFont("Helvetica", 10); c.setFillColor(MUT)
        c.drawString(50, y - 6, "Las claves son personales y quedan ligadas a tu correo. Escanea el QR con tu celular para entrar directo.")
    else:
        c.setFont("Helvetica", 11); c.setFillColor(HexColor("#35505C"))
        c.drawString(50, H - 120, f"Escríbenos y coordinamos una demostración de 20 minutos con tu comité: {v.get('telefono') or v['email']}")
    try:
        img = qrcode.make(f"{VENTAS_URL}/p/{prop['token']}", box_size=4, border=1).convert("RGB")
        c.drawImage(ImageReader(img), 50, 60, 70, 70)
        c.setFont("Helvetica", 9); c.setFillColor(MUT); c.drawString(128, 100, "Versión web de esta propuesta"); c.drawString(128, 88, f"{VENTAS_URL}/p/{prop['token']}")
    except Exception:
        pass
    footer(5); c.showPage()
    c.save()
    return buf.getvalue()


# ─── Demos ───────────────────────────────────────────────────────────────────

@router.get("/demos")
def listar_demos(v: dict = Depends(get_vendedor), db: Session = Depends(get_db)):
    _ensure_schema(db)
    mine = "" if v["rol"] == "admin" else "AND (e.vendedor_id=:vid OR e.vendedor_id IS NULL)"
    rows = _rows(db, f"SELECT d.*, e.nombre AS edificio, e.administrador_nombre, e.unidades, e.etapa FROM ventas_demos d LEFT JOIN ventas_edificios e ON e.id=d.edificio_id WHERE 1=1 {mine} ORDER BY d.id DESC LIMIT 100", vid=v["id"])
    for d in rows:
        d["telemetria"] = _telemetria(db, d["tenant_id"])
        d["estado_actual"] = demo.estado_demo(db, d["tenant_id"]) if d["tenant_id"] else None
        d["temperatura"] = _temperatura(d["telemetria"], None)
    return rows


class ExtenderIn(BaseModel):
    dias: int = 5


@router.post("/demos/{did}/extender")
def extender(did: int, body: ExtenderIn, v: dict = Depends(get_vendedor), db: Session = Depends(get_db)):
    d = _row(db, "SELECT * FROM ventas_demos WHERE id=:id", id=did)
    if not d: raise HTTPException(404, "Demo no encontrado")
    _edificio(db, d["edificio_id"], v)
    nuevo = demo.extender_demo(db, d["tenant_id"], max(1, min(body.dias, 30)))
    db.execute(text("UPDATE ventas_demos SET vence=:v, estado='activo' WHERE id=:id"), {"v": nuevo, "id": did}); db.commit()
    return {"ok": True, "vence": nuevo}


@router.post("/demos/{did}/convertir")
def convertir(did: int, v: dict = Depends(get_vendedor), db: Session = Depends(get_db)):
    d = _row(db, "SELECT * FROM ventas_demos WHERE id=:id", id=did)
    if not d: raise HTTPException(404, "Demo no encontrado")
    _edificio(db, d["edificio_id"], v)
    demo.convertir_demo(db, d["tenant_id"])
    db.execute(text("UPDATE ventas_demos SET estado='convertido' WHERE id=:id"), {"id": did})
    db.execute(text("UPDATE ventas_edificios SET etapa='cliente', tenant_id=:t, updated_at=NOW() WHERE id=:e"), {"t": d["tenant_id"], "e": d["edificio_id"]}); db.commit()
    return {"ok": True, "tenant_id": d["tenant_id"], "siguiente": f"https://{d['dominio']}/dashboard/condominios/estructura para cargar las unidades reales"}


@router.post("/demos/{did}/eliminar")
def eliminar_demo(did: int, v: dict = Depends(get_vendedor), db: Session = Depends(get_db)):
    """Desactiva el tenant demo (no borra filas: queda para auditoria)."""
    d = _row(db, "SELECT * FROM ventas_demos WHERE id=:id", id=did)
    if not d: raise HTTPException(404, "Demo no encontrado")
    _edificio(db, d["edificio_id"], v)
    db.execute(text("UPDATE tenants SET estado='suspendido', updated_at=NOW() WHERE id=:t"), {"t": d["tenant_id"]})
    db.execute(text("UPDATE usuarios SET activo=false WHERE tenant_id=:t"), {"t": d["tenant_id"]})
    db.execute(text("UPDATE ventas_demos SET estado='eliminado' WHERE id=:id"), {"id": did}); db.commit()
    return {"ok": True}


# ─── Vendedores (solo admin) ────────────────────────────────────────────────

class VendedorIn(BaseModel):
    nombre: str
    email: str
    password: str
    telefono: Optional[str] = None
    zona: Optional[str] = None
    rol: str = "vendedor"


@router.get("/vendedores")
def listar_vendedores(v: dict = Depends(get_vendedor), db: Session = Depends(get_db)):
    return _rows(db, "SELECT id, nombre, email, telefono, zona, rol, activo, ultimo_login, (SELECT COUNT(*) FROM ventas_edificios e WHERE e.vendedor_id=vd.id) AS edificios FROM ventas_vendedores vd ORDER BY id")


@router.post("/vendedores", status_code=201)
def crear_vendedor(body: VendedorIn, v: dict = Depends(get_vendedor), db: Session = Depends(get_db)):
    if v["rol"] != "admin": raise HTTPException(403, "Solo administrador")
    if db.execute(text("SELECT 1 FROM ventas_vendedores WHERE lower(email)=lower(:e)"), {"e": body.email}).fetchone():
        raise HTTPException(400, "Ese correo ya existe")
    vid = db.execute(text("INSERT INTO ventas_vendedores (nombre, email, password_hash, telefono, zona, rol) VALUES (:n, :e, :p, :t, :z, :r) RETURNING id"),
                     {"n": body.nombre, "e": body.email.strip().lower(), "p": demo._hash(body.password), "t": body.telefono, "z": body.zona, "r": body.rol}).scalar()
    db.commit()
    return {"id": vid}


# ─── Publico: propuesta web + PDF + formulario de las landings ──────────────

@router.get("/p/{token}")
def propuesta_publica(token: str, request: Request, db: Session = Depends(get_db)):
    _ensure_schema(db)
    prop = _row(db, "SELECT * FROM ventas_propuestas WHERE token=:t", t=token)
    if not prop:
        # links antiguos de la app Express (/p/<token> de presentaciones) siguen funcionando
        if db.execute(text("SELECT 1 FROM ventas_presentaciones WHERE token=:t"), {"t": token}).fetchone():
            return {"redirect": f"/pres/{token}"}
        raise HTTPException(404, "Propuesta no encontrada")
    e = _row(db, "SELECT * FROM ventas_edificios WHERE id=:id", id=prop["edificio_id"])
    v = _row(db, "SELECT nombre, email, telefono FROM ventas_vendedores WHERE id=:id", id=prop["vendedor_id"]) or {}
    d = _row(db, "SELECT dominio, vence, estado, credenciales, tenant_id FROM ventas_demos WHERE id=:id", id=prop["demo_id"]) if prop["demo_id"] else None
    ua = (request.headers.get("user-agent") or "").lower()
    if "bot" not in ua and "whatsapp" not in ua and "facebookexternalhit" not in ua:
        db.execute(text("UPDATE ventas_propuestas SET aperturas=aperturas+1, abierto_en=COALESCE(abierto_en, NOW()) WHERE id=:id"), {"id": prop["id"]})
        db.execute(text("INSERT INTO ventas_eventos (tenant_id, edificio_id, propuesta_id, tipo, detalle) VALUES (:t, :e, :p, 'propuesta_abierta', :d)"),
                   {"t": d["tenant_id"] if d else None, "e": e["id"], "p": prop["id"], "d": ua[:180]})
        db.commit()
    mods = prop["modulos"] if isinstance(prop["modulos"], list) else json.loads(prop["modulos"] or "[]")
    dol = e.get("dolores") or []
    if isinstance(dol, str): dol = json.loads(dol)
    cred = None
    if d:
        cred = d["credenciales"] if isinstance(d["credenciales"], dict) else json.loads(d["credenciales"] or "{}")
        est = demo.estado_demo(db, d["tenant_id"])
        d = {"dominio": d["dominio"], "vence": d["vence"], "estado": d["estado"], "vencido": est["vencido"], "dias_restantes": est["dias_restantes"]}
    return {"edificio": {k: e[k] for k in ("nombre", "tipo", "comuna", "direccion", "administrador_nombre", "unidades")},
            "dolores": [{"key": k, **dict(zip(("titulo", "solucion"), DOLORES[k]))} for k in dol if k in DOLORES],
            "modulos": [m for m in MODULOS if m["key"] in set(mods) | {"base"}],
            "precio_unidad": prop["precio_unidad"], "unidades": prop["unidades"], "total_mensual": prop["total_mensual"], "descuento_pct": prop["descuento_pct"], "meses_gratis": prop["meses_gratis"],
            "mensaje": prop["mensaje"], "vendedor": v, "demo": d, "credenciales": cred, "pdf_url": f"/api/ventas-terreno/p/{token}/pdf", "creada": prop["created_at"], "marca": MARCA,
            "wa": "https://wa.me/" + "".join(ch for ch in (v.get("telefono") or "56998101891") if ch.isdigit())}


@router.get("/p/{token}/pdf")
def propuesta_pdf(token: str, db: Session = Depends(get_db)):
    prop = _row(db, "SELECT pdf_path, edificio_id FROM ventas_propuestas WHERE token=:t", t=token)
    if not prop or not prop["pdf_path"] or not Path(prop["pdf_path"]).exists():
        raise HTTPException(404, "PDF no disponible")
    e = _row(db, "SELECT nombre FROM ventas_edificios WHERE id=:id", id=prop["edificio_id"])
    return FileResponse(prop["pdf_path"], media_type="application/pdf", filename=f"Propuesta-{demo.slugify(e['nombre'])}.pdf")


class SolicitudDemoIn(BaseModel):
    edificio: str
    unidades: int
    nombre: str
    email: str
    telefono: Optional[str] = None
    comuna: Optional[str] = None
    tipo: str = "departamentos"
    origen: str = "web"


_SOLICITUDES: dict = {}


@router.post("/publico/solicitar-demo", status_code=201)
def solicitar_demo(body: SolicitudDemoIn, request: Request, db: Session = Depends(get_db)):
    """Formulario de conectaai.cl / condo.conectaai.cl: crea el lead, el demo y manda el correo solo."""
    _ensure_schema(db)
    ip = request.headers.get("x-forwarded-for", request.client.host if request.client else "").split(",")[0].strip()
    import time as _t
    hits = [t for t in _SOLICITUDES.get(ip, []) if _t.time() - t < 3600]
    if len(hits) >= 3:
        raise HTTPException(429, "Demasiadas solicitudes desde esta conexión. Escríbenos por WhatsApp.")
    _SOLICITUDES[ip] = hits + [_t.time()]
    email = body.email.strip().lower()
    if "@" not in email or not body.edificio.strip():
        raise HTTPException(400, "Datos incompletos")
    if db.execute(text("SELECT 1 FROM ventas_demos WHERE lower(email)=:e AND vence > NOW() - INTERVAL '30 days'"), {"e": email}).fetchone():
        raise HTTPException(400, "Ya existe un demo reciente para este correo. Revisa tu bandeja o escríbenos por WhatsApp.")
    admin = _row(db, "SELECT * FROM ventas_vendedores WHERE rol='admin' AND activo ORDER BY id LIMIT 1")
    if not admin:
        raise HTTPException(500, "Sin vendedor configurado")
    eid = db.execute(text("INSERT INTO ventas_edificios (nombre, tipo, comuna, unidades, administrador_nombre, administrador_email, administrador_telefono, etapa, vendedor_id, origen, notas, proxima_accion, proxima_fecha) "
                          "VALUES (:n, :t, :c, :u, :an, :ae, :at, 'propuesta', :vid, :o, 'Solicitó demo desde la web', 'Llamar: pidió demo por la web', CURRENT_DATE + 1) RETURNING id"),
                     {"n": body.edificio.strip(), "t": body.tipo, "c": body.comuna, "u": body.unidades, "an": body.nombre.strip(), "ae": email, "at": body.telefono, "vid": admin["id"], "o": body.origen}).scalar()
    db.commit()
    res = crear_propuesta(eid, PropuestaIn(modulos=[], unidades=body.unidades, con_demo=True, enviar_email=True, enviar_whatsapp=False,
                                            mensaje="Gracias por tu interés. Te dejamos la propuesta base y un demo funcionando con el nombre de tu edificio; cualquier módulo adicional lo ajustamos contigo."),
                          request, admin, db)
    return {"ok": True, "mensaje": "Te enviamos la propuesta y las claves del demo a tu correo.", "demo_url": (res.get("demo") or {}).get("dominio")}
