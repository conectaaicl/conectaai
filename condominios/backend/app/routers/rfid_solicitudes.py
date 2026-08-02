"""
Solicitudes públicas de servicio RFID — sin autenticación.

POST /api/public/rfid/solicitud  recibe pedidos de tarjetas/duplicados
GET  /api/public/rfid/stock      stock actual en vivo
"""
import os
import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
from typing import Optional
from app.core.database import get_db

router = APIRouter(prefix="/api/public/rfid", tags=["rfid-publico"])

EVOLUTION_API_URL = os.getenv("EVOLUTION_API_URL", "http://evolution_api:8080")
EVOLUTION_API_KEY = os.getenv("EVOLUTION_API_KEY", "")
EVOLUTION_INSTANCE = "condominios"
HECTOR_NUMBER = "56998101891"

MAIL_URL = "http://localhost:3004/api/send"
MAIL_KEY = os.getenv("MAIL_API_KEY", "")
MAIL_FROM = "ConectaAI RFID <no-reply@conectaai.cl>"
ADMIN_EMAIL = "terrablinds@gmail.com"

# Stock físico total (actualizar al recibir reposición)
STOCK_MIFARE = 50
STOCK_EM4100 = 50


class SolicitudCreate(BaseModel):
    nombre: str
    telefono: str
    email: Optional[str] = None
    tipo_servicio: str        # tarjeta | duplicado | domicilio
    tipo_tarjeta: Optional[str] = None   # mifare_classic | em4100 | llavero | control_porton
    cantidad: int = 1
    modo_atencion: str        # oficina | domicilio
    direccion: Optional[str] = None
    condominio: Optional[str] = None
    notas: Optional[str] = None


def _wa(to: str, msg: str) -> bool:
    if not EVOLUTION_API_KEY:
        return False
    try:
        digits = "".join(c for c in to if c.isdigit())
        r = httpx.post(
            f"{EVOLUTION_API_URL}/message/sendText/{EVOLUTION_INSTANCE}",
            json={"number": digits, "text": msg},
            headers={"apikey": EVOLUTION_API_KEY, "Content-Type": "application/json"},
            timeout=8.0,
        )
        return r.status_code in (200, 201)
    except Exception:
        return False


async def _email(to: str, subject: str, html: str) -> bool:
    try:
        async with httpx.AsyncClient() as c:
            r = await c.post(
                MAIL_URL,
                json={"to": to, "subject": subject, "html": html, "from": MAIL_FROM},
                headers={"Authorization": f"Bearer {MAIL_KEY}"},
                timeout=10,
            )
            return r.status_code == 200
    except Exception:
        return False


@router.get("/stock")
def stock(db: Session = Depends(get_db)):
    rows = db.execute(text(
        "SELECT tipo_tarjeta, COALESCE(SUM(cantidad),0) AS vendidas "
        "FROM solicitudes_rfid "
        "WHERE tipo_servicio = 'tarjeta' AND estado != 'cancelada' "
        "GROUP BY tipo_tarjeta"
    )).fetchall()
    vendidas = {r[0]: int(r[1]) for r in rows}
    return {
        "mifare_classic": max(0, STOCK_MIFARE - vendidas.get("mifare_classic", 0)),
        "em4100": max(0, STOCK_EM4100 - vendidas.get("em4100", 0)),
        "llavero": 0,
    }


