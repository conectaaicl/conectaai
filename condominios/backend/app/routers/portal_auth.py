from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models import ResidentePortal
from datetime import datetime, timedelta
import bcrypt, jwt, os

router = APIRouter(prefix="/api/portal/auth", tags=["portal_auth"])
SECRET = os.getenv("SECRET_KEY", "secret")
security = HTTPBearer(auto_error=False)

def make_token(rid: int, rut: str, tenant_id: int, depto_id: int) -> str:
    return jwt.encode({"sub": str(rid), "rut": rut, "tenant_id": tenant_id,
                       "depto_id": depto_id, "role": "residente",
                       "exp": datetime.utcnow() + timedelta(days=30)}, SECRET, algorithm="HS256")

def get_residente(creds: HTTPAuthorizationCredentials=Depends(security), db: Session=Depends(get_db)):
    if not creds: raise HTTPException(401, "No autenticado")
    try:
        p = jwt.decode(creds.credentials, SECRET, algorithms=["HS256"])
        if p.get("role") != "residente": raise HTTPException(403)
        r = db.query(ResidentePortal).filter(ResidentePortal.id==int(p["sub"])).first()
        if not r or not r.activo: raise HTTPException(401)
        return r
    except jwt.ExpiredSignatureError: raise HTTPException(401, "Sesión expirada")
    except HTTPException: raise
    except: raise HTTPException(401, "Token inválido")

@router.post("/registro")
def registro(data: dict, db: Session=Depends(get_db)):
    rut = data.get("rut","").strip()
    nombre = data.get("nombre_completo","").strip()
    password = data.get("password","")
    depto_id = data.get("departamento_id")
    tenant_id = data.get("tenant_id", 1)
    if not rut or not nombre or not password or not depto_id:
        raise HTTPException(400, "RUT, nombre, contraseña y departamento son requeridos")
    if len(password) < 6: raise HTTPException(400, "Contraseña mínimo 6 caracteres")
    if db.query(ResidentePortal).filter(ResidentePortal.rut==rut, ResidentePortal.tenant_id==tenant_id).first():
        raise HTTPException(400, "Ya existe una cuenta con ese RUT")
    pw = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    r = ResidentePortal(tenant_id=tenant_id, rut=rut, nombre_completo=nombre,
                        email=data.get("email"), telefono=data.get("telefono"),
                        password_hash=pw, departamento_id=depto_id, activo=True)
    db.add(r); db.commit(); db.refresh(r)
    return {"token": make_token(r.id, rut, tenant_id, depto_id),
            "residente": {"id": r.id, "nombre": nombre, "rut": rut, "departamento_id": depto_id}}

@router.post("/login")
def login(data: dict, db: Session=Depends(get_db)):
    rut = data.get("rut","").strip()
    tenant_id = data.get("tenant_id", 1)
    r = db.query(ResidentePortal).filter(ResidentePortal.rut==rut, ResidentePortal.tenant_id==tenant_id).first()
    if not r: raise HTTPException(401, "RUT o contraseña incorrectos")
    if r.locked_until and r.locked_until > datetime.utcnow():
        raise HTTPException(403, "Cuenta bloqueada. Intente en 15 minutos.")
    if not bcrypt.checkpw(data.get("password","").encode(), r.password_hash.encode()):
        r.failed_attempts = (r.failed_attempts or 0) + 1
        if r.failed_attempts >= 5: r.locked_until = datetime.utcnow() + timedelta(minutes=15)
        db.commit(); raise HTTPException(401, "RUT o contraseña incorrectos")
    r.failed_attempts = 0; r.locked_until = None; r.ultimo_login = datetime.utcnow()
    db.commit()
    return {"token": make_token(r.id, rut, tenant_id, r.departamento_id or 0),
            "residente": {"id": r.id, "nombre": r.nombre_completo, "rut": r.rut,
                         "departamento_id": r.departamento_id, "condominio_id": r.condominio_id}}

@router.get("/me")
def me(r: ResidentePortal=Depends(get_residente)):
    return {"id": r.id, "nombre": r.nombre_completo, "rut": r.rut,
            "email": r.email, "departamento_id": r.departamento_id, "condominio_id": r.condominio_id}
