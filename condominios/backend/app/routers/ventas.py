from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime, date, timedelta
from pydantic import BaseModel
import io

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.ventas import Deal, Cotizacion

router = APIRouter(prefix="/api/ventas", tags=["Ventas CRM"])

PROB_ETAPA = {
    "prospecto": 10,
    "calificado": 25,
    "propuesta": 50,
    "negociacion": 75,
    "ganado": 100,
    "perdido": 0,
}


class DealCreate(BaseModel):
    cliente: str
    contacto: Optional[str] = None
    email: Optional[str] = None
    telefono: Optional[str] = None
    origen: str = "manual"
    etapa: str = "prospecto"
    monto: float = 0
    probabilidad: Optional[int] = None
    notas: Optional[str] = None
    lead_id: Optional[int] = None
    asignado_a: Optional[int] = None
    fecha_cierre_estimada: Optional[date] = None


class DealUpdate(BaseModel):
    cliente: Optional[str] = None
    contacto: Optional[str] = None
    email: Optional[str] = None
    telefono: Optional[str] = None
    origen: Optional[str] = None
    etapa: Optional[str] = None
    monto: Optional[float] = None
    probabilidad: Optional[int] = None
    notas: Optional[str] = None
    asignado_a: Optional[int] = None
    fecha_cierre_estimada: Optional[date] = None


class CotizacionCreate(BaseModel):
    items: List[dict]
    descuento: float = 0
    notas: Optional[str] = None
    valida_dias: int = 30


def deal_to_dict(d: Deal) -> dict:
    return {
        "id": d.id,
        "tenant_id": d.tenant_id,
        "cliente": d.cliente,
        "contacto": d.contacto,
        "email": d.email,
        "telefono": d.telefono,
        "origen": d.origen or "manual",
        "etapa": d.etapa,
        "monto": float(d.monto) if d.monto else 0,
        "probabilidad": d.probabilidad or PROB_ETAPA.get(d.etapa, 20),
        "notas": d.notas,
        "lead_id": d.lead_id,
        "asignado_a": d.asignado_a,
        "fecha": d.created_at.isoformat() if d.created_at else None,
        "ultimo_contacto": d.ultimo_contacto.isoformat() if d.ultimo_contacto else None,
        "fecha_cierre_estimada": d.fecha_cierre_estimada.isoformat() if d.fecha_cierre_estimada else None,
        "created_at": d.created_at.isoformat() if d.created_at else None,
        "updated_at": d.updated_at.isoformat() if d.updated_at else None,
    }


def cotizacion_to_dict(c: Cotizacion, deal: Optional[Deal] = None) -> dict:
    return {
        "id": c.id,
        "tenant_id": c.tenant_id,
        "deal_id": c.deal_id,
        "numero": c.numero,
        "items": c.items or [],
        "subtotal": float(c.subtotal) if c.subtotal else 0,
        "descuento": float(c.descuento) if c.descuento else 0,
        "iva": float(c.iva) if c.iva else 0,
        "total": float(c.total) if c.total else 0,
        "estado": c.estado,
        "notas": c.notas,
        "valida_hasta": c.valida_hasta.isoformat() if c.valida_hasta else None,
        "pdf_url": c.pdf_url,
        "fecha": c.created_at.isoformat() if c.created_at else None,
        "cliente": deal.cliente if deal else None,
        "contacto": deal.contacto if deal else None,
        "created_at": c.created_at.isoformat() if c.created_at else None,
    }


