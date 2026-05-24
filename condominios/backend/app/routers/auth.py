from fastapi import APIRouter, Depends, HTTPException, Form, Response, Request
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.database import get_db
import bcrypt
import jwt
import secrets
import httpx
from datetime import datetime, timedelta
import os as _os

router = APIRouter(prefix="/api/auth", tags=["auth"])

SECRET_KEY = _os.getenv("SECRET_KEY", "")
if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY env var no configurada")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 7
MAIL_API_URL = _os.getenv("MAIL_API_URL", "http://localhost:3004/api/send")
MAIL_API_KEY = _os.getenv("MAIL_API_KEY", "sk_live_6pplo4eac1j6m26z2j9np")
APP_URL = _os.getenv("APP_URL", "https://conectaai.cl")
MAX_FAILED = 5
LOCKOUT_MIN = 15
RESET_EXPIRE_H = 1


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode(), hashed.encode())
    except Exception:
        return False


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def create_token(data: dict, days: int = ACCESS_TOKEN_EXPIRE_DAYS) -> str:
    payload = {**data, "exp": datetime.utcnow() + timedelta(days=days)}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


async def send_mail(to: str, subject: str, html: str, text: str = ""):
    try:
        async with httpx.AsyncClient(timeout=10.0) as c:
            await c.post(
                MAIL_API_URL,
                headers={"Authorization": f"Bearer {MAIL_API_KEY}", "Content-Type": "application/json"},
                json={"to": to, "subject": subject, "html": html, "text": text},
            )
    except Exception:
        pass


@router.post("/login")
async def login(
    response: Response,
    email: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db),
):
    email = email.strip().lower()
    row = db.execute(
        text("""SELECT id, email, password_hash, nombre_completo, rol, activo, tenant_id,
                       COALESCE(failed_attempts,0), locked_until
                FROM usuarios WHERE email = :e"""),
        {"e": email},
    ).fetchone()

    if not row:
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")

    uid, uemail, pw_hash, nombre, rol, activo, tid, attempts, locked_until = row

    if locked_until and datetime.utcnow() < locked_until:
        mins = int((locked_until - datetime.utcnow()).total_seconds() / 60) + 1
        raise HTTPException(status_code=429, detail=f"Cuenta bloqueada. Intenta en {mins} minuto(s).")

    if not activo:
        raise HTTPException(status_code=403, detail="Cuenta desactivada. Contacta al administrador.")

    if not verify_password(password, pw_hash):
        new_att = attempts + 1
        if new_att >= MAX_FAILED:
            lock = datetime.utcnow() + timedelta(minutes=LOCKOUT_MIN)
            db.execute(text("UPDATE usuarios SET failed_attempts=:a, locked_until=:l WHERE id=:id"),
                       {"a": new_att, "l": lock, "id": uid})
        else:
            db.execute(text("UPDATE usuarios SET failed_attempts=:a WHERE id=:id"),
                       {"a": new_att, "id": uid})
        db.commit()
        remaining = max(0, MAX_FAILED - new_att)
        if new_att >= MAX_FAILED:
            raise HTTPException(status_code=429, detail=f"Demasiados intentos. Cuenta bloqueada por {LOCKOUT_MIN} minutos.")
        raise HTTPException(status_code=401, detail=f"Credenciales incorrectas. {remaining} intento(s) restante(s).")

    db.execute(text("UPDATE usuarios SET failed_attempts=0, locked_until=NULL, last_login=NOW() WHERE id=:id"), {"id": uid})
    db.commit()

    token = create_token({"sub": str(uid), "email": uemail, "rol": rol, "tenant_id": tid})
    response.set_cookie("session", token, httponly=True, secure=True, samesite="lax",
                        max_age=60*60*24*ACCESS_TOKEN_EXPIRE_DAYS, path="/")
    return {"success": True, "user": {"id": uid, "email": uemail, "nombre_completo": nombre, "rol": rol, "tenant_id": tid}, "token": token}


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("session", path="/")
    return {"success": True}


@router.get("/me")
async def get_me(request: Request, db: Session = Depends(get_db)):
    token = request.cookies.get("session")
    if not token:
        auth = request.headers.get("authorization", "")
        token = auth[7:] if auth.startswith("Bearer ") else None
    if not token:
        for part in request.headers.get("cookie", "").split(";"):
            p = part.strip()
            if p.startswith("session="):
                token = p[8:]; break
    if not token:
        raise HTTPException(status_code=401, detail="No autenticado")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        uid = int(payload["sub"])
    except Exception:
        raise HTTPException(status_code=401, detail="Sesion invalida o expirada")

    row = db.execute(text("""
        SELECT u.id, u.email, u.nombre_completo, u.rol, u.activo, u.tenant_id, u.last_login,
               t.nombre, t.plan, t.logo_url, t.color_primario, t.color_secundario, t.telefono
        FROM usuarios u JOIN tenants t ON t.id=u.tenant_id
        WHERE u.id=:uid AND u.activo=true
    """), {"uid": uid}).fetchone()

    if not row:
        raise HTTPException(status_code=401, detail="Usuario no encontrado")

    return {
        "id": row[0], "email": row[1], "nombre_completo": row[2], "rol": row[3],
        "activo": row[4], "tenant_id": row[5],
        "last_login": str(row[6]) if row[6] else None,
        "tenant": {"nombre": row[7], "plan": row[8], "logo_url": row[9],
                   "color_primario": row[10], "color_secundario": row[11],
                   "telefono": row[12], "modulos_activos": []},
    }


