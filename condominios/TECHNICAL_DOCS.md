# 📚 DOCUMENTACIÓN TÉCNICA - MÓDULO CONDOMINIOS

## 🎯 ARQUITECTURA DEL SISTEMA
```
┌─────────────────────────────────────────────────────────┐
│                    NGINX (Puerto 443)                   │
│                   Proxy Inverso SSL                     │
└──────────────┬──────────────────────────┬───────────────┘
               │                          │
               ▼                          ▼
    ┌──────────────────┐      ┌──────────────────┐
    │  Frontend :3000  │      │  Backend :8003   │
    │   Next.js 16     │      │   FastAPI        │
    └──────────────────┘      └────────┬─────────┘
                                       │
                                       ▼
                              ┌─────────────────┐
                              │  PostgreSQL     │
                              │  conectaai DB   │
                              └─────────────────┘
```

## 🗄️ MODELO DE DATOS

### Diagrama ER Principal
```
personas (multi-rol)
    │
    ├─── 1:N → departamentos (como propietario)
    ├─── 1:N → departamentos (como residente)
    ├─── 1:N → gastos_comunes
    ├─── 1:N → turnos
    ├─── 1:N → asistencias
    ├─── 1:N → sueldos
    ├─── 1:N → adelantos
    ├─── 1:N → evaluaciones
    └─── 1:N → equipamiento

condominios
    │
    ├─── 1:N → torres
    ├─── 1:N → estacionamientos
    └─── 1:N → bodegas

torres
    │
    └─── 1:N → pisos
            │
            └─── 1:N → departamentos
                        │
                        ├─── 1:N → estacionamientos
                        ├─── 1:N → bodegas
                        └─── 1:N → gastos_comunes
```

### Tablas Detalladas

#### personas
```sql
id SERIAL PRIMARY KEY
nombre_completo VARCHAR NOT NULL
rut VARCHAR UNIQUE NOT NULL
telefono VARCHAR NOT NULL
email VARCHAR NOT NULL
roles JSONB DEFAULT '[]'  -- Array de roles
estado VARCHAR DEFAULT 'activo'
datos_contacto JSONB
observaciones TEXT
foto_url VARCHAR
created_at TIMESTAMP
updated_at TIMESTAMP
```

**Roles posibles:**
- `propietario` - Dueño legal del departamento
- `residente` - Habitante del departamento
- `arrendatario` - Arrendatario temporal
- `conserje` - Personal de portería
- `aseo` - Personal de limpieza
- `mantencion` - Personal técnico
- `administrador` - Administrador del condominio

#### gastos_comunes
```sql
id SERIAL PRIMARY KEY
departamento_id INTEGER REFERENCES departamentos
mes INTEGER NOT NULL
anio INTEGER NOT NULL
monto_base FLOAT NOT NULL
multas FLOAT DEFAULT 0
intereses FLOAT DEFAULT 0
otros_cargos FLOAT DEFAULT 0
descuentos FLOAT DEFAULT 0
monto_total FLOAT NOT NULL
estado VARCHAR DEFAULT 'pendiente'
fecha_vencimiento TIMESTAMP NOT NULL
fecha_pago TIMESTAMP
detalle JSONB  -- [{concepto: "Agua", monto: 15000}, ...]
observaciones TEXT
comprobante_url VARCHAR
metodo_pago VARCHAR
created_at TIMESTAMP
updated_at TIMESTAMP
```

**Estados:**
- `pendiente` - No pagado, dentro de plazo
- `atrasado` - No pagado, fuera de plazo
- `pagado` - Pagado completamente

#### sueldos
```sql
id SERIAL PRIMARY KEY
persona_id INTEGER REFERENCES personas
mes INTEGER NOT NULL
anio INTEGER NOT NULL
sueldo_base FLOAT NOT NULL
horas_extra FLOAT DEFAULT 0
bonos JSONB  -- [{concepto: "Bono puntualidad", monto: 50000}]
total_haberes FLOAT NOT NULL
adelantos FLOAT DEFAULT 0
multas FLOAT DEFAULT 0
otros_descuentos JSONB
total_descuentos FLOAT DEFAULT 0
liquido_pagar FLOAT NOT NULL
estado VARCHAR DEFAULT 'pendiente'
fecha_pago TIMESTAMP
metodo_pago VARCHAR
comprobante_url VARCHAR
observaciones TEXT
created_at TIMESTAMP
updated_at TIMESTAMP
```

