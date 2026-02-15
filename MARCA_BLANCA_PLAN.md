# 🏢 SISTEMA MARCA BLANCA - CONECTAAI CONDOMINIOS

## 📋 ESTADO ACTUAL

### ✅ LO QUE TENEMOS
1. **Sistema Condominios:** 100% funcional
2. **Panel Admin Básico:** Existe en `/dashboard/admin`
3. **Base de datos:** Tablas usuarios con roles
4. **Autenticación:** Login funcional

### ❌ LO QUE FALTA
1. **Sistema Multi-tenant:** Base de datos aislada por cliente
2. **Panel Admin Avanzado:** CRUD clientes con configuración
3. **Marca Blanca:** Logo, colores, favicon personalizables
4. **Onboarding:** Proceso registro nuevo cliente
5. **Facturación:** Planes, pagos, suscripciones

---

## 🎯 CÓMO FUNCIONA UN SISTEMA MARCA BLANCA

### Modelo de Negocio
```
┌─────────────────────────────────────────────────┐
│                  CONECTAAI                      │
│           (Super Administrador)                 │
└────────┬────────────────────────────────────────┘
         │
         ├─── Cliente 1: "Condominio Las Flores"
         │    ├─ Subdominio: lasflores.conectaai.cl
         │    ├─ Logo: logo_lasflores.png
         │    ├─ Colores: #FF5733, #33FF57
         │    ├─ Favicon: favicon_lasflores.ico
         │    └─ Plan: Premium ($150.000/mes)
         │
         ├─── Cliente 2: "Edificio Torre Norte"
         │    ├─ Subdominio: torrenorte.conectaai.cl
         │    ├─ Logo: logo_torrenorte.png
         │    ├─ Colores: #3498db, #2ecc71
         │    ├─ Favicon: favicon_torrenorte.ico
         │    └─ Plan: Básico ($80.000/mes)
         │
         └─── Cliente 3: "Condominio El Bosque"
              ├─ Subdominio: elbosque.conectaai.cl
              ├─ Logo: logo_elbosque.png
              ├─ Colores: #9b59b6, #e74c3c
              ├─ Favicon: favicon_elbosque.ico
              └─ Plan: Enterprise ($300.000/mes)
```

---

## 🏗️ ARQUITECTURA MULTI-TENANT

### Opción 1: Base de Datos Compartida (Recomendada)
```sql
-- Todas las tablas tienen tenant_id

CREATE TABLE tenants (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR NOT NULL,
    subdominio VARCHAR UNIQUE NOT NULL,
    logo_url VARCHAR,
    color_primario VARCHAR(7),
    color_secundario VARCHAR(7),
    favicon_url VARCHAR,
    plan VARCHAR DEFAULT 'basico',
    estado VARCHAR DEFAULT 'activo',
    fecha_inicio TIMESTAMP DEFAULT NOW(),
    fecha_vencimiento TIMESTAMP
);

CREATE TABLE personas (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
    nombre_completo VARCHAR NOT NULL,
    rut VARCHAR UNIQUE NOT NULL,
    -- ... resto de campos
);

CREATE TABLE condominios (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
    nombre VARCHAR NOT NULL,
    -- ... resto de campos
);
```

**Ventajas:**
- ✅ Fácil de implementar
- ✅ Mantenimiento simple
- ✅ Backups centralizados
- ✅ Un solo servidor BD

**Desventajas:**
- ❌ Riesgo filtración datos entre clientes (si falla query)
- ❌ Escalabilidad limitada

### Opción 2: Base de Datos por Cliente
```
PostgreSQL:
├─ conectaai_tenant_1
├─ conectaai_tenant_2
└─ conectaai_tenant_3
```

**Ventajas:**
- ✅ Aislamiento total
- ✅ Seguridad máxima
- ✅ Fácil migrar cliente a otro servidor

**Desventajas:**
- ❌ Complejo de mantener
- ❌ Múltiples conexiones BD
- ❌ Backups por separado

---

## 🎨 FLUJO MARCA BLANCA

### 1. Super Admin crea nuevo cliente
```typescript
// Panel Admin ConectaAI
POST /api/admin/tenants/

{
  "nombre": "Condominio Las Flores",
  "subdominio": "lasflores",
  "email_admin": "admin@lasflores.cl",
  "plan": "premium",
  "logo": <file>,
  "color_primario": "#FF5733",
  "color_secundario": "#33FF57",
  "favicon": <file>
}

Resultado:
1. Crea tenant en BD
2. Sube logo a /uploads/tenants/1/logo.png
3. Sube favicon a /uploads/tenants/1/favicon.ico
4. Crea usuario admin para el cliente
5. Envía email con credenciales
6. Configura subdomain en Nginx
```

