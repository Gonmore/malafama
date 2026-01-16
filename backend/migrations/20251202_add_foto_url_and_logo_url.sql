-- Añadir columnas foto_url a usuarios y logo_url a locales
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS foto_url VARCHAR(1000);

ALTER TABLE locales
  ADD COLUMN IF NOT EXISTS logo_url VARCHAR(1000);
