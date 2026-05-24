# ConectaAI — Arquitectura del Sistema

## Visión General

Sistema SaaS multi-tenant para gestión de condominios, bodegas, PyMEs y coworks.  
Un tenant = una empresa/edificio. El SuperAdmin crea tenants y asigna features.

---

## Infraestructura

```
VPS: 62.169.17.214 — 6 vCPU / 12 GB RAM / 193 GB SSD
OS: Ubuntu 22.04
Reverse proxy: nginx (SSL Let's Encrypt, host)
Containers: Docker Compose — 7 servicios activos
```

---

## Mapa de Servicios

```
Internet
   │
   ▼
nginx (host) — SSL termination
   │
   ├── conectaai.cl          → frontend:3005 (Next.js 16 standalone)
   │                              │
   │                              ├── /api/features/*    → backend-condominios:8003
   │                              ├── /api/condominios/* → backend-condominios:8003
   │                              ├── /api/superadmin/*  → backend-condominios:8003
   │                              ├── /api/facial/*      → backend-facial:8000
   │                              ├── /api/pagos/*       → backend-pagos:8000
   │                              ├── /api/wa/*          → backend-wa:8000
   │                              └── /api/*             → backend-core:8006
   │
   ├── osw.conectaai.cl      → omniflow (OmniFlow CRM/WA)
   ├── shop.conectaai.cl     → tiendas SaaS (Next.js)
   ├── social.conectaai.cl   → AI Calendar, CRM, automatizaciones
   ├── seo.conectaai.cl      → SEO tools (FastAPI)
   └── suite.conectaai.cl    → NestJS suite
```

---

## Stack Técnico

### Backend Principal (`condominios/backend/`)
| Capa         | Tecnología                              |
|--------------|-----------------------------------------|
| Framework    | FastAPI 0.110 + Python 3.11             |
| ORM          | SQLAlchemy 2.0 (raw SQL vía `text`)     |
| Auth         | JWT (PyJWT) — cookie `session`          |
| Server       | Gunicorn + UvicornWorker — puerto 8003  |
| Dockerfile   | `condominios/backend/Dockerfile`        |

### Microservicios (`condominios/backend/`)
| Servicio       | Puerto Host | Puerto Container | Archivo entrada  | Módulos                   |
|----------------|-------------|------------------|------------------|---------------------------|
| backend-facial | 8013        | 8000             | micro_facial.py  | facial_recognition        |
| backend-pagos  | 8014        | 8000             | micro_pagos.py   | flow, mercadopago, online |
| backend-wa     | 8015        | 8000             | micro_wa.py      | wa_platform               |

### Frontend (`frontend/`)
| Capa         | Tecnología                              |
|--------------|-----------------------------------------|
| Framework    | Next.js 16 (App Router, standalone)     |
| UI           | Tailwind CSS v3                         |
| Auth         | Cookie `session` vía backend            |
| Proxy        | `next.config.js` rewrites → backends   |
| Puerto       | 3005                                    |

### Backend Core (`backend/`)
| Capa         | Tecnología                              |
|--------------|-----------------------------------------|
| Framework    | Node.js + Express 5                     |
| ORM          | Sequelize + PostgreSQL                  |
| Puerto       | 8006                                    |

### Base de Datos
```
PostgreSQL 16 — container conectaai_db
DB: conectaai
User: conectaai_user
Volume: conectaai_pgdata (persistente)
Backup: /var/www/conectaai/scripts/backup_condominios.sh (cron 3AM diario, 7 días retención)
```

---

## Multi-Tenant

```
tenants
  └── id, nombre, tipo (condominio|bodega|pyme|cowork), email_contacto, plan, estado

condominios       → tenant_id → tenants.id
usuarios          → tenant_id → tenants.id
feature_catalog   → catálogo global de 39 módulos con precio CLP
tenant_features   → (tenant_id, feature_key, activo) — UNIQUE(tenant_id, feature_key)
```

**Flujo de creación de tenant:**
1. SuperAdmin → `/dashboard/superadmin/features` — crea tenant con tipo
2. Preset de features se activa automáticamente según el tipo
3. Admin del tenant recibe credenciales → entra a `/dashboard`
4. Ve solo los módulos activos para su tipo
5. Llena estructura: torres → pisos → departamentos → personas

---

## Feature Flags

### Endpoints (`/api/features/`)
```
GET  /api/features              → features activos del tenant actual (desde cookie session)
GET  /api/features/catalog      → 39 features con precios CLP
GET  /api/features/tenants      → lista todos los tenants (solo superadmin)
GET  /api/features/tenant/{id}  → features de un tenant específico
POST /api/features/{key}/toggle → activar/desactivar feature (query param: tenant_id)
POST /api/features/tenant/{id}/tipo → cambiar tipo + opción resetear preset
GET  /api/features/pricing/{id} → precio mensual calculado (suma features activos pagados)
```

### Presets por tipo
| Tipo        | Features activos | Precio estimado |
|-------------|-----------------|-----------------|
| condominio  | 38              | ~$214.000 CLP/mes |
| pyme        | 13              | ~$80.000 CLP/mes  |
| cowork      | 14              | ~$90.000 CLP/mes  |
| bodega      | 10              | ~$35.000 CLP/mes  |

