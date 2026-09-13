from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc, or_
from app.core.database import get_db
from app.models.finanzas import GastoComun
from app.models.aviso import Aviso
from app.models.aviso_lectura import AvisoLectura
from app.routers.portal_auth import get_residente, ResidentePortal
from datetime import datetime, timedelta
import secrets, os

router = APIRouter(prefix="/api/portal", tags=["portal_residente"])

@router.get("/dashboard")
def dashboard(r: ResidentePortal=Depends(get_residente), db: Session=Depends(get_db)):
    hoy = datetime.utcnow()
    # GastoComun has no tenant_id directly — filter by departamento_id
    gastos = db.query(GastoComun).filter(
        GastoComun.estado.in_(["pendiente","atrasado"]),
        or_(GastoComun.departamento_id==r.departamento_id, GastoComun.departamento_id==None)
    ).all() if r.departamento_id else []
    # fecha_vencimiento is the actual column name (not vencimiento)
    vencidos = sum(1 for g in gastos if g.fecha_vencimiento and (
        g.fecha_vencimiento.date() if hasattr(g.fecha_vencimiento,'date') else g.fecha_vencimiento
    ) < hoy.date())
    monto = sum(g.monto_total or 0 for g in gastos)
    # Include gastos_cobros (new period system)
    from sqlalchemy import text as _txt_cobros
    if r.departamento_id:
        _cr = db.execute(_txt_cobros(
            "SELECT COALESCE(SUM(monto),0)::float as t, COUNT(*)::int as n "
            "FROM gastos_cobros WHERE departamento_id=:did AND estado NOT IN ('pagado','exento')"
        ), {"did": r.departamento_id}).fetchone()
        # indices, no atributos: Row.t es un alias reservado de SQLAlchemy (devuelve la fila completa)
        if _cr and _cr[0]:
            monto += float(_cr[0])
            vencidos += int(_cr[1] or 0)
    semaforo = "verde" if vencidos==0 else ("amarillo" if vencidos<=2 else "rojo")
    msgs = {
        "verde": "Al día con sus pagos",
        "amarillo": f"{vencidos} mes(es) con gastos vencidos",
        "rojo": f"{vencidos} meses vencidos — Riesgo de corte de suministros (agua, gas, electricidad)"
    }
    avisos_total = db.query(Aviso).filter(Aviso.tenant_id==r.tenant_id).count()
    leidos = db.query(AvisoLectura).filter(AvisoLectura.residente_rut==r.rut).count()

    condo_info = {"condominio": None, "torre": None, "depto_numero": None}
    if r.departamento_id:
        from sqlalchemy import text as _text
        row = db.execute(_text("""
            SELECT c.nombre AS condominio, t.nombre AS torre, d.numero AS depto_numero
            FROM departamentos d
            JOIN pisos p ON p.id = d.piso_id
            JOIN torres t ON t.id = p.torre_id
            JOIN condominios c ON c.id = t.condominio_id
            WHERE d.id = :did
        """), {"did": r.departamento_id}).fetchone()
        if row:
            condo_info = {"condominio": row[0], "torre": row[1], "depto_numero": row[2]}

    return {
        "semaforo": semaforo, "semaforo_msg": msgs[semaforo],
        "meses_vencidos": vencidos, "monto_pendiente": monto,
        "gastos_pendientes": len(gastos),
        "avisos_no_leidos": max(0, avisos_total - leidos),
        "residente": {
            "nombre": r.nombre_completo, "rut": r.rut, "departamento_id": r.departamento_id,
            **condo_info,
        }
    }

