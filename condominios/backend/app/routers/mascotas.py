"""
Mascotas — registro de mascotas por departamento
GET    /api/mascotas            → listar
POST   /api/mascotas            → registrar
PUT    /api/mascotas/{id}       → actualizar
DELETE /api/mascotas/{id}       → desactivar
GET    /api/mascotas/alertas-vacunas → mascotas con vacunas vencidas o por vencer
GET    /api/mascotas/resumen    → conteo por especie
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional
from pydantic import BaseModel
from app.core.database import get_db
from app.core.dependencies import get_current_user

router = APIRouter(prefix="/api/mascotas", tags=["Mascotas"])

ESPECIES = ["perro", "gato", "ave", "conejo", "hamster", "reptil", "otro"]


def _ensure_table(db: Session):
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS mascotas (
            id SERIAL PRIMARY KEY,
            tenant_id INTEGER NOT NULL,
            persona_id INTEGER,
            departamento_id INTEGER,
            depto_numero VARCHAR(20) NOT NULL,
            nombre VARCHAR(100) NOT NULL,
            especie VARCHAR(50) NOT NULL,
            raza VARCHAR(100),
            color VARCHAR(100),
            edad_anios INTEGER,
            peso_kg DECIMAL(5,2),
            chip_numero VARCHAR(100),
            foto_url TEXT,
            vacunas_vigentes BOOLEAN DEFAULT false,
            fecha_ultima_vacuna DATE,
            fecha_proxima_vacuna DATE,
            observaciones TEXT,
            activo BOOLEAN DEFAULT true,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    """))
    db.commit()


class MascotaCreate(BaseModel):
    persona_id: Optional[int] = None
    depto_numero: str
    nombre: str
    especie: str
    raza: Optional[str] = None
    color: Optional[str] = None
    edad_anios: Optional[int] = None
    peso_kg: Optional[float] = None
    chip_numero: Optional[str] = None
    foto_url: Optional[str] = None
    vacunas_vigentes: bool = False
    fecha_ultima_vacuna: Optional[str] = None
    fecha_proxima_vacuna: Optional[str] = None
    observaciones: Optional[str] = None


class MascotaUpdate(BaseModel):
    nombre: Optional[str] = None
    raza: Optional[str] = None
    color: Optional[str] = None
    edad_anios: Optional[int] = None
    peso_kg: Optional[float] = None
    chip_numero: Optional[str] = None
    foto_url: Optional[str] = None
    vacunas_vigentes: Optional[bool] = None
    fecha_ultima_vacuna: Optional[str] = None
    fecha_proxima_vacuna: Optional[str] = None
    observaciones: Optional[str] = None
    activo: Optional[bool] = None


