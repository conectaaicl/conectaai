"""
Feature Flags -- gestion de features por tenant
GET  /api/features              -> features activos del tenant actual
GET  /api/features/catalog      -> catalogo completo con precios
POST /api/features/{key}/toggle -> superadmin: activar/desactivar feature
GET  /api/features/tenant/{id}  -> superadmin: features de un tenant especifico
POST /api/features/tenant/{id}/tipo -> superadmin: cambiar tipo y resetear features
GET  /api/features/pricing/{id} -> superadmin: precio mensual del tenant
"""
import os
import jwt
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
from app.core.database import get_db, SessionLocal

router = APIRouter(prefix="/api/features", tags=["Feature Flags"])

SECRET_KEY = os.getenv("SECRET_KEY", "")
ALGORITHM = "HS256"

TIPO_PRESETS = {
    "condominio": [
        "visitas", "paqueteria", "puertas", "rfid", "camaras", "reservas",
        "gastos_comunes", "finanzas", "presupuesto", "multas", "pagos_online",
        "personal", "mascotas", "asambleas", "votaciones", "documentos",
        "avisos", "checklist", "incidencias", "reportes", "portal_residente",
        "push_notificaciones", "ley_copropiedad", "accesos_qr", "biometrico",
        "facial", "alarmas", "proveedores", "ordenes", "remuneraciones",
        "asistencia", "noc", "anomalias", "resumenes_ia", "asistente_ia",
        "wa_bot", "wa_platform", "sii_facturacion",
    ],
    "bodega": [
        "visitas", "paqueteria", "puertas", "rfid", "camaras",
        "pagos_online", "avisos", "reportes", "incidencias", "checklist",
    ],
    "pyme": [
        "visitas", "puertas", "rfid", "reservas", "personal", "asistencia",
        "avisos", "checklist", "reportes", "push_notificaciones", "incidencias",
        "proveedores", "ordenes",
    ],
    "cowork": [
        "visitas", "puertas", "rfid", "reservas", "personal", "asistencia",
        "pagos_online", "avisos", "reportes", "push_notificaciones",
        "portal_residente", "incidencias", "documentos", "ordenes",
    ],
}


def _decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except Exception:
        return {}


def _get_tenant_features(db: Session, tenant_id: int) -> list:
    rows = db.execute(text(
        "SELECT tf.feature_key, tf.activo, fc.label, fc.categoria, fc.precio_clp "
        "FROM tenant_features tf "
        "JOIN feature_catalog fc ON fc.key = tf.feature_key "
        "WHERE tf.tenant_id = :tid ORDER BY fc.categoria, fc.label"
    ), {"tid": tenant_id}).fetchall()
    return [dict(r._mapping) for r in rows]


@router.get("")
def get_my_features(request: Request, db: Session = Depends(get_db)):
    """Returns active feature keys for the current tenant (from session cookie or Bearer)."""
    token = request.cookies.get("session")
    if not token:
        auth = request.headers.get("authorization", "")
        token = auth[7:] if auth.startswith("Bearer ") else None
    if not token:
        return {"features": [], "tipo": "condominio"}

    payload = _decode_token(token)
    tenant_id = payload.get("tenant_id")
    if not tenant_id:
        return {"features": [], "tipo": "condominio"}

    rows = db.execute(text(
        "SELECT tf.feature_key FROM tenant_features tf "
        "WHERE tf.tenant_id = :tid AND tf.activo = true"
    ), {"tid": tenant_id}).fetchall()
    active = [r[0] for r in rows]

    tipo_row = db.execute(text(
        "SELECT tipo FROM tenants WHERE id = :tid"
    ), {"tid": tenant_id}).fetchone()
    tipo = tipo_row[0] if tipo_row else "condominio"

    return {"features": active, "tipo": tipo}


@router.get("/catalog")
def get_catalog(db: Session = Depends(get_db)):
    """Returns the full feature catalog with prices."""
    rows = db.execute(text(
        "SELECT key, label, descripcion, categoria, precio_clp "
        "FROM feature_catalog ORDER BY categoria, label"
    )).fetchall()
    return [dict(r._mapping) for r in rows]


@router.get("/tenant/{tenant_id}")
def get_tenant_features(tenant_id: int, db: Session = Depends(get_db)):
    """Superadmin: get all features (active/inactive) for a specific tenant."""
    features = _get_tenant_features(db, tenant_id)
    tipo_row = db.execute(text(
        "SELECT tipo FROM tenants WHERE id = :tid"
    ), {"tid": tenant_id}).fetchone()
    if not tipo_row:
        raise HTTPException(404, "Tenant no encontrado")
    tipo = tipo_row[0]
    return {"tenant_id": tenant_id, "tipo": tipo, "features": features}


