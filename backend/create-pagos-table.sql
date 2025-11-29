-- Crear tabla pagos_proveedores
CREATE TABLE IF NOT EXISTS pagos_proveedores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proveedor_id UUID NOT NULL REFERENCES proveedores(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  local_id UUID NOT NULL REFERENCES locales(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  monto_pagado DECIMAL(10, 2) NOT NULL,
  comprobante_url TEXT,
  detalle JSONB,
  observaciones TEXT,
  creado_por UUID REFERENCES usuarios(id) ON UPDATE CASCADE ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Crear índices
CREATE INDEX IF NOT EXISTS idx_pagos_proveedor_periodo ON pagos_proveedores(proveedor_id, fecha_inicio, fecha_fin);
CREATE INDEX IF NOT EXISTS idx_pagos_local ON pagos_proveedores(local_id);

-- Comentarios
COMMENT ON TABLE pagos_proveedores IS 'Registro de pagos realizados a proveedores';
COMMENT ON COLUMN pagos_proveedores.fecha_inicio IS 'Fecha de inicio del período pagado';
COMMENT ON COLUMN pagos_proveedores.fecha_fin IS 'Fecha de fin del período pagado';
COMMENT ON COLUMN pagos_proveedores.monto_pagado IS 'Monto total pagado al proveedor';
COMMENT ON COLUMN pagos_proveedores.comprobante_url IS 'URL o base64 de la imagen del comprobante';
COMMENT ON COLUMN pagos_proveedores.detalle IS 'Detalle de productos incluidos en el pago';
