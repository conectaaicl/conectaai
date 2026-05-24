from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.reserva import EspacioComun, Reserva
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, date

router = APIRouter(prefix="/api/reservas", tags=["Reservas"])


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


# ─── Espacios ───────────────────────────────────────────────────────────────

@router.get("/espacios")
def list_espacios(condominio_id: int = Query(...), db: Session = Depends(get_db)):
    """List all common spaces for a condominio."""
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
def create_espacio(body: EspacioCreate, db: Session = Depends(get_db)):
    """Create a new common space."""
    espacio = EspacioComun(**body.dict())
    db.add(espacio)
    db.commit()
    db.refresh(espacio)
    return {"id": espacio.id, "nombre": espacio.nombre}


# ─── Reservas ───────────────────────────────────────────────────────────────

@router.get("")
def list_reservas(
    espacio_id: int = Query(...),
    fecha: Optional[str] = Query(None, description="YYYY-MM-DD"),
    db: Session = Depends(get_db),
):
    """List reservations for a space, optionally filtered by day."""
    from sqlalchemy import text as _t
    sql = ("SELECT r.id,r.espacio_id,r.departamento_id,r.persona_id,"
           "r.fecha_inicio::text,r.fecha_fin::text,r.estado,"
           "r.monto_cobrado::float,r.notas,r.created_at::text,"
           "ec.nombre as espacio_nombre,"
           "p.nombre_completo as persona_nombre,p.rut as persona_rut,p.telefono as persona_telefono "
           "FROM reservas r "
           "LEFT JOIN espacios_comunes ec ON ec.id=r.espacio_id "
           "LEFT JOIN personas p ON p.id=r.persona_id "
           "WHERE r.espacio_id=:eid")
    params = {"eid": espacio_id}
    if fecha:
        sql += " AND DATE(r.fecha_inicio)=:fecha"
        params["fecha"] = fecha
    sql += " ORDER BY r.fecha_inicio DESC"
    rows = db.execute(_t(sql), params).fetchall()
    return [dict(r._mapping) for r in rows]


@router.post("", status_code=201)
def create_reserva(body: ReservaCreate, db: Session = Depends(get_db)):
    """Create a reservation; checks for time conflicts first."""
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
    return {"id": reserva.id, "estado": reserva.estado}


@router.patch("/{reserva_id}/estado")
def update_estado(reserva_id: int, body: EstadoUpdate, db: Session = Depends(get_db)):
    """Confirm or cancel a reservation."""
    reserva = db.query(Reserva).filter(Reserva.id == reserva_id).first()
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")
    allowed = {"pendiente", "confirmada", "cancelada", "rechazada", "aprobada"}
    if body.estado not in allowed:
        raise HTTPException(status_code=400, detail=f"Estado debe ser uno de: {allowed}")
    reserva.estado = body.estado
    db.commit()
    return {"id": reserva.id, "estado": reserva.estado}


@router.delete("/{reserva_id}", status_code=204)
def delete_reserva(reserva_id: int, db: Session = Depends(get_db)):
    """Delete a reservation."""
    reserva = db.query(Reserva).filter(Reserva.id == reserva_id).first()
    if not reserva:
        raise HTTPException(status_code=404, detail="Reserva no encontrada")
    db.delete(reserva)
    db.commit()


@router.delete("/espacios/{espacio_id}")
def delete_espacio(espacio_id: int, db: Session = Depends(get_db)):
    espacio = db.query(EspacioComun).filter(EspacioComun.id == espacio_id).first()
    if not espacio:
        raise HTTPException(404, "Espacio no encontrado")
    db.delete(espacio)
    db.commit()
    return {"ok": True}


@router.post("/{reserva_id}/enviar")
def enviar_confirmacion_reserva(reserva_id: int, db: Session = Depends(get_db)):
    import os as _os, httpx as _hx
    from sqlalchemy import text as _t
    row = db.execute(_t(
        "SELECT r.id,r.estado,r.fecha_inicio::text,r.fecha_fin::text,r.monto_cobrado::float,r.notas,"
        "ec.nombre as espacio_nombre,p.nombre_completo as persona_nombre,p.email as persona_email "
        "FROM reservas r LEFT JOIN espacios_comunes ec ON ec.id=r.espacio_id "
        "LEFT JOIN personas p ON p.id=r.persona_id WHERE r.id=:rid"
    ), {"rid": reserva_id}).fetchone()
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
            json={"to": d["persona_email"], "from": "condominios@conectaai.cl",
                  "subject": f"Confirmación Reserva - {d['espacio_nombre']}", "html": html},
            headers={"Authorization": "Bearer " + _os.getenv("MAIL_API_KEY", "")}, timeout=5)
    except Exception as e:
        raise HTTPException(500, f"Error: {e}")
    return {"ok": True, "enviado_a": d["persona_email"]}


@router.patch("/{reserva_id}/aprobar")
def aprobar_reserva(reserva_id: int, tenant_id: int, db: Session = Depends(get_db)):
    """Admin approves a conserje/residente reservation request."""
    row = db.execute(text("SELECT * FROM reservas WHERE id=:id"), {"id": reserva_id}).fetchone()
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
            p = db.execute(text("SELECT email, nombre_completo FROM personas WHERE id=:pid"),
                          {"pid": d["persona_id"]}).fetchone()
            if p and p._mapping.get("email"):
                import httpx, os
                mail_url = os.getenv("MAIL_API_URL", "")
                mail_key = os.getenv("MAIL_API_KEY", "")
                if mail_url:
                    httpx.post(mail_url,
                        json={"to": p._mapping["email"], "from": "no-reply@conectaai.cl",
                              "subject": "Reserva aprobada",
                              "html": "<p>Hola <b>" + (p._mapping.get("nombre_completo") or "") + "</b>, tu reserva ha sido <b style=\'color:green\'>aprobada</b>.</p>"},
                        headers={"Authorization": "Bearer " + mail_key}, timeout=5)
        except Exception: pass
    return {"ok": True, "estado": "confirmada"}


@router.patch("/{reserva_id}/rechazar")
def rechazar_reserva(reserva_id: int, tenant_id: int, motivo: str = "", db: Session = Depends(get_db)):
    """Admin rejects a reservation request."""
    row = db.execute(text("SELECT * FROM reservas WHERE id=:id"), {"id": reserva_id}).fetchone()
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
            p = db.execute(text("SELECT email, nombre_completo FROM personas WHERE id=:pid"),
                          {"pid": d["persona_id"]}).fetchone()
            if p and p._mapping.get("email"):
                import httpx, os
                mail_url = os.getenv("MAIL_API_URL", "")
                mail_key = os.getenv("MAIL_API_KEY", "")
                if mail_url:
                    httpx.post(mail_url,
                        json={"to": p._mapping["email"], "from": "no-reply@conectaai.cl",
                              "subject": "Reserva rechazada",
                              "html": "<p>Hola, tu reserva fue <b style=\'color:red\'>rechazada</b>" + (". Motivo: " + motivo if motivo else "") + ".</p>"},
                        headers={"Authorization": "Bearer " + mail_key}, timeout=5)
        except Exception: pass
    return {"ok": True, "estado": "rechazada"}