#### asistencias
```sql
id SERIAL PRIMARY KEY
persona_id INTEGER REFERENCES personas
fecha DATE NOT NULL
hora_entrada TIMESTAMP
hora_salida TIMESTAMP
estado VARCHAR DEFAULT 'presente'
minutos_tarde INTEGER DEFAULT 0
horas_trabajadas FLOAT DEFAULT 0
lat_entrada FLOAT
lng_entrada FLOAT
lat_salida FLOAT
lng_salida FLOAT
observaciones TEXT
created_at TIMESTAMP
```

**Estados:**
- `presente` - Asistió y llegó a tiempo
- `tarde` - Asistió pero con retraso
- `ausente` - No asistió
- `permiso` - Ausente con permiso
- `licencia` - Ausente con licencia médica

## 🔌 API REFERENCE

### Base URL
```
https://conectaai.cl/api/
```

### Autenticación
```
Header: Authorization: Bearer {token}
```

### Endpoints Principales

#### GET /api/personal/reportes/personal-activo
Retorna lista de personal activo con estadísticas del mes.

**Response:**
```json
[
  {
    "id": 6,
    "nombre": "Pedro Conserje",
    "rut": "11111111-1",
    "roles": ["conserje"],
    "asistencias_mes": 0,
    "adelantos_pendientes": 0.0,
    "evaluacion_promedio": null
  }
]
```

#### GET /api/finanzas/stats/morosidad
Retorna estadísticas de morosidad en tiempo real.

**Response:**
```json
{
  "total_gastos": 10,
  "pagados": 7,
  "pendientes": 2,
  "atrasados": 1,
  "monto_pendiente": 450000,
  "tasa_pago": 70.0
}
```

#### POST /api/finanzas/gastos-comunes/
Crea un nuevo gasto común y envía email automáticamente.

**Request:**
```json
{
  "departamento_id": 1,
  "mes": 1,
  "anio": 2026,
  "monto_base": 150000,
  "multas": 0,
  "monto_total": 150000,
  "fecha_vencimiento": "2026-01-15",
  "detalle": [
    {"concepto": "Agua", "monto": 15000},
    {"concepto": "Luz", "monto": 25000},
    {"concepto": "Gas", "monto": 10000},
    {"concepto": "Mantención", "monto": 100000}
  ]
}
```

## 🎨 COMPONENTES FRONTEND

### Estructura de Archivos
```
/opt/conectaai/frontend/app/
├── dashboard/
│   └── condominios/
│       ├── page.tsx (Dashboard principal)
│       ├── personas/
│       │   └── page.tsx (CRUD personas)
│       ├── finanzas/
│       │   └── page.tsx (Gastos comunes)
│       ├── personal/
│       │   └── page.tsx (RRHH)
│       └── estructura/
│           └── page.tsx (Torres/Deptos)
```

### Estado Global
No usamos Redux/Zustand. Cada página maneja su propio estado con `useState`.

### Fetch Pattern
```typescript
async function fetchData() {
  try {
    const res = await fetch('/api/endpoint')
    if (res.ok) {
      const data = await res.json()
      setState(data)
    }
  } catch (err) {
    console.error(err)
  } finally {
    setLoading(false)
  }
}
```

## 🔐 SEGURIDAD

### Variables de Entorno (.env)
```bash
RESEND_API_KEY=re_your_key_here
DATABASE_URL=postgresql://conectaai_user:ConectaAI2026!@localhost/conectaai
```

### CORS
Configurado en FastAPI para permitir:
- `http://localhost:3000` (desarrollo)
- `https://conectaai.cl` (producción)

