-- Migración: Agregar campos de forma de pago a comandas
-- Fecha: 2025-11-21
-- Descripción: Agrega campos para almacenar método de pago, montos y comprobante

-- Agregar columna forma_pago
ALTER TABLE comandas 
ADD COLUMN IF NOT EXISTS forma_pago VARCHAR(20) CHECK (forma_pago IN ('efectivo', 'qr', 'mixto'));

-- Agregar columna cantidad_efectivo
ALTER TABLE comandas 
ADD COLUMN IF NOT EXISTS cantidad_efectivo DECIMAL(10, 2);

-- Agregar columna cantidad_qr
ALTER TABLE comandas 
ADD COLUMN IF NOT EXISTS cantidad_qr DECIMAL(10, 2);

-- Agregar columna comprobante (almacena base64 o ruta)
ALTER TABLE comandas 
ADD COLUMN IF NOT EXISTS comprobante TEXT;

-- Agregar comentarios a las columnas
COMMENT ON COLUMN comandas.forma_pago IS 'Método de pago utilizado: efectivo, qr o mixto';
COMMENT ON COLUMN comandas.cantidad_efectivo IS 'Monto pagado en efectivo (para modo mixto)';
COMMENT ON COLUMN comandas.cantidad_qr IS 'Monto pagado por QR (para modo mixto)';
COMMENT ON COLUMN comandas.comprobante IS 'Imagen del comprobante de pago en base64 o ruta (para QR y mixto)';
