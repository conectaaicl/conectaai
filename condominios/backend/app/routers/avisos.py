from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.aviso import Aviso
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/api/avisos", tags=["Avisos"])


class AvisoCreate(BaseModel):
    tenant_id: int
    condominio_id: Optional[int] = None
    titulo: str
    contenido: str
    tipo: str = "informativo"
    created_by: Optional[int] = None


@router.get("")
def list_avisos(
    condominio_id: Optional[int] = Query(None),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List active avisos for a tenant, optionally filtered by condominio."""
    tenant_id = current_user["tenant_id"]
    q = db.query(Aviso).filter(Aviso.tenant_id == tenant_id, Aviso.activo == True)
    if condominio_id is not None:
        q = q.filter(Aviso.condominio_id == condominio_id)
    avisos = q.order_by(Aviso.created_at.desc()).all()
    return [
        {
            "id": a.id,
            "tenant_id": a.tenant_id,
            "condominio_id": a.condominio_id,
            "titulo": a.titulo,
            "contenido": a.contenido,
            "tipo": a.tipo,
            "activo": a.activo,
            "created_at": a.created_at.isoformat() if a.created_at else None,
            "created_by": a.created_by,
        }
        for a in avisos
    ]


@router.post("", status_code=201)
def create_aviso(body: AvisoCreate, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Create a new aviso/announcement."""
    tenant_id = current_user["tenant_id"]
    aviso = Aviso(**body.dict())
    db.add(aviso)
    db.commit()
    db.refresh(aviso)
    return {"id": aviso.id, "titulo": aviso.titulo}


@router.delete("/{aviso_id}", status_code=204)
def delete_aviso(aviso_id: int, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    """Soft-delete (deactivate) an aviso."""
    tenant_id = current_user["tenant_id"]
    aviso = db.query(Aviso).filter(Aviso.id == aviso_id).first()
    if not aviso:
        raise HTTPException(status_code=404, detail="Aviso no encontrado")
    aviso.activo = False
    db.commit()


@router.post("/{aviso_id}/enviar")
def enviar_aviso_residentes(aviso_id: int, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_id = current_user["tenant_id"]
    import os as _os, httpx as _hx
    from sqlalchemy import text as _t
    aviso = db.query(Aviso).filter(Aviso.id == aviso_id, Aviso.activo == True).first()
    if not aviso:
        raise HTTPException(404, "Aviso no encontrado")
    personas = db.execute(_t(
        "SELECT nombre_completo,email FROM personas "
        "WHERE tenant_id=:tid AND estado='activo' AND email IS NOT NULL AND email!='' "
        "AND roles && ARRAY['propietario','residente','arrendatario']::text[]"
    ), {"tid": tenant_id}).fetchall()
    tipo_label = {
        "informativo": "Informativo", "urgente": "URGENTE",
        "mantencion": "Mantención", "reserva": "Reserva"
    }.get(aviso.tipo, aviso.tipo)
    enviados, errores = 0, []
    for p in personas:
        pd = dict(p._mapping)
        html = (
            f"<h2>[{tipo_label}] {aviso.titulo}</h2>"
            f"<p>Estimado/a <b>{pd['nombre_completo']}</b>,</p>"
            f"<div style='background:#f5f5f5;padding:16px;border-radius:8px'>{aviso.contenido}</div>"
            f"<p style='color:#888;font-size:12px'>ConectaAI Condominios</p>"
        )
        try:
            _hx.post(_os.getenv("MAIL_API_URL", "http://localhost:3004/api/send"),
                json={"to": pd["email"], "from": "condominios@conectaai.cl",
                      "subject": f"[{tipo_label}] {aviso.titulo}", "html": html},
                headers={"Authorization": "Bearer " + _os.getenv("MAIL_API_KEY", "")}, timeout=5)
            enviados += 1
        except Exception as e:
            errores.append({"email": pd["email"], "error": str(e)})
    _push_aviso(aviso_id, tenant_id, aviso.titulo, db)
    return {"total": len(personas), "enviados": enviados, "errores": errores[:5]}


def _push_aviso(aviso_id: int, tenant_id: int, titulo: str, db):
    """Non-blocking push notification when an aviso is sent"""
    try:
        subs = db.execute(
            __import__('sqlalchemy').text(
                "SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE tenant_id=:tid"
            ), {"tid": tenant_id}
        ).fetchall()
        if not subs:
            return
        import json, os
        from pywebpush import webpush
        vapid_priv = os.getenv("VAPID_PRIVATE_KEY", "")
        vapid_email = os.getenv("VAPID_EMAIL", "mailto:admin@conectaai.cl")
        if not vapid_priv:
            return
        payload = json.dumps({
            "titulo": "📢 Nuevo aviso",
            "mensaje": titulo[:100],
            "url": "/portal/avisos",
            "icono": "/favicon.svg"
        }, ensure_ascii=False)
        dead = []
        for s in subs:
            m = s._mapping
            try:
                webpush(
                    subscription_info={"endpoint": m["endpoint"], "keys": {"p256dh": m["p256dh"], "auth": m["auth"]}},
                    data=payload,
                    vapid_private_key=vapid_priv,
                    vapid_claims={"sub": vapid_email}
                )
            except Exception as e:
                if "410" in str(e) or "404" in str(e):
                    dead.append(m["endpoint"])
        for ep in dead:
            try:
                db.execute(__import__('sqlalchemy').text("DELETE FROM push_subscriptions WHERE endpoint=:ep"), {"ep": ep})
            except Exception:
                pass
        if dead:
            db.commit()
    except Exception:
        pass
