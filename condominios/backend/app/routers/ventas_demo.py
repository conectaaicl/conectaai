"""
Demos comerciales: copia viva del tenant plantilla (Edificio Los Alamos) por prospecto.

- clonar_tenant(): duplica tenant + condominio + estructura + datos de muestra con
  remapeo de claves foraneas; crea cuentas admin (correo del prospecto), conserje y vecino.
- estado_demo(): usado por el middleware (tenant_guard) para el "modo vitrina":
  vencido el plazo, el demo se puede ver pero no modificar.
- registrar_uso(): telemetria por rol y modulo (throttle en memoria).
- /api/demo/estado (publico por host o sesion) para el banner del frontend.
"""
import json
import logging
import os
import re
import secrets
import time
from datetime import datetime, timedelta, timezone

import bcrypt
from fastapi import APIRouter, Depends, Request
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database import get_db

router = APIRouter(prefix="/api/demo", tags=["Demo comercial"])

DEMO_DIAS = int(os.getenv("DEMO_DIAS", "5"))
TENANT_PLANTILLA = int(os.getenv("DEMO_TENANT_PLANTILLA", "10"))
DOMINIO_BASE = os.getenv("DEMO_DOMINIO_BASE", "conectaai.cl")

# Orden de copia (dependencias primero). fk_map: columna -> tabla referenciada (ya copiada).
# Solo tablas con tenant_id; las que se filtran por condominio van en _PLAN_CONDO.
_PLAN = [
    ("condominios", {}),
    ("torres", {"condominio_id": "condominios"}),
    ("pisos", {"torre_id": "torres"}),
    ("personas", {}),
    ("departamentos", {"piso_id": "pisos", "propietario_id": "personas", "residente_id": "personas"}),
    ("residentes_portal", {"departamento_id": "departamentos", "condominio_id": "condominios"}),
    ("bodegas", {"condominio_id": "condominios", "departamento_id": "departamentos"}),
    ("estacionamientos", {"condominio_id": "condominios", "departamento_id": "departamentos"}),
    ("puertas", {"condominio_id": "condominios"}),
    ("avisos", {"condominio_id": "condominios"}),
    ("visitas", {"condominio_id": "condominios"}),
    ("paqueteria", {"condominio_id": "condominios", "persona_id": "personas"}),
    ("incidencias", {"condominio_id": "condominios", "departamento_id": "departamentos"}),
    ("gastos_periodos", {"condominio_id": "condominios"}),
    ("gastos_items", {"periodo_id": "gastos_periodos"}),
    ("gastos_cobros", {"periodo_id": "gastos_periodos", "departamento_id": "departamentos", "persona_id": "personas"}),
    ("gastos_fondo_reserva", {"condominio_id": "condominios"}),
    ("egresos_condominio", {"condominio_id": "condominios"}),
    ("presupuesto_categorias", {"condominio_id": "condominios"}),
    ("presupuesto_anual", {"condominio_id": "condominios", "categoria_id": "presupuesto_categorias"}),
    ("vehiculos", {"departamento_id": "departamentos"}),
    ("activos_mantencion", {"condominio_id": "condominios"}),
    ("mantenciones_reportes", {"activo_id": "activos_mantencion"}),
    ("votaciones", {"condominio_id": "condominios"}),
    ("documentos", {"condominio_id": "condominios"}),
    ("multas", {"persona_id": "personas", "departamento_id": "departamentos"}),
    ("mascotas", {"persona_id": "personas", "departamento_id": "departamentos"}),
    ("convenios_pago", {"departamento_id": "departamentos"}),
    ("ordenes_trabajo", {"condominio_id": "condominios"}),
    ("proveedores", {"condominio_id": "condominios"}),
    ("registros_acceso_puertas", {"puerta_id": "puertas"}),
    ("qr_credenciales", {"residente_portal_id": "residentes_portal"}),
    ("tenant_features", {}),
]
# Tablas con tenant_id que NO se copian a proposito (cuentas, bitacoras): no generan aviso.
_IGNORAR = {"usuarios", "historial_eventos", "tenants", "push_subscriptions", "alertas_sistema", "ventas_demos"}
# Tablas sin tenant_id: (tabla, columna de filtro, tabla del filtro, fk_map)
_PLAN_CONDO = [
    ("espacios_comunes", "condominio_id", "condominios", {"condominio_id": "condominios"}),
    ("reservas", "espacio_id", "espacios_comunes", {"espacio_id": "espacios_comunes", "departamento_id": "departamentos", "persona_id": "personas"}),
    ("visitas_qr", "condominio_id", "condominios", {"condominio_id": "condominios", "departamento_id": "departamentos"}),
    ("convenios_cuotas", "convenio_id", "convenios_pago", {"convenio_id": "convenios_pago"}),
    ("gastos_comunes", "departamento_id", "departamentos", {"departamento_id": "departamentos"}),
]
# Claves dentro de columnas JSON que guardan ids de otras tablas: tabla -> columna -> {clave: tabla referenciada}
_JSON_REMAP = {"personas": {"datos_contacto": {"condominio_id": "condominios", "departamento_id": "departamentos"}}}
# Columnas que no se copian (secretos / tokens unicos) -> se regeneran o quedan NULL
_REGEN = {"qr_token": lambda: secrets.token_urlsafe(16), "webhook_secret": lambda: None, "codigo_seguimiento": None, "secret": lambda: secrets.token_urlsafe(24)}


