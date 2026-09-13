"""
Automatizaciones de Ventas Terreno (se ejecuta 1 vez al dia via cron del host):
  POST /api/ventas-terreno/cron/diario?secret=CRON_SECRET

- Dia 3 del demo: correo al prospecto ("¿pudiste probar la app de vecinos?").
- Dia 5 (vencido): correo "tu demo paso a modo vitrina" + aviso al vendedor.
- 30 dias vencido sin convertir: se suspende el tenant demo y sus cuentas.
- Prospecto "caliente" (uso intenso del demo) o propuesta abierta 3+ veces: WhatsApp al vendedor (1 vez por dia por edificio).
- Propuestas sin abrir a los 3 dias: recordatorio al vendedor en Mi dia (ya existe) + WhatsApp resumen.
"""
import os
from datetime import datetime, timezone
from urllib.parse import quote

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.routers.ventas_terreno import _row, _rows, _telemetria, _temperatura, MAIL_API_URL, MAIL_API_KEY, EVOLUTION_API_URL, EVOLUTION_API_KEY, EVOLUTION_INSTANCE, VENTAS_URL, MARCA, LOGO_CAI_URL, VENTAS_MAIL, VENTAS_FROM
from app.routers import ventas_demo as demo

router = APIRouter(prefix="/api/ventas-terreno/cron", tags=["Ventas cron"])
CRON_SECRET = os.getenv("CRON_SECRET", "")


def _mail(to, subject, html):
    try:
        r = httpx.post(MAIL_API_URL, headers={"Authorization": "Bearer " + MAIL_API_KEY, "Content-Type": "application/json"}, json={"to": to, "from": VENTAS_FROM, "reply_to": VENTAS_MAIL, "subject": subject, "html": html}, timeout=15.0)
        return r.status_code < 300
    except Exception:
        return False


def _wa(tel, msg):
    tel = "".join(ch for ch in (tel or "") if ch.isdigit()); tel = "56" + tel if len(tel) == 9 else tel
    if not (tel and EVOLUTION_API_URL and EVOLUTION_API_KEY): return False
    try:
        r = httpx.post(f"{EVOLUTION_API_URL}/message/sendText/{EVOLUTION_INSTANCE}", headers={"apikey": EVOLUTION_API_KEY, "Content-Type": "application/json"}, json={"number": tel, "text": msg}, timeout=15.0)
        return r.status_code < 300
    except Exception:
        return False


def _html(titulo, cuerpo, boton=None, url=None):
    return (f"<div style='font-family:Inter,Arial,sans-serif;max-width:600px;margin:auto'><div style='background:#0B1F2A;color:#fff;padding:24px;border-radius:14px 14px 0 0'><img src='{LOGO_CAI_URL}' width='64' height='64' style='display:block;background:#fff;border-radius:14px;padding:5px;margin-bottom:12px'><h1 style='margin:0;font-size:22px'>{titulo}</h1></div>"
            f"<div style='border:1px solid #DDE4E6;border-top:none;padding:24px;border-radius:0 0 14px 14px;color:#35505C;font-size:15px'>{cuerpo}" + (f"<p style='margin:22px 0'><a href='{url}' style='background:#0F766E;color:#fff;padding:13px 20px;border-radius:10px;text-decoration:none;font-weight:700'>{boton}</a></p>" if boton else "") + "</div></div>")


def _ensure(db):
    db.execute(text("ALTER TABLE ventas_demos ADD COLUMN IF NOT EXISTS aviso_d3 TIMESTAMPTZ")); db.execute(text("ALTER TABLE ventas_demos ADD COLUMN IF NOT EXISTS aviso_d5 TIMESTAMPTZ"))
    db.execute(text("ALTER TABLE ventas_edificios ADD COLUMN IF NOT EXISTS aviso_caliente TIMESTAMPTZ")); db.commit()


