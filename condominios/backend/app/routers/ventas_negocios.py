"""
Negocios — los demas productos ConectaAI (ConectaTap, MenuSmart, Control, ConectaWork,
OmniFlow) con el mismo tratamiento que condominios: lead del negocio visitado, dolores,
cotizador por producto (mensual + puesta en marcha), propuesta PDF personalizada,
pagina publica /n/<token> con "Quiero partir" (aviso al vendedor) y accesos demo.
"""
import base64
import io
import json
import os
import secrets
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional
from urllib.parse import quote

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.routers.ventas_terreno import get_vendedor, _row, _rows, MAIL_API_URL, MAIL_API_KEY, EVOLUTION_API_URL, EVOLUTION_API_KEY, EVOLUTION_INSTANCE, VENTAS_URL, UPLOAD_DIR, LOGO_CAI, LOGO_CAI_URL, VENTAS_MAIL, VENTAS_FROM
from app.routers.ventas_presentaciones import CATALOG, CAT

router = APIRouter(prefix="/api/ventas-terreno/negocios", tags=["Ventas negocios"])

# Precios de referencia (CLP, IVA incl.). Override: VENTAS_PRECIOS_NEGOCIOS='{"menusmart":{"mensual":29990,...}}'
_PLANES_DEF = {
    "conectatap": {"mensual": 9990, "unidad": "por placa", "setup": 19990, "setup_desc": "placa NFC+QR impresa e instalada", "min": 1},
    "menusmart": {"mensual": 29990, "unidad": "por local", "setup": 49990, "setup_desc": "carga del menú con fotos y placas para mesas", "min": 1},
    "condominios": {"mensual": 800, "unidad": "por unidad", "setup": 0, "setup_desc": "carga de unidades y vecinos", "min": 40},
    "control": {"mensual": 19990, "unidad": "por empresa", "setup": 0, "setup_desc": "configuración de proyectos y usuarios", "min": 1},
    "working": {"mensual": 39990, "unidad": "por taller", "setup": 59990, "setup_desc": "carga de catálogo, usuarios y capacitación", "min": 1},
    "omniflow": {"mensual": 49990, "unidad": "por número de WhatsApp", "setup": 79990, "setup_desc": "conexión Meta, bot IA entrenado con tu negocio", "min": 1},
}
PLANES = {**_PLANES_DEF, **json.loads(os.getenv("VENTAS_PRECIOS_NEGOCIOS", "{}") or "{}")}
# Accesos demo por producto (links/credenciales que se entregan al prospecto). Override: VENTAS_DEMOS_NEGOCIOS (json)
_DEMOS_DEF = {
    "conectatap": {"url": "https://tap.conectaai.cl/t/menusmart", "nota": "Toca o escanea: así llega tu cliente a tu negocio."},
    "menusmart": {"url": "https://tap.conectaai.cl/t/menusmart", "nota": "Menú digital de muestra con pedidos en vivo."},
    "condominios": {"url": "https://condo.conectaai.cl", "nota": "Pide tu demo de 5 días con el nombre de tu edificio."},
    "control": {"url": "https://control.conectaai.cl", "nota": "Te creamos un acceso de prueba con tus proyectos."},
    "working": {"url": "https://working.conectaai.cl", "nota": "Demo guiada de 20 minutos con tu flujo real."},
    "omniflow": {"url": "https://osw.conectaai.cl", "nota": "Escríbele al bot de demostración por WhatsApp."},
}
DEMOS = {**_DEMOS_DEF, **json.loads(os.getenv("VENTAS_DEMOS_NEGOCIOS", "{}") or "{}")}
RUBROS = ["restaurante", "cafetería", "tienda", "clínica", "salón", "taller", "oficina", "inmobiliaria", "otro"]
DOLORES = {
    "sin_pedidos_digitales": ("Pedidos a mano y errores", "MenuSmart: el cliente pide desde la mesa con fotos; cocina recibe al instante; boleta digital."),
    "poca_visibilidad": ("Pocos clientes llegan a tus redes", "ConectaTap: placa NFC+QR en mesa/mostrador; cada toque lleva a tu perfil, menú o WhatsApp, con analítica."),
    "whatsapp_desbordado": ("WhatsApp desbordado", "OmniFlow: bot con IA responde 24/7, un solo lugar para WhatsApp e Instagram, CRM con pipeline."),
    "gastos_desordenados": ("Gastos por obra sin control", "Control: foto de la boleta → saldo por proyecto al instante, rendiciones trazables."),
    "cotizacion_lenta": ("Cotizar e instalar toma días", "ConectaWork: de la cotización a la instalación en un flujo, con GPS, fotos, checklist y firma."),
    "sin_datos": ("No sabes qué funciona", "Analítica en todos los productos: scans, pedidos, conversaciones y conversión."),
}
ETAPAS = ["visitado", "propuesta", "demo", "negociacion", "cliente", "perdido"]
_OK = False


