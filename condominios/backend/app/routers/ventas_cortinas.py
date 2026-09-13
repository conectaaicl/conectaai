"""
TerraBlinds — linea de cortinas dentro de Ventas Terreno.

Lead (casa/depto/oficina/comunidad) con espacios medidos en terreno (ancho x alto),
producto por espacio, estimacion por m2 en tres niveles (Esencial / Confort / Premium),
propuesta PDF + pagina publica /tb/<token> donde el cliente puede ACEPTAR con un clic
(avisa al vendedor por WhatsApp y correo). Formulario publico para terrablinds.cl.
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
from app.routers.ventas_terreno import get_vendedor, _row, _rows, MAIL_API_URL, MAIL_API_KEY, EVOLUTION_API_URL, EVOLUTION_API_KEY, EVOLUTION_INSTANCE, VENTAS_URL, UPLOAD_DIR

router = APIRouter(prefix="/api/ventas-terreno/cortinas", tags=["TerraBlinds cortinas"])

TB_WA = os.getenv("TERRABLINDS_WA", "56998101891")
TB_MAIL = os.getenv("TERRABLINDS_MAIL", "terrablinds@gmail.com")
TB_WEB = "https://terrablinds.cl"

# Precios de referencia CLP por m2 instalado (IVA incl.). Ajustables: TERRABLINDS_PRECIOS='{"blackout":38000,...}'
_PRECIOS_DEF = {"blackout": 38000, "sunscreen": 42000, "duo": 55000, "venecianas": 45000, "persianas_ext": 120000, "toldo": 95000, "toldo_vertical": 70000, "metalica": 85000}
PRECIOS = {**_PRECIOS_DEF, **json.loads(os.getenv("TERRABLINDS_PRECIOS", "{}") or "{}")}
MOTOR_UNIDAD = int(os.getenv("TERRABLINDS_MOTOR", "95000"))
M2_MINIMO = 1.0
PRODUCTOS = [
    {"key": "blackout", "nombre": "Roller Blackout", "desc": "Oscurecimiento total. Dormitorios, salas de TV y oficinas con proyector.", "icon": "🌑"},
    {"key": "sunscreen", "nombre": "Roller Sunscreen", "desc": "Filtra el sol y el calor sin perder la vista al exterior. Living, comedor, oficinas.", "icon": "☀️"},
    {"key": "duo", "nombre": "Roller Duo (Zebra)", "desc": "Doble tela: regulas luz y privacidad en la misma cortina.", "icon": "🔲"},
    {"key": "venecianas", "nombre": "Persianas Venecianas", "desc": "Aluminio o madera; control fino de la luz.", "icon": "🪟"},
    {"key": "persianas_ext", "nombre": "Persianas Exteriores", "desc": "Aislación térmica y seguridad en fachada.", "icon": "🏠"},
    {"key": "toldo", "nombre": "Toldo Retráctil", "desc": "Sombra para terrazas y balcones, brazo articulado.", "icon": "⛱️"},
    {"key": "toldo_vertical", "nombre": "Toldo Vertical", "desc": "Lona vertical para terrazas y quinchos.", "icon": "📐"},
    {"key": "metalica", "nombre": "Cortina Metálica", "desc": "Enrollable para locales y bodegas, manual o motorizada.", "icon": "🔩"},
]
PROD = {p["key"]: p for p in PRODUCTOS}
# Niveles: mismo proyecto, tres formas de hacerlo (tecnica de anclaje de precio)
NIVELES = {
    "esencial": {"nombre": "Esencial", "desc": "Telas estándar, accionamiento manual con cadena. Garantía 2 años.", "factor": 1.0, "motor": False},
    "confort": {"nombre": "Confort", "desc": "Telas premium (más colores y texturas), cadena metálica, motorización en los espacios que marcaste. Garantía 3 años.", "factor": 1.15, "motor": True},
    "premium": {"nombre": "Premium", "desc": "Todo motorizado con control remoto y app (compatible con Alexa/Google), telas premium, cenefa decorativa. Garantía 5 años.", "factor": 1.25, "motor": "todo"},
}
ETAPAS = ["lead", "medido", "propuesta", "aceptada", "instalada", "perdido"]
_OK = False


def _ensure(db: Session):
    global _OK
    if _OK: return
    db.execute(text("""
    CREATE TABLE IF NOT EXISTS ventas_cortinas_leads (
        id SERIAL PRIMARY KEY, vendedor_id INTEGER, nombre VARCHAR(160) NOT NULL, tipo VARCHAR(20) DEFAULT 'casa', direccion VARCHAR(255), comuna VARCHAR(80),
        lat DOUBLE PRECISION, lng DOUBLE PRECISION, telefono VARCHAR(30), email VARCHAR(160), origen VARCHAR(30) DEFAULT 'terreno', etapa VARCHAR(20) DEFAULT 'lead',
        espacios JSONB DEFAULT '[]'::jsonb, notas TEXT, fotos JSONB DEFAULT '[]'::jsonb, proxima_accion VARCHAR(160), proxima_fecha DATE,
        created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS ventas_cortinas_propuestas (
        id SERIAL PRIMARY KEY, lead_id INTEGER REFERENCES ventas_cortinas_leads(id) ON DELETE CASCADE, vendedor_id INTEGER, token VARCHAR(40) UNIQUE NOT NULL,
        espacios JSONB, niveles JSONB, nivel_sugerido VARCHAR(20) DEFAULT 'confort', descuento_pct INTEGER DEFAULT 0, mensaje TEXT, pdf_path VARCHAR(255),
        enviado_email BOOLEAN DEFAULT FALSE, enviado_wa BOOLEAN DEFAULT FALSE, enviado_en TIMESTAMPTZ, abierto_en TIMESTAMPTZ, aperturas INTEGER DEFAULT 0,
        aceptada_en TIMESTAMPTZ, nivel_aceptado VARCHAR(20), aceptada_por VARCHAR(160), created_at TIMESTAMPTZ DEFAULT NOW());
    """))
    db.commit(); _OK = True


class Espacio(BaseModel):
    ambiente: str
    producto: str
    ancho_cm: float
    alto_cm: float
    cantidad: int = 1
    motorizado: bool = False
    color: Optional[str] = None
    nota: Optional[str] = None


def calcular(espacios: List[dict], descuento_pct: int = 0) -> dict:
    """Detalle por espacio y total por nivel."""
    filas, out = [], {}
    for e in espacios:
        prod = PROD.get(e["producto"], PROD["blackout"])
        m2 = max((e["ancho_cm"] / 100) * (e["alto_cm"] / 100), M2_MINIMO) * max(int(e.get("cantidad", 1)), 1)
        base = PRECIOS.get(e["producto"], 40000)
        filas.append({**e, "producto_nombre": prod["nombre"], "m2": round(m2, 2), "precio_m2": base, "subtotal": int(round(m2 * base))})
    for k, n in NIVELES.items():
        total = 0
        for f in filas:
            sub = f["subtotal"] * n["factor"]
            motor = n["motor"] == "todo" or (n["motor"] is True and f.get("motorizado"))
            if motor: sub += MOTOR_UNIDAD * max(int(f.get("cantidad", 1)), 1)
            total += sub
        total = int(round(total * (100 - descuento_pct) / 100))
        out[k] = {"nombre": n["nombre"], "desc": n["desc"], "total": total, "mensual_12": int(round(total / 12))}
    return {"filas": filas, "m2_total": round(sum(f["m2"] for f in filas), 2), "niveles": out, "descuento_pct": descuento_pct}


@router.get("/catalogo")
def catalogo(v: dict = Depends(get_vendedor)):
    return {"productos": PRODUCTOS, "precios": PRECIOS, "motor": MOTOR_UNIDAD, "niveles": NIVELES, "etapas": ETAPAS}


class LeadIn(BaseModel):
    nombre: str
    tipo: str = "casa"
    direccion: Optional[str] = None
    comuna: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    espacios: List[Espacio] = []
    notas: Optional[str] = None
    proxima_accion: Optional[str] = None
    proxima_fecha: Optional[str] = None


@router.get("/leads")
def listar(q: Optional[str] = None, etapa: Optional[str] = None, v: dict = Depends(get_vendedor), db: Session = Depends(get_db)):
    _ensure(db)
    w, p = ["1=1"], {}
    if q: w.append("(l.nombre ILIKE :q OR l.direccion ILIKE :q OR l.comuna ILIKE :q OR l.telefono ILIKE :q)"); p["q"] = f"%{q}%"
    if etapa: w.append("l.etapa=:et"); p["et"] = etapa
    rows = _rows(db, f"""SELECT l.*, (SELECT COUNT(*) FROM ventas_cortinas_propuestas x WHERE x.lead_id=l.id) AS propuestas,
        (SELECT aperturas FROM ventas_cortinas_propuestas x WHERE x.lead_id=l.id ORDER BY id DESC LIMIT 1) AS aperturas,
        (SELECT nivel_aceptado FROM ventas_cortinas_propuestas x WHERE x.lead_id=l.id AND aceptada_en IS NOT NULL ORDER BY id DESC LIMIT 1) AS nivel_aceptado
        FROM ventas_cortinas_leads l WHERE {' AND '.join(w)} ORDER BY l.updated_at DESC LIMIT 300""", **p)
    for r in rows:
        esp = r["espacios"] or []
        r["m2_total"] = round(sum(max(e["ancho_cm"] / 100 * e["alto_cm"] / 100, M2_MINIMO) * e.get("cantidad", 1) for e in esp), 1) if esp else 0
        r["estimado"] = calcular(esp)["niveles"]["confort"]["total"] if esp else 0
    return rows


@router.post("/leads", status_code=201)
def crear(body: LeadIn, v: dict = Depends(get_vendedor), db: Session = Depends(get_db)):
    _ensure(db)
    esp = [e.dict() for e in body.espacios]
    lid = db.execute(text("""INSERT INTO ventas_cortinas_leads (vendedor_id, nombre, tipo, direccion, comuna, lat, lng, telefono, email, etapa, espacios, notas, proxima_accion, proxima_fecha)
        VALUES (:v, :n, :t, :d, :c, :lat, :lng, :tel, :em, :et, :esp, :no, :pa, :pf) RETURNING id"""),
        {"v": v["id"], "n": body.nombre.strip(), "t": body.tipo, "d": body.direccion, "c": body.comuna, "lat": body.lat, "lng": body.lng, "tel": body.telefono,
         "em": (body.email or "").strip().lower() or None, "et": "medido" if esp else "lead", "esp": json.dumps(esp), "no": body.notas, "pa": body.proxima_accion, "pf": body.proxima_fecha or None}).scalar()
    db.commit()
    return detalle(lid, v, db)


class LeadPatch(BaseModel):
    nombre: Optional[str] = None
    tipo: Optional[str] = None
    direccion: Optional[str] = None
    comuna: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    etapa: Optional[str] = None
    espacios: Optional[List[Espacio]] = None
    notas: Optional[str] = None
    proxima_accion: Optional[str] = None
    proxima_fecha: Optional[str] = None


@router.patch("/leads/{lid}")
def editar(lid: int, body: LeadPatch, v: dict = Depends(get_vendedor), db: Session = Depends(get_db)):
    data = body.dict(exclude_unset=True)
    if "etapa" in data and data["etapa"] not in ETAPAS: raise HTTPException(400, "Etapa inválida")
    if "espacios" in data:
        data["espacios"] = json.dumps([e if isinstance(e, dict) else e.dict() for e in (body.espacios or [])])
    if data.get("proxima_fecha") == "": data["proxima_fecha"] = None
    if data:
        db.execute(text("UPDATE ventas_cortinas_leads SET " + ", ".join(f"{k}=:{k}" for k in data) + ", updated_at=NOW() WHERE id=:id"), {**data, "id": lid}); db.commit()
    return detalle(lid, v, db)


@router.get("/leads/{lid}")
def detalle(lid: int, v: dict = Depends(get_vendedor), db: Session = Depends(get_db)):
    _ensure(db)
    l = _row(db, "SELECT * FROM ventas_cortinas_leads WHERE id=:id", id=lid)
    if not l: raise HTTPException(404, "Lead no encontrado")
    props = _rows(db, "SELECT id, token, niveles, nivel_sugerido, descuento_pct, enviado_email, enviado_wa, enviado_en, abierto_en, aperturas, aceptada_en, nivel_aceptado, aceptada_por, created_at FROM ventas_cortinas_propuestas WHERE lead_id=:l ORDER BY id DESC", l=lid)
    for p in props: p["url"] = f"{VENTAS_URL}/tb/{p['token']}"; p["pdf_url"] = f"{VENTAS_URL}/api/ventas-terreno/cortinas/p/{p['token']}/pdf"
    return {**l, "calculo": calcular(l["espacios"] or []) if l["espacios"] else None, "propuestas": props}


@router.delete("/leads/{lid}", status_code=204)
def borrar(lid: int, v: dict = Depends(get_vendedor), db: Session = Depends(get_db)):
    if v["rol"] != "admin": raise HTTPException(403, "Solo admin")
    db.execute(text("DELETE FROM ventas_cortinas_leads WHERE id=:id"), {"id": lid}); db.commit()


class CalcIn(BaseModel):
    espacios: List[Espacio]
    descuento_pct: int = 0


@router.post("/calcular")
def calcular_ep(body: CalcIn, v: dict = Depends(get_vendedor)):
    return calcular([e.dict() for e in body.espacios], body.descuento_pct)


class PropIn(BaseModel):
    nivel_sugerido: str = "confort"
    descuento_pct: int = 0
    mensaje: Optional[str] = None
    enviar_email: bool = True
    enviar_whatsapp: bool = False


@router.post("/leads/{lid}/propuestas", status_code=201)
def crear_propuesta(lid: int, body: PropIn, v: dict = Depends(get_vendedor), db: Session = Depends(get_db)):
    l = _row(db, "SELECT * FROM ventas_cortinas_leads WHERE id=:id", id=lid)
    if not l: raise HTTPException(404, "Lead no encontrado")
    esp = l["espacios"] or []
    if not esp: raise HTTPException(400, "Mide al menos un espacio antes de armar la propuesta")
    calc = calcular(esp, body.descuento_pct)
    tok = secrets.token_urlsafe(12)
    pid = db.execute(text("INSERT INTO ventas_cortinas_propuestas (lead_id, vendedor_id, token, espacios, niveles, nivel_sugerido, descuento_pct, mensaje) VALUES (:l, :v, :t, :e, :n, :ns, :d, :m) RETURNING id"),
                     {"l": lid, "v": v["id"], "t": tok, "e": json.dumps(calc["filas"]), "n": json.dumps(calc["niveles"]), "ns": body.nivel_sugerido, "d": body.descuento_pct, "m": body.mensaje}).scalar()
    db.commit()
    prop = _row(db, "SELECT * FROM ventas_cortinas_propuestas WHERE id=:id", id=pid)
    pdf = None
    try:
        pdf = _pdf(prop, l, calc, v)
        d = UPLOAD_DIR / "ventas" / "cortinas"; d.mkdir(parents=True, exist_ok=True)
        (d / f"{tok}.pdf").write_bytes(pdf)
        db.execute(text("UPDATE ventas_cortinas_propuestas SET pdf_path=:p WHERE id=:id"), {"p": str(d / f"{tok}.pdf"), "id": pid}); db.commit()
    except Exception as ex:
        print("PDF cortinas error:", ex)
    db.execute(text("UPDATE ventas_cortinas_leads SET etapa=CASE WHEN etapa IN ('aceptada','instalada') THEN etapa ELSE 'propuesta' END, updated_at=NOW() WHERE id=:id"), {"id": lid}); db.commit()
    envio = _enviar(db, prop, l, calc, v, pdf, body.enviar_email, body.enviar_whatsapp)
    return {"propuesta": {**prop, "url": f"{VENTAS_URL}/tb/{tok}"}, "calculo": calc, "envio": envio}


@router.post("/propuestas/{pid}/reenviar")
def reenviar(pid: int, canal: str = "email", v: dict = Depends(get_vendedor), db: Session = Depends(get_db)):
    prop = _row(db, "SELECT * FROM ventas_cortinas_propuestas WHERE id=:id", id=pid)
    if not prop: raise HTTPException(404, "No encontrada")
    l = _row(db, "SELECT * FROM ventas_cortinas_leads WHERE id=:id", id=prop["lead_id"])
    calc = {"filas": prop["espacios"], "niveles": prop["niveles"], "descuento_pct": prop["descuento_pct"], "m2_total": round(sum(f["m2"] for f in prop["espacios"]), 2)}
    pdf = Path(prop["pdf_path"]).read_bytes() if prop.get("pdf_path") and Path(prop["pdf_path"]).exists() else None
    return _enviar(db, prop, l, calc, v, pdf, canal in ("email", "ambos"), canal in ("whatsapp", "ambos"))


def _clp(n): return "$" + f"{int(round(n)):,}".replace(",", ".")


def _msg_wa(prop, l, calc, v):
    n = calc["niveles"]; s = prop["nivel_sugerido"]
    return (f"Hola {l['nombre'].split()[0]}! Soy {v['nombre']} de TerraBlinds 🪟\n\nGracias por recibirme. Te dejo la propuesta para tus {len(calc['filas'])} espacio(s) ({calc['m2_total']} m²):\n"
            + "\n".join(f"• {n[k]['nombre']}: {_clp(n[k]['total'])}" + (" ← recomendado" if k == s else "") for k in ("esencial", "confort", "premium"))
            + f"\n\nMírala completa y acéptala con un clic aquí: {VENTAS_URL}/tb/{prop['token']}\n\nIncluye fabricación, instalación y garantía. Cualquier duda me escribes 🙌")


def _enviar(db, prop, l, calc, v, pdf, email: bool, wa: bool) -> dict:
    out = {"email": None, "whatsapp": None, "wa_link": None}
    url = f"{VENTAS_URL}/tb/{prop['token']}"
    if email and l.get("email"):
        n = calc["niveles"]; s = prop["nivel_sugerido"]
        REC = "<div style='font-size:11px;color:#0F766E;font-weight:700'>Recomendado</div>"
        cards = "".join(f"<td style='padding:14px;border:2px solid {'#0F766E' if k == s else '#eee'};border-radius:12px;text-align:center;width:33%'><div style='font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#7A8F98'>{n[k]['nombre']}</div><div style='font-size:22px;font-weight:800;color:#0B1F2A'>{_clp(n[k]['total'])}</div><div style='font-size:11px;color:#7A8F98'>o 12 × {_clp(n[k]['mensual_12'])}</div>{REC if k == s else ''}</td>" for k in ("esencial", "confort", "premium"))
        filas = "".join(f"<tr><td style='padding:8px;border-bottom:1px solid #eee'>{f['ambiente']}</td><td style='padding:8px;border-bottom:1px solid #eee'>{f['producto_nombre']}{' · motor' if f.get('motorizado') else ''}</td><td style='padding:8px;border-bottom:1px solid #eee;text-align:right'>{int(f['ancho_cm'])}×{int(f['alto_cm'])} cm{' ×' + str(f['cantidad']) if f.get('cantidad', 1) > 1 else ''}</td></tr>" for f in calc["filas"])
        html = (f"<div style='font-family:Inter,Arial,sans-serif;max-width:640px;margin:auto'><div style='background:#0B1F2A;color:#fff;padding:28px;border-radius:14px 14px 0 0'><p style='margin:0;font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:#C8B48A'>TerraBlinds · Propuesta</p><h1 style='margin:6px 0 0;font-size:26px'>Tus cortinas, {l['nombre'].split()[0]}</h1><p style='margin:6px 0 0;color:#B9C8CC'>{len(calc['filas'])} espacios · {calc['m2_total']} m² · {l.get('comuna') or ''}</p></div>"
                f"<div style='border:1px solid #DDE4E6;border-top:none;padding:26px;border-radius:0 0 14px 14px'><p style='color:#35505C'>{prop.get('mensaje') or 'Gracias por recibirnos. Medimos tus espacios y preparamos tres formas de hacer tu proyecto; elige la que más te acomode y la aceptas con un clic.'}</p>"
                f"<table style='width:100%;border-spacing:8px'><tr>{cards}</tr></table><table style='width:100%;border-collapse:collapse;font-size:13px;margin-top:8px'>{filas}</table>"
                f"<p style='margin:22px 0'><a href='{url}' style='background:#0F766E;color:#fff;padding:14px 22px;border-radius:10px;text-decoration:none;font-weight:700'>Ver propuesta y aceptar</a></p>"
                f"<p style='font-size:13px;color:#35505C'>Incluye fabricación propia, instalación y garantía. Precios con IVA, válidos 15 días.<br>{v['nombre']} · TerraBlinds · {v.get('telefono') or ''} · {TB_WEB}</p></div></div>")
        payload = {"to": l["email"], "from": "ventas@conectaai.cl", "reply_to": TB_MAIL, "subject": f"Propuesta TerraBlinds para {l['nombre']} — {len(calc['filas'])} espacios", "html": html}
        if pdf: payload["attachments"] = [{"filename": "Propuesta-TerraBlinds.pdf", "content": base64.b64encode(pdf).decode(), "contentType": "application/pdf"}]
        try:
            r = httpx.post(MAIL_API_URL, headers={"Authorization": "Bearer " + MAIL_API_KEY, "Content-Type": "application/json"}, json=payload, timeout=20.0)
            out["email"] = "enviado" if r.status_code < 300 else f"error {r.status_code}"
            if r.status_code < 300: db.execute(text("UPDATE ventas_cortinas_propuestas SET enviado_email=true, enviado_en=COALESCE(enviado_en, NOW()) WHERE id=:id"), {"id": prop["id"]}); db.commit()
        except Exception as ex:
            out["email"] = f"error: {ex}"
    msg = _msg_wa(prop, l, calc, v)
    tel = "".join(ch for ch in (l.get("telefono") or "") if ch.isdigit()); tel = "56" + tel if len(tel) == 9 else tel
    out["wa_link"] = f"https://wa.me/{tel}?text={quote(msg)}" if tel else f"https://wa.me/?text={quote(msg)}"
    if wa and tel and EVOLUTION_API_URL and EVOLUTION_API_KEY:
        try:
            r = httpx.post(f"{EVOLUTION_API_URL}/message/sendText/{EVOLUTION_INSTANCE}", headers={"apikey": EVOLUTION_API_KEY, "Content-Type": "application/json"}, json={"number": tel, "text": msg}, timeout=15.0)
            out["whatsapp"] = "enviado" if r.status_code < 300 else f"error {r.status_code}"
            if r.status_code < 300: db.execute(text("UPDATE ventas_cortinas_propuestas SET enviado_wa=true, enviado_en=COALESCE(enviado_en, NOW()) WHERE id=:id"), {"id": prop["id"]}); db.commit()
        except Exception as ex:
            out["whatsapp"] = f"error: {ex}"
    return out


def _pdf(prop, l, calc, v) -> bytes:
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas
    from reportlab.lib.colors import HexColor
    from reportlab.lib.utils import ImageReader
    from reportlab.pdfbase.pdfmetrics import stringWidth
    import qrcode
    W, H = A4; buf = io.BytesIO(); c = canvas.Canvas(buf, pagesize=A4)
    INK, ORO, MUT, ARENA, TEAL = HexColor("#0B1F2A"), HexColor("#C8B48A"), HexColor("#7A8F98"), HexColor("#F4EFE6"), HexColor("#0F766E")

    def wrap(t, w, f="Helvetica", s=10.5):
        out, cur = [], ""
        for x in (t or "").split():
            n = (cur + " " + x).strip()
            if stringWidth(n, f, s) <= w: cur = n
            else: out.append(cur); cur = x
        if cur: out.append(cur)
        return out

    def foot(n):
        c.setFont("Helvetica", 8); c.setFillColor(MUT); c.drawString(40, 28, f"TerraBlinds · Propuesta para {l['nombre']} · {datetime.now().strftime('%d/%m/%Y')} · válida 15 días"); c.drawRightString(W - 40, 28, str(n))

    # Portada
    c.setFillColor(INK); c.rect(0, 0, W, H, fill=1, stroke=0); c.setFillColor(ORO); c.rect(0, H - 12, W, 12, fill=1, stroke=0)
    c.setFillColor(ORO); c.setFont("Helvetica-Bold", 11); c.drawString(50, H - 120, "TERRABLINDS · PROPUESTA DE PROYECTO")
    c.setFillColor(HexColor("#FFFFFF")); c.setFont("Helvetica-Bold", 34); y = H - 172
    for ln in wrap(f"Las cortinas de {l['nombre']}", W - 100, "Helvetica-Bold", 34): c.drawString(50, y, ln); y -= 40
    c.setFont("Helvetica", 14); c.setFillColor(HexColor("#B9C8CC"))
    c.drawString(50, y - 6, f"{len(calc['filas'])} espacios · {calc['m2_total']} m² · {l.get('tipo', 'casa').capitalize()}" + (f" · {l['comuna']}" if l.get("comuna") else ""))
    if l.get("direccion"): c.drawString(50, y - 26, l["direccion"])
    y -= 70
    for f in calc["filas"][:8]:
        c.setFillColor(ORO); c.circle(56, y + 4, 2.5, fill=1, stroke=0); c.setFillColor(HexColor("#DDE4E6")); c.setFont("Helvetica", 12); c.drawString(68, y, f"{f['ambiente']} — {f['producto_nombre']}"); y -= 20
    c.setFillColor(HexColor("#FFFFFF")); c.setFont("Helvetica-Bold", 22); c.drawString(50, 210, "TerraBlinds")
    c.setFont("Helvetica", 12); c.setFillColor(HexColor("#B9C8CC")); c.drawString(50, 188, "Fabricación propia · Instalación incluida · Garantía real")
    c.drawString(50, 150, f"Preparada por {v['nombre']} · {v.get('telefono') or ''}"); c.drawString(50, 132, f"{TB_WEB} · {datetime.now().strftime('%d de %B de %Y')}")
    c.showPage()

    # Tu proyecto espacio por espacio
    c.setFillColor(TEAL); c.setFont("Helvetica-Bold", 11); c.drawString(50, H - 60, "TU PROYECTO")
    c.setFillColor(INK); c.setFont("Helvetica-Bold", 24); c.drawString(50, H - 90, "Espacio por espacio, tal como lo medimos")
    y = H - 130; c.setFont("Helvetica-Bold", 9); c.setFillColor(MUT)
    for x, t in ((50, "AMBIENTE"), (200, "PRODUCTO"), (370, "MEDIDA"), (460, "M²"), (W - 50, "REFERENCIA")): (c.drawRightString if x == W - 50 else c.drawString)(x, y, t)
    y -= 8; c.setStrokeColor(HexColor("#DDE4E6")); c.line(50, y, W - 50, y); y -= 18
    for f in calc["filas"]:
        c.setFillColor(INK); c.setFont("Helvetica-Bold", 10.5); c.drawString(50, y, f["ambiente"][:22])
        c.setFont("Helvetica", 10); c.drawString(200, y, f["producto_nombre"] + (" · motor" if f.get("motorizado") else ""))
        c.drawString(370, y, f"{int(f['ancho_cm'])}×{int(f['alto_cm'])}" + (f" ×{f['cantidad']}" if f.get("cantidad", 1) > 1 else "")); c.drawString(460, y, f"{f['m2']}")
        c.drawRightString(W - 50, y, _clp(f["subtotal"]))
        if f.get("color") or f.get("nota"):
            y -= 12; c.setFont("Helvetica", 8.5); c.setFillColor(MUT); c.drawString(200, y, " · ".join(x for x in (f.get("color"), f.get("nota")) if x)[:70])
        y -= 20; c.setStrokeColor(HexColor("#F1F1F1")); c.line(50, y + 8, W - 50, y + 8)
        if y < 140: break
    c.setFillColor(MUT); c.setFont("Helvetica", 9)
    for i, ln in enumerate(wrap("La referencia es el valor Esencial por espacio (tela estándar, manual). Los niveles de la página siguiente aplican sobre todo el proyecto.", W - 100, "Helvetica", 9)):
        c.drawString(50, y - 6 - i * 12, ln)
    prods = {f["producto"] for f in calc["filas"]}
    yy = y - 50
    for k in prods:
        p = PROD.get(k)
        if not p or yy < 80: continue
        c.setFillColor(ARENA); c.roundRect(50, yy - 36, W - 100, 42, 8, fill=1, stroke=0)
        c.setFillColor(INK); c.setFont("Helvetica-Bold", 11); c.drawString(62, yy - 12, p["nombre"]); c.setFont("Helvetica", 9.5); c.setFillColor(HexColor("#35505C")); c.drawString(62, yy - 27, p["desc"][:95]); yy -= 52
    foot(2); c.showPage()

    # Tres formas de hacerlo
    c.setFillColor(TEAL); c.setFont("Helvetica-Bold", 11); c.drawString(50, H - 60, "INVERSIÓN")
    c.setFillColor(INK); c.setFont("Helvetica-Bold", 24); c.drawString(50, H - 90, "Tres formas de hacer tu proyecto")
    n = calc["niveles"]; s = prop["nivel_sugerido"]; colw = (W - 100 - 20) / 3; x = 50
    for k in ("esencial", "confort", "premium"):
        rec = k == s
        c.setFillColor(INK if rec else HexColor("#FFFFFF")); c.setStrokeColor(INK if rec else HexColor("#DDE4E6")); c.roundRect(x, H - 330, colw, 220, 14, fill=1, stroke=1)
        c.setFillColor(ORO if rec else MUT); c.setFont("Helvetica-Bold", 10); c.drawString(x + 14, H - 134, n[k]["nombre"].upper() + ("  · RECOMENDADO" if rec else ""))
        c.setFillColor(HexColor("#FFFFFF") if rec else INK); c.setFont("Helvetica-Bold", 20); c.drawString(x + 14, H - 162, _clp(n[k]["total"]))
        c.setFont("Helvetica", 9); c.setFillColor(HexColor("#B9C8CC") if rec else MUT); c.drawString(x + 14, H - 176, f"o 12 cuotas de {_clp(n[k]['mensual_12'])}")
        c.setFont("Helvetica", 9.5); c.setFillColor(HexColor("#DDE4E6") if rec else HexColor("#35505C")); yy = H - 198
        for ln in wrap(n[k]["desc"], colw - 28, "Helvetica", 9.5)[:7]: c.drawString(x + 14, yy, ln); yy -= 13
        x += colw + 10
    y = H - 360; c.setFillColor(INK); c.setFont("Helvetica-Bold", 13); c.drawString(50, y, "Todos los niveles incluyen"); y -= 22
    for t in ["Fabricación propia a medida (sin intermediarios): entrega en 7 a 12 días hábiles", "Instalación por nuestro equipo, con limpieza del lugar y prueba de cada cortina", "Garantía por escrito en mecanismos y telas; servicio técnico post-venta", "Asesoría de color y tela en tu casa con muestrario físico", "Precios con IVA. Forma de pago: 50% al confirmar, 50% contra instalación. Tarjetas y transferencia"]:
        c.setFillColor(TEAL); c.circle(56, y + 4, 3, fill=1, stroke=0); c.setFillColor(HexColor("#35505C")); c.setFont("Helvetica", 10.5); c.drawString(68, y, t); y -= 17
    if prop.get("descuento_pct"): c.setFillColor(TEAL); c.setFont("Helvetica-Bold", 10.5); c.drawString(50, y - 6, f"Incluye {prop['descuento_pct']}% de descuento por confirmar dentro de 15 días.")
    foot(3); c.showPage()

    # Como seguimos + QR aceptar
    c.setFillColor(TEAL); c.setFont("Helvetica-Bold", 11); c.drawString(50, H - 60, "CÓMO SEGUIMOS")
    c.setFillColor(INK); c.setFont("Helvetica-Bold", 24); c.drawString(50, H - 90, "De la propuesta a tus cortinas instaladas")
    pasos = [("1", "Aceptas la propuesta", "Escanea el QR o abre el link y elige tu nivel. Recibirás la confirmación por correo y WhatsApp."),
             ("2", "Confirmamos telas y colores", "Vamos con el muestrario o te lo enviamos; ajustamos medidas finales si hace falta."),
             ("3", "Fabricamos", "Cada cortina se fabrica a la medida exacta de tu ventana en nuestro taller."),
             ("4", "Instalamos", "Coordinamos día y hora; instalación limpia, prueba de cada cortina y garantía por escrito.")]
    y = H - 130
    for num, t, d in pasos:
        c.setFillColor(INK); c.circle(64, y - 8, 14, fill=1, stroke=0); c.setFillColor(ORO); c.setFont("Helvetica-Bold", 13); c.drawCentredString(64, y - 12, num)
        c.setFillColor(INK); c.setFont("Helvetica-Bold", 13); c.drawString(90, y - 4, t); c.setFont("Helvetica", 10.5); c.setFillColor(HexColor("#35505C"))
        for i, ln in enumerate(wrap(d, W - 150)): c.drawString(90, y - 20 - i * 14, ln)
        y -= 70
    try:
        img = qrcode.make(f"{VENTAS_URL}/tb/{prop['token']}", box_size=5, border=1).convert("RGB")
        c.setFillColor(ARENA); c.roundRect(50, 90, W - 100, 130, 14, fill=1, stroke=0)
        c.drawImage(ImageReader(img), 66, 104, 102, 102)
        c.setFillColor(INK); c.setFont("Helvetica-Bold", 15); c.drawString(186, 178, "Acepta tu propuesta con un clic")
        c.setFont("Helvetica", 10.5); c.setFillColor(HexColor("#35505C")); c.drawString(186, 158, "Escanea el código o abre el link. Eliges el nivel, confirmas y")
        c.drawString(186, 144, "nosotros te llamamos para coordinar telas e instalación."); c.setFont("Helvetica", 9); c.setFillColor(MUT); c.drawString(186, 118, f"{VENTAS_URL}/tb/{prop['token']}")
    except Exception:
        pass
    foot(4); c.showPage(); c.save(); return buf.getvalue()


# ─── Publico ─────────────────────────────────────────────────────────────────

@router.get("/p/{token}")
def publica(token: str, request: Request, db: Session = Depends(get_db)):
    _ensure(db)
    p = _row(db, "SELECT * FROM ventas_cortinas_propuestas WHERE token=:t", t=token)
    if not p: raise HTTPException(404, "Propuesta no encontrada")
    l = _row(db, "SELECT nombre, tipo, comuna, direccion, telefono, email FROM ventas_cortinas_leads WHERE id=:id", id=p["lead_id"])
    v = _row(db, "SELECT nombre, telefono, email FROM ventas_vendedores WHERE id=:id", id=p["vendedor_id"]) or {}
    ua = (request.headers.get("user-agent") or "").lower()
    if "bot" not in ua and "whatsapp" not in ua:
        db.execute(text("UPDATE ventas_cortinas_propuestas SET aperturas=aperturas+1, abierto_en=COALESCE(abierto_en, NOW()) WHERE id=:id"), {"id": p["id"]}); db.commit()
    return {"cliente": l, "espacios": p["espacios"], "niveles": p["niveles"], "nivel_sugerido": p["nivel_sugerido"], "descuento_pct": p["descuento_pct"], "mensaje": p["mensaje"],
            "productos": {k: PROD[k] for k in {f["producto"] for f in p["espacios"]} if k in PROD}, "m2_total": round(sum(f["m2"] for f in p["espacios"]), 2),
            "aceptada": bool(p["aceptada_en"]), "nivel_aceptado": p["nivel_aceptado"], "vendedor": v, "pdf_url": f"/api/ventas-terreno/cortinas/p/{token}/pdf",
            "wa": f"https://wa.me/{TB_WA}", "creada": p["created_at"], "web": TB_WEB}


@router.get("/p/{token}/pdf")
def publica_pdf(token: str, db: Session = Depends(get_db)):
    p = _row(db, "SELECT pdf_path FROM ventas_cortinas_propuestas WHERE token=:t", t=token)
    if not p or not p["pdf_path"] or not Path(p["pdf_path"]).exists(): raise HTTPException(404, "PDF no disponible")
    return FileResponse(p["pdf_path"], media_type="application/pdf", filename="Propuesta-TerraBlinds.pdf")


class AceptarIn(BaseModel):
    nivel: str
    nombre: str
    telefono: Optional[str] = None
    comentario: Optional[str] = None


@router.post("/p/{token}/aceptar")
def aceptar(token: str, body: AceptarIn, db: Session = Depends(get_db)):
    p = _row(db, "SELECT * FROM ventas_cortinas_propuestas WHERE token=:t", t=token)
    if not p: raise HTTPException(404, "Propuesta no encontrada")
    if body.nivel not in NIVELES: raise HTTPException(400, "Nivel inválido")
    db.execute(text("UPDATE ventas_cortinas_propuestas SET aceptada_en=COALESCE(aceptada_en, NOW()), nivel_aceptado=:n, aceptada_por=:q WHERE id=:id"), {"n": body.nivel, "q": body.nombre[:160], "id": p["id"]})
    db.execute(text("UPDATE ventas_cortinas_leads SET etapa='aceptada', proxima_accion='Coordinar telas e instalación', proxima_fecha=CURRENT_DATE, updated_at=NOW() WHERE id=:id"), {"id": p["lead_id"]}); db.commit()
    l = _row(db, "SELECT * FROM ventas_cortinas_leads WHERE id=:id", id=p["lead_id"])
    v = _row(db, "SELECT nombre, telefono, email FROM ventas_vendedores WHERE id=:id", id=p["vendedor_id"]) or {}
    total = p["niveles"][body.nivel]["total"]
    aviso = f"✅ ¡{l['nombre']} aceptó la propuesta TerraBlinds!\nNivel {NIVELES[body.nivel]['nombre']} · {_clp(total)}\n{l.get('telefono') or body.telefono or ''} · {l.get('comuna') or ''}\n{body.comentario or ''}\n{VENTAS_URL}/ventas/cortinas/{l['id']}"
    tel = "".join(ch for ch in (v.get("telefono") or TB_WA) if ch.isdigit()); tel = "56" + tel if len(tel) == 9 else tel
    if EVOLUTION_API_URL and EVOLUTION_API_KEY:
        try: httpx.post(f"{EVOLUTION_API_URL}/message/sendText/{EVOLUTION_INSTANCE}", headers={"apikey": EVOLUTION_API_KEY, "Content-Type": "application/json"}, json={"number": tel, "text": aviso}, timeout=10.0)
        except Exception: pass
    for to in {v.get("email"), TB_MAIL} - {None}:
        try: httpx.post(MAIL_API_URL, headers={"Authorization": "Bearer " + MAIL_API_KEY, "Content-Type": "application/json"}, json={"to": to, "from": "ventas@conectaai.cl", "subject": f"✅ {l['nombre']} aceptó la propuesta ({NIVELES[body.nivel]['nombre']} · {_clp(total)})", "html": "<pre style='font-family:Inter,Arial;font-size:14px'>" + aviso + "</pre>"}, timeout=10.0)
        except Exception: pass
    if l.get("email"):
        try: httpx.post(MAIL_API_URL, headers={"Authorization": "Bearer " + MAIL_API_KEY, "Content-Type": "application/json"}, json={"to": l["email"], "from": "ventas@conectaai.cl", "reply_to": TB_MAIL, "subject": "Recibimos tu aceptación — TerraBlinds", "html": f"<div style='font-family:Inter,Arial;max-width:560px;margin:auto'><h2>¡Gracias, {l['nombre'].split()[0]}!</h2><p>Registramos tu aceptación del nivel <b>{NIVELES[body.nivel]['nombre']}</b> por <b>{_clp(total)}</b>. {v.get('nombre') or 'Nuestro equipo'} te contactará hoy para coordinar telas, colores e instalación.</p><p style='color:#7A8F98;font-size:12px'>TerraBlinds · {TB_WEB}</p></div>"}, timeout=10.0)
        except Exception: pass
    return {"ok": True, "mensaje": f"¡Listo! {v.get('nombre') or 'TerraBlinds'} te contactará hoy para coordinar telas e instalación."}


class PublicoIn(BaseModel):
    nombre: str
    telefono: str
    email: Optional[str] = None
    comuna: Optional[str] = None
    tipo: str = "casa"
    producto: Optional[str] = None
    ventanas: Optional[str] = None
    comentario: Optional[str] = None
    origen: str = "terrablinds.cl"


_HITS: dict = {}


@router.post("/publico/lead", status_code=201)
def lead_publico(body: PublicoIn, request: Request, db: Session = Depends(get_db)):
    """Formulario "Cotiza en 60 segundos" de terrablinds.cl -> lead en Ventas Terreno + aviso al vendedor."""
    _ensure(db)
    import time as _t
    ip = request.headers.get("x-forwarded-for", request.client.host if request.client else "").split(",")[0].strip()
    h = [t for t in _HITS.get(ip, []) if _t.time() - t < 3600]
    if len(h) >= 5: raise HTTPException(429, "Demasiadas solicitudes. Escríbenos por WhatsApp.")
    _HITS[ip] = h + [_t.time()]
    admin = _row(db, "SELECT id, telefono FROM ventas_vendedores WHERE rol='admin' AND activo ORDER BY id LIMIT 1")
    nota = " · ".join(x for x in (body.producto, body.ventanas, body.comentario) if x)
    lid = db.execute(text("INSERT INTO ventas_cortinas_leads (vendedor_id, nombre, tipo, comuna, telefono, email, origen, etapa, notas, proxima_accion, proxima_fecha) VALUES (:v, :n, :t, :c, :tel, :em, :o, 'lead', :no, 'Llamar y agendar medición', CURRENT_DATE) RETURNING id"),
                     {"v": admin["id"] if admin else None, "n": body.nombre.strip(), "t": body.tipo, "c": body.comuna, "tel": body.telefono, "em": (body.email or "").strip().lower() or None, "o": body.origen, "no": nota}).scalar()
    db.commit()
    tel = "".join(ch for ch in ((admin or {}).get("telefono") or TB_WA) if ch.isdigit()); tel = "56" + tel if len(tel) == 9 else tel
    if EVOLUTION_API_URL and EVOLUTION_API_KEY:
        try: httpx.post(f"{EVOLUTION_API_URL}/message/sendText/{EVOLUTION_INSTANCE}", headers={"apikey": EVOLUTION_API_KEY, "Content-Type": "application/json"}, json={"number": tel, "text": f"🪟 Nuevo lead TerraBlinds desde {body.origen}\n{body.nombre} · {body.telefono} · {body.comuna or ''}\n{nota}\n{VENTAS_URL}/ventas/cortinas/{lid}"}, timeout=10.0)
        except Exception: pass
    return {"ok": True, "id": lid}
