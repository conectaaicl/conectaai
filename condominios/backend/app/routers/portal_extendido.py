"""
Portal Residente Extendido:
- GET/POST /api/portal/mis-incidencias
- GET      /api/portal/documentos
- GET/POST /api/portal/mensajes
- POST     /api/portal/mensajes/{id}/responder (admin)
- GET      /api/portal/mensajes/admin/todos    (admin)
- GET      /api/portal/historial-pagos
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional
from pydantic import BaseModel
from app.core.database import get_db
from app.routers.portal_auth import get_residente
from app.routers.auth import get_current_user
from app.models import ResidentePortal

router = APIRouter(prefix="/api/portal", tags=["Portal Extendido"])


def _init(db: Session):
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS mensajes_portal (
            id SERIAL PRIMARY KEY,
            tenant_id INTEGER NOT NULL,
            residente_id INTEGER,
            depto_numero VARCHAR(20),
            condominio_id INTEGER,
            asunto VARCHAR(200) NOT NULL,
            mensaje TEXT NOT NULL,
            respuesta TEXT,
            respondido_por VARCHAR(200),
            estado VARCHAR(20) DEFAULT 'abierto',
            prioridad VARCHAR(20) DEFAULT 'normal',
            created_at TIMESTAMPTZ DEFAULT NOW(),
            respondido_at TIMESTAMPTZ,
            leido_residente BOOLEAN DEFAULT false
        )
    """))
    db.commit()


def _depto_numero(r: ResidentePortal, db: Session) -> Optional[str]:
    if not r.departamento_id:
        return None
    row = db.execute(
        text("SELECT numero FROM departamentos WHERE id=:did"),
        {"did": r.departamento_id}
    ).fetchone()
    return str(row[0]) if row else None


def _push_admin(tid: int, titulo: str, mensaje: str, url: str, db: Session):
    try:
        import json, os
        from pywebpush import webpush
        vpk = os.getenv("VAPID_PRIVATE_KEY", "")
        vem = os.getenv("VAPID_EMAIL", "mailto:admin@conectaai.cl")
        if not vpk:
            return
        subs = db.execute(
            text("SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE tenant_id=:tid"),
            {"tid": tid}
        ).fetchall()
        payload = json.dumps({"titulo": titulo, "mensaje": mensaje, "url": url}, ensure_ascii=False)
        for s in subs:
            m = s._mapping
            try:
                webpush(
                    subscription_info={"endpoint": m["endpoint"], "keys": {"p256dh": m["p256dh"], "auth": m["auth"]}},
                    data=payload, vapid_private_key=vpk, vapid_claims={"sub": vem}
                )
            except Exception:
                pass
    except Exception:
        pass


def _push_residente(residente_id: int, titulo: str, mensaje: str, url: str, db: Session):
    try:
        import json, os
        from pywebpush import webpush
        vpk = os.getenv("VAPID_PRIVATE_KEY", "")
        vem = os.getenv("VAPID_EMAIL", "mailto:admin@conectaai.cl")
        if not vpk:
            return
        subs = db.execute(
            text("SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE persona_id=:pid"),
            {"pid": residente_id}
        ).fetchall()
        payload = json.dumps({"titulo": titulo, "mensaje": mensaje, "url": url}, ensure_ascii=False)
        for s in subs:
            m = s._mapping
            try:
                webpush(
                    subscription_info={"endpoint": m["endpoint"], "keys": {"p256dh": m["p256dh"], "auth": m["auth"]}},
                    data=payload, vapid_private_key=vpk, vapid_claims={"sub": vem}
                )
            except Exception:
                pass
    except Exception:
        pass


# ─── INCIDENCIAS ─────────────────────────────────────────────────────────────

