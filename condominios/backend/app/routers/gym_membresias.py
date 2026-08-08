from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional
from datetime import datetime, timedelta, timezone
from pydantic import BaseModel

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_admin

router = APIRouter(prefix="/api/gym", tags=["gym-membresias"])


def _estado_efectivo(estado: str, fecha_vencimiento) -> str:
    if estado in ("suspendida", "cancelada"):
        return estado
    if fecha_vencimiento and fecha_vencimiento < datetime.now(timezone.utc):
        return "vencida"
    return "activa"


def _persona_del_tenant(db: Session, persona_id: int, tenant_id: int):
    row = db.execute(
        text("SELECT id, nombre_completo, rut, estado FROM personas WHERE id=:pid AND tenant_id=:tid"),
        {"pid": persona_id, "tid": tenant_id}
    ).fetchone()
    if not row:
        raise HTTPException(404, "Socio no encontrado")
    return row


def _sync_acceso(db: Session, tenant_id: int, persona_id: int, rut: str, activa: bool, fecha_vencimiento=None):
    """Refleja el estado de la membresia en los mecanismos de acceso reales
    (tarjetas RFID y cuenta de portal/QR), no solo en un campo cosmetico."""
    params = {"tid": tenant_id, "pid": persona_id, "activa": activa}
    if fecha_vencimiento is not None:
        db.execute(text(
            "UPDATE tarjetas_rfid SET activa=:activa, fecha_vencimiento=:fv, updated_at=NOW() "
            "WHERE persona_id=:pid AND tenant_id=:tid"
        ), {**params, "fv": fecha_vencimiento})
    else:
        db.execute(text(
            "UPDATE tarjetas_rfid SET activa=:activa, updated_at=NOW() WHERE persona_id=:pid AND tenant_id=:tid"
        ), params)
    db.execute(text(
        "UPDATE residentes_portal SET activo=:activa WHERE rut=:rut AND tenant_id=:tid"
    ), {"activa": activa, "rut": rut, "tid": tenant_id})
    db.execute(text(
        "UPDATE personas SET estado=:estado, updated_at=NOW() WHERE id=:pid AND tenant_id=:tid"
    ), {"estado": "activo" if activa else "suspendido", "pid": persona_id, "tid": tenant_id})


# ---------------------------------------------------------------- Planes

class PlanIn(BaseModel):
    nombre: str
    descripcion: Optional[str] = None
    precio: float = 0
    duracion_dias: int
    tipo: str = "recurrente"


