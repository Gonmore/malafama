-- Agregar columna mesero_asignado_id a la tabla mesas
ALTER TABLE mesas 
ADD COLUMN mesero_asignado_id UUID REFERENCES usuarios(id) ON DELETE SET NULL ON UPDATE CASCADE;

COMMENT ON COLUMN mesas.mesero_asignado_id IS 'Mesero asignado a esta mesa';
