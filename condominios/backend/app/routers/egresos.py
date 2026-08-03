from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional
from pydantic import BaseModel
from app.core.database import get_db
from app.core.dependencies import get_current_user

router = APIRouter(prefix="/api/egresos", tags=["Egresos"])

CATEGORIAS = [
    "Electricidad", "Gas", "Agua / Alcantarillado", "Internet / Telefonia",
    "Personal / Remuneraciones", "Mantencion y Reparaciones", "Limpieza",
    "Administracion", "Seguro Edificio", "Fondo de Reserva",
    "Ascensor", "Piscina / Jardin", "Otros"
]


def _init(db: Session):
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS egresos_condominio (
            id SERIAL PRIMARY KEY,
            tenant_id INTEGER NOT NULL,
            condominio_id INTEGER,
            fecha DATE NOT NULL,
            categoria VARCHAR(80) NOT NULL,
            concepto VARCHAR(200) NOT NULL,
            monto DECIMAL(12,2) NOT NULL,
            proveedor VARCHAR(200),
            numero_factura VARCHAR(80),
            notas TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    """))
    db.execute(text("CREATE INDEX IF NOT EXISTS idx_egresos_tenant ON egresos_condominio(tenant_id)"))
    db.execute(text("CREATE INDEX IF NOT EXISTS idx_egresos_fecha ON egresos_condominio(fecha)"))
    db.commit()


class EgresoCreate(BaseModel):
    condominio_id: Optional[int] = None
    fecha: str
    categoria: str
    concepto: str
    monto: float
    proveedor: Optional[str] = None
    numero_factura: Optional[str] = None
    notas: Optional[str] = None


class EgresoUpdate(BaseModel):
    fecha: Optional[str] = None
    categoria: Optional[str] = None
    concepto: Optional[str] = None
    monto: Optional[float] = None
    proveedor: Optional[str] = None
    numero_factura: Optional[str] = None
    notas: Optional[str] = None


@router.get("/categorias")
def get_categorias(current_user: dict = Depends(get_current_user)):
    return CATEGORIAS


@router.get("")
def list_egresos(
    condominio_id: Optional[int] = None,
    desde: Optional[str] = None,
    hasta: Optional[str] = None,
    categoria: Optional[str] = None,
    limit: int = 500,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    _init(db)
    tid = current_user["tenant_id"]
    filters = ["e.tenant_id = :tid"]
    params: dict = {"tid": tid, "limit": limit}
    if condominio_id:
        filters.append("e.condominio_id = :cid")
        params["cid"] = condominio_id
    if desde:
        filters.append("e.fecha >= :desde")
        params["desde"] = desde
    if hasta:
        filters.append("e.fecha <= :hasta")
        params["hasta"] = hasta
    if categoria:
        filters.append("e.categoria = :cat")
        params["cat"] = categoria
    where = " AND ".join(filters)
    rows = db.execute(text(f"""
        SELECT e.*, c.nombre as condominio_nombre
        FROM egresos_condominio e
        LEFT JOIN condominios c ON c.id = e.condominio_id
        WHERE {where}
        ORDER BY e.fecha DESC, e.id DESC
        LIMIT :limit
    """), params).fetchall()
    return [dict(r._mapping) for r in rows]


@router.post("", status_code=201)
def create_egreso(
    body: EgresoCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    _init(db)
    tid = current_user["tenant_id"]
    row = db.execute(text("""
        INSERT INTO egresos_condominio
            (tenant_id, condominio_id, fecha, categoria, concepto, monto, proveedor, numero_factura, notas)
        VALUES (:tid, :cid, :fecha, :cat, :concepto, :monto, :proveedor, :nfact, :notas)
        RETURNING *
    """), {
        "tid": tid, "cid": body.condominio_id, "fecha": body.fecha,
        "cat": body.categoria, "concepto": body.concepto, "monto": body.monto,
        "proveedor": body.proveedor, "nfact": body.numero_factura, "notas": body.notas,
    }).fetchone()
    db.commit()
    return dict(row._mapping)


@router.patch("/{eid}")
def update_egreso(
    eid: int,
    body: EgresoUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    tid = current_user["tenant_id"]
    data = body.dict(exclude_none=True)
    if not data:
        raise HTTPException(400, "Sin cambios")
    sets = ", ".join(f"{k} = :{k}" for k in data)
    params = {**data, "eid": eid, "tid": tid}
    db.execute(text(f"UPDATE egresos_condominio SET {sets} WHERE id=:eid AND tenant_id=:tid"), params)
    db.commit()
    return {"ok": True}


@router.delete("/{eid}")
def delete_egreso(
    eid: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    tid = current_user["tenant_id"]
    db.execute(text("DELETE FROM egresos_condominio WHERE id=:eid AND tenant_id=:tid"), {"eid": eid, "tid": tid})
    db.commit()
    return {"ok": True}


@router.get("/stats")
def stats_egresos(
    condominio_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    _init(db)
    tid = current_user["tenant_id"]
    cond = "tenant_id = :tid" + (" AND condominio_id = :cid" if condominio_id else "")
    params: dict = {"tid": tid}
    if condominio_id:
        params["cid"] = condominio_id

    por_cat = db.execute(text(f"""
        SELECT categoria, COALESCE(SUM(monto),0)::float as monto
        FROM egresos_condominio
        WHERE {cond}
          AND DATE_TRUNC('month', fecha) = DATE_TRUNC('month', CURRENT_DATE)
        GROUP BY categoria ORDER BY monto DESC
    """), params).fetchall()

    prev = db.execute(text(f"""
        SELECT COALESCE(SUM(monto),0)::float as total FROM egresos_condominio
        WHERE {cond}
          AND DATE_TRUNC('month', fecha) = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
    """), params).fetchone()

    trend = db.execute(text(f"""
        SELECT TO_CHAR(DATE_TRUNC('month', fecha),'YYYY-MM') as periodo,
               COALESCE(SUM(monto),0)::float as total
        FROM egresos_condominio
        WHERE {cond} AND fecha >= CURRENT_DATE - INTERVAL '6 months'
        GROUP BY periodo ORDER BY periodo
    """), params).fetchall()

    cats = [{"categoria": r.categoria, "monto": r.monto} for r in por_cat]
    return {
        "total_mes": sum(c["monto"] for c in cats),
        "total_mes_anterior": prev.total if prev else 0,
        "por_categoria": cats,
        "tendencia": [{"periodo": r.periodo, "total": r.total} for r in trend],
    }


@router.get("/dashboard")
def dashboard_financiero(
    condominio_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """KPIs financieros consolidados."""
    _init(db)
    tid = current_user["tenant_id"]
    cond_e = "tenant_id = :tid" + (" AND condominio_id = :cid" if condominio_id else "")
    params: dict = {"tid": tid}
    if condominio_id:
        params["cid"] = condominio_id

    rec = db.execute(text("""
        SELECT
            COALESCE(SUM(CASE WHEN estado='pagado' THEN monto ELSE 0 END),0)::float as pagado,
            COALESCE(SUM(CASE WHEN estado NOT IN ('pagado','exento') THEN monto ELSE 0 END),0)::float as pendiente,
            COALESCE(SUM(monto),0)::float as total
        FROM gastos_cobros
        WHERE tenant_id=:tid
          AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)
    """), {"tid": tid}).fetchone()

    total_cobros = rec.total if rec else 0
    recaudado = rec.pagado if rec else 0
    pendiente = rec.pendiente if rec else 0
    pct_rec = round(recaudado / total_cobros * 100) if total_cobros > 0 else 0
    pct_mor = round(pendiente / total_cobros * 100) if total_cobros > 0 else 0

    eg = db.execute(text(f"""
        SELECT
            COALESCE(SUM(CASE WHEN DATE_TRUNC('month',fecha)=DATE_TRUNC('month',CURRENT_DATE) THEN monto END),0)::float as mes,
            COALESCE(SUM(CASE WHEN DATE_TRUNC('month',fecha)=DATE_TRUNC('month',CURRENT_DATE-INTERVAL '1 month') THEN monto END),0)::float as mes_anterior
        FROM egresos_condominio WHERE {cond_e}
    """), params).fetchone()

    egresos_mes = eg.mes if eg else 0
    egresos_ant = eg.mes_anterior if eg else 0

    fondo_row = db.execute(text(
        "SELECT COALESCE(SUM(saldo),0)::float as saldo FROM gastos_fondo_reserva WHERE tenant_id=:tid"
    ), {"tid": tid}).fetchone()
    fondo = fondo_row.saldo if fondo_row else 0

    medios = db.execute(text("""
        SELECT COALESCE(metodo_pago,'Sin especificar') as metodo,
               COUNT(*)::int as count,
               COALESCE(SUM(monto),0)::float as monto
        FROM gastos_cobros
        WHERE tenant_id=:tid AND estado='pagado'
          AND fecha_pago >= DATE_TRUNC('month', CURRENT_DATE)
        GROUP BY metodo_pago ORDER BY monto DESC
    """), {"tid": tid}).fetchall()

    morosos = db.execute(text("""
        SELECT
            COALESCE(depto_numero,'?') as depto,
            COALESCE(nombre_residente,'Sin nombre') as residente,
            COUNT(*)::int as meses,
            COALESCE(SUM(monto),0)::float as deuda
        FROM gastos_cobros
        WHERE tenant_id=:tid AND estado NOT IN ('pagado','exento')
        GROUP BY depto_numero, nombre_residente
        ORDER BY deuda DESC
        LIMIT 10
    """), {"tid": tid}).fetchall()

    trend = db.execute(text("""
        SELECT
            TO_CHAR(DATE_TRUNC('month', created_at),'YYYY-MM') as periodo,
            COALESCE(SUM(CASE WHEN estado='pagado' THEN monto ELSE 0 END),0)::float as recaudado,
            COALESCE(SUM(CASE WHEN estado NOT IN ('pagado','exento') THEN monto ELSE 0 END),0)::float as pendiente
        FROM gastos_cobros
        WHERE tenant_id=:tid AND created_at >= CURRENT_DATE - INTERVAL '6 months'
        GROUP BY periodo ORDER BY periodo
    """), {"tid": tid}).fetchall()

    cats_egreso = db.execute(text(f"""
        SELECT categoria, COALESCE(SUM(monto),0)::float as monto
        FROM egresos_condominio WHERE {cond_e}
          AND DATE_TRUNC('month',fecha)=DATE_TRUNC('month',CURRENT_DATE)
        GROUP BY categoria ORDER BY monto DESC
    """), params).fetchall()

    return {
        "recaudado_mes": recaudado,
        "pendiente_mes": pendiente,
        "total_cobros_mes": total_cobros,
        "pct_recaudacion": pct_rec,
        "pct_morosidad": pct_mor,
        "egresos_mes": egresos_mes,
        "egresos_mes_anterior": egresos_ant,
        "fondo_reserva": fondo,
        "medios_pago": [{"metodo": r.metodo, "count": r.count, "monto": r.monto} for r in medios],
        "top_morosos": [{"depto": r.depto, "residente": r.residente, "meses": r.meses, "deuda": r.deuda} for r in morosos],
        "tendencia_6m": [{"periodo": r.periodo, "recaudado": r.recaudado, "pendiente": r.pendiente} for r in trend],
        "egresos_por_categoria": [{"categoria": r.categoria, "monto": r.monto} for r in cats_egreso],
    }