### 2. Cliente accede a su panel
```
https://lasflores.conectaai.cl/login

Sistema detecta:
- Subdominio = "lasflores"
- Carga tenant_id = 1
- Aplica logo + colores
- Filtra TODA la data por tenant_id = 1
```

### 3. Cliente usa el sistema
```
Cliente ve SOLO su data:
- Sus personas
- Sus condominios
- Sus gastos comunes
- Su personal

Queries automáticamente filtradas:
SELECT * FROM personas WHERE tenant_id = 1
SELECT * FROM gastos_comunes WHERE tenant_id = 1
```

---

## 💻 IMPLEMENTACIÓN TÉCNICA

### Backend: Middleware Tenant
```python
# app/middleware/tenant.py

from fastapi import Request, HTTPException
from sqlalchemy.orm import Session

async def get_current_tenant(request: Request, db: Session):
    """
    Detecta tenant desde:
    1. Subdomain (lasflores.conectaai.cl)
    2. Header X-Tenant-Id
    3. Query param ?tenant_id=1
    """
    
    host = request.headers.get("host")
    
    # Extraer subdomain
    if "." in host:
        subdomain = host.split(".")[0]
        if subdomain not in ["www", "conectaai"]:
            tenant = db.query(Tenant).filter(
                Tenant.subdominio == subdomain
            ).first()
            
            if tenant:
                return tenant.id
    
    raise HTTPException(status_code=403, detail="Tenant no encontrado")

# Usar en cada endpoint
@router.get("/personas/")
def listar_personas(
    tenant_id: int = Depends(get_current_tenant),
    db: Session = Depends(get_db)
):
    return db.query(Persona).filter(
        Persona.tenant_id == tenant_id
    ).all()
```

### Frontend: Tema Dinámico
```typescript
// app/hooks/useTenant.ts

export function useTenant() {
  const [tenant, setTenant] = useState(null)
  
  useEffect(() => {
    async function fetchTenant() {
      const res = await fetch('/api/tenant/config')
      const data = await res.json()
      setTenant(data)
      
      // Aplicar colores
      document.documentElement.style.setProperty(
        '--color-primary', 
        data.color_primario
      )
      document.documentElement.style.setProperty(
        '--color-secondary', 
        data.color_secundario
      )
      
      // Cambiar favicon
      const favicon = document.querySelector("link[rel='icon']")
      favicon.href = data.favicon_url
      
      // Cambiar título
      document.title = data.nombre
    }
    
    fetchTenant()
  }, [])
  
  return tenant
}

// Usar en components
function Header() {
  const tenant = useTenant()
  
  return (
    <header>
      <img src={tenant?.logo_url} alt="Logo" />
      <h1>{tenant?.nombre}</h1>
    </header>
  )
}
```

### CSS Variables
```css
/* globals.css */
:root {
  --color-primary: #3498db;
  --color-secondary: #2ecc71;
}

/* Se sobrescribe con JS cuando carga tenant */

.btn-primary {
  background-color: var(--color-primary);
}

.text-primary {
  color: var(--color-primary);
}
```

---

## 📦 PLANES Y PRECIOS

### Plan Básico ($80.000/mes)
- ✅ 1 condominio
- ✅ Hasta 50 departamentos
- ✅ Módulo Personas
- ✅ Módulo Finanzas
- ❌ Módulo Personal
- ❌ Marca Blanca
- ❌ Subdomain custom

### Plan Premium ($150.000/mes)
- ✅ 3 condominios
- ✅ Hasta 200 departamentos
- ✅ Todos los módulos
- ✅ Marca Blanca (logo + colores)
- ✅ Subdomain: cliente.conectaai.cl
- ✅ Email soporte prioritario

### Plan Enterprise ($300.000/mes)
- ✅ Condominios ilimitados
- ✅ Departamentos ilimitados
- ✅ Todos los módulos
- ✅ Marca Blanca completa
- ✅ Dominio propio (cliente.cl)
- ✅ WhatsApp Business API
- ✅ Soporte 24/7
- ✅ Capacitación personalizada

---

## 🚀 ROADMAP IMPLEMENTACIÓN

### FASE 1: Base Multi-Tenant (8-10 horas)
1. ✅ Crear tabla tenants
2. ✅ Agregar tenant_id a TODAS las tablas
3. ✅ Migrar data existente
4. ✅ Middleware tenant detection
5. ✅ Actualizar TODOS los endpoints con filtro tenant

### FASE 2: Panel Admin (6-8 horas)
1. ✅ CRUD tenants (crear, editar, eliminar)
2. ✅ Upload logo + favicon
3. ✅ Selector de colores
4. ✅ Gestión planes y pagos
5. ✅ Activar/Desactivar clientes

