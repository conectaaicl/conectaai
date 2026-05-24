from fastapi import APIRouter, Depends, HTTPException, Form, Response, Request
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.database import get_db
import bcrypt, jwt, os, re, httpx, secrets, string, json
from datetime import datetime, timedelta
from typing import Optional, List
from pydantic import BaseModel

router = APIRouter(prefix="/api/superadmin", tags=["SuperAdmin"])

SECRET_KEY = os.getenv("SECRET_KEY", "")
ALGORITHM = "HS256"
SA_COOKIE = "sa_session"
SA_EXPIRE_H = 8
SA_MAX_FAILED = 3
SA_LOCKOUT_MIN = 30
MAIL_API_URL = os.getenv("MAIL_API_URL", "http://localhost:3004/api/send")
MAIL_API_KEY = os.getenv("MAIL_API_KEY", "")
APP_URL = os.getenv("APP_URL", "https://conectaai.cl")


# helpers

def _hash(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt(rounds=12)).decode()

def _verify(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False

def _make_token(uid: int, email: str) -> str:
    payload = {
        "sub": str(uid), "email": email, "role": "superadmin",
        "exp": datetime.utcnow() + timedelta(hours=SA_EXPIRE_H)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def _get_sa(request: Request, db: Session = Depends(get_db)) -> dict:
    token = request.cookies.get(SA_COOKIE)
    if not token:
        raise HTTPException(status_code=401, detail="No autorizado")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("role") != "superadmin":
            raise HTTPException(status_code=403, detail="Acceso denegado")
        uid = int(payload["sub"])
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Sesion invalida")
    row = db.execute(
        text("SELECT id, email, nombre_completo FROM usuarios WHERE id=:uid AND activo=true AND rol='superadmin'"),
        {"uid": uid}
    ).fetchone()
    if not row:
        raise HTTPException(status_code=401, detail="Cuenta no encontrada")
    return {"id": row[0], "email": row[1], "nombre": row[2]}

def _gen_password(length: int = 12) -> str:
    alphabet = string.ascii_letters + string.digits + "!@#$"
    return "".join(secrets.choice(alphabet) for _ in range(length))

async def _send_welcome_email(
    user_email: str, user_nombre: str, tenant_nombre: str,
    password: str, rol: str = "administrador"
):
    role_label = "Administrador" if rol in ("admin", "administrador") else "Conserje"
    html = (
        "<div style='font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#f8f9fa;padding:32px 20px'>"
        "<div style='background:#5b3ef5;border-radius:12px 12px 0 0;padding:28px 32px;text-align:center'>"
        "<h1 style='color:#fff;margin:0;font-size:24px'>ConectaAI</h1>"
        "<p style='color:rgba(255,255,255,0.8);margin:6px 0 0;font-size:13px'>Sistema de Gestion de Condominios</p>"
        "</div>"
        "<div style='background:#fff;border-radius:0 0 12px 12px;padding:32px;border:1px solid #e5e7eb;border-top:none'>"
        "<h2 style='color:#111827;font-size:20px;margin:0 0 8px'>Bienvenido a ConectaAI!</h2>"
        "<p style='color:#6b7280;font-size:14px;margin:0 0 24px'>Hola <strong>" + user_nombre + "</strong>, "
        "tu cuenta de <strong>" + role_label + "</strong> para <strong>" + tenant_nombre + "</strong> ha sido creada.</p>"
        "<div style='background:#f3f4f6;border-radius:10px;padding:20px;margin:0 0 24px'>"
        "<p style='color:#374151;font-size:12px;font-weight:700;margin:0 0 12px;text-transform:uppercase;letter-spacing:1px'>Credenciales de acceso</p>"
        "<p style='margin:0 0 6px;font-size:14px;color:#374151'><b>Email:</b> " + user_email + "</p>"
        "<p style='margin:0;font-size:14px;color:#374151'><b>Contrasena:</b> " + password + "</p>"
        "</div>"
        "<div style='text-align:center;margin:0 0 24px'><a href='" + APP_URL + "/login' "
        "style='display:inline-block;background:#5b3ef5;color:#fff;padding:13px 28px;border-radius:10px;"
        "text-decoration:none;font-size:14px;font-weight:600'>Acceder al panel</a></div>"
        "<p style='color:#9ca3af;font-size:12px;margin:0;text-align:center'>Por seguridad, cambia tu contrasena en el primer ingreso.</p>"
        "</div></div>"
    )
    try:
        async with httpx.AsyncClient(timeout=10.0) as c:
            await c.post(
                MAIL_API_URL,
                headers={"Authorization": "Bearer " + MAIL_API_KEY, "Content-Type": "application/json"},
                json={
                    "to": user_email,
                    "subject": "Bienvenido a ConectaAI - " + tenant_nombre,
                    "html": html,
                    "text": "Bienvenido " + user_nombre + ". Email: " + user_email + " / Contrasena: " + password + ". Accede en: " + APP_URL + "/login"
                }
            )
    except Exception:
        pass

def _ensure_metadata_col(db: Session):
    try:
        db.execute(text("ALTER TABLE tenants ADD COLUMN IF NOT EXISTS metadata JSONB"))
        db.commit()
    except Exception:
        db.rollback()


# Pydantic models

class ConserjeIn(BaseModel):
    nombre: str
    email: str
    password: str
    turno: Optional[str] = None

class OnboardingRequest(BaseModel):
    nombre: str
    subdominio: str
    rut: Optional[str] = None
    direccion: Optional[str] = None
    ciudad: Optional[str] = None
    email_contacto: str
    telefono: Optional[str] = None
    plan: str = "basico"
    limite_condominios: int = 1
    limite_departamentos: int = 50
    fecha_vencimiento: Optional[str] = None
    admin_nombre: str
    admin_email: str
    admin_password: str
    conserjes: List[ConserjeIn] = []

class TenantPatch(BaseModel):
    nombre: Optional[str] = None
    email_contacto: Optional[str] = None
    telefono: Optional[str] = None
    plan: Optional[str] = None
    estado: Optional[str] = None
    limite_condominios: Optional[int] = None
    limite_departamentos: Optional[int] = None
    fecha_vencimiento: Optional[str] = None
    rut: Optional[str] = None
    direccion: Optional[str] = None
    ciudad: Optional[str] = None

class ResetPasswordRequest(BaseModel):
    new_password: Optional[str] = None


# Auth endpoints

@router.post("/login")
async def sa_login(
    response: Response, request: Request,
    email: str = Form(...), password: str = Form(...),
    db: Session = Depends(get_db)
):
    row = db.execute(
        text("""SELECT id, email, password_hash, nombre_completo, activo, rol,
                       COALESCE(failed_attempts,0), locked_until
                FROM usuarios WHERE email=:e"""),
        {"e": email.lower().strip()}
    ).fetchone()
    if not row:
        raise HTTPException(status_code=401, detail="Credenciales invalidas")
    uid, uemail, pw_hash, nombre, activo, rol, attempts, locked_until = row
    if rol != "superadmin":
        raise HTTPException(status_code=403, detail="Acceso denegado")
    if not activo:
        raise HTTPException(status_code=403, detail="Cuenta desactivada")
    if locked_until and locked_until > datetime.utcnow():
        mins = int((locked_until - datetime.utcnow()).total_seconds() / 60) + 1
        raise HTTPException(status_code=429, detail="Cuenta bloqueada. Intente en " + str(mins) + " minutos.")
    if not _verify(password, pw_hash):
        new_attempts = attempts + 1
        lock_until = None
        if new_attempts >= SA_MAX_FAILED:
            lock_until = datetime.utcnow() + timedelta(minutes=SA_LOCKOUT_MIN)
        db.execute(
            text("UPDATE usuarios SET failed_attempts=:a, locked_until=:l WHERE id=:uid"),
            {"a": new_attempts, "l": lock_until, "uid": uid}
        )
        db.commit()
        remaining = max(0, SA_MAX_FAILED - new_attempts)
        if remaining == 0:
            raise HTTPException(status_code=429, detail="Cuenta bloqueada por " + str(SA_LOCKOUT_MIN) + " minutos.")
        raise HTTPException(status_code=401, detail="Credenciales invalidas. " + str(remaining) + " intentos restantes.")
    db.execute(
        text("UPDATE usuarios SET failed_attempts=0, locked_until=NULL, last_login=:now WHERE id=:uid"),
        {"now": datetime.utcnow(), "uid": uid}
    )
    db.commit()
    token = _make_token(uid, uemail)
    response.set_cookie(SA_COOKIE, token, httponly=True, secure=True, samesite="lax", max_age=SA_EXPIRE_H*3600)
    return {"success": True, "user": {"id": uid, "email": uemail, "nombre": nombre}}


@router.post("/logout")
async def sa_logout(response: Response):
    response.delete_cookie(SA_COOKIE)
    return {"ok": True}


@router.get("/me")
async def sa_me(current: dict = Depends(_get_sa)):
    return current


@router.get("/stats")
async def sa_stats(db: Session = Depends(get_db), _sa: dict = Depends(_get_sa)):
    tenants       = db.execute(text("SELECT COUNT(*) FROM tenants")).scalar() or 0
    activos       = db.execute(text("SELECT COUNT(*) FROM tenants WHERE estado='activo'")).scalar() or 0
    condos        = db.execute(text("SELECT COUNT(*) FROM condominios")).scalar() or 0
    deptos        = db.execute(text("SELECT COUNT(*) FROM departamentos")).scalar() or 0
    residentes    = db.execute(text("SELECT COUNT(*) FROM residente_portal WHERE activo=true")).scalar() or 0
    vencidos      = db.execute(
        text("SELECT COUNT(*) FROM tenants WHERE fecha_vencimiento IS NOT NULL AND fecha_vencimiento < NOW() AND estado='activo'")
    ).scalar() or 0
    total_usuarios = db.execute(
        text("SELECT COUNT(*) FROM usuarios WHERE rol IN ('admin','conserje','usuario')")
    ).scalar() or 0
    return {
        "total_tenants": tenants, "tenants_activos": activos, "tenants_vencidos": vencidos,
        "total_condominios": condos, "total_departamentos": deptos,
        "total_residentes": residentes, "total_usuarios": total_usuarios
    }


# Tenant list + detail

@router.get("/tenants")
async def list_tenants(db: Session = Depends(get_db), _sa: dict = Depends(_get_sa)):
    rows = db.execute(text("""
        SELECT t.id, t.nombre, t.subdominio, t.email_contacto, t.telefono, t.plan, t.estado,
               t.limite_condominios, t.limite_departamentos, t.fecha_vencimiento, t.created_at,
               COUNT(DISTINCT c.id) AS total_condominios,
               COUNT(DISTINCT u.id) AS total_usuarios
        FROM tenants t
        LEFT JOIN condominios c ON c.tenant_id = t.id
        LEFT JOIN usuarios u ON u.tenant_id = t.id AND u.rol IN ('admin','conserje','usuario')
        GROUP BY t.id ORDER BY t.created_at DESC
    """)).fetchall()
    return [dict(
        id=r[0], nombre=r[1], subdominio=r[2], email_contacto=r[3], telefono=r[4],
        plan=r[5], estado=r[6], limite_condominios=r[7], limite_departamentos=r[8],
        fecha_vencimiento=str(r[9]) if r[9] else None,
        created_at=str(r[10]) if r[10] else None,
        total_condominios=r[11], total_usuarios=r[12]
    ) for r in rows]


@router.get("/tenants/{tid}")
async def get_tenant(tid: int, db: Session = Depends(get_db), _sa: dict = Depends(_get_sa)):
    # ensure metadata col exists
    _ensure_metadata_col(db)
    row = db.execute(text("""
        SELECT t.id, t.nombre, t.subdominio, t.email_contacto, t.telefono, t.plan, t.estado,
               t.limite_condominios, t.limite_departamentos, t.fecha_vencimiento, t.created_at,
               t.metadata
        FROM tenants t WHERE t.id=:id
    """), {"id": tid}).fetchone()
    if not row:
        raise HTTPException(404, "Tenant no encontrado")
    total_condominios = db.execute(
        text("SELECT COUNT(*) FROM condominios WHERE tenant_id=:id"), {"id": tid}
    ).scalar() or 0
    total_departamentos = db.execute(
        text("SELECT COUNT(*) FROM departamentos WHERE tenant_id=:id"), {"id": tid}
    ).scalar() or 0
    users = db.execute(text("""
        SELECT id, email, nombre_completo, rol, activo, last_login, created_at, extra
        FROM usuarios WHERE tenant_id=:tid ORDER BY
          CASE rol WHEN 'admin' THEN 0 WHEN 'conserje' THEN 1 ELSE 2 END, created_at
    """), {"tid": tid}).fetchall()
    metadata = row[11] or {}
    return {
        "id": row[0], "nombre": row[1], "subdominio": row[2],
        "email_contacto": row[3], "telefono": row[4],
        "plan": row[5], "estado": row[6],
        "limite_condominios": row[7], "limite_departamentos": row[8],
        "fecha_vencimiento": str(row[9]) if row[9] else None,
        "created_at": str(row[10]) if row[10] else None,
        "rut": metadata.get("rut"), "direccion": metadata.get("direccion"),
        "ciudad": metadata.get("ciudad"),
        "total_condominios": total_condominios,
        "total_departamentos": total_departamentos,
        "usuarios": [
            {
                "id": u[0], "email": u[1], "nombre_completo": u[2],
                "rol": u[3], "activo": u[4],
                "last_login": str(u[5]) if u[5] else None,
                "created_at": str(u[6]) if u[6] else None,
                "turno": (u[7] or {}).get("turno") if u[7] else None
            } for u in users
        ]
    }


# Create (full onboarding)

@router.post("/tenants")
async def create_tenant(body: OnboardingRequest, db: Session = Depends(get_db), _sa: dict = Depends(_get_sa)):
    _ensure_metadata_col(db)

    slug = re.sub(r"[^a-z0-9-]", "", body.subdominio.lower().strip())
    if not slug:
        raise HTTPException(400, "Subdominio invalido")

    exists = db.execute(text("SELECT id FROM tenants WHERE subdominio=:s"), {"s": slug}).fetchone()
    if exists:
        raise HTTPException(400, "Subdominio ya existe")

    email_exists = db.execute(
        text("SELECT id FROM usuarios WHERE email=:e"), {"e": body.admin_email.lower().strip()}
    ).fetchone()
    if email_exists:
        raise HTTPException(400, "Email del admin ya esta registrado")

    for c in body.conserjes:
        ce = db.execute(text("SELECT id FROM usuarios WHERE email=:e"), {"e": c.email.lower().strip()}).fetchone()
        if ce:
            raise HTTPException(400, "Email ya registrado: " + c.email)

    fv = None
    if body.fecha_vencimiento:
        try:
            fv = datetime.strptime(body.fecha_vencimiento[:10], "%Y-%m-%d")
        except Exception:
            pass

    metadata = {}
    if body.rut:       metadata["rut"] = body.rut
    if body.direccion: metadata["direccion"] = body.direccion
    if body.ciudad:    metadata["ciudad"] = body.ciudad
    meta_json = json.dumps(metadata) if metadata else None

    row = db.execute(text("""
        INSERT INTO tenants (nombre, subdominio, email_contacto, telefono, plan, estado,
                             limite_condominios, limite_departamentos, fecha_vencimiento,
                             metadata, created_at, updated_at)
        VALUES (:n, :s, :e, :t, :p, 'activo', :lc, :ld, :fv,
                :meta::jsonb, NOW(), NOW())
        RETURNING id
    """), {
        "n": body.nombre, "s": slug, "e": body.email_contacto,
        "t": body.telefono or "", "p": body.plan,
        "lc": body.limite_condominios, "ld": body.limite_departamentos,
        "fv": fv, "meta": meta_json
    }).fetchone()
    tid = row[0]

    pw_hash = _hash(body.admin_password)
    admin_row = db.execute(text("""
        INSERT INTO usuarios (email, password_hash, nombre_completo, rol, activo, tenant_id, created_at, updated_at)
        VALUES (:e, :pw, :n, 'admin', true, :tid, NOW(), NOW())
        RETURNING id
    """), {"e": body.admin_email.lower().strip(), "pw": pw_hash, "n": body.admin_nombre, "tid": tid}).fetchone()
    admin_id = admin_row[0]

    conserje_results = []
    for c in body.conserjes:
        extra_val = json.dumps({"turno": c.turno}) if c.turno else None
        cr = db.execute(text("""
            INSERT INTO usuarios (email, password_hash, nombre_completo, rol, activo, tenant_id, extra, created_at, updated_at)
            VALUES (:e, :pw, :n, 'conserje', true, :tid, :extra::jsonb, NOW(), NOW())
            RETURNING id
        """), {
            "e": c.email.lower().strip(),
            "pw": _hash(c.password),
            "n": c.nombre, "tid": tid,
            "extra": extra_val
        }).fetchone()
        conserje_results.append({"id": cr[0], "nombre": c.nombre, "email": c.email.lower().strip(), "password": c.password})

    db.commit()

    await _send_welcome_email(body.admin_email.lower().strip(), body.admin_nombre, body.nombre, body.admin_password, "admin")
    for c in body.conserjes:
        await _send_welcome_email(c.email.lower().strip(), c.nombre, body.nombre, c.password, "conserje")

    return {
        "success": True,
        "tenant_id": tid,
        "subdominio": slug,
        "admin": {"id": admin_id, "nombre": body.admin_nombre, "email": body.admin_email.lower().strip(), "password": body.admin_password},
        "conserjes": conserje_results
    }


# Patch tenant

@router.patch("/tenants/{tid}")
async def patch_tenant(tid: int, body: TenantPatch, db: Session = Depends(get_db), _sa: dict = Depends(_get_sa)):
    _ensure_metadata_col(db)
    row = db.execute(text("SELECT id, metadata FROM tenants WHERE id=:id"), {"id": tid}).fetchone()
    if not row:
        raise HTTPException(404, "Tenant no encontrado")

    fields, params = [], {"tid": tid}
    if body.nombre is not None:
        fields.append("nombre=:nombre"); params["nombre"] = body.nombre
    if body.email_contacto is not None:
        fields.append("email_contacto=:email_contacto"); params["email_contacto"] = body.email_contacto
    if body.telefono is not None:
        fields.append("telefono=:telefono"); params["telefono"] = body.telefono
    if body.plan is not None:
        fields.append("plan=:plan"); params["plan"] = body.plan
    if body.estado is not None:
        fields.append("estado=:estado"); params["estado"] = body.estado
    if body.limite_condominios is not None:
        fields.append("limite_condominios=:lc"); params["lc"] = body.limite_condominios
    if body.limite_departamentos is not None:
        fields.append("limite_departamentos=:ld"); params["ld"] = body.limite_departamentos
    if body.fecha_vencimiento is not None:
        try:
            fv = datetime.strptime(body.fecha_vencimiento[:10], "%Y-%m-%d")
            fields.append("fecha_vencimiento=:fv"); params["fv"] = fv
        except Exception:
            pass

    meta = dict(row[1]) if row[1] else {}
    meta_changed = False
    if body.rut is not None:
        meta["rut"] = body.rut; meta_changed = True
    if body.direccion is not None:
        meta["direccion"] = body.direccion; meta_changed = True
    if body.ciudad is not None:
        meta["ciudad"] = body.ciudad; meta_changed = True
    if meta_changed:
        fields.append("metadata=:meta::jsonb"); params["meta"] = json.dumps(meta)

    if fields:
        db.execute(text("UPDATE tenants SET " + ", ".join(fields) + ", updated_at=NOW() WHERE id=:tid"), params)
        db.commit()
    return {"success": True}


# Legacy PUT

@router.put("/tenants/{tid}")
async def update_tenant_put(
    tid: int,
    nombre: Optional[str] = Form(None),
    plan: Optional[str] = Form(None),
    estado: Optional[str] = Form(None),
    limite_condominios: Optional[int] = Form(None),
    limite_departamentos: Optional[int] = Form(None),
    fecha_vencimiento: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    _sa: dict = Depends(_get_sa)
):
    row = db.execute(text("SELECT id FROM tenants WHERE id=:id"), {"id": tid}).fetchone()
    if not row:
        raise HTTPException(404, "Tenant no encontrado")
    fields, params = [], {"tid": tid}
    if nombre is not None:       fields.append("nombre=:nombre"); params["nombre"] = nombre
    if plan is not None:         fields.append("plan=:plan"); params["plan"] = plan
    if estado is not None:       fields.append("estado=:estado"); params["estado"] = estado
    if limite_condominios is not None:
        fields.append("limite_condominios=:lc"); params["lc"] = limite_condominios
    if limite_departamentos is not None:
        fields.append("limite_departamentos=:ld"); params["ld"] = limite_departamentos
    if fecha_vencimiento is not None:
        try:
            fv = datetime.strptime(fecha_vencimiento[:10], "%Y-%m-%d")
            fields.append("fecha_vencimiento=:fv"); params["fv"] = fv
        except Exception:
            pass
    if fields:
        db.execute(text("UPDATE tenants SET " + ", ".join(fields) + ", updated_at=NOW() WHERE id=:tid"), params)
        db.commit()
    return {"success": True}


# Soft delete

@router.delete("/tenants/{tid}")
async def deactivate_tenant(tid: int, db: Session = Depends(get_db), _sa: dict = Depends(_get_sa)):
    db.execute(text("UPDATE tenants SET estado='inactivo', updated_at=NOW() WHERE id=:id"), {"id": tid})
    db.execute(text("UPDATE usuarios SET activo=false WHERE tenant_id=:id"), {"id": tid})
    db.commit()
    return {"success": True}


# Tenant users

@router.get("/tenants/{tid}/usuarios")
async def tenant_usuarios(tid: int, db: Session = Depends(get_db), _sa: dict = Depends(_get_sa)):
    rows = db.execute(text("""
        SELECT id, email, nombre_completo, rol, activo, last_login, created_at, extra
        FROM usuarios WHERE tenant_id=:tid ORDER BY created_at DESC
    """), {"tid": tid}).fetchall()
    return [{"id": r[0], "email": r[1], "nombre_completo": r[2], "rol": r[3], "activo": r[4],
             "last_login": str(r[5]) if r[5] else None,
             "created_at": str(r[6]) if r[6] else None,
             "turno": (r[7] or {}).get("turno") if r[7] else None} for r in rows]


@router.patch("/tenants/{tid}/usuarios/{uid}/toggle")
async def toggle_user_activo(
    tid: int, uid: int,
    db: Session = Depends(get_db), _sa: dict = Depends(_get_sa)
):
    row = db.execute(
        text("SELECT id, activo FROM usuarios WHERE id=:uid AND tenant_id=:tid"), {"uid": uid, "tid": tid}
    ).fetchone()
    if not row:
        raise HTTPException(404, "Usuario no encontrado")
    new_val = not row[1]
    db.execute(text("UPDATE usuarios SET activo=:v WHERE id=:uid"), {"v": new_val, "uid": uid})
    db.commit()
    return {"success": True, "activo": new_val}


@router.post("/tenants/{tid}/usuarios")
async def create_tenant_user(
    tid: int,
    email: str = Form(...),
    password: str = Form(...),
    nombre: str = Form(...),
    rol: str = Form("admin"),
    db: Session = Depends(get_db),
    _sa: dict = Depends(_get_sa)
):
    exists = db.execute(text("SELECT id FROM usuarios WHERE email=:e"), {"e": email.lower().strip()}).fetchone()
    if exists:
        raise HTTPException(400, "Email ya registrado")
    pw_hash = _hash(password)
    db.execute(text("""
        INSERT INTO usuarios (email, password_hash, nombre_completo, rol, activo, tenant_id)
        VALUES (:e, :pw, :n, :r, true, :tid)
    """), {"e": email.lower().strip(), "pw": pw_hash, "n": nombre, "r": rol, "tid": tid})
    db.commit()
    return {"success": True}


# Reset password

@router.post("/tenants/{tid}/reset-password/{uid}")
async def reset_user_password(
    tid: int, uid: int,
    body: ResetPasswordRequest,
    db: Session = Depends(get_db), _sa: dict = Depends(_get_sa)
):
    row = db.execute(
        text("SELECT id, email, nombre_completo, rol FROM usuarios WHERE id=:uid AND tenant_id=:tid"),
        {"uid": uid, "tid": tid}
    ).fetchone()
    if not row:
        raise HTTPException(404, "Usuario no encontrado en este tenant")
    new_pw = body.new_password if body.new_password else _gen_password()
    pw_hash = _hash(new_pw)
    db.execute(
        text("UPDATE usuarios SET password_hash=:pw, failed_attempts=0, locked_until=NULL WHERE id=:uid"),
        {"pw": pw_hash, "uid": uid}
    )
    db.commit()
    tenant_row = db.execute(text("SELECT nombre FROM tenants WHERE id=:id"), {"id": tid}).fetchone()
    tenant_nombre = tenant_row[0] if tenant_row else "ConectaAI"
    await _send_welcome_email(row[1], row[2], tenant_nombre, new_pw, row[3])
    return {"success": True, "new_password": new_pw, "email": row[1], "nombre": row[2]}