def _ensure(db: Session):
    global _OK
    if _OK: return
    db.execute(text("""
    CREATE TABLE IF NOT EXISTS ventas_negocios (
        id SERIAL PRIMARY KEY, vendedor_id INTEGER, nombre VARCHAR(160) NOT NULL, rubro VARCHAR(40), direccion VARCHAR(255), comuna VARCHAR(80),
        lat DOUBLE PRECISION, lng DOUBLE PRECISION, contacto VARCHAR(120), telefono VARCHAR(30), email VARCHAR(160), productos JSONB DEFAULT '[]'::jsonb,
        dolores JSONB DEFAULT '[]'::jsonb, etapa VARCHAR(20) DEFAULT 'visitado', notas TEXT, origen VARCHAR(30) DEFAULT 'terreno', proxima_accion VARCHAR(160), proxima_fecha DATE,
        valor_mensual INTEGER, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS ventas_negocios_visitas (
        id SERIAL PRIMARY KEY, negocio_id INTEGER REFERENCES ventas_negocios(id) ON DELETE CASCADE, vendedor_id INTEGER, fecha TIMESTAMPTZ DEFAULT NOW(),
        resultado VARCHAR(30), nota TEXT, lat DOUBLE PRECISION, lng DOUBLE PRECISION);
    CREATE TABLE IF NOT EXISTS ventas_negocios_propuestas (
        id SERIAL PRIMARY KEY, negocio_id INTEGER REFERENCES ventas_negocios(id) ON DELETE CASCADE, vendedor_id INTEGER, token VARCHAR(40) UNIQUE NOT NULL,
        items JSONB, total_mensual INTEGER, total_setup INTEGER, descuento_pct INTEGER DEFAULT 0, meses_gratis INTEGER DEFAULT 0, mensaje TEXT, pdf_path VARCHAR(255),
        enviado_email BOOLEAN DEFAULT FALSE, enviado_wa BOOLEAN DEFAULT FALSE, enviado_en TIMESTAMPTZ, abierto_en TIMESTAMPTZ, aperturas INTEGER DEFAULT 0,
        aceptada_en TIMESTAMPTZ, aceptada_por VARCHAR(160), created_at TIMESTAMPTZ DEFAULT NOW());
    """))
    db.execute(text("ALTER TABLE ventas_negocios_propuestas ADD COLUMN IF NOT EXISTS firma_url VARCHAR(255)"))
    db.commit(); _OK = True


class Item(BaseModel):
    producto: str
    cantidad: int = 1
    precio_mensual: Optional[int] = None
    setup: Optional[int] = None


def cotizar(items: List[dict], descuento_pct: int = 0, meses_gratis: int = 0) -> dict:
    filas, mensual, setup = [], 0, 0
    for it in items:
        k = it["producto"]
        if k not in CAT: continue
        pl = PLANES.get(k, {"mensual": 0, "unidad": "", "setup": 0, "setup_desc": "", "min": 1})
        cant = max(int(it.get("cantidad") or 1), pl.get("min", 1))
        pm = int(it.get("precio_mensual") or pl["mensual"]); st = int(it["setup"] if it.get("setup") is not None else pl["setup"])
        sub = pm * cant
        filas.append({"producto": k, "nombre": CAT[k]["name"], "icon": CAT[k]["icon"], "cantidad": cant, "unidad": pl["unidad"], "precio_mensual": pm, "subtotal_mensual": sub, "setup": st, "setup_desc": pl["setup_desc"]})
        mensual += sub; setup += st
    mensual = int(round(mensual * (100 - descuento_pct) / 100))
    return {"items": filas, "total_mensual": mensual, "total_setup": setup, "descuento_pct": descuento_pct, "meses_gratis": meses_gratis, "anual": mensual * (12 - meses_gratis)}


@router.get("/catalogo")
def catalogo(v: dict = Depends(get_vendedor)):
    return {"productos": [{**c, "plan": PLANES.get(c["id"]), "demo": DEMOS.get(c["id"])} for c in CATALOG], "rubros": RUBROS, "dolores": DOLORES, "etapas": ETAPAS}


class NegocioIn(BaseModel):
    nombre: str
    rubro: Optional[str] = None
    direccion: Optional[str] = None
    comuna: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    contacto: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    productos: List[str] = []
    dolores: List[str] = []
    notas: Optional[str] = None
    resultado: Optional[str] = None
    nota_visita: Optional[str] = None
    proxima_accion: Optional[str] = None
    proxima_fecha: Optional[str] = None


@router.get("")
@router.get("/")
def listar(q: Optional[str] = None, etapa: Optional[str] = None, v: dict = Depends(get_vendedor), db: Session = Depends(get_db)):
    _ensure(db)
    w, p = ["1=1"], {}
    if v["rol"] != "admin": w.append("(n.vendedor_id=:vid OR n.vendedor_id IS NULL)"); p["vid"] = v["id"]
    if q: w.append("(n.nombre ILIKE :q OR n.comuna ILIKE :q OR n.contacto ILIKE :q OR n.rubro ILIKE :q)"); p["q"] = f"%{q}%"
    if etapa: w.append("n.etapa=:et"); p["et"] = etapa
    return _rows(db, f"""SELECT n.*, (SELECT COUNT(*) FROM ventas_negocios_visitas x WHERE x.negocio_id=n.id) AS visitas,
        (SELECT aperturas FROM ventas_negocios_propuestas pr WHERE pr.negocio_id=n.id ORDER BY id DESC LIMIT 1) AS aperturas,
        (SELECT aceptada_en FROM ventas_negocios_propuestas pr WHERE pr.negocio_id=n.id ORDER BY id DESC LIMIT 1) AS aceptada_en
        FROM ventas_negocios n WHERE {' AND '.join(w)} ORDER BY n.updated_at DESC LIMIT 300""", **p)


