import os
import json
from datetime import date, timedelta
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.database import get_db
from app.core.dependencies import get_current_user

router = APIRouter(prefix="/api/resumenes", tags=["Resumenes"])


def ensure_table(db):
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS resumenes_semanales (
            id SERIAL PRIMARY KEY,
            tenant_id INTEGER NOT NULL,
            fecha_desde DATE,
            fecha_hasta DATE,
            resumen_texto TEXT,
            resumen_json JSONB,
            generado_por VARCHAR(50) DEFAULT 'automatico',
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    """))
    db.commit()


def safe_count(db, query, params):
    try:
        row = db.execute(text(query), params).fetchone()
        return int(row[0]) if row else 0
    except Exception:
        db.rollback()
        return -1


def collect_stats(db, tenant_id, fecha_desde, fecha_hasta):
    p = {"tid": tenant_id, "desde": fecha_desde, "hasta": fecha_hasta}
    accesos_total = safe_count(db, "SELECT COUNT(*) FROM accesos WHERE tenant_id=:tid AND created_at::date BETWEEN :desde AND :hasta", p)
    accesos_denegados = safe_count(db, "SELECT COUNT(*) FROM accesos WHERE tenant_id=:tid AND estado='denegado' AND created_at::date BETWEEN :desde AND :hasta", p)
    visitas_total = safe_count(db, "SELECT COUNT(*) FROM visitas WHERE tenant_id=:tid AND created_at::date BETWEEN :desde AND :hasta", p)
    visitas_problemas = safe_count(db, "SELECT COUNT(*) FROM visitas WHERE tenant_id=:tid AND estado NOT IN ('completada','aprobada') AND created_at::date BETWEEN :desde AND :hasta", p)
    paq_pendientes = safe_count(db, "SELECT COUNT(*) FROM paqueteria WHERE tenant_id=:tid AND estado='pendiente' AND recibido_at::date BETWEEN :desde AND :hasta", p)
    paq_entregados = safe_count(db, "SELECT COUNT(*) FROM paqueteria WHERE tenant_id=:tid AND estado='entregado' AND recibido_at::date BETWEEN :desde AND :hasta", p)
    inc_total = safe_count(db, "SELECT COUNT(*) FROM incidencias WHERE tenant_id=:tid AND created_at::date BETWEEN :desde AND :hasta", p)
    inc_criticas = safe_count(db, "SELECT COUNT(*) FROM incidencias WHERE tenant_id=:tid AND severidad IN ('critica','alta') AND created_at::date BETWEEN :desde AND :hasta", p)
    alerta_criticas = safe_count(db, "SELECT COUNT(*) FROM alertas_sistema WHERE tenant_id=:tid AND nivel='critico' AND created_at::date BETWEEN :desde AND :hasta", p)
    alerta_advert = safe_count(db, "SELECT COUNT(*) FROM alertas_sistema WHERE tenant_id=:tid AND nivel='advertencia' AND created_at::date BETWEEN :desde AND :hasta", p)
    multas_total = safe_count(db, "SELECT COUNT(*) FROM multas WHERE tenant_id=:tid AND fecha_infraccion BETWEEN :desde AND :hasta", p)
    multas_monto = safe_count(db, "SELECT COALESCE(SUM(monto),0) FROM multas WHERE tenant_id=:tid AND fecha_infraccion BETWEEN :desde AND :hasta", p)
    gastos_pend = safe_count(db, "SELECT COUNT(*) FROM gastos_cobros WHERE tenant_id=:tid AND estado='pendiente' AND fecha_vencimiento BETWEEN :desde AND :hasta", p)
    gastos_pag = safe_count(db, "SELECT COUNT(*) FROM gastos_cobros WHERE tenant_id=:tid AND estado='pagado' AND fecha_vencimiento BETWEEN :desde AND :hasta", p)
    reservas_total = safe_count(db, "SELECT COUNT(*) FROM reservas WHERE tenant_id=:tid AND created_at::date BETWEEN :desde AND :hasta", p)
    return {
        "periodo": {"desde": str(fecha_desde), "hasta": str(fecha_hasta)},
        "accesos": {"total": accesos_total, "denegados": accesos_denegados},
        "visitas": {"total": visitas_total, "con_problemas": visitas_problemas},
        "paquetes": {"pendientes": paq_pendientes, "entregados": paq_entregados},
        "incidencias": {"total": inc_total, "criticas_o_altas": inc_criticas},
        "alertas_sistema": {"criticas": alerta_criticas, "advertencias": alerta_advert},
        "multas": {"total": multas_total, "monto_total": multas_monto},
        "gastos_comunes": {"pendientes": gastos_pend, "pagados": gastos_pag},
        "reservas": {"total": reservas_total},
    }


def build_prompt(stats):
    def v(x): return "N/D" if x == -1 else str(x)
    s = stats
    lines = [
        "Periodo: " + s["periodo"]["desde"] + " al " + s["periodo"]["hasta"],
        "Accesos: " + v(s["accesos"]["total"]) + " totales, " + v(s["accesos"]["denegados"]) + " denegados",
        "Visitas: " + v(s["visitas"]["total"]) + " totales, " + v(s["visitas"]["con_problemas"]) + " con problemas",
        "Paqueteria: " + v(s["paquetes"]["entregados"]) + " entregados, " + v(s["paquetes"]["pendientes"]) + " pendientes",
        "Incidencias: " + v(s["incidencias"]["total"]) + " totales, " + v(s["incidencias"]["criticas_o_altas"]) + " criticas/altas",
        "Alertas sistema: " + v(s["alertas_sistema"]["criticas"]) + " criticas, " + v(s["alertas_sistema"]["advertencias"]) + " advertencias",
        "Multas: " + v(s["multas"]["total"]) + " registradas, monto total " + v(s["multas"]["monto_total"]),
        "Gastos comunes: " + v(s["gastos_comunes"]["pagados"]) + " pagados, " + v(s["gastos_comunes"]["pendientes"]) + " pendientes",
        "Reservas: " + v(s["reservas"]["total"]) + " realizadas esta semana",
    ]
    data_block = "\n".join(lines)
    return (
        "Eres el sistema de reportes ejecutivos de un condominio en Chile.\n"
        "Con base en los siguientes datos de la semana pasada, escribe un resumen ejecutivo en espanol de aproximadamente 200 palabras.\n"
        "El resumen debe incluir: estado general del condominio, puntos de atencion, y exactamente 3 recomendaciones de accion concretas.\n"
        "Responde SOLO con JSON valido (sin markdown) en este formato exacto:\n"
        "{\"resumen\": \"...texto ejecutivo de ~200 palabras...\", \"recomendaciones\": [\"rec1\", \"rec2\", \"rec3\"], \"estado_general\": \"bueno|regular|critico\"}\n\n"
        "Datos del periodo:\n" + data_block
    )


@router.post("/generar")
async def generar_resumen(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_id = current_user["tenant_id"]
    ensure_table(db)
    api_key = os.getenv("ANTHROPIC_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=503, detail="ANTHROPIC_API_KEY no configurada")
    fecha_hasta = date.today()
    fecha_desde = fecha_hasta - timedelta(days=7)
    stats = collect_stats(db, tenant_id, fecha_desde, fecha_hasta)
    prompt = build_prompt(stats)
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=api_key)
        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}]
        )
        raw = message.content[0].text.strip()
        if raw.startswith("```"):
            raw = "\n".join(raw.split("\n")[1:])
            if raw.endswith("```"):
                raw = raw[:-3]
            raw = raw.strip()
        result_json = json.loads(raw)
    except json.JSONDecodeError:
        result_json = {"resumen": raw, "recomendaciones": [], "estado_general": "regular"}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Error al llamar a Claude: " + str(e)[:200])
    resumen_texto = result_json.get("resumen", "")
    resumen_full = dict(result_json)
    resumen_full["stats"] = stats
    db.rollback()
    db.execute(text("""
        INSERT INTO resumenes_semanales (tenant_id, fecha_desde, fecha_hasta, resumen_texto, resumen_json, generado_por)
        VALUES (:tid, :desde, :hasta, :texto, CAST(:json_data AS jsonb), 'automatico')
    """), {"tid": tenant_id, "desde": fecha_desde, "hasta": fecha_hasta, "texto": resumen_texto, "json_data": json.dumps(resumen_full)})
    db.commit()
    row = db.execute(text("SELECT id, created_at FROM resumenes_semanales WHERE tenant_id=:tid ORDER BY id DESC LIMIT 1"), {"tid": tenant_id}).fetchone()
    return {
        "id": row[0] if row else None,
        "tenant_id": tenant_id,
        "fecha_desde": str(fecha_desde),
        "fecha_hasta": str(fecha_hasta),
        "resumen_texto": resumen_texto,
        "recomendaciones": result_json.get("recomendaciones", []),
        "estado_general": result_json.get("estado_general", "regular"),
        "stats": stats,
        "created_at": str(row[1]) if row else None,
    }


@router.get("")
def listar_resumenes(limit: int = Query(10, ge=1, le=50), current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_id = current_user["tenant_id"]
    ensure_table(db)
    rows = db.execute(text("""
        SELECT id, tenant_id, fecha_desde, fecha_hasta,
               LEFT(resumen_texto, 200) AS preview,
               resumen_json->>'estado_general' AS estado_general,
               generado_por, created_at
        FROM resumenes_semanales WHERE tenant_id = :tid ORDER BY id DESC LIMIT :lim
    """), {"tid": tenant_id, "lim": limit}).fetchall()
    return [{
        "id": r[0], "tenant_id": r[1],
        "fecha_desde": str(r[2]) if r[2] else None,
        "fecha_hasta": str(r[3]) if r[3] else None,
        "preview": (r[4] or "") + ("..." if r[4] and len(r[4]) == 200 else ""),
        "estado_general": r[5] or "regular",
        "generado_por": r[6],
        "created_at": str(r[7]) if r[7] else None,
    } for r in rows]


@router.get("/{resumen_id}")
def obtener_resumen(resumen_id: int, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_id = current_user["tenant_id"]
    ensure_table(db)
    row = db.execute(text("""
        SELECT id, tenant_id, fecha_desde, fecha_hasta, resumen_texto, resumen_json, generado_por, created_at
        FROM resumenes_semanales WHERE id = :rid AND tenant_id = :tid
    """), {"rid": resumen_id, "tid": tenant_id}).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Resumen no encontrado")
    rj = row[5] or {}
    return {
        "id": row[0], "tenant_id": row[1],
        "fecha_desde": str(row[2]) if row[2] else None,
        "fecha_hasta": str(row[3]) if row[3] else None,
        "resumen_texto": row[4],
        "recomendaciones": rj.get("recomendaciones", []),
        "estado_general": rj.get("estado_general", "regular"),
        "stats": rj.get("stats", {}),
        "generado_por": row[6],
        "created_at": str(row[7]) if row[7] else None,
    }


@router.post("/programar")
def programar_resumen(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_id = current_user["tenant_id"]
    ensure_table(db)
    try:
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS resumenes_config (
                tenant_id INTEGER PRIMARY KEY, activo BOOLEAN DEFAULT TRUE,
                dia_semana INTEGER DEFAULT 1, updated_at TIMESTAMPTZ DEFAULT NOW()
            )
        """))
        db.execute(text("""
            INSERT INTO resumenes_config (tenant_id, activo, dia_semana) VALUES (:tid, TRUE, 1)
            ON CONFLICT (tenant_id) DO UPDATE SET activo=TRUE, updated_at=NOW()
        """), {"tid": tenant_id})
        db.commit()
    except Exception:
        pass
    return {"ok": True, "mensaje": "Resumen semanal automatico activado para el lunes de cada semana"}