class PlanPatch(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    precio: Optional[float] = None
    duracion_dias: Optional[int] = None
    tipo: Optional[str] = None
    activo: Optional[bool] = None


@router.get("/planes")
def listar_planes(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_id = current_user["tenant_id"]
    rows = db.execute(text(
        "SELECT id, nombre, descripcion, precio, duracion_dias, tipo, activo "
        "FROM gym_planes WHERE tenant_id=:tid ORDER BY activo DESC, duracion_dias ASC"
    ), {"tid": tenant_id}).fetchall()
    return [dict(r._mapping) for r in rows]


@router.post("/planes")
def crear_plan(body: PlanIn, current_user: dict = Depends(require_admin), db: Session = Depends(get_db)):
    if body.tipo not in ("recurrente", "pase"):
        raise HTTPException(400, "tipo debe ser 'recurrente' o 'pase'")
    if body.duracion_dias < 1:
        raise HTTPException(400, "duracion_dias debe ser al menos 1")
    tenant_id = current_user["tenant_id"]
    row = db.execute(text(
        "INSERT INTO gym_planes (tenant_id, nombre, descripcion, precio, duracion_dias, tipo) "
        "VALUES (:tid, :n, :d, :p, :dd, :t) RETURNING id"
    ), {"tid": tenant_id, "n": body.nombre, "d": body.descripcion, "p": body.precio,
        "dd": body.duracion_dias, "t": body.tipo}).fetchone()
    db.commit()
    return {"id": row[0], "success": True}


@router.patch("/planes/{plan_id}")
def editar_plan(plan_id: int, body: PlanPatch, current_user: dict = Depends(require_admin), db: Session = Depends(get_db)):
    tenant_id = current_user["tenant_id"]
    existing = db.execute(text("SELECT id FROM gym_planes WHERE id=:id AND tenant_id=:tid"), {"id": plan_id, "tid": tenant_id}).fetchone()
    if not existing:
        raise HTTPException(404, "Plan no encontrado")
    fields, params = [], {"id": plan_id, "tid": tenant_id}
    for key in ("nombre", "descripcion", "precio", "duracion_dias", "tipo", "activo"):
        val = getattr(body, key)
        if val is not None:
            fields.append(f"{key}=:{key}")
            params[key] = val
    if fields:
        fields.append("updated_at=NOW()")
        db.execute(text(f"UPDATE gym_planes SET {', '.join(fields)} WHERE id=:id AND tenant_id=:tid"), params)
        db.commit()
    return {"success": True}


@router.delete("/planes/{plan_id}")
def eliminar_plan(plan_id: int, current_user: dict = Depends(require_admin), db: Session = Depends(get_db)):
    tenant_id = current_user["tenant_id"]
    existing = db.execute(text("SELECT id FROM gym_planes WHERE id=:id AND tenant_id=:tid"), {"id": plan_id, "tid": tenant_id}).fetchone()
    if not existing:
        raise HTTPException(404, "Plan no encontrado")
    en_uso = db.execute(text("SELECT COUNT(*) FROM gym_membresias WHERE plan_id=:id"), {"id": plan_id}).scalar()
    if en_uso:
        db.execute(text("UPDATE gym_planes SET activo=false, updated_at=NOW() WHERE id=:id"), {"id": plan_id})
        db.commit()
        return {"success": True, "accion": "desactivado", "detail": f"{en_uso} socio(s) tienen este plan asignado; se desactivo en vez de eliminar"}
    db.execute(text("DELETE FROM gym_planes WHERE id=:id"), {"id": plan_id})
    db.commit()
    return {"success": True, "accion": "eliminado"}


# ------------------------------------------------------------ Membresias

class RenovarIn(BaseModel):
    plan_id: int
    monto: float = 0
    metodo_pago: Optional[str] = None
    notas: Optional[str] = None


class SuspenderIn(BaseModel):
    motivo: Optional[str] = None


@router.get("/membresias")
def listar_membresias(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_id = current_user["tenant_id"]
    rows = db.execute(text("""
        SELECT p.id AS persona_id, p.nombre_completo, p.rut, p.telefono,
               m.id AS membresia_id, m.estado, m.fecha_inicio, m.fecha_vencimiento, m.notas,
               pl.id AS plan_id, pl.nombre AS plan_nombre, pl.precio AS plan_precio
        FROM personas p
        LEFT JOIN gym_membresias m ON m.persona_id = p.id
        LEFT JOIN gym_planes pl ON pl.id = m.plan_id
        WHERE p.tenant_id = :tid AND p.roles ? 'socio'
        ORDER BY p.nombre_completo ASC
    """), {"tid": tenant_id}).fetchall()
    out = []
    for r in rows:
        d = dict(r._mapping)
        d["estado_efectivo"] = _estado_efectivo(d["estado"], d["fecha_vencimiento"]) if d["membresia_id"] else "sin_plan"
        out.append(d)
    return out


@router.get("/membresias/{persona_id}")
def obtener_membresia(persona_id: int, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_id = current_user["tenant_id"]
    persona = _persona_del_tenant(db, persona_id, tenant_id)
    m = db.execute(text("""
        SELECT m.id, m.estado, m.fecha_inicio, m.fecha_vencimiento, m.notas,
               pl.id AS plan_id, pl.nombre AS plan_nombre, pl.precio AS plan_precio, pl.duracion_dias
        FROM gym_membresias m LEFT JOIN gym_planes pl ON pl.id = m.plan_id
        WHERE m.persona_id = :pid
    """), {"pid": persona_id}).fetchone()
    pagos = db.execute(text("""
        SELECT mp.id, mp.monto, mp.metodo_pago, mp.fecha_pago, mp.fecha_vencimiento_resultante, mp.notas,
               pl.nombre AS plan_nombre
        FROM gym_membresia_pagos mp LEFT JOIN gym_planes pl ON pl.id = mp.plan_id
        WHERE mp.persona_id = :pid AND mp.tenant_id = :tid
        ORDER BY mp.fecha_pago DESC LIMIT 20
    """), {"pid": persona_id, "tid": tenant_id}).fetchall()
    membresia = dict(m._mapping) if m else None
    if membresia:
        membresia["estado_efectivo"] = _estado_efectivo(membresia["estado"], membresia["fecha_vencimiento"])
    return {
        "persona": {"id": persona[0], "nombre_completo": persona[1], "rut": persona[2], "estado": persona[3]},
        "membresia": membresia,
        "pagos": [dict(p._mapping) for p in pagos],
    }


@router.post("/membresias/{persona_id}/renovar")
def renovar_membresia(persona_id: int, body: RenovarIn, current_user: dict = Depends(require_admin), db: Session = Depends(get_db)):
    tenant_id = current_user["tenant_id"]
    persona = _persona_del_tenant(db, persona_id, tenant_id)
    plan = db.execute(text(
        "SELECT id, nombre, duracion_dias FROM gym_planes WHERE id=:id AND tenant_id=:tid"
    ), {"id": body.plan_id, "tid": tenant_id}).fetchone()
    if not plan:
        raise HTTPException(404, "Plan no encontrado")

    existing = db.execute(text(
        "SELECT estado, fecha_vencimiento FROM gym_membresias WHERE persona_id=:pid"
    ), {"pid": persona_id}).fetchone()

    ahora = datetime.now(timezone.utc)
    fecha_base = ahora
    if existing and existing[0] == "activa" and existing[1] and existing[1] > ahora:
        fecha_base = existing[1]  # renovacion anticipada: se acumula sobre el vencimiento vigente
    fecha_venc = fecha_base + timedelta(days=plan[2])

    if existing:
        db.execute(text(
            "UPDATE gym_membresias SET plan_id=:plan_id, fecha_inicio=:fi, fecha_vencimiento=:fv, "
            "estado='activa', notas=:notas, updated_at=NOW() WHERE persona_id=:pid"
        ), {"plan_id": plan[0], "fi": ahora, "fv": fecha_venc, "notas": body.notas, "pid": persona_id})
    else:
        db.execute(text(
            "INSERT INTO gym_membresias (tenant_id, persona_id, plan_id, fecha_inicio, fecha_vencimiento, estado, notas) "
            "VALUES (:tid, :pid, :plan_id, :fi, :fv, 'activa', :notas)"
        ), {"tid": tenant_id, "pid": persona_id, "plan_id": plan[0], "fi": ahora, "fv": fecha_venc, "notas": body.notas})

    db.execute(text(
        "INSERT INTO gym_membresia_pagos (tenant_id, persona_id, plan_id, monto, metodo_pago, fecha_vencimiento_resultante, registrado_por, notas) "
        "VALUES (:tid, :pid, :plan_id, :monto, :metodo, :fv, :reg, :notas)"
    ), {"tid": tenant_id, "pid": persona_id, "plan_id": plan[0], "monto": body.monto, "metodo": body.metodo_pago,
        "fv": fecha_venc, "reg": current_user.get("id"), "notas": body.notas})

    _sync_acceso(db, tenant_id, persona_id, persona[2], activa=True, fecha_vencimiento=fecha_venc)
    db.commit()
    return {"success": True, "fecha_vencimiento": fecha_venc.isoformat(), "estado_efectivo": "activa"}


@router.post("/membresias/{persona_id}/suspender")
def suspender_membresia(persona_id: int, body: SuspenderIn, current_user: dict = Depends(require_admin), db: Session = Depends(get_db)):
    tenant_id = current_user["tenant_id"]
    persona = _persona_del_tenant(db, persona_id, tenant_id)
    existing = db.execute(text("SELECT id FROM gym_membresias WHERE persona_id=:pid"), {"pid": persona_id}).fetchone()
    if not existing:
        raise HTTPException(400, "Este socio no tiene una membresia asignada todavia")
    db.execute(text(
        "UPDATE gym_membresias SET estado='suspendida', notas=:notas, updated_at=NOW() WHERE persona_id=:pid"
    ), {"notas": body.motivo, "pid": persona_id})
    _sync_acceso(db, tenant_id, persona_id, persona[2], activa=False)
    db.commit()
    return {"success": True, "estado_efectivo": "suspendida"}


@router.post("/membresias/{persona_id}/reactivar")
def reactivar_membresia(persona_id: int, current_user: dict = Depends(require_admin), db: Session = Depends(get_db)):
    tenant_id = current_user["tenant_id"]
    persona = _persona_del_tenant(db, persona_id, tenant_id)
    m = db.execute(text(
        "SELECT estado, fecha_vencimiento FROM gym_membresias WHERE persona_id=:pid"
    ), {"pid": persona_id}).fetchone()
    if not m:
        raise HTTPException(400, "Este socio no tiene una membresia asignada todavia")
    if m[1] and m[1] < datetime.now(timezone.utc):
        raise HTTPException(400, "La membresia esta vencida. Hay que renovarla, no solo reactivarla.")
    db.execute(text("UPDATE gym_membresias SET estado='activa', updated_at=NOW() WHERE persona_id=:pid"), {"pid": persona_id})
    _sync_acceso(db, tenant_id, persona_id, persona[2], activa=True)
    db.commit()
    return {"success": True, "estado_efectivo": "activa"}


# ------------------------------------------------------------- Pase de dia

class PaseDiaIn(BaseModel):
    nombre: str
    rut: str
    telefono: Optional[str] = None
    plan_id: int
    monto: float = 0
    metodo_pago: Optional[str] = None


@router.post("/pase-dia")
def emitir_pase_dia(body: PaseDiaIn, current_user: dict = Depends(require_admin), db: Session = Depends(get_db)):
    tenant_id = current_user["tenant_id"]
    plan = db.execute(text(
        "SELECT id, duracion_dias FROM gym_planes WHERE id=:id AND tenant_id=:tid AND tipo='pase'"
    ), {"id": body.plan_id, "tid": tenant_id}).fetchone()
    if not plan:
        raise HTTPException(404, "Plan de pase no encontrado (debe ser tipo 'pase')")

    persona = db.execute(text(
        "SELECT id FROM personas WHERE rut=:rut AND tenant_id=:tid"
    ), {"rut": body.rut, "tid": tenant_id}).fetchone()

    if persona:
        persona_id = persona[0]
        db.execute(text(
            "UPDATE personas SET roles = CASE WHEN roles ? 'socio' THEN roles ELSE roles || '[\"socio\"]'::jsonb END "
            "WHERE id=:pid"
        ), {"pid": persona_id})
    else:
        row = db.execute(text(
            "INSERT INTO personas (tenant_id, nombre_completo, rut, telefono, email, roles, estado) "
            "VALUES (:tid, :n, :rut, :tel, '', '[\"socio\"]'::jsonb, 'activo') RETURNING id"
        ), {"tid": tenant_id, "n": body.nombre, "rut": body.rut, "tel": body.telefono or ""}).fetchone()
        persona_id = row[0]

    ahora = datetime.now(timezone.utc)
    fecha_venc = ahora + timedelta(days=plan[1])
    db.execute(text(
        "INSERT INTO gym_membresias (tenant_id, persona_id, plan_id, fecha_inicio, fecha_vencimiento, estado) "
        "VALUES (:tid, :pid, :plan_id, :fi, :fv, 'activa') "
        "ON CONFLICT (persona_id) DO UPDATE SET plan_id=:plan_id, fecha_inicio=:fi, fecha_vencimiento=:fv, estado='activa', updated_at=NOW()"
    ), {"tid": tenant_id, "pid": persona_id, "plan_id": plan[0], "fi": ahora, "fv": fecha_venc})
    db.execute(text(
        "INSERT INTO gym_membresia_pagos (tenant_id, persona_id, plan_id, monto, metodo_pago, fecha_vencimiento_resultante, registrado_por) "
        "VALUES (:tid, :pid, :plan_id, :monto, :metodo, :fv, :reg)"
    ), {"tid": tenant_id, "pid": persona_id, "plan_id": plan[0], "monto": body.monto, "metodo": body.metodo_pago,
        "fv": fecha_venc, "reg": current_user.get("id")})
    db.commit()
    return {"success": True, "persona_id": persona_id, "fecha_vencimiento": fecha_venc.isoformat()}
