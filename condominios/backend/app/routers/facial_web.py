"""
Reconocimiento facial via camara del celular (sin hardware dedicado).
Feature flag: facial_web -- se puede activar/desactivar por tenant desde /api/features.

POST /api/condominios/facial-web/enrolar    -> registra el rostro de una persona
POST /api/condominios/facial-web/verificar  -> compara una foto contra los rostros registrados
GET  /api/condominios/facial-web/personas   -> lista personas y si ya tienen rostro registrado
"""
import base64
import io
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel

from app.core.database import get_db
from app.core.dependencies import get_current_user

router = APIRouter(prefix="/api/condominios/facial-web", tags=["facial_web"])

UMBRAL_DISTANCIA = 1.1  # menor = mas parecido; facenet-pytorch/vggface2 tipico ~0.9-1.1

_mtcnn = None
_resnet = None


def _cargar_modelos():
    global _mtcnn, _resnet
    if _mtcnn is None:
        from facenet_pytorch import MTCNN, InceptionResnetV1
        _mtcnn = MTCNN(image_size=160, margin=20, post_process=True)
        _resnet = InceptionResnetV1(pretrained="vggface2").eval()
    return _mtcnn, _resnet


def _decodificar_imagen(foto_base64: str):
    from PIL import Image
    if "," in foto_base64 and foto_base64.strip().startswith("data:"):
        foto_base64 = foto_base64.split(",", 1)[1]
    raw = base64.b64decode(foto_base64)
    return Image.open(io.BytesIO(raw)).convert("RGB")


def _obtener_embedding(foto_base64: str) -> Optional[list]:
    mtcnn, resnet = _cargar_modelos()
    img = _decodificar_imagen(foto_base64)
    try:
        rostro = mtcnn(img)
    except Exception:
        return None
    if rostro is None:
        return None
    import torch
    with torch.no_grad():
        emb = resnet(rostro.unsqueeze(0))
    return emb[0].tolist()


def _distancia(a: list, b: list) -> float:
    import math
    return math.sqrt(sum((x - y) ** 2 for x, y in zip(a, b)))


class EnrolarBody(BaseModel):
    persona_id: int
    foto_base64: str


class VerificarBody(BaseModel):
    foto_base64: str
    puerta_id: int


@router.get("/personas")
def listar_personas(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    tenant_id = current_user["tenant_id"]
    rows = db.execute(text(
        "SELECT p.id, p.nombre_completo, p.rut, "
        "EXISTS(SELECT 1 FROM facial_encodings f WHERE f.persona_id = p.id AND f.tenant_id = :tid) as tiene_rostro "
        "FROM personas p WHERE p.tenant_id = :tid ORDER BY p.nombre_completo"
    ), {"tid": tenant_id}).fetchall()
    return [dict(r._mapping) for r in rows]


@router.post("/enrolar")
def enrolar_rostro(data: EnrolarBody, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    tenant_id = current_user["tenant_id"]
    persona = db.execute(
        text("SELECT id FROM personas WHERE id = :pid AND tenant_id = :tid"),
        {"pid": data.persona_id, "tid": tenant_id},
    ).fetchone()
    if not persona:
        raise HTTPException(status_code=404, detail="Persona no encontrada")

    try:
        embedding = _obtener_embedding(data.foto_base64)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error procesando la foto: {e}")
    if embedding is None:
        raise HTTPException(status_code=422, detail="No se detectó ningún rostro en la foto. Intenta con mejor luz y de frente.")

    import json
    db.execute(text(
        "INSERT INTO facial_encodings (tenant_id, persona_id, encoding) VALUES (:tid, :pid, :enc) "
        "ON CONFLICT (tenant_id, persona_id) DO UPDATE SET encoding = :enc, created_at = NOW()"
    ), {"tid": tenant_id, "pid": data.persona_id, "enc": json.dumps(embedding)})
    db.commit()
    return {"success": True}


@router.post("/verificar")
def verificar_rostro(data: VerificarBody, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    tenant_id = current_user["tenant_id"]

    try:
        embedding = _obtener_embedding(data.foto_base64)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error procesando la foto: {e}")
    if embedding is None:
        return {"acceso": False, "razon": "No se detectó ningún rostro en la foto"}

    rows = db.execute(text(
        "SELECT f.persona_id, f.encoding, p.nombre_completo "
        "FROM facial_encodings f JOIN personas p ON p.id = f.persona_id "
        "WHERE f.tenant_id = :tid"
    ), {"tid": tenant_id}).fetchall()

    mejor_persona_id = None
    mejor_nombre = None
    mejor_dist = None
    for pid, enc, nombre in rows:
        dist = _distancia(embedding, enc)
        if mejor_dist is None or dist < mejor_dist:
            mejor_dist, mejor_persona_id, mejor_nombre = dist, pid, nombre

    if mejor_persona_id is None or mejor_dist > UMBRAL_DISTANCIA:
        desc = f"Rostro no reconocido (distancia: {mejor_dist:.2f})" if mejor_dist is not None else "Rostro no reconocido (sin rostros registrados)"
        db.execute(text(
            "INSERT INTO registros_acceso_puertas (puerta_id, tenant_id, tipo_evento, metodo, exitoso, descripcion) "
            "SELECT :pid, tenant_id, 'acceso_denegado', 'facial_web', false, :desc FROM puertas WHERE id = :pid"
        ), {"pid": data.puerta_id, "desc": desc})
        db.commit()
        return {"acceso": False, "razon": "Rostro no reconocido", "distancia": mejor_dist}

    tarjeta = db.execute(text(
        "SELECT t.id FROM tarjetas_rfid t WHERE t.persona_id = :pid AND t.tenant_id = :tid AND t.activa = true LIMIT 1"
    ), {"pid": mejor_persona_id, "tid": tenant_id}).fetchone()

    permitido = False
    if tarjeta:
        permiso = db.execute(text(
            "SELECT habilitado FROM permisos_acceso_rfid WHERE tarjeta_id = :tid AND puerta_id = :pid"
        ), {"tid": tarjeta[0], "pid": data.puerta_id}).fetchone()
        permitido = bool(permiso and permiso[0])

    db.execute(text(
        "INSERT INTO registros_acceso_puertas (puerta_id, tenant_id, tipo_evento, metodo, exitoso, descripcion) "
        "SELECT :pid, tenant_id, :evento, 'facial_web', :ok, :desc FROM puertas WHERE id = :pid"
    ), {
        "pid": data.puerta_id, "ok": permitido,
        "evento": "acceso_facial" if permitido else "acceso_denegado",
        "desc": f"Reconocido: {mejor_nombre} (distancia: {mejor_dist:.2f})" if permitido else f"Reconocido: {mejor_nombre} (distancia: {mejor_dist:.2f}) — sin permiso para esta puerta",
    })
    if permitido:
        db.execute(text("UPDATE puertas SET estado = 'abierta', updated_at = NOW() WHERE id = :pid"), {"pid": data.puerta_id})
    db.commit()

    if not permitido:
        return {"acceso": False, "razon": f"{mejor_nombre} — sin permiso para esta puerta", "titular": mejor_nombre, "distancia": mejor_dist}
    return {"acceso": True, "titular": mejor_nombre, "distancia": mejor_dist}
