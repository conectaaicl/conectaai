-- =====================================================
-- MIGRACIÓN: Reconocimiento facial vía cámara del celular (facial_web)
-- Fecha: 13 Julio 2026
-- =====================================================

CREATE TABLE IF NOT EXISTS facial_encodings (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL,
    persona_id INTEGER NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
    encoding JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, persona_id)
);

CREATE INDEX IF NOT EXISTS idx_facial_encodings_tenant ON facial_encodings(tenant_id);

INSERT INTO feature_catalog (key, label, descripcion, categoria, precio_clp, activo_por_defecto)
VALUES ('facial_web', 'Reconocimiento Facial (Celular)', 'Verificacion de acceso por reconocimiento facial usando la camara del celular, sin hardware dedicado', 'seguridad', 0, false)
ON CONFLICT (key) DO NOTHING;
