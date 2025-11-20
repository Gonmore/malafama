-- ============================================
-- Migración: Agregar tabla de locales/restaurantes
-- ============================================

-- Crear tabla de locales
CREATE TABLE IF NOT EXISTS locales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    direccion VARCHAR(500),
    telefono VARCHAR(50),
    email VARCHAR(255),
    logo VARCHAR(500),
    plan VARCHAR(50) DEFAULT 'gratuito' CHECK (plan IN ('gratuito', 'basico', 'premium', 'enterprise')),
    activo BOOLEAN DEFAULT true,
    usuario_propietario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para locales
CREATE INDEX IF NOT EXISTS idx_locales_propietario ON locales(usuario_propietario_id);
CREATE INDEX IF NOT EXISTS idx_locales_activo ON locales(activo) WHERE activo = true;

-- Agregar columna local_id a usuarios (para empleados asignados a un local)
ALTER TABLE usuarios 
ADD COLUMN IF NOT EXISTS local_id UUID REFERENCES locales(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_usuarios_local ON usuarios(local_id);

-- Agregar columna local_id a mesas
ALTER TABLE mesas 
ADD COLUMN IF NOT EXISTS local_id UUID REFERENCES locales(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_mesas_local ON mesas(local_id);

-- Agregar columna local_id a productos
ALTER TABLE productos 
ADD COLUMN IF NOT EXISTS local_id UUID REFERENCES locales(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_productos_local ON productos(local_id);

-- Agregar columna local_id a comandas
ALTER TABLE comandas 
ADD COLUMN IF NOT EXISTS local_id UUID REFERENCES locales(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_comandas_local ON comandas(local_id);

-- Agregar columna local_id a proveedores (cada local puede tener sus proveedores)
ALTER TABLE proveedores 
ADD COLUMN IF NOT EXISTS local_id UUID REFERENCES locales(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_proveedores_local ON proveedores(local_id);

-- Comentarios
COMMENT ON TABLE locales IS 'Locales/Restaurantes del sistema. Un admin puede tener múltiples locales.';
COMMENT ON COLUMN locales.plan IS 'Plan de suscripción del local (monetización futura)';
COMMENT ON COLUMN locales.usuario_propietario_id IS 'Usuario admin propietario del local';
COMMENT ON COLUMN usuarios.local_id IS 'Local al que pertenece el usuario empleado (atención, cocina). NULL para admin.';
COMMENT ON COLUMN mesas.local_id IS 'Local al que pertenece la mesa';
COMMENT ON COLUMN productos.local_id IS 'Local al que pertenece el producto';
COMMENT ON COLUMN comandas.local_id IS 'Local al que pertenece la comanda';
COMMENT ON COLUMN proveedores.local_id IS 'Local al que pertenece el proveedor';
