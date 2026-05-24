from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
from pydantic import BaseModel
from app.core.database import get_db
from app.models.acceso import VisitaQR

router = APIRouter(prefix="/api/accesos", tags=["Accesos QR"])


# ─── Schemas ────────────────────────────────────────────────────────────────

class VisitaCreate(BaseModel):
    condominio_id: int
    departamento_id: Optional[int] = None
    nombre_visitante: str
    rut_visitante: Optional[str] = None
    motivo: str = "visita"
    fecha_visita: Optional[datetime] = None
    notas: Optional[str] = None
    creado_por: Optional[int] = None


def visita_to_dict(v: VisitaQR) -> dict:
    return {
        "id": v.id,
        "condominio_id": v.condominio_id,
        "departamento_id": v.departamento_id,
        "nombre_visitante": v.nombre_visitante,
        "rut_visitante": v.rut_visitante,
        "motivo": v.motivo,
        "qr_token": v.qr_token,
        "estado": v.estado,
        "fecha_visita": v.fecha_visita.isoformat() if v.fecha_visita else None,
        "hora_entrada": v.hora_entrada.isoformat() if v.hora_entrada else None,
        "hora_salida": v.hora_salida.isoformat() if v.hora_salida else None,
        "notas": v.notas,
        "creado_por": v.creado_por,
        "created_at": v.created_at.isoformat() if v.created_at else None,
        "qr_url": f"https://conectaai.cl/acceso/qr/{v.qr_token}",
    }


# ─── Endpoints ──────────────────────────────────────────────────────────────

@router.post("/visitas", status_code=201)
def crear_visita(body: VisitaCreate, db: Session = Depends(get_db)):
    if body.fecha_visita is None:
        from datetime import timedelta
        body.fecha_visita = datetime.utcnow() + timedelta(hours=24)
    """Create a visitor invitation and generate QR token."""
    visita = VisitaQR(**body.dict())
    db.add(visita)
    db.commit()
    db.refresh(visita)
    return visita_to_dict(visita)


