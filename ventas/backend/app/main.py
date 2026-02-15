from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, Literal, List
from datetime import datetime, timedelta
from io import BytesIO
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import inch

app = FastAPI(title="Backend Ventas ConectaAI v10.1")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# DATOS MOCK
DEALS_MOCK = [
    {"id": 1, "cliente": "Empresa ABC", "monto": 5000000, "etapa": "negociacion", "origen": "linkedin", "fecha": "2026-01-08", "contacto": "Juan Pérez", "email": "juan@abc.cl", "telefono": "+56912345678", "probabilidad": 70},
    {"id": 2, "cliente": "Comercial XYZ", "monto": 3500000, "etapa": "propuesta", "origen": "web", "fecha": "2026-01-07", "contacto": "María González", "email": "maria@xyz.cl", "telefono": "+56987654321", "probabilidad": 60},
    {"id": 3, "cliente": "Industrias DEF", "monto": 8000000, "etapa": "ganado", "origen": "referido", "fecha": "2026-01-05", "contacto": "Carlos Silva", "email": "carlos@def.cl", "telefono": "+56911111111", "probabilidad": 100},
    {"id": 5, "cliente": "Distribuidora JKL", "monto": 4500000, "etapa": "calificado", "origen": "facebook", "fecha": "2026-01-06", "contacto": "Pedro Morales", "email": "pedro@jkl.cl", "telefono": "+56933333333", "probabilidad": 40},
    {"id": 6, "cliente": "Tech StartUp MNO", "monto": 6000000, "etapa": "prospecto", "origen": "instagram", "fecha": "2026-01-09", "contacto": "Ana Rodríguez", "email": "ana@techstartup.cl", "telefono": "+56944444444", "probabilidad": 20},
    {"id": 7, "cliente": "Influencer PQR", "monto": 2500000, "etapa": "prospecto", "origen": "tiktok", "fecha": "2026-01-10", "contacto": "Luis Martínez", "email": "luis@influencer.com", "telefono": "+56955555555", "probabilidad": 30},
    {"id": 8, "cliente": "Tienda Fashion STU", "monto": 7500000, "etapa": "calificado", "origen": "shopify", "fecha": "2026-01-10", "contacto": "Carmen Ruiz", "email": "carmen@fashionstu.com", "telefono": "+56966666666", "probabilidad": 50},
    {"id": 9, "cliente": "Consultoría VWX", "monto": 4000000, "etapa": "prospecto", "origen": "web", "fecha": "2026-01-10", "contacto": "Roberto Díaz", "email": "roberto@consultoria.com", "telefono": "+56977777777", "probabilidad": 25},
    {"id": 10, "cliente": "Importadora YZ", "monto": 9000000, "etapa": "calificado", "origen": "email", "fecha": "2026-01-10", "contacto": "Sofía Ramírez", "email": "sofia@importadora.cl", "telefono": "+56988888888", "probabilidad": 45}
]

MENSAJES_MOCK = [
    {"id": 1, "deal_id": 1, "contenido": "Hola, me interesa conocer más", "tipo": "entrante", "canal": "whatsapp", "created_at": "2026-01-08T09:15:00", "leido": True, "usuario": None},
    {"id": 2, "deal_id": 1, "contenido": "¡Hola Juan! Gracias por contactarnos.", "tipo": "saliente", "canal": "whatsapp", "created_at": "2026-01-08T09:18:00", "leido": True, "usuario": "Admin"},
    {"id": 6, "deal_id": 2, "contenido": "Vi su publicación", "tipo": "entrante", "canal": "instagram", "created_at": "2026-01-07T11:20:00", "leido": True, "usuario": None},
    {"id": 11, "deal_id": 6, "contenido": "Buscamos CRM", "tipo": "entrante", "canal": "facebook", "created_at": "2026-01-09T13:00:00", "leido": False, "usuario": None},
    {"id": 12, "deal_id": 7, "contenido": "Vi su video 🎵", "tipo": "entrante", "canal": "tiktok", "created_at": "2026-01-10T10:30:00", "leido": False, "usuario": None},
    {"id": 13, "deal_id": 7, "contenido": "¡Hola Luis!", "tipo": "saliente", "canal": "tiktok", "created_at": "2026-01-10T10:35:00", "leido": True, "usuario": "Admin"},
    {"id": 14, "deal_id": 8, "contenido": "Necesito integrar Shopify", "tipo": "entrante", "canal": "shopify", "created_at": "2026-01-10T11:00:00", "leido": False, "usuario": None},
    {"id": 15, "deal_id": 8, "contenido": "Perfecto Carmen!", "tipo": "saliente", "canal": "shopify", "created_at": "2026-01-10T11:05:00", "leido": True, "usuario": "Admin"},
    {"id": 16, "deal_id": 9, "contenido": "Completé el formulario", "tipo": "entrante", "canal": "web", "created_at": "2026-01-10T12:00:00", "leido": False, "usuario": None},
    {"id": 17, "deal_id": 9, "contenido": "Hola Roberto!", "tipo": "saliente", "canal": "web", "created_at": "2026-01-10T12:05:00", "leido": True, "usuario": "Admin"},
    {"id": 18, "deal_id": 10, "contenido": "Envié un email", "tipo": "entrante", "canal": "email", "created_at": "2026-01-10T13:00:00", "leido": False, "usuario": None},
    {"id": 19, "deal_id": 10, "contenido": "Hola Sofía!", "tipo": "saliente", "canal": "email", "created_at": "2026-01-10T13:10:00", "leido": True, "usuario": "Admin"}
]