@router.post("", status_code=201)
@router.post("/", status_code=201)
def crear(body: NegocioIn, v: dict = Depends(get_vendedor), db: Session = Depends(get_db)):
    _ensure(db)
    etapa = "perdido" if body.resultado in ("rechazo", "tiene_sistema") else "visitado"
    nid = db.execute(text("""INSERT INTO ventas_negocios (vendedor_id, nombre, rubro, direccion, comuna, lat, lng, contacto, telefono, email, productos, dolores, etapa, notas, proxima_accion, proxima_fecha)
        VALUES (:v, :n, :r, :d, :c, :lat, :lng, :co, :t, :e, :p, :dol, :et, :no, :pa, :pf) RETURNING id"""),
        {"v": v["id"], "n": body.nombre.strip(), "r": body.rubro, "d": body.direccion, "c": body.comuna, "lat": body.lat, "lng": body.lng, "co": body.contacto, "t": body.telefono,
         "e": (body.email or "").strip().lower() or None, "p": json.dumps([x for x in body.productos if x in CAT]), "dol": json.dumps(body.dolores), "et": etapa, "no": body.notas, "pa": body.proxima_accion, "pf": body.proxima_fecha or None}).scalar()
    if body.resultado:
        db.execute(text("INSERT INTO ventas_negocios_visitas (negocio_id, vendedor_id, resultado, nota, lat, lng) VALUES (:n, :v, :r, :no, :lat, :lng)"), {"n": nid, "v": v["id"], "r": body.resultado, "no": body.nota_visita, "lat": body.lat, "lng": body.lng})
    db.commit()
    return detalle(nid, v, db)


class NegocioPatch(BaseModel):
    nombre: Optional[str] = None
    rubro: Optional[str] = None
    direccion: Optional[str] = None
    comuna: Optional[str] = None
    contacto: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    productos: Optional[List[str]] = None
    dolores: Optional[List[str]] = None
    etapa: Optional[str] = None
    notas: Optional[str] = None
    proxima_accion: Optional[str] = None
    proxima_fecha: Optional[str] = None


@router.patch("/{nid}")
def editar(nid: int, body: NegocioPatch, v: dict = Depends(get_vendedor), db: Session = Depends(get_db)):
    data = body.dict(exclude_unset=True)
    if "etapa" in data and data["etapa"] not in ETAPAS: raise HTTPException(400, "Etapa inválida")
    for k in ("productos", "dolores"):
        if k in data: data[k] = json.dumps(data[k] or [])
    if data.get("proxima_fecha") == "": data["proxima_fecha"] = None
    if "email" in data and data["email"]: data["email"] = data["email"].strip().lower()
    if data:
        db.execute(text("UPDATE ventas_negocios SET " + ", ".join(f"{k}=:{k}" for k in data) + ", updated_at=NOW() WHERE id=:id"), {**data, "id": nid}); db.commit()
    return detalle(nid, v, db)


@router.get("/{nid}")
def detalle(nid: int, v: dict = Depends(get_vendedor), db: Session = Depends(get_db)):
    _ensure(db)
    n = _row(db, "SELECT * FROM ventas_negocios WHERE id=:id", id=nid)
    if not n: raise HTTPException(404, "Negocio no encontrado")
    visitas = _rows(db, "SELECT * FROM ventas_negocios_visitas WHERE negocio_id=:n ORDER BY fecha DESC", n=nid)
    props = _rows(db, "SELECT id, token, items, total_mensual, total_setup, descuento_pct, meses_gratis, enviado_email, enviado_wa, enviado_en, abierto_en, aperturas, aceptada_en, aceptada_por, created_at FROM ventas_negocios_propuestas WHERE negocio_id=:n ORDER BY id DESC", n=nid)
    for p in props: p["url"] = f"{VENTAS_URL}/n/{p['token']}"; p["pdf_url"] = f"{VENTAS_URL}/api/ventas-terreno/negocios/p/{p['token']}/pdf"
    return {**n, "visitas": visitas, "propuestas": props, "catalogo_dolores": DOLORES}


class VisitaIn(BaseModel):
    resultado: str
    nota: Optional[str] = None
    proxima_accion: Optional[str] = None
    proxima_fecha: Optional[str] = None


@router.post("/{nid}/visitas", status_code=201)
def visita(nid: int, body: VisitaIn, v: dict = Depends(get_vendedor), db: Session = Depends(get_db)):
    db.execute(text("INSERT INTO ventas_negocios_visitas (negocio_id, vendedor_id, resultado, nota) VALUES (:n, :v, :r, :no)"), {"n": nid, "v": v["id"], "r": body.resultado, "no": body.nota})
    sets, p = ["updated_at=NOW()"], {"id": nid}
    if body.resultado in ("rechazo", "tiene_sistema"): sets.append("etapa='perdido'")
    if body.proxima_accion is not None: sets.append("proxima_accion=:pa"); p["pa"] = body.proxima_accion
    if body.proxima_fecha: sets.append("proxima_fecha=:pf"); p["pf"] = body.proxima_fecha
    db.execute(text(f"UPDATE ventas_negocios SET {', '.join(sets)} WHERE id=:id"), p); db.commit()
    return detalle(nid, v, db)


