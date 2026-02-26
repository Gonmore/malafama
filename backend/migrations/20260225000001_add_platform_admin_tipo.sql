-- Allow 'platform_admin' in usuarios.tipo check constraint

ALTER TABLE usuarios
  DROP CONSTRAINT IF EXISTS usuarios_tipo_check;

ALTER TABLE usuarios
  ADD CONSTRAINT usuarios_tipo_check
  CHECK (tipo IN ('admin', 'atencion', 'cocina', 'bar', 'proveedor', 'platform_admin'));