PLANTILLAS_MOCK = [
    {"id": 1, "nombre": "Saludo Inicial", "contenido": "¡Hola {{contacto}}!", "categoria": "saludo", "activa": True},
    {"id": 2, "nombre": "Web Chat", "contenido": "{{contacto}}, gracias por el formulario.", "categoria": "web", "activa": True},
    {"id": 3, "nombre": "Email Follow-up", "contenido": "{{contacto}}, recibimos tu email.", "categoria": "email", "activa": True},
]

COTIZACIONES_MOCK = [
    {
        "id": 1,
        "deal_id": 1,
        "numero": "COT-2026-001",
        "fecha": "2026-01-10",
        "valida_hasta": "2026-01-24",
        "estado": "enviada",
        "items": [
            {"descripcion": "Plan Enterprise CRM", "cantidad": 1, "precio": 3000000, "subtotal": 3000000},
            {"descripcion": "Implementación y Training", "cantidad": 1, "precio": 1500000, "subtotal": 1500000},
            {"descripcion": "Soporte Premium 12 meses", "cantidad": 1, "precio": 500000, "subtotal": 500000}
        ],
        "subtotal": 5000000,
        "descuento": 0,
        "iva": 950000,
        "total": 5950000,
        "notas": "Cotización válida por 14 días.",
        "created_at": "2026-01-10T14:00:00",
        "enviada_at": "2026-01-10T14:05:00",
        "vista_at": None,
        "aceptada_at": None
    }
]

next_cotizacion_id = 2
next_mensaje_id = 20

@app.get("/")
def root():
    return {"service": "Backend Ventas", "version": "10.1-reportes"}

@app.get("/api/ventas/deals")
def get_deals():
    return {"deals": DEALS_MOCK, "total": len(DEALS_MOCK)}

@app.get("/api/ventas/conversaciones")
def get_conversaciones():
    conversaciones = []
    for deal in DEALS_MOCK:
        mensajes_deal = [m for m in MENSAJES_MOCK if m["deal_id"] == deal["id"]]
        if not mensajes_deal:
            continue
        ultimo = max(mensajes_deal, key=lambda x: x["created_at"])
        no_leidos = len([m for m in mensajes_deal if m["tipo"] == "entrante" and not m["leido"]])
        conversaciones.append({
            "deal_id": deal["id"],
            "cliente": deal["cliente"],
            "contacto": deal["contacto"],
            "telefono": deal.get("telefono"),
            "email": deal.get("email"),
            "etapa": deal["etapa"],
            "origen": deal["origen"],
            "ultimo_mensaje": {"contenido": ultimo["contenido"], "tipo": ultimo["tipo"], "canal": ultimo["canal"], "created_at": ultimo["created_at"]},
            "no_leidos": no_leidos
        })
    conversaciones.sort(key=lambda x: x["ultimo_mensaje"]["created_at"], reverse=True)
    return {"conversaciones": conversaciones, "total": len(conversaciones)}

@app.get("/api/ventas/conversaciones/{deal_id}/mensajes")
def get_mensajes(deal_id: int):
    deal = next((d for d in DEALS_MOCK if d["id"] == deal_id), None)
    if not deal:
        raise HTTPException(status_code=404)
    mensajes = [m for m in MENSAJES_MOCK if m["deal_id"] == deal_id]
    for m in MENSAJES_MOCK:
        if m["deal_id"] == deal_id and m["tipo"] == "entrante":
            m["leido"] = True
    return {"mensajes": sorted(mensajes, key=lambda x: x["created_at"]), "deal": deal}

