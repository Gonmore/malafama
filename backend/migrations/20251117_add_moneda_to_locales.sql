-- Agregar columna moneda a la tabla locales
ALTER TABLE locales ADD COLUMN IF NOT EXISTS moneda VARCHAR(10) DEFAULT 'Bs' NOT NULL;

-- Agregar comentario
COMMENT ON COLUMN locales.moneda IS 'Moneda del local (Bs, $, S/, etc)';

-- Actualizar registros existentes si tienen NULL
UPDATE locales SET moneda = 'Bs' WHERE moneda IS NULL;
