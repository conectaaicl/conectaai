-- =====================================================
-- MIGRACIÓN: SISTEMA MULTI-TENANT
-- Fecha: 16 Enero 2026
-- =====================================================

-- 1. CREAR TABLA TENANTS (CLIENTES)
CREATE TABLE IF NOT EXISTS tenants (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    subdominio VARCHAR(100) UNIQUE NOT NULL,
    email_contacto VARCHAR(255) NOT NULL,
    telefono VARCHAR(50),
    
    -- Marca Blanca
    logo_url VARCHAR(500),
    favicon_url VARCHAR(500),
    color_primario VARCHAR(7) DEFAULT '#3498db',
    color_secundario VARCHAR(7) DEFAULT '#2ecc71',
    color_acento VARCHAR(7) DEFAULT '#e74c3c',
    
    -- Planes y Facturación
    plan VARCHAR(50) DEFAULT 'basico',
    estado VARCHAR(50) DEFAULT 'activo',
    fecha_inicio TIMESTAMP DEFAULT NOW(),
    fecha_vencimiento TIMESTAMP,
    limite_condominios INTEGER DEFAULT 1,
    limite_departamentos INTEGER DEFAULT 50,
    
    -- Configuración
    smtp_host VARCHAR(255),
    smtp_port INTEGER,
    smtp_user VARCHAR(255),
    smtp_password VARCHAR(255),
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. CREAR TENANT PREDETERMINADO (DEMO)
INSERT INTO tenants (nombre, subdominio, email_contacto, plan, estado)
VALUES ('ConectaAI Demo', 'demo', 'demo@conectaai.cl', 'enterprise', 'activo')
ON CONFLICT (subdominio) DO NOTHING;

-- 3. AGREGAR TENANT_ID A TODAS LAS TABLAS

-- MÓDULO PERSONAS
ALTER TABLE personas ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE;
UPDATE personas SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE personas ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_personas_tenant ON personas(tenant_id);

-- MÓDULO CONDOMINIOS
ALTER TABLE condominios ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE;
UPDATE condominios SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE condominios ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_condominios_tenant ON condominios(tenant_id);

ALTER TABLE torres ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE;
UPDATE torres SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE torres ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_torres_tenant ON torres(tenant_id);

ALTER TABLE pisos ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE;
UPDATE pisos SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE pisos ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pisos_tenant ON pisos(tenant_id);

ALTER TABLE departamentos ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE;
UPDATE departamentos SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE departamentos ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_departamentos_tenant ON departamentos(tenant_id);

ALTER TABLE estacionamientos ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE;
UPDATE estacionamientos SET tenant_id = 1 WHERE tenant_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_estacionamientos_tenant ON estacionamientos(tenant_id);

ALTER TABLE bodegas ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE;
UPDATE bodegas SET tenant_id = 1 WHERE tenant_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_bodegas_tenant ON bodegas(tenant_id);

-- MÓDULO FINANZAS
ALTER TABLE gastos_comunes ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE;
UPDATE gastos_comunes SET tenant_id = 1 WHERE tenant_id IS NULL;
ALTER TABLE gastos_comunes ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gastos_comunes_tenant ON gastos_comunes(tenant_id);

ALTER TABLE pagos ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE;
UPDATE pagos SET tenant_id = 1 WHERE tenant_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_pagos_tenant ON pagos(tenant_id);

ALTER TABLE multas ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE;
UPDATE multas SET tenant_id = 1 WHERE tenant_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_multas_tenant ON multas(tenant_id);

-- MÓDULO PERSONAL
ALTER TABLE turnos ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE;
UPDATE turnos SET tenant_id = 1 WHERE tenant_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_turnos_tenant ON turnos(tenant_id);

ALTER TABLE asistencias ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE;
UPDATE asistencias SET tenant_id = 1 WHERE tenant_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_asistencias_tenant ON asistencias(tenant_id);

ALTER TABLE sueldos ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE;
UPDATE sueldos SET tenant_id = 1 WHERE tenant_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_sueldos_tenant ON sueldos(tenant_id);

ALTER TABLE adelantos ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE;
UPDATE adelantos SET tenant_id = 1 WHERE tenant_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_adelantos_tenant ON adelantos(tenant_id);

ALTER TABLE evaluaciones ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE;
UPDATE evaluaciones SET tenant_id = 1 WHERE tenant_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_evaluaciones_tenant ON evaluaciones(tenant_id);

ALTER TABLE documentos_personal ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE;
UPDATE documentos_personal SET tenant_id = 1 WHERE tenant_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_documentos_personal_tenant ON documentos_personal(tenant_id);

ALTER TABLE equipamiento ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE;
UPDATE equipamiento SET tenant_id = 1 WHERE tenant_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_equipamiento_tenant ON equipamiento(tenant_id);

ALTER TABLE vacaciones ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE;
UPDATE vacaciones SET tenant_id = 1 WHERE tenant_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_vacaciones_tenant ON vacaciones(tenant_id);

-- 4. DAR PERMISOS
GRANT ALL PRIVILEGES ON TABLE tenants TO conectaai_user;
GRANT USAGE, SELECT ON SEQUENCE tenants_id_seq TO conectaai_user;

-- 5. VERIFICACIÓN
SELECT 'Tenants creados:' as info, COUNT(*) as total FROM tenants;
SELECT 'Personas migradas:' as info, COUNT(*) as total FROM personas WHERE tenant_id = 1;
SELECT 'Condominios migrados:' as info, COUNT(*) as total FROM condominios WHERE tenant_id = 1;
