"""
Presupuesto Anual por Condominio
Permite planificar gastos por categoria y mes, comparando con el gasto real.
"""
import os
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
from app.core.database import get_db

router = APIRouter(prefix="/api/presupuesto", tags=["presupuesto"])

# ── Categorias predefinidas ────────────────────────────────────────────────
CATEGORIAS_DEFAULT = [
    {"nombre": "Administración",      "icono": "🏢", "color": "#6366f1"},
    {"nombre": "Gastos Comunes",      "icono": "🏠", "color": "#0ea5e9"},
    {"nombre": "Mantención",          "icono": "🔧", "color": "#f59e0b"},
    {"nombre": "Limpieza",            "icono": "🧹", "color": "#10b981"},
    {"nombre": "Seguridad",           "icono": "🔒", "color": "#ef4444"},
    {"nombre": "Áreas Comunes",       "icono": "🌳", "color": "#84cc16"},
    {"nombre": "Servicios Básicos",   "icono": "💡", "color": "#f97316"},
    {"nombre": "Seguros",             "icono": "🛡️", "color": "#8b5cf6"},
    {"nombre": "Reserva Emergencia",  "icono": "⚡", "color": "#06b6d4"},
    {"nombre": "Otros",               "icono": "📋", "color": "#64748b"},
]

# ── Auto-create tables ─────────────────────────────────────────────────────
def _init(db: Session):
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS presupuesto_categorias (
            id SERIAL PRIMARY KEY,
            tenant_id INTEGER NOT NULL,
            condominio_id INTEGER NOT NULL,
            nombre VARCHAR(100) NOT NULL,
            icono VARCHAR(20) DEFAULT '📋',
            color VARCHAR(20) DEFAULT '#6366f1',
            activa BOOLEAN DEFAULT true,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    """))
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS presupuesto_anual (
            id SERIAL PRIMARY KEY,
            tenant_id INTEGER NOT NULL,
            condominio_id INTEGER NOT NULL,
            categoria_id INTEGER NOT NULL,
            anio INTEGER NOT NULL,
            mes INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
            monto_proyectado DECIMAL(14,2) DEFAULT 0,
            monto_real DECIMAL(14,2) DEFAULT 0,
            notas TEXT,
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE (condominio_id, categoria_id, anio, mes)
        )
    """))
    db.execute(text("""
        CREATE INDEX IF NOT EXISTS idx_presupuesto_condominio_anio
        ON presupuesto_anual (condominio_id, anio)
    """))
    db.commit()


def _ensure_categorias(condominio_id: int, tenant_id: int, db: Session):
    """Crea categorias por defecto si el condominio no tiene ninguna."""
    count = db.execute(text(
        "SELECT COUNT(*) FROM presupuesto_categorias WHERE condominio_id=:cid"
    ), {"cid": condominio_id}).scalar()
    if count == 0:
        for cat in CATEGORIAS_DEFAULT:
            db.execute(text("""
                INSERT INTO presupuesto_categorias (tenant_id, condominio_id, nombre, icono, color)
                VALUES (:tid, :cid, :nombre, :icono, :color)
            """), {"tid": tenant_id, "cid": condominio_id, **cat})
        db.commit()


# ── Schemas ───────────────────────────────────────────────────────────────
class PresupuestoUpsert(BaseModel):
    categoria_id: int
    mes: int
    monto_proyectado: Optional[float] = None
    monto_real: Optional[float] = None
    notas: Optional[str] = None

class CategoriaCreate(BaseModel):
    nombre: str
    icono: Optional[str] = "📋"
    color: Optional[str] = "#6366f1"

class CategoriaUpdate(BaseModel):
    nombre: Optional[str] = None
    icono: Optional[str] = None
    color: Optional[str] = None
    activa: Optional[bool] = None


# ── Endpoints ─────────────────────────────────────────────────────────────

