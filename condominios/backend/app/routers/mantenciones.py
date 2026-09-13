"""
Bitacora de mantencion por QR/NFC.
- Administracion registra ACTIVOS (ascensor, bomba, porton...) y cada uno recibe un QR unico.
- El tecnico externo escanea el QR (o NFC con la misma URL), llena el reporte, firma y lo envia.
- El reporte queda en el dashboard y se avisa por correo a administracion.
"""
import os, re, json, secrets, httpx
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel, Field
from app.core.database import get_db
from app.core.dependencies import get_current_user

router = APIRouter(prefix="/api/mantenciones", tags=["Mantenciones QR"])
MAIL_API_URL = os.getenv("MAIL_API_URL", "http://localhost:3004/api/send")
MAIL_API_KEY = os.getenv("MAIL_API_KEY", "")

TIPOS = ["ascensor", "bomba_agua", "porton", "caldera", "generador", "piscina", "citofonia", "camaras", "extintores", "otro"]
TIPO_LABEL = {"ascensor": "Ascensor", "bomba_agua": "Bomba de agua", "porton": "Portón / acceso", "caldera": "Caldera / calefacción",
              "generador": "Generador", "piscina": "Piscina", "citofonia": "Citofonía", "camaras": "Cámaras", "extintores": "Extintores", "otro": "Otro"}
_SCHEMA_OK = False