@router.get("/cobros")
def cobros_residente(r: ResidentePortal=Depends(get_residente), db: Session=Depends(get_db)):
    """Cobros del sistema por periodos (gastos_cobros)."""
    if not r.departamento_id:
        return []
    from sqlalchemy import text as _tco
    rows = db.execute(_tco("""
        SELECT gc.id, gc.concepto, gc.monto::float, gc.estado,
               gc.fecha_vencimiento, gc.fecha_pago, gc.metodo_pago,
               gc.notas, gp.periodo
        FROM gastos_cobros gc
        LEFT JOIN gastos_periodos gp ON gp.id = gc.periodo_id
        WHERE gc.departamento_id = :did
        ORDER BY gc.created_at DESC
        LIMIT 48
    """), {"did": r.departamento_id}).fetchall()
    return [
        {
            "id": rw[0], "concepto": rw[1], "monto_total": rw[2], "estado": rw[3],
            "vencimiento": rw[4].isoformat() if rw[4] else None,
            "fecha_pago": rw[5].isoformat() if rw[5] else None,
            "metodo_pago": rw[6], "notas": rw[7],
            "periodo": rw[8], "source": "cobros"
        }
        for rw in rows
    ]

@router.get("/cuenta")
def cuenta(r: ResidentePortal=Depends(get_residente), db: Session=Depends(get_db)):
    if not r.departamento_id:
        return []
    from sqlalchemy import text as _tcc
    # New system: gastos_cobros
    cobros_rows = db.execute(_tcc("""
        SELECT gc.id, gc.concepto, gc.monto::float, gc.estado,
               gc.fecha_vencimiento, gc.fecha_pago, gc.metodo_pago, gp.periodo
        FROM gastos_cobros gc
        LEFT JOIN gastos_periodos gp ON gp.id = gc.periodo_id
        WHERE gc.departamento_id = :did
        ORDER BY gc.created_at DESC LIMIT 48
    """), {"did": r.departamento_id}).fetchall()
    result = []
    for rw in cobros_rows:
        result.append({
            "id": rw[0], "periodo": rw[7], "descripcion": rw[1],
            "monto_total": rw[2],
            "vencimiento": rw[4].isoformat() if rw[4] else None,
            "estado": rw[3], "desglose": None,
            "fecha_pago": rw[5].isoformat() if rw[5] else None,
            "metodo_pago": rw[6], "source": "cobros"
        })
    # Legacy system: gastos_comunes
    gastos = db.query(GastoComun).filter(
        or_(GastoComun.departamento_id==r.departamento_id, GastoComun.departamento_id==None)
    ).order_by(desc(GastoComun.created_at)).limit(24).all()
    for g in gastos:
        periodo = f"{g.anio}-{str(g.mes).zfill(2)}" if g.mes and g.anio else None
        result.append({
            "id": g.id, "periodo": periodo, "descripcion": g.descripcion,
            "monto_total": g.monto_total,
            "vencimiento": g.fecha_vencimiento.isoformat() if g.fecha_vencimiento else None,
            "estado": g.estado, "desglose": g.detalle, "source": "finanzas"
        })
    return result

@router.get("/avisos")
def avisos(r: ResidentePortal=Depends(get_residente), db: Session=Depends(get_db)):
    avs = db.query(Aviso).filter(Aviso.tenant_id==r.tenant_id).order_by(desc(Aviso.created_at)).limit(50).all()
    leidos = {l.aviso_id for l in db.query(AvisoLectura).filter(AvisoLectura.residente_rut==r.rut).all()}
    return [{"id": a.id, "titulo": a.titulo, "cuerpo": a.contenido, "tipo": a.tipo,
             "fecha": a.created_at.isoformat() if a.created_at else None,
             "leido": a.id in leidos} for a in avs]

@router.post("/avisos/{aviso_id}/leer")
def leer_aviso(aviso_id: int, r: ResidentePortal=Depends(get_residente), db: Session=Depends(get_db)):
    existing = db.query(AvisoLectura).filter(
        AvisoLectura.aviso_id==aviso_id, AvisoLectura.residente_rut==r.rut
    ).first()
    if not existing:
        db.add(AvisoLectura(aviso_id=aviso_id, residente_rut=r.rut))
        db.commit()
    return {"ok": True}

