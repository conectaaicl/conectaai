import os
import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.finanzas import GastoComun
from app.models.residente_portal import ResidentePortal
from app.models.usuario import Usuario
from app.models.condominio import Condominio
from datetime import datetime, date

router = APIRouter(prefix="/api/cron", tags=["cron"])

CRON_SECRET = os.getenv("CRON_SECRET", "cron-conectaai-2026-secret")
MAIL_API_URL = os.getenv("MAIL_API_URL", "http://localhost:3004/api/send")
MAIL_API_KEY = os.getenv("MAIL_API_KEY", "")
APP_URL = os.getenv("APP_URL", "https://conectaai.cl")


def _send_email(to: str, subject: str, html: str, text: str = "") -> bool:
    try:
        resp = httpx.post(
            MAIL_API_URL,
            json={"to": to, "subject": subject, "html": html, "text": text or subject},
            headers={"Authorization": "Bearer " + MAIL_API_KEY},
            timeout=10,
        )
        return resp.status_code < 300
    except Exception:
        return False


@router.get("/gastos-vencidos")
async def notificar_gastos_vencidos(secret: str, db: Session = Depends(get_db)):
    """Called by cron job. Sends email to residents with overdue gastos."""
    if not CRON_SECRET or secret != CRON_SECRET:
        raise HTTPException(403, "No autorizado")

    hoy = date.today()
    gastos_vencidos = db.query(GastoComun).filter(
        GastoComun.estado.in_(["pendiente", "atrasado"]),
        GastoComun.fecha_vencimiento < datetime.combine(hoy, datetime.min.time()),
        GastoComun.departamento_id.isnot(None),
    ).all()

    notificados = 0
    errors = 0

    for gasto in gastos_vencidos:
        if gasto.estado == "pendiente":
            gasto.estado = "atrasado"

        residente = db.query(ResidentePortal).filter(
            ResidentePortal.departamento_id == gasto.departamento_id,
            ResidentePortal.activo == True,
        ).first()

        if not residente or not residente.email:
            continue

        periodo = (
            str(gasto.anio) + "-" + str(gasto.mes).zfill(2)
            if gasto.mes and gasto.anio else "-"
        )
        monto_fmt = "$ {:,}".format(int(gasto.monto_total or 0)).replace(",", ".")
        venc_str = (
            gasto.fecha_vencimiento.strftime("%d/%m/%Y")
            if gasto.fecha_vencimiento else "-"
        )

        html = (
            '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">'
            '<div style="background:#5b3ef5;padding:20px;border-radius:8px 8px 0 0;">'
            '<h1 style="color:white;margin:0;font-size:22px;">ConectaAI Condominios</h1>'
            '</div>'
            '<div style="background:#fff;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">'
            '<h2 style="color:#1e1b4b;">Gasto Comun Vencido</h2>'
            '<p>Estimado/a <strong>' + residente.nombre_completo + '</strong>,</p>'
            '<p>Le informamos que tiene un gasto comun <strong style="color:#dc2626;">VENCIDO</strong>:</p>'
            '<table style="width:100%;border-collapse:collapse;margin:16px 0;">'
            '<tr style="background:#f3f4f6;">'
            '<td style="padding:8px;font-weight:bold;">Periodo</td>'
            '<td style="padding:8px;">' + periodo + '</td>'
            '</tr>'
            '<tr>'
            '<td style="padding:8px;font-weight:bold;">Descripcion</td>'
            '<td style="padding:8px;">' + (gasto.descripcion or "Gasto Comun") + '</td>'
            '</tr>'
            '<tr style="background:#f3f4f6;">'
            '<td style="padding:8px;font-weight:bold;">Vencimiento</td>'
            '<td style="padding:8px;color:#dc2626;">' + venc_str + '</td>'
            '</tr>'
            '<tr>'
            '<td style="padding:8px;font-weight:bold;">Monto</td>'
            '<td style="padding:8px;font-size:18px;font-weight:bold;color:#5b3ef5;">' + monto_fmt + '</td>'
            '</tr>'
            '</table>'
            '<p>Por favor, regularice su situacion a la brevedad para evitar multas adicionales.</p>'
            '<a href="' + APP_URL + '/portal" style="background:#5b3ef5;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin-top:8px;">'
            'Ver mi portal de residentes'
            '</a>'
            '<p style="color:#6b7280;font-size:12px;margin-top:24px;">ConectaAI - Sistema de Gestion de Condominios</p>'
            '</div></div>'
        )
        ok = _send_email(
            to=residente.email,
            subject="Gasto Comun Vencido - Periodo " + periodo + " - " + monto_fmt,
            html=html,
            text=(
                "Estimado/a " + residente.nombre_completo
                + ", tiene un gasto comun vencido del periodo " + periodo
                + " por " + monto_fmt + ". Ingrese a " + APP_URL + "/portal para regularizar."
            ),
        )
        if ok:
            notificados += 1
        else:
            errors += 1

    try:
        db.commit()
    except Exception:
        db.rollback()

    # Push notification broadcast cuando hay gastos vencidos
    if notificados > 0:
        try:
            import json, os
            from pywebpush import webpush
            vapid_priv = os.getenv("VAPID_PRIVATE_KEY", "")
            vapid_email = os.getenv("VAPID_EMAIL", "mailto:admin@conectaai.cl")
            if vapid_priv:
                subs = db.execute(
                    __import__("sqlalchemy").text("SELECT endpoint, p256dh, auth, tenant_id FROM push_subscriptions"),
                    {}
                ).fetchall()
                payload = json.dumps({"titulo": "⚠️ Gastos comunes pendientes", "mensaje": f"Tienes gastos comunes por pagar. Revisa tu cuenta en el portal.", "url": "/portal/cuenta"}, ensure_ascii=False)
                for s in subs:
                    try:
                        m = s._mapping
                        webpush(subscription_info={"endpoint": m["endpoint"], "keys": {"p256dh": m["p256dh"], "auth": m["auth"]}}, data=payload, vapid_private_key=vapid_priv, vapid_claims={"sub": vapid_email})
                    except Exception:
                        pass
        except Exception:
            pass
    return {"notificados": notificados, "errors": errors, "gastos_procesados": len(gastos_vencidos)}