def _condominio_id_de(r: ResidentePortal, db: Session) -> Optional[int]:
    if r.condominio_id:
        return r.condominio_id
    if not r.departamento_id:
        return None
    row = db.execute(text("""
        SELECT c.id FROM departamentos d
        JOIN pisos p ON p.id = d.piso_id
        JOIN torres t ON t.id = p.torre_id
        JOIN condominios c ON c.id = t.condominio_id
        WHERE d.id = :did
    """), {"did": r.departamento_id}).fetchone()
    return row[0] if row else None


def _numero_depto_de(db: Session, r: ResidentePortal):
    if not r.departamento_id:
        return None
    row = db.execute(text("SELECT numero FROM departamentos WHERE id=:d AND tenant_id=:t"), {"d": r.departamento_id, "t": r.tenant_id}).fetchone()
    return row[0] if row else None


@router.get("/mis-visitas")
def mis_visitas_edificio(r: ResidentePortal = Depends(get_residente), db: Session = Depends(get_db)):
    """Visitas registradas por conserjeria hacia el departamento del residente, con su estado de aprobacion."""
    num = _numero_depto_de(db, r)
    if not num:
        return []
    rows = db.execute(text("""
        SELECT id, nombre_visitante, rut_visitante, motivo, patente, estado, aprobado_por,
               entrada_at::text AS entrada_at, salida_at::text AS salida_at, aprobado_en::text AS aprobado_en,
               registrado_por_nombre, motivo_rechazo
        FROM visitas WHERE tenant_id=:tid AND depto_destino=:num
        ORDER BY entrada_at DESC LIMIT 50
    """), {"tid": r.tenant_id, "num": num}).fetchall()
    return [dict(x._mapping) for x in rows]


@router.get("/mis-paquetes")
def mis_paquetes(r: ResidentePortal = Depends(get_residente), db: Session = Depends(get_db)):
    """Encomiendas recibidas en conserjeria para el departamento del residente."""
    num = _numero_depto_de(db, r)
    if not num:
        return []
    try:
        rows = db.execute(text("""
            SELECT id, carrier, tracking_number, nombre_destinatario, descripcion, estado,
                   recibido_at::text AS recibido_at, entregado_at::text AS entregado_at, registrado_por_nombre
            FROM paqueteria WHERE tenant_id=:tid AND depto_destino=:num
            ORDER BY recibido_at DESC LIMIT 50
        """), {"tid": r.tenant_id, "num": num}).fetchall()
    except Exception:
        db.rollback(); return []
    return [dict(x._mapping) for x in rows]


@router.get("/mis-incidencias")
def mis_incidencias(
    r: ResidentePortal = Depends(get_residente),
    db: Session = Depends(get_db)
):
    params: dict = {"tid": r.tenant_id}
    filters = "WHERE tenant_id=:tid"

    if r.departamento_id:
        filters += " AND departamento_id=:did"
        params["did"] = r.departamento_id

    rows = db.execute(text(f"""
        SELECT id, titulo, categoria AS tipo, prioridad, estado, created_at, fecha_resolucion, descripcion
        FROM incidencias {filters}
        ORDER BY created_at DESC LIMIT 20
    """), params).fetchall()

    return [dict(row._mapping) for row in rows]


class IncidenciaPortalCreate(BaseModel):
    titulo: str
    descripcion: str
    tipo: str = "general"
    prioridad: str = "normal"


@router.post("/mis-incidencias", status_code=201)
def crear_incidencia_portal(
    body: IncidenciaPortalCreate,
    r: ResidentePortal = Depends(get_residente),
    db: Session = Depends(get_db)
):
    depto = _depto_numero(r, db)
    cid = _condominio_id_de(r, db)
    descripcion_completa = body.descripcion + (chr(10)*2) + f'Reportado por {r.nombre_completo} - Depto {depto or "-"} via portal'
    res = db.execute(text("""
        INSERT INTO incidencias
        (tenant_id, condominio_id, departamento_id, titulo, descripcion, categoria, prioridad, estado)
        VALUES (:tid, :cid, :did, :titulo, :desc, :categoria, :prio, 'abierta')
        RETURNING id
    """), {
        "tid": r.tenant_id,
        "cid": cid,
        "did": r.departamento_id,
        "titulo": body.titulo,
        "desc": descripcion_completa,
        "categoria": body.tipo,
        "prio": body.prioridad,
    })
    inc_id = res.fetchone()[0]
    db.commit()

    _push_admin(
        r.tenant_id,
        "Nueva incidencia reportada",
        f"Depto {depto}: {body.titulo}",
        "/dashboard/condominios/incidencias",
        db
    )

    return {"ok": True, "incidencia_id": inc_id}


