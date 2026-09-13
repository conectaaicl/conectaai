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
from app.core.dependencies import get_current_user


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


# Finanzas se alimenta de los COBROS reales que genera "Gastos Comunes" (gastos_periodos/gastos_cobros).
# La tabla legacy GastoComun ya no se usa aqui: tenia datos sin tenant y un modelo distinto.
from types import SimpleNamespace as _NS
from datetime import date as _date


def _cobro_a_gasto(row) -> "_NS":
    d = dict(row._mapping)
    per = (d.get("periodo") or "0000-00").split("-")
    fv = d.get("fecha_vencimiento")
    estado = d.get("estado") or "pendiente"
    if estado == "pendiente" and fv and fv < _date.today():
        estado = "atrasado"
    return _NS(
        id=d["id"], departamento_id=d.get("departamento_id"), mes=int(per[1]) if len(per) > 1 and per[1].isdigit() else 0,
        anio=int(per[0]) if per[0].isdigit() else 0, monto_base=float(d.get("monto") or 0), multas=0.0, intereses=0.0,
        otros_cargos=0.0, descuentos=0.0, monto_total=float(d.get("monto") or 0), estado=estado,
        fecha_vencimiento=fv, fecha_pago=d.get("fecha_pago"), metodo_pago=d.get("metodo_pago"),
        comprobante_url=d.get("comprobante_url"), categoria=d.get("concepto"), descripcion=f"Gastos comunes {d.get('periodo')}",
        detalle=[{"concepto": d.get("concepto"), "categoria": d.get("concepto"), "monto": float(d.get("monto") or 0)}],
        observaciones=d.get("notas"), created_at=d.get("created_at"), periodo=d.get("periodo"),
        depto_numero=d.get("depto_numero"), persona_nombre=d.get("nombre_residente"), periodo_estado=d.get("periodo_estado"),
    )


_COBRO_SQL = ("SELECT c.*, p.periodo, p.estado AS periodo_estado FROM gastos_cobros c "
              "JOIN gastos_periodos p ON p.id = c.periodo_id WHERE c.tenant_id = :tid")


def _gasto_por_id(db, gasto_id: int, tenant_id: int):
    from sqlalchemy import text as _t
    row = db.execute(_t(_COBRO_SQL + " AND c.id = :id"), {"tid": tenant_id, "id": gasto_id}).fetchone()
    return _cobro_a_gasto(row) if row else None


def _gastos_filtrados(db, tenant_id: int, mes=None, anio=None, estado=None, departamento_id=None, limit=500, skip=0):
    from sqlalchemy import text as _t
    sql, params = _COBRO_SQL, {"tid": tenant_id}
    if mes and anio:
        sql += " AND p.periodo = :per"; params["per"] = f"{int(anio):04d}-{int(mes):02d}"
    elif anio:
        sql += " AND p.periodo LIKE :per"; params["per"] = f"{int(anio):04d}-%"
    if departamento_id:
        sql += " AND c.departamento_id = :did"; params["did"] = departamento_id
    if estado == "atrasado":
        sql += " AND c.estado = 'pendiente' AND c.fecha_vencimiento < CURRENT_DATE"
    elif estado == "pendiente":
        sql += " AND c.estado = 'pendiente' AND (c.fecha_vencimiento IS NULL OR c.fecha_vencimiento >= CURRENT_DATE)"
    elif estado:
        sql += " AND c.estado = :est"; params["est"] = estado
    sql += " ORDER BY p.periodo DESC, length(c.depto_numero), c.depto_numero, c.id LIMIT :lim OFFSET :off"
    params["lim"] = limit; params["off"] = skip
    return [_cobro_a_gasto(r) for r in db.execute(_t(sql), params).fetchall()]


def _gasto_dict(g) -> dict:
    d = dict(vars(g))
    for k, v in d.items():
        if hasattr(v, "isoformat"):
            d[k] = v.isoformat()
    return d