def slugify(s: str) -> str:
    s = (s or "").lower()
    s = re.sub(r"[áàä]", "a", s); s = re.sub(r"[éèë]", "e", s); s = re.sub(r"[íìï]", "i", s)
    s = re.sub(r"[óòö]", "o", s); s = re.sub(r"[úùü]", "u", s); s = s.replace("ñ", "n")
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return re.sub(r"-{2,}", "-", s)[:30] or "demo"


def gen_password(n: int = 10) -> str:
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"
    core = "".join(secrets.choice(alphabet) for _ in range(n - 2))
    return core[:4] + secrets.choice("!#$%") + core[4:] + secrets.choice("23456789")


def _hash(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt(rounds=12)).decode()


_COLS_CACHE: dict = {}


def _cols(db: Session, table: str):
    return list(_coltypes(db, table).keys())


def _coltypes(db: Session, table: str) -> dict:
    if table not in _COLS_CACHE:
        rows = db.execute(text("SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name=:t ORDER BY ordinal_position"), {"t": table}).fetchall()
        _COLS_CACHE[table] = {r[0]: r[1] for r in rows}
    return _COLS_CACHE[table]


_FK_CACHE: dict = {}


def _fks_reales(db: Session, table: str) -> dict:
    """FKs declaradas en Postgres: columna -> (tabla referenciada, nullable). Complementa el mapa escrito a mano."""
    if table not in _FK_CACHE:
        rows = db.execute(text("""
            SELECT kcu.column_name, ccu.table_name, c.is_nullable
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu ON tc.constraint_name=kcu.constraint_name AND tc.table_schema=kcu.table_schema
            JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name=tc.constraint_name
            JOIN information_schema.columns c ON c.table_schema=tc.table_schema AND c.table_name=tc.table_name AND c.column_name=kcu.column_name
            WHERE tc.constraint_type='FOREIGN KEY' AND tc.table_schema='public' AND tc.table_name=:t"""), {"t": table}).fetchall()
        _FK_CACHE[table] = {r[0]: (r[1], r[2] == "YES") for r in rows}
    return _FK_CACHE[table]


def _remap_json(v, remap: dict, maps: dict):
    """Reemplaza ids dentro de un JSON (conserva el tipo: '8' -> '12', 8 -> 12)."""
    if not isinstance(v, dict):
        return v
    out = dict(v)
    for k, ref in remap.items():
        if k in out and out[k] not in (None, ""):
            try:
                nuevo = maps.get(ref, {}).get(int(out[k]))
            except (TypeError, ValueError):
                nuevo = None
            if nuevo is not None:
                out[k] = str(nuevo) if isinstance(out[k], str) else nuevo
    return out


