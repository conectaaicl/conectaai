from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from app.core.database import get_db
from app.models.finanzas import GastoComun
from app.models.estructura import Departamento, Piso, Torre
from app.models.condominio import Condominio
from app.models.persona import Persona
from app.schemas.finanzas import GastoComunCreate, GastoComunUpdate, GastoComunResponse


import os as _os

def _persona_de_depto(db, depto_id, tenant_id):
    from sqlalchemy import text as _t
    try:
        row = db.execute(_t(
            "SELECT d.numero, t.condominio_id FROM departamentos d "
            "JOIN pisos p ON p.id=d.piso_id JOIN torres t ON t.id=p.torre_id WHERE d.id=:did"
        ), {"did": depto_id}).fetchone()
        if not row: return None, None, None
        dnum, cid = str(row._mapping["numero"]), str(row._mapping["condominio_id"])
        p = db.execute(_t(
            "SELECT id,nombre_completo,email,telefono FROM personas "
            "WHERE tenant_id=:tid AND estado='activo' "
            "AND datos_contacto->>'departamento'=:dn "
            "AND datos_contacto->>'condominio_id'=:cid LIMIT 1"
        ), {"tid": tenant_id, "dn": dnum, "cid": cid}).fetchone()
        return (dict(p._mapping) if p else None), dnum, int(cid)
    except Exception:
        return None, None, None

router = APIRouter(prefix="/api/finanzas", tags=["Finanzas"])

CATEGORIAS_PREDEFINIDAS = [
    {"id": "suministros", "label": "Suministros", "items": [
        "Gas", "Electricidad", "Agua / Alcantarillado", "Internet / Telefonía"
    ]},
    {"id": "mantencion", "label": "Mantención y Reparaciones", "items": [
        "Mantención áreas comunes", "Reparaciones", "Mantención ascensor",
        "Mantención piscina", "Limpieza", "Jardinería"
    ]},
    {"id": "fondos", "label": "Fondos y Reservas", "items": [
        "Reserva fondo común", "Reserva fondo imprevistos", "Seguro edificio",
        "Cobro reserva espacio común"
    ]},
    {"id": "personal", "label": "Personal", "items": [
        "Sueldo personal", "Sueldo conserje", "Sueldo administrador", "Horas extra", "Finiquito", "Indexación sueldos"
    ]},
    {"id": "administracion", "label": "Administración", "items": [
        "Gastos administración", "Honorarios administrador", "Gastos notariales", "Otros gastos"
    ]}
]

@router.get("/categorias")
def obtener_categorias():
    """Retorna lista de categorías predefinidas para gastos comunes"""
    return CATEGORIAS_PREDEFINIDAS


