"""
Wizard de onboarding: crea un condominio completo (tenant + condominio + torre +
pisos + departamentos + admin + personal + residentes) en una sola transaccion.
Cada tenant nuevo recibe su propia URL <subdominio>.conectaai.cl (wildcard DNS + cert).
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel, Field
from typing import Optional, List
import re, json, secrets, string, bcrypt, unicodedata

from app.core.database import get_db
from app.routers.features import TIPO_PRESETS
from app.routers.superadmin import _get_sa, _send_welcome_email, _ensure_metadata_col

router = APIRouter(prefix="/api/superadmin/wizard", tags=["SuperAdmin Wizard"])

BASE_DOMAIN = "conectaai.cl"
RESERVED_SLUGS = {
    "www", "api", "app", "admin", "superadmin", "condo", "gym", "mail", "n8n", "social",
    "control", "tap", "terry", "ventas", "torre", "suite", "ia", "seo", "qr", "rfid",
    "vault", "volta", "working", "osw", "docvoice", "evolution", "clientes", "sistemas",
    "ama", "amav2", "milycake",
}

CARGO_TO_ROL = {
    "administrador": "admin",
    "conserje": "conserje",
    "guardia": "conserje",
    "mantenimiento": "conserje",
    "limpieza": "conserje",
    "jardinero": "conserje",
}


def _slugify(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")
    return re.sub(r"-{2,}", "-", s)[:40]


def _gen_password(length: int = 10) -> str:
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"  # sin O/0, l/I/1
    core = "".join(secrets.choice(alphabet) for _ in range(length - 2))
    return core[:4] + secrets.choice("!#$%") + core[4:] + secrets.choice("23456789")


def _hash(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt(rounds=12)).decode()


def _numero_depto(piso: int, idx: int, por_piso: int, modo: str) -> str:
    if modo == "consecutiva":
        return str((piso - 1) * por_piso + idx)
    if modo == "letras":
        return f"{piso}{chr(64 + idx)}"
    return f"{piso}{idx:02d}"


# ---------- modelos ----------

class EdificioIn(BaseModel):
    nombre: str = Field(..., min_length=3)
    direccion: Optional[str] = None
    ciudad: Optional[str] = None
    tipo: str = "condominio"
    anio: Optional[int] = None
    email_contacto: Optional[str] = None
    telefono: Optional[str] = None
    plan: str = "profesional"


class AdminIn(BaseModel):
    nombre: str = Field(..., min_length=3)
    email: str
    rut: Optional[str] = None
    telefono: Optional[str] = None
    password: Optional[str] = None


class PersonalIn(BaseModel):
    nombre: str = Field(..., min_length=2)
    cargo: str = "conserje"
    email: Optional[str] = None
    rut: Optional[str] = None
    turno: Optional[str] = None
    password: Optional[str] = None


class EstructuraIn(BaseModel):
    tipo_unidad: str = "departamentos"   # departamentos | casas
    pisos: int = Field(1, ge=1, le=99)
    deptos_por_piso: int = Field(1, ge=1, le=30)
    numeracion: str = "piso"             # piso | consecutiva | letras
    subterraneos: int = Field(0, ge=0, le=10)
    nombre_torre: str = "A"
    # solo casas
    cantidad_casas: int = Field(1, ge=1, le=2000)
    casa_desde: int = Field(1, ge=0, le=100000)
    casa_prefijo: str = "Casa "


class ResidenteIn(BaseModel):
    rut: str
    nombre: str
    depto: str                    # numero de departamento (ej "101")
    email: Optional[str] = None
    telefono: Optional[str] = None


class WizardIn(BaseModel):
    edificio: EdificioIn
    admin: AdminIn
    personal: List[PersonalIn] = []
    estructura: EstructuraIn = EstructuraIn()
    residentes: List[ResidenteIn] = []
    enviar_emails: bool = True


# ---------- endpoints ----------

@router.get("/check-slug")
def check_slug(nombre: str, db: Session = Depends(get_db), _sa: dict = Depends(_get_sa)):
    slug = _slugify(nombre)
    if not slug or slug in RESERVED_SLUGS:
        return {"slug": slug, "disponible": False, "url": None}
    taken = db.execute(text("SELECT 1 FROM tenants WHERE subdominio=:s"), {"s": slug}).fetchone()
    return {"slug": slug, "disponible": taken is None, "url": f"https://{slug}.{BASE_DOMAIN}"}


@router.post("/crear")
async def crear_condominio(body: WizardIn, db: Session = Depends(get_db), _sa: dict = Depends(_get_sa)):
    _ensure_metadata_col(db)
    ed, ad, est = body.edificio, body.admin, body.estructura

    tipo = (ed.tipo or "condominio").strip().lower()
    if tipo not in TIPO_PRESETS:
        raise HTTPException(400, f"Tipo invalido. Opciones: {list(TIPO_PRESETS.keys())}")

    slug = _slugify(ed.nombre)
    if not slug or slug in RESERVED_SLUGS:
        raise HTTPException(400, "El nombre del edificio no sirve para crear su direccion web. Prueba con otro nombre.")
    if db.execute(text("SELECT 1 FROM tenants WHERE subdominio=:s"), {"s": slug}).fetchone():
        raise HTTPException(400, f"Ya existe un condominio con la direccion {slug}.{BASE_DOMAIN}. Cambia el nombre.")
    dominio = f"{slug}.{BASE_DOMAIN}"

    admin_email = ad.email.lower().strip()
    if "@" not in admin_email:
        raise HTTPException(400, "El correo del administrador no es valido")
    if db.execute(text("SELECT 1 FROM usuarios WHERE email=:e"), {"e": admin_email}).fetchone():
        raise HTTPException(400, f"El correo {admin_email} ya esta registrado en otro condominio")

    # emails del personal: si no traen, se generan <slug-nombre>@<dominio>
    personal_rows = []
    seen_emails = {admin_email}
    for i, p in enumerate(body.personal):
        cargo = (p.cargo or "conserje").strip().lower()
        rol = CARGO_TO_ROL.get(cargo, "conserje")
        email = (p.email or "").lower().strip()
        if not email:
            base = _slugify(p.nombre) or f"trabajador{i+1}"
            email = f"{base}@{dominio}"
        if email in seen_emails or db.execute(text("SELECT 1 FROM usuarios WHERE email=:e"), {"e": email}).fetchone():
            raise HTTPException(400, f"El correo {email} ya esta en uso")
        seen_emails.add(email)
        personal_rows.append({
            "nombre": p.nombre.strip(), "cargo": cargo, "rol": rol, "email": email,
            "rut": p.rut, "turno": p.turno, "password": p.password or _gen_password(),
        })

    admin_password = ad.password or _gen_password()
    metadata = {k: v for k, v in {
        "rut": ad.rut, "direccion": ed.direccion, "ciudad": ed.ciudad, "anio": ed.anio,
        "tipo_unidad": est.tipo_unidad, "creado_por_wizard": True,
    }.items() if v}

    try:
        tid = db.execute(text("""
            INSERT INTO tenants (nombre, subdominio, tipo, dominio, email_contacto, telefono, plan, estado,
                                 limite_condominios, limite_departamentos, metadata, fecha_inicio, created_at, updated_at)
            VALUES (:n, :s, :tipo, :dom, :e, :t, :p, 'activo', 1, :ld, CAST(:meta AS jsonb), NOW(), NOW(), NOW())
            RETURNING id
        """), {
            "n": ed.nombre.strip(), "s": slug, "tipo": tipo, "dom": dominio,
            "e": ed.email_contacto or admin_email, "t": ed.telefono or ad.telefono or "",
            "p": ed.plan, "ld": max(50, est.pisos * est.deptos_por_piso),
            "meta": json.dumps(metadata),
        }).scalar()

        for key in TIPO_PRESETS.get(tipo, []):
            db.execute(text(
                "INSERT INTO tenant_features (tenant_id, feature_key, activo) VALUES (:tid, :fk, true) "
                "ON CONFLICT (tenant_id, feature_key) DO UPDATE SET activo=true"
            ), {"tid": tid, "fk": key})

        cid = db.execute(text("""
            INSERT INTO condominios (tenant_id, nombre, direccion, tipo, radio_geoacceso_metros, created_at, updated_at)
            VALUES (:tid, :n, :dir, 'edificio', 100, NOW(), NOW()) RETURNING id
        """), {"tid": tid, "n": ed.nombre.strip(), "dir": ed.direccion or "Por definir"}).scalar()

        # --- estructura fisica ---
        es_gym = tipo == "gimnasio"
        es_casas = est.tipo_unidad == "casas"
        torre_id = db.execute(text("""
            INSERT INTO torres (tenant_id, condominio_id, nombre, numero_pisos, created_at)
            VALUES (:tid, :cid, :n, :np, NOW()) RETURNING id
        """), {"tid": tid, "cid": cid, "n": "Casas" if es_casas else est.nombre_torre,
               "np": 1 if es_casas else est.pisos + est.subterraneos}).scalar()

        depto_ids, depto_meta = {}, {}
        if es_casas and not es_gym:
            # Un condominio de casas: una sola "torre" con un solo nivel, N casas numeradas
            pid = db.execute(text(
                "INSERT INTO pisos (tenant_id, torre_id, numero, created_at) VALUES (:tid, :t, 1, NOW()) RETURNING id"
            ), {"tid": tid, "t": torre_id}).scalar()
            for i in range(est.cantidad_casas):
                num = f"{est.casa_prefijo}{est.casa_desde + i}".strip()
                did = db.execute(text("""
                    INSERT INTO departamentos (tenant_id, piso_id, numero, estado, created_at, updated_at)
                    VALUES (:tid, :p, :n, 'disponible', NOW(), NOW()) RETURNING id
                """), {"tid": tid, "p": pid, "n": num}).scalar()
                depto_ids[num] = did
                depto_ids[str(est.casa_desde + i)] = did   # permite cargar residentes por "12" o "Casa 12"
                depto_meta[did] = {"torre": "Casas", "piso": "1", "departamento": num}
        elif not es_gym:
            for piso in range(1, est.pisos + 1):
                pid = db.execute(text(
                    "INSERT INTO pisos (tenant_id, torre_id, numero, created_at) VALUES (:tid, :t, :n, NOW()) RETURNING id"
                ), {"tid": tid, "t": torre_id, "n": piso}).scalar()
                for idx in range(1, est.deptos_por_piso + 1):
                    num = _numero_depto(piso, idx, est.deptos_por_piso, est.numeracion)
                    did = db.execute(text("""
                        INSERT INTO departamentos (tenant_id, piso_id, numero, estado, created_at, updated_at)
                        VALUES (:tid, :p, :n, 'disponible', NOW(), NOW()) RETURNING id
                    """), {"tid": tid, "p": pid, "n": num}).scalar()
                    depto_ids[num] = did
                    depto_meta[did] = {"torre": est.nombre_torre, "piso": str(piso), "departamento": num}
            for s in range(1, est.subterraneos + 1):
                db.execute(text(
                    "INSERT INTO pisos (tenant_id, torre_id, numero, created_at) VALUES (:tid, :t, :n, NOW())"
                ), {"tid": tid, "t": torre_id, "n": -s})

        # --- admin ---
        admin_id = db.execute(text("""
            INSERT INTO usuarios (email, password_hash, nombre_completo, rol, activo, tenant_id, extra, created_at, updated_at)
            VALUES (:e, :pw, :n, 'admin', true, :tid, CAST(:extra AS jsonb), NOW(), NOW()) RETURNING id
        """), {
            "e": admin_email, "pw": _hash(admin_password), "n": ad.nombre.strip(), "tid": tid,
            "extra": json.dumps({k: v for k, v in {"rut": ad.rut, "telefono": ad.telefono, "cargo": "administrador"}.items() if v}),
        }).scalar()

        # --- personal ---
        for p in personal_rows:
            p["id"] = db.execute(text("""
                INSERT INTO usuarios (email, password_hash, nombre_completo, rol, activo, tenant_id, extra, created_at, updated_at)
                VALUES (:e, :pw, :n, :rol, true, :tid, CAST(:extra AS jsonb), NOW(), NOW()) RETURNING id
            """), {
                "e": p["email"], "pw": _hash(p["password"]), "n": p["nombre"], "rol": p["rol"], "tid": tid,
                "extra": json.dumps({k: v for k, v in {"cargo": p["cargo"], "rut": p["rut"], "turno": p["turno"]}.items() if v}),
            }).scalar()

        # --- residentes pre-cargados ---
        residentes_out, residentes_err = [], []
        seen_ruts = set()
        for r in body.residentes:
            rut = re.sub(r"[^0-9kK-]", "", r.rut.strip()).upper()
            if not rut or rut in seen_ruts:
                residentes_err.append({"rut": r.rut, "motivo": "RUT vacio o repetido"})
                continue
            did = depto_ids.get(r.depto.strip().upper()) or depto_ids.get(r.depto.strip())
            if not did and not es_gym:
                residentes_err.append({"rut": r.rut, "motivo": f"Departamento {r.depto} no existe en la estructura"})
                continue
            seen_ruts.add(rut)
            pw = _gen_password(8)
            db.execute(text("""
                INSERT INTO residentes_portal (tenant_id, rut, nombre_completo, email, telefono, password_hash,
                                               departamento_id, condominio_id, activo, failed_attempts, creado_en)
                VALUES (:tid, :rut, :n, :e, :t, :pw, :did, :cid, true, 0, NOW())
            """), {"tid": tid, "rut": rut, "n": r.nombre.strip(), "e": r.email, "t": r.telefono,
                   "pw": _hash(pw), "did": did, "cid": cid})
            # Ficha en Personas (lo que ve el administrador) + vinculo al departamento
            persona_id = db.execute(text("""
                INSERT INTO personas (tenant_id, nombre_completo, rut, telefono, email, roles, estado, datos_contacto, created_at, updated_at)
                VALUES (:tid, :n, :rut, :t, :e, CAST(:roles AS jsonb), 'activo', CAST(:dc AS jsonb), NOW(), NOW())
                ON CONFLICT DO NOTHING RETURNING id
            """), {"tid": tid, "n": r.nombre.strip(), "rut": rut, "t": r.telefono or "", "e": r.email or "",
                   "roles": json.dumps(["residente"]),
                   "dc": json.dumps({"condominio_id": str(cid), **(depto_meta.get(did) or {"departamento": r.depto.strip()})})}).scalar()
            if did:
                db.execute(text("UPDATE departamentos SET estado='ocupado', residente_id=COALESCE(:pid, residente_id) WHERE id=:d"),
                           {"d": did, "pid": persona_id})
            residentes_out.append({"rut": rut, "nombre": r.nombre.strip(), "depto": r.depto, "password": pw})

        db.commit()
    except HTTPException:
        db.rollback(); raise
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"No se pudo crear el condominio: {e}")

    base = f"https://{dominio}"
    urls = {
        "sitio": base,
        "admin": f"{base}/login",
        "conserje": f"{base}/conserje/login",
        "portal": f"{base}/portal",
        "registro": f"{base}/portal/registro",
    }

    if body.enviar_emails:
        await _send_welcome_email(admin_email, ad.nombre, ed.nombre, admin_password, "admin", urls["admin"])
        for p in personal_rows:
            if not p["email"].endswith("@" + dominio):
                await _send_welcome_email(p["email"], p["nombre"], ed.nombre, p["password"], "conserje", urls["conserje"])

    return {
        "success": True,
        "tenant_id": tid,
        "condominio_id": cid,
        "slug": slug,
        "dominio": dominio,
        "urls": urls,
        "admin": {"id": admin_id, "nombre": ad.nombre, "email": admin_email, "password": admin_password},
        "personal": [{"id": p["id"], "nombre": p["nombre"], "cargo": p["cargo"], "email": p["email"], "password": p["password"]} for p in personal_rows],
        "residentes": residentes_out,
        "residentes_error": residentes_err,
        "resumen": {
            "tipo_unidad": est.tipo_unidad,
            "departamentos": (est.cantidad_casas if es_casas else est.pisos * est.deptos_por_piso) if not es_gym else 0,
            "pisos": (1 if es_casas else est.pisos) if not es_gym else 0,
            "personal": len(personal_rows),
            "residentes": len(residentes_out),
        },
    }
