import os
import json
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
from typing import Optional
from app.core.database import get_db
from app.core.dependencies import get_current_user

router = APIRouter(prefix="/api/ia/chat", tags=["IA"])

SYSTEM_PROMPT = """Eres un asistente de gestión de condominios. Tienes acceso a la base de datos de un edificio.
Cuando el usuario haga una pregunta sobre datos, responde con JSON en este formato:
{"tipo": "query", "explicacion": "...", "sql": "SELECT ... WHERE tenant_id=:tid ..."}

El tenant_id siempre es :tid en los parámetros.

Tablas disponibles:
- visitas (id, depto_destino, nombre_visitante, rut_visitante, motivo, hora_entrada, hora_salida, vehiculo_patente, created_at)
- paqueteria (id, carrier, tracking_number, depto_destino, nombre_destinatario, estado, recibido_at, entregado_at)
- historial_eventos (id, tipo, descripcion, modulo, accion, resultado, created_at)
- reservas (id, espacio_id, fecha_inicio, fecha_fin, estado, solicitado_por, created_at)
- multas (id, depto_numero, tipo, descripcion, monto, estado, fecha_infraccion)
- personas (id, nombre_completo, datos_contacto, estado)
- alertas_sistema (id, tipo, nivel, titulo, descripcion, resuelta, created_at)
- gastos_cobros (id, depto_numero, concepto, monto, estado, fecha_vencimiento)

Para filtros de hora: usar EXTRACT(HOUR FROM campo) o campo::time comparisons.
SIEMPRE incluir WHERE tenant_id=:tid en todas las queries.
NUNCA usar DROP, DELETE, UPDATE, INSERT — solo SELECT.
Si no es una pregunta de datos, responde: {"tipo": "respuesta", "texto": "..."}
Responde SOLO con JSON válido, sin markdown."""


class ChatRequest(BaseModel):
    mensaje: str
    contexto: Optional[str] = None


@router.post("")
async def chat(body: ChatRequest, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_id = current_user["tenant_id"]
    api_key = os.getenv("ANTHROPIC_API_KEY", "")
    if not api_key:
        return {"tipo": "respuesta", "texto": "IA no configurada. Agrega ANTHROPIC_API_KEY al .env", "datos": None}

    try:
        import anthropic
        client = anthropic.Anthropic(api_key=api_key)
        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": body.mensaje}]
        )
        raw = message.content[0].text.strip()
        result = json.loads(raw)

        if result.get("tipo") == "query":
            sql = result.get("sql", "")
            if not sql.strip().upper().startswith("SELECT"):
                return {"tipo": "respuesta", "texto": "Solo puedo consultar datos, no modificarlos.", "datos": None}
            rows = db.execute(text(sql), {"tid": tenant_id}).fetchall()
            datos = [dict(r._mapping) for r in rows[:50]]
            for d in datos:
                for k, v in d.items():
                    if hasattr(v, 'isoformat'):
                        d[k] = str(v)
            return {"tipo": "query", "explicacion": result.get("explicacion", ""), "datos": datos, "total": len(datos)}
        else:
            return {"tipo": "respuesta", "texto": result.get("texto", raw), "datos": None}
    except json.JSONDecodeError:
        raw_val = raw if 'raw' in dir() else "Error procesando respuesta"
        return {"tipo": "respuesta", "texto": raw_val, "datos": None}
    except Exception as e:
        return {"tipo": "error", "texto": str(e)[:200], "datos": None}


@router.get("/sugerencias")
async def sugerencias(current_user: dict = Depends(get_current_user)):
    return [
        "Muéstrame las visitas de hoy",
        "¿Quién entró después de las 11 PM esta semana?",
        "Paquetes pendientes de entregar",
        "Multas pendientes de pago",
        "Accesos denegados en los últimos 7 días",
        "Residentes con gastos vencidos",
        "Reservas de esta semana",
        "¿Cuántas visitas tuvimos este mes?",
    ]
