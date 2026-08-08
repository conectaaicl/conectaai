"""
Centro de Comunicacion -- motor generico de segmentacion y envio.

Disenado para funcionar igual en cualquier tipo de tenant (condominio,
gimnasio, bodega, pyme, cowork): "personas" es la unica fuente de verdad
de destinatarios (ya es donde vive RFID/facial/reservas/consentimiento).
Los filtros de torre/departamento son OPCIONALES -- si el tenant no tiene
esa estructura (un gimnasio no tiene "departamentos"), simplemente no se
usan y la segmentacion sigue funcionando por rol/estado.

No reinventa canales que ya funcionan: email reusa app.services.email.send_email
(el mismo que ya usan gastos/avisos), push via pywebpush (misma logica que
push_notifications.py, consolidada aqui en vez de reimplementada de nuevo),
whatsapp via whatsapp_meta.py (dormido hasta que Meta apruebe), sms como
stub explicito. El audit trail de alto nivel reusa historial_service.log_evento;
el detalle por destinatario (canal, estado, proveedor, error) vive en una
tabla nueva porque historial_eventos no tiene esas columnas.
"""
import json
import os
from typing import Optional

from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.services.email import send_email
from app.services.historial_service import log_evento

VAPID_PRIVATE = os.getenv("VAPID_PRIVATE_KEY", "")
VAPID_PUBLIC = os.getenv("VAPID_PUBLIC_KEY", "")
VAPID_EMAIL = os.getenv("VAPID_EMAIL", "mailto:admin@conectaai.cl")