@router.get("/deals")
def listar_deals(etapa: Optional[str] = None, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_id = current_user["tenant_id"]
    q = db.query(Deal).filter(Deal.tenant_id == tenant_id)
    if etapa:
        q = q.filter(Deal.etapa == etapa)
    return [deal_to_dict(d) for d in q.order_by(Deal.created_at.desc()).all()]


@router.post("/deals", status_code=201)
def crear_deal(body: DealCreate, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_id = current_user["tenant_id"]
    prob = body.probabilidad if body.probabilidad is not None else PROB_ETAPA.get(body.etapa, 20)
    deal = Deal(
        tenant_id=tenant_id, cliente=body.cliente, contacto=body.contacto,
        email=body.email, telefono=body.telefono, origen=body.origen,
        etapa=body.etapa, monto=body.monto, probabilidad=prob,
        notas=body.notas, lead_id=body.lead_id, asignado_a=body.asignado_a,
        fecha_cierre_estimada=body.fecha_cierre_estimada,
        ultimo_contacto=datetime.now(),
    )
    db.add(deal)
    db.commit()
    db.refresh(deal)
    return deal_to_dict(deal)


@router.get("/deals/{deal_id}")
def obtener_deal(deal_id: int, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_id = current_user["tenant_id"]
    deal = db.query(Deal).filter(Deal.id == deal_id, Deal.tenant_id == tenant_id).first()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal no encontrado")
    return deal_to_dict(deal)


@router.put("/deals/{deal_id}")
def actualizar_deal(deal_id: int, body: DealUpdate, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_id = current_user["tenant_id"]
    deal = db.query(Deal).filter(Deal.id == deal_id, Deal.tenant_id == tenant_id).first()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal no encontrado")
    data = body.dict(exclude_unset=True)
    if "etapa" in data and "probabilidad" not in data:
        data["probabilidad"] = PROB_ETAPA.get(data["etapa"], deal.probabilidad)
    for field, value in data.items():
        setattr(deal, field, value)
    deal.ultimo_contacto = datetime.now()
    deal.updated_at = datetime.now()
    db.commit()
    db.refresh(deal)
    return deal_to_dict(deal)


@router.delete("/deals/{deal_id}", status_code=204)
def eliminar_deal(deal_id: int, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_id = current_user["tenant_id"]
    deal = db.query(Deal).filter(Deal.id == deal_id, Deal.tenant_id == tenant_id).first()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal no encontrado")
    db.delete(deal)
    db.commit()


@router.post("/deals/{deal_id}/cotizaciones", status_code=201)
def crear_cotizacion(deal_id: int, body: CotizacionCreate, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_id = current_user["tenant_id"]
    deal = db.query(Deal).filter(Deal.id == deal_id, Deal.tenant_id == tenant_id).first()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal no encontrado")
    items_validos = [i for i in body.items if i.get("descripcion", "").strip()]
    subtotal = sum(i.get("cantidad", 1) * i.get("precio", 0) for i in items_validos)
    descuento = body.descuento
    iva = round((subtotal - descuento) * 0.19)
    total = subtotal - descuento + iva
    count = db.query(Cotizacion).filter(Cotizacion.tenant_id == tenant_id).count()
    numero = f"COT-{tenant_id:02d}-{(count + 1):04d}"
    cot = Cotizacion(
        tenant_id=tenant_id, deal_id=deal_id, numero=numero,
        items=items_validos, subtotal=subtotal, descuento=descuento,
        iva=iva, total=total, notas=body.notas,
        valida_hasta=date.today() + timedelta(days=body.valida_dias),
        estado="borrador",
    )
    db.add(cot)
    if deal.etapa in ("prospecto", "calificado"):
        deal.etapa = "propuesta"
        deal.probabilidad = PROB_ETAPA["propuesta"]
    db.commit()
    db.refresh(cot)
    return cotizacion_to_dict(cot, deal)


@router.get("/cotizaciones")
def listar_cotizaciones(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_id = current_user["tenant_id"]
    rows = (
        db.query(Cotizacion, Deal)
        .outerjoin(Deal, Cotizacion.deal_id == Deal.id)
        .filter(Cotizacion.tenant_id == tenant_id)
        .order_by(Cotizacion.created_at.desc())
        .all()
    )
    return [cotizacion_to_dict(c, d) for c, d in rows]


@router.get("/cotizaciones/{cotizacion_id}/pdf")
def descargar_pdf(cotizacion_id: int, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_id = current_user["tenant_id"]
    cot = db.query(Cotizacion).filter(Cotizacion.id == cotizacion_id, Cotizacion.tenant_id == tenant_id).first()
    if not cot:
        raise HTTPException(status_code=404, detail="Cotizacion no encontrada")
    deal = db.query(Deal).filter(Deal.id == cot.deal_id).first() if cot.deal_id else None
    pdf_bytes = _generar_pdf(cot, deal)
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="cotizacion_{cot.numero}.pdf"'},
    )


def _generar_pdf(cot: Cotizacion, deal) -> bytes:
    from reportlab.lib.pagesizes import letter
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.lib.units import cm
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, HRFlowable

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=letter,
                            rightMargin=1.8*cm, leftMargin=1.8*cm,
                            topMargin=1.5*cm, bottomMargin=1.5*cm)
    styles = getSampleStyleSheet()
    story = []
    INDIGO = colors.HexColor("#6366f1")
    LIGHT  = colors.HexColor("#f8fafc")
    GRAY   = colors.HexColor("#64748b")
    DARK   = colors.HexColor("#1e293b")

    fecha_str = cot.created_at.strftime("%d/%m/%Y") if cot.created_at else "—"
    valida_str = cot.valida_hasta.strftime("%d/%m/%Y") if cot.valida_hasta else "—"
    hd = [[
        Paragraph('<font color="#6366f1" size="16"><b>ConectaAI</b></font><br/><font color="#64748b" size="8">CRM Condominios</font>', styles["Normal"]),
        Paragraph(f'<font color="#64748b" size="8">Fecha: {fecha_str}<br/>Válida hasta: {valida_str}</font>', styles["Normal"]),
    ]]
    ht = Table(hd, colWidths=["60%", "40%"])
    ht.setStyle(TableStyle([("ALIGN", (1,0), (1,0), "RIGHT"), ("VALIGN", (0,0),(-1,-1),"MIDDLE"), ("BOTTOMPADDING",(0,0),(-1,-1),8)]))
    story.append(ht)
    story.append(HRFlowable(width="100%", thickness=2, color=INDIGO, spaceAfter=10))

    story.append(Paragraph(f'<font color="#6366f1" size="20"><b>COTIZACIÓN</b></font>', styles["Normal"]))
    story.append(Paragraph(f'<font color="#64748b" size="10">{cot.numero}</font>', styles["Normal"]))
    story.append(Spacer(1, 12))

    cn = deal.cliente if deal else "—"
    cc = deal.contacto if deal else "—"
    ce = deal.email if deal else "—"
    ct = deal.telefono if deal else "—"
    story.append(Paragraph('<font color="#1e293b" size="9"><b>DATOS DEL CLIENTE</b></font>', styles["Normal"]))
    story.append(Spacer(1, 3))
    id_data = [["Cliente:", cn], ["Contacto:", cc or "—"], ["Email:", ce or "—"], ["Teléfono:", ct or "—"]]
    id_t = Table(id_data, colWidths=[2.5*cm, 12*cm])
    id_t.setStyle(TableStyle([("FONTSIZE",(0,0),(-1,-1),9),("TEXTCOLOR",(0,0),(0,-1),GRAY),("FONTNAME",(1,0),(1,-1),"Helvetica-Bold"),("BOTTOMPADDING",(0,0),(-1,-1),3)]))
    story.append(id_t)
    story.append(Spacer(1, 14))

    def fmt(n):
        try: return f"$ {int(float(n)):,}".replace(",",".")
        except: return "$ 0"

    story.append(Paragraph('<font color="#1e293b" size="9"><b>DETALLE</b></font>', styles["Normal"]))
    story.append(Spacer(1, 4))
    rows = [[Paragraph("<b>Descripción</b>",styles["Normal"]), Paragraph("<b>Cant.</b>",styles["Normal"]),
             Paragraph("<b>Precio</b>",styles["Normal"]), Paragraph("<b>Subtotal</b>",styles["Normal"])]]
    for item in (cot.items or []):
        sub = item.get("subtotal", item.get("cantidad",1)*item.get("precio",0))
        rows.append([Paragraph(item.get("descripcion",""), styles["Normal"]),
                     str(item.get("cantidad",1)), fmt(item.get("precio",0)), fmt(sub)])
    it = Table(rows, colWidths=["52%","10%","19%","19%"])
    it.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,0),INDIGO), ("TEXTCOLOR",(0,0),(-1,0),colors.white),
        ("FONTNAME",(0,0),(-1,0),"Helvetica-Bold"), ("FONTSIZE",(0,0),(-1,-1),9),
        ("ALIGN",(1,0),(-1,-1),"RIGHT"), ("ROWBACKGROUNDS",(0,1),(-1,-1),[colors.white,LIGHT]),
        ("GRID",(0,0),(-1,-1),0.5,colors.HexColor("#e2e8f0")),
        ("TOPPADDING",(0,0),(-1,-1),5), ("BOTTOMPADDING",(0,0),(-1,-1),5),
        ("LEFTPADDING",(0,0),(-1,-1),7), ("RIGHTPADDING",(0,0),(-1,-1),7),
    ]))
    story.append(it)
    story.append(Spacer(1, 10))

    tot_data = [
        ["","Subtotal:", fmt(cot.subtotal)],
        ["","Descuento:", f"- {fmt(cot.descuento)}"],
        ["","IVA (19%):", fmt(cot.iva)],
        ["",Paragraph("<b>TOTAL:</b>",styles["Normal"]), Paragraph(f"<b>{fmt(cot.total)}</b>",styles["Normal"])],
    ]
    tot_t = Table(tot_data, colWidths=["55%","25%","20%"])
    tot_t.setStyle(TableStyle([
        ("FONTSIZE",(0,0),(-1,-1),9), ("ALIGN",(2,0),(2,-1),"RIGHT"),
        ("TEXTCOLOR",(1,0),(1,2),GRAY), ("LINEABOVE",(1,3),(-1,3),1.5,INDIGO),
        ("TOPPADDING",(0,3),(-1,3),8), ("FONTSIZE",(0,3),(-1,3),11),
        ("TEXTCOLOR",(1,3),(-1,3),INDIGO), ("BOTTOMPADDING",(0,0),(-1,-1),4),
    ]))
    story.append(tot_t)

    if cot.notas:
        story.append(Spacer(1, 14))
        story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#e2e8f0"), spaceAfter=6))
        story.append(Paragraph('<font color="#64748b" size="8"><b>NOTAS Y CONDICIONES</b></font>', styles["Normal"]))
        story.append(Spacer(1, 3))
        story.append(Paragraph(f'<font color="#475569" size="8">{cot.notas}</font>', styles["Normal"]))

    story.append(Spacer(1, 20))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#e2e8f0"), spaceAfter=5))
    story.append(Paragraph('<font color="#94a3b8" size="7">ConectaAI · CRM Condominios · Esta cotización es válida hasta la fecha indicada.</font>', styles["Normal"]))

    doc.build(story)
    return buf.getvalue()


@router.get("/pipeline")
def get_pipeline(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_id = current_user["tenant_id"]
    deals = db.query(Deal).filter(
        Deal.tenant_id == tenant_id,
        Deal.etapa != "perdido"
    ).order_by(Deal.created_at.desc()).all()

    etapas = ["prospecto", "calificado", "propuesta", "negociacion", "ganado"]
    pipeline = {e: [] for e in etapas}

    for d in deals:
        etapa = d.etapa if d.etapa in pipeline else "prospecto"
        pipeline[etapa].append({
            "id": d.id,
            "cliente": d.cliente,
            "contacto": d.contacto,
            "email": d.email,
            "telefono": d.telefono,
            "origen": d.origen,
            "etapa": d.etapa,
            "monto": float(d.monto or 0),
            "probabilidad": d.probabilidad or PROB_ETAPA.get(d.etapa, 0),
            "notas": d.notas,
            "tenant_id": d.tenant_id,
            "created_at": d.created_at.isoformat() if d.created_at else None,
            "updated_at": d.updated_at.isoformat() if hasattr(d, "updated_at") and d.updated_at else None,
        })

    totals = {e: {"count": len(v), "monto": sum(x["monto"] for x in v)} for e, v in pipeline.items()}
    return {"pipeline": pipeline, "totals": totals}

@router.get("/stats")
def stats_ventas(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_id = current_user["tenant_id"]
    deals = db.query(Deal).filter(Deal.tenant_id == tenant_id).all()
    activos  = [d for d in deals if d.etapa not in ("ganado","perdido")]
    ganados  = [d for d in deals if d.etapa == "ganado"]
    cerrados = [d for d in deals if d.etapa in ("ganado","perdido")]
    total_pipeline     = sum(float(d.monto) for d in activos)
    tasa_conversion    = round(len(ganados)/len(cerrados)*100, 1) if cerrados else 0
    forecast_ponderado = sum(float(d.monto)*(d.probabilidad or 0)/100 for d in activos)
    por_etapa: dict = {}
    for d in deals:
        por_etapa.setdefault(d.etapa, {"count": 0, "monto": 0})
        por_etapa[d.etapa]["count"] += 1
        por_etapa[d.etapa]["monto"] += float(d.monto)
    return {
        "total_pipeline": round(total_pipeline, 2),
        "total_deals": len(activos),
        "tasa_conversion": tasa_conversion,
        "forecast_ponderado": round(forecast_ponderado, 2),
        "por_etapa": por_etapa,
    }


@router.get("/reportes/avanzados")
def reportes_avanzados(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    from datetime import timezone
    tenant_id = current_user["tenant_id"]
    deals   = db.query(Deal).filter(Deal.tenant_id == tenant_id).all()
    activos = [d for d in deals if d.etapa not in ("ganado","perdido")]
    ganados = [d for d in deals if d.etapa == "ganado"]
    cerrados= [d for d in deals if d.etapa in ("ganado","perdido")]

    total_pipeline  = sum(float(d.monto) for d in activos)
    tasa_conversion = round(len(ganados)/len(cerrados)*100, 1) if cerrados else 0

    ahora = datetime.now()
    deals_estancados = []
    for d in activos:
        uc = d.ultimo_contacto
        if uc:
            uc_naive = uc.replace(tzinfo=None) if uc.tzinfo else uc
            dias = (ahora - uc_naive).days
            if dias >= 7:
                deals_estancados.append({**deal_to_dict(d), "dias_sin_contacto": dias})

    top_oportunidades = sorted(
        [deal_to_dict(d) for d in activos], key=lambda x: x["monto"], reverse=True
    )[:10]

    orden = ["prospecto","calificado","propuesta","negociacion","ganado"]
    conteos: dict = {e: 0 for e in orden}
    for d in deals:
        if d.etapa in conteos:
            conteos[d.etapa] += 1
    embudo_conversion = [{"etapa": e, "count": conteos[e]} for e in orden]

    return {
        "total_pipeline": round(total_pipeline, 2),
        "tasa_conversion": tasa_conversion,
        "deals_estancados": deals_estancados,
        "top_oportunidades": top_oportunidades,
        "embudo_conversion": embudo_conversion,
    }