class CotizarIn(BaseModel):
    items: List[Item]
    descuento_pct: int = 0
    meses_gratis: int = 0


@router.post("/cotizar")
def cotizar_ep(body: CotizarIn, v: dict = Depends(get_vendedor)):
    return cotizar([i.dict() for i in body.items], body.descuento_pct, body.meses_gratis)


class PropIn(CotizarIn):
    mensaje: Optional[str] = None
    enviar_email: bool = True
    enviar_whatsapp: bool = False


@router.post("/{nid}/propuestas", status_code=201)
def crear_propuesta(nid: int, body: PropIn, v: dict = Depends(get_vendedor), db: Session = Depends(get_db)):
    n = _row(db, "SELECT * FROM ventas_negocios WHERE id=:id", id=nid)
    if not n: raise HTTPException(404, "Negocio no encontrado")
    calc = cotizar([i.dict() for i in body.items], body.descuento_pct, body.meses_gratis)
    if not calc["items"]: raise HTTPException(400, "Elige al menos un producto")
    if body.enviar_email and not n.get("email"): raise HTTPException(400, "Falta el correo del contacto")
    tok = secrets.token_urlsafe(12)
    pid = db.execute(text("INSERT INTO ventas_negocios_propuestas (negocio_id, vendedor_id, token, items, total_mensual, total_setup, descuento_pct, meses_gratis, mensaje) VALUES (:n, :v, :t, :i, :tm, :ts, :d, :mg, :m) RETURNING id"),
                     {"n": nid, "v": v["id"], "t": tok, "i": json.dumps(calc["items"]), "tm": calc["total_mensual"], "ts": calc["total_setup"], "d": body.descuento_pct, "mg": body.meses_gratis, "m": body.mensaje}).scalar()
    db.execute(text("UPDATE ventas_negocios SET etapa=CASE WHEN etapa IN ('negociacion','cliente') THEN etapa ELSE 'propuesta' END, valor_mensual=:vm, productos=:p, updated_at=NOW() WHERE id=:id"),
               {"vm": calc["total_mensual"], "p": json.dumps([i["producto"] for i in calc["items"]]), "id": nid}); db.commit()
    prop = _row(db, "SELECT * FROM ventas_negocios_propuestas WHERE id=:id", id=pid)
    pdf = None
    try:
        pdf = _pdf(prop, n, calc, v)
        d = UPLOAD_DIR / "ventas" / "negocios"; d.mkdir(parents=True, exist_ok=True)
        (d / f"{tok}.pdf").write_bytes(pdf)
        db.execute(text("UPDATE ventas_negocios_propuestas SET pdf_path=:p WHERE id=:id"), {"p": str(d / f"{tok}.pdf"), "id": pid}); db.commit()
    except Exception as ex:
        print("PDF negocios error:", ex)
    envio = _enviar(db, prop, n, calc, v, pdf, body.enviar_email, body.enviar_whatsapp)
    return {"propuesta": {**prop, "url": f"{VENTAS_URL}/n/{tok}"}, "calculo": calc, "envio": envio}


@router.post("/propuestas/{pid}/reenviar")
def reenviar(pid: int, canal: str = "email", v: dict = Depends(get_vendedor), db: Session = Depends(get_db)):
    prop = _row(db, "SELECT * FROM ventas_negocios_propuestas WHERE id=:id", id=pid)
    if not prop: raise HTTPException(404, "No encontrada")
    n = _row(db, "SELECT * FROM ventas_negocios WHERE id=:id", id=prop["negocio_id"])
    calc = {"items": prop["items"], "total_mensual": prop["total_mensual"], "total_setup": prop["total_setup"], "descuento_pct": prop["descuento_pct"], "meses_gratis": prop["meses_gratis"]}
    pdf = Path(prop["pdf_path"]).read_bytes() if prop.get("pdf_path") and Path(prop["pdf_path"]).exists() else None
    return _enviar(db, prop, n, calc, v, pdf, canal in ("email", "ambos"), canal in ("whatsapp", "ambos"))


def _clp(x): return "$" + f"{int(round(x or 0)):,}".replace(",", ".")


def _msg(prop, n, calc, v):
    return (f"Hola {n.get('contacto') or n['nombre']}! Soy {v['nombre']} de ConectaAI 👋\n\nGracias por recibirme en {n['nombre']}. Te dejo la propuesta:\n"
            + "\n".join(f"{i['icon']} {i['nombre']} · {_clp(i['subtotal_mensual'])}/mes" for i in calc["items"])
            + f"\n\nTotal {_clp(calc['total_mensual'])}/mes" + (f" + puesta en marcha {_clp(calc['total_setup'])}" if calc["total_setup"] else "")
            + f"\n\nVerla y partir con un clic: {VENTAS_URL}/n/{prop['token']}\n\nCualquier duda me escribes 🙌")