def _ensure(db: Session):
    global _SCHEMA_OK
    if _SCHEMA_OK:
        return
    try:
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS activos_mantencion (
                id SERIAL PRIMARY KEY,
                tenant_id INTEGER NOT NULL REFERENCES tenants(id),
                condominio_id INTEGER,
                nombre VARCHAR(150) NOT NULL,
                tipo VARCHAR(30) DEFAULT 'otro',
                ubicacion VARCHAR(150),
                marca_modelo VARCHAR(150),
                frecuencia_dias INTEGER,
                proveedor VARCHAR(150),
                qr_token VARCHAR(40) UNIQUE NOT NULL,
                activo BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS mantenciones_reportes (
                id SERIAL PRIMARY KEY,
                tenant_id INTEGER NOT NULL REFERENCES tenants(id),
                activo_id INTEGER NOT NULL REFERENCES activos_mantencion(id) ON DELETE CASCADE,
                tecnico_nombre VARCHAR(150) NOT NULL,
                tecnico_rut VARCHAR(20),
                tecnico_email VARCHAR(150),
                tecnico_telefono VARCHAR(30),
                empresa VARCHAR(150),
                tipo_trabajo VARCHAR(30) DEFAULT 'preventiva',
                descripcion TEXT NOT NULL,
                observaciones TEXT,
                repuestos TEXT,
                proximo_mantenimiento DATE,
                firma_data TEXT,
                estado VARCHAR(20) DEFAULT 'recibido',
                revisado_por VARCHAR(150),
                revisado_en TIMESTAMPTZ,
                ip VARCHAR(60),
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS ix_mant_rep_tenant ON mantenciones_reportes(tenant_id, created_at DESC);
        """))
        db.commit()
        _SCHEMA_OK = True
    except Exception:
        db.rollback()


def _norm_rut(rut: str) -> str:
    return re.sub(r"[^0-9kK-]", "", rut or "").upper()


def _base_url(request: Request, db: Session, tenant_id: int) -> str:
    host = (request.headers.get("x-forwarded-host") or request.headers.get("host") or "").split(":")[0]
    if not host or host in ("localhost", "127.0.0.1", "backend-condominios"):
        row = db.execute(text("SELECT dominio, subdominio FROM tenants WHERE id=:t"), {"t": tenant_id}).fetchone()
        host = (row[0] if row and row[0] else f"{row[1]}.conectaai.cl") if row else "condo.conectaai.cl"
    return f"https://{host}"


# ---------------- modelos ----------------

class ActivoIn(BaseModel):
    nombre: str = Field(..., min_length=2)
    tipo: str = "otro"
    ubicacion: Optional[str] = None
    marca_modelo: Optional[str] = None
    frecuencia_dias: Optional[int] = None
    proveedor: Optional[str] = None
    condominio_id: Optional[int] = None


class ActivoPatch(BaseModel):
    nombre: Optional[str] = None
    tipo: Optional[str] = None
    ubicacion: Optional[str] = None
    marca_modelo: Optional[str] = None
    frecuencia_dias: Optional[int] = None
    proveedor: Optional[str] = None
    activo: Optional[bool] = None


class ReportePublicoIn(BaseModel):
    tecnico_nombre: str = Field(..., min_length=3)
    tecnico_rut: str = Field(..., min_length=7)
    tecnico_email: Optional[str] = None
    tecnico_telefono: Optional[str] = None
    empresa: Optional[str] = None
    tipo_trabajo: str = "preventiva"
    descripcion: str = Field(..., min_length=10)
    observaciones: Optional[str] = None
    repuestos: Optional[str] = None
    proximo_mantenimiento: Optional[str] = None
    firma_data: str = Field(..., min_length=100)   # PNG base64 (data URL)
    acepta: bool = True


# ---------------- admin: activos ----------------

@router.get("/tipos")
def tipos():
    return [{"value": t, "label": TIPO_LABEL[t]} for t in TIPOS]


@router.get("/activos")
def listar_activos(request: Request, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    _ensure(db)
    tid = current_user["tenant_id"]
    rows = db.execute(text("""
        SELECT a.*,
               (SELECT COUNT(*) FROM mantenciones_reportes r WHERE r.activo_id=a.id) AS total_reportes,
               (SELECT MAX(created_at) FROM mantenciones_reportes r WHERE r.activo_id=a.id) AS ultimo_reporte,
               (SELECT COUNT(*) FROM mantenciones_reportes r WHERE r.activo_id=a.id AND r.estado='recibido') AS sin_revisar
        FROM activos_mantencion a WHERE a.tenant_id=:tid ORDER BY a.activo DESC, a.nombre
    """), {"tid": tid}).fetchall()
    base = _base_url(request, db, tid)
    out = []
    for r in rows:
        d = dict(r._mapping)
        d["created_at"] = str(d.get("created_at") or ""); d["ultimo_reporte"] = str(d["ultimo_reporte"]) if d.get("ultimo_reporte") else None
        d["url"] = f"{base}/m/{d['qr_token']}"
        d["tipo_label"] = TIPO_LABEL.get(d.get("tipo"), d.get("tipo"))
        out.append(d)
    return out


@router.post("/activos", status_code=201)
def crear_activo(body: ActivoIn, request: Request, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    _ensure(db)
    tid = current_user["tenant_id"]
    tipo = body.tipo if body.tipo in TIPOS else "otro"
    cid = body.condominio_id or db.execute(text("SELECT id FROM condominios WHERE tenant_id=:t ORDER BY id LIMIT 1"), {"t": tid}).scalar()
    token = secrets.token_urlsafe(12)
    aid = db.execute(text("""
        INSERT INTO activos_mantencion (tenant_id, condominio_id, nombre, tipo, ubicacion, marca_modelo, frecuencia_dias, proveedor, qr_token)
        VALUES (:tid, :cid, :n, :tipo, :u, :mm, :f, :p, :tok) RETURNING id
    """), {"tid": tid, "cid": cid, "n": body.nombre.strip(), "tipo": tipo, "u": body.ubicacion, "mm": body.marca_modelo,
           "f": body.frecuencia_dias, "p": body.proveedor, "tok": token}).scalar()
    db.commit()
    return {"id": aid, "qr_token": token, "url": f"{_base_url(request, db, tid)}/m/{token}"}


@router.patch("/activos/{aid}")
def editar_activo(aid: int, body: ActivoPatch, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    _ensure(db)
    tid = current_user["tenant_id"]
    sets, params = [], {"id": aid, "tid": tid}
    for k, v in body.model_dump(exclude_unset=True).items():
        if k == "tipo" and v not in TIPOS: continue
        sets.append(f"{k}=:{k}"); params[k] = v
    if not sets:
        return {"ok": True}
    res = db.execute(text(f"UPDATE activos_mantencion SET {', '.join(sets)} WHERE id=:id AND tenant_id=:tid"), params)
    db.commit()
    if res.rowcount == 0:
        raise HTTPException(404, "Activo no encontrado")
    return {"ok": True}


@router.delete("/activos/{aid}")
def borrar_activo(aid: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    _ensure(db)
    res = db.execute(text("UPDATE activos_mantencion SET activo=FALSE WHERE id=:id AND tenant_id=:tid"), {"id": aid, "tid": current_user["tenant_id"]})
    db.commit()
    if res.rowcount == 0:
        raise HTTPException(404, "Activo no encontrado")
    return {"ok": True}


# ---------------- admin: reportes ----------------

@router.get("/reportes")
def listar_reportes(activo_id: Optional[int] = None, estado: Optional[str] = None, limit: int = 100,
                    db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    _ensure(db)
    tid = current_user["tenant_id"]
    sql = ("SELECT r.id, r.activo_id, a.nombre AS activo_nombre, a.tipo AS activo_tipo, r.tecnico_nombre, r.tecnico_rut, r.tecnico_email, "
           "r.tecnico_telefono, r.empresa, r.tipo_trabajo, r.descripcion, r.observaciones, r.repuestos, r.proximo_mantenimiento::text, "
           "r.estado, r.revisado_por, r.revisado_en::text, r.created_at::text, (r.firma_data IS NOT NULL) AS tiene_firma "
           "FROM mantenciones_reportes r JOIN activos_mantencion a ON a.id=r.activo_id WHERE r.tenant_id=:tid")
    params: dict = {"tid": tid}
    if activo_id:
        sql += " AND r.activo_id=:aid"; params["aid"] = activo_id
    if estado:
        sql += " AND r.estado=:e"; params["e"] = estado
    sql += " ORDER BY r.created_at DESC LIMIT :lim"; params["lim"] = limit
    return [dict(x._mapping) for x in db.execute(text(sql), params).fetchall()]


@router.get("/reportes/{rid}")
def ver_reporte(rid: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    _ensure(db)
    row = db.execute(text("SELECT r.*, a.nombre AS activo_nombre, a.tipo AS activo_tipo, a.ubicacion FROM mantenciones_reportes r "
                          "JOIN activos_mantencion a ON a.id=r.activo_id WHERE r.id=:id AND r.tenant_id=:tid"),
                     {"id": rid, "tid": current_user["tenant_id"]}).fetchone()
    if not row:
        raise HTTPException(404, "Reporte no encontrado")
    d = dict(row._mapping)
    for k in ("created_at", "revisado_en", "proximo_mantenimiento"):
        d[k] = str(d[k]) if d.get(k) else None
    return d


@router.patch("/reportes/{rid}/revisar")
def revisar_reporte(rid: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    _ensure(db)
    res = db.execute(text("UPDATE mantenciones_reportes SET estado='revisado', revisado_por=:n, revisado_en=NOW() WHERE id=:id AND tenant_id=:tid"),
                     {"n": current_user.get("nombre_completo"), "id": rid, "tid": current_user["tenant_id"]})
    db.commit()
    if res.rowcount == 0:
        raise HTTPException(404, "Reporte no encontrado")
    return {"ok": True}


# ---------------- publico (tecnico) ----------------

def _activo_por_token(db: Session, token: str):
    row = db.execute(text("""
        SELECT a.id, a.tenant_id, a.nombre, a.tipo, a.ubicacion, a.marca_modelo, a.activo, a.proveedor,
               c.nombre AS condominio, c.direccion, t.nombre AS tenant_nombre, t.email_contacto
        FROM activos_mantencion a
        LEFT JOIN condominios c ON c.id=a.condominio_id
        JOIN tenants t ON t.id=a.tenant_id
        WHERE a.qr_token=:tok
    """), {"tok": token}).fetchone()
    if not row or not row._mapping["activo"]:
        raise HTTPException(404, "Este código QR no corresponde a ningún equipo activo")
    return dict(row._mapping)


@router.get("/publico/{token}")
def publico_info(token: str, db: Session = Depends(get_db)):
    _ensure(db)
    a = _activo_por_token(db, token)
    ultimos = db.execute(text("""
        SELECT created_at::text AS fecha, tecnico_nombre, empresa, tipo_trabajo, LEFT(descripcion, 140) AS resumen
        FROM mantenciones_reportes WHERE activo_id=:aid ORDER BY created_at DESC LIMIT 3
    """), {"aid": a["id"]}).fetchall()
    return {
        "nombre": a["nombre"], "tipo": a["tipo"], "tipo_label": TIPO_LABEL.get(a["tipo"], a["tipo"]),
        "ubicacion": a["ubicacion"], "marca_modelo": a["marca_modelo"], "proveedor": a["proveedor"],
        "condominio": a["condominio"] or a["tenant_nombre"], "direccion": a["direccion"],
        "ultimos": [dict(u._mapping) for u in ultimos],
    }


@router.post("/publico/{token}", status_code=201)
def publico_reportar(token: str, body: ReportePublicoIn, request: Request, db: Session = Depends(get_db)):
    _ensure(db)
    a = _activo_por_token(db, token)
    if not body.acepta:
        raise HTTPException(400, "Debes aceptar la declaración para enviar el reporte")
    if not body.firma_data.startswith("data:image/png;base64,") or len(body.firma_data) > 400_000:
        raise HTTPException(400, "Firma inválida")
    tipo = body.tipo_trabajo if body.tipo_trabajo in ("preventiva", "correctiva", "inspeccion", "emergencia") else "preventiva"
    ip = (request.headers.get("x-forwarded-for") or request.client.host or "").split(",")[0].strip()
    # anti-spam basico: max 5 reportes por token por hora
    n = db.execute(text("SELECT COUNT(*) FROM mantenciones_reportes WHERE activo_id=:aid AND created_at > NOW() - INTERVAL '1 hour'"), {"aid": a["id"]}).scalar()
    if n and n >= 5:
        raise HTTPException(429, "Demasiados reportes para este equipo en la última hora")
    prox = body.proximo_mantenimiento or None
    rid = db.execute(text("""
        INSERT INTO mantenciones_reportes (tenant_id, activo_id, tecnico_nombre, tecnico_rut, tecnico_email, tecnico_telefono, empresa,
                                           tipo_trabajo, descripcion, observaciones, repuestos, proximo_mantenimiento, firma_data, ip)
        VALUES (:tid, :aid, :n, :rut, :e, :tel, :emp, :tt, :d, :o, :rep, :prox, :firma, :ip) RETURNING id
    """), {"tid": a["tenant_id"], "aid": a["id"], "n": body.tecnico_nombre.strip(), "rut": _norm_rut(body.tecnico_rut),
           "e": (body.tecnico_email or "").strip().lower() or None, "tel": body.tecnico_telefono, "emp": body.empresa,
           "tt": tipo, "d": body.descripcion.strip(), "o": body.observaciones, "rep": body.repuestos, "prox": prox,
           "firma": body.firma_data, "ip": ip}).scalar()
    db.commit()

    # correo a administracion (admins del tenant + email de contacto), sin bloquear la respuesta
    try:
        destinos = {r[0] for r in db.execute(text("SELECT email FROM usuarios WHERE tenant_id=:t AND rol='admin' AND activo=true"), {"t": a["tenant_id"]}).fetchall()}
        if a.get("email_contacto"):
            destinos.add(a["email_contacto"])
        base = _base_url(request, db, a["tenant_id"])
        when = datetime.now().strftime("%d-%m-%Y %H:%M")
        html = (
            "<div style='font-family:Arial,sans-serif;max-width:600px;margin:0 auto'>"
            f"<div style='background:#0F766E;color:#fff;padding:20px 24px;border-radius:12px 12px 0 0'><h2 style='margin:0'>Reporte de mantención · {a['nombre']}</h2>"
            f"<p style='margin:6px 0 0;opacity:.85'>{a['condominio'] or a['tenant_nombre']} · {when}</p></div>"
            "<div style='background:#fff;border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 12px 12px'>"
            f"<p><b>Técnico:</b> {body.tecnico_nombre} · RUT {body.tecnico_rut}{(' · ' + body.empresa) if body.empresa else ''}</p>"
            f"<p><b>Contacto:</b> {body.tecnico_email or '-'} · {body.tecnico_telefono or '-'}</p>"
            f"<p><b>Tipo:</b> {tipo.capitalize()}</p>"
            f"<p><b>Trabajo realizado:</b><br>{body.descripcion}</p>"
            + (f"<p><b>Observaciones:</b><br>{body.observaciones}</p>" if body.observaciones else "")
            + (f"<p><b>Repuestos:</b> {body.repuestos}</p>" if body.repuestos else "")
            + (f"<p><b>Próxima mantención:</b> {prox}</p>" if prox else "")
            + f"<p style='margin-top:20px'><a href='{base}/dashboard/condominios/mantenciones?reporte={rid}' style='background:#0F766E;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none'>Ver reporte firmado</a></p>"
            "<p style='color:#9ca3af;font-size:12px'>Enviado desde el QR del equipo. La firma del técnico queda guardada en el sistema.</p></div></div>"
        )
        for to in destinos:
            httpx.post(MAIL_API_URL, headers={"Authorization": "Bearer " + MAIL_API_KEY, "Content-Type": "application/json"},
                       json={"to": to, "from": "corp@conectaai.cl", "reply_to": body.tecnico_email or "corp.conectaai@gmail.com",
                             "subject": f"🔧 Mantención realizada: {a['nombre']} ({a['condominio'] or a['tenant_nombre']})", "html": html}, timeout=6.0)
    except Exception:
        pass
    return {"ok": True, "folio": rid, "mensaje": "Reporte enviado a administración"}
