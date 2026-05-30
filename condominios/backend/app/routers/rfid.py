from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.database import get_db
from app.core.dependencies import get_current_user
from pydantic import BaseModel
from typing import Optional, List
import json

router = APIRouter(prefix="/api/condominios", tags=["rfid"])

TIPOS_TARJETA = [
    "mifare_classic", "mifare_desfire", "hid", "em4100",
    "iso14443a", "iso14443b", "bip", "bancaria", "otro"
]

CATEGORIAS = [
    "residente", "propietario", "visita", "personal_admin",
    "personal_aseo", "personal_seguridad", "proveedor"
]


class TarjetaCreate(BaseModel):
    uid: str
    tipo_tarjeta: str = "mifare_classic"
    descripcion: Optional[str] = None
    nombre_titular: Optional[str] = None
    persona_id: Optional[int] = None
    categoria: str = "residente"
    fecha_vencimiento: Optional[str] = None
    notas: Optional[str] = None
    tenant_id: int


class PermisoCreate(BaseModel):
    puerta_id: int
    habilitado: bool = True
    horario_json: Optional[str] = None


class VerificarAcceso(BaseModel):
    uid: str
    puerta_id: int
    tenant_id: int


@router.get("/rfid")
def listar_tarjetas(activa: Optional[bool] = None, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    tenant_id = current_user["tenant_id"]
    sql = (
        "SELECT t.id, t.uid, t.tipo_tarjeta, t.descripcion, t.nombre_titular, "
        "t.categoria, t.activa, t.fecha_vencimiento, t.created_at, "
        "p.nombre_completo as persona_nombre "
        "FROM tarjetas_rfid t "
        "LEFT JOIN personas p ON p.id = t.persona_id "
        "WHERE t.tenant_id = :tid"
    )
    params = {"tid": tenant_id}
    if activa is not None:
        sql += " AND t.activa = :activa"
        params["activa"] = activa
    sql += " ORDER BY t.created_at DESC"
    rows = db.execute(text(sql), params).fetchall()
    return [dict(r._mapping) for r in rows]


@router.post("/rfid")
def crear_tarjeta(data: TarjetaCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    existing = db.execute(
        text("SELECT id FROM tarjetas_rfid WHERE uid = :uid AND tenant_id = :tid"),
        {"uid": data.uid.upper().strip(), "tid": data.tenant_id}
    ).fetchone()
    if existing:
        raise HTTPException(status_code=409, detail="UID ya registrado en este sistema")

    row = db.execute(text(
        "INSERT INTO tarjetas_rfid (tenant_id, uid, tipo_tarjeta, descripcion, nombre_titular, "
        "persona_id, categoria, fecha_vencimiento, notas) "
        "VALUES (:tid, :uid, :tipo, :desc, :nombre, :pid, :cat, :fv, :notas) "
        "RETURNING id, uid, tipo_tarjeta, descripcion, nombre_titular, categoria, activa"
    ), {
        "tid": data.tenant_id, "uid": data.uid.upper().strip(),
        "tipo": data.tipo_tarjeta, "desc": data.descripcion,
        "nombre": data.nombre_titular, "pid": data.persona_id,
        "cat": data.categoria, "fv": data.fecha_vencimiento, "notas": data.notas,
    }).fetchone()
    db.commit()
    return dict(row._mapping)


@router.patch("/rfid/{tarjeta_id}")
def actualizar_tarjeta(tarjeta_id: int, data: dict, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    allowed = {"descripcion", "nombre_titular", "categoria", "activa", "fecha_vencimiento", "notas", "tipo_tarjeta"}
    updates = {k: v for k, v in data.items() if k in allowed}
    if not updates:
        raise HTTPException(status_code=400, detail="Nada que actualizar")
    sets = ", ".join(f"{k} = :{k}" for k in updates)
    updates["tid"] = tarjeta_id
    db.execute(text(f"UPDATE tarjetas_rfid SET {sets}, updated_at = NOW() WHERE id = :tid"), updates)
    db.commit()
    return {"success": True}


@router.delete("/rfid/{tarjeta_id}")
def eliminar_tarjeta(tarjeta_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    db.execute(text("DELETE FROM permisos_acceso_rfid WHERE tarjeta_id = :id"), {"id": tarjeta_id})
    db.execute(text("DELETE FROM tarjetas_rfid WHERE id = :id"), {"id": tarjeta_id})
    db.commit()
    return {"success": True}


@router.get("/rfid/{tarjeta_id}/permisos")
def permisos_tarjeta(tarjeta_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    rows = db.execute(text(
        "SELECT pr.id, pr.puerta_id, pr.habilitado, pr.horario_json, "
        "p.nombre as puerta_nombre, p.ubicacion "
        "FROM permisos_acceso_rfid pr "
        "JOIN puertas p ON p.id = pr.puerta_id "
        "WHERE pr.tarjeta_id = :tid"
    ), {"tid": tarjeta_id}).fetchall()
    return [dict(r._mapping) for r in rows]


@router.post("/rfid/{tarjeta_id}/permisos")
def asignar_permiso(tarjeta_id: int, data: PermisoCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    existing = db.execute(
        text("SELECT id FROM permisos_acceso_rfid WHERE tarjeta_id = :tid AND puerta_id = :pid"),
        {"tid": tarjeta_id, "pid": data.puerta_id}
    ).fetchone()
    if existing:
        db.execute(
            text("UPDATE permisos_acceso_rfid SET habilitado = :h, horario_json = :hj "
                 "WHERE tarjeta_id = :tid AND puerta_id = :pid"),
            {"h": data.habilitado, "hj": data.horario_json, "tid": tarjeta_id, "pid": data.puerta_id}
        )
    else:
        db.execute(
            text("INSERT INTO permisos_acceso_rfid (tarjeta_id, puerta_id, habilitado, horario_json) "
                 "VALUES (:tid, :pid, :h, :hj)"),
            {"tid": tarjeta_id, "pid": data.puerta_id, "h": data.habilitado, "hj": data.horario_json}
        )
    db.commit()
    return {"success": True}


@router.delete("/rfid/{tarjeta_id}/permisos/{puerta_id}")
def revocar_permiso(tarjeta_id: int, puerta_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    db.execute(
        text("DELETE FROM permisos_acceso_rfid WHERE tarjeta_id = :tid AND puerta_id = :pid"),
        {"tid": tarjeta_id, "pid": puerta_id}
    )
    db.commit()
    return {"success": True}


@router.post("/rfid/verificar")
async def verificar_acceso(data: VerificarAcceso, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Called by RFID reader hardware to check if UID has access to a door."""
    uid = data.uid.upper().strip()

    tarjeta = db.execute(text(
        "SELECT t.id, t.activa, t.fecha_vencimiento, t.nombre_titular, t.categoria "
        "FROM tarjetas_rfid t WHERE t.uid = :uid AND t.tenant_id = :tid"
    ), {"uid": uid, "tid": data.tenant_id}).fetchone()

    if not tarjeta:
        db.execute(text(
            "INSERT INTO registros_acceso_puertas "
            "(puerta_id, tenant_id, tipo_evento, metodo, uid_tarjeta, exitoso, descripcion) "
            "SELECT :pid, tenant_id, 'acceso_denegado', 'tarjeta_rfid', :uid, false, 'Tarjeta no registrada' "
            "FROM puertas WHERE id = :pid"
        ), {"pid": data.puerta_id, "uid": uid})
        db.commit()
        return {"acceso": False, "razon": "Tarjeta no registrada"}

    tid, activa, fecha_venc, nombre, categoria = tarjeta

    if not activa:
        return {"acceso": False, "razon": "Tarjeta desactivada"}

    from datetime import datetime
    if fecha_venc and datetime.utcnow() > fecha_venc:
        return {"acceso": False, "razon": "Tarjeta vencida"}

    permiso = db.execute(text(
        "SELECT habilitado FROM permisos_acceso_rfid "
        "WHERE tarjeta_id = :tid AND puerta_id = :pid"
    ), {"tid": tid, "pid": data.puerta_id}).fetchone()

    if not permiso or not permiso[0]:
        return {"acceso": False, "razon": "Sin permiso para esta puerta"}

    db.execute(
        text("UPDATE puertas SET estado = 'abierta', updated_at = NOW() WHERE id = :pid"),
        {"pid": data.puerta_id}
    )
    db.execute(text(
        "INSERT INTO registros_acceso_puertas "
        "(puerta_id, tenant_id, tipo_evento, metodo, uid_tarjeta, exitoso, descripcion) "
        "SELECT :pid, tenant_id, 'acceso_tarjeta', 'tarjeta_rfid', :uid, true, :desc "
        "FROM puertas WHERE id = :pid"
    ), {"pid": data.puerta_id, "uid": uid, "desc": f"Acceso: {nombre} ({categoria})"})
    db.commit()

    return {"acceso": True, "titular": nombre, "categoria": categoria}
