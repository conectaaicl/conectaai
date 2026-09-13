"""
Configuracion comercial editable (precios y planes) para Ventas Terreno.

Tabla ventas_config: una fila por "clave" (condominios | negocios | cortinas) con el JSON vigente.
Los routers leen con get_config(clave, default) (cache 30 s); si no hay fila, usan los valores
por defecto que viven en su codigo. Endpoints (admin de ventas):
  GET  /api/ventas-terreno/config            -> todo (con defaults resueltos)
  PUT  /api/ventas-terreno/config/{clave}    -> guarda y registra quien/cuando
  GET  /api/ventas-terreno/config/historial  -> ultimos cambios
"""
import json
import time
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database import SessionLocal, get_db

router = APIRouter(prefix="/api/ventas-terreno/config", tags=["Ventas config"])
CLAVES = ("condominios", "negocios", "cortinas")
_CACHE: dict = {}      # clave -> (valor, ts)
_TTL = 30.0
_OK = False


def _ensure(db: Session):
    global _OK
    if _OK: return
    db.execute(text("""CREATE TABLE IF NOT EXISTS ventas_config (
        clave VARCHAR(40) PRIMARY KEY, valor JSONB NOT NULL, actualizado_por VARCHAR(160), updated_at TIMESTAMPTZ DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS ventas_config_historial (
        id SERIAL PRIMARY KEY, clave VARCHAR(40), valor JSONB, actualizado_por VARCHAR(160), created_at TIMESTAMPTZ DEFAULT NOW())"""))
    db.commit(); _OK = True


def _merge(default: Any, valor: Any) -> Any:
    """Mezcla superficial por clave: lo guardado pisa el default, pero claves nuevas del codigo siguen apareciendo."""
    if isinstance(default, dict) and isinstance(valor, dict):
        out = dict(default)
        for k, v in valor.items():
            out[k] = _merge(default.get(k), v) if isinstance(v, dict) and isinstance(default.get(k), dict) else v
        return out
    return valor if valor is not None else default


def get_config(clave: str, default: Any) -> Any:
    """Valor vigente (BD mezclada sobre el default del codigo). Nunca lanza: ante error devuelve default."""
    now = time.time()
    c = _CACHE.get(clave)
    if c and now - c[1] < _TTL:
        return _merge(default, c[0])
    db = SessionLocal()
    try:
        _ensure(db)
        row = db.execute(text("SELECT valor FROM ventas_config WHERE clave=:c"), {"c": clave}).fetchone()
        valor = row[0] if row else None
        if isinstance(valor, str):
            valor = json.loads(valor)
        _CACHE[clave] = (valor, now)
        return _merge(default, valor)
    except Exception:
        return default
    finally:
        db.close()


def invalidar(clave: str | None = None):
    if clave: _CACHE.pop(clave, None)
    else: _CACHE.clear()
    if clave in (None, "cortinas"):
        try:  # el catalogo de TerraBlinds cachea precios de respaldo: se refresca en la proxima lectura
            from app.routers import ventas_cortinas as vc
            vc._CAT_CACHE["ts"] = 0.0
        except Exception:
            pass


def _vendedor(request: Request, db: Session = Depends(get_db)) -> dict:
    from app.routers.ventas_terreno import get_vendedor  # import tardio: evita ciclo
    return get_vendedor(request, db)


def _defaults() -> dict:
    from app.routers import ventas_terreno as vt, ventas_negocios as vn, ventas_cortinas as vc
    return {
        "condominios": {"modulos": vt.MODULOS_DEF, "minimo_mensual": vt.MINIMO_MENSUAL_DEF},
        "negocios": {"planes": vn.PLANES_DEF},
        "cortinas": {"precios": vc.PRECIOS_DEF, "motor": vc.MOTOR_DEF, "niveles": {k: {"factor": v["factor"]} for k, v in vc.NIVELES.items()}},
    }