def _enviar(db, prop, n, calc, v, pdf, email: bool, wa: bool) -> dict:
    out = {"email": None, "whatsapp": None, "wa_link": None}
    url = f"{VENTAS_URL}/n/{prop['token']}"
    if email and n.get("email"):
        filas = "".join(f"<tr><td style='padding:10px;border-bottom:1px solid #eee'><span style='font-size:20px'>{i['icon']}</span> <b>{i['nombre']}</b><div style='font-size:12px;color:#7A8F98'>{i['cantidad']} {i['unidad']}{' · puesta en marcha ' + _clp(i['setup']) if i['setup'] else ''}</div></td><td style='padding:10px;border-bottom:1px solid #eee;text-align:right;font-weight:700'>{_clp(i['subtotal_mensual'])}/mes</td></tr>" for i in calc["items"])
        demos = "".join(f"<li><a href='{DEMOS[i['producto']]['url']}'>{i['nombre']}</a> — {DEMOS[i['producto']]['nota']}</li>" for i in calc["items"] if i["producto"] in DEMOS)
        html = (f"<div style='font-family:Inter,Arial,sans-serif;max-width:620px;margin:auto'><div style='background:#0B1F2A;color:#fff;padding:28px;border-radius:14px 14px 0 0'><img src='{LOGO_CAI_URL}' alt='ConectaAI' width='84' height='84' style='display:block;background:#fff;border-radius:16px;padding:6px;margin-bottom:14px'><p style='margin:0;font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:#7FD1C6'>Propuesta ConectaAI</p><h1 style='margin:6px 0 0;font-size:26px'>{n['nombre']}</h1><p style='margin:6px 0 0;color:#B9C8CC'>{n.get('rubro') or ''} {('· ' + n['comuna']) if n.get('comuna') else ''}</p></div>"
                f"<div style='border:1px solid #DDE4E6;border-top:none;padding:26px;border-radius:0 0 14px 14px'><p style='color:#35505C'>{prop.get('mensaje') or 'Gracias por recibirme. Te dejo la propuesta con lo que conversamos y accesos para que lo pruebes.'}</p>"
                f"<table style='width:100%;border-collapse:collapse;font-size:14px'>{filas}</table>"
                f"<p style='background:#DDF4F0;border-radius:12px;padding:14px 16px;color:#0F766E;font-size:15px'><b>{_clp(calc['total_mensual'])} al mes</b>{' + ' + _clp(calc['total_setup']) + ' de puesta en marcha (una vez)' if calc['total_setup'] else ''}{' · ' + str(calc['meses_gratis']) + ' mes(es) gratis' if calc.get('meses_gratis') else ''} · sin permanencia</p>"
                f"<p style='margin:22px 0'><a href='{url}' style='background:#0F766E;color:#fff;padding:14px 22px;border-radius:10px;text-decoration:none;font-weight:700'>Ver propuesta y partir</a></p>"
                + (f"<h3 style='margin:18px 0 6px;color:#0B1F2A'>Pruébalo hoy</h3><ul style='color:#35505C;font-size:14px'>{demos}</ul>" if demos else "")
                + f"<p style='font-size:14px;color:#35505C'>{v['nombre']} · ConectaAI<br>{v.get('telefono') or ''} · {v['email']}</p></div></div>")
        payload = {"to": n["email"], "from": VENTAS_FROM, "reply_to": VENTAS_MAIL, "subject": f"Propuesta ConectaAI para {n['nombre']}", "html": html}
        if pdf: payload["attachments"] = [{"filename": "Propuesta-ConectaAI.pdf", "content": base64.b64encode(pdf).decode(), "contentType": "application/pdf"}]
        try:
            r = httpx.post(MAIL_API_URL, headers={"Authorization": "Bearer " + MAIL_API_KEY, "Content-Type": "application/json"}, json=payload, timeout=20.0)
            out["email"] = "enviado" if r.status_code < 300 else f"error {r.status_code}"
            if r.status_code < 300: db.execute(text("UPDATE ventas_negocios_propuestas SET enviado_email=true, enviado_en=COALESCE(enviado_en, NOW()) WHERE id=:id"), {"id": prop["id"]}); db.commit()
        except Exception as ex:
            out["email"] = f"error: {ex}"
    msg = _msg(prop, n, calc, v)
    tel = "".join(ch for ch in (n.get("telefono") or "") if ch.isdigit()); tel = "56" + tel if len(tel) == 9 else tel
    out["wa_link"] = f"https://wa.me/{tel}?text={quote(msg)}" if tel else f"https://wa.me/?text={quote(msg)}"
    if wa and tel and EVOLUTION_API_URL and EVOLUTION_API_KEY:
        try:
            r = httpx.post(f"{EVOLUTION_API_URL}/message/sendText/{EVOLUTION_INSTANCE}", headers={"apikey": EVOLUTION_API_KEY, "Content-Type": "application/json"}, json={"number": tel, "text": msg}, timeout=15.0)
            out["whatsapp"] = "enviado" if r.status_code < 300 else f"error {r.status_code}"
            if r.status_code < 300: db.execute(text("UPDATE ventas_negocios_propuestas SET enviado_wa=true, enviado_en=COALESCE(enviado_en, NOW()) WHERE id=:id"), {"id": prop["id"]}); db.commit()
        except Exception as ex:
            out["whatsapp"] = f"error: {ex}"
    return out