def ensure_historial_table(db: Session):
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS comunicaciones_historial (
            id SERIAL PRIMARY KEY,
            tenant_id INTEGER NOT NULL,
            modulo_origen VARCHAR(80) NOT NULL,
            evento_origen VARCHAR(80) NOT NULL,
            canal VARCHAR(30) NOT NULL,
            persona_id INTEGER,
            destinatario_nombre VARCHAR(255),
            destinatario_valor VARCHAR(255),
            asunto VARCHAR(255),
            contenido TEXT,
            estado VARCHAR(30) DEFAULT 'enviado',
            proveedor VARCHAR(50),
            proveedor_id VARCHAR(150),
            error TEXT,
            enviado_por VARCHAR(150),
            creado_en TIMESTAMPTZ DEFAULT now()
        )
    """))
    db.execute(text("CREATE INDEX IF NOT EXISTS idx_comh_tenant ON comunicaciones_historial(tenant_id)"))
    db.execute(text("CREATE INDEX IF NOT EXISTS idx_comh_persona ON comunicaciones_historial(persona_id)"))
    db.commit()


class SegmentoFiltros(BaseModel):
    roles: Optional[list[str]] = None          # ej ["residente","propietario"] -- vacio = todos los roles
    condominio_id: Optional[int] = None         # opcional: solo aplica si el tenant tiene condominios/torres
    torre_id: Optional[int] = None
    departamento_ids: Optional[list[int]] = None
    persona_ids: Optional[list[int]] = None     # "usuarios especificos"
    solo_activos: bool = True


def resolver_destinatarios(db: Session, tenant_id: int, filtros: SegmentoFiltros) -> list[dict]:
    """
    Devuelve personas del tenant que matchean los filtros. Los filtros de
    estructura de condominio (torre/departamento) son un JOIN opcional --
    si no se piden, ni siquiera se ejecuta el join, asi que un tenant sin
    esa estructura (gimnasio, bodega) no se ve afectado en absoluto.
    """
    where = ["p.tenant_id = :tid"]
    params: dict = {"tid": tenant_id}

    if filtros.solo_activos:
        where.append("p.estado = 'activo'")

    if filtros.persona_ids:
        where.append("p.id = ANY(:pids)")
        params["pids"] = filtros.persona_ids

    if filtros.roles:
        where.append("p.roles ?| :roles")
        params["roles"] = filtros.roles

    join = ""
    if filtros.condominio_id or filtros.torre_id or filtros.departamento_ids:
        join = """
            JOIN departamentos d ON d.propietario_id = p.id OR d.residente_id = p.id
            JOIN pisos pi ON pi.id = d.piso_id
            JOIN torres t ON t.id = pi.torre_id
        """
        if filtros.condominio_id:
            where.append("t.condominio_id = :cid")
            params["cid"] = filtros.condominio_id
        if filtros.torre_id:
            where.append("t.id = :tor")
            params["tor"] = filtros.torre_id
        if filtros.departamento_ids:
            where.append("d.id = ANY(:dids)")
            params["dids"] = filtros.departamento_ids

    sql = f"""
        SELECT DISTINCT p.id, p.nombre_completo, p.email, p.telefono,
               p.whatsapp_opt_in, p.canal_preferido
        FROM personas p
        {join}
        WHERE {' AND '.join(where)}
        ORDER BY p.nombre_completo
    """
    rows = db.execute(text(sql), params).fetchall()
    return [dict(r._mapping) for r in rows]


async def _enviar_email(destinatario: dict, asunto: str, contenido_html: str) -> tuple[str, Optional[str]]:
    if not destinatario.get("email"):
        return "error", "Sin email registrado"
    ok = await send_email(destinatario["email"], asunto, contenido_html)
    return ("enviado", None) if ok else ("error", "mail.conectaai.cl no pudo enviar el correo")


def _enviar_push(db: Session, persona_id: Optional[int], asunto: str, mensaje: str, url: str) -> tuple[str, Optional[str]]:
    if not persona_id:
        return "error", "Sin persona_id para buscar suscripcion push"
    if not (VAPID_PRIVATE and VAPID_PUBLIC):
        return "error", "Push no configurado (sin claves VAPID)"
    subs = db.execute(text(
        "SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE persona_id = :pid"
    ), {"pid": persona_id}).fetchall()
    if not subs:
        return "error", "Sin dispositivos suscritos"
    try:
        from pywebpush import webpush
        payload = json.dumps({"titulo": asunto, "mensaje": mensaje, "url": url}, ensure_ascii=False)
        enviados = 0
        for s in subs:
            m = s._mapping
            try:
                webpush(
                    subscription_info={"endpoint": m["endpoint"], "keys": {"p256dh": m["p256dh"], "auth": m["auth"]}},
                    data=payload, vapid_private_key=VAPID_PRIVATE, vapid_claims={"sub": VAPID_EMAIL},
                )
                enviados += 1
            except Exception:
                pass
        return ("enviado", None) if enviados else ("error", "Todas las suscripciones fallaron")
    except Exception as e:
        return "error", str(e)[:200]


async def _enviar_whatsapp(db: Session, tenant_id: int, destinatario: dict, contenido: str) -> tuple[str, Optional[str]]:
    if not destinatario.get("whatsapp_opt_in"):
        return "error", "Persona sin opt-in de WhatsApp"
    if not destinatario.get("telefono"):
        return "error", "Sin telefono registrado"
    try:
        from app.routers.whatsapp_meta import enviar_whatsapp_meta, ConfigError
        try:
            await enviar_whatsapp_meta(db, tenant_id, destinatario["telefono"], contenido)
            return "enviado", None
        except ConfigError as ce:
            return "error", ce.mensaje
    except ConfigError:
        raise
    except Exception as e:
        return "error", str(e)[:200]


async def enviar_comunicacion(
    db: Session,
    tenant_id: int,
    destinatarios: list[dict],
    canal: str,
    asunto: str,
    contenido: str,
    modulo_origen: str,
    evento_origen: str,
    enviado_por: str = "sistema",
    url_destino: str = "/",
) -> dict:
    """
    Envia por el canal indicado a cada destinatario y registra cada intento
    en comunicaciones_historial (una fila por destinatario, para poder
    auditar entrega/lectura individual mas adelante) + un resumen en
    historial_eventos (el audit trail generico que ya usan otros modulos).
    """
    if canal not in ("email", "push", "whatsapp", "sms"):
        raise ValueError(f"Canal desconocido: {canal}")

    ensure_historial_table(db)

    enviados, fallidos = 0, 0
    for d in destinatarios:
        if canal == "sms":
            estado, error, proveedor = "error", "SMS no implementado -- falta elegir proveedor", None
        elif canal == "email":
            estado, error = await _enviar_email(d, asunto, contenido)
            proveedor = "mail.conectaai.cl"
        elif canal == "push":
            estado, error = _enviar_push(db, d.get("id"), asunto, contenido, url_destino)
            proveedor = "webpush"
        elif canal == "whatsapp":
            estado, error = await _enviar_whatsapp(db, tenant_id, d, contenido)
            proveedor = "meta_cloud_api"

        if estado == "enviado":
            enviados += 1
        else:
            fallidos += 1

        db.execute(text("""
            INSERT INTO comunicaciones_historial
            (tenant_id, modulo_origen, evento_origen, canal, persona_id, destinatario_nombre,
             destinatario_valor, asunto, contenido, estado, proveedor, error, enviado_por)
            VALUES (:tid, :mod, :evt, :canal, :pid, :nombre, :valor, :asunto, :contenido, :estado, :prov, :error, :por)
        """), {
            "tid": tenant_id, "mod": modulo_origen, "evt": evento_origen, "canal": canal,
            "pid": d.get("id"), "nombre": d.get("nombre_completo"),
            "valor": d.get("email") if canal == "email" else d.get("telefono"),
            "asunto": asunto, "contenido": contenido, "estado": estado,
            "prov": proveedor, "error": error, "por": enviado_por,
        })

    db.commit()

    log_evento(
        db, tenant_id, "comunicaciones", "envio",
        f"{modulo_origen}.{evento_origen}: {canal} a {len(destinatarios)} destinatarios ({enviados} ok, {fallidos} fallidos)",
        usuario_nombre=enviado_por,
        metadata={"canal": canal, "modulo_origen": modulo_origen, "evento_origen": evento_origen,
                  "asunto": asunto, "total": len(destinatarios), "enviados": enviados, "fallidos": fallidos},
    )

    return {"total": len(destinatarios), "enviados": enviados, "fallidos": fallidos}
