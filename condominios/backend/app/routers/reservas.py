from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.reserva import EspacioComun, Reserva
from app.services.comunicaciones import SegmentoFiltros, resolver_destinatarios, enviar_comunicacion
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, date

from app.core.features import check_feature

router = APIRouter(prefix="/api/reservas", tags=["Reservas"], dependencies=[Depends(check_feature("reservas"))])
# ─── Schemas ────────────────────────────────────────────────────────────────

class EspacioCreate(BaseModel):
    condominio_id: int
    nombre: str
    descripcion: Optional[str] = None
    capacidad: int = 0
    precio_hora: float = 0
    requiere_pago: str = "no"
    horario_inicio: str = "08:00"
    horario_fin: str = "22:00"
    activo: str = "si"


class ReservaCreate(BaseModel):
    solicitado_por: str = "admin"  # admin | conserje | residente
    requiere_aprobacion: bool = False
    espacio_id: int
    departamento_id: Optional[int] = None
    persona_id: Optional[int] = None
    fecha_inicio: datetime
    fecha_fin: datetime
    notas: Optional[str] = None
    monto_cobrado: float = 0


class EstadoUpdate(BaseModel):
    estado: str  # confirmada | cancelada | pendiente


# ─── Helpers de aislamiento por tenant ──────────────────────────────────────

def _condominio_del_tenant(db: Session, condominio_id: int, tenant_id: int) -> bool:
    row = db.execute(
        text("SELECT id FROM condominios WHERE id=:cid AND tenant_id=:tid"),
        {"cid": condominio_id, "tid": tenant_id},
    ).fetchone()
    return row is not None


def _espacio_del_tenant(db: Session, espacio_id: int, tenant_id: int):
    """Devuelve la fila del espacio si pertenece a un condominio de este tenant, si no None."""
    return db.execute(text(
        "SELECT ec.id, ec.condominio_id FROM espacios_comunes ec "
        "JOIN condominios c ON c.id = ec.condominio_id "
        "WHERE ec.id=:eid AND c.tenant_id=:tid"
    ), {"eid": espacio_id, "tid": tenant_id}).fetchone()


def _reserva_del_tenant(db: Session, reserva_id: int, tenant_id: int):
    """Devuelve la fila de la reserva si su espacio pertenece a un condominio de este tenant, si no None."""
    return db.execute(text(
        "SELECT r.* FROM reservas r "
        "JOIN espacios_comunes ec ON ec.id = r.espacio_id "
        "JOIN condominios c ON c.id = ec.condominio_id "
        "WHERE r.id=:rid AND c.tenant_id=:tid"
    ), {"rid": reserva_id, "tid": tenant_id}).fetchone()


# ─── Espacios ───────────────────────────────────────────────────────────────