### Sidebar filtering
El sidebar de `/dashboard/layout.tsx` lee `/api/features` al cargar y filtra los ítems del menú:
- Ítems sin `featureKey` → siempre visibles
- Ítems con `featureKey` → visibles solo si el tenant tiene ese feature activo
- Grupo `SUPERADMIN` → solo visible para `rol === 'superadmin'`

---

## Roles y Accesos

| Rol         | Panel                    | Cookie auth  | Alcance           |
|-------------|--------------------------|-------------|-------------------|
| superadmin  | `/dashboard/superadmin`  | `session`   | Todos los tenants |
| admin       | `/dashboard`             | `session`   | Su tenant         |
| conserje    | `/conserje`              | `session`   | Su condominio     |
| residente   | `/portal`                | `session`   | Su unidad (PWA)   |

> Los endpoints `/api/superadmin/*` requieren una cookie separada `sa_session` con su propio login.  
> Los endpoints `/api/features/*` usan la cookie `session` normal y verifican `rol=superadmin`.

---

## Comandos de Deploy

```bash
# Conectar al VPS
ssh -i ~/.ssh/id_ed25519_conectaai root@62.169.17.214

# Rebuild y redeploy un servicio
cd /var/www/conectaai
docker compose build backend-condominios
docker compose up -d --force-recreate --no-deps backend-condominios

# Rebuild frontend
docker compose build frontend
docker compose up -d --force-recreate --no-deps frontend

# Ver logs en vivo
docker logs conectaai_backend_condominios --tail=50 -f
docker logs conectaai_frontend --tail=50 -f

# Estado de todos los contenedores
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Acceso a la base de datos
docker exec -it conectaai_db psql -U conectaai_user -d conectaai

# Limpiar build cache cuando el disco se llena
docker builder prune -f --filter until=24h
```

---

## Estructura de Archivos Clave

```
/var/www/conectaai/
├── docker-compose.yml                     ← orquestación completa (7 servicios)
├── ARCHITECTURE.md                        ← este archivo
├── scripts/
│   └── backup_condominios.sh              ← backup diario PostgreSQL
├── condominios/
│   └── backend/
│       ├── requirements.txt               ← dependencias Python
│       ├── Dockerfile                     ← imagen backend-condominios
│       ├── Dockerfile.facial              ← microservicio facial
│       ├── Dockerfile.pagos               ← microservicio pagos
│       ├── Dockerfile.wa                  ← microservicio WhatsApp
│       ├── micro_facial.py                ← entry point facial
│       ├── micro_pagos.py                 ← entry point pagos
│       ├── micro_wa.py                    ← entry point WA
│       └── app/
│           ├── main.py                    ← ★ registro de todos los routers
│           ├── core/
│           │   ├── database.py            ← get_db() session factory
│           │   └── features.py            ← check_feature() dependency
│           └── routers/
│               ├── features.py            ← ★ Feature Flags API (6 endpoints)
│               ├── superadmin.py          ← gestión tenants (sa_session auth)
│               ├── visitas.py
│               ├── paqueteria.py
│               └── ... (35+ routers más)
├── frontend/
│   ├── next.config.js                     ← ★ proxy rewrites → backends
│   └── app/
│       ├── dashboard/
│       │   ├── layout.tsx                 ← ★ sidebar con feature filtering
│       │   ├── page.tsx                   ← Monitor del Sistema
│       │   ├── superadmin/
│       │   │   ├── page.tsx               ← Panel SuperAdmin
│       │   │   └── features/
│       │   │       └── page.tsx           ← Feature Flags UI
│       │   └── condominios/               ← páginas de todos los módulos
│       ├── portal/                        ← PWA residentes (instalable)
│       ├── conserje/                      ← panel conserje
│       └── login/
│       hooks/
│           ├── useSession.ts              ← auth state global
│           ├── useCondominio.ts           ← condominio activo
│           └── useFeatures.tsx            ← feature flags context + cache
└── backend/                               ← backend-core (Node.js + Express)
```

---

## Agregar un Nuevo Módulo (checklist)

1. **Backend** — crear `condominios/backend/app/routers/mi_modulo.py`
2. **main.py** — `from app.routers import mi_modulo` + `app.include_router(mi_modulo.router)`
3. **feature_catalog** — insertar en DB: `INSERT INTO feature_catalog (key, label, descripcion, categoria, precio_clp) VALUES (...)`
4. **next.config.js** — agregar rewrite antes del catch-all `/api/:path*`
5. **layout.tsx** — agregar item con `featureKey: 'mi_modulo'` al NAV_GROUPS correspondiente
6. **Rebuild** — `docker compose build backend-condominios frontend && docker compose up -d --force-recreate --no-deps backend-condominios frontend`

---

## Variables de Entorno Críticas (backend-condominios)

```env
SECRET_KEY          # JWT signing key
DATABASE_URL        # postgresql://conectaai_user:...@db/conectaai
ANTHROPIC_API_KEY   # Claude IA features
META_SYSTEM_TOKEN   # WhatsApp Business API
FERNET_KEY          # cifrado simétrico de datos sensibles
VAPID_PUBLIC_KEY    # push notifications web
VAPID_PRIVATE_KEY   # push notifications web
MAIL_API_KEY        # servicio de email
APP_URL             # https://conectaai.cl
```

---

*Última actualización: 2026-05-24*