@router.post("/solicitud", status_code=201)
async def crear_solicitud(data: SolicitudCreate, db: Session = Depends(get_db)):
    if data.cantidad < 1 or data.cantidad > 200:
        raise HTTPException(400, "Cantidad debe estar entre 1 y 200")

    row = db.execute(text("""
        INSERT INTO solicitudes_rfid
            (nombre, telefono, email, tipo_servicio, tipo_tarjeta, cantidad,
             modo_atencion, direccion, condominio, notas)
        VALUES
            (:nombre, :telefono, :email, :tipo_servicio, :tipo_tarjeta, :cantidad,
             :modo_atencion, :direccion, :condominio, :notas)
        RETURNING id
    """), data.model_dump()).fetchone()
    db.commit()
    sol_id = row[0]

    tipo_label = {
        "tarjeta":   "🃏 Comprar tarjeta",
        "duplicado": "📋 Duplicado / clonación",
        "domicilio": "🚗 Servicio a domicilio",
    }.get(data.tipo_servicio, data.tipo_servicio)

    tarjeta_label = {
        "mifare_classic":  "Mifare Classic 13.56 MHz",
        "em4100":          "EM4100 125 kHz",
        "llavero":         "Llavero RFID",
        "control_porton":  "Control de portón",
    }.get(data.tipo_tarjeta or "", data.tipo_tarjeta or "No especificado")

    modo_label = (
        "🏢 Viene a la oficina"
        if data.modo_atencion == "oficina"
        else f"🚗 Visita a domicilio — {data.direccion or 'sin dirección'}"
    )

    # ── WhatsApp a Héctor ────────────────────────────────────────────────────
    wa_msg = (
        f"🔔 *Nueva solicitud RFID #{sol_id}*\n\n"
        f"*Nombre:* {data.nombre}\n"
        f"*Teléfono:* {data.telefono}\n"
        f"*Email:* {data.email or '—'}\n"
        f"*Servicio:* {tipo_label}\n"
        f"*Tipo tarjeta:* {tarjeta_label}\n"
        f"*Cantidad:* {data.cantidad}\n"
        f"*Modo:* {modo_label}\n"
        f"*Condominio:* {data.condominio or '—'}\n"
        f"*Notas:* {data.notas or '—'}\n\n"
        f"👉 https://condo.conectaai.cl/dashboard/rfid-solicitudes"
    )
    _wa(HECTOR_NUMBER, wa_msg)

    # ── Email a Héctor ───────────────────────────────────────────────────────
    admin_html = f"""
    <div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;background:#f7f8fc;border-radius:16px;overflow:hidden">
      <div style="background:linear-gradient(135deg,#0891B2,#0F766E);padding:32px;text-align:center">
        <h1 style="color:#fff;margin:0;font-size:22px">📡 Solicitud RFID #{sol_id}</h1>
        <p style="color:rgba(255,255,255,.75);margin:6px 0 0;font-size:14px">Nueva solicitud recibida</p>
      </div>
      <div style="background:#fff;padding:32px">
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr><td style="padding:8px 12px;color:#6b7280;width:130px">Nombre</td><td style="padding:8px 12px;font-weight:600">{data.nombre}</td></tr>
          <tr style="background:#f9fafb"><td style="padding:8px 12px;color:#6b7280">Teléfono</td><td style="padding:8px 12px;font-weight:600">{data.telefono}</td></tr>
          <tr><td style="padding:8px 12px;color:#6b7280">Email</td><td style="padding:8px 12px">{data.email or '—'}</td></tr>
          <tr style="background:#f9fafb"><td style="padding:8px 12px;color:#6b7280">Servicio</td><td style="padding:8px 12px;font-weight:600">{tipo_label}</td></tr>
          <tr><td style="padding:8px 12px;color:#6b7280">Tipo tarjeta</td><td style="padding:8px 12px">{tarjeta_label}</td></tr>
          <tr style="background:#f9fafb"><td style="padding:8px 12px;color:#6b7280">Cantidad</td><td style="padding:8px 12px;font-weight:600">{data.cantidad}</td></tr>
          <tr><td style="padding:8px 12px;color:#6b7280">Modo</td><td style="padding:8px 12px">{modo_label}</td></tr>
          <tr style="background:#f9fafb"><td style="padding:8px 12px;color:#6b7280">Condominio</td><td style="padding:8px 12px">{data.condominio or '—'}</td></tr>
          <tr><td style="padding:8px 12px;color:#6b7280">Notas</td><td style="padding:8px 12px">{data.notas or '—'}</td></tr>
        </table>
        <div style="margin-top:24px;text-align:center">
          <a href="https://condo.conectaai.cl/dashboard/rfid-solicitudes"
             style="background:#0891B2;color:#fff;padding:13px 28px;border-radius:9px;text-decoration:none;font-weight:600;font-size:14px;display:inline-block">
            Ver en Panel Admin →
          </a>
        </div>
      </div>
      <p style="text-align:center;color:#9ca3af;font-size:12px;padding:16px">ConectaAI · condo.conectaai.cl</p>
    </div>"""
    await _email(ADMIN_EMAIL, f"[RFID #{sol_id}] {data.nombre} — {tipo_label}", admin_html)

    # ── Confirmación al cliente ──────────────────────────────────────────────
    if data.email:
        client_html = f"""
        <div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;background:#f7f8fc;border-radius:16px;overflow:hidden">
          <div style="background:linear-gradient(135deg,#0891B2,#0F766E);padding:32px;text-align:center">
            <h1 style="color:#fff;margin:0;font-size:22px">✅ ¡Solicitud recibida!</h1>
          </div>
          <div style="background:#fff;padding:32px">
            <p style="font-size:16px;margin:0 0 12px">Hola <strong>{data.nombre}</strong>,</p>
            <p style="color:#374151;line-height:1.6">Recibimos tu solicitud <strong>#{sol_id}</strong> de servicio RFID.
            Te contactaremos pronto al número <strong>{data.telefono}</strong> para coordinar.</p>
            <div style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:10px;padding:18px;margin:24px 0">
              <p style="margin:0;color:#0f766e;font-weight:600;font-size:14px">¿Tienes dudas? Escríbenos directo:</p>
              <p style="margin:8px 0 0;font-size:14px">
                <a href="https://wa.me/56998101891" style="color:#0891B2;font-weight:600">WhatsApp +56 9 9810 1891</a>
              </p>
            </div>
          </div>
          <p style="text-align:center;color:#9ca3af;font-size:12px;padding:16px">
            ConectaAI · <a href="https://conectaai.cl/rfid" style="color:#9ca3af">conectaai.cl/rfid</a>
          </p>
        </div>"""
        await _email(data.email, f"✅ Solicitud RFID #{sol_id} recibida — ConectaAI", client_html)

    return {"ok": True, "id": sol_id}