def _copy_rows(db: Session, table: str, rows, fk_map: dict, maps: dict, new_tid: int, has_tenant: bool, saltadas: dict | None = None):
    types = _coltypes(db, table)
    cols = list(types.keys())
    has_id = "id" in cols
    ins_cols = [c for c in cols if c != "id"]
    maps.setdefault(table, {})
    reales = _fks_reales(db, table)
    # FKs reales solo hacia tablas que tambien se copian; las que apuntan a catalogos globales (features, etc.) se conservan tal cual
    copiadas = {t for t, _ in _PLAN} | {t[0] for t in _PLAN_CONDO}
    fks = {**{c: t for c, (t, _) in reales.items() if t in copiadas}, **fk_map}   # lo escrito a mano manda
    nullable = {c: n for c, (_, n) in reales.items()}
    json_remap = _JSON_REMAP.get(table, {})
    for r in rows:
        m = dict(r._mapping)
        data = {}
        skip = False
        for c in ins_cols:
            v = m.get(c)
            if c == "tenant_id" and has_tenant:
                v = new_tid
            elif c in fks and v is not None:
                v = maps.get(fks[c], {}).get(v)
                if v is None and not nullable.get(c, True):
                    skip = True  # FK obligatoria sin origen copiado
            elif c in json_remap and v is not None:
                v = _remap_json(v if not isinstance(v, str) else json.loads(v), json_remap[c], maps)
            elif c in _REGEN and v is not None:
                gen = _REGEN[c]
                v = gen() if gen else None
            elif c == "cobros_ids" and isinstance(v, list):
                v = [maps.get("gastos_cobros", {}).get(x, x) for x in v]
            if isinstance(v, (dict, list)) and types.get(c) != "ARRAY":
                v = json.dumps(v)
            data[c] = v
        if skip:
            if saltadas is not None: saltadas[table] = saltadas.get(table, 0) + 1
            continue
        sql = f"INSERT INTO {table} ({', '.join(data)}) VALUES ({', '.join(':' + c for c in data)})" + (" RETURNING id" if has_id else "")
        res = db.execute(text(sql), data)
        if has_id:
            maps[table][m["id"]] = res.scalar()


