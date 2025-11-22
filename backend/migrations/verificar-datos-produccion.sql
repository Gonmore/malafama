-- Script para restaurar usuarios de producción eliminados por error
-- Ejecutar SOLO si se eliminaron usuarios de @malafamateatro.local

-- IMPORTANTE: Modifica las contraseñas hasheadas o ejecuta esto y luego cambia las contraseñas desde la app

BEGIN;

-- Verificar si hay un local de producción
DO $$
DECLARE
    v_local_id UUID;
    v_propietario_id UUID;
BEGIN
    -- Buscar local de producción (no de test)
    SELECT id, usuario_propietario_id INTO v_local_id, v_propietario_id
    FROM locales 
    WHERE nombre NOT LIKE '%Test%'
    LIMIT 1;

    IF v_local_id IS NOT NULL THEN
        RAISE NOTICE 'Local encontrado: %', v_local_id;
        RAISE NOTICE 'Propietario: %', v_propietario_id;
        
        -- Verificar si faltan usuarios del local
        IF NOT EXISTS (
            SELECT 1 FROM usuarios 
            WHERE local_id = v_local_id 
            AND email LIKE '%@malafamateatro.local'
        ) THEN
            RAISE NOTICE 'ADVERTENCIA: No se encontraron usuarios del local de producción';
            RAISE NOTICE 'Se necesita restaurar desde backup o recrear manualmente';
        ELSE
            RAISE NOTICE 'Usuarios del local encontrados - No se necesita restauración';
        END IF;
    ELSE
        RAISE NOTICE 'No se encontró local de producción';
    END IF;
END $$;

COMMIT;

-- Mostrar estado actual
SELECT 
    'Locales (no test)' as tipo,
    COUNT(*) as cantidad
FROM locales 
WHERE nombre NOT LIKE '%Test%'
UNION ALL
SELECT 
    'Usuarios del local',
    COUNT(*)
FROM usuarios 
WHERE email LIKE '%@malafamateatro.local';