@router.get("/visitas")
def listar_visitas(
    condominio_id: Optional[int] = Query(None),
    estado: Optional[str] = Query(None),
    fecha: Optional[str] = Query(None, description="YYYY-MM-DD"),
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    """List visits with optional filters."""
    q = db.query(VisitaQR)
    if condominio_id:
        q = q.filter(VisitaQR.condominio_id == condominio_id)
    if estado:
        q = q.filter(VisitaQR.estado == estado)
    if fecha:
        try:
            day = datetime.strptime(fecha, "%Y-%m-%d").date()
            day_start = datetime(day.year, day.month, day.day, 0, 0, 0)
            day_end = datetime(day.year, day.month, day.day, 23, 59, 59)
            q = q.filter(VisitaQR.fecha_visita >= day_start, VisitaQR.fecha_visita <= day_end)
        except ValueError:
            raise HTTPException(status_code=400, detail="Formato de fecha inválido. Use YYYY-MM-DD")
    visitas = q.order_by(VisitaQR.fecha_visita.desc()).offset(skip).limit(limit).all()
    return [visita_to_dict(v) for v in visitas]


@router.get("/qr/{token}")
def obtener_visita_por_qr(token: str, db: Session = Depends(get_db)):
    """Public endpoint: get visit info by QR token (for portería tablet)."""
    visita = db.query(VisitaQR).filter(VisitaQR.qr_token == token).first()
    if not visita:
        raise HTTPException(status_code=404, detail="QR no encontrado")
    return visita_to_dict(visita)


@router.patch("/qr/{token}/ingresar")
def registrar_ingreso(token: str, db: Session = Depends(get_db)):
    """Mark visitor as entered."""
    visita = db.query(VisitaQR).filter(VisitaQR.qr_token == token).first()
    if not visita:
        raise HTTPException(status_code=404, detail="QR no encontrado")
    if visita.estado == "ingresado":
        raise HTTPException(status_code=400, detail="El visitante ya ingresó")
    visita.hora_entrada = datetime.now()
    visita.estado = "ingresado"
    db.commit()
    db.refresh(visita)
    return visita_to_dict(visita)


@router.patch("/qr/{token}/salir")
def registrar_salida(token: str, db: Session = Depends(get_db)):
    """Mark visitor as exited."""
    visita = db.query(VisitaQR).filter(VisitaQR.qr_token == token).first()
    if not visita:
        raise HTTPException(status_code=404, detail="QR no encontrado")
    visita.hora_salida = datetime.now()
    db.commit()
    db.refresh(visita)
    return visita_to_dict(visita)


@router.delete("/visitas/{visita_id}", status_code=204)
def cancelar_visita(visita_id: int, db: Session = Depends(get_db)):
    """Cancel/delete a visit invitation."""
    visita = db.query(VisitaQR).filter(VisitaQR.id == visita_id).first()
    if not visita:
        raise HTTPException(status_code=404, detail="Visita no encontrada")
    db.delete(visita)
    db.commit()

from datetime import datetime, timedelta

@router.get("/live")
def accesos_live(tenant_id: int, limit: int = 60, db: Session = Depends(get_db)):
    events = []
    # 1. Puertas
    try:
        from sqlalchemy import text as _text
        rows = db.execute(_text("""
            SELECT r.id, r.tipo_evento, r.metodo, r.uid_tarjeta, r.exitoso, r.created_at,
                   COALESCE(u.nombre_completo, r.uid_tarjeta, 'Tarjeta') as persona,
                   COALESCE(p.nombre, 'Puerta') as ubicacion,
                   COALESCE(p.zona, p.ubicacion, '') as zona
            FROM registros_acceso_puertas r
            LEFT JOIN usuarios u ON u.id = r.usuario_id
            LEFT JOIN puertas p ON p.id = r.puerta_id
            WHERE r.tenant_id = :tid
            ORDER BY r.created_at DESC LIMIT :lim
        """), {"tid": tenant_id, "lim": limit}).fetchall()
        for r in rows:
            d = dict(r._mapping)
            events.append({
                "fuente": "puerta",
                "tipo": d.get("tipo_evento") or "acceso",
                "persona": d.get("persona") or "Desconocido",
                "ubicacion": d.get("ubicacion") or "Puerta",
                "zona": d.get("zona") or "",
                "metodo": d.get("metodo") or "rfid",
                "exitoso": bool(d.get("exitoso", True)),
                "descripcion": "",
                "ts": d.get("created_at").isoformat() if d.get("created_at") else "",
            })
    except Exception:
        pass
    # 2. Biometrico
    try:
        from app.models.biometrico import RegistroBiometrico
        items = db.query(RegistroBiometrico).filter(
            RegistroBiometrico.tenant_id == tenant_id
        ).order_by(RegistroBiometrico.fecha_hora.desc()).limit(limit).all()
        for r in items:
            events.append({
                "fuente": "biometrico",
                "tipo": r.tipo or "entrada",
                "persona": r.empleado_nombre or "Empleado",
                "ubicacion": r.dispositivo_id or "Lector",
                "zona": "",
                "metodo": r.metodo or "huella",
                "exitoso": bool(r.verificado),
                "descripcion": r.observacion or "",
                "ts": r.fecha_hora.isoformat() if r.fecha_hora else "",
            })
    except Exception:
        pass
    # 3. Visitas QR (last 24h)
    try:
        desde = datetime.now() - timedelta(hours=24)
        visitas = db.query(VisitaQR).filter(
            VisitaQR.condominio_id == tenant_id,
            VisitaQR.hora_entrada >= desde,
        ).order_by(VisitaQR.hora_entrada.desc()).limit(limit).all()
        for v in visitas:
            if v.hora_entrada:
                events.append({
                    "fuente": "qr",
                    "tipo": "entrada",
                    "persona": v.nombre_visitante or "Visitante",
                    "ubicacion": "Portería",
                    "zona": "",
                    "metodo": "qr",
                    "exitoso": True,
                    "descripcion": v.motivo or "",
                    "ts": v.hora_entrada.isoformat(),
                })
            if v.hora_salida:
                events.append({
                    "fuente": "qr",
                    "tipo": "salida",
                    "persona": v.nombre_visitante or "Visitante",
                    "ubicacion": "Portería",
                    "zona": "",
                    "metodo": "qr",
                    "exitoso": True,
                    "descripcion": "",
                    "ts": v.hora_salida.isoformat(),
                })
    except Exception:
        pass
    events.sort(key=lambda x: x["ts"], reverse=True)
    return events[:limit]


@router.get("/resumen-hoy")
def resumen_hoy(tenant_id: int, db: Session = Depends(get_db)):
    from sqlalchemy import text as _text
    hoy = datetime.now().date().isoformat()
    r = {"ingresos": 0, "egresos": 0, "visitas_activas": 0, "fallidos": 0, "total": 0}
    try:
        rows = db.execute(_text("""
            SELECT tipo_evento, exitoso, COUNT(*) as c
            FROM registros_acceso_puertas
            WHERE tenant_id = :tid AND DATE(created_at) = :hoy
            GROUP BY tipo_evento, exitoso
        """), {"tid": tenant_id, "hoy": hoy}).fetchall()
        for row in rows:
            d = dict(row._mapping)
            if d["tipo_evento"] in ("abrir", "entrada") and d["exitoso"]:
                r["ingresos"] += d["c"]
            elif d["tipo_evento"] in ("cerrar", "salida") and d["exitoso"]:
                r["egresos"] += d["c"]
            if not d["exitoso"]:
                r["fallidos"] += d["c"]
    except Exception:
        pass
    try:
        from app.models.biometrico import RegistroBiometrico
        bio = db.query(RegistroBiometrico).filter(
            RegistroBiometrico.tenant_id == tenant_id,
            RegistroBiometrico.fecha_hora >= hoy,
        )
        r["ingresos"] += bio.filter(RegistroBiometrico.tipo == "entrada").count()
        r["egresos"] += bio.filter(RegistroBiometrico.tipo == "salida").count()
        r["fallidos"] += bio.filter(RegistroBiometrico.verificado == False).count()
    except Exception:
        pass
    try:
        r["visitas_activas"] = db.query(VisitaQR).filter(
            VisitaQR.condominio_id == tenant_id,
            VisitaQR.estado == "ingresado",
        ).count()
    except Exception:
        pass
    r["total"] = r["ingresos"] + r["egresos"] + r["fallidos"]
    return r

