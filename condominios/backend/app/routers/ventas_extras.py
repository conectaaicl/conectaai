"""
Extras de Ventas Terreno:
- Fotos desde la tablet (fachada, ventana, local) para edificios, cortinas y negocios:
  POST /api/ventas-terreno/fotos/{tipo}/{id}  (multipart) -> guarda en uploads/ventas/fotos/<tipo>/<id>/
  GET  /api/ventas-terreno/fotos/{tipo}/{id}
- Firma del cliente al aceptar (cortinas/negocios): la reciben los endpoints publicos como firma_data (base64 PNG)
  y se guarda en uploads/ventas/firmas/<tipo>/<token>.png
- Panel de resultados: GET /api/ventas-terreno/resultados (por comuna, por vendedor, por producto, embudo)
"""
import base64
import json
import os
import secrets
from pathlib import Path
from typing import List

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.routers.ventas_terreno import get_vendedor, _row, _rows, UPLOAD_DIR, VENTAS_URL

router = APIRouter(prefix="/api/ventas-terreno", tags=["Ventas extras"])
TIPOS = {"edificio": "ventas_edificios", "cortinas": "ventas_cortinas_leads", "negocio": "ventas_negocios"}
FOTOS_DIR = UPLOAD_DIR / "ventas" / "fotos"
FIRMAS_DIR = UPLOAD_DIR / "ventas" / "firmas"


def _check(db, tipo, oid):
    if tipo not in TIPOS: raise HTTPException(400, "tipo inválido")
    if not db.execute(text(f"SELECT 1 FROM {TIPOS[tipo]} WHERE id=:id"), {"id": oid}).fetchone(): raise HTTPException(404, "No encontrado")


def listar_fotos(tipo: str, oid: int) -> List[dict]:
    d = FOTOS_DIR / tipo / str(oid)
    if not d.exists(): return []
    return [{"nombre": f.name, "url": f"{VENTAS_URL}/uploads/ventas/fotos/{tipo}/{oid}/{f.name}"} for f in sorted(d.iterdir(), key=lambda x: x.stat().st_mtime, reverse=True) if f.is_file()]


@router.get("/fotos/{tipo}/{oid}")
def get_fotos(tipo: str, oid: int, v: dict = Depends(get_vendedor), db: Session = Depends(get_db)):
    _check(db, tipo, oid)
    return listar_fotos(tipo, oid)


@router.post("/fotos/{tipo}/{oid}", status_code=201)
async def subir_foto(tipo: str, oid: int, archivo: UploadFile = File(...), v: dict = Depends(get_vendedor), db: Session = Depends(get_db)):
    _check(db, tipo, oid)
    data = await archivo.read()
    if len(data) > 12 * 1024 * 1024: raise HTTPException(413, "Máximo 12 MB")
    try:
        from PIL import Image
        import io
        im = Image.open(io.BytesIO(data)); im = im.convert("RGB"); im.thumbnail((1600, 1600))
        d = FOTOS_DIR / tipo / str(oid); d.mkdir(parents=True, exist_ok=True)
        name = f"{secrets.token_hex(6)}.jpg"; im.save(d / name, "JPEG", quality=84, optimize=True)
    except Exception:
        raise HTTPException(400, "El archivo no es una imagen válida")
    return {"ok": True, "url": f"{VENTAS_URL}/uploads/ventas/fotos/{tipo}/{oid}/{name}", "fotos": listar_fotos(tipo, oid)}


@router.delete("/fotos/{tipo}/{oid}/{nombre}", status_code=204)
def borrar_foto(tipo: str, oid: int, nombre: str, v: dict = Depends(get_vendedor), db: Session = Depends(get_db)):
    _check(db, tipo, oid)
    f = FOTOS_DIR / tipo / str(oid) / os.path.basename(nombre)
    if f.exists(): f.unlink()


def guardar_firma(tipo: str, token: str, firma_data: str) -> str:
    """firma_data: data:image/png;base64,... -> ruta publica"""
    if not firma_data or "base64," not in firma_data: return ""
    raw = base64.b64decode(firma_data.split("base64,", 1)[1])
    if len(raw) > 2 * 1024 * 1024: return ""
    d = FIRMAS_DIR / tipo; d.mkdir(parents=True, exist_ok=True)
    (d / f"{token}.png").write_bytes(raw)
    return f"{VENTAS_URL}/uploads/ventas/firmas/{tipo}/{token}.png"


# ─── Panel de resultados ────────────────────────────────────────────────────

