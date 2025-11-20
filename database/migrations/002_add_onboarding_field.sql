-- Agregar campo onboarding_completado a tabla usuarios
ALTER TABLE usuarios 
ADD COLUMN IF NOT EXISTS onboarding_completado BOOLEAN DEFAULT FALSE;

-- Comentario explicativo
COMMENT ON COLUMN usuarios.onboarding_completado IS 'Indica si el usuario admin completó la configuración inicial del sistema';

-- Actualizar usuarios admin existentes (pueden necesitar completar onboarding)
-- Si ya tienen mesas y productos, marcar como completado
UPDATE usuarios u
SET onboarding_completado = TRUE
WHERE u.tipo = 'admin' 
AND (
  SELECT COUNT(*) FROM mesas
) > 0
AND (
  SELECT COUNT(*) FROM productos
) > 0;

-- Crear índice para mejorar consultas
CREATE INDEX IF NOT EXISTS idx_usuarios_onboarding 
ON usuarios(tipo, onboarding_completado) 
WHERE tipo = 'admin';
