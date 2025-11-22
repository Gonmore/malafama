-- Script para actualizar el total de comandas cerradas que tienen total = 0
-- Calcula el total sumando los subtotales de todos los pedidos de cada comanda

UPDATE comandas c
SET total = COALESCE((
    SELECT SUM(p.subtotal)
    FROM pedidos p
    WHERE p.comanda_id = c.id
      AND p.estado != 'cancelado'
), 0)
WHERE c.estado = 'cerrada' 
  AND (c.total = 0 OR c.total IS NULL);

-- Verificar resultados
SELECT 
    c.id,
    c.estado,
    c.total as total_comanda,
    (SELECT SUM(p.subtotal) FROM pedidos p WHERE p.comanda_id = c.id AND p.estado != 'cancelado') as total_calculado,
    c.cerrada_at
FROM comandas c
WHERE c.estado = 'cerrada'
ORDER BY c.cerrada_at DESC
LIMIT 10;