@app.post("/api/ventas/conversaciones/{deal_id}/mensajes")
def create_mensaje(deal_id: int, mensaje: dict):
    global next_mensaje_id
    nuevo = {
        "id": next_mensaje_id,
        "deal_id": deal_id,
        "contenido": mensaje["contenido"],
        "tipo": mensaje["tipo"],
        "canal": mensaje["canal"],
        "created_at": datetime.now().isoformat(),
        "leido": True,
        "usuario": "Admin"
    }
    MENSAJES_MOCK.append(nuevo)
    next_mensaje_id += 1
    return {"message": "Mensaje enviado", "mensaje": nuevo}

@app.get("/api/ventas/plantillas")
def get_plantillas():
    return {"plantillas": PLANTILLAS_MOCK, "total": len(PLANTILLAS_MOCK)}

@app.get("/api/ventas/plantillas/{plantilla_id}/preview/{deal_id}")
def preview_plantilla(plantilla_id: int, deal_id: int):
    plantilla = next((p for p in PLANTILLAS_MOCK if p["id"] == plantilla_id), None)
    deal = next((d for d in DEALS_MOCK if d["id"] == deal_id), None)
    if not plantilla or not deal:
        raise HTTPException(status_code=404)
    contenido = plantilla["contenido"].replace("{{contacto}}", deal["contacto"])
    return {"contenido_procesado": contenido}

@app.get("/api/ventas/stats")
def get_stats():
    return {
        "total_pipeline": sum(d["monto"] for d in DEALS_MOCK),
        "total_deals": len(DEALS_MOCK),
        "tasa_conversion": 11.1,
        "forecast_ponderado": 15000000,
        "por_etapa": {
            "prospecto": {"count": 3, "monto": 12500000},
            "calificado": {"count": 3, "monto": 21000000},
            "propuesta": {"count": 1, "monto": 3500000},
            "negociacion": {"count": 1, "monto": 5000000},
            "ganado": {"count": 1, "monto": 8000000},
            "perdido": {"count": 0, "monto": 0}
        }
    }

@app.get("/api/ventas/deals/{deal_id}/cotizaciones")
def get_cotizaciones_deal(deal_id: int):
    cotizaciones = [c for c in COTIZACIONES_MOCK if c["deal_id"] == deal_id]
    return {"cotizaciones": cotizaciones, "total": len(cotizaciones)}

@app.post("/api/ventas/deals/{deal_id}/cotizaciones")
def create_cotizacion(deal_id: int, cotizacion: dict):
    global next_cotizacion_id
    deal = next((d for d in DEALS_MOCK if d["id"] == deal_id), None)
    if not deal:
        raise HTTPException(status_code=404)
    
    nueva_cot = {
        "id": next_cotizacion_id,
        "deal_id": deal_id,
        "numero": f"COT-2026-{str(next_cotizacion_id).zfill(3)}",
        "fecha": datetime.now().strftime("%Y-%m-%d"),
        "valida_hasta": (datetime.now() + timedelta(days=14)).strftime("%Y-%m-%d"),
        "estado": "borrador",
        "items": cotizacion.get("items", []),
        "subtotal": sum(item["subtotal"] for item in cotizacion.get("items", [])),
        "descuento": cotizacion.get("descuento", 0),
        "iva": 0,
        "total": 0,
        "notas": cotizacion.get("notas", ""),
        "created_at": datetime.now().isoformat(),
        "enviada_at": None,
        "vista_at": None,
        "aceptada_at": None
    }
    
    subtotal_con_desc = nueva_cot["subtotal"] - nueva_cot["descuento"]
    nueva_cot["iva"] = int(subtotal_con_desc * 0.19)
    nueva_cot["total"] = subtotal_con_desc + nueva_cot["iva"]
    
    COTIZACIONES_MOCK.append(nueva_cot)
    next_cotizacion_id += 1
    
    return {"message": "Cotización creada", "cotizacion": nueva_cot}

