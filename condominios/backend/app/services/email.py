import os, httpx
from typing import Optional

MAIL_URL = os.getenv("MAIL_API_URL", "http://mailsaas_web:3000")
# NOTE: from outside Docker use http://localhost:3004
MAIL_KEY = os.getenv("MAIL_API_KEY", "sk_live_6pplo4eac1j6m26z2j9np")

async def send_email(to: str, subject: str, html: str, text: str = "") -> bool:
    """Send email via mail.conectaai.cl"""
    try:
        async with httpx.AsyncClient() as client:
            r = await client.post(
                f"http://localhost:3004/api/send",  # direct port, not Docker service name
                json={"to": to, "subject": subject, "html": html, "text": text},
                headers={"Authorization": f"Bearer {MAIL_KEY}"},
                timeout=10
            )
            return r.status_code == 200
    except Exception:
        return False

async def send_gasto_notificacion(email: str, nombre: str, mes: int, anio: int, monto: float, vencimiento: str) -> bool:
    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
      <div style="background:linear-gradient(135deg,#667eea,#764ba2);padding:30px;text-align:center">
        <h1 style="color:white;margin:0">&#127968; Gasto Común</h1>
      </div>
      <div style="padding:30px;background:#f9f9f9">
        <p>Estimado/a <strong>{nombre}</strong>,</p>
        <p>Le informamos que su gasto común del período <strong>{mes}/{anio}</strong> ya está disponible.</p>
        <div style="background:white;border-radius:12px;padding:20px;margin:20px 0;border-left:4px solid #667eea">
          <h2 style="color:#667eea;margin:0">Monto Total: ${monto:,.0f} CLP</h2>
          <p style="color:#666;margin:8px 0 0">Vencimiento: {vencimiento}</p>
        </div>
        <a href="https://conectaai.cl/portal" style="display:inline-block;background:linear-gradient(135deg,#667eea,#764ba2);color:white;padding:14px 30px;border-radius:8px;text-decoration:none;font-weight:bold">Pagar en Línea</a>
      </div>
      <div style="padding:20px;text-align:center;color:#999;font-size:12px">
        ConectaAI Condominios | conectaai.cl
      </div>
    </div>"""
    return await send_email(email, f"Gasto Común {mes}/{anio} - ${monto:,.0f} CLP", html)

async def send_aviso_notificacion(emails: list, titulo: str, contenido: str, tipo: str) -> int:
    icon = {"urgente": "&#128680;", "mantencion": "&#128295;", "informativo": "&#8505;&#65039;"}.get(tipo, "&#128226;")
    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
      <div style="background:linear-gradient(135deg,#667eea,#764ba2);padding:30px;text-align:center">
        <h1 style="color:white;margin:0">{icon} Aviso de su Condominio</h1>
      </div>
      <div style="padding:30px">
        <h2 style="color:#333">{titulo}</h2>
        <p style="color:#555;line-height:1.6">{contenido}</p>
      </div>
      <div style="padding:20px;text-align:center;color:#999;font-size:12px">
        ConectaAI Condominios | conectaai.cl
      </div>
    </div>"""
    sent = 0
    for email in emails:
        if await send_email(email, f"{icon} {titulo}", html):
            sent += 1
    return sent