def _pdf(prop, n, calc, v) -> bytes:
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas
    from reportlab.lib.colors import HexColor
    from reportlab.lib.utils import ImageReader
    from reportlab.pdfbase.pdfmetrics import stringWidth
    import qrcode
    W, H = A4; buf = io.BytesIO(); c = canvas.Canvas(buf, pagesize=A4)
    INK, TEAL, MUT, SOFT = HexColor("#0B1F2A"), HexColor("#0F766E"), HexColor("#7A8F98"), HexColor("#DDF4F0")

    def wrap(t, w, f="Helvetica", s=10.5):
        out, cur = [], ""
        for x in (t or "").split():
            nn = (cur + " " + x).strip()
            if stringWidth(nn, f, s) <= w: cur = nn
            else: out.append(cur); cur = x
        if cur: out.append(cur)
        return out

    def foot(k):
        if LOGO_CAI.exists():
            try: c.drawImage(ImageReader(str(LOGO_CAI)), W - 82, H - 62, 42, 42)
            except Exception: pass
        c.setFont("Helvetica", 8); c.setFillColor(MUT); c.drawString(40, 28, f"ConectaAI · Propuesta para {n['nombre']} · {datetime.now().strftime('%d/%m/%Y')} · válida 15 días"); c.drawRightString(W - 40, 28, str(k))

    dol = n.get("dolores") or []
    if isinstance(dol, str): dol = json.loads(dol)
    # Portada
    c.setFillColor(INK); c.rect(0, 0, W, H, fill=1, stroke=0); c.setFillColor(TEAL); c.rect(0, H - 14, W, 14, fill=1, stroke=0)
    if LOGO_CAI.exists():
        c.setFillColor(HexColor("#FFFFFF")); c.roundRect(W - 190, H - 200, 140, 140, 18, fill=1, stroke=0)
        try: c.drawImage(ImageReader(str(LOGO_CAI)), W - 182, H - 192, 124, 124)
        except Exception: pass
    c.setFillColor(HexColor("#7FD1C6")); c.setFont("Helvetica-Bold", 11); c.drawString(50, H - 120, "PROPUESTA COMERCIAL · CONECTAAI")
    c.setFillColor(HexColor("#FFFFFF")); c.setFont("Helvetica-Bold", 34); y = H - 172
    for ln in wrap(n["nombre"], W - 260, "Helvetica-Bold", 30): c.drawString(50, y, ln); y -= 36
    c.setFont("Helvetica", 14); c.setFillColor(HexColor("#B9C8CC")); c.drawString(50, y - 6, " · ".join(x for x in (n.get("rubro"), n.get("comuna"), n.get("direccion")) if x))
    y -= 60
    for i in calc["items"]:
        c.setFillColor(HexColor("#7FD1C6")); c.circle(56, y + 4, 2.5, fill=1, stroke=0); c.setFillColor(HexColor("#DDE4E6")); c.setFont("Helvetica", 13); c.drawString(68, y, f"{i['nombre']} — {CAT[i['producto']]['tagline'][:70]}"); y -= 22
    c.setFillColor(HexColor("#FFFFFF")); c.setFont("Helvetica-Bold", 22); c.drawString(50, 210, "ConectaAI"); c.setFont("Helvetica", 12); c.setFillColor(HexColor("#B9C8CC"))
    c.drawString(50, 188, "Herramientas de IA para negocios, en servidor propio y en español."); c.drawString(50, 150, f"Preparada por {v['nombre']} · {v.get('telefono') or ''} · {v['email']}"); c.drawString(50, 132, datetime.now().strftime("%d de %B de %Y"))
    c.showPage()
    # Dolores
    pg = 2
    if dol:
        c.setFillColor(TEAL); c.setFont("Helvetica-Bold", 11); c.drawString(50, H - 60, "LO QUE NOS CONTASTE"); c.setFillColor(INK); c.setFont("Helvetica-Bold", 24); c.drawString(50, H - 90, "Tus prioridades y cómo las resolvemos")
        y = H - 130
        for k in dol:
            if k not in DOLORES: continue
            t, d = DOLORES[k]; c.setFillColor(SOFT); c.roundRect(50, y - 62, W - 100, 70, 10, fill=1, stroke=0)
            c.setFillColor(INK); c.setFont("Helvetica-Bold", 13); c.drawString(64, y - 14, t); c.setFont("Helvetica", 10.5); c.setFillColor(HexColor("#35505C")); yy = y - 32
            for ln in wrap(d, W - 130)[:3]: c.drawString(64, yy, ln); yy -= 14
            y -= 84
        foot(pg); c.showPage(); pg += 1
    # Una pagina por producto
    for i in calc["items"]:
        d = CAT[i["producto"]]; col = HexColor(d["color"])
        c.setFillColor(col); c.rect(0, H - 150, W, 150, fill=1, stroke=0); c.setFillColor(HexColor("#FFFFFF")); c.setFont("Helvetica-Bold", 28); c.drawString(50, H - 80, d["name"]); c.setFont("Helvetica", 12); c.drawString(50, H - 104, d["web"])
        c.setFillColor(INK); c.setFont("Helvetica-Bold", 14); y = H - 190
        for ln in wrap(d["tagline"], W - 100, "Helvetica-Bold", 14): c.drawString(50, y, ln); y -= 19
        c.setFont("Helvetica", 11); c.setFillColor(MUT); c.drawString(50, y - 6, "Ideal para: " + d["idealPara"]); y -= 40
        for b in d["benefits"]:
            c.setFillColor(col); c.circle(56, y + 4, 3, fill=1, stroke=0); c.setFillColor(INK); c.setFont("Helvetica", 11.5)
            lns = wrap(b, W - 130, "Helvetica", 11.5)
            for j, ln in enumerate(lns): c.drawString(68, y - j * 15, ln)
            y -= 15 * max(1, len(lns)) + 8
        c.setFillColor(SOFT); c.roundRect(50, 110, W - 100, 70, 12, fill=1, stroke=0)
        c.setFillColor(INK); c.setFont("Helvetica-Bold", 16); c.drawString(66, 152, f"{_clp(i['precio_mensual'])} / mes {i['unidad']}" + (f"  ×{i['cantidad']} = {_clp(i['subtotal_mensual'])}" if i["cantidad"] > 1 else ""))
        c.setFont("Helvetica", 10); c.setFillColor(HexColor("#35505C")); c.drawString(66, 132, (f"Puesta en marcha {_clp(i['setup'])}: {i['setup_desc']}" if i["setup"] else "Sin costo de puesta en marcha") + " · sin permanencia")
        if DEMOS.get(i["producto"]):
            c.setFont("Helvetica", 9); c.setFillColor(MUT); c.drawString(66, 118, f"Pruébalo: {DEMOS[i['producto']]['url']} — {DEMOS[i['producto']]['nota'][:60]}")
        foot(pg); c.showPage(); pg += 1
    # Inversion + QR
    c.setFillColor(TEAL); c.setFont("Helvetica-Bold", 11); c.drawString(50, H - 60, "INVERSIÓN"); c.setFillColor(INK); c.setFont("Helvetica-Bold", 24); c.drawString(50, H - 90, f"{_clp(calc['total_mensual'])} al mes")
    y = H - 130; c.setStrokeColor(HexColor("#DDE4E6"))
    for i in calc["items"]:
        c.setFillColor(INK); c.setFont("Helvetica-Bold", 11); c.drawString(50, y, f"{i['nombre']} · {i['cantidad']} {i['unidad']}"); c.drawRightString(W - 50, y, f"{_clp(i['subtotal_mensual'])}/mes")
        if i["setup"]: c.setFont("Helvetica", 9.5); c.setFillColor(MUT); y -= 13; c.drawString(50, y, f"Puesta en marcha (una vez): {i['setup_desc']}"); c.drawRightString(W - 50, y, _clp(i["setup"]))
        y -= 18; c.line(50, y + 6, W - 50, y + 6); y -= 8
    c.setFillColor(INK); c.roundRect(50, y - 74, W - 100, 78, 12, fill=1, stroke=0); c.setFillColor(HexColor("#FFFFFF")); c.setFont("Helvetica-Bold", 20); c.drawString(66, y - 30, f"{_clp(calc['total_mensual'])} mensuales" + (f" + {_clp(calc['total_setup'])} inicial" if calc["total_setup"] else ""))
    c.setFont("Helvetica", 10.5); c.setFillColor(HexColor("#B9C8CC")); extra = (f" · {calc['descuento_pct']}% dcto" if calc.get("descuento_pct") else "") + (f" · {calc['meses_gratis']} mes(es) gratis" if calc.get("meses_gratis") else "")
    c.drawString(66, y - 52, f"IVA incluido · sin permanencia · soporte por WhatsApp · servidor propio en Chile{extra}")
    y -= 110
    try:
        img = qrcode.make(f"{VENTAS_URL}/n/{prop['token']}", box_size=5, border=1).convert("RGB")
        c.setFillColor(SOFT); c.roundRect(50, y - 120, W - 100, 124, 14, fill=1, stroke=0); c.drawImage(ImageReader(img), 66, y - 106, 96, 96)
        c.setFillColor(INK); c.setFont("Helvetica-Bold", 15); c.drawString(180, y - 34, "Parte hoy con un clic"); c.setFont("Helvetica", 10.5); c.setFillColor(HexColor("#35505C"))
        c.drawString(180, y - 54, "Escanea el código o abre el link, revisa la propuesta y aprieta “Quiero partir”."); c.drawString(180, y - 68, "Te contactamos el mismo día para la puesta en marcha.")
        c.setFont("Helvetica", 9); c.setFillColor(MUT); c.drawString(180, y - 92, f"{VENTAS_URL}/n/{prop['token']}")
    except Exception:
        pass
    foot(pg); c.showPage(); c.save(); return buf.getvalue()


