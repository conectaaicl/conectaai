"""
Presentaciones multi-producto (heredado de la app Express de ventas.conectaai.cl).

El vendedor elige productos del ecosistema ConectaAI y los manda por WhatsApp/correo
con un link publico /pres/<token> (registra apertura) y PDF. Los registros antiguos
(db.json) se migran a ventas_presentaciones.
"""
import base64
import io
import json
import secrets
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional
from urllib.parse import quote

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.routers.ventas_terreno import get_vendedor, _row, _rows, MAIL_API_URL, MAIL_API_KEY, EVOLUTION_API_URL, EVOLUTION_API_KEY, EVOLUTION_INSTANCE, VENTAS_URL

router = APIRouter(prefix="/api/ventas-terreno", tags=["Ventas presentaciones"])

CATALOG = [
    {"id": "conectatap", "name": "ConectaTap", "web": "tap.conectaai.cl", "landingUrl": "https://tap.conectaai.cl/t/menusmart", "icon": "📲", "color": "#0B74FF",
     "tagline": "Placas NFC + QR inteligentes: cada cliente que toca tu placa llega directo a tu negocio digital.",
     "idealPara": "Negocios físicos: restaurantes, salones, clínicas, talleres, tiendas",
     "benefits": ["Una placa NFC en la mesa o mostrador — el cliente la toca y ve tu perfil", "QR incluido en la misma placa, doble cobertura para todos los celulares", "Analytics: cuántas personas tocaron cada placa y cuándo", "Se conecta a WhatsApp, Instagram, menú digital, reservas y más", "Instalación en un día, sin técnicos ni configuraciones complejas", "Dashboard para ver scans por placa, por local y por campaña"]},
    {"id": "menusmart", "name": "MenuSmart", "web": "qr.conectaai.cl", "landingUrl": "https://tap.conectaai.cl/t/menusmart", "icon": "🍔", "color": "#ff5f2e",
     "tagline": "Menú digital NFC + QR con pedidos al instante, pantalla de cocina y boleta digital para restaurantes.",
     "idealPara": "Restaurantes, cafeterías y locales de comida",
     "benefits": ["Menú con fotos al instante (sin apps que descargar)", "Pedidos directos desde la mesa — llegan a la pantalla de cocina en segundos", "El cliente sigue su pedido en vivo desde el celular", "Garzón confirma y entrega desde su PWA, sin papeles", "Placa NFC + QR en cada mesa para máxima cobertura", "Analytics: platos más pedidos, horas pico, conversión por mesa"]},
    {"id": "condominios", "name": "ConectaAI Condominios", "web": "condo.conectaai.cl", "landingUrl": "https://condo.conectaai.cl", "icon": "🏢", "color": "#0F766E",
     "tagline": "Administración, conserjería y app de vecinos en una sola plataforma, con demo de 5 días.",
     "idealPara": "Administradores, comités y empresas administradoras",
     "benefits": ["Gastos comunes por unidad, morosidad y convenios de pago", "Invitaciones QR de un solo uso para visitas", "Encomiendas, reservas, votaciones y avisos", "Panel táctil del conserje y app instalable para vecinos", "Mantenciones con QR firmado por el técnico", "TAG vehicular y lector de patentes"]},
    {"id": "control", "name": "Control ConectaAI", "web": "control.conectaai.cl", "icon": "📊", "color": "#12b76a",
     "tagline": "Control de costos por proyecto con boletas fotografiadas.", "idealPara": "Empresas con gastos por obra, proyecto o centro de costo",
     "benefits": ["Sube la boleta con una foto desde el celular", "Saldos por proyecto actualizados al instante", "Rendiciones ordenadas y trazables", "Se acabaron las planillas manuales"]},
    {"id": "working", "name": "ConectaWork", "web": "working.conectaai.cl", "icon": "🔧", "color": "#6d7bff",
     "tagline": "Gestión de talleres: cotizaciones, producción e instalación.", "idealPara": "Talleres de cortinas, eléctrica, refrigeración y similares",
     "benefits": ["De cotización a instalación en un solo flujo", "GPS de instaladores en tiempo real", "Fotos, checklist y firma del cliente", "App instalable en el celular del equipo"]},
    {"id": "omniflow", "name": "OmniFlow", "web": "osw.conectaai.cl", "icon": "💬", "color": "#a855f7",
     "tagline": "CRM omnicanal con IA para WhatsApp e Instagram.", "idealPara": "Negocios que reciben clientes por redes y WhatsApp",
     "benefits": ["Bot con IA que responde solo, 24/7", "WhatsApp + Instagram + Webchat en un solo lugar", "CRM con pipeline de ventas integrado", "Automatizaciones a medida con n8n"]},
]
CAT = {c["id"]: c for c in CATALOG}
ESTADOS = ["nuevo", "contactado", "interesado", "cliente", "descartado"]
_OK = False


