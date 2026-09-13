"""
Vehiculos y lector de patentes (ALPR).
- Administracion/residentes registran las patentes por departamento.
- Cualquier camara ALPR o controlador envia el evento a la puerta (portón) con su secreto:
  POST /api/condominios/puertas/{id}/evento  {tipo:"patente", patente:"ABCD12"}
  Si la patente esta autorizada, se abre el portón (webhook de la puerta) y queda el registro
  con el nombre del residente; si no, queda como acceso denegado. Todo aparece en el feed de
  conserjeria con el NOMBRE de la puerta, igual que un timbre del citófono.
"""
import re
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Request, Header
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel, Field
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.routers.portal_auth import get_residente
from app.models import ResidentePortal

router = APIRouter(prefix="/api/vehiculos", tags=["Vehiculos / Patentes"])
_SCHEMA_OK = False


def norm_patente(p: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", (p or "").upper())


def _ensure(db: Session):
    global _SCHEMA_OK
    if _SCHEMA_OK:
        return
    try:
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS vehiculos (
                id SERIAL PRIMARY KEY,
                tenant_id INTEGER NOT NULL REFERENCES tenants(id),
                departamento_id INTEGER,
                depto_numero VARCHAR(20),
                persona_nombre VARCHAR(150),
                patente VARCHAR(12) NOT NULL,
                marca VARCHAR(60), modelo VARCHAR(60), color VARCHAR(40),
                tipo VARCHAR(20) DEFAULT 'residente',
                estacionamiento VARCHAR(20),
                estado VARCHAR(20) DEFAULT 'aprobado',
                registrado_por VARCHAR(30) DEFAULT 'admin',
                notas TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE UNIQUE INDEX IF NOT EXISTS ux_vehiculos_tenant_patente ON vehiculos(tenant_id, patente);
            ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS departamento_id INTEGER;
            ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS persona_nombre VARCHAR(150);
            ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS tipo VARCHAR(20) DEFAULT 'residente';
            ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS estacionamiento VARCHAR(20);
            ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS estado VARCHAR(20) DEFAULT 'aprobado';
            ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS registrado_por VARCHAR(30) DEFAULT 'admin';
            ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS notas TEXT;
            ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS tag_uid VARCHAR(64);
            ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS tag_tipo VARCHAR(10);
            CREATE UNIQUE INDEX IF NOT EXISTS ux_vehiculos_tenant_tag ON vehiculos(tenant_id, tag_uid) WHERE tag_uid IS NOT NULL;
        """))
        db.commit(); _SCHEMA_OK = True
    except Exception:
        db.rollback()


def norm_tag(t: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", (t or "").upper())


class VehiculoIn(BaseModel):
    patente: str = Field(..., min_length=5, max_length=10)
    tag_uid: Optional[str] = None       # EPC del TAG UHF o UID NFC
    tag_tipo: Optional[str] = None      # uhf | nfc
    departamento_id: Optional[int] = None
    persona_nombre: Optional[str] = None
    marca: Optional[str] = None
    modelo: Optional[str] = None
    color: Optional[str] = None
    tipo: str = "residente"          # residente | propietario | visita | proveedor
    estacionamiento: Optional[str] = None
    notas: Optional[str] = None


def _depto(db: Session, did: Optional[int], tid: int):
    if not did:
        return None
    row = db.execute(text("SELECT d.id, d.numero, COALESCE(r.nombre_completo, p.nombre_completo) AS nombre FROM departamentos d "
                          "LEFT JOIN personas r ON r.id=d.residente_id LEFT JOIN personas p ON p.id=d.propietario_id "
                          "WHERE d.id=:d AND d.tenant_id=:t"), {"d": did, "t": tid}).fetchone()
    if not row:
        raise HTTPException(404, "Departamento no encontrado en este condominio")
    return dict(row._mapping)


# ---------- admin / conserje ----------

@router.get("")
def listar(estado: Optional[str] = None, q: Optional[str] = None, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    _ensure(db)
    sql = "SELECT * FROM vehiculos WHERE tenant_id=:t"; params: dict = {"t": current_user["tenant_id"]}
    if estado:
        sql += " AND estado=:e"; params["e"] = estado
    if q:
        sql += " AND (patente ILIKE :q OR depto_numero ILIKE :q OR persona_nombre ILIKE :q)"; params["q"] = f"%{q}%"
    sql += " ORDER BY (estado='pendiente') DESC, length(depto_numero), depto_numero, patente"
    out = []
    for r in db.execute(text(sql), params).fetchall():
        d = dict(r._mapping); d["created_at"] = str(d["created_at"]); out.append(d)
    return out


@router.post("", status_code=201)
def crear(body: VehiculoIn, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    _ensure(db)
    tid = current_user["tenant_id"]
    pat = norm_patente(body.patente)
    if len(pat) < 5:
        raise HTTPException(400, "Patente inválida")
    if db.execute(text("SELECT 1 FROM vehiculos WHERE tenant_id=:t AND patente=:p"), {"t": tid, "p": pat}).fetchone():
        raise HTTPException(400, f"La patente {pat} ya está registrada")
    dep = _depto(db, body.departamento_id, tid)
    tag = norm_tag(body.tag_uid) or None
    if tag and db.execute(text("SELECT 1 FROM vehiculos WHERE tenant_id=:t AND tag_uid=:g"), {"t": tid, "g": tag}).fetchone():
        raise HTTPException(400, f"El TAG {tag} ya está asignado a otro vehículo")
    vid = db.execute(text("""
        INSERT INTO vehiculos (tenant_id, departamento_id, depto_numero, persona_nombre, patente, marca, modelo, color, tipo, estacionamiento, estado, registrado_por, notas, tag_uid, tag_tipo)
        VALUES (:t, :did, :num, :pn, :p, :ma, :mo, :co, :tipo, :est, 'aprobado', 'admin', :n, :tag, :tt) RETURNING id
    """), {"t": tid, "did": body.departamento_id, "num": dep["numero"] if dep else None,
           "pn": body.persona_nombre or (dep["nombre"] if dep else None), "p": pat, "ma": body.marca, "mo": body.modelo, "co": body.color,
           "tipo": body.tipo, "est": body.estacionamiento, "n": body.notas, "tag": tag, "tt": (body.tag_tipo or ("uhf" if tag else None))}).scalar()
    db.commit()
    return {"id": vid, "patente": pat}


@router.patch("/{vid}/aprobar")
def aprobar(vid: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    _ensure(db)
    r = db.execute(text("UPDATE vehiculos SET estado='aprobado' WHERE id=:id AND tenant_id=:t"), {"id": vid, "t": current_user["tenant_id"]})
    db.commit()
    if r.rowcount == 0: raise HTTPException(404, "Vehículo no encontrado")
    return {"ok": True}


@router.patch("/{vid}/bloquear")
def bloquear(vid: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    _ensure(db)
    r = db.execute(text("UPDATE vehiculos SET estado='bloqueado' WHERE id=:id AND tenant_id=:t"), {"id": vid, "t": current_user["tenant_id"]})
    db.commit()
    if r.rowcount == 0: raise HTTPException(404, "Vehículo no encontrado")
    return {"ok": True}


@router.delete("/{vid}")
def eliminar(vid: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    _ensure(db)
    r = db.execute(text("DELETE FROM vehiculos WHERE id=:id AND tenant_id=:t"), {"id": vid, "t": current_user["tenant_id"]})
    db.commit()
    if r.rowcount == 0: raise HTTPException(404, "Vehículo no encontrado")
    return {"ok": True}


class TagIn(BaseModel):
    tag_uid: Optional[str] = None
    tag_tipo: Optional[str] = "uhf"


@router.patch("/{vid}/tag")
def asignar_tag(vid: int, body: TagIn, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Asigna (o quita, con tag_uid vacio) el TAG UHF / NFC de un vehiculo."""
    _ensure(db)
    tid = current_user["tenant_id"]
    tag = norm_tag(body.tag_uid) or None
    if tag:
        dup = db.execute(text("SELECT id, patente FROM vehiculos WHERE tenant_id=:t AND tag_uid=:g AND id<>:id"), {"t": tid, "g": tag, "id": vid}).fetchone()
        if dup:
            raise HTTPException(400, f"Ese TAG ya está asignado a la patente {dup[1]}")
    r = db.execute(text("UPDATE vehiculos SET tag_uid=:g, tag_tipo=:tt WHERE id=:id AND tenant_id=:t"), {"g": tag, "tt": body.tag_tipo if tag else None, "id": vid, "t": tid})
    db.commit()
    if r.rowcount == 0: raise HTTPException(404, "Vehículo no encontrado")
    return {"ok": True, "tag_uid": tag}


@router.get("/tags-no-asignados")
def tags_no_asignados(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Ultimos TAG/NFC leidos por los lectores que aun no pertenecen a ningun vehiculo (para asignarlos con un clic)."""
    _ensure(db)
    rows = db.execute(text("""
        SELECT r.uid_tarjeta AS uid, MAX(r.created_at)::text AS ultima_lectura, COUNT(*) AS lecturas, MAX(p.nombre) AS puerta
        FROM registros_acceso_puertas r JOIN puertas p ON p.id=r.puerta_id
        WHERE r.tenant_id=:t AND r.tipo_evento='denegado_tag' AND r.uid_tarjeta IS NOT NULL
          AND r.created_at > NOW() - INTERVAL '2 days'
          AND NOT EXISTS (SELECT 1 FROM vehiculos v WHERE v.tenant_id=r.tenant_id AND v.tag_uid=r.uid_tarjeta)
        GROUP BY r.uid_tarjeta ORDER BY MAX(r.created_at) DESC LIMIT 20
    """), {"t": current_user["tenant_id"]}).fetchall()
    return [dict(x._mapping) for x in rows]


@router.get("/buscar/{patente}")
def buscar(patente: str, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Conserjeria: ¿de quién es esta patente?"""
    _ensure(db)
    row = db.execute(text("SELECT * FROM vehiculos WHERE tenant_id=:t AND patente=:p"), {"t": current_user["tenant_id"], "p": norm_patente(patente)}).fetchone()
    if not row:
        return {"encontrado": False, "patente": norm_patente(patente)}
    d = dict(row._mapping); d["created_at"] = str(d["created_at"]); d["encontrado"] = True
    return d


# ---------- portal residente ----------

class VehiculoPortalIn(BaseModel):
    patente: str = Field(..., min_length=5, max_length=10)
    marca: Optional[str] = None
    modelo: Optional[str] = None
    color: Optional[str] = None


@router.get("/portal/mis-vehiculos")
def mis_vehiculos(r: ResidentePortal = Depends(get_residente), db: Session = Depends(get_db)):
    _ensure(db)
    if not r.departamento_id:
        return []
    rows = db.execute(text("SELECT id, patente, marca, modelo, color, estado, estacionamiento, created_at::text FROM vehiculos WHERE tenant_id=:t AND departamento_id=:d ORDER BY created_at DESC"),
                      {"t": r.tenant_id, "d": r.departamento_id}).fetchall()
    return [dict(x._mapping) for x in rows]


@router.post("/portal/mis-vehiculos", status_code=201)
def registrar_mi_vehiculo(body: VehiculoPortalIn, r: ResidentePortal = Depends(get_residente), db: Session = Depends(get_db)):
    """El residente inscribe su patente; queda pendiente hasta que administración la apruebe."""
    _ensure(db)
    if not r.departamento_id:
        raise HTTPException(400, "Tu cuenta no tiene departamento asignado")
    pat = norm_patente(body.patente)
    if len(pat) < 5:
        raise HTTPException(400, "Patente inválida")
    if db.execute(text("SELECT 1 FROM vehiculos WHERE tenant_id=:t AND patente=:p"), {"t": r.tenant_id, "p": pat}).fetchone():
        raise HTTPException(400, "Esa patente ya está registrada en el condominio")
    n = db.execute(text("SELECT COUNT(*) FROM vehiculos WHERE tenant_id=:t AND departamento_id=:d"), {"t": r.tenant_id, "d": r.departamento_id}).scalar()
    if n >= 4:
        raise HTTPException(400, "Máximo 4 vehículos por departamento")
    num = db.execute(text("SELECT numero FROM departamentos WHERE id=:d"), {"d": r.departamento_id}).scalar()
    db.execute(text("""
        INSERT INTO vehiculos (tenant_id, departamento_id, depto_numero, persona_nombre, patente, marca, modelo, color, tipo, estado, registrado_por)
        VALUES (:t, :d, :num, :pn, :p, :ma, :mo, :co, 'residente', 'pendiente', 'residente')
    """), {"t": r.tenant_id, "d": r.departamento_id, "num": num, "pn": r.nombre_completo, "p": pat, "ma": body.marca, "mo": body.modelo, "co": body.color})
    db.commit()
    return {"ok": True, "patente": pat, "estado": "pendiente"}


@router.delete("/portal/mis-vehiculos/{vid}")
def borrar_mi_vehiculo(vid: int, r: ResidentePortal = Depends(get_residente), db: Session = Depends(get_db)):
    _ensure(db)
    res = db.execute(text("DELETE FROM vehiculos WHERE id=:id AND tenant_id=:t AND departamento_id=:d"), {"id": vid, "t": r.tenant_id, "d": r.departamento_id})
    db.commit()
    if res.rowcount == 0: raise HTTPException(404, "Vehículo no encontrado")
    return {"ok": True}
