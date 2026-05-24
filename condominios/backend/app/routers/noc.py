"""
NOC -- Network Operations Center
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.database import get_db
from datetime import datetime, date
import os
import jwt as _jwt

router = APIRouter(prefix="/api/noc", tags=["NOC"])

SECRET_KEY = os.getenv("SECRET_KEY", "")
ALGORITHM = "HS256"
SA_COOKIE = "sa_session"


def _require_admin(request: Request, db: Session = Depends(get_db)) -> dict:
    token = request.cookies.get(SA_COOKIE) or request.cookies.get('session')
    if not token:
        raise HTTPException(status_code=401, detail="No autorizado")
    try:
        payload = _jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        rol = payload.get("role") or payload.get("rol") or ""
        if rol not in ("superadmin", "admin"):
            raise HTTPException(status_code=403, detail="Solo administradores")
        uid = int(payload["sub"])
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Sesion invalida")
    row = db.execute(
        text("SELECT id, email, nombre_completo FROM usuarios WHERE id=:uid AND activo=true AND rol IN ('superadmin','admin')"),
        {"uid": uid}
    ).fetchone()
    if not row:
        raise HTTPException(status_code=401, detail="Cuenta no encontrada")
    return {"id": row[0], "email": row[1], "nombre_completo": row[2]}


def _safe_int(val) -> int:
    try:
        return int(val) if val is not None else 0
    except Exception:
        return 0


def _fmt_dt(val):
    if val is None:
        return None
    try:
        if isinstance(val, str):
            return val
        return val.isoformat()
    except Exception:
        return str(val)


@router.get("/resumen")
def get_resumen(request: Request, db: Session = Depends(get_db), _admin: dict = Depends(_require_admin)):
    today_str = date.today().isoformat()
    total_tenants = _safe_int(db.execute(text("SELECT COUNT(*) FROM tenants")).scalar())
    tenants_activos = _safe_int(db.execute(text("SELECT COUNT(*) FROM tenants WHERE estado='activo'")).scalar())
    tenants_vencidos = _safe_int(db.execute(text("SELECT COUNT(*) FROM tenants WHERE fecha_vencimiento < NOW()")).scalar())
    total_usuarios = _safe_int(db.execute(text("SELECT COUNT(*) FROM usuarios WHERE activo=true")).scalar())
    try:
        total_eventos_hoy = _safe_int(db.execute(
            text("SELECT COUNT(*) FROM historial_eventos WHERE fecha >= :today"),
            {"today": today_str}
        ).scalar())
    except Exception:
        total_eventos_hoy = 0
    try:
        total_alertas_criticas = _safe_int(db.execute(
            text("SELECT COUNT(*) FROM alertas_sistema WHERE nivel='critico' AND resuelta=false")
        ).scalar())
    except Exception:
        total_alertas_criticas = 0
    try:
        total_paquetes_pendientes = _safe_int(db.execute(
            text("SELECT COUNT(*) FROM paqueteria WHERE estado='pendiente'")
        ).scalar())
    except Exception:
        total_paquetes_pendientes = 0
    try:
        total_visitas_activas = _safe_int(db.execute(
            text("SELECT COUNT(*) FROM visitas WHERE hora_salida IS NULL")
        ).scalar())
    except Exception:
        total_visitas_activas = 0
    return {
        "total_tenants": total_tenants,
        "tenants_activos": tenants_activos,
        "tenants_vencidos": tenants_vencidos,
        "total_usuarios": total_usuarios,
        "total_eventos_hoy": total_eventos_hoy,
        "total_alertas_criticas": total_alertas_criticas,
        "total_paquetes_pendientes": total_paquetes_pendientes,
        "total_visitas_activas": total_visitas_activas,
    }


@router.get("/tenants")
def get_tenants(request: Request, db: Session = Depends(get_db), _admin: dict = Depends(_require_admin)):
    today_str = date.today().isoformat()
    tenants = db.execute(
        text("SELECT id, nombre, subdominio, plan, estado, fecha_vencimiento FROM tenants ORDER BY nombre")
    ).fetchall()
    result = []
    for t in tenants:
        tid = t[0]
        try:
            row = db.execute(text("SELECT MAX(last_login) FROM usuarios WHERE tenant_id=:tid"), {"tid": tid}).fetchone()
            ultimo_login = _fmt_dt(row[0]) if row else None
        except Exception:
            ultimo_login = None
        try:
            total_usuarios = _safe_int(db.execute(text("SELECT COUNT(*) FROM usuarios WHERE tenant_id=:tid"), {"tid": tid}).scalar())
        except Exception:
            total_usuarios = 0
        try:
            total_condominios = _safe_int(db.execute(text("SELECT COUNT(*) FROM condominios WHERE tenant_id=:tid"), {"tid": tid}).scalar())
        except Exception:
            total_condominios = 0
        try:
            eventos_hoy = _safe_int(db.execute(
                text("SELECT COUNT(*) FROM historial_eventos WHERE tenant_id=:tid AND fecha >= :today"),
                {"tid": tid, "today": today_str}
            ).scalar())
        except Exception:
            eventos_hoy = 0
        try:
            alertas_criticas = _safe_int(db.execute(
                text("SELECT COUNT(*) FROM alertas_sistema WHERE tenant_id=:tid AND nivel='critico' AND resuelta=false"),
                {"tid": tid}
            ).scalar())
        except Exception:
            alertas_criticas = 0
        try:
            paquetes_pendientes = _safe_int(db.execute(
                text("SELECT COUNT(*) FROM paqueteria WHERE tenant_id=:tid AND estado='pendiente'"),
                {"tid": tid}
            ).scalar())
        except Exception:
            paquetes_pendientes = 0
        try:
            visitas_activas = _safe_int(db.execute(
                text("SELECT COUNT(*) FROM visitas WHERE tenant_id=:tid AND hora_salida IS NULL"),
                {"tid": tid}
            ).scalar())
        except Exception:
            visitas_activas = 0
        try:
            dispositivos_tcp = _safe_int(db.execute(
                text("SELECT COUNT(*) FROM puertas WHERE tenant_id=:tid AND activa=true"),
                {"tid": tid}
            ).scalar())
        except Exception:
            dispositivos_tcp = 0
        fecha_venc = t[5]
        vencido = False
        if fecha_venc:
            try:
                fv = datetime.fromisoformat(str(fecha_venc)) if isinstance(fecha_venc, str) else fecha_venc
                vencido = fv < datetime.now()
            except Exception:
                pass
        if alertas_criticas > 0 or vencido:
            semaforo = "rojo"
        elif eventos_hoy == 0:
            semaforo = "amarillo"
        else:
            semaforo = "verde"
        result.append({
            "id": tid,
            "nombre": t[1],
            "subdominio": t[2],
            "plan": t[3],
            "estado": t[4],
            "fecha_vencimiento": _fmt_dt(t[5]),
            "ultimo_login": ultimo_login,
            "total_usuarios": total_usuarios,
            "total_condominios": total_condominios,
            "eventos_hoy": eventos_hoy,
            "alertas_criticas": alertas_criticas,
            "paquetes_pendientes": paquetes_pendientes,
            "visitas_activas": visitas_activas,
            "dispositivos_tcp": dispositivos_tcp,
            "semaforo": semaforo,
        })
    return result


@router.get("/tenants/{tenant_id}/actividad")
def get_tenant_actividad(
    tenant_id: int,
    request: Request,
    db: Session = Depends(get_db),
    _admin: dict = Depends(_require_admin),
):
    try:
        rows = db.execute(
            text("""
                SELECT id, modulo, accion, descripcion, fecha, entidad_id
                FROM historial_eventos
                WHERE tenant_id = :tid
                ORDER BY fecha DESC
                LIMIT 50
            """),
            {"tid": tenant_id}
        ).fetchall()
        return [
            {
                "id": r[0],
                "modulo": r[1],
                "accion": r[2],
                "descripcion": r[3],
                "created_at": _fmt_dt(r[4]),
                "entidad_id": r[5],
            }
            for r in rows
        ]
    except Exception:
        return []


@router.get("/tenants/{tenant_id}/alertas")
def get_tenant_alertas(
    tenant_id: int,
    request: Request,
    db: Session = Depends(get_db),
    _admin: dict = Depends(_require_admin),
):
    try:
        rows = db.execute(
            text("""
                SELECT id, tipo, nivel, titulo, descripcion, servicio, acknowledged, created_at
                FROM alertas_sistema
                WHERE tenant_id = :tid AND resuelta = false
                ORDER BY
                    CASE nivel WHEN 'critico' THEN 1 WHEN 'alto' THEN 2 WHEN 'medio' THEN 3 ELSE 4 END,
                    created_at DESC
            """),
            {"tid": tenant_id}
        ).fetchall()
        return [
            {
                "id": r[0],
                "tipo": r[1],
                "nivel": r[2],
                "titulo": r[3],
                "descripcion": r[4],
                "servicio": r[5],
                "acknowledged": r[6],
                "created_at": _fmt_dt(r[7]),
            }
            for r in rows
        ]
    except Exception:
        return []


@router.get("/health")
def get_health(
    request: Request,
    db: Session = Depends(get_db),
    _admin: dict = Depends(_require_admin),
):
    db_status = "ok"
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        db_status = "error"
    return {
        "db": db_status,
        "backend": "ok",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "2.0.0",
    }