# ─── RESERVAS ────────────────────────────────────────────────────────────────

@router.get("/reservas/espacios")
def portal_espacios(r: ResidentePortal = Depends(get_residente), db: Session = Depends(get_db)):
    """Espacios comunes disponibles para el condominio del residente."""
    cid = _condominio_id_de(r, db)
    if not cid:
        return []
    rows = db.execute(text("""
        SELECT id, nombre, descripcion, capacidad, precio_hora, requiere_pago,
               horario_inicio, horario_fin
        FROM espacios_comunes
        WHERE condominio_id = :cid AND activo = 'si'
        ORDER BY nombre
    """), {"cid": cid}).fetchall()
    return [dict(row._mapping) for row in rows]


@router.get("/reservas/mis-reservas")
def portal_mis_reservas(r: ResidentePortal = Depends(get_residente), db: Session = Depends(get_db)):
    """Reservas hechas desde el departamento del residente."""
    if not r.departamento_id:
        return []
    rows = db.execute(text("""
        SELECT res.id, ec.nombre AS espacio_nombre,
               res.fecha_inicio::text, res.fecha_fin::text, res.estado, res.notas
        FROM reservas res
        JOIN espacios_comunes ec ON ec.id = res.espacio_id
        WHERE res.departamento_id = :did
        ORDER BY res.fecha_inicio DESC LIMIT 20
    """), {"did": r.departamento_id}).fetchall()
    return [dict(row._mapping) for row in rows]


class ReservaPortalCreate(BaseModel):
    espacio_id: int
    fecha: str          # YYYY-MM-DD
    hora_inicio: str     # HH:MM
    hora_fin: str        # HH:MM
    notas: Optional[str] = None


@router.post("/reservas", status_code=201)
def portal_crear_reserva(
    body: ReservaPortalCreate,
    r: ResidentePortal = Depends(get_residente),
    db: Session = Depends(get_db),
):
    if not r.departamento_id:
        raise HTTPException(400, "Tu cuenta no tiene un departamento asignado")

    cid = _condominio_id_de(r, db)
    espacio = db.execute(text(
        "SELECT id FROM espacios_comunes WHERE id=:eid AND activo='si' AND condominio_id=:cid"
    ), {"eid": body.espacio_id, "cid": cid}).fetchone()
    if not espacio:
        raise HTTPException(404, "Espacio no encontrado")

    fecha_inicio_str = f"{body.fecha} {body.hora_inicio}:00"
    fecha_fin_str = f"{body.fecha} {body.hora_fin}:00"
    if fecha_fin_str <= fecha_inicio_str:
        raise HTTPException(400, "La hora de termino debe ser posterior a la de inicio")

    conflicto = db.execute(text("""
        SELECT id FROM reservas
        WHERE espacio_id = :eid AND estado IN ('pendiente', 'confirmada')
          AND fecha_inicio < :fin AND fecha_fin > :inicio
    """), {"eid": body.espacio_id, "inicio": fecha_inicio_str, "fin": fecha_fin_str}).fetchone()
    if conflicto:
        raise HTTPException(409, f"Ya existe una reserva #{conflicto[0]} que se cruza con ese horario")

    notas = f"Solicitado por {r.nombre_completo} via portal"
    if body.notas:
        notas += " - " + body.notas

    res = db.execute(text("""
        INSERT INTO reservas (espacio_id, departamento_id, fecha_inicio, fecha_fin, estado, notas)
        VALUES (:eid, :did, :inicio, :fin, 'pendiente', :notas)
        RETURNING id
    """), {
        "eid": body.espacio_id, "did": r.departamento_id,
        "inicio": fecha_inicio_str, "fin": fecha_fin_str, "notas": notas,
    })
    reserva_id = res.fetchone()[0]
    db.commit()

    depto = _depto_numero(r, db)
    _push_admin(
        r.tenant_id,
        "Nueva solicitud de reserva",
        f"Depto {depto}: {r.nombre_completo} solicito una reserva",
        "/dashboard/condominios/reservas",
        db
    )

    return {"ok": True, "reserva_id": reserva_id, "estado": "pendiente"}


