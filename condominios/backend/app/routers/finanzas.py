from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.models.finanzas import GastoComun
from app.schemas.finanzas import GastoComunCreate, GastoComunUpdate, GastoComunResponse

router = APIRouter(prefix="/api/finanzas", tags=["Finanzas"])

@router.post("/gastos-comunes/", response_model=GastoComunResponse)
def crear_gasto_comun(gasto: GastoComunCreate, db: Session = Depends(get_db)):
    """Crear nuevo gasto común"""
    db_gasto = GastoComun(**gasto.model_dump())
    db.add(db_gasto)
    db.commit()
    db.refresh(db_gasto)
    return db_gasto

@router.get("/gastos-comunes/", response_model=List[GastoComunResponse])
def listar_gastos_comunes(
    mes: Optional[int] = None,
    anio: Optional[int] = None,
    estado: Optional[str] = None,
    departamento_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """Listar gastos comunes con filtros"""
    query = db.query(GastoComun)
    
    if mes:
        query = query.filter(GastoComun.mes == mes)
    if anio:
        query = query.filter(GastoComun.anio == anio)
    if estado:
        query = query.filter(GastoComun.estado == estado)
    if departamento_id:
        query = query.filter(GastoComun.departamento_id == departamento_id)
    
    gastos = query.order_by(GastoComun.created_at.desc()).offset(skip).limit(limit).all()
    return gastos

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
    metodo_pago: str,
    comprobante_url: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Registrar pago de gasto común"""
    from datetime import datetime
    
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
    
    return {"message": "Pago registrado exitosamente", "gasto": gasto}

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
def obtener_stats_morosidad(db: Session = Depends(get_db)):
    """Obtener estadísticas de morosidad"""
    total = db.query(GastoComun).count()
    pagados = db.query(GastoComun).filter(GastoComun.estado == "pagado").count()
    pendientes = db.query(GastoComun).filter(GastoComun.estado == "pendiente").count()
    atrasados = db.query(GastoComun).filter(GastoComun.estado == "atrasado").count()
    
    monto_pendiente = db.query(GastoComun).filter(
        GastoComun.estado.in_(["pendiente", "atrasado"])
    ).with_entities(db.func.sum(GastoComun.monto_total)).scalar() or 0
    
    return {
        "total_gastos": total,
        "pagados": pagados,
        "pendientes": pendientes,
        "atrasados": atrasados,
        "monto_pendiente": float(monto_pendiente),
        "tasa_pago": round((pagados / total * 100) if total > 0 else 0, 2)
    }

@router.get("/gastos-comunes/exportar/pdf")
def exportar_gastos_pdf(
    mes: Optional[int] = None,
    anio: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Exportar gastos comunes a PDF"""
    from reportlab.lib.pagesizes import letter, A4
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak
    from reportlab.lib.units import inch
    from io import BytesIO
    from fastapi.responses import StreamingResponse
    
    # Filtrar gastos
    query = db.query(GastoComun)
    if mes:
        query = query.filter(GastoComun.mes == mes)
    if anio:
        query = query.filter(GastoComun.anio == anio)
    
    gastos = query.order_by(GastoComun.departamento_id).all()
    
    # Crear PDF
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4)
    elements = []
    
    # Estilos
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=colors.HexColor('#667eea'),
        spaceAfter=30,
        alignment=1  # Center
    )
    
    # Título
    periodo = f"{mes}/{anio}" if mes and anio else "Todos los períodos"
    title = Paragraph(f"<b>Reporte de Gastos Comunes</b><br/>{periodo}", title_style)
    elements.append(title)
    elements.append(Spacer(1, 20))
    
    # Estadísticas generales
    total_monto = sum(g.monto_total for g in gastos)
    total_pagado = sum(g.monto_total for g in gastos if g.estado == "pagado")
    total_pendiente = sum(g.monto_total for g in gastos if g.estado in ["pendiente", "atrasado"])
    
    stats_data = [
        ["Métrica", "Valor"],
        ["Total Gastos", f"{len(gastos)}"],
        ["Monto Total", f"${total_monto:,.0f}"],
        ["Monto Pagado", f"${total_pagado:,.0f}"],
        ["Monto Pendiente", f"${total_pendiente:,.0f}"],
        ["Tasa Cobro", f"{(total_pagado/total_monto*100 if total_monto > 0 else 0):.1f}%"]
    ]
    
    stats_table = Table(stats_data, colWidths=[3*inch, 2*inch])
    stats_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#667eea')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 12),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
        ('GRID', (0, 0), (-1, -1), 1, colors.black)
    ]))
    
    elements.append(stats_table)
    elements.append(Spacer(1, 30))
    
    # Tabla de gastos detallada
    data = [["Depto", "Período", "Monto Base", "Multas", "Total", "Estado", "Vencimiento"]]
    
    for gasto in gastos:
        departamento = db.query(Departamento).filter(Departamento.id == gasto.departamento_id).first()
        depto_num = departamento.numero if departamento else str(gasto.departamento_id)
        
        estado_color = {
            'pagado': colors.green,
            'pendiente': colors.orange,
            'atrasado': colors.red
        }.get(gasto.estado, colors.gray)
        
        data.append([
            depto_num,
            f"{gasto.mes}/{gasto.anio}",
            f"${gasto.monto_base:,.0f}",
            f"${gasto.multas:,.0f}" if gasto.multas > 0 else "-",
            f"${gasto.monto_total:,.0f}",
            gasto.estado.upper(),
            gasto.fecha_vencimiento.strftime("%d/%m/%Y")
        ])
    
    table = Table(data, colWidths=[0.8*inch, 1*inch, 1.2*inch, 1*inch, 1.2*inch, 1*inch, 1.2*inch])
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
    
    # Alternar colores de filas
    for i in range(1, len(data)):
        if i % 2 == 0:
            table.setStyle(TableStyle([
                ('BACKGROUND', (0, i), (-1, i), colors.HexColor('#f0f0f0'))
            ]))
    
    elements.append(table)
    
    # Pie de página
    elements.append(Spacer(1, 30))
    footer = Paragraph(
        f"<i>Generado el {datetime.now().strftime('%d/%m/%Y %H:%M')} | ConectaAI Condominios</i>",
        styles['Normal']
    )
    elements.append(footer)
    
    # Construir PDF
    doc.build(elements)
    buffer.seek(0)
    
    filename = f"gastos_comunes_{anio}_{mes}.pdf" if mes and anio else "gastos_comunes_todos.pdf"
    
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.get("/gastos-comunes/exportar/excel")
def exportar_gastos_excel(
    mes: Optional[int] = None,
    anio: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Exportar gastos comunes a Excel"""
    import pandas as pd
    from io import BytesIO
    from fastapi.responses import StreamingResponse
    
    # Filtrar gastos
    query = db.query(GastoComun)
    if mes:
        query = query.filter(GastoComun.mes == mes)
    if anio:
        query = query.filter(GastoComun.anio == anio)
    
    gastos = query.order_by(GastoComun.departamento_id).all()
    
    # Preparar datos
    data = []
    for gasto in gastos:
        departamento = db.query(Departamento).filter(Departamento.id == gasto.departamento_id).first()
        depto_info = ""
        propietario_info = ""
        
        if departamento:
            depto_info = f"Torre {departamento.piso.torre.nombre if hasattr(departamento, 'piso') else ''} - Depto {departamento.numero}"
            
            if departamento.propietario_id:
                propietario = db.query(Persona).filter(Persona.id == departamento.propietario_id).first()
                if propietario:
                    propietario_info = f"{propietario.nombre_completo} ({propietario.email})"
        
        # Extraer desglose
        desglose = ""
        if gasto.detalle:
            desglose = "\n".join([f"{item.get('concepto', '')}: ${item.get('monto', 0):,.0f}" for item in gasto.detalle])
        
        data.append({
            "Departamento": departamento.numero if departamento else gasto.departamento_id,
            "Ubicación": depto_info,
            "Propietario": propietario_info,
            "Mes": gasto.mes,
            "Año": gasto.anio,
            "Monto Base": gasto.monto_base,
            "Multas": gasto.multas,
            "Intereses": gasto.intereses,
            "Otros Cargos": gasto.otros_cargos,
            "Descuentos": gasto.descuentos,
            "TOTAL": gasto.monto_total,
            "Estado": gasto.estado.upper(),
            "Fecha Vencimiento": gasto.fecha_vencimiento.strftime("%d/%m/%Y"),
            "Fecha Pago": gasto.fecha_pago.strftime("%d/%m/%Y") if gasto.fecha_pago else "-",
            "Método Pago": gasto.metodo_pago or "-",
            "Desglose": desglose,
            "Observaciones": gasto.observaciones or ""
        })
    
    # Crear DataFrame
    df = pd.DataFrame(data)
    
    # Crear Excel con múltiples hojas
    buffer = BytesIO()
    with pd.ExcelWriter(buffer, engine='openpyxl') as writer:
        # Hoja 1: Datos detallados
        df.to_excel(writer, sheet_name='Gastos Detallados', index=False)
        
        # Hoja 2: Resumen por estado
        resumen_estado = df.groupby('Estado').agg({
            'Departamento': 'count',
            'TOTAL': 'sum'
        }).rename(columns={'Departamento': 'Cantidad', 'TOTAL': 'Monto Total'})
        resumen_estado.to_excel(writer, sheet_name='Resumen por Estado')
        
        # Hoja 3: Resumen por departamento
        resumen_depto = df.groupby('Departamento').agg({
            'TOTAL': ['sum', 'mean', 'count']
        })
        resumen_depto.columns = ['Total Cobrado', 'Promedio', 'Cantidad Gastos']
        resumen_depto.to_excel(writer, sheet_name='Resumen por Depto')
        
        # Hoja 4: Morosos
        morosos = df[df['Estado'].isin(['PENDIENTE', 'ATRASADO'])]
        if not morosos.empty:
            morosos.to_excel(writer, sheet_name='Morosos', index=False)
        
        # Formatear anchos de columna
        worksheet = writer.sheets['Gastos Detallados']
        for column in worksheet.columns:
            max_length = 0
            column_letter = column[0].column_letter
            for cell in column:
                try:
                    if len(str(cell.value)) > max_length:
                        max_length = len(cell.value)
                except:
                    pass
            adjusted_width = min(max_length + 2, 50)
            worksheet.column_dimensions[column_letter].width = adjusted_width
    
    buffer.seek(0)
    
    filename = f"gastos_comunes_{anio}_{mes}.xlsx" if mes and anio else "gastos_comunes_todos.xlsx"
    
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.get("/gastos-comunes/{gasto_id}/pdf-individual")
def generar_pdf_individual(gasto_id: int, db: Session = Depends(get_db)):
    """Generar PDF individual de un gasto común"""
    from reportlab.lib.pagesizes import letter
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
    from reportlab.lib.units import inch
    from io import BytesIO
    from fastapi.responses import StreamingResponse
    
    gasto = db.query(GastoComun).filter(GastoComun.id == gasto_id).first()
    if not gasto:
        raise HTTPException(status_code=404, detail="Gasto común no encontrado")
    
    departamento = db.query(Departamento).filter(Departamento.id == gasto.departamento_id).first()
    propietario = None
    if departamento and departamento.propietario_id:
        propietario = db.query(Persona).filter(Persona.id == departamento.propietario_id).first()
    
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter)
    elements = []
    styles = getSampleStyleSheet()
    
    # Título
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=20,
        textColor=colors.HexColor('#667eea'),
        alignment=1
    )
    
    elements.append(Paragraph("<b>GASTO COMÚN</b>", title_style))
    elements.append(Paragraph("Condominio Las Flores", styles['Normal']))
    elements.append(Spacer(1, 30))
    
    # Información del propietario
    if propietario:
        info_data = [
            ["Propietario:", propietario.nombre_completo],
            ["RUT:", propietario.rut],
            ["Email:", propietario.email],
            ["Teléfono:", propietario.telefono],
            ["Departamento:", departamento.numero if departamento else "-"],
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
    
    # Período
    periodo_data = [
        ["Período:", f"{gasto.mes}/{gasto.anio}"],
        ["Vencimiento:", gasto.fecha_vencimiento.strftime("%d/%m/%Y")],
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
    
    # Desglose
    elements.append(Paragraph("<b>DESGLOSE DE GASTOS</b>", styles['Heading2']))
    elements.append(Spacer(1, 10))
    
    desglose_data = [["Concepto", "Monto"]]
    
    if gasto.detalle:
        for item in gasto.detalle:
            desglose_data.append([
                item.get('concepto', ''),
                f"${item.get('monto', 0):,.0f}"
            ])
    
    desglose_data.append(["Monto Base", f"${gasto.monto_base:,.0f}"])
    
    if gasto.multas > 0:
        desglose_data.append(["Multas", f"${gasto.multas:,.0f}"])
    if gasto.intereses > 0:
        desglose_data.append(["Intereses", f"${gasto.intereses:,.0f}"])
    if gasto.otros_cargos > 0:
        desglose_data.append(["Otros Cargos", f"${gasto.otros_cargos:,.0f}"])
    if gasto.descuentos > 0:
        desglose_data.append(["Descuentos", f"-${gasto.descuentos:,.0f}"])
    
    desglose_data.append(["", ""])
    desglose_data.append(["TOTAL A PAGAR", f"${gasto.monto_total:,.0f}"])
    
    desglose_table = Table(desglose_data, colWidths=[4*inch, 2*inch])
    desglose_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#667eea')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (0, -1), 'LEFT'),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
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
    
    if gasto.observaciones:
        elements.append(Spacer(1, 20))
        elements.append(Paragraph(f"<b>Observaciones:</b> {gasto.observaciones}", styles['Normal']))
    
    elements.append(Spacer(1, 40))
    elements.append(Paragraph(
        f"<i>Generado el {datetime.now().strftime('%d/%m/%Y %H:%M')}</i>",
        styles['Normal']
    ))
    
    doc.build(elements)
    buffer.seek(0)
    
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=gasto_comun_{gasto.mes}_{gasto.anio}_depto_{departamento.numero if departamento else gasto.departamento_id}.pdf"}
    )