@router.get("/pricing/{tenant_id}")
def get_pricing(tenant_id: int, db: Session = Depends(get_db)):
    """Superadmin: get monthly price for a tenant based on active features."""
    row = db.execute(text(
        "SELECT COALESCE(SUM(fc.precio_clp), 0) as total "
        "FROM tenant_features tf "
        "JOIN feature_catalog fc ON fc.key = tf.feature_key "
        "WHERE tf.tenant_id = :tid AND tf.activo = true"
    ), {"tid": tenant_id}).fetchone()
    total = row[0] or 0
    return {"tenant_id": tenant_id, "precio_mensual_clp": total}


class ToggleBody(BaseModel):
    activo: bool


@router.post("/{feature_key}/toggle")
def toggle_feature(feature_key: str, body: ToggleBody, tenant_id: int, db: Session = Depends(get_db)):
    """Superadmin: activate or deactivate a feature for a tenant (tenant_id as query param)."""
    cat = db.execute(text("SELECT key FROM feature_catalog WHERE key = :fk"), {"fk": feature_key}).fetchone()
    if not cat:
        raise HTTPException(404, f"Feature key '{feature_key}' no existe en catalogo")
    existing = db.execute(text(
        "SELECT id FROM tenant_features WHERE tenant_id=:tid AND feature_key=:fk"
    ), {"tid": tenant_id, "fk": feature_key}).fetchone()
    if existing:
        db.execute(text(
            "UPDATE tenant_features SET activo=:a WHERE tenant_id=:tid AND feature_key=:fk"
        ), {"a": body.activo, "tid": tenant_id, "fk": feature_key})
    else:
        db.execute(text(
            "INSERT INTO tenant_features (tenant_id, feature_key, activo) VALUES (:tid, :fk, :a)"
        ), {"tid": tenant_id, "fk": feature_key, "a": body.activo})
    db.commit()
    return {"ok": True, "feature_key": feature_key, "activo": body.activo, "tenant_id": tenant_id}


class TipoBody(BaseModel):
    tipo: str
    reset_features: bool = True


@router.post("/tenant/{tenant_id}/tipo")
def set_tenant_tipo(tenant_id: int, body: TipoBody, db: Session = Depends(get_db)):
    """Superadmin: change tenant type and optionally reset features to type preset."""
    valid_tipos = list(TIPO_PRESETS.keys())
    if body.tipo not in valid_tipos:
        raise HTTPException(400, f"tipo debe ser uno de: {valid_tipos}")

    tenant = db.execute(text("SELECT id FROM tenants WHERE id = :tid"), {"tid": tenant_id}).fetchone()
    if not tenant:
        raise HTTPException(404, "Tenant no encontrado")

    db.execute(text("UPDATE tenants SET tipo=:t WHERE id=:tid"), {"t": body.tipo, "tid": tenant_id})

    features_count = None
    if body.reset_features:
        preset_keys = TIPO_PRESETS.get(body.tipo, [])
        db.execute(text(
            "UPDATE tenant_features SET activo=false WHERE tenant_id=:tid"
        ), {"tid": tenant_id})
        for key in preset_keys:
            db.execute(text(
                "INSERT INTO tenant_features (tenant_id, feature_key, activo) VALUES (:tid, :fk, true) "
                "ON CONFLICT (tenant_id, feature_key) DO UPDATE SET activo=true"
            ), {"tid": tenant_id, "fk": key})
        features_count = len(preset_keys)

    db.commit()
    return {
        "ok": True,
        "tipo": body.tipo,
        "tenant_id": tenant_id,
        "features_activados": features_count,
    }


@router.get("/tenants")
def list_tenants_for_features(request: Request, db: Session = Depends(get_db)):
    token = request.cookies.get("session")
    if not token:
        auth = request.headers.get("authorization", "")
        token = auth[7:] if auth.startswith("Bearer ") else None
    if not token:
        raise HTTPException(401, "No autorizado")
    payload = _decode_token(token)
    rol = payload.get("rol") or payload.get("role") or ""
    if rol != "superadmin":
        raise HTTPException(403, "Acceso denegado")
    rows = db.execute(text(
        "SELECT id, nombre, COALESCE(tipo, 'condominio') as tipo, "
        "email_contacto as email_admin, created_at "
        "FROM tenants ORDER BY nombre"
    )).fetchall()
    return [dict(r._mapping) for r in rows]
