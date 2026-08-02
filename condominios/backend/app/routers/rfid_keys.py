"""
Gestión de llaves RFID cifradas por condominio.
Cada edificio tiene un juego único de llaves Mifare Classic (16 sectores × 2 llaves).
Las llaves se almacenan cifradas con AES-256-GCM usando una master key de entorno.
"""
import os
import json
import base64
import secrets
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from app.core.database import get_db

router = APIRouter(prefix="/api/rfid-keys", tags=["rfid-keys"])

_MASTER_HEX = os.getenv("RFID_MASTER_KEY", "")
if len(_MASTER_HEX) == 64:
    MASTER_KEY = bytes.fromhex(_MASTER_HEX)
else:
    # Fallback: derive from a stable string — better than nothing, rotate in prod
    import hashlib
    _seed = os.getenv("SECRET_KEY", "conectaai-rfid-fallback-key-change-me")
    MASTER_KEY = hashlib.sha256(_seed.encode()).digest()


def _gen_sector_keys() -> list[dict]:
    """16 sectores × 2 llaves (A+B) de 6 bytes = 192 bytes de entropía."""
    return [
        {"sector": i, "key_a": secrets.token_bytes(6).hex().upper(),
         "key_b": secrets.token_bytes(6).hex().upper()}
        for i in range(16)
    ]


def _encrypt(data: dict) -> tuple[str, str]:
    nonce = os.urandom(12)
    aesgcm = AESGCM(MASTER_KEY)
    ct = aesgcm.encrypt(nonce, json.dumps(data).encode(), None)
    return base64.b64encode(ct).decode(), base64.b64encode(nonce).decode()


def _decrypt(enc_b64: str, nonce_b64: str) -> dict:
    aesgcm = AESGCM(MASTER_KEY)
    ct = base64.b64decode(enc_b64)
    nonce = base64.b64decode(nonce_b64)
    return json.loads(aesgcm.decrypt(nonce, ct, None))


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/generate/{condominio_id}", status_code=201)
def generate_keys(condominio_id: int, db: Session = Depends(get_db)):
    """Genera y almacena un juego único de llaves para el condominio."""
    existing = db.execute(
        text("SELECT id FROM rfid_condominio_keys WHERE condominio_id = :c"),
        {"c": condominio_id},
    ).fetchone()
    if existing:
        raise HTTPException(409, "Ya existen llaves para este condominio. Use /rotate para regenerar.")

    sectors = _gen_sector_keys()
    enc, nonce = _encrypt({"condominio_id": condominio_id, "sectors": sectors})

    db.execute(text("""
        INSERT INTO rfid_condominio_keys (condominio_id, keys_encrypted, keys_nonce)
        VALUES (:c, :e, :n)
    """), {"c": condominio_id, "e": enc, "n": nonce})
    db.commit()
    return {"ok": True, "condominio_id": condominio_id, "sectors": 16}


@router.post("/rotate/{condominio_id}")
def rotate_keys(condominio_id: int, db: Session = Depends(get_db)):
    """Regenera las llaves (invalida todas las tarjetas emitidas anteriormente)."""
    sectors = _gen_sector_keys()
    enc, nonce = _encrypt({"condominio_id": condominio_id, "sectors": sectors})
    result = db.execute(text("""
        UPDATE rfid_condominio_keys
        SET keys_encrypted = :e, keys_nonce = :n, card_count = 0, updated_at = NOW()
        WHERE condominio_id = :c
    """), {"c": condominio_id, "e": enc, "n": nonce})
    db.commit()
    if result.rowcount == 0:
        raise HTTPException(404, "No hay llaves previas. Use /generate primero.")
    return {"ok": True, "warning": "Todas las tarjetas previas quedan invalidadas."}


@router.get("/status/{condominio_id}")
def get_status(condominio_id: int, db: Session = Depends(get_db)):
    """Estado del juego de llaves (sin revelar las llaves)."""
    row = db.execute(
        text("SELECT card_count, created_at, updated_at FROM rfid_condominio_keys WHERE condominio_id = :c"),
        {"c": condominio_id},
    ).fetchone()
    if not row:
        return {"has_keys": False}
    return {"has_keys": True, "card_count": row[0], "created_at": str(row[1]), "updated_at": str(row[2])}


@router.get("/sectors/{condominio_id}")
def get_sectors(condominio_id: int, db: Session = Depends(get_db)):
    """
    Retorna las llaves de sector para programar una nueva tarjeta.
    Incrementa el contador de tarjetas emitidas.
    ⚠️ Solo llamar desde el panel admin — no exponer a residentes.
    """
    row = db.execute(
        text("SELECT keys_encrypted, keys_nonce FROM rfid_condominio_keys WHERE condominio_id = :c"),
        {"c": condominio_id},
    ).fetchone()
    if not row:
        raise HTTPException(404, "No hay llaves para este condominio. Genera primero.")

    data = _decrypt(row[0], row[1])
    db.execute(
        text("UPDATE rfid_condominio_keys SET card_count = card_count + 1, updated_at = NOW() WHERE condominio_id = :c"),
        {"c": condominio_id},
    )
    db.commit()
    return {"condominio_id": condominio_id, "sectors": data["sectors"]}


@router.get("/all")
def list_all(db: Session = Depends(get_db)):
    """Lista todos los condominios con llaves y su estado."""
    rows = db.execute(text(
        "SELECT condominio_id, card_count, created_at, updated_at FROM rfid_condominio_keys ORDER BY condominio_id"
    )).fetchall()
    return [{"condominio_id": r[0], "card_count": r[1], "created_at": str(r[2]), "updated_at": str(r[3])} for r in rows]