def _ensure(db: Session):
    global _OK
    if _OK: return
    db.execute(text("""CREATE TABLE IF NOT EXISTS ventas_presentaciones (
        id SERIAL PRIMARY KEY, token VARCHAR(40) UNIQUE NOT NULL, vendedor_id INTEGER, nombre VARCHAR(160), empresa VARCHAR(160), whatsapp VARCHAR(30), email VARCHAR(160),
        productos JSONB DEFAULT '[]'::jsonb, estado VARCHAR(20) DEFAULT 'nuevo', notas TEXT, enviado_wa BOOLEAN DEFAULT FALSE, enviado_email BOOLEAN DEFAULT FALSE,
        abierto_en TIMESTAMPTZ, aperturas INTEGER DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW())"""))
    db.commit(); _OK = True


@router.get("/catalogo")
def catalogo(v: dict = Depends(get_vendedor)):
    return {"productos": CATALOG, "estados": ESTADOS}


@router.get("/presentaciones")
def listar(v: dict = Depends(get_vendedor), db: Session = Depends(get_db)):
    _ensure(db)
    return _rows(db, "SELECT p.*, vd.nombre AS vendedor_nombre FROM ventas_presentaciones p LEFT JOIN ventas_vendedores vd ON vd.id=p.vendedor_id ORDER BY p.created_at DESC LIMIT 300")


class PresIn(BaseModel):
    nombre: str
    empresa: Optional[str] = None
    whatsapp: Optional[str] = None
    email: Optional[str] = None
    productos: List[str]
    notas: Optional[str] = None
    enviar_wa: bool = True
    enviar_email: bool = True


def _tel(t: Optional[str]) -> str:
    d = "".join(ch for ch in (t or "") if ch.isdigit())
    return "56" + d if len(d) == 9 else d


def _mensaje(p: dict, v: dict) -> str:
    prods = [CAT[x] for x in p["productos"] if x in CAT]
    url = f"{VENTAS_URL}/pres/{p['token']}"
    lines = [f"Hola {p['nombre']}! Soy {v['nombre']} de ConectaAI 👋", "", "Te preparé una presentación con lo que conversamos:"]
    lines += [f"{c['icon']} *{c['name']}* — {c['tagline']}" for c in prods]
    lines += ["", f"Ábrela aquí (incluye PDF): {url}", "", f"Cualquier duda me escribes. {v.get('telefono') or ''}".rstrip()]
    return "\n".join(lines)