@router.get("/espacios")
def list_espacios(condominio_id: int = Query(...), current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """List all common spaces for a condominio."""
    tenant_id = current_user["tenant_id"]
    if not _condominio_del_tenant(db, condominio_id, tenant_id):
        raise HTTPException(status_code=404, detail="Condominio no encontrado")
    espacios = (
        db.query(EspacioComun)
        .filter(EspacioComun.condominio_id == condominio_id)
        .all()
    )
    return [
        {
            "id": e.id,
            "condominio_id": e.condominio_id,
            "nombre": e.nombre,
            "descripcion": e.descripcion,
            "capacidad": e.capacidad,
            "precio_hora": float(e.precio_hora),
            "requiere_pago": e.requiere_pago,
            "horario_inicio": e.horario_inicio,
            "horario_fin": e.horario_fin,
            "activo": e.activo,
        }
        for e in espacios
    ]


@router.post("/espacios", status_code=201)
def create_espacio(body: EspacioCreate, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Create a new common space."""
    tenant_id = current_user["tenant_id"]
    if not _condominio_del_tenant(db, body.condominio_id, tenant_id):
        raise HTTPException(status_code=404, detail="Condominio no encontrado")
    espacio = EspacioComun(**body.dict())
    db.add(espacio)
    db.commit()
    db.refresh(espacio)
    return {"id": espacio.id, "nombre": espacio.nombre}


# ─── Reservas ───────────────────────────────────────────────────────────────

@router.get("")
def list_reservas(
    espacio_id: Optional[int] = Query(None),
    fecha: Optional[str] = Query(None, description="YYYY-MM-DD"),
    estado: Optional[str] = Query(None),
    limit: int = Query(200),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Reservas del condominio; opcionalmente por espacio, dia o estado (sin espacio_id lista todas)."""
    tenant_id = current_user["tenant_id"]
    sql = ("SELECT r.id,r.espacio_id,r.departamento_id,r.persona_id,"
           "r.fecha_inicio::text,r.fecha_fin::text,r.estado,"
           "r.monto_cobrado::float,r.notas,r.created_at::text,"
           "ec.nombre as espacio_nombre, d.numero as depto_numero,"
           "COALESCE(p.nombre_completo, rp.nombre_completo) as persona_nombre,"
           "COALESCE(p.rut, rp.rut) as persona_rut, COALESCE(p.telefono, rp.telefono) as persona_telefono "
           "FROM reservas r "
           "JOIN espacios_comunes ec ON ec.id=r.espacio_id "
           "JOIN condominios cnd ON cnd.id=ec.condominio_id "
           "LEFT JOIN departamentos d ON d.id=r.departamento_id "
           "LEFT JOIN personas p ON p.id=r.persona_id "
           "LEFT JOIN residentes_portal rp ON rp.departamento_id=r.departamento_id AND rp.tenant_id=cnd.tenant_id AND r.persona_id IS NULL "
           "WHERE cnd.tenant_id=:tid")
    params: dict = {"tid": tenant_id}
    if espacio_id:
        sql += " AND r.espacio_id=:eid"; params["eid"] = espacio_id
    if fecha:
        sql += " AND DATE(r.fecha_inicio)=:fecha"; params["fecha"] = fecha
    if estado:
        sql += " AND r.estado=:estado"; params["estado"] = estado
    sql += " ORDER BY (r.estado='pendiente') DESC, r.fecha_inicio DESC LIMIT :lim"; params["lim"] = limit
    rows = db.execute(text(sql), params).fetchall()
    out = []
    for r in rows:
        d = dict(r._mapping)
        # alias que usa la app de conserjeria
        d["residente_nombre"] = d.get("persona_nombre"); d["departamento"] = d.get("depto_numero"); d["observaciones"] = d.get("notas")
        out.append(d)
    return out


@router.post("", status_code=201)
async def create_reserva(body: ReservaCreate, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Create a reservation; checks for time conflicts first."""
    tenant_id = current_user["tenant_id"]
    if not _espacio_del_tenant(db, body.espacio_id, tenant_id):
        raise HTTPException(status_code=404, detail="Espacio no encontrado")
    if body.fecha_fin <= body.fecha_inicio:
        raise HTTPException(status_code=400, detail="fecha_fin debe ser posterior a fecha_inicio")

    # Conflict check: overlapping confirmed/pending reservations for same space
    conflict = (
        db.query(Reserva)
        .filter(
            Reserva.espacio_id == body.espacio_id,
            Reserva.estado.in_(["pendiente", "confirmada"]),
            Reserva.fecha_inicio < body.fecha_fin,
            Reserva.fecha_fin > body.fecha_inicio,
        )
        .first()
    )
    if conflict:
        raise HTTPException(
            status_code=409,
            detail=f"Conflicto con reserva existente #{conflict.id} "
                   f"({conflict.fecha_inicio.isoformat()} - {conflict.fecha_fin.isoformat()})",
        )

    reserva = Reserva(**body.dict())
    db.add(reserva)
    db.commit()
    db.refresh(reserva)

    if reserva.persona_id:
        espacio = db.query(EspacioComun).filter(EspacioComun.id == reserva.espacio_id).first()
        destinatarios = resolver_destinatarios(db, tenant_id, SegmentoFiltros(persona_ids=[reserva.persona_id]))
        if destinatarios:
            fecha_txt = reserva.fecha_inicio.strftime("%d-%m-%Y %H:%M")
            nombre_espacio = espacio.nombre if espacio else "el espacio"
            await enviar_comunicacion(
                db, tenant_id, destinatarios, "email",
                "Reserva confirmada",
                f"<p>Hola {destinatarios[0]['nombre_completo']},</p>"
                f"<p>Tu reserva de <strong>{nombre_espacio}</strong> para el {fecha_txt} quedó registrada "
                f"con estado <strong>{reserva.estado}</strong>.</p>",
                modulo_origen="reservas", evento_origen="reservation.created",
                enviado_por=current_user.get("nombre_completo", "Sistema"),
            )

    return {"id": reserva.id, "estado": reserva.estado}


@router.patch("/{reserva_id}/estado")
def update_estado(reserva_id: int, body: EstadoUpdate, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Confirm or cancel a reservation."""
    tenant_id = current_user["tenant_id"]
    if not _reserva_del_tenant(db, reserva_id, tenant_id):
        raise HTTPException(status_code=404, detail="Reserva no encontrada")
    allowed = {"pendiente", "confirmada", "cancelada", "rechazada", "aprobada"}
    if body.estado not in allowed:
        raise HTTPException(status_code=400, detail=f"Estado debe ser uno de: {allowed}")
    reserva = db.query(Reserva).filter(Reserva.id == reserva_id).first()
    reserva.estado = body.estado
    db.commit()
    return {"id": reserva.id, "estado": reserva.estado}


@router.delete("/{reserva_id}", status_code=204)
def delete_reserva(reserva_id: int, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Delete a reservation."""
    tenant_id = current_user["tenant_id"]
    if not _reserva_del_tenant(db, reserva_id, tenant_id):
        raise HTTPException(status_code=404, detail="Reserva no encontrada")
    reserva = db.query(Reserva).filter(Reserva.id == reserva_id).first()
    db.delete(reserva)
    db.commit()


@router.delete("/espacios/{espacio_id}")
def delete_espacio(espacio_id: int, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_id = current_user["tenant_id"]
    if not _espacio_del_tenant(db, espacio_id, tenant_id):
        raise HTTPException(404, "Espacio no encontrado")
    espacio = db.query(EspacioComun).filter(EspacioComun.id == espacio_id).first()
    db.delete(espacio)
    db.commit()
    return {"ok": True}


@router.post("/{reserva_id}/enviar")
def enviar_confirmacion_reserva(reserva_id: int, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_id = current_user["tenant_id"]
    import os as _os, httpx as _hx
    row = db.execute(text(
        "SELECT r.id,r.estado,r.fecha_inicio::text,r.fecha_fin::text,r.monto_cobrado::float,r.notas,"
        "ec.nombre as espacio_nombre,p.nombre_completo as persona_nombre,p.email as persona_email "
        "FROM reservas r JOIN espacios_comunes ec ON ec.id=r.espacio_id "
        "JOIN condominios cnd ON cnd.id=ec.condominio_id "
        "LEFT JOIN personas p ON p.id=r.persona_id WHERE r.id=:rid AND cnd.tenant_id=:tid"
    ), {"rid": reserva_id, "tid": tenant_id}).fetchone()
    if not row:
        raise HTTPException(404, "Reserva no encontrada")
    d = dict(row._mapping)
    if not d.get("persona_email"):
        raise HTTPException(400, "Residente sin email registrado")
    html = (
        f"<h2>Confirmación de Reserva</h2>"
        f"<p>Estimado/a <b>{d['persona_nombre']}</b>,</p>"
        f"<table><tr><td><b>Espacio</b></td><td>{d['espacio_nombre']}</td></tr>"
        f"<tr><td><b>Desde</b></td><td>{d['fecha_inicio']}</td></tr>"
        f"<tr><td><b>Hasta</b></td><td>{d['fecha_fin']}</td></tr>"
        f"<tr><td><b>Estado</b></td><td>{d['estado']}</td></tr>"
        f"<tr><td><b>Monto</b></td><td>${d['monto_cobrado'] or 0:,.0f}</td></tr></table>"
    )
    try:
        _hx.post(_os.getenv("MAIL_API_URL", "http://localhost:3004/api/send"),
            json={"to": d["persona_email"], "from": "corp@conectaai.cl", "reply_to": "corp.conectaai@gmail.com",
                  "subject": f"Confirmación Reserva - {d['espacio_nombre']}", "html": html},
            headers={"Authorization": "Bearer " + _os.getenv("MAIL_API_KEY", "")}, timeout=5)
    except Exception as e:
        raise HTTPException(500, f"Error: {e}")
    return {"ok": True, "enviado_a": d["persona_email"]}


@router.patch("/{reserva_id}/aprobar")
def aprobar_reserva(reserva_id: int, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Admin approves a conserje/residente reservation request."""
    tenant_id = current_user["tenant_id"]
    row = _reserva_del_tenant(db, reserva_id, tenant_id)
    if not row:
        raise HTTPException(404, "Reserva no encontrada")
    db.execute(text("UPDATE reservas SET estado='confirmada' WHERE id=:id"), {"id": reserva_id})
    db.commit()
    d = dict(row._mapping)
    # Notify via historial
    try:
        from app.models import HistorialEvento
        hist = HistorialEvento(tenant_id=tenant_id, modulo="reservas", accion="aprobada",
            descripcion="Reserva aprobada por administrador",
            entidad_id=reserva_id, metadata_json={"reserva_id": reserva_id})
        db.add(hist); db.commit()
    except Exception: db.rollback()
    # Send email notification if persona has email
    if d.get("persona_id"):
        try:
            p = db.execute(text("SELECT email, nombre_completo FROM personas WHERE id=:pid AND tenant_id=:tid"),
                          {"pid": d["persona_id"], "tid": tenant_id}).fetchone()
            if p and p._mapping.get("email"):
                import httpx, os
                mail_url = os.getenv("MAIL_API_URL", "")
                mail_key = os.getenv("MAIL_API_KEY", "")
                if mail_url:
                    httpx.post(mail_url,
                        json={"to": p._mapping["email"], "from": "corp@conectaai.cl", "reply_to": "corp.conectaai@gmail.com",
                              "subject": "Reserva aprobada",
                              "html": "<p>Hola <b>" + (p._mapping.get("nombre_completo") or "") + "</b>, tu reserva ha sido <b style=\'color:green\'>aprobada</b>.</p>"},
                        headers={"Authorization": "Bearer " + mail_key}, timeout=5)
        except Exception: pass
    return {"ok": True, "estado": "confirmada"}


@router.patch("/{reserva_id}/rechazar")
def rechazar_reserva(reserva_id: int, motivo: str = "", current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Admin rejects a reservation request."""
    tenant_id = current_user["tenant_id"]
    row = _reserva_del_tenant(db, reserva_id, tenant_id)
    if not row:
        raise HTTPException(404, "Reserva no encontrada")
    db.execute(text("UPDATE reservas SET estado='rechazada' WHERE id=:id"), {"id": reserva_id})
    db.commit()
    d = dict(row._mapping)
    try:
        from app.models import HistorialEvento
        hist = HistorialEvento(tenant_id=tenant_id, modulo="reservas", accion="rechazada",
            descripcion="Reserva rechazada" + (": " + motivo if motivo else ""),
            entidad_id=reserva_id)
        db.add(hist); db.commit()
    except Exception: db.rollback()
    if d.get("persona_id"):
        try:
            p = db.execute(text("SELECT email, nombre_completo FROM personas WHERE id=:pid AND tenant_id=:tid"),
                          {"pid": d["persona_id"], "tid": tenant_id}).fetchone()
            if p and p._mapping.get("email"):
                import httpx, os
                mail_url = os.getenv("MAIL_API_URL", "")
                mail_key = os.getenv("MAIL_API_KEY", "")
                if mail_url:
                    httpx.post(mail_url,
                        json={"to": p._mapping["email"], "from": "corp@conectaai.cl", "reply_to": "corp.conectaai@gmail.com",
                              "subject": "Reserva rechazada",
                              "html": "<p>Hola, tu reserva fue <b style=\'color:red\'>rechazada</b>" + (". Motivo: " + motivo if motivo else "") + ".</p>"},
                        headers={"Authorization": "Bearer " + mail_key}, timeout=5)
        except Exception: pass
    return {"ok": True, "estado": "rechazada"}