def clonar_tenant(db: Session, *, nombre: str, direccion: str, comuna: str, email_admin: str, nombre_admin: str,
                  unidades: int | None, tipo_unidad: str, dias: int = DEMO_DIAS, src_tid: int = TENANT_PLANTILLA) -> dict:
    """Crea un tenant demo a partir de la plantilla. Devuelve credenciales y datos del tenant."""
    base_slug = "demo-" + slugify(nombre)
    slug = base_slug
    n = 2
    while db.execute(text("SELECT 1 FROM tenants WHERE subdominio=:s"), {"s": slug}).fetchone():
        slug = f"{base_slug}-{n}"; n += 1
    dominio = f"{slug}.{DOMINIO_BASE}"
    vence = datetime.now(timezone.utc) + timedelta(days=dias)

    src = db.execute(text("SELECT * FROM tenants WHERE id=:t"), {"t": src_tid}).fetchone()
    if not src:
        raise RuntimeError("Tenant plantilla no existe")
    sm = dict(src._mapping)
    meta = sm.get("metadata") or {}
    if isinstance(meta, str):
        try: meta = json.loads(meta)
        except Exception: meta = {}
    meta = {k: v for k, v in meta.items() if k not in ("clave_visitas_hash",)}
    meta.update({"brand_name": nombre, "demo": {"vence": vence.isoformat(), "email": email_admin, "creado": datetime.now(timezone.utc).isoformat(), "plantilla": src_tid}})
    tcols = [c for c in _cols(db, "tenants") if c != "id"]
    tdata = {c: sm.get(c) for c in tcols}
    tdata.update({"nombre": nombre, "subdominio": slug, "dominio": dominio, "email_contacto": email_admin, "plan": "demo",
                  "estado": "activo", "fecha_inicio": datetime.now(timezone.utc).date(), "fecha_vencimiento": vence.date(),
                  "metadata": json.dumps(meta), "created_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc),
                  "logo_url": None, "favicon_url": None})
    for k in ("smtp_password", "flow_api_key_enc", "flow_secret_enc", "mp_access_token_enc", "mp_public_key_enc", "meta_access_token_enc", "sms_credenciales_enc"):
        if k in tdata: tdata[k] = None
    for k, v in list(tdata.items()):
        if isinstance(v, (dict, list)): tdata[k] = json.dumps(v)
    new_tid = db.execute(text(f"INSERT INTO tenants ({', '.join(tdata)}) VALUES ({', '.join(':' + c for c in tdata)}) RETURNING id"), tdata).scalar()

    maps: dict = {"tenants": {src_tid: new_tid}}
    saltadas: dict = {}
    origen: dict = {}
    for table, fk in _PLAN:
        if not _cols(db, table):
            continue  # tabla aun no creada en esta BD
        rows = db.execute(text(f"SELECT * FROM {table} WHERE tenant_id=:t ORDER BY id"), {"t": src_tid}).fetchall() if "id" in _cols(db, table) \
            else db.execute(text(f"SELECT * FROM {table} WHERE tenant_id=:t"), {"t": src_tid}).fetchall()
        origen[table] = len(rows)
        _copy_rows(db, table, rows, fk, maps, new_tid, True, saltadas)
    for table, fcol, ftable, fk in _PLAN_CONDO:
        ids = list(maps.get(ftable, {}).keys())
        if not ids or not _cols(db, table):
            continue
        rows = db.execute(text(f"SELECT * FROM {table} WHERE {fcol} = ANY(:ids) ORDER BY id"), {"ids": ids}).fetchall()
        origen[table] = len(rows)
        _copy_rows(db, table, rows, fk, maps, new_tid, False, saltadas)
    advertencias = _verificar_clon(db, src_tid, origen, maps, saltadas)

    # El condominio toma el nombre y direccion del prospecto
    condo_ids = list(maps["condominios"].values())
    if condo_ids:
        db.execute(text("UPDATE condominios SET nombre=:n, direccion=COALESCE(NULLIF(:d,''), direccion), comuna=COALESCE(NULLIF(:c,''), comuna), "
                        "administrador_nombre=:an, administrador_email=:ae, tipo=COALESCE(:tipo, tipo), logo_url=NULL WHERE id = ANY(:ids)"),
                   {"n": nombre, "d": direccion or "", "c": comuna or "", "an": nombre_admin, "ae": email_admin, "tipo": tipo_unidad, "ids": condo_ids})

    # Cuentas: admin (correo del prospecto), conserje y vecino de muestra
    admin_pw, cons_pw, res_pw = gen_password(), gen_password(), gen_password(8)
    admin_email = email_admin.strip().lower()
    if db.execute(text("SELECT 1 FROM usuarios WHERE email=:e"), {"e": admin_email}).fetchone():
        local, _, dom = admin_email.partition("@")
        admin_email = f"{local}+{slug}@{dom}"
    cons_email = f"conserje@{dominio}"
    now = datetime.now(timezone.utc)
    db.execute(text("INSERT INTO usuarios (email, password_hash, nombre_completo, rol, activo, tenant_id, extra, created_at, updated_at) "
                    "VALUES (:e, :pw, :n, 'admin', true, :tid, :x, :now, :now)"),
               {"e": admin_email, "pw": _hash(admin_pw), "n": nombre_admin or "Administrador", "tid": new_tid, "x": json.dumps({"demo": True}), "now": now})
    db.execute(text("INSERT INTO usuarios (email, password_hash, nombre_completo, rol, activo, tenant_id, extra, created_at, updated_at) "
                    "VALUES (:e, :pw, 'Conserje Demo', 'conserje', true, :tid, :x, :now, :now)"),
               {"e": cons_email, "pw": _hash(cons_pw), "tid": new_tid, "x": json.dumps({"demo": True}), "now": now})
    res = db.execute(text("SELECT id, rut, nombre_completo FROM residentes_portal WHERE tenant_id=:t AND departamento_id IS NOT NULL ORDER BY id LIMIT 1"), {"t": new_tid}).fetchone()
    residente = None
    if res:
        db.execute(text("UPDATE residentes_portal SET password_hash=:h, email=:e, failed_attempts=0, locked_until=NULL WHERE id=:id"), {"h": _hash(res_pw), "e": email_admin, "id": res[0]})
        residente = {"rut": res[1], "nombre": res[2], "password": res_pw}
    db.commit()
    return {
        "tenant_id": new_tid, "subdominio": slug, "dominio": dominio, "vence": vence.isoformat(),
        "admin": {"url": f"https://{dominio}/login", "email": admin_email, "password": admin_pw},
        "conserje": {"url": f"https://{dominio}/conserje/login", "email": cons_email, "password": cons_pw},
        "residente": {"url": f"https://{dominio}/portal/login", **(residente or {})},
        "copiado": {t: len(m) for t, m in maps.items() if m},
        "advertencias": advertencias,
    }