# ─── DOCUMENTOS ──────────────────────────────────────────────────────────────

@router.get("/documentos")
def documentos_portal(
    r: ResidentePortal = Depends(get_residente),
    db: Session = Depends(get_db)
):
    params: dict = {"tid": r.tenant_id}
    cond = ""
    if r.condominio_id:
        cond = "AND (condominio_id=:cid OR condominio_id IS NULL)"
        params["cid"] = r.condominio_id

    rows = db.execute(text(f"""
        SELECT id, titulo AS nombre, titulo, categoria AS tipo, categoria, descripcion, archivo_url AS url, archivo_url, nombre_archivo, tamano_bytes, creado_en AS created_at
        FROM documentos
        WHERE tenant_id=:tid
          AND (visible_residentes=true OR visible_residentes IS NULL)
          {cond}
        ORDER BY creado_en DESC LIMIT 50
    """), params).fetchall()

    return [dict(row._mapping) for row in rows]


# ─── MENSAJES ────────────────────────────────────────────────────────────────

class MensajeCreate(BaseModel):
    asunto: str
    mensaje: str
    prioridad: str = "normal"


@router.get("/mensajes")
def mis_mensajes(
    r: ResidentePortal = Depends(get_residente),
    db: Session = Depends(get_db)
):
    _init(db)
    depto = _depto_numero(r, db)
    params: dict = {"tid": r.tenant_id, "rid": r.id}
    extra = "AND (residente_id=:rid OR depto_numero=:dnum)"
    params["dnum"] = depto or ""

    rows = db.execute(text(f"""
        SELECT id, asunto, mensaje, respuesta, respondido_por, estado,
               prioridad, created_at, respondido_at, leido_residente
        FROM mensajes_portal
        WHERE tenant_id=:tid {extra}
        ORDER BY created_at DESC LIMIT 30
    """), params).fetchall()

    if rows:
        ids = [row._mapping["id"] for row in rows]
        db.execute(text(f"UPDATE mensajes_portal SET leido_residente=true WHERE id = ANY(ARRAY{ids}::int[])"))
        db.commit()

    return [dict(row._mapping) for row in rows]


@router.post("/mensajes", status_code=201)
def crear_mensaje(
    body: MensajeCreate,
    r: ResidentePortal = Depends(get_residente),
    db: Session = Depends(get_db)
):
    _init(db)
    if not body.asunto.strip() or not body.mensaje.strip():
        raise HTTPException(400, "Asunto y mensaje son requeridos")

    depto = _depto_numero(r, db)
    res = db.execute(text("""
        INSERT INTO mensajes_portal
        (tenant_id, residente_id, depto_numero, condominio_id, asunto, mensaje, prioridad)
        VALUES (:tid, :rid, :dnum, :cid, :asunto, :msg, :prio)
        RETURNING id
    """), {
        "tid": r.tenant_id,
        "rid": r.id,
        "dnum": depto,
        "cid": r.condominio_id,
        "asunto": body.asunto,
        "msg": body.mensaje,
        "prio": body.prioridad
    })
    msg_id = res.fetchone()[0]
    db.commit()

    _push_admin(
        r.tenant_id,
        "Nuevo mensaje de residente",
        f"Depto {depto}: {body.asunto}",
        "/dashboard/condominios/mensajes",
        db
    )

    return {"ok": True, "mensaje_id": msg_id}


