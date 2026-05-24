from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from sqlalchemy import func as sqlfunc
from app.core.database import get_db
from app.models import LiquidacionSueldo, Persona
from datetime import datetime
from typing import Optional
import io

router = APIRouter(prefix="/api/condominios/remuneraciones", tags=["remuneraciones"])

# Tabla impuesto único 2024 (UF simplificada)
TRAMOS_IU = [
    (0, 13.5, 0.0, 0.0),
    (13.5, 30, 0.04, 0.54),
    (30, 50, 0.08, 1.74),
    (50, 70, 0.135, 4.49),
    (70, 90, 0.23, 11.14),
    (90, 120, 0.304, 17.8),
    (120, 150, 0.355, 23.92),
    (150, float("inf"), 0.40, 31.42),
]
UF_VALUE = 38000  # approximate, should be fetched from SII

def calcular_impuesto_unico(sueldo_imponible: float) -> float:
    """Calculate impuesto único based on simplified tramos"""
    try:
        en_uf = sueldo_imponible / UF_VALUE
        for low, high, tasa, deduccion in TRAMOS_IU:
            if low <= en_uf < high:
                return max(0, (en_uf * tasa - deduccion) * UF_VALUE)
    except:
        pass
    return 0.0

def calcular_liquidacion(data: dict) -> dict:
    """Calculate all amounts from base inputs"""
    sueldo_base = float(data.get("sueldo_base", 0))
    gratificacion = float(data.get("gratificacion", 0))
    horas_extra_monto = float(data.get("horas_extra_monto", 0))
    bono_colacion = float(data.get("bono_colacion", 0))
    bono_movilizacion = float(data.get("bono_movilizacion", 0))
    otros_haberes = float(data.get("otros_haberes", 0))
    otros_descuentos = float(data.get("otros_descuentos", 0))
    afp_tasa = float(data.get("afp_tasa", 10.0)) / 100
    salud_tasa = float(data.get("salud_tasa", 7.0)) / 100

    total_haberes = sueldo_base + gratificacion + horas_extra_monto + bono_colacion + bono_movilizacion + otros_haberes
    # Sueldo imponible = total haberes minus non-imponible (colacion, movilizacion)
    sueldo_imponible = sueldo_base + gratificacion + horas_extra_monto + otros_haberes

    afp_monto = round(sueldo_imponible * afp_tasa)
    salud_monto = round(sueldo_imponible * salud_tasa)
    cesantia_trab = round(sueldo_imponible * 0.006)  # 0.6% trabajador
    cesantia_emp = round(sueldo_imponible * 0.024)   # 2.4% empleador
    base_impuesto = sueldo_imponible - afp_monto - salud_monto - cesantia_trab
    impuesto = round(calcular_impuesto_unico(base_impuesto))
    total_descuentos = afp_monto + salud_monto + cesantia_trab + impuesto + otros_descuentos
    liquido = round(total_haberes - total_descuentos)

    return {
        "total_haberes": round(total_haberes),
        "sueldo_imponible": round(sueldo_imponible),
        "afp_monto": afp_monto,
        "salud_monto": salud_monto,
        "cesantia_trabajador": cesantia_trab,
        "cesantia_empleador": cesantia_emp,
        "impuesto_unico": impuesto,
        "total_descuentos": round(total_descuentos),
        "liquido_pagar": liquido
    }

@router.get("")
def list_liquidaciones(tenant_id: int, periodo: Optional[str]=None,
                       condominio_id: Optional[int]=None, estado: Optional[str]=None,
                       db: Session=Depends(get_db)):
    q = db.query(LiquidacionSueldo).filter(LiquidacionSueldo.tenant_id==tenant_id)
    if periodo: q = q.filter(LiquidacionSueldo.periodo==periodo)
    if condominio_id: q = q.filter(LiquidacionSueldo.condominio_id==condominio_id)
    if estado: q = q.filter(LiquidacionSueldo.estado==estado)
    return q.order_by(LiquidacionSueldo.periodo.desc(), LiquidacionSueldo.nombre_trabajador).all()

