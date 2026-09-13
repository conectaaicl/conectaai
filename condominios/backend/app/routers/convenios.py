"""
Convenios de pago de gastos comunes.
Regla: un departamento con 3 o mas periodos vencidos sin pagar es "moroso". Administracion (o el propio
residente desde su app, sujeto a aprobacion) puede armar un convenio: pie opcional + N cuotas mensuales.
Los cobros incluidos pasan a estado 'convenio' (dejan de contar como morosidad) y se cobran por cuotas.
"""
from datetime import date, timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel, Field
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.routers.portal_auth import get_residente
from app.models import ResidentePortal

from app.core.features import check_feature
router = APIRouter(prefix="/api/gastos-comunes/convenios", tags=["Convenios de pago"], dependencies=[Depends(check_feature("gastos_comunes"))])
portal_router = APIRouter(prefix="/api/portal/convenio", tags=["Portal convenio"])
MESES_MOROSO = 3
_SCHEMA_OK = False


def _ensure(db: Session):
    global _SCHEMA_OK
    if _SCHEMA_OK:
        return
    try:
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS convenios_pago (
                id SERIAL PRIMARY KEY,
                tenant_id INTEGER NOT NULL REFERENCES tenants(id),
                departamento_id INTEGER NOT NULL,
                depto_numero VARCHAR(20),
                persona_nombre VARCHAR(150),
                monto_deuda NUMERIC(12,2) NOT NULL,
                pie NUMERIC(12,2) DEFAULT 0,
                cuotas INTEGER NOT NULL,
                monto_cuota NUMERIC(12,2) NOT NULL,
                fecha_primera_cuota DATE NOT NULL,
                estado VARCHAR(20) DEFAULT 'activo',   -- propuesto | activo | cumplido | incumplido | cancelado
                solicitado_por VARCHAR(20) DEFAULT 'admin',
                cobros_ids INTEGER[] DEFAULT '{}',
                notas TEXT,
                aprobado_por VARCHAR(150),
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS convenios_cuotas (
                id SERIAL PRIMARY KEY,
                convenio_id INTEGER NOT NULL REFERENCES convenios_pago(id) ON DELETE CASCADE,
                numero INTEGER NOT NULL,
                monto NUMERIC(12,2) NOT NULL,
                fecha_vencimiento DATE NOT NULL,
                estado VARCHAR(20) DEFAULT 'pendiente',
                fecha_pago TIMESTAMPTZ,
                metodo_pago VARCHAR(50)
            );
            CREATE INDEX IF NOT EXISTS ix_convenios_tenant ON convenios_pago(tenant_id, estado);
        """))
        db.commit(); _SCHEMA_OK = True
    except Exception:
        db.rollback()


# ---------------- helpers ----------------

def _deuda_depto(db: Session, tenant_id: int, departamento_id: int):
    """Cobros pendientes de periodos emitidos/cerrados: total, periodos vencidos y lista de ids."""
    rows = db.execute(text("""
        SELECT c.id, c.monto, c.fecha_vencimiento, p.periodo
        FROM gastos_cobros c JOIN gastos_periodos p ON p.id=c.periodo_id
        WHERE c.tenant_id=:t AND c.departamento_id=:d AND c.estado='pendiente' AND p.estado IN ('emitido','cerrado')
        ORDER BY p.periodo
    """), {"t": tenant_id, "d": departamento_id}).fetchall()
    hoy = date.today()
    total = sum(float(r[1]) for r in rows)
    periodos_vencidos = {r[3] for r in rows if r[2] and r[2] < hoy}
    return {"total": total, "meses_vencidos": len(periodos_vencidos), "periodos": sorted({r[3] for r in rows}), "cobros_ids": [r[0] for r in rows]}


def _convenio_dict(db: Session, row) -> dict:
    d = dict(row._mapping)
    for k in ("created_at", "fecha_primera_cuota"):
        d[k] = str(d[k]) if d.get(k) else None
    for k in ("monto_deuda", "pie", "monto_cuota"):
        d[k] = float(d[k] or 0)
    cuotas = db.execute(text("SELECT id, numero, monto, fecha_vencimiento::text, estado, fecha_pago::text, metodo_pago FROM convenios_cuotas WHERE convenio_id=:c ORDER BY numero"), {"c": d["id"]}).fetchall()
    d["cuotas_detalle"] = [{"id": q[0], "numero": q[1], "monto": float(q[2]), "fecha_vencimiento": q[3], "estado": q[4], "fecha_pago": q[5], "metodo_pago": q[6],
                           "vencida": q[4] == "pendiente" and date.fromisoformat(q[3]) < date.today()} for q in cuotas]
    d["pagadas"] = sum(1 for q in d["cuotas_detalle"] if q["estado"] == "pagado")
    d["proxima"] = next((q for q in d["cuotas_detalle"] if q["estado"] == "pendiente"), None)
    d["cobros_ids"] = list(d.get("cobros_ids") or [])
    return d


def _crear(db: Session, tenant_id: int, departamento_id: int, cuotas: int, pie: float, fecha_primera: date, notas: Optional[str], solicitado_por: str, estado: str, aprobado_por: Optional[str]):
    deuda = _deuda_depto(db, tenant_id, departamento_id)
    if deuda["total"] <= 0:
        raise HTTPException(400, "Este departamento no tiene deuda pendiente")
    if not (1 <= cuotas <= 24):
        raise HTTPException(400, "El convenio debe tener entre 1 y 24 cuotas")
    if pie < 0 or pie >= deuda["total"]:
        raise HTTPException(400, "El pie debe ser menor que la deuda total")
    abierto = db.execute(text("SELECT id FROM convenios_pago WHERE tenant_id=:t AND departamento_id=:d AND estado IN ('propuesto','activo')"), {"t": tenant_id, "d": departamento_id}).fetchone()
    if abierto:
        raise HTTPException(400, f"Ya existe un convenio #{abierto[0]} en curso para este departamento")
    dep = db.execute(text("SELECT d.numero, COALESCE(rp.nombre_completo, p.nombre_completo) FROM departamentos d "
                          "LEFT JOIN residentes_portal rp ON rp.departamento_id=d.id AND rp.tenant_id=d.tenant_id "
                          "LEFT JOIN personas p ON p.id=d.residente_id WHERE d.id=:d AND d.tenant_id=:t LIMIT 1"), {"d": departamento_id, "t": tenant_id}).fetchone()
    if not dep:
        raise HTTPException(404, "Departamento no encontrado")
    monto_cuota = round((deuda["total"] - pie) / cuotas, 0)
    cid = db.execute(text("""
        INSERT INTO convenios_pago (tenant_id, departamento_id, depto_numero, persona_nombre, monto_deuda, pie, cuotas, monto_cuota, fecha_primera_cuota, estado, solicitado_por, cobros_ids, notas, aprobado_por)
        VALUES (:t, :d, :num, :pn, :md, :pie, :n, :mc, :f, :e, :sp, :ids, :notas, :ap) RETURNING id
    """), {"t": tenant_id, "d": departamento_id, "num": dep[0], "pn": dep[1], "md": deuda["total"], "pie": pie, "n": cuotas, "mc": monto_cuota,
           "f": fecha_primera, "e": estado, "sp": solicitado_por, "ids": deuda["cobros_ids"], "notas": notas, "ap": aprobado_por}).scalar()
    for i in range(cuotas):
        # misma fecha, i meses despues
        m = fecha_primera.month - 1 + i
        fv = date(fecha_primera.year + m // 12, m % 12 + 1, min(fecha_primera.day, 28))
        db.execute(text("INSERT INTO convenios_cuotas (convenio_id, numero, monto, fecha_vencimiento) VALUES (:c, :n, :m, :f)"), {"c": cid, "n": i + 1, "m": monto_cuota, "f": fv})
    if estado == "activo":
        _activar_cobros(db, tenant_id, deuda["cobros_ids"])
    return cid


def _activar_cobros(db: Session, tenant_id: int, ids: List[int]):
    if ids:
        db.execute(text("UPDATE gastos_cobros SET estado='convenio' WHERE tenant_id=:t AND id = ANY(:ids) AND estado='pendiente'"), {"t": tenant_id, "ids": ids})


# ---------------- admin ----------------

class ConvenioIn(BaseModel):
    departamento_id: int
    cuotas: int = Field(6, ge=1, le=24)
    pie: float = 0
    fecha_primera_cuota: Optional[str] = None
    notas: Optional[str] = None


@router.get("/morosos")
def morosos(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Departamentos con >= 3 periodos vencidos (y su deuda), mas los que ya tienen convenio."""
    _ensure(db)
    tid = current_user["tenant_id"]
    rows = db.execute(text("""
        SELECT c.departamento_id, c.depto_numero, MAX(c.nombre_residente) AS residente,
               SUM(c.monto)::float AS deuda,
               COUNT(DISTINCT p.periodo) FILTER (WHERE c.fecha_vencimiento < CURRENT_DATE) AS meses_vencidos,
               COUNT(DISTINCT p.periodo) AS periodos_pendientes,
               MIN(p.periodo) AS desde
        FROM gastos_cobros c JOIN gastos_periodos p ON p.id=c.periodo_id
        WHERE c.tenant_id=:t AND c.estado='pendiente' AND p.estado IN ('emitido','cerrado') AND c.departamento_id IS NOT NULL
        GROUP BY c.departamento_id, c.depto_numero
        HAVING COUNT(DISTINCT p.periodo) FILTER (WHERE c.fecha_vencimiento < CURRENT_DATE) >= :m
        ORDER BY deuda DESC
    """), {"t": tid, "m": MESES_MOROSO}).fetchall()
    conv = {r[0]: r[1] for r in db.execute(text("SELECT departamento_id, id FROM convenios_pago WHERE tenant_id=:t AND estado IN ('propuesto','activo')"), {"t": tid}).fetchall()}
    return {"umbral_meses": MESES_MOROSO, "morosos": [dict(r._mapping, convenio_id=conv.get(r[0])) for r in rows]}


@router.get("")
def listar(estado: Optional[str] = None, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    _ensure(db)
    sql = "SELECT * FROM convenios_pago WHERE tenant_id=:t"; params: dict = {"t": current_user["tenant_id"]}
    if estado:
        sql += " AND estado=:e"; params["e"] = estado
    sql += " ORDER BY (estado='propuesto') DESC, (estado='activo') DESC, created_at DESC"
    return [_convenio_dict(db, r) for r in db.execute(text(sql), params).fetchall()]


@router.get("/simular")
def simular(departamento_id: int, cuotas: int = 6, pie: float = 0, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    _ensure(db)
    d = _deuda_depto(db, current_user["tenant_id"], departamento_id)
    cuotas = max(1, min(24, cuotas))
    return {**d, "pie": pie, "cuotas": cuotas, "monto_cuota": round(max(d["total"] - pie, 0) / cuotas, 0)}


@router.post("", status_code=201)
def crear(body: ConvenioIn, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    _ensure(db)
    f = date.fromisoformat(body.fecha_primera_cuota) if body.fecha_primera_cuota else (date.today().replace(day=1) + timedelta(days=40)).replace(day=10)
    cid = _crear(db, current_user["tenant_id"], body.departamento_id, body.cuotas, body.pie or 0, f, body.notas, "admin", "activo", current_user.get("nombre_completo"))
    db.commit()
    return _convenio_dict(db, db.execute(text("SELECT * FROM convenios_pago WHERE id=:id"), {"id": cid}).fetchone())


@router.patch("/{cid}/aprobar")
def aprobar(cid: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    _ensure(db)
    tid = current_user["tenant_id"]
    row = db.execute(text("SELECT id, estado, cobros_ids FROM convenios_pago WHERE id=:id AND tenant_id=:t"), {"id": cid, "t": tid}).fetchone()
    if not row: raise HTTPException(404, "Convenio no encontrado")
    if row[1] != "propuesto": raise HTTPException(400, "El convenio no está pendiente de aprobación")
    db.execute(text("UPDATE convenios_pago SET estado='activo', aprobado_por=:a WHERE id=:id"), {"a": current_user.get("nombre_completo"), "id": cid})
    _activar_cobros(db, tid, list(row[2] or []))
    db.commit()
    return {"ok": True, "estado": "activo"}


@router.patch("/{cid}/cancelar")
def cancelar(cid: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Cancela (o rechaza) el convenio: los cobros vuelven a 'pendiente'."""
    _ensure(db)
    tid = current_user["tenant_id"]
    row = db.execute(text("SELECT id, estado, cobros_ids FROM convenios_pago WHERE id=:id AND tenant_id=:t"), {"id": cid, "t": tid}).fetchone()
    if not row: raise HTTPException(404, "Convenio no encontrado")
    db.execute(text("UPDATE convenios_pago SET estado='cancelado' WHERE id=:id"), {"id": cid})
    db.execute(text("UPDATE gastos_cobros SET estado='pendiente' WHERE tenant_id=:t AND id = ANY(:ids) AND estado='convenio'"), {"t": tid, "ids": list(row[2] or [])})
    db.commit()
    return {"ok": True, "estado": "cancelado"}


class PagoCuotaIn(BaseModel):
    metodo_pago: str = "transferencia"


@router.patch("/{cid}/cuotas/{numero}/pagar")
def pagar_cuota(cid: int, numero: int, body: PagoCuotaIn = PagoCuotaIn(), db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    _ensure(db)
    tid = current_user["tenant_id"]
    row = db.execute(text("SELECT id, cobros_ids, cuotas FROM convenios_pago WHERE id=:id AND tenant_id=:t AND estado='activo'"), {"id": cid, "t": tid}).fetchone()
    if not row: raise HTTPException(404, "Convenio activo no encontrado")
    r = db.execute(text("UPDATE convenios_cuotas SET estado='pagado', fecha_pago=NOW(), metodo_pago=:m WHERE convenio_id=:c AND numero=:n AND estado='pendiente'"), {"m": body.metodo_pago, "c": cid, "n": numero})
    if r.rowcount == 0: raise HTTPException(400, "Cuota no encontrada o ya pagada")
    pend = db.execute(text("SELECT COUNT(*) FROM convenios_cuotas WHERE convenio_id=:c AND estado='pendiente'"), {"c": cid}).scalar()
    if pend == 0:
        db.execute(text("UPDATE convenios_pago SET estado='cumplido' WHERE id=:id"), {"id": cid})
        db.execute(text("UPDATE gastos_cobros SET estado='pagado', fecha_pago=NOW(), metodo_pago='convenio' WHERE tenant_id=:t AND id = ANY(:ids) AND estado='convenio'"), {"t": tid, "ids": list(row[1] or [])})
    db.commit()
    return {"ok": True, "cuotas_pendientes": pend, "estado": "cumplido" if pend == 0 else "activo"}


# ---------------- portal residente ----------------

class SolicitudIn(BaseModel):
    cuotas: int = Field(6, ge=1, le=24)
    pie: float = 0
    mensaje: Optional[str] = None


@portal_router.get("")
def mi_convenio(r: ResidentePortal = Depends(get_residente), db: Session = Depends(get_db)):
    _ensure(db)
    if not r.departamento_id:
        return {"puede_solicitar": False, "deuda": None, "convenio": None}
    deuda = _deuda_depto(db, r.tenant_id, r.departamento_id)
    row = db.execute(text("SELECT * FROM convenios_pago WHERE tenant_id=:t AND departamento_id=:d AND estado IN ('propuesto','activo') ORDER BY created_at DESC LIMIT 1"), {"t": r.tenant_id, "d": r.departamento_id}).fetchone()
    return {"umbral_meses": MESES_MOROSO, "deuda": deuda, "convenio": _convenio_dict(db, row) if row else None,
            "puede_solicitar": (row is None and deuda["meses_vencidos"] >= MESES_MOROSO)}


@portal_router.post("/solicitar", status_code=201)
def solicitar(body: SolicitudIn, r: ResidentePortal = Depends(get_residente), db: Session = Depends(get_db)):
    """El residente propone un convenio; queda 'propuesto' hasta que administracion lo apruebe."""
    _ensure(db)
    if not r.departamento_id:
        raise HTTPException(400, "Tu cuenta no tiene departamento asignado")
    deuda = _deuda_depto(db, r.tenant_id, r.departamento_id)
    if deuda["meses_vencidos"] < MESES_MOROSO:
        raise HTTPException(400, f"El convenio aplica desde {MESES_MOROSO} meses vencidos")
    f = (date.today().replace(day=1) + timedelta(days=40)).replace(day=10)
    cid = _crear(db, r.tenant_id, r.departamento_id, body.cuotas, body.pie or 0, f, body.mensaje, "residente", "propuesto", None)
    db.commit()
    return {"ok": True, "convenio_id": cid, "estado": "propuesto"}
