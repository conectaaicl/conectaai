"""
Módulo SII Facturación Electrónica Chile
Genera documentos DTE (Boleta/Factura) para gastos comunes
Integra con API SII o genera XML DTE para firma posterior
"""
import io
import json
import hashlib
import hmac
import base64
from datetime import date, datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, Query, HTTPException, Body
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel

from app.core.database import get_db
from app.core.dependencies import get_current_user

router = APIRouter(prefix="/api/sii", tags=["SII Facturación"])

# ─────────────────────────────────────────────────────────────────────────────
# DB SETUP
# ─────────────────────────────────────────────────────────────────────────────

def _init_tables(db: Session):
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS sii_config (
            id SERIAL PRIMARY KEY,
            tenant_id INTEGER UNIQUE NOT NULL,
            rut_emisor VARCHAR(20),
            razon_social VARCHAR(200),
            giro VARCHAR(200),
            direccion VARCHAR(300),
            comuna VARCHAR(100),
            ciudad VARCHAR(100),
            resolucion_num INTEGER,
            resolucion_fecha DATE,
            ambiente VARCHAR(10) DEFAULT 'certificacion',
            api_token TEXT,
            proximo_folio_boleta INTEGER DEFAULT 1,
            proximo_folio_factura INTEGER DEFAULT 1,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
    """))
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS sii_documentos (
            id SERIAL PRIMARY KEY,
            tenant_id INTEGER NOT NULL,
            condominio_id INTEGER,
            tipo_dte VARCHAR(10) NOT NULL,
            folio INTEGER NOT NULL,
            rut_receptor VARCHAR(20),
            razon_receptor VARCHAR(200),
            departamento VARCHAR(50),
            fecha_emision DATE NOT NULL,
            monto_neto DECIMAL(12,2) DEFAULT 0,
            iva DECIMAL(12,2) DEFAULT 0,
            monto_total DECIMAL(12,2) NOT NULL,
            estado VARCHAR(30) DEFAULT 'pendiente',
            track_id VARCHAR(100),
            xml_dte TEXT,
            pdf_url TEXT,
            periodo VARCHAR(7),
            cobros_ids JSONB,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    """))
    db.execute(text("""
        CREATE INDEX IF NOT EXISTS idx_sii_docs_tenant ON sii_documentos(tenant_id);
        CREATE INDEX IF NOT EXISTS idx_sii_docs_folio ON sii_documentos(tenant_id, tipo_dte, folio);
    """))
    db.commit()

@router.on_event("startup")
async def startup():
    from app.core.database import SessionLocal
    db = SessionLocal()
    try:
        _init_tables(db)
    finally:
        db.close()


# ─────────────────────────────────────────────────────────────────────────────
# SCHEMAS
# ─────────────────────────────────────────────────────────────────────────────

class SIIConfigCreate(BaseModel):
    rut_emisor: str
    razon_social: str
    giro: str = "Administración de Condominios"
    direccion: str
    comuna: str
    ciudad: str
    resolucion_num: int
    resolucion_fecha: str
    ambiente: str = "certificacion"
    api_token: Optional[str] = None

class EmitirDocumentoRequest(BaseModel):
    tipo_dte: str = "39"
    rut_receptor: Optional[str] = None
    razon_receptor: Optional[str] = None
    departamento: str
    periodo: str
    cobros_ids: List[int]
    condominio_id: Optional[int] = None