def _enviar(db, p: dict, v: dict, wa: bool, email: bool) -> dict:
    out = {"wa": None, "email": None, "wa_link": None}
    msg = _mensaje(p, v)
    tel = _tel(p.get("whatsapp"))
    out["wa_link"] = f"https://wa.me/{tel}?text={quote(msg)}" if tel else f"https://wa.me/?text={quote(msg)}"
    if wa and tel and EVOLUTION_API_URL and EVOLUTION_API_KEY:
        try:
            r = httpx.post(f"{EVOLUTION_API_URL}/message/sendText/{EVOLUTION_INSTANCE}", headers={"apikey": EVOLUTION_API_KEY, "Content-Type": "application/json"}, json={"number": tel, "text": msg}, timeout=15.0)
            out["wa"] = "enviado" if r.status_code < 300 else f"error {r.status_code}"
            if r.status_code < 300: db.execute(text("UPDATE ventas_presentaciones SET enviado_wa=true WHERE id=:id"), {"id": p["id"]}); db.commit()
        except Exception as ex:
            out["wa"] = f"error: {ex}"
    if email and p.get("email"):
        prods = [CAT[x] for x in p["productos"] if x in CAT]
        url = f"{VENTAS_URL}/pres/{p['token']}"
        cards = "".join(f"<tr><td style='padding:12px;border-bottom:1px solid #eee'><div style='font-size:22px'>{c['icon']}</div><b style='color:{c['color']}'>{c['name']}</b><div style='color:#35505C;font-size:14px'>{c['tagline']}</div><div style='color:#7A8F98;font-size:12px'>{c['web']}</div></td></tr>" for c in prods)
        html = (f"<div style='font-family:Inter,Arial,sans-serif;max-width:600px;margin:auto'><div style='background:#0B1F2A;color:#fff;padding:26px;border-radius:14px 14px 0 0'><p style='margin:0;font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:#7FD1C6'>Presentación ConectaAI</p><h1 style='margin:6px 0 0;font-size:24px'>Hola {p['nombre']}</h1></div>"
                f"<div style='border:1px solid #DDE4E6;border-top:none;padding:24px;border-radius:0 0 14px 14px'><p style='color:#35505C'>Como conversamos, te dejo la presentación de las herramientas que pueden servirle a {p.get('empresa') or 'tu negocio'}:</p><table style='width:100%;border-collapse:collapse'>{cards}</table>"
                f"<p style='margin:22px 0'><a href='{url}' style='background:#0F766E;color:#fff;padding:14px 22px;border-radius:10px;text-decoration:none;font-weight:700'>Ver presentación completa</a></p>"
                f"<p style='font-size:14px;color:#35505C'>{v['nombre']} · ConectaAI<br>{v.get('telefono') or ''} · {v['email']}</p></div></div>")
        payload = {"to": p["email"], "from": "ventas@conectaai.cl", "reply_to": v["email"], "subject": f"Presentación ConectaAI para {p.get('empresa') or p['nombre']}", "html": html}
        try:
            pdf = _pdf(p, v)
            payload["attachments"] = [{"filename": "Presentacion-ConectaAI.pdf", "content": base64.b64encode(pdf).decode(), "contentType": "application/pdf"}]
        except Exception as ex:
            print("pdf pres error", ex)
        try:
            r = httpx.post(MAIL_API_URL, headers={"Authorization": "Bearer " + MAIL_API_KEY, "Content-Type": "application/json"}, json=payload, timeout=20.0)
            out["email"] = "enviado" if r.status_code < 300 else f"error {r.status_code}"
            if r.status_code < 300: db.execute(text("UPDATE ventas_presentaciones SET enviado_email=true WHERE id=:id"), {"id": p["id"]}); db.commit()
        except Exception as ex:
            out["email"] = f"error: {ex}"
    return out


@router.post("/presentaciones", status_code=201)
def crear(body: PresIn, v: dict = Depends(get_vendedor), db: Session = Depends(get_db)):
    _ensure(db)
    prods = [x for x in body.productos if x in CAT]
    if not prods: raise HTTPException(400, "Elige al menos un producto")
    if not body.whatsapp and not body.email: raise HTTPException(400, "Falta WhatsApp o correo")
    tok = secrets.token_hex(8)
    pid = db.execute(text("INSERT INTO ventas_presentaciones (token, vendedor_id, nombre, empresa, whatsapp, email, productos, notas) VALUES (:t, :v, :n, :e, :w, :m, :p, :no) RETURNING id"),
                     {"t": tok, "v": v["id"], "n": body.nombre.strip(), "e": body.empresa, "w": body.whatsapp, "m": (body.email or "").strip().lower() or None, "p": json.dumps(prods), "no": body.notas}).scalar()
    db.commit()
    p = _row(db, "SELECT * FROM ventas_presentaciones WHERE id=:id", id=pid)
    envio = _enviar(db, p, v, body.enviar_wa, body.enviar_email)
    return {"presentacion": {**p, "url": f"{VENTAS_URL}/pres/{tok}"}, "envio": envio}


class PresPatch(BaseModel):
    estado: Optional[str] = None
    notas: Optional[str] = None


@router.patch("/presentaciones/{pid}")
def editar(pid: int, body: PresPatch, v: dict = Depends(get_vendedor), db: Session = Depends(get_db)):
    if body.estado and body.estado not in ESTADOS: raise HTTPException(400, "Estado inválido")
    data = body.dict(exclude_unset=True)
    if data:
        db.execute(text("UPDATE ventas_presentaciones SET " + ", ".join(f"{k}=:{k}" for k in data) + " WHERE id=:id"), {**data, "id": pid}); db.commit()
    return _row(db, "SELECT * FROM ventas_presentaciones WHERE id=:id", id=pid)


