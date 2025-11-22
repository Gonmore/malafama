-- Script de limpieza SEGURA de datos de prueba huérfanos
-- SOLO elimina datos que claramente son de test
-- NO toca datos de producción

BEGIN;

-- 1. Eliminar pedidos SOLO de comandas sin local_id (huérfanos)
DELETE FROM pedidos 
WHERE comanda_id IN (
    SELECT id FROM comandas WHERE local_id IS NULL
);

-- 2. Eliminar pedidos SOLO de productos sin local_id (huérfanos)
DELETE FROM pedidos
WHERE producto_id IN (
    SELECT id FROM productos WHERE local_id IS NULL
);

-- 3. Eliminar comandas SOLO sin local_id (huérfanos)
DELETE FROM comandas 
WHERE local_id IS NULL;

-- 4. Eliminar mesas_asignadas SOLO de mesas sin local_id
DELETE FROM mesas_asignadas 
WHERE mesa_id IN (
    SELECT id FROM mesas WHERE local_id IS NULL
);

-- 5. Eliminar SOLO mesas sin local_id (huérfanos)
DELETE FROM mesas 
WHERE local_id IS NULL;

-- 6. Eliminar SOLO productos sin local_id (huérfanos)
DELETE FROM productos 
WHERE local_id IS NULL;

-- 7. Eliminar SOLO proveedores con email de test (contiene 'test' o patron de timestamp)
DELETE FROM proveedores 
WHERE email LIKE '%@test.com'
   OR nombre LIKE 'Proveedor Test %';

-- 8. Eliminar SOLO locales de test (nombre contiene 'Test' y timestamp)
DELETE FROM locales 
WHERE nombre LIKE 'Local Test%'
   OR nombre LIKE 'Restaurante Test%';

-- 9. Eliminar SOLO usuarios con email de test (NUNCA tocar emails de producción)
DELETE FROM usuarios 
WHERE (email LIKE 'admin.test.%@test.com'
    OR email LIKE 'mesero@test%.local'
    OR email LIKE 'cocina@test%.local'
    OR email LIKE 'bar@test%.local')
  AND email NOT LIKE '%@malafamateatro.local';

COMMIT;

-- Verificar qué quedó
SELECT 'Comandas sin local:' as tabla, COUNT(*) as cantidad FROM comandas WHERE local_id IS NULL
UNION ALL
SELECT 'Mesas sin local:', COUNT(*) FROM mesas WHERE local_id IS NULL
UNION ALL
SELECT 'Productos sin local:', COUNT(*) FROM productos WHERE local_id IS NULL
UNION ALL
SELECT 'Proveedores de test:', COUNT(*) FROM proveedores WHERE email LIKE '%@test.com'
UNION ALL
SELECT 'Locales de test:', COUNT(*) FROM locales WHERE nombre LIKE '%Test%'
UNION ALL
SELECT 'Usuarios de test:', COUNT(*) FROM usuarios WHERE email LIKE '%@test.com' OR email LIKE '%@test%.local';