def _verificar_clon(db: Session, src_tid: int, origen: dict, maps: dict, saltadas: dict) -> list:
    """Post-clon: filas saltadas, conteos origen vs copiadas y tablas con tenant_id con datos en la plantilla fuera del plan."""
    avisos = []
    for t, n in saltadas.items():
        avisos.append(f"{t}: {n} fila(s) saltada(s) por FK sin origen")
    for t, n in origen.items():
        c = len(maps.get(t, {}))
        if "id" in _cols(db, t) and c != n - saltadas.get(t, 0):
            avisos.append(f"{t}: origen {n}, copiadas {c}")
    planificadas = {t for t, _ in _PLAN} | {t[0] for t in _PLAN_CONDO} | _IGNORAR
    con_tenant = [r[0] for r in db.execute(text("SELECT DISTINCT table_name FROM information_schema.columns WHERE table_schema='public' AND column_name='tenant_id'")).fetchall()]
    for t in con_tenant:
        if t in planificadas:
            continue
        n = db.execute(text(f"SELECT count(*) FROM {t} WHERE tenant_id=:t"), {"t": src_tid}).scalar()
        if n:
            avisos.append(f"{t}: {n} fila(s) en la plantilla y la tabla no esta en el plan de copia")
    if avisos:
        logging.getLogger("ventas_demo").warning("clon tenant %s: %s", src_tid, " | ".join(avisos))
    return avisos


def borrar_tenant(db: Session, tid: int) -> dict:
    """Borrado FISICO de un tenant demo (pruebas y purga). Nunca la plantilla ni tenants que no sean demo.
    1) tablas sin tenant_id que cuelgan (por FK real) de tablas con tenant_id, 2) tablas con tenant_id, 3) el tenant.
    Se hacen varias pasadas con savepoints para respetar el orden de dependencias sin mantener una lista a mano."""
    if tid == TENANT_PLANTILLA:
        raise RuntimeError("No se borra la plantilla")
    plan = db.execute(text("SELECT plan FROM tenants WHERE id=:t"), {"t": tid}).scalar()
    if plan != "demo":
        raise RuntimeError("Solo se borran tenants demo")
    con_tenant = {r[0] for r in db.execute(text("SELECT DISTINCT table_name FROM information_schema.columns WHERE table_schema='public' AND column_name='tenant_id'")).fetchall()} - {"tenants"}
    fks = db.execute(text("""
        SELECT tc.table_name, kcu.column_name, ccu.table_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name=kcu.constraint_name AND tc.table_schema=kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name=tc.constraint_name
        WHERE tc.constraint_type='FOREIGN KEY' AND tc.table_schema='public'""")).fetchall()
    borrado: dict = {}

    def intentar(sql: str, params: dict, clave: str) -> bool:
        sp = db.begin_nested()
        try:
            n = db.execute(text(sql), params).rowcount
            sp.commit()
            if n: borrado[clave] = borrado.get(clave, 0) + n
            return True
        except Exception:
            sp.rollback()
            return False

    # 1) hijos sin tenant_id de tablas con tenant_id (y nietos: espacios_comunes -> reservas), varias pasadas
    hijos = [(t, c, ref) for t, c, ref in fks if t not in con_tenant and ref in con_tenant]
    nietos = [(t, c, ref) for t, c, ref in fks if t not in con_tenant and ref not in con_tenant and ref != "tenants"]
    for _ in range(4):
        pendiente = False
        for t, c, ref in nietos:
            for t2, c2, ref2 in hijos:
                if t2 == ref:
                    if not intentar(f"DELETE FROM {t} WHERE {c} IN (SELECT id FROM {ref} WHERE {c2} IN (SELECT id FROM {ref2} WHERE tenant_id=:t))", {"t": tid}, t): pendiente = True
        for t, c, ref in hijos:
            if not intentar(f"DELETE FROM {t} WHERE {c} IN (SELECT id FROM {ref} WHERE tenant_id=:t)", {"t": tid}, t): pendiente = True
        if not pendiente: break
    # 2) tablas con tenant_id, en orden inverso al plan y luego el resto, con pasadas hasta que no quede nada
    orden = [t for t, _ in reversed(_PLAN)] + sorted(con_tenant - {t for t, _ in _PLAN})
    for _ in range(6):
        pendiente = False
        for t in orden:
            if t in con_tenant and not intentar(f"DELETE FROM {t} WHERE tenant_id=:t", {"t": tid}, t): pendiente = True
        if not pendiente: break
    if not intentar("DELETE FROM tenants WHERE id=:t", {"t": tid}, "tenants"):
        db.rollback()
        raise RuntimeError("No se pudo borrar el tenant: quedan filas que lo referencian")
    db.commit()
    _CACHE.pop(tid, None)
    return borrado


