-- ============================================
-- MalaFama - Restaurant Order Management System
-- PostgreSQL Database Schema
-- ============================================

-- Crear extensión para UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- Tabla: usuarios
-- ============================================
CREATE TABLE usuarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    tipo VARCHAR(50) NOT NULL CHECK (tipo IN ('admin', 'atencion', 'cocina', 'proveedor')),
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Tabla: proveedores
-- ============================================
CREATE TABLE proveedores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(255) NOT NULL,
    contacto VARCHAR(255),
    telefono VARCHAR(50),
    email VARCHAR(255),
    es_propio BOOLEAN DEFAULT false,
    usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Tabla: productos
-- ============================================
CREATE TABLE productos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    foto VARCHAR(500),
    precio DECIMAL(10, 2) NOT NULL,
    costo DECIMAL(10, 2) NOT NULL,
    proveedor_id UUID REFERENCES proveedores(id) ON DELETE SET NULL,
    activo BOOLEAN DEFAULT true,
    categoria VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Tabla: mesas
-- ============================================
CREATE TABLE mesas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(50) NOT NULL,
    numero INTEGER NOT NULL,
    ubicacion VARCHAR(255),
    capacidad INTEGER DEFAULT 4,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Tabla: comandas
-- ============================================
CREATE TABLE comandas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mesa_id UUID NOT NULL REFERENCES mesas(id) ON DELETE CASCADE,
    usuario_atencion_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE SET NULL,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    estado VARCHAR(50) DEFAULT 'abierta' CHECK (estado IN ('abierta', 'cerrada', 'cancelada')),
    total DECIMAL(10, 2) DEFAULT 0,
    cerrada_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Tabla: pedidos
-- ============================================
CREATE TABLE pedidos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    comanda_id UUID NOT NULL REFERENCES comandas(id) ON DELETE CASCADE,
    producto_id UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
    cantidad INTEGER NOT NULL DEFAULT 1,
    precio_unitario DECIMAL(10, 2) NOT NULL,
    subtotal DECIMAL(10, 2) NOT NULL,
    estado VARCHAR(50) DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'en_preparacion', 'listo', 'entregado')),
    notas TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    listo_at TIMESTAMP
);

-- ============================================
-- Tabla: configuracion_restaurante
-- ============================================
CREATE TABLE configuracion_restaurante (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre_restaurante VARCHAR(255) NOT NULL,
    admin_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    cantidad_mesas INTEGER NOT NULL,
    menu_url VARCHAR(500),
    scraping_completado BOOLEAN DEFAULT false,
    configuracion_inicial_completada BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Tabla: pagos_proveedores
-- ============================================
CREATE TABLE pagos_proveedores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    proveedor_id UUID NOT NULL REFERENCES proveedores(id) ON DELETE CASCADE,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    monto_total DECIMAL(10, 2) NOT NULL,
    estado VARCHAR(50) DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'pagado')),
    fecha_pago TIMESTAMP,
    notas TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Tabla: auditoria
-- ============================================
CREATE TABLE auditoria (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    accion VARCHAR(255) NOT NULL,
    tabla VARCHAR(100) NOT NULL,
    registro_id UUID,
    datos_anteriores JSONB,
    datos_nuevos JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Índices para mejorar el rendimiento
-- ============================================
CREATE INDEX idx_productos_proveedor ON productos(proveedor_id);
CREATE INDEX idx_productos_activo ON productos(activo);
CREATE INDEX idx_comandas_mesa ON comandas(mesa_id);
CREATE INDEX idx_comandas_estado ON comandas(estado);
CREATE INDEX idx_comandas_fecha ON comandas(fecha);
CREATE INDEX idx_pedidos_comanda ON pedidos(comanda_id);
CREATE INDEX idx_pedidos_producto ON pedidos(producto_id);
CREATE INDEX idx_pedidos_estado ON pedidos(estado);
CREATE INDEX idx_usuarios_tipo ON usuarios(tipo);
CREATE INDEX idx_usuarios_email ON usuarios(email);
CREATE INDEX idx_pagos_proveedor ON pagos_proveedores(proveedor_id);
CREATE INDEX idx_pagos_estado ON pagos_proveedores(estado);
CREATE INDEX idx_auditoria_usuario ON auditoria(usuario_id);
CREATE INDEX idx_auditoria_tabla ON auditoria(tabla);

-- ============================================
-- Funciones y Triggers
-- ============================================

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Aplicar trigger a todas las tablas
CREATE TRIGGER update_usuarios_updated_at BEFORE UPDATE ON usuarios
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_proveedores_updated_at BEFORE UPDATE ON proveedores
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_productos_updated_at BEFORE UPDATE ON productos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_mesas_updated_at BEFORE UPDATE ON mesas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_comandas_updated_at BEFORE UPDATE ON comandas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pedidos_updated_at BEFORE UPDATE ON pedidos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_configuracion_updated_at BEFORE UPDATE ON configuracion_restaurante
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pagos_updated_at BEFORE UPDATE ON pagos_proveedores
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Función para calcular subtotal de pedido
-- ============================================
CREATE OR REPLACE FUNCTION calcular_subtotal_pedido()
RETURNS TRIGGER AS $$
BEGIN
    NEW.subtotal = NEW.cantidad * NEW.precio_unitario;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_calcular_subtotal BEFORE INSERT OR UPDATE ON pedidos
    FOR EACH ROW EXECUTE FUNCTION calcular_subtotal_pedido();

-- ============================================
-- Función para actualizar total de comanda
-- ============================================
CREATE OR REPLACE FUNCTION actualizar_total_comanda()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE comandas
    SET total = (
        SELECT COALESCE(SUM(subtotal), 0)
        FROM pedidos
        WHERE comanda_id = COALESCE(NEW.comanda_id, OLD.comanda_id)
    )
    WHERE id = COALESCE(NEW.comanda_id, OLD.comanda_id);
    RETURN COALESCE(NEW, OLD);
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_actualizar_total_insert AFTER INSERT ON pedidos
    FOR EACH ROW EXECUTE FUNCTION actualizar_total_comanda();

CREATE TRIGGER trigger_actualizar_total_update AFTER UPDATE ON pedidos
    FOR EACH ROW EXECUTE FUNCTION actualizar_total_comanda();

CREATE TRIGGER trigger_actualizar_total_delete AFTER DELETE ON pedidos
    FOR EACH ROW EXECUTE FUNCTION actualizar_total_comanda();

-- ============================================
-- Datos iniciales - Proveedor "Propio"
-- ============================================
INSERT INTO proveedores (nombre, es_propio, contacto)
VALUES ('Propio', true, 'Productos elaborados en el establecimiento');
