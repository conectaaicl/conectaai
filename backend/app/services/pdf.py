from io import BytesIO
from datetime import datetime

from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor, black

IVA_RATE = 0.19


def generate_quote_pdf(deal: dict) -> bytes:
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4

    primary = HexColor("#0F172A")   # slate-900
    secondary = HexColor("#334155") # slate-700

    # =========================
    # HEADER
    # =========================
    c.setFillColor(primary)
    c.setFont("Helvetica-Bold", 18)
    c.drawString(20 * mm, height - 25 * mm, "ConectaAI")

    c.setFont("Helvetica", 10)
    c.setFillColor(secondary)
    c.drawString(20 * mm, height - 32 * mm, "Cotización Comercial")

    c.drawRightString(
        width - 20 * mm,
        height - 25 * mm,
        f"Fecha: {datetime.utcnow().strftime('%d/%m/%Y')}",
    )

    c.line(20 * mm, height - 36 * mm, width - 20 * mm, height - 36 * mm)

    # =========================
    # DATOS DEL DEAL
    # =========================
    y = height - 50 * mm
    c.setFont("Helvetica", 11)

    c.drawString(20 * mm, y, f"Deal ID: {deal['id']}")
    y -= 8 * mm

    c.drawString(20 * mm, y, f"Descripción: {deal['title']}")
    y -= 8 * mm

    c.drawString(20 * mm, y, f"Estado: {deal.get('status', '-')}")
    y -= 12 * mm

    # =========================
    # TABLA DE VALORES
    # =========================
    amount = deal.get("amount") or 0
    currency = deal.get("currency", "CLP")

    iva = round(amount * IVA_RATE, 2)
    total = round(amount + iva, 2)

    c.setFont("Helvetica-Bold", 11)
    c.drawString(20 * mm, y, "Detalle")
    c.drawRightString(width - 20 * mm, y, "Monto")
    y -= 6 * mm

    c.line(20 * mm, y, width - 20 * mm, y)
    y -= 8 * mm

    c.setFont("Helvetica", 11)
    c.drawString(20 * mm, y, "Subtotal")
    c.drawRightString(width - 20 * mm, y, f"{amount:,.0f} {currency}")
    y -= 8 * mm

    c.drawString(20 * mm, y, "IVA (19%)")
    c.drawRightString(width - 20 * mm, y, f"{iva:,.0f} {currency}")
    y -= 8 * mm

    c.setFont("Helvetica-Bold", 12)
    c.drawString(20 * mm, y, "TOTAL")
    c.drawRightString(width - 20 * mm, y, f"{total:,.0f} {currency}")
    y -= 14 * mm

    # =========================
    # NOTA LEGAL
    # =========================
    c.setFont("Helvetica-Oblique", 9)
    c.setFillColor(black)
    c.drawString(
        20 * mm,
        y,
        "Esta cotización tiene una validez de 15 días y no constituye factura.",
    )

    # =========================
    # FOOTER
    # =========================
    c.setFont("Helvetica", 8)
    c.drawRightString(
        width - 20 * mm,
        15 * mm,
        "© ConectaAI — Plataforma de Ventas Inteligente",
    )

    c.showPage()
    c.save()

    buffer.seek(0)
    return buffer.read()