@router.get("/resultados")
def resultados(v: dict = Depends(get_vendedor), db: Session = Depends(get_db)):
    def q(sql, **p):
        try: return _rows(db, sql, **p)
        except Exception: db.rollback(); return []
    embudo = q("""SELECT etapa, COUNT(*) AS n, COALESCE(SUM(valor_mensual),0) AS valor FROM ventas_edificios GROUP BY etapa""")
    comunas = q("""SELECT COALESCE(NULLIF(comuna,''),'Sin comuna') AS comuna, COUNT(*) AS edificios,
        SUM(CASE WHEN etapa='cliente' THEN 1 ELSE 0 END) AS clientes, SUM(CASE WHEN etapa IN ('propuesta','demo','negociacion') THEN 1 ELSE 0 END) AS en_curso,
        COALESCE(SUM(unidades),0) AS unidades FROM ventas_edificios GROUP BY 1 ORDER BY edificios DESC LIMIT 15""")
    vendedores = q("""SELECT vd.nombre,
        (SELECT COUNT(*) FROM ventas_visitas x WHERE x.vendedor_id=vd.id AND x.fecha > NOW()-INTERVAL '30 days') AS visitas_30d,
        (SELECT COUNT(*) FROM ventas_edificios e WHERE e.vendedor_id=vd.id) AS edificios,
        (SELECT COUNT(*) FROM ventas_propuestas p WHERE p.vendedor_id=vd.id) AS propuestas,
        (SELECT COUNT(*) FROM ventas_propuestas p WHERE p.vendedor_id=vd.id AND p.abierto_en IS NOT NULL) AS abiertas,
        (SELECT COUNT(*) FROM ventas_edificios e WHERE e.vendedor_id=vd.id AND e.etapa='cliente') AS clientes,
        (SELECT COALESCE(SUM(valor_mensual),0) FROM ventas_edificios e WHERE e.vendedor_id=vd.id AND e.etapa='cliente') AS mrr,
        (SELECT COUNT(*) FROM ventas_cortinas_propuestas c WHERE c.vendedor_id=vd.id AND c.aceptada_en IS NOT NULL) AS cortinas_aceptadas,
        (SELECT COUNT(*) FROM ventas_negocios_propuestas n WHERE n.vendedor_id=vd.id AND n.aceptada_en IS NOT NULL) AS negocios_aceptados
        FROM ventas_vendedores vd WHERE vd.activo ORDER BY clientes DESC, propuestas DESC""")
    productos = q("""SELECT i->>'nombre' AS producto, COUNT(*) AS propuestas, SUM(CASE WHEN p.aceptada_en IS NOT NULL THEN 1 ELSE 0 END) AS aceptadas
        FROM ventas_negocios_propuestas p, jsonb_array_elements(p.items) i GROUP BY 1 ORDER BY propuestas DESC""")
    cortinas = q("""SELECT f->>'producto_nombre' AS producto, COUNT(*) AS espacios, ROUND(SUM((f->>'m2')::numeric),1) AS m2
        FROM ventas_cortinas_propuestas p, jsonb_array_elements(p.espacios) f GROUP BY 1 ORDER BY espacios DESC LIMIT 10""")
    demos = _row(db, """SELECT COUNT(*) AS total, SUM(CASE WHEN estado='activo' THEN 1 ELSE 0 END) AS activos, SUM(CASE WHEN estado='convertido' THEN 1 ELSE 0 END) AS convertidos,
        (SELECT COUNT(DISTINCT tenant_id) FROM ventas_eventos WHERE tipo='demo_login') AS con_uso FROM ventas_demos""") or {}
    semana = q("""SELECT to_char(date_trunc('week', fecha), 'DD/MM') AS semana, COUNT(*) AS visitas FROM ventas_visitas WHERE fecha > NOW()-INTERVAL '12 weeks' GROUP BY date_trunc('week', fecha) ORDER BY date_trunc('week', fecha)""")
    tot = _row(db, """SELECT (SELECT COUNT(*) FROM ventas_edificios) AS edificios, (SELECT COUNT(*) FROM ventas_negocios) AS negocios, (SELECT COUNT(*) FROM ventas_cortinas_leads) AS cortinas,
        (SELECT COUNT(*) FROM ventas_propuestas)+(SELECT COUNT(*) FROM ventas_negocios_propuestas)+(SELECT COUNT(*) FROM ventas_cortinas_propuestas) AS propuestas,
        (SELECT COUNT(*) FROM ventas_edificios WHERE etapa='cliente')+(SELECT COUNT(*) FROM ventas_negocios WHERE etapa='cliente')+(SELECT COUNT(*) FROM ventas_cortinas_leads WHERE etapa IN ('aceptada','instalada')) AS cerrados,
        (SELECT COALESCE(SUM(valor_mensual),0) FROM ventas_edificios WHERE etapa='cliente')+(SELECT COALESCE(SUM(valor_mensual),0) FROM ventas_negocios WHERE etapa='cliente') AS mrr,
        (SELECT COALESCE(SUM((niveles->(nivel_aceptado)->>'total')::numeric),0) FROM ventas_cortinas_propuestas WHERE aceptada_en IS NOT NULL) AS cortinas_vendido""") or {}
    return {"totales": tot, "embudo": embudo, "comunas": comunas, "vendedores": vendedores, "productos": productos, "cortinas": cortinas, "demos": demos, "semanas": semana}