### FASE 3: Marca Blanca Frontend (4-6 horas)
1. ✅ Hook useTenant()
2. ✅ CSS Variables dinámicas
3. ✅ Logo dinámico en header
4. ✅ Favicon dinámico
5. ✅ Título dinámico

### FASE 4: Subdominios (3-4 horas)
1. ✅ Configurar Nginx wildcard
2. ✅ SSL automático (Let's Encrypt)
3. ✅ Routing por subdomain

### FASE 5: Onboarding (2-3 horas)
1. ✅ Email bienvenida con credenciales
2. ✅ Tutorial primera vez
3. ✅ Wizard configuración inicial

**TOTAL: 25-35 HORAS** 📅

---

## 💰 MODELO DE VENTA

### Proceso Comercial
```
1. PROSPECTO
   ├─ Landing page con demo
   ├─ Solicita prueba gratis 30 días
   └─ Completa formulario

2. ACTIVACIÓN
   ├─ Super Admin crea tenant
   ├─ Configura marca blanca básica
   ├─ Envía credenciales por email
   └─ Cliente accede a cliente.conectaai.cl

3. ONBOARDING
   ├─ Video tutorial
   ├─ Wizard configuración
   ├─ Carga data inicial
   └─ Capacitación 1 hora (opcional)

4. PRODUCCIÓN
   ├─ Cliente usa sistema
   ├─ Facturación mensual automática
   └─ Soporte continuo

5. EXPANSIÓN
   ├─ Upgrade de plan
   ├─ Módulos adicionales
   └─ Dominio propio (enterprise)
```

---

## 🎯 VENTAJAS COMPETITIVAS

### Para ConectaAI
- 💰 Ingreso recurrente mensual
- 📈 Escalabilidad infinita
- 🛠️ Un solo código base
- 🔧 Mantenimiento centralizado
- 🚀 Deploy automático para todos

### Para Clientes
- 🎨 Sistema con su marca
- 💼 Profesionalismo
- 🔒 Data privada e independiente
- 📱 Acceso desde cualquier lugar
- 💵 Sin inversión inicial en desarrollo

---

## 📊 PROYECCIÓN FINANCIERA
```
Año 1:
├─ 10 clientes x $100.000/mes = $1.000.000/mes
├─ Ingresos anuales: $12.000.000
└─ Costo servidor: $300.000/año

Año 2:
├─ 50 clientes x $100.000/mes = $5.000.000/mes
├─ Ingresos anuales: $60.000.000
└─ Costo servidores: $2.000.000/año

Año 3:
├─ 200 clientes x $100.000/mes = $20.000.000/mes
├─ Ingresos anuales: $240.000.000
└─ Costo infraestructura: $10.000.000/año
```

---

## ⚠️ CONSIDERACIONES IMPORTANTES

### Seguridad
- 🔐 NUNCA olvidar filtro tenant_id en queries
- 🔐 Validar tenant en CADA endpoint
- 🔐 Logs de acceso por tenant
- 🔐 Backup independiente por tenant (opcional)

### Performance
- ⚡ Índices en tenant_id en TODAS las tablas
- ⚡ Cache por tenant
- ⚡ CDN para assets (logos, favicons)

### Legal
- 📄 Contrato de servicio SaaS
- 📄 Política de privacidad
- 📄 Términos y condiciones
- 📄 SLA (99.9% uptime)

---

## 🎬 DEMO VENTA

**Script para cliente:**

> "Te presentamos ConectaAI Condominios con Marca Blanca.
> 
> Tu condominio tendrá su propio sistema web:
> - Con TU logo
> - Con TUS colores
> - Con TU nombre
> 
> Tus residentes accederán a: **lasflores.conectaai.cl**
> 
> Verán tu marca en todo momento.
> 
> Incluye:
> ✅ Gestión personas
> ✅ Finanzas y gastos comunes
> ✅ Control personal (RRHH)
> ✅ Estructura del edificio
> ✅ Emails automáticos
> ✅ Reportes PDF/Excel
> 
> Desde **$80.000/mes**
> Prueba gratis 30 días."

---

## 🔧 SIGUIENTE PASO

**¿Implementamos el sistema Multi-Tenant ahora?**

Podemos comenzar con:
1. Crear tabla `tenants`
2. Agregar `tenant_id` a todas las tablas
3. Middleware de detección de tenant
4. Panel admin para crear clientes
5. Sistema de marca blanca

**Tiempo estimado:** 6-8 horas para versión funcional básica

¿Empezamos? 🚀