# ─────────────────────────────────────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/config")
def get_config(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_id = current_user["tenant_id"]
    _init_tables(db)
    row = db.execute(
        text("SELECT * FROM sii_config WHERE tenant_id=:tid"),
        {"tid": tenant_id}
    ).fetchone()
    if not row:
        return {"configurado": False}
    r = dict(row._mapping)
    if r.get("api_token"):
        r["api_token"] = "***configurado***"
    r["configurado"] = True
    return r

@router.post("/config")
def save_config(body: SIIConfigCreate = Body(...), current_user: dict = Depends(get_current_user),
                db: Session = Depends(get_db)):
    tenant_id = current_user["tenant_id"]
    _init_tables(db)
    existing = db.execute(
        text("SELECT id FROM sii_config WHERE tenant_id=:tid"), {"tid": tenant_id}
    ).fetchone()
    if existing:
        db.execute(text("""
            UPDATE sii_config SET rut_emisor=:rut, razon_social=:rs, giro=:giro,
            direccion=:dir, comuna=:com, ciudad=:ciu,
            resolucion_num=:rn, resolucion_fecha=:rf,
            ambiente=:amb, api_token=COALESCE(NULLIF(:tok,''), api_token),
            updated_at=NOW()
            WHERE tenant_id=:tid
        """), {
            "rut": body.rut_emisor, "rs": body.razon_social, "giro": body.giro,
            "dir": body.direccion, "com": body.comuna, "ciu": body.ciudad,
            "rn": body.resolucion_num, "rf": body.resolucion_fecha,
            "amb": body.ambiente, "tok": body.api_token or "", "tid": tenant_id
        })
    else:
        db.execute(text("""
            INSERT INTO sii_config (tenant_id, rut_emisor, razon_social, giro, direccion,
            comuna, ciudad, resolucion_num, resolucion_fecha, ambiente, api_token)
            VALUES (:tid, :rut, :rs, :giro, :dir, :com, :ciu, :rn, :rf, :amb, :tok)
        """), {
            "tid": tenant_id, "rut": body.rut_emisor, "rs": body.razon_social,
            "giro": body.giro, "dir": body.direccion, "com": body.comuna,
            "ciu": body.ciudad, "rn": body.resolucion_num, "rf": body.resolucion_fecha,
            "amb": body.ambiente, "tok": body.api_token or ""
        })
    db.commit()
    return {"ok": True, "message": "Configuración SII guardada"}


# ─────────────────────────────────────────────────────────────────────────────
# GENERAR XML DTE
# ─────────────────────────────────────────────────────────────────────────────

def _generar_xml_dte(cfg: dict, doc: dict, items: list) -> str:
    tipo = doc["tipo_dte"]
    folio = doc["folio"]
    fecha = doc["fecha_emision"]
    total = doc["monto_total"]
    receptor_rut = doc.get("rut_receptor") or "66666666-6"
    receptor_razon = doc.get("razon_receptor") or "Sin Nombre"
    depto = doc.get("departamento", "")
    periodo = doc.get("periodo", "")

    items_xml = ""
    for i, it in enumerate(items, 1):
        items_xml += f"""
        <Detalle>
          <NroLinDet>{i}</NroLinDet>
          <NmbItem>{it['nombre']}</NmbItem>
          <QtyItem>1</QtyItem>
          <PrcItem>{it['monto']:.0f}</PrcItem>
          <MontoItem>{it['monto']:.0f}</MontoItem>
        </Detalle>"""

    es_boleta = tipo in ("39", "41")
    monto_neto = round(total / 1.19, 2) if not es_boleta else total
    iva = round(total - monto_neto, 2) if not es_boleta else 0

    xml = f"""<?xml version="1.0" encoding="ISO-8859-1"?>
<DTE version="1.0" xmlns="http://www.sii.cl/SiiDte">
  <Documento ID="DTE-{tipo}-{folio}">
    <Encabezado>
      <IdDoc>
        <TipoDTE>{tipo}</TipoDTE>
        <Folio>{folio}</Folio>
        <FchEmis>{fecha}</FchEmis>
        <IndServicio>3</IndServicio>
      </IdDoc>
      <Emisor>
        <RUTEmisor>{cfg['rut_emisor']}</RUTEmisor>
        <RznSoc>{cfg['razon_social']}</RznSoc>
        <GiroEmis>{cfg['giro']}</GiroEmis>
        <DirOrigen>{cfg['direccion']}</DirOrigen>
        <CmnaOrigen>{cfg['comuna']}</CmnaOrigen>
      </Emisor>
      <Receptor>
        <RUTRecep>{receptor_rut}</RUTRecep>
        <RznSocRecep>{receptor_razon}</RznSocRecep>
      </Receptor>
      <Totales>
        <MntNeto>{monto_neto:.0f}</MntNeto>
        <TasaIVA>19</TasaIVA>
        <IVA>{iva:.0f}</IVA>
        <MntTotal>{total:.0f}</MntTotal>
      </Totales>
    </Encabezado>
    {items_xml}
  </Documento>
</DTE>"""
    return xml


# ─────────────────────────────────────────────────────────────────────────────
# EMITIR DOCUMENTO
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/emitir")
def emitir_documento(body: EmitirDocumentoRequest, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_id = current_user["tenant_id"]
    _init_tables(db)
    cfg_row = db.execute(
        text("SELECT * FROM sii_config WHERE tenant_id=:tid"), {"tid": tenant_id}
    ).fetchone()
    if not cfg_row:
        raise HTTPException(400, "SII no configurado. Configure primero los datos del emisor.")
    cfg = dict(cfg_row._mapping)

    if not body.cobros_ids:
        raise HTTPException(400, "Debe seleccionar al menos un cobro")

    cobros = db.execute(text("""
        SELECT id, concepto, monto, depto_numero, nombre_residente
        FROM gastos_cobros
        WHERE id = ANY(:ids) AND tenant_id=:tid
    """), {"ids": body.cobros_ids, "tid": tenant_id}).fetchall()

    if not cobros:
        raise HTTPException(404, "No se encontraron cobros")

    monto_total = sum(float(c._mapping["monto"]) for c in cobros)
    items = [{"nombre": f"{c._mapping['concepto']} - Depto {c._mapping['depto_numero']}", "monto": float(c._mapping["monto"])} for c in cobros]

    col_folio = "proximo_folio_boleta" if body.tipo_dte in ("39", "41") else "proximo_folio_factura"
    folio = int(cfg[col_folio] or 1)

    doc_data = {
        "tipo_dte": body.tipo_dte,
        "folio": folio,
        "fecha_emision": date.today().isoformat(),
        "monto_total": monto_total,
        "rut_receptor": body.rut_receptor,
        "razon_receptor": body.razon_receptor,
        "departamento": body.departamento,
        "periodo": body.periodo,
    }
    xml_dte = _generar_xml_dte(cfg, doc_data, items)

    res = db.execute(text("""
        INSERT INTO sii_documentos
        (tenant_id, condominio_id, tipo_dte, folio, rut_receptor, razon_receptor,
         departamento, fecha_emision, monto_neto, iva, monto_total, estado,
         xml_dte, periodo, cobros_ids)
        VALUES (:tid, :cid, :tipo, :folio, :rut, :rrs, :depto, :fecha,
                :neto, :iva, :total, 'generado', :xml, :per, :cobros)
        RETURNING id
    """), {
        "tid": tenant_id, "cid": body.condominio_id, "tipo": body.tipo_dte,
        "folio": folio, "rut": body.rut_receptor, "rrs": body.razon_receptor,
        "depto": body.departamento, "fecha": date.today(),
        "neto": round(monto_total / 1.19 if body.tipo_dte not in ("39","41") else monto_total, 2),
        "iva": round(monto_total - monto_total/1.19 if body.tipo_dte not in ("39","41") else 0, 2),
        "total": monto_total, "xml": xml_dte, "per": body.periodo,
        "cobros": json.dumps(body.cobros_ids)
    })
    doc_id = res.fetchone()[0]

    db.execute(text(f"UPDATE sii_config SET {col_folio}={col_folio}+1, updated_at=NOW() WHERE tenant_id=:tid"),
               {"tid": tenant_id})
    db.commit()

    return {
        "ok": True,
        "documento_id": doc_id,
        "folio": folio,
        "tipo_dte": body.tipo_dte,
        "monto_total": monto_total,
        "estado": "generado",
        "mensaje": f"Documento DTE tipo {body.tipo_dte} folio {folio} generado exitosamente"
    }


# ─────────────────────────────────────────────────────────────────────────────
# DESCARGAR XML
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/documento/{doc_id}/xml")
def descargar_xml(doc_id: int, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_id = current_user["tenant_id"]
    row = db.execute(
        text("SELECT * FROM sii_documentos WHERE id=:id AND tenant_id=:tid"),
        {"id": doc_id, "tid": tenant_id}
    ).fetchone()
    if not row:
        raise HTTPException(404, "Documento no encontrado")
    r = dict(row._mapping)
    xml_content = r["xml_dte"] or ""
    return StreamingResponse(
        io.BytesIO(xml_content.encode("iso-8859-1")),
        media_type="application/xml",
        headers={"Content-Disposition": f"attachment; filename=DTE_{r['tipo_dte']}_{r['folio']}.xml"}
    )


# ─────────────────────────────────────────────────────────────────────────────
# LISTAR DOCUMENTOS
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/documentos")
def listar_documentos(
    tipo_dte: Optional[str] = Query(None),
    periodo: Optional[str] = Query(None),
    limit: int = Query(50),
    offset: int = Query(0),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    tenant_id = current_user["tenant_id"]
    _init_tables(db)
    filters = "WHERE tenant_id=:tid"
    params: dict = {"tid": tenant_id}
    if tipo_dte:
        filters += " AND tipo_dte=:tipo"
        params["tipo"] = tipo_dte
    if periodo:
        filters += " AND periodo=:per"
        params["per"] = periodo

    total = db.execute(text(f"SELECT COUNT(*) FROM sii_documentos {filters}"), params).fetchone()[0]
    rows = db.execute(text(f"""
        SELECT id, tipo_dte, folio, rut_receptor, razon_receptor, departamento,
               fecha_emision, monto_total, estado, periodo, track_id, created_at
        FROM sii_documentos {filters}
        ORDER BY id DESC LIMIT :lim OFFSET :off
    """), {**params, "lim": limit, "off": offset}).fetchall()

    return {
        "total": total,
        "items": [dict(r._mapping) for r in rows]
    }


# ─────────────────────────────────────────────────────────────────────────────
# STATS SII
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/stats")
def stats_sii(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_id = current_user["tenant_id"]
    _init_tables(db)
    hoy = date.today()
    per = hoy.strftime("%Y-%m")

    def safe(q, p):
        try:
            r = db.execute(text(q), p).fetchone()
            return r[0] if r and r[0] is not None else 0
        except Exception:
            db.rollback()
            return 0

    total_docs = safe("SELECT COUNT(*) FROM sii_documentos WHERE tenant_id=:tid", {"tid": tenant_id})
    docs_mes = safe("SELECT COUNT(*) FROM sii_documentos WHERE tenant_id=:tid AND periodo=:per", {"tid": tenant_id, "per": per})
    monto_mes = safe("SELECT SUM(monto_total) FROM sii_documentos WHERE tenant_id=:tid AND periodo=:per", {"tid": tenant_id, "per": per})
    boletas = safe("SELECT COUNT(*) FROM sii_documentos WHERE tenant_id=:tid AND tipo_dte='39'", {"tid": tenant_id})
    facturas = safe("SELECT COUNT(*) FROM sii_documentos WHERE tenant_id=:tid AND tipo_dte='33'", {"tid": tenant_id})

    return {
        "total_documentos": int(total_docs),
        "documentos_mes": int(docs_mes),
        "monto_mes": float(monto_mes),
        "boletas": int(boletas),
        "facturas": int(facturas),
        "periodo": per
    }


# ─────────────────────────────────────────────────────────────────────────────
# ANULAR DOCUMENTO
# ─────────────────────────────────────────────────────────────────────────────

@router.delete("/documento/{doc_id}")
def anular_documento(doc_id: int, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_id = current_user["tenant_id"]
    row = db.execute(
        text("SELECT id, estado FROM sii_documentos WHERE id=:id AND tenant_id=:tid"),
        {"id": doc_id, "tid": tenant_id}
    ).fetchone()
    if not row:
        raise HTTPException(404, "Documento no encontrado")
    if dict(row._mapping)["estado"] == "enviado_sii":
        raise HTTPException(400, "No se puede anular un documento ya enviado al SII")
    db.execute(
        text("UPDATE sii_documentos SET estado='anulado' WHERE id=:id"),
        {"id": doc_id}
    )
    db.commit()
    return {"ok": True, "message": "Documento anulado"}