@router.post("/presentaciones/{pid}/reenviar")
def reenviar(pid: int, canal: str = "ambos", v: dict = Depends(get_vendedor), db: Session = Depends(get_db)):
    p = _row(db, "SELECT * FROM ventas_presentaciones WHERE id=:id", id=pid)
    if not p: raise HTTPException(404, "No encontrada")
    return _enviar(db, p, v, canal in ("wa", "ambos"), canal in ("email", "ambos"))


@router.delete("/presentaciones/{pid}", status_code=204)
def borrar(pid: int, v: dict = Depends(get_vendedor), db: Session = Depends(get_db)):
    db.execute(text("DELETE FROM ventas_presentaciones WHERE id=:id"), {"id": pid}); db.commit()


# ─── Publico ─────────────────────────────────────────────────────────────────

@router.get("/pres/{token}")
def publica(token: str, request: Request, db: Session = Depends(get_db)):
    _ensure(db)
    p = _row(db, "SELECT * FROM ventas_presentaciones WHERE token=:t", t=token)
    if not p: raise HTTPException(404, "Presentación no encontrada")
    ua = (request.headers.get("user-agent") or "").lower()
    if "bot" not in ua and "whatsapp" not in ua:
        db.execute(text("UPDATE ventas_presentaciones SET aperturas=aperturas+1, abierto_en=COALESCE(abierto_en, NOW()) WHERE id=:id"), {"id": p["id"]}); db.commit()
    v = _row(db, "SELECT nombre, email, telefono FROM ventas_vendedores WHERE id=:id", id=p["vendedor_id"]) or {}
    return {"nombre": p["nombre"], "empresa": p["empresa"], "productos": [CAT[x] for x in p["productos"] if x in CAT], "vendedor": v,
            "pdf_url": f"/api/ventas-terreno/pres/{token}/pdf", "wa": "https://wa.me/" + _tel(v.get("telefono") or "56998101891")}


@router.get("/pres/{token}/pdf")
def publica_pdf(token: str, db: Session = Depends(get_db)):
    p = _row(db, "SELECT * FROM ventas_presentaciones WHERE token=:t", t=token)
    if not p: raise HTTPException(404, "No encontrada")
    v = _row(db, "SELECT nombre, email, telefono FROM ventas_vendedores WHERE id=:id", id=p["vendedor_id"]) or {"nombre": "ConectaAI", "email": "ventas@conectaai.cl"}
    return Response(_pdf(p, v), media_type="application/pdf", headers={"Content-Disposition": "inline; filename=Presentacion-ConectaAI.pdf"})