@router.post("/forgot-password")
async def forgot_password(email: str = Form(...), db: Session = Depends(get_db)):
    email = email.strip().lower()
    row = db.execute(text("SELECT id, nombre_completo, activo FROM usuarios WHERE email=:e"), {"e": email}).fetchone()
    if not row or not row[2]:
        return {"success": True, "message": "Si el email existe, recibiras instrucciones en breve."}

    uid, nombre = row[0], row[1]
    token = secrets.token_urlsafe(32)
    expires = datetime.utcnow() + timedelta(hours=RESET_EXPIRE_H)
    db.execute(text("UPDATE usuarios SET reset_token=:t, reset_token_expires=:e WHERE id=:id"),
               {"t": token, "e": expires, "id": uid})
    db.commit()

    url = f"{APP_URL}/reset-password?token={token}"
    html = (
        "<div style='font-family:Arial,sans-serif;max-width:500px;margin:0 auto;"
        "padding:32px;background:#f8f9fa;border-radius:12px;'>"
        "<h2 style='color:#1e293b;'>Recuperacion de contrasena</h2>"
        "<p style='color:#475569;'>Hola <strong>" + nombre + "</strong>,</p>"
        "<p style='color:#475569;'>Haz clic en el boton para restablecer tu contrasena:</p>"
        "<a href='" + url + "' style='display:inline-block;margin:24px 0;padding:14px 28px;"
        "background:#4f46e5;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold;'>"
        "Restablecer contrasena"
        "</a>"
        "<p style='color:#94a3b8;font-size:13px;'>Este enlace expira en " + str(RESET_EXPIRE_H) +
        " hora(s). Si no solicitaste esto, ignora este mensaje.</p>"
        "<hr style='border:none;border-top:1px solid #e2e8f0;margin:20px 0;'>"
        "<p style='color:#cbd5e1;font-size:12px;'>ConectaAI - Sistema de Gestion de Condominios</p>"
        "</div>"
    )
    await send_mail(email, "Recuperacion de contrasena ConectaAI", html,
                    f"Visita: {url} (expira en {RESET_EXPIRE_H}h)")
    return {"success": True, "message": "Si el email existe, recibiras instrucciones en breve."}


@router.post("/reset-password")
async def reset_password(
    token: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db),
):
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="La contrasena debe tener al menos 8 caracteres.")
    row = db.execute(text("SELECT id, reset_token_expires FROM usuarios WHERE reset_token=:t"), {"t": token}).fetchone()
    if not row:
        raise HTTPException(status_code=400, detail="Token invalido o ya utilizado.")
    uid, expires = row
    if not expires or datetime.utcnow() > expires:
        raise HTTPException(status_code=400, detail="El enlace ha expirado. Solicita uno nuevo.")
    db.execute(text("""UPDATE usuarios SET password_hash=:h, reset_token=NULL,
                       reset_token_expires=NULL, failed_attempts=0, locked_until=NULL WHERE id=:id"""),
               {"h": hash_password(password), "id": uid})
    db.commit()
    return {"success": True, "message": "Contrasena actualizada. Ya puedes iniciar sesion."}


# Dependency for other routers (admin.py etc.)
def get_current_user(request: Request, db: Session = Depends(get_db)) -> dict:
    token = request.cookies.get("session")
    if not token:
        auth = request.headers.get("authorization", "")
        token = auth[7:] if auth.startswith("Bearer ") else None
    if not token:
        raise HTTPException(status_code=401, detail="No autenticado")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        uid = int(payload["sub"])
    except Exception:
        raise HTTPException(status_code=401, detail="Sesion invalida o expirada")
    row = db.execute(
        text("SELECT id, email, nombre_completo, rol, activo, tenant_id FROM usuarios WHERE id=:uid AND activo=true"),
        {"uid": uid},
    ).fetchone()
    if not row:
        raise HTTPException(status_code=401, detail="Usuario no encontrado")
    return {
        "id": row[0], "email": row[1], "nombre_completo": row[2],
        "role": row[3], "rol": row[3], "activo": row[4], "tenant_id": row[5],
    }
