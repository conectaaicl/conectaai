"""
Centro de Comunicacion -- Fase 1.
GET  /api/comunicaciones/dashboard            -> resumen (hoy, por canal, estado de canales)
POST /api/comunicaciones/preview-destinatarios -> cuenta + lista de a quien le llegaria
POST /api/comunicaciones/enviar               -> segmenta + envia + registra
GET  /api/comunicaciones/historial            -> envios pasados (paginado)
"""
import os
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.services.comunicaciones import SegmentoFiltros, ensure_historial_table, enviar_comunicacion, resolver_destinatarios

router = APIRouter(prefix="/api/comunicaciones", tags=["comunicaciones"])


def _require_admin(current_user: dict):
    if current_user.get("rol") not in ("admin", "administrador", "superadmin"):
        raise HTTPException(403, "Solo administradores")


@router.get("/dashboard")
def dashboard(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_id = current_user["tenant_id"]
    ensure_historial_table(db)
    hoy = date.today()

    por_canal = db.execute(text("""
        SELECT canal, count(*) FROM comunicaciones_historial
        WHERE tenant_id=:tid AND creado_en::date = :hoy
        GROUP BY canal
    """), {"tid": tenant_id, "hoy": hoy}).fetchall()

    fallidos_hoy = db.execute(text("""
        SELECT count(*) FROM comunicaciones_historial
        WHERE tenant_id=:tid AND creado_en::date = :hoy AND estado != 'enviado'
    """), {"tid": tenant_id, "hoy": hoy}).fetchone()[0]

    alcanzados_hoy = db.execute(text("""
        SELECT count(DISTINCT persona_id) FROM comunicaciones_historial
        WHERE tenant_id=:tid AND creado_en::date = :hoy AND estado = 'enviado'
    """), {"tid": tenant_id, "hoy": hoy}).fetchone()[0]

    ultimos = db.execute(text("""
        SELECT canal, destinatario_nombre, asunto, estado, creado_en
        FROM comunicaciones_historial WHERE tenant_id=:tid
        ORDER BY creado_en DESC LIMIT 10
    """), {"tid": tenant_id}).fetchall()

    meta_row = db.execute(text("SELECT meta_activo FROM tenants WHERE id=:tid"), {"tid": tenant_id}).fetchone()
    vapid_ok = bool(os.getenv("VAPID_PUBLIC_KEY") and os.getenv("VAPID_PRIVATE_KEY"))

    return {
        "hoy_por_canal": {r[0]: r[1] for r in por_canal},
        "fallidos_hoy": int(fallidos_hoy),
        "residentes_alcanzados_hoy": int(alcanzados_hoy),
        "canales": {
            "whatsapp": {"conectado": bool(meta_row and meta_row[0])},
            "email": {"conectado": True},
            "push": {"conectado": vapid_ok},
            "sms": {"conectado": False},
        },
        "ultimos_envios": [dict(r._mapping) for r in ultimos],
    }


@router.post("/preview-destinatarios")
def preview_destinatarios(filtros: SegmentoFiltros, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_id = current_user["tenant_id"]
    destinatarios = resolver_destinatarios(db, tenant_id, filtros)
    return {"total": len(destinatarios), "destinatarios": destinatarios[:50]}


class EnviarComunicacionBody(BaseModel):
    filtros: SegmentoFiltros
    canal: str
    asunto: str
    contenido: str


@router.post("/enviar")
async def enviar(body: EnviarComunicacionBody, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    _require_admin(current_user)
    tenant_id = current_user["tenant_id"]
    destinatarios = resolver_destinatarios(db, tenant_id, body.filtros)
    if not destinatarios:
        raise HTTPException(400, "No hay destinatarios para esos filtros")

    resultado = await enviar_comunicacion(
        db, tenant_id, destinatarios, body.canal, body.asunto, body.contenido,
        modulo_origen="comunicaciones", evento_origen="manual",
        enviado_por=current_user.get("nombre_completo", "Administracion"),
    )
    return resultado


@router.get("/historial")
def historial(
    limit: int = Query(30, le=100),
    offset: int = Query(0),
    canal: str | None = Query(None),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    tenant_id = current_user["tenant_id"]
    ensure_historial_table(db)
    where = "WHERE tenant_id=:tid"
    params: dict = {"tid": tenant_id, "lim": limit, "off": offset}
    if canal:
        where += " AND canal=:canal"
        params["canal"] = canal

    total = db.execute(text(f"SELECT count(*) FROM comunicaciones_historial {where}"), params).fetchone()[0]
    rows = db.execute(text(f"""
        SELECT id, modulo_origen, evento_origen, canal, destinatario_nombre, destinatario_valor,
               asunto, estado, proveedor, error, enviado_por, creado_en
        FROM comunicaciones_historial {where}
        ORDER BY creado_en DESC LIMIT :lim OFFSET :off
    """), params).fetchall()

    return {"total": int(total), "items": [dict(r._mapping) for r in rows]}