def extender_demo(db: Session, tenant_id: int, dias: int) -> str:
    row = db.execute(text("SELECT metadata FROM tenants WHERE id=:t"), {"t": tenant_id}).fetchone()
    meta = row[0] if row and row[0] else {}
    if isinstance(meta, str): meta = json.loads(meta)
    demo = meta.get("demo") or {}
    actual = datetime.fromisoformat(demo["vence"]) if demo.get("vence") else datetime.now(timezone.utc)
    if actual.tzinfo is None: actual = actual.replace(tzinfo=timezone.utc)
    base = max(actual, datetime.now(timezone.utc))
    nuevo = base + timedelta(days=dias)
    demo["vence"] = nuevo.isoformat(); meta["demo"] = demo
    db.execute(text("UPDATE tenants SET metadata=:m, fecha_vencimiento=:f, updated_at=NOW() WHERE id=:t"), {"m": json.dumps(meta), "f": nuevo.date(), "t": tenant_id})
    db.commit(); _CACHE.pop(tenant_id, None)
    return nuevo.isoformat()


def convertir_demo(db: Session, tenant_id: int) -> None:
    """El demo pasa a ser cliente: se quita el vencimiento; los datos de muestra se
    limpian despues con el wizard/estructura (se conservan cuentas y branding)."""
    row = db.execute(text("SELECT metadata FROM tenants WHERE id=:t"), {"t": tenant_id}).fetchone()
    meta = row[0] if row and row[0] else {}
    if isinstance(meta, str): meta = json.loads(meta)
    demo = meta.pop("demo", None) or {}
    meta["convertido_desde_demo"] = {"fecha": datetime.now(timezone.utc).isoformat(), "email": demo.get("email")}
    db.execute(text("UPDATE tenants SET metadata=:m, plan='profesional', fecha_vencimiento=NULL, updated_at=NOW() WHERE id=:t"), {"m": json.dumps(meta), "t": tenant_id})
    db.commit(); _CACHE.pop(tenant_id, None)


# ─── Modo vitrina (consultado por el middleware) ─────────────────────────────

_CACHE: dict = {}      # tenant_id -> (es_demo, vence_iso|None, ts)
_CACHE_TTL = 60