@router.post("/qr/visita")
def generar_qr(data: dict, r: ResidentePortal=Depends(get_residente), db: Session=Depends(get_db)):
    try:
        from app.models.acceso import VisitaQR
        horas = int(data.get("horas_validez", 24))
        # VisitaQR uses qr_token, fecha_visita, condominio_id (required), departamento_id
        # condominio_id is required (NOT NULL) - use residente's or fallback to 1
        condo_id = r.condominio_id or 1
        fecha_visita = datetime.utcnow() + timedelta(hours=horas)
        visita = VisitaQR(
            condominio_id=condo_id,
            departamento_id=r.departamento_id,
            nombre_visitante=data.get("nombre_visita", "Visita"),
            rut_visitante=data.get("rut_visita", ""),
            motivo=data.get("motivo", "Visita"),
            fecha_visita=fecha_visita,
            estado="pendiente",
            creado_por=r.id
        )
        db.add(visita); db.commit(); db.refresh(visita)
        app_url = os.getenv("APP_URL", "https://conectaai.cl")
        token = visita.qr_token
        return {"token": token, "url": f"{app_url}/acceso/qr/{token}", "expira": fecha_visita.isoformat()}
    except Exception as e:
        raise HTTPException(500, f"Error generando QR: {str(e)}")

@router.get("/qr/mis-visitas")
def mis_visitas(r: ResidentePortal=Depends(get_residente), db: Session=Depends(get_db)):
    try:
        from app.models.acceso import VisitaQR
        visitas = db.query(VisitaQR).filter(
            VisitaQR.departamento_id==r.departamento_id
        ).order_by(desc(VisitaQR.created_at)).limit(20).all()
        result = []
        for v in visitas:
            result.append({
                "id": v.id, "estado": v.estado, "token": v.qr_token,
                "nombre_visitante": v.nombre_visitante, "motivo": v.motivo,
                "creado_en": v.created_at.isoformat() if v.created_at else None
            })
        return result
    except Exception:
        return []




@router.delete("/qr/visita/{visita_id}")
def eliminar_visita(visita_id: int, clave: str, r: ResidentePortal=Depends(get_residente), db: Session=Depends(get_db)):
    """Eliminar visita QR con clave de seguridad."""
    import os
    DELETE_KEY = os.getenv("PORTAL_DELETE_KEY", "Borrar2024!")
    if clave != DELETE_KEY:
        raise HTTPException(403, "Clave de borrado incorrecta")
    try:
        from app.models.acceso import VisitaQR
        visita = db.query(VisitaQR).filter(
            VisitaQR.id == visita_id,
            VisitaQR.departamento_id == r.departamento_id
        ).first()
        if not visita:
            raise HTTPException(404, "Visita no encontrada")
        db.delete(visita)
        db.commit()
        return {"ok": True, "mensaje": "Visita eliminada"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Error eliminando visita: {str(e)}")

@router.get("/cuenta/pdf")
async def download_estado_cuenta_pdf(db: Session = Depends(get_db),
                                     r: ResidentePortal = Depends(get_residente)):
    """Download estado de cuenta as PDF — requires authenticated resident session."""
    from fastapi.responses import StreamingResponse
    from app.services.pdf_service import generar_estado_cuenta_pdf
    from app.models.estructura import Departamento
    if not r.activo:
        raise HTTPException(401, "Cuenta inactiva")
    gastos = []
    if r.departamento_id:
        raw = db.query(GastoComun).filter(
            or_(GastoComun.departamento_id == r.departamento_id, GastoComun.departamento_id == None)
        ).order_by(desc(GastoComun.created_at)).limit(24).all()
        for g in raw:
            mes_label = str(g.mes).zfill(2) + "/" + str(g.anio) if g.mes and g.anio else "-"
            gastos.append({
                "mes": mes_label,
                "categoria": g.descripcion or "Gasto Comun",
                "monto": float(g.monto_total or 0),
                "estado": g.estado,
            })
    depto_num = ""
    if r.departamento_id:
        depto = db.query(Departamento).filter(Departamento.id == r.departamento_id).first()
        if depto:
            depto_num = depto.numero or str(r.departamento_id)
    pdf_data = {
        "residente_nombre": r.nombre_completo,
        "rut": r.rut,
        "departamento": depto_num,
        "gastos": gastos,
    }
    pdf_bytes = generar_estado_cuenta_pdf(pdf_data)
    filename = "estado_cuenta_" + r.rut.replace("-", "").replace(".", "") + ".pdf"
    return StreamingResponse(
        iter([pdf_bytes]),
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=" + filename}
    )
