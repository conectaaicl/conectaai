from fastapi import APIRouter, Depends, HTTPException, Form, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional
from datetime import datetime, date
from app.core.database import get_db
from app.models.biometrico import DispositivoBiometrico, HuellaDigital, RegistroBiometrico

router = APIRouter(prefix="/api/biometrico", tags=["biometrico"])

# --- Dispositivos ---

@router.get("/dispositivos")
def list_dispositivos(tenant_id: int = Query(...), db: Session = Depends(get_db)):
    devs = db.query(DispositivoBiometrico).filter(
        DispositivoBiometrico.tenant_id == tenant_id,
        DispositivoBiometrico.activo == True
    ).order_by(DispositivoBiometrico.id.desc()).all()
    return [{
        "id": d.id, "nombre": d.nombre, "tipo": d.tipo,
        "ubicacion": d.ubicacion, "device_id": d.device_id,
        "activo": d.activo, "created_at": d.created_at
    } for d in devs]

@router.post("/dispositivos")
def create_dispositivo(
    tenant_id: int = Form(...),
    nombre: str = Form(...),
    tipo: str = Form(...),
    ubicacion: str = Form(""),
    device_id: str = Form(...),
    db: Session = Depends(get_db)
):
    existing = db.query(DispositivoBiometrico).filter(DispositivoBiometrico.device_id == device_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="device_id ya registrado")
    dev = DispositivoBiometrico(
        tenant_id=tenant_id, nombre=nombre, tipo=tipo,
        ubicacion=ubicacion, device_id=device_id
    )
    db.add(dev)
    db.commit()
    db.refresh(dev)
    return {"ok": True, "id": dev.id}

@router.delete("/dispositivos/{id}")
def delete_dispositivo(id: int, db: Session = Depends(get_db)):
    dev = db.query(DispositivoBiometrico).filter(DispositivoBiometrico.id == id).first()
    if not dev:
        raise HTTPException(status_code=404, detail="No encontrado")
    dev.activo = False
    db.commit()
    return {"ok": True}

# --- Huellas ---

@router.get("/huellas")
def list_huellas(tenant_id: int = Query(...), db: Session = Depends(get_db)):
    huellas = db.query(HuellaDigital).filter(
        HuellaDigital.tenant_id == tenant_id
    ).order_by(HuellaDigital.id.desc()).all()
    return [{
        "id": h.id, "empleado_id": h.empleado_id, "empleado_nombre": h.empleado_nombre,
        "dedo": h.dedo, "activo": h.activo, "created_at": h.created_at
    } for h in huellas]

@router.post("/huellas")
def enroll_huella(
    tenant_id: int = Form(...),
    empleado_id: int = Form(...),
    empleado_nombre: str = Form(...),
    dedo: str = Form("indice_der"),
    template_hash: str = Form(""),
    db: Session = Depends(get_db)
):
    h = HuellaDigital(
        tenant_id=tenant_id, empleado_id=empleado_id,
        empleado_nombre=empleado_nombre, dedo=dedo,
        template_hash=template_hash
    )
    db.add(h)
    db.commit()
    db.refresh(h)
    return {"ok": True, "id": h.id}

@router.delete("/huellas/{id}")
def delete_huella(id: int, db: Session = Depends(get_db)):
    h = db.query(HuellaDigital).filter(HuellaDigital.id == id).first()
    if not h:
        raise HTTPException(status_code=404, detail="No encontrado")
    h.activo = False
    db.commit()
    return {"ok": True}

# --- Webhook hardware ---

@router.post("/evento")
def hardware_evento(payload: dict, db: Session = Depends(get_db)):
    device_id = payload.get("device_id", "")
    empleado_id = payload.get("empleado_id")
    tarjeta_uid = payload.get("tarjeta_uid", "")
    metodo = payload.get("metodo", "rfid")
    ts = payload.get("timestamp")

    if ts:
        try:
            fecha_hora = datetime.fromisoformat(str(ts))
        except Exception:
            fecha_hora = datetime.now()
    else:
        fecha_hora = datetime.now()

    dev = db.query(DispositivoBiometrico).filter(DispositivoBiometrico.device_id == device_id).first()
    tenant_id = dev.tenant_id if dev else 1

    empleado_nombre = payload.get("empleado_nombre", "")
    if not empleado_nombre and empleado_id:
        huella = db.query(HuellaDigital).filter(
            HuellaDigital.empleado_id == empleado_id,
            HuellaDigital.activo == True
        ).first()
        if huella:
            empleado_nombre = huella.empleado_nombre

    tipo_override = payload.get("tipo")
    if tipo_override:
        tipo = tipo_override
    else:
        hoy = fecha_hora.date()
        last = db.query(RegistroBiometrico).filter(
            RegistroBiometrico.empleado_id == empleado_id,
            text("DATE(fecha_hora) = :hoy")
        ).params(hoy=hoy).order_by(RegistroBiometrico.fecha_hora.desc()).first()
        if last and last.tipo == "entrada":
            tipo = "salida"
        else:
            tipo = "entrada"

    reg = RegistroBiometrico(
        tenant_id=tenant_id,
        empleado_id=empleado_id,
        empleado_nombre=empleado_nombre,
        dispositivo_id=device_id,
        tipo=tipo,
        metodo=metodo,
        tarjeta_uid=tarjeta_uid,
        verificado=True,
        fecha_hora=fecha_hora
    )
    db.add(reg)
    db.commit()
    return {"ok": True, "accion": tipo, "empleado_nombre": empleado_nombre}