@router.get("/categorias")
def get_categorias(condominio_id: int, tenant_id: int = 1, db: Session = Depends(get_db)):
    """Listar categorias del condominio (crea las default si no existen)"""
    _init(db)
    _ensure_categorias(condominio_id, tenant_id, db)
    rows = db.execute(text("""
        SELECT id, nombre, icono, color, activa
        FROM presupuesto_categorias
        WHERE condominio_id = :cid AND activa = true
        ORDER BY nombre
    """), {"cid": condominio_id}).fetchall()
    return [dict(r._mapping) for r in rows]


@router.post("/categorias")
def crear_categoria(condominio_id: int, tenant_id: int = 1, body: CategoriaCreate = ..., db: Session = Depends(get_db)):
    _init(db)
    row = db.execute(text("""
        INSERT INTO presupuesto_categorias (tenant_id, condominio_id, nombre, icono, color)
        VALUES (:tid, :cid, :nombre, :icono, :color)
        RETURNING id, nombre, icono, color, activa
    """), {"tid": tenant_id, "cid": condominio_id, "nombre": body.nombre, "icono": body.icono, "color": body.color}).fetchone()
    db.commit()
    return dict(row._mapping)


@router.patch("/categorias/{cat_id}")
def actualizar_categoria(cat_id: int, body: CategoriaUpdate, db: Session = Depends(get_db)):
    _init(db)
    sets, params = [], {"cid": cat_id}
    if body.nombre is not None: sets.append("nombre=:nombre"); params["nombre"] = body.nombre
    if body.icono is not None: sets.append("icono=:icono"); params["icono"] = body.icono
    if body.color is not None: sets.append("color=:color"); params["color"] = body.color
    if body.activa is not None: sets.append("activa=:activa"); params["activa"] = body.activa
    if not sets: return {"ok": True}
    db.execute(text(f"UPDATE presupuesto_categorias SET {', '.join(sets)} WHERE id=:cid"), params)
    db.commit()
    return {"ok": True}


@router.get("/anual")
def get_presupuesto_anual(condominio_id: int, anio: int, tenant_id: int = 1, db: Session = Depends(get_db)):
    """
    Devuelve la tabla completa: categorias × 12 meses con proyectado, real y varianza.
    También calcula el real desde gastos_comunes cuando monto_real=0.
    """
    _init(db)
    _ensure_categorias(condominio_id, tenant_id, db)

    cats = db.execute(text("""
        SELECT id, nombre, icono, color FROM presupuesto_categorias
        WHERE condominio_id=:cid AND activa=true ORDER BY nombre
    """), {"cid": condominio_id}).fetchall()

    rows = db.execute(text("""
        SELECT categoria_id, mes, monto_proyectado, monto_real, notas
        FROM presupuesto_anual
        WHERE condominio_id=:cid AND anio=:anio
    """), {"cid": condominio_id, "anio": anio}).fetchall()

    # Build lookup {(cat_id, mes): row}
    data_map = {(r.categoria_id, r.mes): r for r in rows}

    # Get real gastos from gastos_comunes (estado=pagado/parcial) per month
    gc_real = db.execute(text("""
        SELECT mes, SUM(monto_total) as total
        FROM gastos_comunes
        WHERE departamento_id IN (
            SELECT id FROM departamentos WHERE condominio_id=:cid
        ) AND anio=:anio AND estado IN ('pagado','parcial')
        GROUP BY mes
    """), {"cid": condominio_id, "anio": anio}).fetchall()
    gc_map = {r.mes: float(r.total or 0) for r in gc_real}

    result = []
    for cat in cats:
        meses = []
        total_proy = 0
        total_real = 0
        for mes in range(1, 13):
            entry = data_map.get((cat.id, mes))
            proy = float(entry.monto_proyectado if entry else 0) or 0
            real = float(entry.monto_real if entry else 0) or 0
            # If no manual real, use gastos_comunes for "Gastos Comunes" category
            if real == 0 and cat.nombre == "Gastos Comunes":
                real = gc_map.get(mes, 0)
            notas = entry.notas if entry else None
            total_proy += proy
            total_real += real
            meses.append({
                "mes": mes,
                "proyectado": proy,
                "real": real,
                "varianza": real - proy,
                "pct": round((real / proy * 100) if proy > 0 else 0, 1),
                "notas": notas,
            })
        result.append({
            "id": cat.id,
            "nombre": cat.nombre,
            "icono": cat.icono,
            "color": cat.color,
            "meses": meses,
            "total_proyectado": total_proy,
            "total_real": total_real,
            "total_varianza": total_real - total_proy,
        })

    # Global totals per month
    totales_mes = []
    for mes in range(1, 13):
        tp = sum(cat_data["meses"][mes-1]["proyectado"] for cat_data in result)
        tr = sum(cat_data["meses"][mes-1]["real"] for cat_data in result)
        totales_mes.append({"mes": mes, "proyectado": tp, "real": tr, "varianza": tr - tp})

    return {
        "anio": anio,
        "condominio_id": condominio_id,
        "categorias": result,
        "totales_mes": totales_mes,
        "gran_total_proyectado": sum(c["total_proyectado"] for c in result),
        "gran_total_real": sum(c["total_real"] for c in result),
    }