@router.get("")
def leer(v: dict = Depends(_vendedor), db: Session = Depends(get_db)):
    _ensure(db)
    d = _defaults()
    out = {}
    for k in CLAVES:
        row = db.execute(text("SELECT valor, actualizado_por, updated_at FROM ventas_config WHERE clave=:c"), {"c": k}).fetchone()
        valor = (json.loads(row[0]) if isinstance(row[0], str) else row[0]) if row else None
        out[k] = {"valor": _merge(d[k], valor), "guardado": bool(row), "actualizado_por": row[1] if row else None, "updated_at": row[2].isoformat() if row and row[2] else None}
    return out


class ConfigIn(BaseModel):
    valor: dict


def _validar(clave: str, valor: dict):
    def num(x, nombre, minimo=0):
        try:
            n = float(x)
        except Exception:
            raise HTTPException(400, f"{nombre}: debe ser un número")
        if n < minimo: raise HTTPException(400, f"{nombre}: no puede ser menor que {minimo}")
        return n
    if clave == "condominios":
        for m in valor.get("modulos", []):
            if not m.get("key") or not m.get("nombre"): raise HTTPException(400, "Cada módulo necesita key y nombre")
            m["precio"] = int(num(m.get("precio", 0), f"precio de {m['nombre']}"))
        valor["minimo_mensual"] = int(num(valor.get("minimo_mensual", 0), "mínimo mensual"))
    elif clave == "negocios":
        for k, p in valor.get("planes", {}).items():
            p["mensual"] = int(num(p.get("mensual", 0), f"mensual de {k}")); p["setup"] = int(num(p.get("setup", 0), f"puesta en marcha de {k}")); p["min"] = int(num(p.get("min", 1), f"mínimo de {k}", 1))
    elif clave == "cortinas":
        valor["precios"] = {k: int(num(v, f"precio de {k}")) for k, v in valor.get("precios", {}).items()}
        valor["motor"] = int(num(valor.get("motor", 0), "motor"))
        for k, n in valor.get("niveles", {}).items():
            n["factor"] = num(n.get("factor", 1), f"factor {k}", 0.1)
    return valor


@router.put("/{clave}")
def guardar(clave: str, body: ConfigIn, v: dict = Depends(_vendedor), db: Session = Depends(get_db)):
    if clave not in CLAVES: raise HTTPException(404, "Clave desconocida")
    if v["rol"] != "admin": raise HTTPException(403, "Solo el administrador de ventas cambia precios")
    _ensure(db)
    valor = _validar(clave, body.valor)
    db.execute(text("INSERT INTO ventas_config (clave, valor, actualizado_por, updated_at) VALUES (:c, :v, :u, NOW()) ON CONFLICT (clave) DO UPDATE SET valor=EXCLUDED.valor, actualizado_por=EXCLUDED.actualizado_por, updated_at=NOW()"),
               {"c": clave, "v": json.dumps(valor), "u": v["email"]})
    db.execute(text("INSERT INTO ventas_config_historial (clave, valor, actualizado_por) VALUES (:c, :v, :u)"), {"c": clave, "v": json.dumps(valor), "u": v["email"]})
    db.commit(); invalidar(clave)
    return {"ok": True, "clave": clave, "valor": _merge(_defaults()[clave], valor)}


@router.post("/{clave}/restablecer")
def restablecer(clave: str, v: dict = Depends(_vendedor), db: Session = Depends(get_db)):
    if clave not in CLAVES: raise HTTPException(404, "Clave desconocida")
    if v["rol"] != "admin": raise HTTPException(403, "Solo administrador")
    _ensure(db)
    db.execute(text("DELETE FROM ventas_config WHERE clave=:c"), {"c": clave}); db.commit(); invalidar(clave)
    return {"ok": True, "valor": _defaults()[clave]}


@router.get("/historial")
def historial(v: dict = Depends(_vendedor), db: Session = Depends(get_db)):
    _ensure(db)
    rows = db.execute(text("SELECT clave, actualizado_por, created_at FROM ventas_config_historial ORDER BY id DESC LIMIT 30")).fetchall()
    return [{"clave": r[0], "por": r[1], "cuando": r[2].isoformat()} for r in rows]
