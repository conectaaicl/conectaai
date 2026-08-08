"""
Geoacceso -- abrir una puerta desde el celular cuando el residente/socio esta
fisicamente cerca (geolocalizacion del navegador), sin necesidad de mostrar
ningun codigo. Sirve igual para condominios, bodegas y gimnasio.

El sitio (tabla condominios) debe tener latitud/longitud configuradas por el
admin (una vez, desde Estructura del Edificio) y un radio en metros. Si no
estan configuradas, el endpoint responde con un error explicito en vez de
fallar silenciosamente.

GET  /api/portal/geoacceso/puertas -> residente/socio: puertas disponibles en su condominio
POST /api/portal/geoacceso/abrir   -> residente/socio autenticado en el portal
"""
import math

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import ResidentePortal
from app.routers.portal_auth import get_residente

router = APIRouter(prefix="/api/portal/geoacceso", tags=["geoacceso"])


def _distancia_metros(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Formula de Haversine -- distancia en metros entre dos puntos GPS."""
    R = 6371000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


@router.get("/puertas")
def puertas_disponibles(residente: ResidentePortal = Depends(get_residente), db: Session = Depends(get_db)):
    rows = db.execute(text(
        "SELECT id, nombre FROM puertas WHERE tenant_id = :tid AND activa = true "
        "AND (condominio_id = :cid OR :cid IS NULL OR condominio_id IS NULL) "
        "ORDER BY nombre"
    ), {"tid": residente.tenant_id, "cid": residente.condominio_id}).fetchall()
    return [{"id": r[0], "nombre": r[1]} for r in rows]


class AbrirGeoacceso(BaseModel):
    lat: float
    lng: float
    puerta_id: int


@router.post("/abrir")
def abrir_por_cercania(
    data: AbrirGeoacceso,
    residente: ResidentePortal = Depends(get_residente),
    db: Session = Depends(get_db),
):
    tenant_id = residente.tenant_id

    puerta = db.execute(text(
        "SELECT id, condominio_id, activa FROM puertas WHERE id = :pid AND tenant_id = :tid"
    ), {"pid": data.puerta_id, "tid": tenant_id}).fetchone()
    if not puerta or not puerta[2]:
        return {"acceso": False, "razon": "Puerta no disponible"}
    puerta_condominio_id = puerta[1]

    if residente.condominio_id is not None and puerta_condominio_id is not None and puerta_condominio_id != residente.condominio_id:
        return {"acceso": False, "razon": "Sin acceso a esta puerta"}

    condominio_id_ref = puerta_condominio_id or residente.condominio_id
    if condominio_id_ref is None:
        return {"acceso": False, "razon": "Puerta sin condominio asociado"}

    sitio = db.execute(text(
        "SELECT latitud, longitud, radio_geoacceso_metros FROM condominios WHERE id = :cid AND tenant_id = :tid"
    ), {"cid": condominio_id_ref, "tid": tenant_id}).fetchone()
    if not sitio or sitio[0] is None or sitio[1] is None:
        return {"acceso": False, "razon": "Geoacceso no configurado para este condominio. Pide al administrador que configure la ubicacion."}

    lat_sitio, lng_sitio, radio = sitio[0], sitio[1], sitio[2] or 100
    distancia = _distancia_metros(data.lat, data.lng, lat_sitio, lng_sitio)

    if distancia > radio:
        db.execute(text(
            "INSERT INTO registros_acceso_puertas "
            "(puerta_id, tenant_id, tipo_evento, metodo, exitoso, descripcion) "
            "VALUES (:pid, :tid, 'acceso_denegado', 'geoacceso', false, :desc)"
        ), {"pid": data.puerta_id, "tid": tenant_id, "desc": f"{residente.nombre_completo}: fuera de rango ({round(distancia)}m)"})
        db.commit()
        return {"acceso": False, "razon": f"Estas a {round(distancia)}m. Debes estar a menos de {radio}m para abrir por cercania."}

    db.execute(text(
        "UPDATE puertas SET estado = 'abierta', updated_at = NOW() WHERE id = :pid"
    ), {"pid": data.puerta_id})
    db.execute(text(
        "INSERT INTO registros_acceso_puertas "
        "(puerta_id, tenant_id, tipo_evento, metodo, exitoso, descripcion) "
        "VALUES (:pid, :tid, 'acceso_geo', 'geoacceso', true, :desc)"
    ), {"pid": data.puerta_id, "tid": tenant_id, "desc": f"Geoacceso: {residente.nombre_completo} ({round(distancia)}m)"})
    db.commit()

    return {"acceso": True, "titular": residente.nombre_completo, "distancia_metros": round(distancia)}