### SQL Injection
Prevenido mediante SQLAlchemy ORM con prepared statements.

### XSS
Sanitizado automáticamente por React.

## 🚀 DEPLOYMENT

### Actualizar Backend
```bash
cd /opt/conectaai/condominios/backend
git pull  # si usas git
sudo systemctl restart conectaai-condominios.service
```

### Actualizar Frontend
```bash
cd /opt/conectaai/frontend
npm run build
sudo systemctl restart conectaai-frontend.service
```

### Migración de BD
```bash
# Backup primero
sudo -u postgres pg_dump conectaai > backup.sql

# Ejecutar SQL
sudo -u postgres psql conectaai < migracion.sql

# Dar permisos
sudo -u postgres psql conectaai << 'SQL'
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO conectaai_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO conectaai_user;
SQL
```

## 📊 MONITOREO

### Logs en Tiempo Real
```bash
# Backend
sudo journalctl -u conectaai-condominios.service -f

# Frontend
sudo journalctl -u conectaai-frontend.service -f

# Nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Métricas de BD
```sql
-- Ver tablas más grandes
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Queries lentas
SELECT 
    query,
    calls,
    total_exec_time / 1000 AS total_time_seconds,
    mean_exec_time / 1000 AS mean_time_seconds
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 10;
```

## 🐛 DEBUGGING

### Error: "Internal Server Error"
```bash
# Ver logs detallados
sudo journalctl -u conectaai-condominios.service -n 100 --no-pager | grep -A 10 "ERROR"
```

### Error: "Permission denied for table X"
```bash
sudo -u postgres psql conectaai << 'SQL'
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO conectaai_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO conectaai_user;
SQL
```

### Puerto ocupado
```bash
sudo lsof -i :8003
sudo kill -9 {PID}
sudo systemctl start conectaai-condominios.service
```

## 🧪 TESTING

### Test Manual de Endpoints
```bash
# Listar personal
curl https://conectaai.cl/api/personal/reportes/personal-activo

# Crear persona
curl -X POST https://conectaai.cl/api/personas/ \
  -H "Content-Type: application/json" \
  -d '{"nombre_completo":"Test","rut":"99999999-9","telefono":"+56999999999","email":"test@test.cl","roles":["conserje"]}'

# Ver gastos comunes
curl https://conectaai.cl/api/finanzas/gastos-comunes/
```

### Test de Carga
```bash
# Instalar
sudo apt install apache2-utils -y

# Test con 100 requests, 10 concurrentes
ab -n 100 -c 10 https://conectaai.cl/api/personal/reportes/personal-activo
```

## 📈 PERFORMANCE

### Optimizaciones Aplicadas
- ✅ Índices en columnas de búsqueda frecuente
- ✅ Queries con `limit` y `offset`
- ✅ Carga lazy de datos grandes
- ✅ Cache de estadísticas (próximamente)

### Bottlenecks Conocidos
- Reportes con joins complejos pueden tardar >1s
- Exportación Excel de +1000 registros >5s
- Envío masivo de emails >10s

## 🔄 CI/CD (Futuro)

### Pipeline Sugerido
```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Deploy to server
        run: |
          ssh deploy@conectaai.cl 'cd /opt/conectaai && git pull && ./deploy.sh'
```

## 📝 CHANGELOG

### v1.0.0 (16 Enero 2026)
- ✅ Sistema base completo
- ✅ 34 tablas BD
- ✅ 50+ endpoints API
- ✅ 4 módulos frontend funcionales
- ✅ Integración email Resend.com
- ✅ Exportación PDF/Excel

## 👥 EQUIPO

**Desarrollador Principal:** ConectaAI Team
**Fecha Inicio:** 12 Enero 2026
**Horas Invertidas:** 12+
**Stack:** FastAPI + PostgreSQL + Next.js 16 + TailwindCSS

## 📞 SOPORTE

**Issues:** Reportar en sistema interno
**Email:** soporte@conectaai.cl
**Documentación:** Esta carpeta `/opt/conectaai/condominios/`