@router.get("/solicitudes")
def listar_solicitudes(
    estado: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Panel interno — lista solicitudes (sin auth por ahora, proteger con nginx o agregar token)."""
    sql = (
        "SELECT id, nombre, telefono, email, tipo_servicio, tipo_tarjeta, cantidad, "
        "modo_atencion, direccion, condominio, notas, estado, created_at "
        "FROM solicitudes_rfid"
    )
    params: dict = {}
    if estado:
        sql += " WHERE estado = :estado"
        params["estado"] = estado
    sql += " ORDER BY created_at DESC LIMIT 200"
    rows = db.execute(text(sql), params).fetchall()
    return [dict(r._mapping) for r in rows]


@router.patch("/solicitudes/{sol_id}/estado")
async def actualizar_estado(
    sol_id: int,
    body: dict,
    db: Session = Depends(get_db),
):
    nuevo = body.get("estado")
    if nuevo not in ("pendiente", "confirmada", "en_proceso", "lista", "entregada", "cancelada"):
        raise HTTPException(400, "Estado inválido")
    db.execute(
        text("UPDATE solicitudes_rfid SET estado = :e, updated_at = NOW() WHERE id = :id"),
        {"e": nuevo, "id": sol_id},
    )
    db.commit()

    # Si está lista, avisar al cliente por WA
    if nuevo == "lista":
        row = db.execute(
            text("SELECT nombre, telefono, tipo_tarjeta, cantidad, modo_atencion FROM solicitudes_rfid WHERE id = :id"),
            {"id": sol_id},
        ).fetchone()
        if row:
            nombre, tel, tipo, cant, modo = row
            msg = (
                f"✅ *Tu solicitud RFID #{sol_id} está lista*\n\n"
                f"Hola {nombre}, {'pasa a retirar a nuestra oficina cuando quieras.' if modo == 'oficina' else 'nos coordinamos para la visita.'}\n\n"
                f"📱 ConectaAI — +56 9 9810 1891"
            )
            _wa(tel, msg)

    return {"ok": True}
