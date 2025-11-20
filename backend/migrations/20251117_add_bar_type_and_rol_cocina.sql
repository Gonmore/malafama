-- Modificar el CHECK constraint del tipo de usuario para incluir 'bar'
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_tipo_check;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_tipo_check CHECK (tipo IN ('admin', 'atencion', 'cocina', 'bar', 'proveedor'));

-- Agregar columna rol_cocina para diferenciar entre cocina y bar
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS rol_cocina VARCHAR(20);
ALTER TABLE usuarios ADD CONSTRAINT usuarios_rol_cocina_check CHECK (rol_cocina IS NULL OR rol_cocina IN ('cocina', 'bar'));

-- Agregar comentario
COMMENT ON COLUMN usuarios.rol_cocina IS 'Para usuarios tipo cocina/bar: especifica si trabaja en cocina o bar';

-- Actualizar usuarios existentes de tipo 'cocina' que trabajen en bar
-- (esto se hará manualmente según el nombre del usuario o desde la interfaz)
UPDATE usuarios SET rol_cocina = 'cocina' WHERE tipo = 'cocina' AND rol_cocina IS NULL AND email LIKE '%cocina%';
UPDATE usuarios SET rol_cocina = 'bar' WHERE tipo = 'cocina' AND rol_cocina IS NULL AND email LIKE '%bar%';
UPDATE usuarios SET tipo = 'bar', rol_cocina = 'bar' WHERE tipo = 'cocina' AND email LIKE '%bar%';
