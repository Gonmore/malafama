-- Creates tenants table and minimal indexes

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre VARCHAR(255) NOT NULL,
  admin_usuario_id UUID NOT NULL UNIQUE REFERENCES usuarios(id) ON DELETE RESTRICT,
  referencia_tenant_id UUID NULL REFERENCES tenants(id) ON DELETE SET NULL,
  es_referencia BOOLEAN NOT NULL DEFAULT FALSE,
  plan_default VARCHAR(50) NOT NULL DEFAULT 'gratuito',
  moneda_default VARCHAR(10) NOT NULL DEFAULT 'Bs',
  suscripcion_hasta TIMESTAMPTZ NOT NULL,
  max_locales INTEGER NOT NULL DEFAULT 1,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_by_platform_admin_id UUID NULL REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenants_admin_usuario_id ON tenants(admin_usuario_id);
CREATE INDEX IF NOT EXISTS idx_tenants_referencia_tenant_id ON tenants(referencia_tenant_id);