# ─── Publico ─────────────────────────────────────────────────────────────────

@router.get("/p/{token}")
def publica(token: str, request: Request, db: Session = Depends(get_db)):
    _ensure(db)
    p = _row(db, "SELECT * FROM ventas_negocios_propuestas WHERE token=:t", t=token)
    if not p: raise HTTPException(404, "Propuesta no encontrada")
    n = _row(db, "SELECT nombre, rubro, comuna, direccion, contacto, telefono, email, dolores FROM ventas_negocios WHERE id=:id", id=p["negocio_id"])
    v = _row(db, "SELECT nombre, telefono, email FROM ventas_vendedores WHERE id=:id", id=p["vendedor_id"]) or {}
    ua = (request.headers.get("user-agent") or "").lower()
    if "bot" not in ua and "whatsapp" not in ua:
        db.execute(text("UPDATE ventas_negocios_propuestas SET aperturas=aperturas+1, abierto_en=COALESCE(abierto_en, NOW()) WHERE id=:id"), {"id": p["id"]}); db.commit()
    dol = n.get("dolores") or []
    return {"negocio": n, "items": p["items"], "productos": {i["producto"]: {**CAT[i["producto"]], "demo": DEMOS.get(i["producto"])} for i in p["items"] if i["producto"] in CAT},
            "dolores": [{"key": k, "titulo": DOLORES[k][0], "solucion": DOLORES[k][1]} for k in dol if k in DOLORES],
            "total_mensual": p["total_mensual"], "total_setup": p["total_setup"], "descuento_pct": p["descuento_pct"], "meses_gratis": p["meses_gratis"], "mensaje": p["mensaje"],
            "aceptada": bool(p["aceptada_en"]), "vendedor": v, "pdf_url": f"/api/ventas-terreno/negocios/p/{token}/pdf", "wa": "https://wa.me/" + "".join(ch for ch in (v.get("telefono") or "56998101891") if ch.isdigit())}


