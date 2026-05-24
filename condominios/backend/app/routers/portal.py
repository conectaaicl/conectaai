from fastapi import APIRouter, Depends, HTTPException, Form
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.finanzas import GastoComun
from app.models.persona import Persona
from app.models.estructura import Departamento, Piso
from app.models.condominio import Condominio
from app.models.aviso import Aviso
import hmac
import hashlib
import os
import requests
from datetime import datetime
from typing import Optional
from pydantic import BaseModel

router = APIRouter(prefix="/api/portal", tags=["Portal Residente"])

FLOW_API_KEY = os.getenv("FLOW_API_KEY", "")
FLOW_SECRET_KEY = os.getenv("FLOW_SECRET_KEY", "")
FLOW_API_URL = os.getenv("FLOW_API_URL", "https://www.flow.cl/api")


def _flow_sign(params: dict, secret: str) -> str:
    """Sign Flow params: sort alphabetically, concatenate key+value, HMAC-SHA256."""
    sorted_keys = sorted(params.keys())
    to_sign = "".join(k + str(params[k]) for k in sorted_keys)
    return hmac.new(secret.encode(), to_sign.encode(), hashlib.sha256).hexdigest()


class PagoFlowRequest(BaseModel):
    gasto_id: int
    email: str


@router.get("/residente/{rut}")
def get_residente(rut: str, db: Session = Depends(get_db)):
    """Returns resident info, their apartments, and pending/paid gastos comunes."""
    persona = db.query(Persona).filter(Persona.rut == rut).first()
    if not persona:
        raise HTTPException(status_code=404, detail="Residente no encontrado")

    # Find departamentos where this persona is propietario or residente
    departamentos = db.query(Departamento).filter(
        (Departamento.propietario_id == persona.id) |
        (Departamento.residente_id == persona.id)
    ).all()

    depto_ids = [d.id for d in departamentos]

    # Get gastos pendientes/atrasados
    gastos_pendientes = []
    gastos_pagados = []

    if depto_ids:
        gastos = db.query(GastoComun).filter(
            GastoComun.departamento_id.in_(depto_ids)
        ).order_by(GastoComun.anio.desc(), GastoComun.mes.desc()).all()

        for g in gastos:
            g_data = {
                "id": g.id,
                "departamento_id": g.departamento_id,
                "mes": g.mes,
                "anio": g.anio,
                "monto_total": g.monto_total,
                "estado": g.estado,
                "fecha_vencimiento": g.fecha_vencimiento.isoformat() if g.fecha_vencimiento else None,
                "fecha_pago": g.fecha_pago.isoformat() if g.fecha_pago else None,
                "metodo_pago": g.metodo_pago,
            }
            if g.estado in ("pendiente", "atrasado"):
                gastos_pendientes.append(g_data)
            else:
                gastos_pagados.append(g_data)

    deptos_data = []
    for d in departamentos:
        deptos_data.append({
            "id": d.id,
            "numero": d.numero,
            "piso_id": d.piso_id,
            "estado": d.estado,
        })

    return {
        "persona": {
            "nombre": persona.nombre_completo,
            "email": persona.email,
            "rut": persona.rut,
        },
        "departamentos": deptos_data,
        "gastos_pendientes": gastos_pendientes,
        "gastos_pagados": gastos_pagados,
    }


@router.post("/pago/flow/iniciar")
def iniciar_pago_flow(body: PagoFlowRequest, db: Session = Depends(get_db)):
    """Initiates a Flow.cl payment for a gasto comun."""
    if not FLOW_API_KEY or not FLOW_SECRET_KEY:
        raise HTTPException(status_code=503, detail="Flow no configurado")

    gasto = db.query(GastoComun).filter(GastoComun.id == body.gasto_id).first()
    if not gasto:
        raise HTTPException(status_code=404, detail="Gasto no encontrado")
    if gasto.estado not in ("pendiente", "atrasado"):
        raise HTTPException(status_code=400, detail="Gasto ya pagado o no válido")

    params = {
        "apiKey": FLOW_API_KEY,
        "commerceOrder": f"GC-{body.gasto_id}",
        "subject": "Gasto Común",
        "currency": "CLP",
        "amount": int(gasto.monto_total),
        "email": body.email,
        "urlConfirmation": "https://conectaai.cl/api/portal/pago/flow/confirmar",
        "urlReturn": "https://conectaai.cl/portal/pago-resultado",
    }
    params["s"] = _flow_sign(params, FLOW_SECRET_KEY)

    try:
        resp = requests.post(f"{FLOW_API_URL}/payment/create", data=params, timeout=15)
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Error Flow: {str(e)}")

    if "url" not in data or "token" not in data:
        raise HTTPException(status_code=502, detail=f"Respuesta Flow inválida: {data}")

    return {"redirect_url": f"{data['url']}?token={data['token']}"}


@router.post("/pago/flow/confirmar")
def confirmar_pago_flow(token: str = Form(...), db: Session = Depends(get_db)):
    """Flow webhook: called by Flow after payment is processed."""
    if not FLOW_API_KEY or not FLOW_SECRET_KEY:
        raise HTTPException(status_code=503, detail="Flow no configurado")

    sign_params = {"apiKey": FLOW_API_KEY, "token": token}
    s = _flow_sign(sign_params, FLOW_SECRET_KEY)

    try:
        resp = requests.get(
            f"{FLOW_API_URL}/payment/getStatus",
            params={"apiKey": FLOW_API_KEY, "token": token, "s": s},
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Error Flow getStatus: {str(e)}")

    # status 2 = paid
    if data.get("status") == 2:
        commerce_order = data.get("commerceOrder", "")
        # Extract gasto_id from "GC-{id}"
        if commerce_order.startswith("GC-"):
            try:
                gasto_id = int(commerce_order[3:])
                gasto = db.query(GastoComun).filter(GastoComun.id == gasto_id).first()
                if gasto and gasto.estado != "pagado":
                    gasto.estado = "pagado"
                    gasto.fecha_pago = datetime.utcnow()
                    gasto.metodo_pago = "flow"
                    db.commit()
            except (ValueError, Exception):
                pass

    return {"ok": True}


@router.get("/condominio/{condominio_id}/avisos")
def get_avisos_publicos(condominio_id: int, db: Session = Depends(get_db)):
    """Public announcements for a building (last 20 active avisos)."""
    avisos = (
        db.query(Aviso)
        .filter(Aviso.condominio_id == condominio_id, Aviso.activo == True)
        .order_by(Aviso.created_at.desc())
        .limit(20)
        .all()
    )
    return [
        {
            "id": a.id,
            "titulo": a.titulo,
            "contenido": a.contenido,
            "tipo": a.tipo,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        }
        for a in avisos
    ]
