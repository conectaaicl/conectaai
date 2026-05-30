from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.database import get_db
from app.core.dependencies import get_current_user
from pydantic import BaseModel
from typing import Optional
import httpx
import asyncio

router = APIRouter(prefix="/api/condominios", tags=["puertas"])


class PuertaCreate(BaseModel):
    nombre: str
    descripcion: Optional[str] = None
    tipo: str = "puerta"
    ubicacion: Optional[str] = None
    webhook_url: Optional[str] = None
    webhook_secret: Optional[str] = None
    tiempo_apertura_seg: int = 5
    condominio_id: Optional[int] = None
    tenant_id: int


class ComandoPuerta(BaseModel):
    accion: str  # abrir, cerrar, libre_paso, bloquear
    usuario_id: Optional[int] = None


async def _trigger_webhook(url: str, secret: Optional[str], accion: str, puerta_nombre: str):
    """Send non-blocking HTTP command to hardware controller."""
    if not url:
        return
    try:
        headers = {"Content-Type": "application/json"}
        if secret:
            headers["X-Webhook-Secret"] = secret
        async with httpx.AsyncClient(timeout=5.0) as c:
            await c.post(url, headers=headers, json={"accion": accion, "puerta": puerta_nombre})
    except Exception:
        pass  # Hardware offline does not block the UI


@router.get("/puertas")
def listar_puertas(condominio_id: Optional[int] = None, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    tenant_id = current_user["tenant_id"]
    sql = "SELECT id, nombre, descripcion, tipo, ubicacion, activa, estado, modo, webhook_url, tiempo_apertura_seg, created_at FROM puertas WHERE tenant_id = :tid"
    params = {"tid": tenant_id}
    if condominio_id:
        sql += " AND condominio_id = :cid"
        params["cid"] = condominio_id
    sql += " ORDER BY nombre"
    rows = db.execute(text(sql), params).fetchall()
    return [dict(r._mapping) for r in rows]


@router.post("/puertas")
def crear_puerta(data: PuertaCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    row = db.execute(text("""
        INSERT INTO puertas (tenant_id, condominio_id, nombre, descripcion, tipo, ubicacion,
                             webhook_url, webhook_secret, tiempo_apertura_seg)
        VALUES (:tid, :cid, :nom, :desc, :tipo, :ubic, :wurl, :wsec, :tseg)
        RETURNING id, nombre, estado, modo, activa
    """), {
        "tid": data.tenant_id, "cid": data.condominio_id, "nom": data.nombre,
        "desc": data.descripcion, "tipo": data.tipo, "ubic": data.ubicacion,
        "wurl": data.webhook_url, "wsec": data.webhook_secret, "tseg": data.tiempo_apertura_seg,
    }).fetchone()
    db.commit()
    return dict(row._mapping)


@router.patch("/puertas/{puerta_id}")
def actualizar_puerta(puerta_id: int, data: dict, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    allowed = {"nombre", "descripcion", "tipo", "ubicacion", "activa", "modo", "webhook_url", "webhook_secret", "tiempo_apertura_seg"}
    updates = {k: v for k, v in data.items() if k in allowed}
    if not updates:
        raise HTTPException(status_code=400, detail="Nada que actualizar")
    sets = ", ".join(f"{k} = :{k}" for k in updates)
    updates["pid"] = puerta_id
    db.execute(text(f"UPDATE puertas SET {sets}, updated_at = NOW() WHERE id = :pid"), updates)
    db.commit()
    return {"success": True}


@router.delete("/puertas/{puerta_id}")
def eliminar_puerta(puerta_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    db.execute(text("DELETE FROM puertas WHERE id = :id"), {"id": puerta_id})
    db.commit()
    return {"success": True}


@router.post("/puertas/{puerta_id}/comando")
async def comando_puerta(puerta_id: int, cmd: ComandoPuerta, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    row = db.execute(
        text("SELECT id, nombre, webhook_url, webhook_secret, activa, modo, tiempo_apertura_seg FROM puertas WHERE id = :id"),
        {"id": puerta_id}
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Puerta no encontrada")

    puerta_id_, nombre, webhook_url, webhook_secret, activa, modo, tseg = row

    if not activa:
        raise HTTPException(status_code=400, detail="Puerta desactivada")
    if modo == "bloqueada" and cmd.accion == "abrir":
        raise HTTPException(status_code=400, detail="Puerta en modo bloqueado")

    # Map accion to state
    nuevo_estado = "abierta" if cmd.accion in ("abrir", "libre_paso") else "cerrada"
    nuevo_modo = "libre_paso" if cmd.accion == "libre_paso" else ("bloqueada" if cmd.accion == "bloquear" else "normal")

    db.execute(text("UPDATE puertas SET estado = :e, modo = :m, updated_at = NOW() WHERE id = :id"),
               {"e": nuevo_estado, "m": nuevo_modo, "id": puerta_id})

    # Log
    db.execute(text("""
        INSERT INTO registros_acceso_puertas (puerta_id, tenant_id, tipo_evento, metodo, usuario_id, exitoso)
        SELECT :pid, tenant_id, :evento, 'manual', :uid, true FROM puertas WHERE id = :pid
    """), {"pid": puerta_id, "evento": cmd.accion, "uid": cmd.usuario_id})
    db.commit()

    # Trigger hardware webhook (non-blocking)
    asyncio.create_task(_trigger_webhook(webhook_url, webhook_secret, cmd.accion, nombre))

    return {"success": True, "estado": nuevo_estado, "modo": nuevo_modo, "puerta": nombre}


@router.get("/puertas/{puerta_id}/registro")
def registro_puerta(puerta_id: int, limit: int = 50, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    rows = db.execute(text("""
        SELECT r.id, r.tipo_evento, r.metodo, r.uid_tarjeta, r.descripcion, r.exitoso, r.created_at,
               u.nombre_completo as usuario
        FROM registros_acceso_puertas r
        LEFT JOIN usuarios u ON u.id = r.usuario_id
        WHERE r.puerta_id = :pid
        ORDER BY r.created_at DESC LIMIT :lim
    """), {"pid": puerta_id, "lim": limit}).fetchall()
    return [dict(r._mapping) for r in rows]
