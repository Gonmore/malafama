-- ============================================
-- Vistas útiles para reportes
-- ============================================

-- Vista: Ventas por producto
CREATE OR REPLACE VIEW v_ventas_por_producto AS
SELECT 
    p.id as producto_id,
    p.nombre as producto_nombre,
    p.precio as precio_venta,
    p.costo,
    pr.nombre as proveedor,
    COUNT(ped.id) as total_pedidos,
    SUM(ped.cantidad) as cantidad_vendida,
    SUM(ped.subtotal) as total_ventas,
    SUM(ped.cantidad * p.costo) as costo_total,
    SUM(ped.subtotal) - SUM(ped.cantidad * p.costo) as ganancia_neta
FROM productos p
LEFT JOIN pedidos ped ON p.id = ped.producto_id
LEFT JOIN proveedores pr ON p.proveedor_id = pr.id
LEFT JOIN comandas c ON ped.comanda_id = c.id
WHERE c.estado = 'cerrada'
GROUP BY p.id, p.nombre, p.precio, p.costo, pr.nombre;

-- Vista: Ventas por mesa
CREATE OR REPLACE VIEW v_ventas_por_mesa AS
SELECT 
    m.id as mesa_id,
    m.nombre as mesa_nombre,
    m.numero as mesa_numero,
    COUNT(DISTINCT c.id) as total_comandas,
    SUM(c.total) as total_ventas,
    AVG(c.total) as promedio_por_comanda
FROM mesas m
LEFT JOIN comandas c ON m.id = c.mesa_id
WHERE c.estado = 'cerrada'
GROUP BY m.id, m.nombre, m.numero;

-- Vista: Ventas diarias
CREATE OR REPLACE VIEW v_ventas_diarias AS
SELECT 
    DATE(c.fecha) as fecha,
    COUNT(DISTINCT c.id) as total_comandas,
    SUM(c.total) as total_ventas,
    COUNT(DISTINCT c.mesa_id) as mesas_atendidas,
    SUM(ped.cantidad) as productos_vendidos
FROM comandas c
LEFT JOIN pedidos ped ON c.id = ped.comanda_id
WHERE c.estado = 'cerrada'
GROUP BY DATE(c.fecha)
ORDER BY fecha DESC;

-- Vista: Productos más vendidos
CREATE OR REPLACE VIEW v_productos_mas_vendidos AS
SELECT 
    p.id,
    p.nombre,
    p.categoria,
    p.precio,
    SUM(ped.cantidad) as cantidad_vendida,
    SUM(ped.subtotal) as total_ventas,
    COUNT(DISTINCT ped.comanda_id) as comandas_incluido
FROM productos p
INNER JOIN pedidos ped ON p.id = ped.producto_id
INNER JOIN comandas c ON ped.comanda_id = c.id
WHERE c.estado = 'cerrada'
GROUP BY p.id, p.nombre, p.categoria, p.precio
ORDER BY cantidad_vendida DESC;

-- Vista: Pagos pendientes a proveedores
CREATE OR REPLACE VIEW v_pagos_pendientes_proveedores AS
SELECT 
    pr.id as proveedor_id,
    pr.nombre as proveedor,
    pr.contacto,
    pr.telefono,
    pr.email,
    SUM(ped.cantidad * p.costo) as monto_pendiente,
    COUNT(DISTINCT c.id) as comandas_asociadas,
    MIN(c.fecha) as fecha_primera_venta,
    MAX(c.fecha) as fecha_ultima_venta
FROM proveedores pr
INNER JOIN productos p ON pr.id = p.proveedor_id
INNER JOIN pedidos ped ON p.id = ped.producto_id
INNER JOIN comandas c ON ped.comanda_id = c.id
WHERE c.estado = 'cerrada'
AND NOT EXISTS (
    SELECT 1 FROM pagos_proveedores pp
    WHERE pp.proveedor_id = pr.id
    AND pp.estado = 'pagado'
    AND c.fecha BETWEEN pp.fecha_inicio AND pp.fecha_fin
)
GROUP BY pr.id, pr.nombre, pr.contacto, pr.telefono, pr.email;

-- Vista: Rendimiento por mesero
CREATE OR REPLACE VIEW v_rendimiento_meseros AS
SELECT 
    u.id as usuario_id,
    u.nombre as mesero,
    COUNT(DISTINCT c.id) as total_comandas,
    SUM(c.total) as total_ventas,
    AVG(c.total) as promedio_por_comanda,
    COUNT(DISTINCT DATE(c.fecha)) as dias_trabajados
FROM usuarios u
INNER JOIN comandas c ON u.id = c.usuario_atencion_id
WHERE u.tipo = 'atencion' AND c.estado = 'cerrada'
GROUP BY u.id, u.nombre;

-- Vista: Estado actual de comandas
CREATE OR REPLACE VIEW v_estado_comandas AS
SELECT 
    c.id as comanda_id,
    c.fecha,
    m.nombre as mesa,
    u.nombre as mesero,
    c.estado as estado_comanda,
    COUNT(ped.id) as total_pedidos,
    SUM(CASE WHEN ped.estado = 'pendiente' THEN 1 ELSE 0 END) as pedidos_pendientes,
    SUM(CASE WHEN ped.estado = 'en_preparacion' THEN 1 ELSE 0 END) as pedidos_en_preparacion,
    SUM(CASE WHEN ped.estado = 'listo' THEN 1 ELSE 0 END) as pedidos_listos,
    SUM(CASE WHEN ped.estado = 'entregado' THEN 1 ELSE 0 END) as pedidos_entregados,
    c.total
FROM comandas c
INNER JOIN mesas m ON c.mesa_id = m.id
INNER JOIN usuarios u ON c.usuario_atencion_id = u.id
LEFT JOIN pedidos ped ON c.id = ped.comanda_id
WHERE c.estado = 'abierta'
GROUP BY c.id, c.fecha, m.nombre, u.nombre, c.estado, c.total;

-- Vista: Inventario y costos por proveedor
CREATE OR REPLACE VIEW v_inventario_proveedores AS
SELECT 
    pr.id as proveedor_id,
    pr.nombre as proveedor,
    COUNT(p.id) as total_productos,
    SUM(CASE WHEN p.activo = true THEN 1 ELSE 0 END) as productos_activos,
    AVG(p.precio) as precio_promedio,
    AVG(p.costo) as costo_promedio,
    AVG(p.precio - p.costo) as margen_promedio
FROM proveedores pr
LEFT JOIN productos p ON pr.id = p.proveedor_id
GROUP BY pr.id, pr.nombre;