@router.post("/diario")
def diario(request: Request, secret: str = "", db: Session = Depends(get_db)):
    if not CRON_SECRET or secret != CRON_SECRET:
        raise HTTPException(401, "secret")
    _ensure(db)
    now = datetime.now(timezone.utc)
    out = {"d3": 0, "d5": 0, "limpiados": 0, "calientes": 0, "sin_abrir": 0}

    demos = _rows(db, """SELECT d.*, e.nombre, e.administrador_nombre, e.administrador_email, e.administrador_telefono, e.vendedor_id, e.etapa,
        vd.nombre AS vendedor, vd.telefono AS vendedor_tel, vd.email AS vendedor_email
        FROM ventas_demos d JOIN ventas_edificios e ON e.id=d.edificio_id LEFT JOIN ventas_vendedores vd ON vd.id=e.vendedor_id WHERE d.estado IN ('activo')""")
    for d in demos:
        dias = (now - d["inicia"]).days if d.get("inicia") else 0
        cred = d["credenciales"] or {}
        vencido = d["vence"] and d["vence"] < now
        first = (d.get("administrador_nombre") or "").split(" ")[0]
        if dias >= 3 and not d.get("aviso_d3") and not vencido and d.get("administrador_email"):
            t = _telemetria(db, d["tenant_id"])
            cuerpo = (f"<p>Hola {first}, ya llevas 3 días con el demo de <b>{d['nombre']}</b>. " + ("Vimos que ya entraste: " + ", ".join(m['detalle'] for m in t['modulos'][:3]) + ". " if t["ingresos"] else "Todavía no vemos ingresos, ") +
                      f"¿pudiste probar la <b>app de vecinos</b>? Es la que más sorprende a los comités: invitaciones QR, encomiendas y estado de cuenta desde el celular.</p>"
                      f"<p>App de vecinos: <a href='{cred.get('residente', {}).get('url', '')}'>{cred.get('residente', {}).get('url', '')}</a> · RUT {cred.get('residente', {}).get('rut', '')} · clave <code>{cred.get('residente', {}).get('password', '')}</code></p>"
                      f"<p>Te quedan {max(0, (d['vence'] - now).days)} días. Cualquier duda, {d.get('vendedor') or 'nuestro equipo'} te responde por WhatsApp.</p>")
            if _mail(d["administrador_email"], f"¿Pudiste probar la app de vecinos de {d['nombre']}?", _html("Tu demo va por el día 3", cuerpo, "Entrar al demo", cred.get("admin", {}).get("url"))):
                db.execute(text("UPDATE ventas_demos SET aviso_d3=NOW() WHERE id=:id"), {"id": d["id"]}); db.commit(); out["d3"] += 1
        if vencido and not d.get("aviso_d5"):
            if d.get("administrador_email"):
                cuerpo = (f"<p>Hola {first}, el demo de <b>{d['nombre']}</b> terminó su período de prueba. Puedes seguir entrando y viendo todo, pero ya no se puede modificar.</p>"
                          f"<p>Si quieres activarlo en tu edificio, {d.get('vendedor') or 'nuestro equipo'} lo deja operativo en menos de una semana: cargamos tus unidades y vecinos, capacitamos al conserje y entregamos las claves de la app.</p>")
                _mail(d["administrador_email"], f"Tu demo de {d['nombre']} pasó a modo vitrina", _html("Demo finalizado", cuerpo, "Quiero activarlo", f"https://wa.me/{''.join(ch for ch in (d.get('vendedor_tel') or '56998101891') if ch.isdigit())}?text=" + quote(f"Hola, probé el demo de {d['nombre']} y quiero activarlo.")))
            t = _telemetria(db, d["tenant_id"])
            _wa(d.get("vendedor_tel"), f"⏰ Venció el demo de {d['nombre']} ({d.get('administrador_nombre') or ''}). {t['ingresos']} ingresos · vio: {', '.join(m['detalle'] for m in t['modulos'][:3]) or 'nada'}.\nLlámalo hoy o extiéndelo: {VENTAS_URL}/ventas/edificios/{d['edificio_id']}")
            db.execute(text("UPDATE ventas_demos SET aviso_d5=NOW() WHERE id=:id"), {"id": d["id"]}); db.commit(); out["d5"] += 1
        if vencido and (now - d["vence"]).days >= 30 and d["etapa"] not in ("cliente", "negociacion"):
            db.execute(text("UPDATE tenants SET estado='suspendido', updated_at=NOW() WHERE id=:t"), {"t": d["tenant_id"]})
            db.execute(text("UPDATE usuarios SET activo=false WHERE tenant_id=:t"), {"t": d["tenant_id"]})
            db.execute(text("UPDATE ventas_demos SET estado='eliminado' WHERE id=:id"), {"id": d["id"]}); db.commit(); out["limpiados"] += 1

    # Prospectos calientes: uso intenso del demo o propuesta abierta 3+ veces -> WhatsApp al vendedor (max 1 por dia)
    for e in _rows(db, """SELECT e.id, e.nombre, e.administrador_nombre, e.administrador_telefono, e.aviso_caliente, vd.telefono AS vendedor_tel,
            (SELECT tenant_id FROM ventas_demos d WHERE d.edificio_id=e.id AND d.estado='activo' ORDER BY id DESC LIMIT 1) AS tenant_id,
            (SELECT aperturas FROM ventas_propuestas p WHERE p.edificio_id=e.id ORDER BY id DESC LIMIT 1) AS aperturas
            FROM ventas_edificios e LEFT JOIN ventas_vendedores vd ON vd.id=e.vendedor_id WHERE e.etapa IN ('propuesta','demo','negociacion')"""):
        if e.get("aviso_caliente") and (now - e["aviso_caliente"]).days < 1: continue
        t = _telemetria(db, e["tenant_id"]) if e.get("tenant_id") else {"ingresos": 0, "modulos": []}
        if _temperatura(t, {"aperturas": e.get("aperturas") or 0}) == "caliente":
            if _wa(e.get("vendedor_tel"), f"🔥 {e['nombre']} está caliente: {t['ingresos']} ingresos al demo, propuesta abierta ×{e.get('aperturas') or 0}. Vio: {', '.join(m['detalle'] for m in t['modulos'][:3]) or '—'}.\nLlama a {e.get('administrador_nombre') or 'la administración'} {e.get('administrador_telefono') or ''}\n{VENTAS_URL}/ventas/edificios/{e['id']}"):
                db.execute(text("UPDATE ventas_edificios SET aviso_caliente=NOW() WHERE id=:id"), {"id": e["id"]}); db.commit(); out["calientes"] += 1

    # Resumen matinal al vendedor: propuestas sin abrir hace 3+ dias
    for v in _rows(db, "SELECT id, nombre, telefono FROM ventas_vendedores WHERE activo AND telefono IS NOT NULL"):
        sin = _rows(db, """SELECT e.nombre FROM ventas_propuestas pr JOIN ventas_edificios e ON e.id=pr.edificio_id
            WHERE pr.enviado_en < NOW() - INTERVAL '3 days' AND pr.abierto_en IS NULL AND e.etapa IN ('propuesta','demo') AND (e.vendedor_id=:v OR e.vendedor_id IS NULL) ORDER BY pr.enviado_en LIMIT 8""", v=v["id"])
        if sin:
            _wa(v["telefono"], f"📬 Buenos días {v['nombre'].split()[0]}: {len(sin)} propuesta(s) sin abrir hace 3+ días: " + ", ".join(s["nombre"] for s in sin) + f".\nReenvíalas por WhatsApp desde {VENTAS_URL}/ventas/propuestas"); out["sin_abrir"] += len(sin)
    return out
