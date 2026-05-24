"""PDF generation service using reportlab."""
import io
from datetime import datetime


def _build_pdf(canvas_fn):
    """Returns PDF bytes from a canvas-drawing function."""
    from reportlab.pdfgen import canvas
    from reportlab.lib.pagesizes import letter
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)
    canvas_fn(c)
    c.save()
    buf.seek(0)
    return buf.read()


def generar_liquidacion_pdf(liquidacion: dict) -> bytes:
    from reportlab.pdfgen import canvas
    from reportlab.lib.pagesizes import letter
    from reportlab.lib import colors

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)
    W, H = letter

    # Header
    c.setFillColor(colors.HexColor("#4f46e5"))
    c.rect(0, H - 80, W, 80, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 18)
    c.drawString(40, H - 45, "LIQUIDACIÓN DE SUELDO")
    c.setFont("Helvetica", 10)
    c.drawString(40, H - 62, "ConectaAI — Sistema de Gestión de Condominios")

    # Info
    c.setFillColor(colors.black)
    y = H - 120
    c.setFont("Helvetica-Bold", 12)
    c.drawString(40, y, liquidacion.get("trabajador_nombre", ""))
    y -= 18
    c.setFont("Helvetica", 10)
    c.drawString(40, y, f"RUT: {liquidacion.get('trabajador_rut', '-')}")
    c.drawString(250, y, f"Período: {liquidacion.get('periodo', '-')}")
    y -= 14
    c.drawString(40, y, f"Cargo: {liquidacion.get('cargo', '-')}")
    c.drawString(250, y, f"Fecha pago: {liquidacion.get('fecha_pago', '-')}")

    # Divider
    y -= 20
    c.setStrokeColor(colors.HexColor("#e5e7eb"))
    c.line(40, y, W - 40, y)

    # Haberes
    y -= 25
    c.setFont("Helvetica-Bold", 11)
    c.setFillColor(colors.HexColor("#059669"))
    c.drawString(40, y, "HABERES")
    y -= 18
    c.setFont("Helvetica", 10)
    c.setFillColor(colors.black)
    haberes = liquidacion.get("haberes", {})
    total_haberes = 0
    for nombre, monto in haberes.items():
        c.drawString(60, y, nombre)
        c.drawRightString(W - 40, y, f"${int(monto):,}")
        total_haberes += int(monto)
        y -= 16

    y -= 5
    c.setFont("Helvetica-Bold", 10)
    c.drawString(60, y, "Total Haberes")
    c.drawRightString(W - 40, y, f"${total_haberes:,}")

    # Descuentos
    y -= 28
    c.setFont("Helvetica-Bold", 11)
    c.setFillColor(colors.HexColor("#dc2626"))
    c.drawString(40, y, "DESCUENTOS")
    y -= 18
    c.setFont("Helvetica", 10)
    c.setFillColor(colors.black)
    descuentos = liquidacion.get("descuentos", {})
    total_desc = 0
    for nombre, monto in descuentos.items():
        c.drawString(60, y, nombre)
        c.drawRightString(W - 40, y, f"${int(monto):,}")
        total_desc += int(monto)
        y -= 16

    y -= 5
    c.setFont("Helvetica-Bold", 10)
    c.drawString(60, y, "Total Descuentos")
    c.drawRightString(W - 40, y, f"${total_desc:,}")

    # Total líquido
    y -= 30
    c.setFillColor(colors.HexColor("#4f46e5"))
    c.rect(40, y - 8, W - 80, 30, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 12)
    liquido = total_haberes - total_desc
    c.drawString(55, y + 8, "TOTAL LÍQUIDO A PAGAR")
    c.drawRightString(W - 55, y + 8, f"${liquido:,}")

    # Footer
    c.setFillColor(colors.HexColor("#9ca3af"))
    c.setFont("Helvetica", 8)
    c.drawString(40, 30, f"Generado el {datetime.now().strftime('%d/%m/%Y %H:%M')} — ConectaAI")

    c.save()
    buf.seek(0)
    return buf.read()