@router.get("/p/{token}/pdf")
def publica_pdf(token: str, db: Session = Depends(get_db)):
    p = _row(db, "SELECT pdf_path FROM ventas_negocios_propuestas WHERE token=:t", t=token)
    if not p or not p["pdf_path"] or not Path(p["pdf_path"]).exists(): raise HTTPException(404, "PDF no disponible")
    return FileResponse(p["pdf_path"], media_type="application/pdf", filename="Propuesta-ConectaAI.pdf")


class AceptarIn(BaseModel):
    firma_data: Optional[str] = None
    nombre: str
    telefono: Optional[str] = None
    comentario: Optional[str] = None


@router.post("/p/{token}/aceptar")
def aceptar(token: str, body: AceptarIn, db: Session = Depends(get_db)):
    p = _row(db, "SELECT * FROM ventas_negocios_propuestas WHERE token=:t", t=token)
    if not p: raise HTTPException(404, "Propuesta no encontrada")
    from app.routers.ventas_extras import guardar_firma
    firma = guardar_firma("negocio", token, body.firma_data or "")
    db.execute(text("ALTER TABLE ventas_negocios_propuestas ADD COLUMN IF NOT EXISTS firma_url VARCHAR(255)"))
    db.execute(text("UPDATE ventas_negocios_propuestas SET aceptada_en=COALESCE(aceptada_en, NOW()), aceptada_por=:q, firma_url=COALESCE(NULLIF(:f,''), firma_url) WHERE id=:id"), {"q": body.nombre[:160], "f": firma, "id": p["id"]})
    db.execute(text("UPDATE ventas_negocios SET etapa='negociacion', proxima_accion='Llamar: aceptó la propuesta, coordinar puesta en marcha', proxima_fecha=CURRENT_DATE, updated_at=NOW() WHERE id=:id"), {"id": p["negocio_id"]}); db.commit()
    n = _row(db, "SELECT * FROM ventas_negocios WHERE id=:id", id=p["negocio_id"])
    v = _row(db, "SELECT nombre, telefono, email FROM ventas_vendedores WHERE id=:id", id=p["vendedor_id"]) or {}
    aviso = f"🚀 ¡{n['nombre']} quiere partir!\n{', '.join(i['nombre'] for i in p['items'])} · {_clp(p['total_mensual'])}/mes\n{body.nombre} · {n.get('telefono') or body.telefono or ''}\n{body.comentario or ''}\n{('Firma: ' + firma) if firma else ''}\n{VENTAS_URL}/ventas/negocios/{n['id']}"
    tel = "".join(ch for ch in (v.get("telefono") or "56998101891") if ch.isdigit()); tel = "56" + tel if len(tel) == 9 else tel
    if EVOLUTION_API_URL and EVOLUTION_API_KEY:
        try: httpx.post(f"{EVOLUTION_API_URL}/message/sendText/{EVOLUTION_INSTANCE}", headers={"apikey": EVOLUTION_API_KEY, "Content-Type": "application/json"}, json={"number": tel, "text": aviso}, timeout=10.0)
        except Exception: pass
    if v.get("email"):
        try: httpx.post(MAIL_API_URL, headers={"Authorization": "Bearer " + MAIL_API_KEY, "Content-Type": "application/json"}, json={"to": VENTAS_MAIL, "from": VENTAS_FROM, "subject": f"🚀 {n['nombre']} quiere partir ({_clp(p['total_mensual'])}/mes)", "html": "<pre style='font-family:Inter,Arial;font-size:14px'>" + aviso + "</pre>"}, timeout=10.0)
        except Exception: pass
    return {"ok": True, "mensaje": f"¡Genial! {v.get('nombre') or 'ConectaAI'} te contactará hoy para la puesta en marcha."}