@router.get("/resumen-departamentos")
def resumen_por_departamento(
    tenant_id: int = 1,
    periodo: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Retorna resumen de gastos comunes por departamento para un período YYYY-MM"""
    mes = None
    anio = None
    if periodo:
        try:
            parts = periodo.split("-")
            anio = int(parts[0])
            mes = int(parts[1])
        except Exception:
            raise HTTPException(status_code=400, detail="Formato de período inválido. Use YYYY-MM")

    # Get all active departments for this tenant
    depts = (
        db.query(Departamento)
        .filter(Departamento.tenant_id == tenant_id)
        .all()
    )
    dept_ids = {d.id: d for d in depts}
    total_depts = len(depts)

    # Get gastos for period
    query = db.query(GastoComun)
    if mes:
        query = query.filter(GastoComun.mes == mes)
    if anio:
        query = query.filter(GastoComun.anio == anio)
    gastos = query.all()

    # Filter gastos that belong to this tenant's departments
    tenant_gastos = [
        g for g in gastos
        if g.departamento_id is None or g.departamento_id in dept_ids
    ]

    # Build dept breakdown
    dept_items: dict = {d.id: [] for d in depts}
    dept_gastos_estados: dict = {d.id: set() for d in depts}

    for gasto in tenant_gastos:
        desglose = gasto.detalle or []
        if not desglose:
            desglose = [{"concepto": gasto.descripcion or "Gasto común", "categoria": gasto.categoria, "monto": gasto.monto_total}]

        if gasto.departamento_id is not None:
            if gasto.departamento_id in dept_items:
                for item in desglose:
                    dept_items[gasto.departamento_id].append({
                        "concepto": item.get("concepto", ""),
                        "categoria": item.get("categoria") or gasto.categoria,
                        "monto": float(item.get("monto", 0)),
                        "gasto_id": gasto.id,
                        "estado": gasto.estado
                    })
                dept_gastos_estados[gasto.departamento_id].add(gasto.estado)
        else:
            if total_depts > 0:
                for dept_id in dept_items:
                    for item in desglose:
                        dept_items[dept_id].append({
                            "concepto": item.get("concepto", ""),
                            "categoria": item.get("categoria") or gasto.categoria,
                            "monto": round(float(item.get("monto", 0)) / total_depts, 0),
                            "gasto_id": gasto.id,
                            "estado": gasto.estado
                        })
                    dept_gastos_estados[dept_id].add(gasto.estado)

    # Build response
    departamentos_result = []
    total_general = 0.0
    total_pagado_general = 0.0

    for dept in depts:
        items = dept_items[dept.id]
        total_dept = sum(i["monto"] for i in items)

        piso = db.query(Piso).filter(Piso.id == dept.piso_id).first()
        torre = db.query(Torre).filter(Torre.id == piso.torre_id).first() if piso else None

        residente_nombre = None
        if dept.residente_id:
            persona = db.query(Persona).filter(Persona.id == dept.residente_id).first()
            if persona:
                residente_nombre = persona.nombre_completo
        elif dept.propietario_id:
            persona = db.query(Persona).filter(Persona.id == dept.propietario_id).first()
            if persona:
                residente_nombre = persona.nombre_completo

        estados = dept_gastos_estados.get(dept.id, set())
        is_pagado = len(estados) > 0 and all(e == "pagado" for e in estados)

        total_general += total_dept
        if is_pagado:
            total_pagado_general += total_dept

        departamentos_result.append({
            "id": dept.id,
            "numero": dept.numero,
            "piso": piso.numero if piso else None,
            "torre": torre.nombre if torre else None,
            "residente": residente_nombre,
            "items": items,
            "total": total_dept,
            "pagado": is_pagado
        })

    return {
        "periodo": periodo,
        "departamentos": departamentos_result,
        "total_general": total_general,
        "total_pagado": total_pagado_general
    }


@router.post("/gastos-comunes", response_model=GastoComunResponse)
def crear_gasto_comun(gasto: GastoComunCreate, db: Session = Depends(get_db)):
    """Crear nuevo gasto común"""
    gasto_data = gasto.model_dump()
    if "detalle" in gasto_data:
        gasto_data["detalle"] = [d if isinstance(d, dict) else d for d in gasto_data["detalle"]]
    db_gasto = GastoComun(**gasto_data)
    db.add(db_gasto)
    db.commit()
    db.refresh(db_gasto)
    try:
        from app.services.email import send_gasto_notificacion
        import asyncio
        if db_gasto.departamento_id:
            depto = db.query(Departamento).filter(Departamento.id == db_gasto.departamento_id).first()
            if depto and depto.propietario_id:
                persona = db.query(Persona).filter(Persona.id == depto.propietario_id).first()
                if persona and persona.email:
                    asyncio.create_task(send_gasto_notificacion(
                        persona.email, persona.nombre_completo,
                        db_gasto.mes, db_gasto.anio, float(db_gasto.monto_total),
                        db_gasto.fecha_vencimiento.strftime("%d/%m/%Y") if db_gasto.fecha_vencimiento else "N/A"
                    ))
    except Exception:
        pass
    return db_gasto

@router.get("/gastos-comunes")
def listar_gastos_comunes(
    mes: Optional[int] = None,
    anio: Optional[int] = None,
    estado: Optional[str] = None,
    departamento_id: Optional[int] = None,
    tenant_id: int = 1,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """Listar gastos comunes enriquecido con info residente"""
    from sqlalchemy import text as _t
    query = db.query(GastoComun)
    valid = db.execute(_t(
        "SELECT d.id FROM departamentos d JOIN pisos p ON p.id=d.piso_id "
        "JOIN torres t ON t.id=p.torre_id JOIN condominios c ON c.id=t.condominio_id "
        "WHERE c.tenant_id=:tid"
    ), {"tid": tenant_id}).fetchall()
    valid_ids = [r._mapping["id"] for r in valid]
    query = query.filter(
        (GastoComun.departamento_id == None) | GastoComun.departamento_id.in_(valid_ids)
    )
    if mes:
        query = query.filter(GastoComun.mes == mes)
    if anio:
        query = query.filter(GastoComun.anio == anio)
    if estado:
        query = query.filter(GastoComun.estado == estado)
    if departamento_id:
        query = query.filter(GastoComun.departamento_id == departamento_id)
    gastos = query.order_by(GastoComun.created_at.desc()).offset(skip).limit(limit).all()
    result = []
    for g in gastos:
        d = {c.name: getattr(g, c.name) for c in g.__table__.columns}
        for k, v in d.items():
            if hasattr(v, "isoformat"): d[k] = v.isoformat()
            elif hasattr(v, "__float__"):
                try: d[k] = float(v)
                except: pass
        persona, dnum, _ = _persona_de_depto(db, g.departamento_id, tenant_id)
        d["depto_numero"] = dnum
        d["persona_nombre"] = persona["nombre_completo"] if persona else None
        d["persona_email"] = persona["email"] if persona else None
        result.append(d)
    return result

@router.get("/gastos-comunes/{gasto_id}", response_model=GastoComunResponse)
def obtener_gasto_comun(gasto_id: int, db: Session = Depends(get_db)):
    """Obtener gasto común por ID"""
    gasto = db.query(GastoComun).filter(GastoComun.id == gasto_id).first()
    if not gasto:
        raise HTTPException(status_code=404, detail="Gasto común no encontrado")
    return gasto

@router.put("/gastos-comunes/{gasto_id}", response_model=GastoComunResponse)
def actualizar_gasto_comun(
    gasto_id: int,
    gasto_update: GastoComunUpdate,
    db: Session = Depends(get_db)
):
    """Actualizar gasto común"""
    gasto = db.query(GastoComun).filter(GastoComun.id == gasto_id).first()
    if not gasto:
        raise HTTPException(status_code=404, detail="Gasto común no encontrado")
    for field, value in gasto_update.model_dump(exclude_unset=True).items():
        setattr(gasto, field, value)
    db.commit()
    db.refresh(gasto)
    return gasto

@router.post("/gastos-comunes/{gasto_id}/pagar")
def registrar_pago(
    gasto_id: int,
    metodo_pago: str = "transferencia",
    comprobante_url: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Registrar pago de gasto común"""
    gasto = db.query(GastoComun).filter(GastoComun.id == gasto_id).first()
    if not gasto:
        raise HTTPException(status_code=404, detail="Gasto común no encontrado")
    gasto.estado = "pagado"
    gasto.fecha_pago = datetime.now()
    gasto.metodo_pago = metodo_pago
    if comprobante_url:
        gasto.comprobante_url = comprobante_url
    db.commit()
    db.refresh(gasto)
    return {"message": "Pago registrado exitosamente", "gasto": gasto.id}

@router.delete("/gastos-comunes/{gasto_id}")
def eliminar_gasto_comun(gasto_id: int, db: Session = Depends(get_db)):
    """Eliminar gasto común"""
    gasto = db.query(GastoComun).filter(GastoComun.id == gasto_id).first()
    if not gasto:
        raise HTTPException(status_code=404, detail="Gasto común no encontrado")
    db.delete(gasto)
    db.commit()
    return {"message": "Gasto común eliminado"}

@router.get("/stats/morosidad")
def obtener_stats_morosidad(tenant_id: int = 1, db: Session = Depends(get_db)):
    """Obtener estadísticas de morosidad"""
    from sqlalchemy import func as sqlfunc
    total = db.query(GastoComun).count()
    pagados = db.query(GastoComun).filter(GastoComun.estado == "pagado").count()
    pendientes = db.query(GastoComun).filter(GastoComun.estado == "pendiente").count()
    atrasados = db.query(GastoComun).filter(GastoComun.estado == "atrasado").count()
    monto_pendiente = db.query(sqlfunc.sum(GastoComun.monto_total)).filter(
        GastoComun.estado.in_(["pendiente", "atrasado"])
    ).scalar() or 0
    monto_pagado = db.query(sqlfunc.sum(GastoComun.monto_total)).filter(
        GastoComun.estado == "pagado"
    ).scalar() or 0
    return {
        "total_gastos": total,
        "pagados": pagados,
        "pendientes": pendientes,
        "atrasados": atrasados,
        "monto_pendiente": float(monto_pendiente),
        "monto_pagado": float(monto_pagado),
        "tasa_pago": round((pagados / total * 100) if total > 0 else 0, 2)
    }


@router.post("/gastos-comunes/enviar-masivo")
def enviar_gastos_masivo(mes: int, anio: int, tenant_id: int, db: Session = Depends(get_db)):
    from sqlalchemy import text as _t
    import httpx as _hx
    valid = db.execute(_t(
        "SELECT d.id FROM departamentos d JOIN pisos p ON p.id=d.piso_id "
        "JOIN torres t ON t.id=p.torre_id JOIN condominios c ON c.id=t.condominio_id "
        "WHERE c.tenant_id=:tid"
    ), {"tid": tenant_id}).fetchall()
    valid_ids = [r._mapping["id"] for r in valid]
    gastos = db.query(GastoComun).filter(
        GastoComun.mes == mes, GastoComun.anio == anio,
        GastoComun.departamento_id.in_(valid_ids)
    ).all()
    enviados, errores = 0, []
    for g in gastos:
        persona, dnum, _ = _persona_de_depto(db, g.departamento_id, tenant_id)
        if not persona or not persona.get("email"):
            errores.append({"gasto_id": g.id, "razon": "sin email"}); continue
        html = (
            f"<h2>Gasto Común {g.mes}/{g.anio}</h2>"
            f"<p>Estimado/a <b>{persona['nombre_completo']}</b>,</p>"
            f"<table><tr><td><b>Depto</b></td><td>{dnum}</td></tr>"
            f"<tr><td><b>Categoría</b></td><td>{g.categoria or 'General'}</td></tr>"
            f"<tr><td><b>Monto</b></td><td>${g.monto_total:,.0f}</td></tr>"
            f"<tr><td><b>Vencimiento</b></td><td>{g.fecha_vencimiento}</td></tr>"
            f"<tr><td><b>Estado</b></td><td>{g.estado}</td></tr></table>"
        )
        try:
            _hx.post(_os.getenv("MAIL_API_URL", "http://localhost:3004/api/send"),
                json={"to": persona["email"], "from": "condominios@conectaai.cl",
                      "subject": f"Gasto Común {g.mes}/{g.anio} - Depto {dnum}", "html": html},
                headers={"Authorization": "Bearer " + _os.getenv("MAIL_API_KEY", "")}, timeout=5)
            enviados += 1
        except Exception as e:
            errores.append({"gasto_id": g.id, "razon": str(e)})
    return {"total": len(gastos), "enviados": enviados, "errores": errores}


@router.post("/gastos-comunes/{gasto_id}/enviar")
def enviar_gasto_individual(gasto_id: int, tenant_id: int, db: Session = Depends(get_db)):
    import httpx as _hx
    gasto = db.query(GastoComun).filter(GastoComun.id == gasto_id).first()
    if not gasto:
        raise HTTPException(404, "Gasto no encontrado")
    persona, dnum, _ = _persona_de_depto(db, gasto.departamento_id, tenant_id)
    if not persona:
        raise HTTPException(400, "No hay residente registrado en este departamento")
    if not persona.get("email"):
        raise HTTPException(400, "El residente no tiene email registrado")
    html = (
        f"<h2>Gasto Común {gasto.mes}/{gasto.anio}</h2>"
        f"<p>Estimado/a <b>{persona['nombre_completo']}</b>,</p>"
        f"<table><tr><td><b>Depto</b></td><td>{dnum}</td></tr>"
        f"<tr><td><b>Categoría</b></td><td>{gasto.categoria or 'General'}</td></tr>"
        f"<tr><td><b>Descripción</b></td><td>{gasto.descripcion or ''}</td></tr>"
        f"<tr><td><b>Monto</b></td><td>${gasto.monto_total:,.0f}</td></tr>"
        f"<tr><td><b>Vencimiento</b></td><td>{gasto.fecha_vencimiento}</td></tr>"
        f"<tr><td><b>Estado</b></td><td>{gasto.estado}</td></tr></table>"
    )
    try:
        _hx.post(_os.getenv("MAIL_API_URL", "http://localhost:3004/api/send"),
            json={"to": persona["email"], "from": "condominios@conectaai.cl",
                  "subject": f"Gasto Común {gasto.mes}/{gasto.anio} - Depto {dnum}", "html": html},
            headers={"Authorization": "Bearer " + _os.getenv("MAIL_API_KEY", "")}, timeout=5)
    except Exception as e:
        raise HTTPException(500, f"Error enviando email: {e}")
    return {"ok": True, "enviado_a": persona["email"], "nombre": persona["nombre_completo"]}

@router.get("/gastos-comunes/exportar/pdf")
def exportar_gastos_pdf(
    mes: Optional[int] = None,
    anio: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Exportar gastos comunes a PDF"""
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.units import inch
    from io import BytesIO
    from fastapi.responses import StreamingResponse

    query = db.query(GastoComun)
    if mes:
        query = query.filter(GastoComun.mes == mes)
    if anio:
        query = query.filter(GastoComun.anio == anio)
    gastos = query.order_by(GastoComun.departamento_id).all()

    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4)
    elements = []
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'CustomTitle', parent=styles['Heading1'], fontSize=24,
        textColor=colors.HexColor('#667eea'), spaceAfter=30, alignment=1
    )
    periodo_str = f"{mes}/{anio}" if mes and anio else "Todos los períodos"
    elements.append(Paragraph(f"<b>Reporte de Gastos Comunes</b><br/>{periodo_str}", title_style))
    elements.append(Spacer(1, 20))

    total_monto = sum(g.monto_total for g in gastos)
    total_pagado = sum(g.monto_total for g in gastos if g.estado == "pagado")
    stats_data = [
        ["Métrica", "Valor"],
        ["Total Gastos", f"{len(gastos)}"],
        ["Monto Total", f"${total_monto:,.0f}"],
        ["Monto Pagado", f"${total_pagado:,.0f}"],
        ["Monto Pendiente", f"${total_monto - total_pagado:,.0f}"],
    ]
    stats_table = Table(stats_data, colWidths=[3*inch, 2*inch])
    stats_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#667eea')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
        ('GRID', (0, 0), (-1, -1), 1, colors.black)
    ]))
    elements.append(stats_table)
    elements.append(Spacer(1, 30))

    data = [["Depto", "Período", "Categoría", "Total", "Estado", "Vencimiento"]]
    for gasto in gastos:
        data.append([
            str(gasto.departamento_id) if gasto.departamento_id else "Todos",
            f"{gasto.mes}/{gasto.anio}",
            gasto.categoria or "-",
            f"${gasto.monto_total:,.0f}",
            gasto.estado.upper(),
            gasto.fecha_vencimiento.strftime("%d/%m/%Y") if gasto.fecha_vencimiento else "-"
        ])
    table = Table(data, colWidths=[0.8*inch, 1*inch, 1.5*inch, 1.2*inch, 1*inch, 1.2*inch])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#667eea')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.white),
        ('GRID', (0, 0), (-1, -1), 1, colors.grey),
        ('FONTSIZE', (0, 1), (-1, -1), 8),
    ]))
    elements.append(table)
    elements.append(Spacer(1, 30))
    elements.append(Paragraph(
        f"<i>Generado el {datetime.now().strftime('%d/%m/%Y %H:%M')} | ConectaAI Condominios</i>",
        styles['Normal']
    ))
    doc.build(elements)
    buffer.seek(0)
    filename = f"gastos_comunes_{anio}_{mes}.pdf" if mes and anio else "gastos_comunes_todos.pdf"
    return StreamingResponse(
        buffer, media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.get("/gastos-comunes/{gasto_id}/pdf-individual")
def generar_pdf_individual(gasto_id: int, db: Session = Depends(get_db)):
    """Generar PDF individual de un gasto común"""
    from reportlab.lib.pagesizes import letter
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.units import inch
    from io import BytesIO
    from fastapi.responses import StreamingResponse

    gasto = db.query(GastoComun).filter(GastoComun.id == gasto_id).first()
    if not gasto:
        raise HTTPException(status_code=404, detail="Gasto común no encontrado")

    departamento = None
    propietario = None
    if gasto.departamento_id:
        departamento = db.query(Departamento).filter(Departamento.id == gasto.departamento_id).first()
        if departamento and departamento.propietario_id:
            propietario = db.query(Persona).filter(Persona.id == departamento.propietario_id).first()

    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter)
    elements = []
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'CustomTitle', parent=styles['Heading1'], fontSize=20,
        textColor=colors.HexColor('#667eea'), alignment=1
    )
    elements.append(Paragraph("<b>GASTO COMÚN</b>", title_style))
    elements.append(Spacer(1, 30))

    if propietario and departamento:
        info_data = [
            ["Propietario:", propietario.nombre_completo],
            ["Departamento:", departamento.numero],
        ]
        info_table = Table(info_data, colWidths=[2*inch, 4*inch])
        info_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#f0f0f0')),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey)
        ]))
        elements.append(info_table)
        elements.append(Spacer(1, 20))

    periodo_data = [
        ["Período:", f"{gasto.mes}/{gasto.anio}"],
        ["Categoría:", gasto.categoria or "-"],
        ["Vencimiento:", gasto.fecha_vencimiento.strftime("%d/%m/%Y") if gasto.fecha_vencimiento else "-"],
        ["Estado:", gasto.estado.upper()],
    ]
    periodo_table = Table(periodo_data, colWidths=[2*inch, 4*inch])
    periodo_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#f0f0f0')),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey)
    ]))
    elements.append(periodo_table)
    elements.append(Spacer(1, 30))

    elements.append(Paragraph("<b>DESGLOSE DE GASTOS</b>", styles['Heading2']))
    elements.append(Spacer(1, 10))

    desglose_data = [["Concepto", "Categoría", "Monto"]]
    if gasto.detalle:
        for item in gasto.detalle:
            desglose_data.append([
                item.get('concepto', ''),
                item.get('categoria', '-'),
                f"${item.get('monto', 0):,.0f}"
            ])
    desglose_data.append(["", "", ""])
    desglose_data.append(["TOTAL A PAGAR", "", f"${gasto.monto_total:,.0f}"])

    desglose_table = Table(desglose_data, colWidths=[3*inch, 1.5*inch, 1.5*inch])
    desglose_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#667eea')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (0, -1), 'LEFT'),
        ('ALIGN', (2, 0), (2, -1), 'RIGHT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 12),
        ('GRID', (0, 0), (-1, -2), 0.5, colors.grey),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#667eea')),
        ('TEXTCOLOR', (0, -1), (-1, -1), colors.whitesmoke),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, -1), (-1, -1), 14),
        ('LINEABOVE', (0, -1), (-1, -1), 2, colors.black)
    ]))
    elements.append(desglose_table)
    elements.append(Spacer(1, 40))
    elements.append(Paragraph(
        f"<i>Generado el {datetime.now().strftime('%d/%m/%Y %H:%M')}</i>",
        styles['Normal']
    ))
    doc.build(elements)
    buffer.seek(0)
    depto_num = departamento.numero if departamento else str(gasto.departamento_id or "todos")
    return StreamingResponse(
        buffer, media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=gasto_comun_{gasto.mes}_{gasto.anio}_depto_{depto_num}.pdf"}
    )