@app.get("/api/ventas/cotizaciones/{cotizacion_id}/pdf")
def generar_pdf_cotizacion(cotizacion_id: int):
    cotizacion = next((c for c in COTIZACIONES_MOCK if c["id"] == cotizacion_id), None)
    if not cotizacion:
        raise HTTPException(status_code=404)
    
    deal = next((d for d in DEALS_MOCK if d["id"] == cotizacion["deal_id"]), None)
    if not deal:
        raise HTTPException(status_code=404)
    
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter)
    story = []
    styles = getSampleStyleSheet()
    
    story.append(Paragraph("COTIZACIÓN", styles['Title']))
    story.append(Spacer(1, 0.3*inch))
    
    info_data = [
        ["Cotización Nº:", cotizacion["numero"], "Fecha:", cotizacion["fecha"]],
        ["Cliente:", deal["cliente"], "Válida hasta:", cotizacion["valida_hasta"]],
    ]
    info_table = Table(info_data, colWidths=[1.5*inch, 2*inch, 1.5*inch, 2*inch])
    story.append(info_table)
    story.append(Spacer(1, 0.4*inch))
    
    items_data = [["Descripción", "Cant.", "Precio Unit.", "Subtotal"]]
    for item in cotizacion["items"]:
        items_data.append([
            item["descripcion"],
            str(item["cantidad"]),
            f"${item['precio']:,.0f}".replace(",", "."),
            f"${item['subtotal']:,.0f}".replace(",", ".")
        ])
    
    items_table = Table(items_data, colWidths=[3.5*inch, 0.8*inch, 1.3*inch, 1.3*inch])
    items_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2563eb')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
        ('GRID', (0, 0), (-1, -1), 1, colors.grey),
    ]))
    story.append(items_table)
    story.append(Spacer(1, 0.3*inch))
    
    totales_data = [
        ["Subtotal:", f"${cotizacion['subtotal']:,.0f}".replace(",", ".")],
        ["IVA (19%):", f"${cotizacion['iva']:,.0f}".replace(",", ".")],
        ["TOTAL:", f"${cotizacion['total']:,.0f}".replace(",", ".")]
    ]
    totales_table = Table(totales_data, colWidths=[5.2*inch, 1.7*inch])
    story.append(totales_table)
    
    doc.build(story)
    buffer.seek(0)
    
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=cotizacion_{cotizacion['numero']}.pdf"}
    )

@app.get("/api/ventas/reportes/avanzados")
def get_reportes_avanzados():
    """Reportes avanzados para analytics"""
    
    # Deals estancados (>7 días sin actividad)
    deals_estancados = []
    for deal in DEALS_MOCK:
        fecha_deal = datetime.fromisoformat(deal["fecha"])
        dias_sin_actividad = (datetime.now() - fecha_deal).days
        if dias_sin_actividad > 7 and deal["etapa"] not in ["ganado", "perdido"]:
            deals_estancados.append({
                "id": deal["id"],
                "cliente": deal["cliente"],
                "contacto": deal["contacto"],
                "etapa": deal["etapa"],
                "monto": deal["monto"],
                "dias_sin_actividad": dias_sin_actividad
            })
    
    # Top oportunidades
    top_oportunidades = sorted(
        [d for d in DEALS_MOCK if d["etapa"] not in ["ganado", "perdido"]],
        key=lambda x: x["monto"] * (x["probabilidad"] / 100),
        reverse=True
    )[:5]
    
    # Embudo
    etapas_orden = ["prospecto", "calificado", "propuesta", "negociacion", "ganado"]
    embudo_conversion = []
    for etapa in etapas_orden:
        deals_etapa = [d for d in DEALS_MOCK if d["etapa"] == etapa]
        embudo_conversion.append({
            "etapa": etapa.capitalize(),
            "count": len(deals_etapa),
            "monto_total": sum(d["monto"] for d in deals_etapa)
        })
    
    deals_ganados = [d for d in DEALS_MOCK if d["etapa"] == "ganado"]
    deals_perdidos = [d for d in DEALS_MOCK if d["etapa"] == "perdido"]
    
    return {
        "total_pipeline": sum(d["monto"] for d in DEALS_MOCK),
        "tasa_conversion": round((len(deals_ganados) / len(DEALS_MOCK)) * 100, 1) if DEALS_MOCK else 0,
        "deals_estancados": deals_estancados,
        "top_oportunidades": top_oportunidades,
        "embudo_conversion": embudo_conversion,
        "roi": {
            "ganados": len(deals_ganados),
            "perdidos": len(deals_perdidos),
            "monto_ganado": sum(d["monto"] for d in deals_ganados),
            "monto_perdido": sum(d["monto"] for d in deals_perdidos)
        }
    }

@app.patch("/api/ventas/deals/{deal_id}/etapa")
async def update_deal_etapa(deal_id: int, body: dict):
    for deal in DEALS_MOCK:
        if deal["id"] == deal_id:
            deal["etapa"] = body.get("etapa")
            return {"message": "Etapa actualizada", "deal": deal}
    raise HTTPException(status_code=404, detail="Deal no encontrado")
