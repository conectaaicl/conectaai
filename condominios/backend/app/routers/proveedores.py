"""
Proveedores y Órdenes de Trabajo
GET    /api/proveedores              → listar proveedores
POST   /api/proveedores              → crear proveedor
PUT    /api/proveedores/{id}         → actualizar
DELETE /api/proveedores/{id}         → desactivar
GET    /api/proveedores/rubros       → lista de rubros
GET    /api/proveedores/{id}/ordenes → OTs del proveedor
GET    /api/proveedores/ordenes      → todas las OTs
POST   /api/proveedores/ordenes      → crear OT
PATCH  /api/proveedores/ordenes/{id}/estado → actualizar estado OT
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional
from pydantic import BaseModel
from app.core.database import get_db

router = APIRouter(prefix="/api/proveedores", tags=["Proveedores"])

RUBROS = ["plomeria", "electricidad", "gas", "ascensores", "jardines", "limpieza",
          "seguridad", "pintura", "cerrajeria", "informatica", "climatizacion", "otro"]

ESTADOS_OT = ["solicitada", "aprobada", "en_proceso", "completada", "cancelada"]
PRIORIDADES = ["urgente", "alta", "normal", "baja"]


def _ensure_tables(db: Session):
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS proveedores (
            id SERIAL PRIMARY KEY,
            tenant_id INTEGER NOT NULL,
            nombre VARCHAR(200) NOT NULL,
            rut VARCHAR(20),
            rubro VARCHAR(100) NOT NULL,
            contacto_nombre VARCHAR(200),
            telefono VARCHAR(30),
            email VARCHAR(200),
            calificacion INTEGER DEFAULT 0,
            activo BOOLEAN DEFAULT true,
            notas TEXT,
            ultima_contratacion DATE,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    """))
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS ots_proveedores (
            id SERIAL PRIMARY KEY,
            tenant_id INTEGER NOT NULL,
            proveedor_id INTEGER REFERENCES proveedores(id),
            titulo VARCHAR(200) NOT NULL,
            descripcion TEXT,
            estado VARCHAR(20) DEFAULT 'solicitada',
            prioridad VARCHAR(20) DEFAULT 'normal',
            monto_presupuesto DECIMAL(12,2),
            monto_final DECIMAL(12,2),
            fecha_solicitud DATE DEFAULT CURRENT_DATE,
            fecha_inicio DATE,
            fecha_fin DATE,
            solicitado_por VARCHAR(200),
            notas TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    """))
    db.commit()


class ProveedorCreate(BaseModel):
    tenant_id: int
    nombre: str
    rut: Optional[str] = None
    rubro: str
    contacto_nombre: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    calificacion: int = 0
    notas: Optional[str] = None


class ProveedorUpdate(BaseModel):
    nombre: Optional[str] = None
    rut: Optional[str] = None
    rubro: Optional[str] = None
    contacto_nombre: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    calificacion: Optional[int] = None
    notas: Optional[str] = None
    activo: Optional[bool] = None
    ultima_contratacion: Optional[str] = None


class OTCreate(BaseModel):
    tenant_id: int
    proveedor_id: Optional[int] = None
    titulo: str
    descripcion: Optional[str] = None
    prioridad: str = "normal"
    monto_presupuesto: Optional[float] = None
    fecha_inicio: Optional[str] = None
    fecha_fin: Optional[str] = None
    solicitado_por: Optional[str] = None
    notas: Optional[str] = None


class OTEstado(BaseModel):
    estado: str
    notas: Optional[str] = None
    monto_final: Optional[float] = None


@router.get("/rubros")
def get_rubros():
    return RUBROS


@router.get("")
def listar_proveedores(
    tenant_id: int,
    rubro: Optional[str] = None,
    activo: bool = True,
    limit: int = 200,
    db: Session = Depends(get_db),
):
    _ensure_tables(db)
    sql = "SELECT * FROM proveedores WHERE tenant_id=:tid AND activo=:act"
    p: dict = {"tid": tenant_id, "act": activo}
    if rubro:
        sql += " AND rubro=:rubro"
        p["rubro"] = rubro
    sql += " ORDER BY nombre LIMIT :lim"
    p["lim"] = limit
    rows = db.execute(text(sql), p).fetchall()
    result = []
    for r in rows:
        d = dict(r._mapping)
        d["created_at"] = str(d.get("created_at") or "")
        d["ultima_contratacion"] = str(d.get("ultima_contratacion") or "")
        result.append(d)
    return result


@router.post("", status_code=201)
def crear_proveedor(body: ProveedorCreate, db: Session = Depends(get_db)):
    _ensure_tables(db)
    if body.rubro not in RUBROS:
        raise HTTPException(400, "Rubro invalido")
    row = db.execute(text(
        "INSERT INTO proveedores (tenant_id,nombre,rut,rubro,contacto_nombre,telefono,email,calificacion,notas) "
        "VALUES (:tid,:nom,:rut,:rubro,:cn,:tel,:email,:cal,:notas) RETURNING id"
    ), {"tid": body.tenant_id, "nom": body.nombre, "rut": body.rut, "rubro": body.rubro,
        "cn": body.contacto_nombre, "tel": body.telefono, "email": body.email,
        "cal": body.calificacion, "notas": body.notas}).fetchone()
    db.commit()
    return {"id": row._mapping["id"]}


@router.put("/{prov_id}")
def actualizar_proveedor(prov_id: int, body: ProveedorUpdate, db: Session = Depends(get_db)):
    fields = {k: v for k, v in body.model_dump().items() if v is not None}
    if not fields:
        raise HTTPException(400, "Sin campos para actualizar")
    set_clause = ", ".join(f"{k}=:{k}" for k in fields)
    fields["id"] = prov_id
    db.execute(text(f"UPDATE proveedores SET {set_clause} WHERE id=:id"), fields)
    db.commit()
    return {"ok": True}


@router.delete("/{prov_id}")
def eliminar_proveedor(prov_id: int, db: Session = Depends(get_db)):
    db.execute(text("UPDATE proveedores SET activo=false WHERE id=:id"), {"id": prov_id})
    db.commit()
    return {"ok": True}


@router.get("/{prov_id}/ordenes")
def ordenes_proveedor(prov_id: int, tenant_id: int, db: Session = Depends(get_db)):
    _ensure_tables(db)
    rows = db.execute(text(
        "SELECT ot.*, p.nombre as proveedor_nombre FROM ots_proveedores ot "
        "LEFT JOIN proveedores p ON p.id=ot.proveedor_id "
        "WHERE ot.proveedor_id=:pid AND ot.tenant_id=:tid ORDER BY ot.created_at DESC"
    ), {"pid": prov_id, "tid": tenant_id}).fetchall()
    return [_ot_dict(r) for r in rows]


@router.get("/ordenes")
def listar_ordenes(
    tenant_id: int,
    estado: Optional[str] = None,
    prioridad: Optional[str] = None,
    proveedor_id: Optional[int] = None,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    _ensure_tables(db)
    sql = ("SELECT ot.*, p.nombre as proveedor_nombre FROM ots_proveedores ot "
           "LEFT JOIN proveedores p ON p.id=ot.proveedor_id WHERE ot.tenant_id=:tid")
    p: dict = {"tid": tenant_id}
    if estado:
        sql += " AND ot.estado=:est"; p["est"] = estado
    if prioridad:
        sql += " AND ot.prioridad=:prio"; p["prio"] = prioridad
    if proveedor_id:
        sql += " AND ot.proveedor_id=:pvid"; p["pvid"] = proveedor_id
    sql += " ORDER BY ot.created_at DESC LIMIT :lim"; p["lim"] = limit
    rows = db.execute(text(sql), p).fetchall()
    return [_ot_dict(r) for r in rows]


@router.post("/ordenes", status_code=201)
def crear_orden(body: OTCreate, db: Session = Depends(get_db)):
    _ensure_tables(db)
    if body.prioridad not in PRIORIDADES:
        raise HTTPException(400, "Prioridad invalida")
    row = db.execute(text(
        "INSERT INTO ots_proveedores (tenant_id,proveedor_id,titulo,descripcion,prioridad,"
        "monto_presupuesto,fecha_inicio,fecha_fin,solicitado_por,notas) "
        "VALUES (:tid,:pvid,:tit,:desc,:prio,:mp,:fi,:ff,:spor,:notas) RETURNING id"
    ), {"tid": body.tenant_id, "pvid": body.proveedor_id, "tit": body.titulo,
        "desc": body.descripcion, "prio": body.prioridad, "mp": body.monto_presupuesto,
        "fi": body.fecha_inicio, "ff": body.fecha_fin, "spor": body.solicitado_por,
        "notas": body.notas}).fetchone()
    db.commit()
    return {"id": row._mapping["id"]}


@router.patch("/ordenes/{ot_id}/estado")
def cambiar_estado_ot(ot_id: int, body: OTEstado, db: Session = Depends(get_db)):
    if body.estado not in ESTADOS_OT:
        raise HTTPException(400, "Estado invalido")
    updates = "estado=:est"
    p: dict = {"est": body.estado, "id": ot_id}
    if body.notas:
        updates += ", notas=:notas"; p["notas"] = body.notas
    if body.monto_final is not None:
        updates += ", monto_final=:mf"; p["mf"] = body.monto_final
    if body.estado == "completada":
        updates += ", fecha_fin=CURRENT_DATE"
    db.execute(text(f"UPDATE ots_proveedores SET {updates} WHERE id=:id"), p)
    db.commit()
    return {"ok": True}


def _ot_dict(r) -> dict:
    d = dict(r._mapping)
    for f in ["created_at", "fecha_solicitud", "fecha_inicio", "fecha_fin"]:
        d[f] = str(d.get(f) or "")
    return d
