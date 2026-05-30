from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models import GastoComun, Persona
from datetime import datetime
import httpx, os, asyncio

router = APIRouter(prefix="/api/condominios", tags=["recordatorios"])
MAIL_API = "http://localhost:3004/api/send"
MAIL_KEY = os.getenv("MAIL_API_KEY", "")

async def send_mail(to: str, subject: str, html: str):
    try:
        async with httpx.AsyncClient(timeout=5) as c:
            await c.post(MAIL_API, headers={"Authorization": "Bearer " + MAIL_KEY},
                json={"to": to, "subject": subject, "html": html, "text": ""})
    except Exception:
        pass

@router.post("/recordatorios/procesar")
async def procesar_recordatorios(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_id = current_user["tenant_id"]
    hoy = datetime.utcnow().date()
    enviados = 0
    gastos = db.query(GastoComun).filter(GastoComun.estado == "pendiente").all()
    for gasto in gastos:
        if not gasto.fecha_vencimiento:
            continue
        venc = gasto.fecha_vencimiento
        if hasattr(venc, "date"):
            venc = venc.date()
        dias_diff = (venc - hoy).days
        subject = None
        tipo = None
        if dias_diff == 3:
            subject = "Recordatorio: Gastos comunes vencen en 3 dias"
            tipo = "previo"
        elif dias_diff == 0:
            subject = "Aviso: Gastos comunes vencen hoy"
            tipo = "vencimiento"
        elif dias_diff == -3:
            subject = "Aviso de mora: Gastos comunes vencidos"
            tipo = "mora"
        if not subject:
            continue
        personas = db.query(Persona).filter(Persona.tenant_id == tenant_id, Persona.estado == "activo").all()
        for persona in personas:
            if not persona.email:
                continue
            monto_fmt = "{:,.0f}".format(gasto.monto_total).replace(",", ".")
            periodo = str(gasto.mes) + "/" + str(gasto.anio)
            cuando = "vence en 3 dias" if tipo == "previo" else "vence hoy" if tipo == "vencimiento" else "esta vencido"
            html = "<p>Estimado/a " + persona.nombre_completo + ",</p><p>Gastos comunes <strong>" + periodo + "</strong> por <strong>" + monto_fmt + "</strong> " + cuando + ".</p><p>Por favor realice su pago a la brevedad.</p>"
            asyncio.create_task(send_mail(persona.email, subject, html))
            enviados += 1
    return {"ok": True, "recordatorios_enviados": enviados, "gastos_procesados": len(gastos)}

@router.get("/recordatorios/estado")
def get_estado(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_id = current_user["tenant_id"]
    hoy = datetime.utcnow().date()
    pendientes = db.query(GastoComun).filter(GastoComun.estado == "pendiente").count()
    vencidos = db.query(GastoComun).filter(GastoComun.estado == "pendiente", GastoComun.fecha_vencimiento < datetime.utcnow()).count()
    return {"pendientes": pendientes, "vencidos": vencidos, "fecha": hoy.isoformat(), "tenant_id": tenant_id}
