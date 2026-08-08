"""
QR Rotativo -- credencial de acceso personal que cambia cada 30s (anti-replay
de una foto/captura de pantalla del codigo). El backend genera y valida el
codigo; el secreto nunca sale del servidor (residente/socio solo ve la imagen
QR ya renderizada, que se refresca sola).

Funciona igual para residentes de condominio, socios de gimnasio y bodega:
todos autentican via el mismo portal (residentes_portal), y el permiso de
acceso por defecto es "puertas de tu mismo condominio/tenant" -- sin admin
adicional que configurar puerta por puerta (a diferencia de RFID).

GET  /api/portal/qr-rotativo/mi-qr        -> residente/socio: imagen QR vigente (PNG base64) + ttl
POST /api/condominios/qr-rotativo/validar -> staff/kiosco: valida un codigo escaneado en una puerta
"""
import base64
import hashlib
import hmac
import io
import secrets
import time

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models import ResidentePortal
from app.routers.portal_auth import get_residente

import qrcode

router_portal = APIRouter(prefix="/api/portal/qr-rotativo", tags=["qr_rotativo"])
router_admin = APIRouter(prefix="/api/condominios/qr-rotativo", tags=["qr_rotativo"])

WINDOW_SEG = 30


def _get_or_create_secret(db: Session, residente: ResidentePortal) -> str:
    row = db.execute(text(
        "SELECT secret FROM qr_credenciales WHERE residente_portal_id = :rid"
    ), {"rid": residente.id}).fetchone()
    if row:
        return row[0]
    secret = secrets.token_hex(32)
    db.execute(text(
        "INSERT INTO qr_credenciales (tenant_id, residente_portal_id, secret) "
        "VALUES (:tid, :rid, :sec)"
    ), {"tid": residente.tenant_id, "rid": residente.id, "sec": secret})
    db.commit()
    return secret


def _token_for_window(secret: str, residente_id: int, window: int) -> str:
    msg = f"{residente_id}.{window}".encode()
    sig = hmac.new(bytes.fromhex(secret), msg, hashlib.sha256).hexdigest()[:16]
    raw = f"{residente_id}.{window}.{sig}"
    return base64.urlsafe_b64encode(raw.encode()).decode().rstrip("=")


@router_portal.get("/mi-qr")
def mi_qr(residente: ResidentePortal = Depends(get_residente), db: Session = Depends(get_db)):
    secret = _get_or_create_secret(db, residente)
    now = int(time.time())
    window = now // WINDOW_SEG
    payload = _token_for_window(secret, residente.id, window)

    img = qrcode.make(payload, box_size=8, border=2)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    png_b64 = base64.b64encode(buf.getvalue()).decode()

    return {
        "qr_png_base64": f"data:image/png;base64,{png_b64}",
        "expira_en_seg": WINDOW_SEG - (now % WINDOW_SEG),
    }


class ValidarQR(BaseModel):
    payload: str
    puerta_id: int


@router_admin.post("/validar")
def validar_qr(data: ValidarQR, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Llamado desde el kiosco/tablet de la puerta al escanear el QR del residente/socio."""
    tenant_id = current_user["tenant_id"]

    try:
        pad = "=" * (-len(data.payload) % 4)
        raw = base64.urlsafe_b64decode(data.payload + pad).decode()
        residente_id_str, window_str, _sig = raw.split(".")
        residente_id, window = int(residente_id_str), int(window_str)
    except Exception:
        return {"acceso": False, "razon": "Codigo QR invalido"}

    now_window = int(time.time()) // WINDOW_SEG
    if abs(now_window - window) > 1:
        return {"acceso": False, "razon": "Codigo QR expirado"}

    row = db.execute(text(
        "SELECT qc.secret, rp.nombre_completo, rp.condominio_id, rp.tenant_id, rp.activo "
        "FROM qr_credenciales qc JOIN residentes_portal rp ON rp.id = qc.residente_portal_id "
        "WHERE qc.residente_portal_id = :rid AND qc.activo = true"
    ), {"rid": residente_id}).fetchone()
    if not row:
        return {"acceso": False, "razon": "Credencial no encontrada"}
    secret, nombre, condominio_id, cred_tenant_id, activo = row

    if cred_tenant_id != tenant_id:
        return {"acceso": False, "razon": "Codigo QR invalido"}
    if not activo:
        return {"acceso": False, "razon": "Cuenta desactivada"}

    expected = _token_for_window(secret, residente_id, window)
    if not hmac.compare_digest(expected, data.payload):
        return {"acceso": False, "razon": "Codigo QR invalido"}

    puerta = db.execute(text(
        "SELECT id, condominio_id, activa FROM puertas WHERE id = :pid AND tenant_id = :tid"
    ), {"pid": data.puerta_id, "tid": tenant_id}).fetchone()
    if not puerta or not puerta[2]:
        return {"acceso": False, "razon": "Puerta no disponible"}
    puerta_condominio_id = puerta[1]

    if condominio_id is not None and puerta_condominio_id is not None and puerta_condominio_id != condominio_id:
        db.execute(text(
            "INSERT INTO registros_acceso_puertas "
            "(puerta_id, tenant_id, tipo_evento, metodo, exitoso, descripcion) "
            "VALUES (:pid, :tid, 'acceso_denegado', 'qr_rotativo', false, :desc)"
        ), {"pid": data.puerta_id, "tid": tenant_id, "desc": f"{nombre}: puerta de otro condominio"})
        db.commit()
        return {"acceso": False, "razon": "Sin acceso a esta puerta"}

    db.execute(text(
        "UPDATE puertas SET estado = 'abierta', updated_at = NOW() WHERE id = :pid"
    ), {"pid": data.puerta_id})
    db.execute(text(
        "INSERT INTO registros_acceso_puertas "
        "(puerta_id, tenant_id, tipo_evento, metodo, exitoso, descripcion) "
        "VALUES (:pid, :tid, 'acceso_qr', 'qr_rotativo', true, :desc)"
    ), {"pid": data.puerta_id, "tid": tenant_id, "desc": f"Acceso QR: {nombre}"})
    db.commit()

    return {"acceso": True, "titular": nombre}