def estado_demo(db: Session, tenant_id: int) -> dict:
    """{'demo': bool, 'vence': iso|None, 'vencido': bool, 'dias_restantes': int|None}"""
    now = time.time()
    c = _CACHE.get(tenant_id)
    if c and now - c[2] < _CACHE_TTL:
        es_demo, vence = c[0], c[1]
    else:
        row = db.execute(text("SELECT metadata->'demo'->>'vence' FROM tenants WHERE id=:t"), {"t": tenant_id}).fetchone()
        vence = row[0] if row else None
        es_demo = bool(vence)
        _CACHE[tenant_id] = (es_demo, vence, now)
    if not es_demo:
        return {"demo": False, "vence": None, "vencido": False, "dias_restantes": None}
    v = datetime.fromisoformat(vence)
    if v.tzinfo is None: v = v.replace(tzinfo=timezone.utc)
    delta = v - datetime.now(timezone.utc)
    return {"demo": True, "vence": vence, "vencido": delta.total_seconds() < 0, "dias_restantes": max(0, delta.days + (1 if delta.seconds > 0 else 0))}


# ─── Telemetria ──────────────────────────────────────────────────────────────

_MODULOS = [
    ("/api/gastos-comunes/convenios", "Convenios de pago"), ("/api/gastos-comunes", "Gastos comunes"), ("/api/finanzas", "Finanzas"),
    ("/api/visitas", "Visitas"), ("/api/paqueteria", "Encomiendas"), ("/api/reservas", "Reservas"), ("/api/incidencias", "Incidencias"),
    ("/api/vehiculos", "Vehículos y TAG"), ("/api/mantenciones", "Mantenciones QR"), ("/api/votaciones", "Votaciones"),
    ("/api/avisos", "Avisos"), ("/api/condominios/puertas", "Puertas y accesos"), ("/api/accesos", "Accesos QR"), ("/api/presupuesto", "Presupuesto"),
    ("/api/portal/qr", "Vecinos · QR visitas"), ("/api/portal/convenio", "Vecinos · Convenio"), ("/api/portal/mis-paquetes", "Vecinos · Encomiendas"),
    ("/api/portal/mis-visitas", "Vecinos · Visitas"), ("/api/portal/reservas", "Vecinos · Reservas"), ("/api/portal/votaciones", "Vecinos · Votaciones"),
    ("/api/portal/dashboard", "Vecinos · Inicio"), ("/api/portal", "Vecinos"), ("/api/conserje", "Conserjería"), ("/api/dashboard", "Panel admin"),
]
_ULTIMO: dict = {}   # (tenant, rol, modulo) -> ts


def registrar_uso(db: Session, tenant_id: int, rol: str, path: str, method: str):
    modulo = next((m for p, m in _MODULOS if path.startswith(p)), None)
    if not modulo:
        return
    key = (tenant_id, rol, modulo)
    now = time.time()
    escritura = method not in ("GET", "HEAD", "OPTIONS")
    if not escritura and now - _ULTIMO.get(key, 0) < 600:
        return
    _ULTIMO[key] = now
    try:
        db.execute(text("INSERT INTO ventas_eventos (tenant_id, tipo, rol, detalle, created_at) VALUES (:t, :tipo, :rol, :d, NOW())"),
                   {"t": tenant_id, "tipo": "demo_accion" if escritura else "demo_modulo", "rol": rol, "d": modulo})
        db.commit()
    except Exception:
        db.rollback()


# ─── Endpoint publico para el banner ────────────────────────────────────────

@router.get("/estado")
def estado_publico(request: Request, db: Session = Depends(get_db)):
    """Estado del demo para el tenant de la sesion o del host (banner en admin/conserje/portal)."""
    tid = None
    try:
        from app.core.tenant_guard import _session_tenant
        tid, _ = _session_tenant(request)
    except Exception:
        pass
    if tid is None:
        host = (request.headers.get("x-forwarded-host") or request.headers.get("host") or "").split(":")[0]
        row = db.execute(text("SELECT id FROM tenants WHERE dominio=:h OR (subdominio || '.' || :base) = :h LIMIT 1"), {"h": host, "base": DOMINIO_BASE}).fetchone()
        tid = row[0] if row else None
    if tid is None:
        return {"demo": False}
    est = estado_demo(db, tid)
    if est["demo"]:
        est["contacto_wa"] = os.getenv("VENTAS_WA", "56998101891")
    return est