@router.get("/resumen-mensual")
async def enviar_resumen_mensual(secret: str, db: Session = Depends(get_db)):
    """Send monthly summary to all active tenant admin users."""
    if not CRON_SECRET or secret != CRON_SECRET:
        raise HTTPException(403, "No autorizado")

    hoy = datetime.utcnow()
    mes_actual = str(hoy.year) + "-" + str(hoy.month).zfill(2)

    admins = db.query(Usuario).filter(
        Usuario.activo == True,
        Usuario.rol.in_(["admin", "superadmin"]),
    ).all()

    enviados = 0

    for admin in admins:
        if not admin.email:
            continue

        condominios_count = db.query(Condominio).filter(
            Condominio.tenant_id == admin.tenant_id
        ).count()

        gastos_pendientes = db.query(GastoComun).filter(
            GastoComun.estado.in_(["pendiente", "atrasado"]),
        ).count()

        gastos_atrasados = db.query(GastoComun).filter(
            GastoComun.estado == "atrasado",
        ).count()

        residentes_activos = db.query(ResidentePortal).filter(
            ResidentePortal.tenant_id == admin.tenant_id,
            ResidentePortal.activo == True,
        ).count()

        html = (
            '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">'
            '<div style="background:#5b3ef5;padding:20px;border-radius:8px 8px 0 0;">'
            '<h1 style="color:white;margin:0;font-size:22px;">ConectaAI Condominios</h1>'
            '<p style="color:#ede9fe;margin:4px 0 0 0;">Resumen Mensual - ' + mes_actual + '</p>'
            '</div>'
            '<div style="background:#fff;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">'
            '<h2 style="color:#1e1b4b;">Hola, ' + admin.nombre_completo + '</h2>'
            '<p>Aqui esta el resumen de actividad de su(s) condominio(s) para el mes de <strong>' + mes_actual + '</strong>:</p>'
            '<table style="width:100%;border-collapse:collapse;margin:16px 0;">'
            '<tr style="background:#5b3ef5;color:white;">'
            '<th style="padding:10px;text-align:left;">Indicador</th>'
            '<th style="padding:10px;text-align:right;">Valor</th>'
            '</tr>'
            '<tr style="background:#f3f4f6;">'
            '<td style="padding:8px;">Condominios administrados</td>'
            '<td style="padding:8px;text-align:right;font-weight:bold;">' + str(condominios_count) + '</td>'
            '</tr>'
            '<tr>'
            '<td style="padding:8px;">Residentes activos</td>'
            '<td style="padding:8px;text-align:right;font-weight:bold;">' + str(residentes_activos) + '</td>'
            '</tr>'
            '<tr style="background:#f3f4f6;">'
            '<td style="padding:8px;">Gastos comunes pendientes</td>'
            '<td style="padding:8px;text-align:right;font-weight:bold;color:#d97706;">' + str(gastos_pendientes) + '</td>'
            '</tr>'
            '<tr>'
            '<td style="padding:8px;">Gastos comunes atrasados</td>'
            '<td style="padding:8px;text-align:right;font-weight:bold;color:#dc2626;">' + str(gastos_atrasados) + '</td>'
            '</tr>'
            '</table>'
            '<a href="' + APP_URL + '/condominios" style="background:#5b3ef5;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin-top:8px;">'
            'Ver panel de administracion'
            '</a>'
            '<p style="color:#6b7280;font-size:12px;margin-top:24px;">ConectaAI - Sistema de Gestion de Condominios</p>'
            '</div></div>'
        )
        ok = _send_email(
            to=admin.email,
            subject="Resumen Mensual ConectaAI Condominios - " + mes_actual,
            html=html,
            text=(
                "Resumen " + mes_actual + ": "
                + str(condominios_count) + " condominios, "
                + str(residentes_activos) + " residentes, "
                + str(gastos_pendientes) + " gastos pendientes."
            ),
        )
        if ok:
            enviados += 1

    return {"enviados": enviados, "total_admins": len(admins)}