@router.put("/anual")
def upsert_presupuesto(condominio_id: int, anio: int, tenant_id: int = 1, body: PresupuestoUpsert = ..., db: Session = Depends(get_db)):
    """Crear o actualizar un valor proyectado o real para categoría+mes"""
    _init(db)
    sets = ["updated_at=NOW()"]
    params = {
        "tid": tenant_id, "cid": condominio_id, "anio": anio,
        "cat": body.categoria_id, "mes": body.mes,
    }
    if body.monto_proyectado is not None: sets.append("monto_proyectado=:proy"); params["proy"] = body.monto_proyectado
    if body.monto_real is not None: sets.append("monto_real=:real"); params["real"] = body.monto_real
    if body.notas is not None: sets.append("notas=:notas"); params["notas"] = body.notas

    db.execute(text(f"""
        INSERT INTO presupuesto_anual (tenant_id, condominio_id, categoria_id, anio, mes,
            monto_proyectado, monto_real, notas, updated_at)
        VALUES (:tid, :cid, :cat, :anio, :mes,
            COALESCE(:proy, 0), COALESCE(:real, 0), :notas, NOW())
        ON CONFLICT (condominio_id, categoria_id, anio, mes) DO UPDATE
        SET {", ".join(sets)}
    """), {**params, "proy": body.monto_proyectado, "real": body.monto_real, "notas": body.notas})
    db.commit()
    return {"ok": True}


@router.get("/resumen")
def resumen_presupuesto(condominio_id: int, anio: int, tenant_id: int = 1, db: Session = Depends(get_db)):
    """Resumen ejecutivo: estado del presupuesto anual."""
    _init(db)
    data = get_presupuesto_anual(condominio_id, anio, tenant_id, db)
    mes_actual = __import__("datetime").datetime.now().month

    # Months elapsed
    meses_transcurridos = min(mes_actual, 12)
    proy_acumulado = sum(
        c["meses"][m-1]["proyectado"]
        for c in data["categorias"]
        for m in range(1, meses_transcurridos + 1)
    )
    real_acumulado = sum(
        c["meses"][m-1]["real"]
        for c in data["categorias"]
        for m in range(1, meses_transcurridos + 1)
    )

    # Top 3 categorias con mayor desviacion
    desviaciones = sorted(
        [{"nombre": c["nombre"], "icono": c["icono"], "varianza": c["total_varianza"]}
         for c in data["categorias"] if c["total_proyectado"] > 0],
        key=lambda x: abs(x["varianza"]), reverse=True
    )[:3]

    pct_ejecutado = round((real_acumulado / proy_acumulado * 100) if proy_acumulado > 0 else 0, 1)

    return {
        "anio": anio,
        "mes_actual": mes_actual,
        "gran_total_proyectado": data["gran_total_proyectado"],
        "gran_total_real": data["gran_total_real"],
        "proy_acumulado": proy_acumulado,
        "real_acumulado": real_acumulado,
        "pct_ejecutado": pct_ejecutado,
        "varianza_global": real_acumulado - proy_acumulado,
        "top_desviaciones": desviaciones,
    }