# --- Registros ---

@router.get("/registros")
def list_registros(
    tenant_id: int = Query(...),
    fecha_desde: Optional[str] = Query(None),
    fecha_hasta: Optional[str] = Query(None),
    empleado_id: Optional[int] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db)
):
    q = db.query(RegistroBiometrico).filter(RegistroBiometrico.tenant_id == tenant_id)
    if fecha_desde:
        q = q.filter(RegistroBiometrico.fecha_hora >= fecha_desde)
    if fecha_hasta:
        q = q.filter(RegistroBiometrico.fecha_hora <= fecha_hasta + " 23:59:59")
    if empleado_id:
        q = q.filter(RegistroBiometrico.empleado_id == empleado_id)
    total = q.count()
    items = q.order_by(RegistroBiometrico.fecha_hora.desc()).offset((page-1)*per_page).limit(per_page).all()
    return {
        "total": total, "page": page, "per_page": per_page,
        "items": [{
            "id": r.id, "empleado_id": r.empleado_id, "empleado_nombre": r.empleado_nombre,
            "dispositivo_id": r.dispositivo_id, "tipo": r.tipo, "metodo": r.metodo,
            "tarjeta_uid": r.tarjeta_uid, "verificado": r.verificado,
            "observacion": r.observacion, "fecha_hora": r.fecha_hora
        } for r in items]
    }

@router.post("/registros")
def create_registro(
    tenant_id: int = Form(...),
    empleado_id: Optional[int] = Form(None),
    empleado_nombre: str = Form(""),
    dispositivo_id: str = Form(""),
    tipo: str = Form("entrada"),
    metodo: str = Form("manual"),
    tarjeta_uid: str = Form(""),
    observacion: str = Form(""),
    fecha_hora: str = Form(""),
    db: Session = Depends(get_db)
):
    fh = datetime.fromisoformat(fecha_hora) if fecha_hora else datetime.now()
    reg = RegistroBiometrico(
        tenant_id=tenant_id, empleado_id=empleado_id,
        empleado_nombre=empleado_nombre, dispositivo_id=dispositivo_id,
        tipo=tipo, metodo=metodo, tarjeta_uid=tarjeta_uid,
        observacion=observacion, fecha_hora=fh
    )
    db.add(reg)
    db.commit()
    db.refresh(reg)
    return {"ok": True, "id": reg.id}

@router.delete("/registros/{id}")
def delete_registro(id: int, db: Session = Depends(get_db)):
    r = db.query(RegistroBiometrico).filter(RegistroBiometrico.id == id).first()
    if not r:
        raise HTTPException(status_code=404, detail="No encontrado")
    db.delete(r)
    db.commit()
    return {"ok": True}

# --- Resumen mensual ---

