from fastapi import APIRouter, Depends, HTTPException, Request, Header
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
    tenant_id = current_user["tenant_id"]  # FLUJO-04: siempre del JWT, nunca del body
    row = db.execute(text("""
        INSERT INTO puertas (tenant_id, condominio_id, nombre, descripcion, tipo, ubicacion,
                             webhook_url, webhook_secret, tiempo_apertura_seg)
        VALUES (:tid, :cid, :nom, :desc, :tipo, :ubic, :wurl, :wsec, :tseg)
        RETURNING id, nombre, estado, modo, activa
    """), {
        "tid": tenant_id, "cid": data.condominio_id, "nom": data.nombre,
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
    updates["tid"] = current_user["tenant_id"]  # CRIT-06: filtrar por tenant
    db.execute(text(f"UPDATE puertas SET {sets}, updated_at = NOW() WHERE id = :pid AND tenant_id = :tid"), updates)
    db.commit()
    return {"success": True}


@router.delete("/puertas/{puerta_id}")
def eliminar_puerta(puerta_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    db.execute(text("DELETE FROM puertas WHERE id = :id AND tenant_id = :tid"), {"id": puerta_id, "tid": current_user["tenant_id"]})  # CRIT-06
    db.commit()
    return {"success": True}


@router.post("/puertas/{puerta_id}/comando")
async def comando_puerta(puerta_id: int, cmd: ComandoPuerta, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    row = db.execute(
        text("SELECT id, tenant_id, nombre, webhook_url, webhook_secret, activa, modo, tiempo_apertura_seg FROM puertas WHERE id = :id"),
        {"id": puerta_id}
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Puerta no encontrada")

    puerta_id_, row_tenant_id, nombre, webhook_url, webhook_secret, activa, modo, tseg = row
    if row_tenant_id != current_user["tenant_id"]:  # CRIT-06: verificar ownership
        raise HTTPException(status_code=403, detail="Sin acceso a esta puerta")

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



# ---------------------------------------------------------------------------
# Eventos que envia el HARDWARE de cada puerta (citofono, controlador, camara ALPR)
# Autenticacion: el secreto de la puerta (webhook_secret) en el header X-Device-Secret
# o en ?secret= (para dispositivos simples). Cada evento queda con el NOMBRE de la puerta,
# asi conserjeria sabe si tocaron el porton de visitas o la puerta principal.
# ---------------------------------------------------------------------------

class EventoDispositivoIn(BaseModel):
    tipo: str = "timbre"          # timbre | apertura | cierre | acceso | denegado | patente | alarma
    patente: Optional[str] = None
    card_uid: Optional[str] = None
    detalle: Optional[str] = None


def _registrar(db, tenant_id: int, puerta_id: int, tipo_evento: str, metodo: str, descripcion: str, exitoso: bool, uid: Optional[str] = None):
    row = db.execute(text(
        "INSERT INTO registros_acceso_puertas (puerta_id, tenant_id, tipo_evento, metodo, uid_tarjeta, descripcion, exitoso) "
        "VALUES (:p, :t, :te, :m, :u, :d, :e) RETURNING id, created_at"
    ), {"p": puerta_id, "t": tenant_id, "te": tipo_evento, "m": metodo, "u": uid, "d": descripcion[:250], "e": exitoso}).fetchone()
    return row


def _flag_activo(db, tenant_id: int, key: str) -> bool:
    row = db.execute(text("SELECT activo FROM tenant_features WHERE tenant_id=:t AND feature_key=:k"), {"t": tenant_id, "k": key}).fetchone()
    return bool(row and row[0])


def _publicar(tenant_id: int, data: dict):
    try:
        from app.routers.sistema import _publish_evento
        _publish_evento(tenant_id, data)
    except Exception:
        pass


@router.get("/puertas/{puerta_id}/evento")
@router.post("/puertas/{puerta_id}/evento")
async def evento_dispositivo(
    puerta_id: int, request: Request,
    body: Optional[EventoDispositivoIn] = None,
    tipo: Optional[str] = None, patente: Optional[str] = None, secret: Optional[str] = None,
    x_device_secret: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    row = db.execute(text("SELECT id, tenant_id, nombre, ubicacion, webhook_url, webhook_secret, activa FROM puertas WHERE id=:id"), {"id": puerta_id}).fetchone()
    if not row:
        raise HTTPException(404, "Puerta no encontrada")
    pid, tenant_id, nombre, ubicacion, webhook_url, webhook_secret, activa = row
    provided = x_device_secret or secret
    if not webhook_secret or not provided or provided != webhook_secret:
        raise HTTPException(401, "Secreto de dispositivo inválido")
    if not activa:
        raise HTTPException(400, "Puerta inactiva")

    ev_tipo = (body.tipo if body else tipo) or "timbre"
    ev_pat = (body.patente if body else patente) or ""
    detalle = (body.detalle if body else None) or ""
    resultado = {"puerta": nombre, "puerta_id": pid, "tipo": ev_tipo}

    if ev_tipo == "timbre":
        r = _registrar(db, tenant_id, pid, "timbre", "citofono", f"🔔 Tocaron el timbre en {nombre}", True)
        resultado.update({"accion": "aviso_conserjeria"})
    elif ev_tipo in ("tag", "nfc"):
        # TAG UHF en el parabrisas (lector ZKTeco UHF u otro) o llavero/tarjeta NFC: llega el UID leido
        from app.routers.vehiculos import norm_tag, _ensure as _ensure_veh
        _ensure_veh(db)
        uid = norm_tag((body.card_uid if body else None) or request.query_params.get("card_uid") or request.query_params.get("uid") or "")
        if not _flag_activo(db, tenant_id, "tag_vehicular"):
            r = _registrar(db, tenant_id, pid, "denegado_tag", ev_tipo, f"⛔ TAG {uid or '?'} — módulo TAG vehicular no activo", False, uid or None)
            resultado.update({"accion": "denegar", "autorizado": False, "motivo": "modulo no activo"})
        else:
            veh = db.execute(text("SELECT id, depto_numero, persona_nombre, estado, patente FROM vehiculos WHERE tenant_id=:t AND tag_uid=:g"), {"t": tenant_id, "g": uid}).fetchone() if uid else None
            if veh and veh[3] == "aprobado":
                desc = f"🏷️ TAG {uid} · {veh[4]} · Depto {veh[1] or '-'} · {veh[2] or ''} — portón abierto"
                r = _registrar(db, tenant_id, pid, "acceso_tag", ev_tipo, desc, True, uid)
                db.execute(text("UPDATE puertas SET estado='abierta', updated_at=NOW() WHERE id=:id"), {"id": pid})
                asyncio.create_task(_trigger_webhook(webhook_url, webhook_secret, "abrir", nombre))
                resultado.update({"accion": "abrir", "autorizado": True, "depto": veh[1], "persona": veh[2], "patente": veh[4]})
            else:
                motivo = "TAG bloqueado" if veh and veh[3] == "bloqueado" else "pendiente de aprobación" if veh else "TAG no asignado"
                r = _registrar(db, tenant_id, pid, "denegado_tag", ev_tipo, f"⛔ TAG {uid or '?'} — {motivo}", False, uid or None)
                resultado.update({"accion": "denegar", "autorizado": False, "motivo": motivo, "uid": uid})
    elif ev_tipo == "patente":
        from app.routers.vehiculos import norm_patente, _ensure as _ensure_veh
        _ensure_veh(db)
        pat = norm_patente(ev_pat)
        if not _flag_activo(db, tenant_id, "lector_patentes"):
            r = _registrar(db, tenant_id, pid, "denegado_patente", "patente", f"⛔ {pat or '?'} — módulo lector de patentes no activo", False, pat)
            db.commit(); resultado.update({"accion": "denegar", "autorizado": False, "motivo": "modulo no activo"}); resultado["registro_id"] = r[0]
            return resultado
        veh = db.execute(text("SELECT id, depto_numero, persona_nombre, estado, tipo FROM vehiculos WHERE tenant_id=:t AND patente=:p"), {"t": tenant_id, "p": pat}).fetchone()
        if veh and veh[3] == "aprobado":
            desc = f"🚗 {pat} · Depto {veh[1] or '-'} · {veh[2] or ''} — portón abierto"
            r = _registrar(db, tenant_id, pid, "acceso_patente", "patente", desc, True, pat)
            db.execute(text("UPDATE puertas SET estado='abierta', updated_at=NOW() WHERE id=:id"), {"id": pid})
            asyncio.create_task(_trigger_webhook(webhook_url, webhook_secret, "abrir", nombre))
            resultado.update({"accion": "abrir", "autorizado": True, "depto": veh[1], "persona": veh[2]})
        else:
            motivo = "patente bloqueada" if veh and veh[3] == "bloqueado" else "pendiente de aprobación" if veh else "patente no registrada"
            r = _registrar(db, tenant_id, pid, "denegado_patente", "patente", f"⛔ {pat or '?'} — {motivo}", False, pat)
            resultado.update({"accion": "denegar", "autorizado": False, "motivo": motivo})
    elif ev_tipo in ("apertura", "cierre"):
        db.execute(text("UPDATE puertas SET estado=:e, updated_at=NOW() WHERE id=:id"), {"e": "abierta" if ev_tipo == "apertura" else "cerrada", "id": pid})
        r = _registrar(db, tenant_id, pid, ev_tipo, "sensor", f"{nombre}: {'abierta' if ev_tipo == 'apertura' else 'cerrada'} {detalle}".strip(), True)
    elif ev_tipo == "alarma":
        r = _registrar(db, tenant_id, pid, "alarma", "sensor", f"🚨 Alarma en {nombre} {detalle}".strip(), False)
    else:
        r = _registrar(db, tenant_id, pid, ev_tipo, "dispositivo", f"{nombre}: {detalle or ev_tipo}", ev_tipo != "denegado", (body.card_uid if body else None))
    db.commit()
    resultado["registro_id"] = r[0]
    _publicar(tenant_id, {"fuente": "puerta", "tipo": ev_tipo, "puerta": nombre, "puerta_id": pid, "detalle": detalle or ev_pat, "ts": str(r[1])})
    return resultado


@router.post("/puertas/{puerta_id}/generar-secreto")
def generar_secreto(puerta_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Crea/rota el secreto que el dispositivo de esta puerta usa para reportar eventos."""
    import secrets as _s
    sec = _s.token_urlsafe(18)
    res = db.execute(text("UPDATE puertas SET webhook_secret=:s, updated_at=NOW() WHERE id=:id AND tenant_id=:t"), {"s": sec, "id": puerta_id, "t": current_user["tenant_id"]})
    db.commit()
    if res.rowcount == 0:
        raise HTTPException(404, "Puerta no encontrada")
    return {"ok": True, "secret": sec}