def generar_estado_cuenta_pdf(data: dict) -> bytes:
    from reportlab.pdfgen import canvas
    from reportlab.lib.pagesizes import letter
    from reportlab.lib import colors

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)
    W, H = letter

    # Header
    c.setFillColor(colors.HexColor("#4f46e5"))
    c.rect(0, H - 80, W, 80, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 18)
    c.drawString(40, H - 45, "ESTADO DE CUENTA")
    c.setFont("Helvetica", 10)
    c.drawString(40, H - 62, "ConectaAI — Portal Residente")

    y = H - 110
    c.setFillColor(colors.black)
    c.setFont("Helvetica-Bold", 12)
    c.drawString(40, y, data.get("residente_nombre", ""))
    y -= 18
    c.setFont("Helvetica", 10)
    c.drawString(40, y, f"Departamento: {data.get('departamento', '-')}")
    c.drawString(250, y, f"RUT: {data.get('rut', '-')}")

    y -= 30
    c.setFont("Helvetica-Bold", 11)
    c.drawString(40, y, "Gastos Comunes")

    y -= 18
    c.setFont("Helvetica-Bold", 9)
    c.setFillColor(colors.HexColor("#6b7280"))
    c.drawString(40, y, "MES")
    c.drawString(150, y, "CATEGORÍA")
    c.drawString(320, y, "MONTO")
    c.drawString(420, y, "ESTADO")

    c.setStrokeColor(colors.HexColor("#e5e7eb"))
    c.line(40, y - 4, W - 40, y - 4)

    y -= 20
    c.setFillColor(colors.black)
    c.setFont("Helvetica", 9)
    total = 0
    for g in data.get("gastos", []):
        c.drawString(40, y, str(g.get("mes", "-")))
        c.drawString(150, y, str(g.get("categoria", "-"))[:30])
        monto = int(g.get("monto", 0))
        c.drawString(320, y, f"${monto:,}")
        estado = g.get("estado", "pendiente")
        c.setFillColor(colors.HexColor("#059669") if estado == "pagado" else colors.HexColor("#dc2626"))
        c.drawString(420, y, estado)
        c.setFillColor(colors.black)
        if estado != "pagado":
            total += monto
        y -= 16
        if y < 80:
            c.showPage()
            y = H - 60

    y -= 10
    c.setFont("Helvetica-Bold", 10)
    c.setFillColor(colors.HexColor("#dc2626"))
    c.drawString(40, y, f"TOTAL DEUDA PENDIENTE: ${total:,}")

    c.setFillColor(colors.HexColor("#9ca3af"))
    c.setFont("Helvetica", 8)
    c.drawString(40, 30, f"Generado el {datetime.now().strftime('%d/%m/%Y %H:%M')} — ConectaAI")

    c.save()
    buf.seek(0)
    return buf.read()


def generar_reporte_asistencia_pdf(data: dict) -> bytes:
    from reportlab.pdfgen import canvas
    from reportlab.lib.pagesizes import letter
    from reportlab.lib import colors

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)
    W, H = letter

    c.setFillColor(colors.HexColor("#4f46e5"))
    c.rect(0, H - 80, W, 80, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 18)
    c.drawString(40, H - 45, "REPORTE DE ASISTENCIA")
    c.setFont("Helvetica", 10)
    c.drawString(40, H - 62, f"Período: {data.get('periodo', '-')} — ConectaAI")

    y = H - 110
    c.setFillColor(colors.black)
    c.setFont("Helvetica", 10)
    c.drawString(40, y, f"Total registros: {data.get('total', 0)}")
    c.drawString(200, y, f"Entradas: {data.get('entradas', 0)}")
    c.drawString(340, y, f"Salidas: {data.get('salidas', 0)}")
    c.drawString(460, y, f"Personas únicas: {data.get('identificadores_unicos', 0)}")

    y -= 30
    c.setFont("Helvetica-Bold", 9)
    c.setFillColor(colors.HexColor("#6b7280"))
    c.drawString(40, y, "FECHA")
    c.drawString(140, y, "IDENTIFICADOR")
    c.drawString(320, y, "EVENTO")
    c.drawString(420, y, "MÉTODO")
    c.line(40, y - 4, W - 40, y - 4)

    y -= 20
    c.setFont("Helvetica", 9)
    c.setFillColor(colors.black)
    for r in data.get("registros", [])[:100]:
        ts = r.get("timestamp", "")[:16] if r.get("timestamp") else "-"
        c.drawString(40, y, ts)
        c.drawString(140, y, str(r.get("identificador", "-"))[:25])
        evento = r.get("tipo_evento", "-")
        c.setFillColor(colors.HexColor("#059669") if evento == "entrada" else colors.HexColor("#2563eb"))
        c.drawString(320, y, evento)
        c.setFillColor(colors.black)
        c.drawString(420, y, str(r.get("metodo", "-")))
        y -= 15
        if y < 60:
            c.showPage()
            y = H - 60

    c.setFillColor(colors.HexColor("#9ca3af"))
    c.setFont("Helvetica", 8)
    c.drawString(40, 30, f"Generado el {datetime.now().strftime('%d/%m/%Y %H:%M')} — ConectaAI")

    c.save()
    buf.seek(0)
    return buf.read()