@router.get("/resumen")
def resumen_mensual(
    tenant_id: int = Query(...),
    mes: str = Query(..., description="YYYY-MM"),
    db: Session = Depends(get_db)
):
    try:
        year, month = int(mes[:4]), int(mes[5:7])
    except Exception:
        raise HTTPException(status_code=400, detail="mes debe ser YYYY-MM")

    fecha_inicio = date(year, month, 1)
    if month == 12:
        fecha_fin = date(year + 1, 1, 1)
    else:
        fecha_fin = date(year, month + 1, 1)
    dias_en_mes = (fecha_fin - fecha_inicio).days

    registros = db.query(RegistroBiometrico).filter(
        RegistroBiometrico.tenant_id == tenant_id,
        RegistroBiometrico.fecha_hora >= datetime(year, month, 1),
        RegistroBiometrico.fecha_hora < datetime(fecha_fin.year, fecha_fin.month, 1)
    ).order_by(RegistroBiometrico.fecha_hora).all()

    empleados: dict = {}
    for r in registros:
        eid = r.empleado_id or 0
        if eid not in empleados:
            empleados[eid] = {"nombre": r.empleado_nombre, "registros": []}
        empleados[eid]["registros"].append(r)

    resultado = []
    for eid, data in empleados.items():
        dias_set: set = set()
        tardanzas = 0
        horas_totales = 0.0
        entradas = []

        dias: dict = {}
        for r in data["registros"]:
            d = r.fecha_hora.date()
            if d not in dias:
                dias[d] = []
            dias[d].append(r)

        for d, day_recs in dias.items():
            dias_set.add(d)
            entradas_dia = [r for r in day_recs if r.tipo == "entrada"]
            salidas_dia = [r for r in day_recs if r.tipo == "salida"]

            if entradas_dia:
                primera_entrada = min(entradas_dia, key=lambda x: x.fecha_hora)
                entradas.append(primera_entrada.fecha_hora)
                if primera_entrada.fecha_hora.hour > 9 or (
                    primera_entrada.fecha_hora.hour == 9 and primera_entrada.fecha_hora.minute > 0
                ):
                    tardanzas += 1

            ent_sorted = sorted(entradas_dia, key=lambda x: x.fecha_hora)
            sal_sorted = sorted(salidas_dia, key=lambda x: x.fecha_hora)
            for i, ent in enumerate(ent_sorted):
                if i < len(sal_sorted):
                    diff = (sal_sorted[i].fecha_hora - ent.fecha_hora).total_seconds() / 3600
                    if 0 < diff < 24:
                        horas_totales += diff

        dias_trabajados = len(dias_set)
        ausencias = max(0, dias_en_mes - dias_trabajados)
        promedio_entrada = ""
        if entradas:
            avg_seconds = sum(
                e.hour * 3600 + e.minute * 60 + e.second for e in entradas
            ) // len(entradas)
            h = avg_seconds // 3600
            m = (avg_seconds % 3600) // 60
            promedio_entrada = f"{h:02d}:{m:02d}"

        resultado.append({
            "empleado_id": eid,
            "empleado_nombre": data["nombre"],
            "dias_trabajados": dias_trabajados,
            "dias_en_mes": dias_en_mes,
            "horas_totales": round(horas_totales, 1),
            "tardanzas": tardanzas,
            "ausencias": ausencias,
            "promedio_entrada": promedio_entrada
        })

    return resultado

# --- Asistencia hoy ---

@router.get("/asistencia-hoy")
def asistencia_hoy(tenant_id: int = Query(...), db: Session = Depends(get_db)):
    hoy = date.today()
    registros = db.query(RegistroBiometrico).filter(
        RegistroBiometrico.tenant_id == tenant_id,
        text("DATE(fecha_hora) = :hoy")
    ).params(hoy=hoy).order_by(RegistroBiometrico.fecha_hora).all()

    empleados: dict = {}
    for r in registros:
        eid = r.empleado_id or 0
        if eid not in empleados:
            empleados[eid] = {
                "empleado_id": eid,
                "empleado_nombre": r.empleado_nombre,
                "entrada": None,
                "salida": None,
                "ultimo_tipo": None
            }
        emp = empleados[eid]
        if r.tipo == "entrada" and emp["entrada"] is None:
            emp["entrada"] = r.fecha_hora
        if r.tipo == "salida":
            emp["salida"] = r.fecha_hora
        emp["ultimo_tipo"] = r.tipo

    result = []
    for eid, emp in empleados.items():
        if emp["ultimo_tipo"] == "salida":
            estado = "ausente"
        elif emp["ultimo_tipo"] == "descanso_inicio":
            estado = "en_descanso"
        elif emp["ultimo_tipo"] == "entrada":
            estado = "presente"
        else:
            estado = "ausente"

        horas = None
        if emp["entrada"] and emp["salida"]:
            diff = (emp["salida"] - emp["entrada"]).total_seconds() / 3600
            horas = round(diff, 1)
        elif emp["entrada"]:
            diff = (datetime.now() - emp["entrada"]).total_seconds() / 3600
            horas = round(diff, 1)

        result.append({
            "empleado_id": eid,
            "empleado_nombre": emp["empleado_nombre"],
            "estado": estado,
            "entrada": emp["entrada"],
            "salida": emp["salida"],
            "horas": horas
        })

    return result

@router.post("/dispositivos/{id}/regenerar-token")
def regenerar_token(id: int, db: Session = Depends(get_db)):
    import secrets
    dev = db.query(DispositivoBiometrico).filter_by(id=id).first()
    if not dev:
        raise HTTPException(404)
    # device_id stores our token in this router context
    dev.device_id = secrets.token_hex(24)
    db.commit()
    return {"token_secreto": dev.device_id}