@router.get("/stats")
def get_stats(tenant_id: int, periodo: Optional[str]=None, db: Session=Depends(get_db)):
    q = db.query(LiquidacionSueldo).filter(LiquidacionSueldo.tenant_id==tenant_id)
    if periodo: q = q.filter(LiquidacionSueldo.periodo==periodo)
    total = q.count()
    pagadas = q.filter(LiquidacionSueldo.estado=="pagado").count()
    monto_total = q.with_entities(sqlfunc.sum(LiquidacionSueldo.liquido_pagar)).scalar() or 0
    return {"total": total, "pagadas": pagadas, "pendientes": total-pagadas, "monto_total": monto_total}

@router.post("/calcular")
def calcular(data: dict):
    """Preview calculation without saving"""
    return calcular_liquidacion(data)

@router.post("")
def create_liquidacion(data: dict, db: Session=Depends(get_db)):
    calcs = calcular_liquidacion(data)
    data.update(calcs)
    liq = LiquidacionSueldo(**{k: v for k, v in data.items() if hasattr(LiquidacionSueldo, k)})
    db.add(liq); db.commit(); db.refresh(liq)
    return liq

@router.put("/{liq_id}")
def update_liquidacion(liq_id: int, data: dict, db: Session=Depends(get_db)):
    liq = db.query(LiquidacionSueldo).filter(LiquidacionSueldo.id==liq_id).first()
    if not liq: raise HTTPException(404)
    calcs = calcular_liquidacion({**{c.name: getattr(liq, c.name) for c in liq.__table__.columns}, **data})
    data.update(calcs)
    for k, v in data.items():
        if hasattr(liq, k): setattr(liq, k, v)
    db.commit(); return liq

@router.delete("/{liq_id}")
def delete_liquidacion(liq_id: int, db: Session=Depends(get_db)):
    liq = db.query(LiquidacionSueldo).filter(LiquidacionSueldo.id==liq_id).first()
    if liq: db.delete(liq); db.commit()
    return {"ok": True}

@router.get("/previred/{periodo}")
def export_previred(periodo: str, tenant_id: int, db: Session=Depends(get_db)):
    """Export Previred-compatible text file for a given period"""
    liqs = db.query(LiquidacionSueldo).filter(
        LiquidacionSueldo.tenant_id==tenant_id,
        LiquidacionSueldo.periodo==periodo,
        LiquidacionSueldo.estado.in_(["aprobado","pagado"])
    ).all()
    if not liqs: raise HTTPException(404, "No hay liquidaciones aprobadas para este período")

    lines = []
    for l in liqs:
        rut_clean = l.rut_trabajador.replace(".","").replace("-","")
        afp_map = {"capital":"03","cuprum":"06","habitat":"07","modelo":"09","planvital":"01","provida":"08","uno":"10"}
        afp_cod = afp_map.get((l.afp_nombre or "").lower().replace(" ",""), "09")
        salud_cod = "01" if (l.salud_tipo or "").lower() == "fonasa" else "02"
        line = "\t".join([
            rut_clean, l.nombre_trabajador, periodo,
            str(int(l.sueldo_imponible or 0)),
            afp_cod, str(int(l.afp_monto or 0)),
            salud_cod, str(int(l.salud_monto or 0)),
            str(int(l.cesantia_trabajador or 0)),
            str(int(l.cesantia_empleador or 0))
        ])
        lines.append(line)

    content = "\n".join(lines)
    return Response(content=content, media_type="text/plain",
                   headers={"Content-Disposition": f"attachment; filename=previred_{periodo}.txt"})


@router.get("/{lid}/pdf")
async def download_liquidacion_pdf(lid: int, db: Session = Depends(get_db)):
    """Download liquidacion de sueldo as PDF."""
    from fastapi.responses import StreamingResponse
    from app.services.pdf_service import generar_liquidacion_pdf
    liq = db.query(LiquidacionSueldo).filter(LiquidacionSueldo.id == lid).first()
    if not liq:
        raise HTTPException(404, "Liquidacion no encontrada")
    d = {c.name: getattr(liq, c.name) for c in liq.__table__.columns}
    pdf_bytes = generar_liquidacion_pdf(d)
    periodo = liq.periodo or "periodo"
    nombre = (liq.nombre_trabajador or "trabajador").replace(" ", "_")
    filename = "liquidacion_" + periodo + "_" + nombre + ".pdf"
    return StreamingResponse(
        iter([pdf_bytes]),
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=" + filename}
    )