def _periodo_para(db, tenant_id: int, mes: int, anio: int, fecha_venc=None) -> int:
    """Busca (o crea en borrador) el periodo YYYY-MM para cargos manuales."""
    from sqlalchemy import text as _t
    per = f"{int(anio):04d}-{int(mes):02d}"
    row = db.execute(_t("SELECT id FROM gastos_periodos WHERE tenant_id=:tid AND periodo=:p"), {"tid": tenant_id, "p": per}).fetchone()
    if row:
        return row[0]
    return db.execute(_t("INSERT INTO gastos_periodos (tenant_id, periodo, estado, notas, fecha_vencimiento) VALUES (:tid, :p, 'borrador', 'Creado desde Finanzas', :fv) RETURNING id"),
                      {"tid": tenant_id, "p": per, "fv": fecha_venc}).scalar()


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
def obtener_categorias(current_user: dict = Depends(get_current_user)):
    """Retorna lista de categorías predefinidas para gastos comunes"""
    return CATEGORIAS_PREDEFINIDAS


@router.get("/resumen-departamentos")
def resumen_por_departamento(
    periodo: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    tenant_id = current_user["tenant_id"]
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

    # Cobros del periodo (sistema de periodos), agrupados por departamento
    dept_items: dict = {d.id: [] for d in depts}
    dept_gastos_estados: dict = {d.id: set() for d in depts}
    for g in _gastos_filtrados(db, tenant_id, mes, anio, None, None, 5000, 0):
        if g.departamento_id in dept_items:
            dept_items[g.departamento_id].append({"concepto": g.categoria or "", "categoria": g.categoria, "monto": g.monto_total,
                                                  "gasto_id": g.id, "estado": g.estado})
            dept_gastos_estados[g.departamento_id].add(g.estado)

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


@router.post("/gastos-comunes")
def crear_gasto_comun(gasto: GastoComunCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Cargo individual (multa, cobro extra, reserva...) a un departamento: se guarda como cobro del periodo del mes."""
    from sqlalchemy import text as _t
    tenant_id = current_user["tenant_id"]
    gd = gasto.model_dump()
    did = gd.get("departamento_id")
    if not did:
        raise HTTPException(400, "Elige el departamento al que se le cobra. Para cobrar a todos usa Gastos Comunes > Nuevo periodo.")
    dep = db.execute(_t("SELECT d.id, d.numero, COALESCE(r.nombre_completo, pr.nombre_completo) AS nombre, COALESCE(d.residente_id, d.propietario_id) AS pid "
                        "FROM departamentos d LEFT JOIN personas r ON r.id=d.residente_id LEFT JOIN personas pr ON pr.id=d.propietario_id "
                        "WHERE d.id=:did AND d.tenant_id=:tid"), {"did": did, "tid": tenant_id}).fetchone()
    if not dep:
        raise HTTPException(404, "Departamento no encontrado en este condominio")
    fv = gd.get("fecha_vencimiento")
    pid = _periodo_para(db, tenant_id, gd.get("mes"), gd.get("anio"), fv)
    concepto = (gd.get("categoria") or gd.get("descripcion") or "Cargo").strip()[:200]
    monto = float(gd.get("monto_total") or gd.get("monto_base") or 0)
    if monto <= 0:
        raise HTTPException(400, "El monto debe ser mayor a 0")
    cid = db.execute(_t("""
        INSERT INTO gastos_cobros (tenant_id, periodo_id, departamento_id, persona_id, depto_numero, nombre_residente,
                                   concepto, monto, estado, fecha_vencimiento, notas)
        VALUES (:tid, :pid, :did, :pers, :num, :nom, :c, :m, 'pendiente', :fv, :n) RETURNING id
    """), {"tid": tenant_id, "pid": pid, "did": did, "pers": dep._mapping["pid"], "num": dep._mapping["numero"],
           "nom": dep._mapping["nombre"] or "Sin asignar", "c": concepto, "m": monto, "fv": fv, "n": gd.get("descripcion") or gd.get("observaciones")}).scalar()
    db.execute(_t("UPDATE gastos_periodos SET total_monto = COALESCE(total_monto,0) + :m, total_cobros = COALESCE(total_cobros,0) + 1 WHERE id=:pid"), {"m": monto, "pid": pid})
    db.commit()
    return _gasto_dict(_gasto_por_id(db, cid, tenant_id))


@router.get("/gastos-comunes")
def listar_gastos_comunes(
    mes: Optional[int] = None, anio: Optional[int] = None, estado: Optional[str] = None,
    departamento_id: Optional[int] = None, skip: int = 0, limit: int = 300,
    db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)
):
    """Cobros del condominio (generados por periodos o cargos manuales), con residente y depto."""
    tenant_id = current_user["tenant_id"]
    out = []
    for g in _gastos_filtrados(db, tenant_id, mes, anio, estado, departamento_id, limit, skip):
        d = _gasto_dict(g)
        persona, dnum, _ = _persona_de_depto(db, g.departamento_id, tenant_id)
        d["depto_numero"] = d.get("depto_numero") or dnum
        d["persona_nombre"] = (persona or {}).get("nombre_completo") or d.get("persona_nombre")
        d["persona_email"] = (persona or {}).get("email")
        out.append(d)
    return out


@router.get("/gastos-comunes/{gasto_id}")
def obtener_gasto_comun(gasto_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    gasto = _gasto_por_id(db, gasto_id, current_user["tenant_id"])
    if not gasto:
        raise HTTPException(status_code=404, detail="Gasto común no encontrado")
    return _gasto_dict(gasto)

@router.put("/gastos-comunes/{gasto_id}")
def actualizar_gasto_comun(gasto_id: int, gasto_update: GastoComunUpdate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    from sqlalchemy import text as _t
    tenant_id = current_user["tenant_id"]
    if not _gasto_por_id(db, gasto_id, tenant_id):
        raise HTTPException(status_code=404, detail="Gasto común no encontrado")
    u = gasto_update.model_dump(exclude_unset=True)
    sets, params = [], {"id": gasto_id, "tid": tenant_id}
    monto = u.get("monto_total", u.get("monto_base"))
    if monto is not None: sets.append("monto=:m"); params["m"] = float(monto)
    if u.get("estado"): sets.append("estado=:e"); params["e"] = u["estado"]
    if u.get("fecha_vencimiento"): sets.append("fecha_vencimiento=:fv"); params["fv"] = u["fecha_vencimiento"]
    if u.get("categoria"): sets.append("concepto=:c"); params["c"] = u["categoria"][:200]
    if u.get("observaciones") or u.get("descripcion"): sets.append("notas=:n"); params["n"] = u.get("observaciones") or u.get("descripcion")
    if sets:
        db.execute(_t(f"UPDATE gastos_cobros SET {', '.join(sets)} WHERE id=:id AND tenant_id=:tid"), params); db.commit()
    return _gasto_dict(_gasto_por_id(db, gasto_id, tenant_id))

@router.post("/gastos-comunes/{gasto_id}/pagar")
def registrar_pago(
    gasto_id: int,
    metodo_pago: str = "transferencia",
    comprobante_url: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Registrar pago de un cobro"""
    from sqlalchemy import text as _t
    tenant_id = current_user["tenant_id"]
    if not _gasto_por_id(db, gasto_id, tenant_id):
        raise HTTPException(status_code=404, detail="Gasto común no encontrado")
    db.execute(_t("UPDATE gastos_cobros SET estado='pagado', fecha_pago=NOW(), metodo_pago=:mp, comprobante_url=COALESCE(:cu, comprobante_url) WHERE id=:id AND tenant_id=:tid"),
               {"mp": metodo_pago, "cu": comprobante_url, "id": gasto_id, "tid": tenant_id})
    db.commit()
    return {"message": "Pago registrado exitosamente", "gasto": gasto_id}

@router.delete("/gastos-comunes/{gasto_id}")
def eliminar_gasto_comun(gasto_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Eliminar un cobro (solo de este condominio)"""
    from sqlalchemy import text as _t
    tenant_id = current_user["tenant_id"]
    g = _gasto_por_id(db, gasto_id, tenant_id)
    if not g:
        raise HTTPException(status_code=404, detail="Gasto común no encontrado")
    if g.estado == "pagado":
        raise HTTPException(400, "No se puede eliminar un cobro ya pagado")
    db.execute(_t("DELETE FROM gastos_cobros WHERE id=:id AND tenant_id=:tid"), {"id": gasto_id, "tid": tenant_id})
    db.commit()
    return {"message": "Gasto común eliminado"}

@router.get("/stats/morosidad")
def obtener_stats_morosidad(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Morosidad del condominio (solo periodos emitidos o cerrados)."""
    from sqlalchemy import text as _t
    r = db.execute(_t("""
        SELECT COUNT(*) AS total,
               COUNT(*) FILTER (WHERE c.estado='pagado') AS pagados,
               COUNT(*) FILTER (WHERE c.estado='pendiente' AND (c.fecha_vencimiento IS NULL OR c.fecha_vencimiento >= CURRENT_DATE)) AS pendientes,
               COUNT(*) FILTER (WHERE c.estado='pendiente' AND c.fecha_vencimiento < CURRENT_DATE) AS atrasados,
               COALESCE(SUM(c.monto) FILTER (WHERE c.estado='pendiente'),0)::float AS monto_pendiente,
               COALESCE(SUM(c.monto) FILTER (WHERE c.estado='pagado'),0)::float AS monto_pagado
        FROM gastos_cobros c JOIN gastos_periodos p ON p.id=c.periodo_id
        WHERE c.tenant_id=:tid AND p.estado IN ('emitido','cerrado')
    """), {"tid": current_user["tenant_id"]}).fetchone()
    total, pagados = r[0], r[1]
    return {"total_gastos": total, "pagados": pagados, "pendientes": r[2], "atrasados": r[3],
            "monto_pendiente": r[4], "monto_pagado": r[5], "tasa_pago": round((pagados / total * 100) if total else 0, 2)}


@router.post("/gastos-comunes/enviar-masivo")
def enviar_gastos_masivo(mes: int, anio: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    tenant_id = current_user["tenant_id"]
    from sqlalchemy import text as _t
    import httpx as _hx
    valid = db.execute(_t(
        "SELECT d.id FROM departamentos d JOIN pisos p ON p.id=d.piso_id "
        "JOIN torres t ON t.id=p.torre_id JOIN condominios c ON c.id=t.condominio_id "
        "WHERE c.tenant_id=:tid"
    ), {"tid": tenant_id}).fetchall()
    valid_ids = [r._mapping["id"] for r in valid]
    gastos = _gastos_filtrados(db, tenant_id, mes, anio, None, None, 5000, 0)
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
def enviar_gasto_individual(gasto_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    tenant_id = current_user["tenant_id"]
    import httpx as _hx
    gasto = _gasto_por_id(db, gasto_id, tenant_id)
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
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Exportar gastos comunes a PDF"""
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.units import inch
    from io import BytesIO
    from fastapi.responses import StreamingResponse

    gastos = _gastos_filtrados(db, current_user["tenant_id"], mes, anio, None, None, 5000, 0)

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
def generar_pdf_individual(gasto_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Generar PDF individual de un gasto común"""
    from reportlab.lib.pagesizes import letter
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.units import inch
    from io import BytesIO
    from fastapi.responses import StreamingResponse

    gasto = _gasto_por_id(db, gasto_id, current_user["tenant_id"])
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
