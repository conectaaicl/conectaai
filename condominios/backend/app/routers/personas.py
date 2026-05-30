from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Response as FastResponse
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Optional
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.persona import Persona
from app.models.historial import HistorialEvento
from app.schemas.persona import PersonaCreate, PersonaUpdate, PersonaResponse
import csv as _csv
import io as _io

router = APIRouter(prefix="/api/personas", tags=["personas"])


def _log(db, tenant_id, accion, descripcion, entidad_id=None):
    try:
        ev = HistorialEvento(
            tenant_id=tenant_id, modulo="personas",
            accion=accion, descripcion=descripcion, entidad_id=entidad_id
        )
        db.add(ev)
        db.commit()
    except Exception:
        db.rollback()


@router.post("", response_model=PersonaResponse)
def crear_persona(persona: PersonaCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    existing = db.query(Persona).filter(Persona.rut == persona.rut).first()
    if existing:
        raise HTTPException(status_code=400, detail="RUT ya existe")

    persona_data = persona.model_dump()
    if not persona_data.get("tenant_id"):
        persona_data["tenant_id"] = 1

    datos_contacto = persona_data.get("datos_contacto", {})
    if datos_contacto.get("torre") and datos_contacto.get("piso") and datos_contacto.get("departamento"):
        from app.models.estructura import Torre, Piso, Departamento
        torre_nombre = datos_contacto["torre"]
        piso_numero = int(datos_contacto["piso"])
        depto_numero = datos_contacto["departamento"]
        condominio_id = datos_contacto.get("condominio_id")
        if condominio_id:
            torre = db.query(Torre).filter(Torre.condominio_id == int(condominio_id), Torre.nombre == torre_nombre).first()
            if torre:
                piso = db.query(Piso).filter(Piso.torre_id == torre.id, Piso.numero == piso_numero).first()
                if piso:
                    depto_existente = db.query(Departamento).filter(Departamento.piso_id == piso.id, Departamento.numero == depto_numero).first()
                    if not depto_existente:
                        db.add(Departamento(piso_id=piso.id, tenant_id=persona_data["tenant_id"], numero=depto_numero, estado="ocupado"))
                        db.commit()

    db_persona = Persona(**persona_data)
    db.add(db_persona)
    db.commit()
    db.refresh(db_persona)

    roles_str = ", ".join(db_persona.roles) if db_persona.roles else "sin rol"
    _log(db, db_persona.tenant_id, "crear",
         "Persona registrada: " + db_persona.nombre_completo + " (" + roles_str + ")", db_persona.id)

    return db_persona


@router.get("", response_model=List[PersonaResponse])
def listar_personas(
    rol: Optional[str] = None, estado: Optional[str] = None,
    skip: int = 0, limit: int = 200, db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    tenant_id = current_user["tenant_id"]
    query = db.query(Persona).filter(Persona.tenant_id == tenant_id)
    if rol:
        query = query.filter(Persona.roles.contains([rol]))
    if estado:
        query = query.filter(Persona.estado == estado)
    return query.order_by(Persona.id.desc()).offset(skip).limit(limit).all()


@router.get("/{persona_id}", response_model=PersonaResponse)
def obtener_persona(persona_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    persona = db.query(Persona).filter(Persona.id == persona_id).first()
    if not persona:
        raise HTTPException(status_code=404, detail="Persona no encontrada")
    return persona


@router.put("/{persona_id}", response_model=PersonaResponse)
def actualizar_persona(persona_id: int, persona_update: PersonaUpdate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    persona = db.query(Persona).filter(Persona.id == persona_id).first()
    if not persona:
        raise HTTPException(status_code=404, detail="Persona no encontrada")
    update_data = persona_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(persona, field, value)
    db.commit()
    db.refresh(persona)
    _log(db, persona.tenant_id, "editar",
         "Persona actualizada: " + persona.nombre_completo, persona.id)
    return persona


@router.delete("/{persona_id}")
def eliminar_persona(persona_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    persona = db.query(Persona).filter(Persona.id == persona_id).first()
    if not persona:
        raise HTTPException(status_code=404, detail="Persona no encontrada")
    nombre = persona.nombre_completo
    tenant_id = persona.tenant_id
    persona.estado = "inactivo"
    db.commit()
    _log(db, tenant_id, "eliminar", "Persona desactivada: " + nombre, persona_id)
    return {"message": "Persona eliminada exitosamente"}


@router.get("/{persona_id}/historial")
def historial_persona(persona_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    tenant_id = current_user["tenant_id"]
    from sqlalchemy import desc
    items = (
        db.query(HistorialEvento)
        .filter(HistorialEvento.tenant_id == tenant_id, HistorialEvento.entidad_id == persona_id)
        .order_by(desc(HistorialEvento.fecha))
        .limit(50)
        .all()
    )
    return [
        {"id": i.id, "modulo": i.modulo, "accion": i.accion, "descripcion": i.descripcion,
         "fecha": i.fecha.isoformat() if i.fecha else None}
        for i in items
    ]


@router.get("/{persona_id}/acceso")
def get_acceso_persona(persona_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    tenant_id = current_user["tenant_id"]
    rows = db.execute(text(
        "SELECT t.id, t.uid, t.tipo_tarjeta, t.nombre_titular, t.categoria, "
        "t.activa, t.created_at::text, t.fecha_vencimiento::text "
        "FROM tarjetas_rfid t "
        "WHERE t.persona_id = :pid AND t.tenant_id = :tid "
        "ORDER BY t.created_at DESC"
    ), {"pid": persona_id, "tid": tenant_id}).fetchall()
    return [dict(r._mapping) for r in rows]


@router.post("/{persona_id}/acceso")
def crear_acceso_persona(persona_id: int, data: dict, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    persona = db.query(Persona).filter(Persona.id == persona_id).first()
    if not persona:
        raise HTTPException(404, "Persona no encontrada")

    uid = data.get("uid", "").upper().strip()
    if not uid:
        raise HTTPException(400, "UID de tarjeta requerido")

    tenant_id = data.get("tenant_id", persona.tenant_id)

    cat_map = {
        "propietario": "propietario", "residente": "residente", "arrendatario": "residente",
        "conserje": "personal_admin", "guardia": "personal_seguridad", "administrador": "personal_admin",
        "sub_administrador": "personal_admin", "aseo": "personal_aseo", "mantencion": "personal_admin",
        "jardinero": "personal_aseo",
    }
    rol = persona.roles[0] if persona.roles else "residente"
    categoria = cat_map.get(rol, "residente")

    try:
        row = db.execute(text(
            "INSERT INTO tarjetas_rfid (tenant_id, uid, tipo_tarjeta, nombre_titular, persona_id, categoria) "
            "VALUES (:tid, :uid, :tipo, :nombre, :pid, :cat) "
            "ON CONFLICT (uid, tenant_id) DO UPDATE "
            "SET persona_id = :pid, nombre_titular = :nombre, updated_at = NOW() "
            "RETURNING id, uid, tipo_tarjeta, nombre_titular, categoria, activa"
        ), {
            "tid": tenant_id, "uid": uid,
            "tipo": data.get("tipo_tarjeta", "mifare_classic"),
            "nombre": persona.nombre_completo, "pid": persona_id, "cat": categoria,
        }).fetchone()
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(400, "Error creando tarjeta: " + str(e))

    tarjeta_id = row._mapping["id"]

    puertas = data.get("puertas", [])
    for puerta_id in puertas:
        try:
            db.execute(text(
                "INSERT INTO permisos_acceso_rfid (tarjeta_id, puerta_id, habilitado) "
                "VALUES (:tid, :pid, true) ON CONFLICT DO NOTHING"
            ), {"tid": tarjeta_id, "pid": puerta_id})
        except Exception:
            pass
    if puertas:
        db.commit()

    _log(db, tenant_id, "acceso_asignado",
         "Tarjeta RFID " + uid + " asignada a " + persona.nombre_completo, persona_id)

    return {**dict(row._mapping), "puertas_asignadas": len(puertas)}


@router.delete("/{persona_id}/acceso/{tarjeta_id}")
def eliminar_acceso_persona(persona_id: int, tarjeta_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    tenant_id = current_user["tenant_id"]
    persona = db.query(Persona).filter(Persona.id == persona_id).first()
    db.execute(text(
        "UPDATE tarjetas_rfid SET activa = false, updated_at = NOW() WHERE id = :id AND persona_id = :pid"
    ), {"id": tarjeta_id, "pid": persona_id})
    db.commit()
    if persona:
        _log(db, persona.tenant_id, "acceso_revocado",
             "Tarjeta RFID desactivada para " + persona.nombre_completo, persona_id)
    return {"ok": True}


@router.post("/{persona_id}/roles")
def agregar_rol(persona_id: int, rol: str, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    persona = db.query(Persona).filter(Persona.id == persona_id).first()
    if not persona:
        raise HTTPException(status_code=404, detail="Persona no encontrada")
    if rol not in persona.roles:
        persona.roles = persona.roles + [rol]
        db.commit()
        db.refresh(persona)
    return persona


@router.delete("/{persona_id}/roles/{rol}")
def quitar_rol(persona_id: int, rol: str, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    persona = db.query(Persona).filter(Persona.id == persona_id).first()
    if not persona:
        raise HTTPException(status_code=404, detail="Persona no encontrada")
    if rol in persona.roles:
        persona.roles = [r for r in persona.roles if r != rol]
        db.commit()
        db.refresh(persona)
    return persona


@router.get("/{persona_id}/portal-cuenta")
def get_portal_cuenta(persona_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    tenant_id = current_user["tenant_id"]
    persona = db.query(Persona).filter(Persona.id == persona_id).first()
    if not persona:
        raise HTTPException(404, "Persona no encontrada")
    row = db.execute(text(
        "SELECT id, rut, nombre_completo, email, departamento_id, activo, ultimo_login::text, creado_en::text "
        "FROM residentes_portal WHERE rut = :rut AND tenant_id = :tid"
    ), {"rut": persona.rut, "tid": tenant_id}).fetchone()
    if not row:
        return {"tiene_cuenta": False, "rut": persona.rut}
    d = dict(row._mapping)
    d["tiene_cuenta"] = True
    return d


@router.post("/{persona_id}/portal-cuenta")
def crear_portal_cuenta(persona_id: int, data: dict, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    persona = db.query(Persona).filter(Persona.id == persona_id).first()
    if not persona:
        raise HTTPException(404, "Persona no encontrada")
    if not persona.rut:
        raise HTTPException(400, "El residente no tiene RUT registrado")

    tenant_id = data.get("tenant_id", persona.tenant_id)
    depto_id = data.get("departamento_id")
    password = data.get("password", "")
    if not password or len(password) < 6:
        raise HTTPException(400, "Contraseña mínimo 6 caracteres")

    import bcrypt
    pw_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

    existing = db.execute(text(
        "SELECT id FROM residentes_portal WHERE rut = :rut AND tenant_id = :tid"
    ), {"rut": persona.rut, "tid": tenant_id}).fetchone()

    if existing:
        db.execute(text(
            "UPDATE residentes_portal SET nombre_completo = :nombre, email = :email, "
            "password_hash = :pw, departamento_id = COALESCE(:did, departamento_id), "
            "activo = true, failed_attempts = 0, locked_until = NULL WHERE id = :id"
        ), {"nombre": persona.nombre_completo, "email": persona.email,
             "pw": pw_hash, "did": depto_id, "id": existing._mapping["id"]})
        db.commit()
        _log(db, tenant_id, "portal_actualizado", "Cuenta portal actualizada para " + persona.nombre_completo, persona_id)
        return {"ok": True, "accion": "actualizada", "rut": persona.rut, "password": password}
    else:
        db.execute(text(
            "INSERT INTO residentes_portal (tenant_id, rut, nombre_completo, email, telefono, password_hash, departamento_id, activo) "
            "VALUES (:tid, :rut, :nombre, :email, :tel, :pw, :did, true)"
        ), {"tid": tenant_id, "rut": persona.rut, "nombre": persona.nombre_completo,
             "email": persona.email, "tel": persona.telefono, "pw": pw_hash, "did": depto_id})
        db.commit()
        _log(db, tenant_id, "portal_creado", "Cuenta portal creada para " + persona.nombre_completo, persona_id)
        return {"ok": True, "accion": "creada", "rut": persona.rut, "password": password}
