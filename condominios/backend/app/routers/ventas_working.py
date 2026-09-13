"""
Handoff TerraBlinds -> ConectaWork (working.conectaai.cl).

Cuando el cliente acepta una propuesta de cortinas se crea el cliente y la orden de
trabajo en ConectaWork (taller), con los espacios medidos como productos. Requiere una
cuenta de servicio en ConectaWork (rol vendedor/coordinador del taller):
  WORKING_API_URL (default https://working.conectaai.cl), WORKING_EMAIL, WORKING_PASSWORD
Si no esta configurado, el boton en la ficha lo indica y no falla nada.
"""
import os
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.routers.ventas_terreno import get_vendedor, _row

router = APIRouter(prefix="/api/ventas-terreno/cortinas", tags=["TerraBlinds -> ConectaWork"])
W_URL = os.getenv("WORKING_API_URL", "https://working.conectaai.cl").rstrip("/")
W_EMAIL = os.getenv("WORKING_EMAIL", "")
W_PASS = os.getenv("WORKING_PASSWORD", "")


def configurado() -> bool:
    return bool(W_EMAIL and W_PASS)


def _token() -> str:
    r = httpx.post(f"{W_URL}/api/v1/auth/token", json={"email": W_EMAIL, "password": W_PASS}, timeout=15.0)
    if r.status_code >= 300:
        raise RuntimeError(f"ConectaWork login {r.status_code}: {r.text[:120]}")
    return r.json()["access_token"]


def _accionamiento(nivel: str, motorizado: bool) -> str:
    if nivel == "premium" or (nivel == "confort" and motorizado): return "motor"
    return "cadena"


def crear_ot(db: Session, prop: dict, lead: dict) -> dict:
    """Crea cliente (si no existe por telefono/email) y orden en ConectaWork. Devuelve {orden_id, numero}."""
    if not configurado():
        raise RuntimeError("Falta configurar WORKING_EMAIL / WORKING_PASSWORD en el backend")
    tok = _token(); H = {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}
    nivel = prop.get("nivel_aceptado") or prop.get("nivel_sugerido") or "confort"
    niv = (prop.get("niveles") or {}).get(nivel) or {}
    total = int(niv.get("total") or 0)
    # cliente
    cliente_id = None
    q = (lead.get("telefono") or lead.get("email") or lead["nombre"])
    try:
        r = httpx.get(f"{W_URL}/api/v1/clients/", params={"q": q, "limit": 5}, headers=H, timeout=15.0)
        if r.status_code < 300:
            data = r.json(); items = data if isinstance(data, list) else data.get("items") or data.get("clients") or []
            for c in items:
                if lead.get("telefono") and "".join(ch for ch in (c.get("telefono") or "") if ch.isdigit())[-8:] == "".join(ch for ch in lead["telefono"] if ch.isdigit())[-8:]:
                    cliente_id = c["id"]; break
    except Exception:
        pass
    if not cliente_id:
        r = httpx.post(f"{W_URL}/api/v1/clients/", headers=H, timeout=15.0, json={
            "nombre": lead["nombre"], "tipo_cliente": "empresa" if lead.get("tipo") in ("oficina", "comunidad") else "persona", "email": lead.get("email"), "telefono": lead.get("telefono"),
            "direccion": lead.get("direccion"), "comuna": lead.get("comuna"), "notas": f"Lead Ventas Terreno #{lead['id']} · propuesta {prop['token']}"})
        if r.status_code >= 300:
            raise RuntimeError(f"ConectaWork cliente {r.status_code}: {r.text[:160]}")
        cliente_id = r.json()["id"]
    # productos = espacios medidos
    factor = 1.0
    filas = prop.get("espacios") or []
    suma = sum(int(f.get("subtotal") or 0) for f in filas) or 1
    productos = []
    for f in filas:
        precio = max(1, int(round(total * (int(f.get("subtotal") or 0) / suma)))) if total else max(1, int(f.get("subtotal") or 1))
        productos.append({"tipo": f.get("producto_nombre") or f.get("producto"), "ancho": float(f["ancho_cm"]), "alto": float(f["alto_cm"]), "tela": f.get("color") or "por definir", "color": f.get("color") or "por definir",
                          "precio": precio, "ubicacion": f.get("ambiente"), "accionamiento": _accionamiento(nivel, bool(f.get("motorizado"))),
                          "notas": " · ".join(x for x in (f"x{f.get('cantidad')}" if int(f.get("cantidad") or 1) > 1 else "", f.get("nota") or "") if x) or None})
    r = httpx.post(f"{W_URL}/api/v1/orders/", headers=H, timeout=20.0, json={"cliente_id": cliente_id, "productos": productos, "precio_total": max(1, total), "cotizacion_id": f"VT-{prop['token']}"})
    if r.status_code >= 300:
        raise RuntimeError(f"ConectaWork orden {r.status_code}: {r.text[:200]}")
    o = r.json()
    db.execute(text("ALTER TABLE ventas_cortinas_propuestas ADD COLUMN IF NOT EXISTS working_orden_id INTEGER"))
    db.execute(text("ALTER TABLE ventas_cortinas_propuestas ADD COLUMN IF NOT EXISTS working_numero INTEGER"))
    db.execute(text("UPDATE ventas_cortinas_propuestas SET working_orden_id=:o, working_numero=:n WHERE id=:id"), {"o": o.get("id"), "n": o.get("numero"), "id": prop["id"]}); db.commit()
    return {"orden_id": o.get("id"), "numero": o.get("numero"), "cliente_id": cliente_id, "url": f"{W_URL}/#/ordenes/{o.get('id')}"}


def intentar_ot(db: Session, prop: dict, lead: dict) -> Optional[dict]:
    """Best-effort tras la aceptacion (no rompe el flujo)."""
    if not configurado(): return None
    try:
        return crear_ot(db, prop, lead)
    except Exception as ex:
        print("ConectaWork handoff:", ex); return None


@router.get("/working/estado")
def estado(v: dict = Depends(get_vendedor)):
    return {"configurado": configurado(), "url": W_URL}


@router.post("/propuestas/{pid}/working")
def crear_manual(pid: int, v: dict = Depends(get_vendedor), db: Session = Depends(get_db)):
    prop = _row(db, "SELECT * FROM ventas_cortinas_propuestas WHERE id=:id", id=pid)
    if not prop: raise HTTPException(404, "Propuesta no encontrada")
    if prop.get("working_orden_id"): return {"ok": True, "ya_existia": True, "numero": prop.get("working_numero"), "url": f"{W_URL}/#/ordenes/{prop['working_orden_id']}"}
    lead = _row(db, "SELECT * FROM ventas_cortinas_leads WHERE id=:id", id=prop["lead_id"])
    if not configurado():
        raise HTTPException(400, "ConectaWork no está conectado: agrega WORKING_EMAIL y WORKING_PASSWORD (cuenta del taller) en el .env del backend y reinicia.")
    try:
        return {"ok": True, **crear_ot(db, prop, lead)}
    except Exception as ex:
        raise HTTPException(502, str(ex))