@router.get("")
def listar_mascotas(
    depto: Optional[str] = None,
    especie: Optional[str] = None,
    activo: bool = True,
    limit: int = 200,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    tenant_id = current_user["tenant_id"]
    _ensure_table(db)
    sql = "SELECT * FROM mascotas WHERE tenant_id=:tid AND activo=:act"
    p: dict = {"tid": tenant_id, "act": activo}
    if depto:
        sql += " AND depto_numero ILIKE :dep"
        p["dep"] = "%" + depto + "%"
    if especie:
        sql += " AND especie=:esp"
        p["esp"] = especie
    sql += " ORDER BY depto_numero, nombre LIMIT :lim"
    p["lim"] = limit
    rows = db.execute(text(sql), p).fetchall()
    result = []
    for r in rows:
        d = dict(r._mapping)
        for f in ["created_at", "fecha_ultima_vacuna", "fecha_proxima_vacuna"]:
            d[f] = str(d.get(f) or "")
        result.append(d)
    return result


@router.get("/alertas-vacunas")
def alertas_vacunas(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_id = current_user["tenant_id"]
    _ensure_table(db)
    rows = db.execute(text(
        "SELECT * FROM mascotas WHERE tenant_id=:tid AND activo=true "
        "AND (fecha_proxima_vacuna <= CURRENT_DATE + INTERVAL '30 days' "
        "     OR vacunas_vigentes=false) "
        "ORDER BY fecha_proxima_vacuna ASC NULLS LAST LIMIT 100"
    ), {"tid": tenant_id}).fetchall()
    result = []
    for r in rows:
        d = dict(r._mapping)
        for f in ["created_at", "fecha_ultima_vacuna", "fecha_proxima_vacuna"]:
            d[f] = str(d.get(f) or "")
        result.append(d)
    return result


@router.get("/resumen")
def resumen_mascotas(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_id = current_user["tenant_id"]
    _ensure_table(db)
    rows = db.execute(text(
        "SELECT especie, COUNT(*) as total FROM mascotas "
        "WHERE tenant_id=:tid AND activo=true GROUP BY especie ORDER BY total DESC"
    ), {"tid": tenant_id}).fetchall()
    total = db.execute(text(
        "SELECT COUNT(*) as t FROM mascotas WHERE tenant_id=:tid AND activo=true"
    ), {"tid": tenant_id}).fetchone()
    alertas = db.execute(text(
        "SELECT COUNT(*) as t FROM mascotas WHERE tenant_id=:tid AND activo=true "
        "AND (fecha_proxima_vacuna <= CURRENT_DATE + INTERVAL '30 days' OR vacunas_vigentes=false)"
    ), {"tid": tenant_id}).fetchone()
    return {
        "total": int(total._mapping["t"]),
        "alertas_vacunas": int(alertas._mapping["t"]),
        "por_especie": {dict(r._mapping)["especie"]: int(dict(r._mapping)["total"]) for r in rows},
    }


@router.post("", status_code=201)
def crear_mascota(body: MascotaCreate, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_id = current_user["tenant_id"]
    _ensure_table(db)
    if body.especie not in ESPECIES:
        raise HTTPException(400, "Especie invalida. Validas: " + ", ".join(ESPECIES))
    row = db.execute(text(
        "INSERT INTO mascotas (tenant_id,persona_id,depto_numero,nombre,especie,raza,color,"
        "edad_anios,peso_kg,chip_numero,foto_url,vacunas_vigentes,fecha_ultima_vacuna,"
        "fecha_proxima_vacuna,observaciones) "
        "VALUES (:tid,:pid,:dep,:nom,:esp,:raza,:col,:edad,:peso,:chip,:foto,:vac,:fult,:fprox,:obs) "
        "RETURNING id"
    ), {
        "tid": tenant_id, "pid": body.persona_id, "dep": body.depto_numero,
        "nom": body.nombre, "esp": body.especie, "raza": body.raza, "col": body.color,
        "edad": body.edad_anios, "peso": body.peso_kg, "chip": body.chip_numero,
        "foto": body.foto_url, "vac": body.vacunas_vigentes,
        "fult": body.fecha_ultima_vacuna, "fprox": body.fecha_proxima_vacuna,
        "obs": body.observaciones,
    }).fetchone()
    db.commit()
    return {"id": row._mapping["id"]}


@router.put("/{mascota_id}")
def actualizar_mascota(mascota_id: int, body: MascotaUpdate, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    fields = {k: v for k, v in body.model_dump().items() if v is not None}
    if not fields:
        raise HTTPException(400, "Sin campos para actualizar")
    set_clause = ", ".join(f"{k}=:{k}" for k in fields)
    fields["id"] = mascota_id
    db.execute(text(f"UPDATE mascotas SET {set_clause} WHERE id=:id"), fields)
    db.commit()
    return {"ok": True}


@router.delete("/{mascota_id}")
def eliminar_mascota(mascota_id: int, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    db.execute(text("UPDATE mascotas SET activo=false WHERE id=:id"), {"id": mascota_id})
    db.commit()
    return {"ok": True}