# ─── RESPONDER (admin) ────────────────────────────────────────────────────────

class RespuestaAdmin(BaseModel):
    respuesta: str
    estado: str = "respondido"


@router.post("/mensajes/{msg_id}/responder")
def responder_mensaje(
    msg_id: int,
    body: RespuestaAdmin,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    _init(db)
    if current_user.get("rol") not in ("admin", "administrador", "superadmin"):
        raise HTTPException(403, "Solo administradores pueden responder")

    tid = current_user["tenant_id"]  # FLUJO-04: siempre del JWT, nunca del body/query
    row = db.execute(
        text("SELECT * FROM mensajes_portal WHERE id=:id AND tenant_id=:tid"), {"id": msg_id, "tid": tid}
    ).fetchone()
    if not row:
        raise HTTPException(404, "Mensaje no encontrado")
    m = dict(row._mapping)

    db.execute(text("""
        UPDATE mensajes_portal
        SET respuesta=:resp, respondido_por=:quien, estado=:estado,
            respondido_at=NOW(), leido_residente=false
        WHERE id=:id AND tenant_id=:tid
    """), {
        "resp": body.respuesta,
        "quien": current_user.get("nombre_completo", "Administración"),
        "estado": body.estado,
        "id": msg_id,
        "tid": tid
    })
    db.commit()

    if m.get("residente_id"):
        _push_residente(
            m["residente_id"],
            "Respuesta de administración",
            f'Re: {m["asunto"]}',
            "/portal/mensajes",
            db
        )

    return {"ok": True}


# ─── TODOS LOS MENSAJES (admin) ───────────────────────────────────────────────

@router.get("/mensajes/admin/todos")
def todos_mensajes_admin(
    estado: Optional[str] = Query(None),
    limit: int = Query(50),
    offset: int = Query(0),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    _init(db)
    if current_user.get("rol") not in ("admin", "administrador", "superadmin"):
        raise HTTPException(403, "Sin permisos")

    tid = current_user["tenant_id"]  # FLUJO-04: siempre del JWT, nunca del query param
    filters = "WHERE tenant_id=:tid"
    params: dict = {"tid": tid}
    if estado:
        filters += " AND estado=:est"
        params["est"] = estado

    total = db.execute(text(f"SELECT COUNT(*) FROM mensajes_portal {filters}"), params).fetchone()[0]
    rows = db.execute(text(f"""
        SELECT id, depto_numero, asunto, mensaje, respuesta, respondido_por,
               estado, prioridad, created_at, respondido_at, leido_residente
        FROM mensajes_portal {filters}
        ORDER BY created_at DESC LIMIT :lim OFFSET :off
    """), {**params, "lim": limit, "off": offset}).fetchall()

    return {"total": int(total), "items": [dict(row._mapping) for row in rows]}


# ─── HISTORIAL DE PAGOS ───────────────────────────────────────────────────────

@router.get("/historial-pagos")
def historial_pagos(
    r: ResidentePortal = Depends(get_residente),
    db: Session = Depends(get_db)
):
    depto = _depto_numero(r, db)
    params: dict = {"tid": r.tenant_id}
    depto_filter = ""
    if depto:
        depto_filter = "AND gc.depto_numero=:dnum"
        params["dnum"] = depto

    rows = db.execute(text(f"""
        SELECT gc.concepto, gc.monto, gc.estado, gc.fecha_pago, gc.metodo_pago,
               gc.comprobante_url, gp.periodo, gc.fecha_vencimiento
        FROM gastos_cobros gc
        JOIN gastos_periodos gp ON gp.id = gc.periodo_id
        WHERE gp.tenant_id=:tid {depto_filter}
        ORDER BY gp.periodo DESC, gc.fecha_vencimiento DESC
        LIMIT 60
    """), params).fetchall()

    return [dict(row._mapping) for row in rows]