def _pdf(p: dict, v: dict) -> bytes:
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas
    from reportlab.lib.colors import HexColor
    from reportlab.pdfbase.pdfmetrics import stringWidth
    W, H = A4; buf = io.BytesIO(); c = canvas.Canvas(buf, pagesize=A4)
    INK, MUT = HexColor("#0B1F2A"), HexColor("#7A8F98")

    def wrap(t, w, f="Helvetica", s=10.5):
        out, cur = [], ""
        for x in (t or "").split():
            n = (cur + " " + x).strip()
            if stringWidth(n, f, s) <= w: cur = n
            else: out.append(cur); cur = x
        if cur: out.append(cur)
        return out

    c.setFillColor(INK); c.rect(0, 0, W, H, fill=1, stroke=0)
    c.setFillColor(HexColor("#7FD1C6")); c.setFont("Helvetica-Bold", 11); c.drawString(50, H - 120, "PRESENTACIÓN CONECTAAI")
    c.setFillColor(HexColor("#FFFFFF")); c.setFont("Helvetica-Bold", 32); c.drawString(50, H - 170, f"Para {p['nombre']}")
    if p.get("empresa"): c.setFont("Helvetica", 16); c.setFillColor(HexColor("#B9C8CC")); c.drawString(50, H - 198, p["empresa"])
    c.setFont("Helvetica", 12); c.setFillColor(HexColor("#B9C8CC"))
    y = H - 260
    for x in p["productos"]:
        if x in CAT: c.drawString(50, y, f"•  {CAT[x]['name']} — {CAT[x]['web']}"); y -= 20
    c.drawString(50, 140, f"{v['nombre']} · {v.get('telefono') or ''} · {v['email']}"); c.drawString(50, 122, datetime.now().strftime("%d/%m/%Y"))
    c.showPage()
    for x in p["productos"]:
        if x not in CAT: continue
        d = CAT[x]; col = HexColor(d["color"])
        c.setFillColor(col); c.rect(0, H - 150, W, 150, fill=1, stroke=0)
        c.setFillColor(HexColor("#FFFFFF")); c.setFont("Helvetica-Bold", 28); c.drawString(50, H - 80, d["name"])
        c.setFont("Helvetica", 12); c.drawString(50, H - 104, d["web"])
        c.setFillColor(INK); c.setFont("Helvetica-Bold", 14); y = H - 190
        for ln in wrap(d["tagline"], W - 100, "Helvetica-Bold", 14): c.drawString(50, y, ln); y -= 19
        c.setFont("Helvetica", 11); c.setFillColor(MUT); c.drawString(50, y - 6, "Ideal para: " + d["idealPara"]); y -= 40
        c.setFillColor(INK)
        for b in d["benefits"]:
            c.setFillColor(col); c.circle(56, y + 4, 3, fill=1, stroke=0); c.setFillColor(INK); c.setFont("Helvetica", 11.5)
            for i, ln in enumerate(wrap(b, W - 130, "Helvetica", 11.5)): c.drawString(68, y - i * 15, ln)
            y -= 15 * max(1, len(wrap(b, W - 130, "Helvetica", 11.5))) + 8
        if d.get("landingUrl"):
            c.setFillColor(col); c.roundRect(50, 80, 260, 40, 10, fill=1, stroke=0); c.setFillColor(HexColor("#FFFFFF")); c.setFont("Helvetica-Bold", 12); c.drawString(66, 94, "Ver demo en vivo"); c.setFont("Helvetica", 9); c.setFillColor(MUT); c.drawString(320, 94, d["landingUrl"])
        c.setFont("Helvetica", 8); c.setFillColor(MUT); c.drawString(50, 40, f"ConectaAI · {v['nombre']} · {v['email']}")
        c.showPage()
    c.save(); return buf.getvalue()


# ─── Migracion desde db.json (una vez) ───────────────────────────────────────

@router.post("/presentaciones/migrar")
def migrar(v: dict = Depends(get_vendedor), db: Session = Depends(get_db)):
    """Importa las presentaciones del JSON antiguo montado en /app/uploads/ventas/legacy_db.json."""
    _ensure(db)
    if v["rol"] != "admin": raise HTTPException(403, "Solo admin")
    src = Path("/app/uploads/ventas/legacy_db.json")
    if not src.exists(): raise HTTPException(404, "No hay legacy_db.json")
    d = json.loads(src.read_text())
    n = 0
    est = {"contactado": "contactado", "interesado": "interesado", "cliente": "cliente"}
    for p in d.get("presentations", []):
        if db.execute(text("SELECT 1 FROM ventas_presentaciones WHERE token=:t"), {"t": p["token"]}).fetchone(): continue
        db.execute(text("INSERT INTO ventas_presentaciones (token, vendedor_id, nombre, whatsapp, email, productos, estado, notas, enviado_wa, enviado_email, abierto_en, aperturas, created_at) "
                        "VALUES (:t, :v, :n, :w, :e, :p, :s, :no, :sw, :se, :ab, :ap, :ca)"),
                   {"t": p["token"], "v": v["id"], "n": p.get("prospect_name"), "w": p.get("prospect_wa") or None, "e": p.get("prospect_email") or None, "p": json.dumps(p.get("products", [])),
                    "s": est.get(p.get("status"), "nuevo"), "no": "\n".join(x.get("text", "") if isinstance(x, dict) else str(x) for x in p.get("notes", [])) or None,
                    "sw": bool((p.get("sent") or {}).get("wa")), "se": bool((p.get("sent") or {}).get("email")),
                    "ab": datetime.fromtimestamp(p["opened_at"] / 1000, tz=timezone.utc) if p.get("opened_at") else None, "ap": 1 if p.get("opened_at") else 0,
                    "ca": datetime.fromtimestamp(p["created_at"] / 1000, tz=timezone.utc) if p.get("created_at") else datetime.now(timezone.utc)})
        n += 1
    db.commit()
    return {"importadas": n}
