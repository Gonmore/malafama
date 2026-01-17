-- Agrega columna foto a la tabla usuarios
ALTER TABLE usuarios
ADD COLUMN IF NOT EXISTS foto TEXT;
