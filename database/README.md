# MalaFama Database

## Configuración de PostgreSQL

### Requisitos previos
- PostgreSQL 14 o superior
- Cliente psql o pgAdmin

### Instalación de la base de datos

1. Crear base de datos:
```bash
psql -U postgres
CREATE DATABASE malafama;
\c malafama
```

2. Ejecutar schema:
```bash
psql -U postgres -d malafama -f schema.sql
```

3. Ejecutar vistas:
```bash
psql -U postgres -d malafama -f views.sql
```

### Variables de entorno

Configurar en el backend:
```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=malafama
DB_USER=postgres
DB_PASSWORD=tu_password
```

## Estructura de tablas

### usuarios
Almacena todos los usuarios del sistema (admin, atencion, cocina, proveedor)

### proveedores
Proveedores de productos, incluye proveedor "Propio" para productos elaborados internamente

### productos
Catálogo de productos con precios, costos y relación con proveedor

### mesas
Mesas del restaurante

### comandas
Registro de comandas por mesa (abierta/cerrada)

### pedidos
Pedidos individuales dentro de cada comanda

### configuracion_restaurante
Configuración inicial del restaurante (cantidad de mesas, URL de menú, etc.)

### pagos_proveedores
Control de pagos a proveedores por período

### auditoria
Registro de cambios importantes en el sistema

## Vistas disponibles

- `v_ventas_por_producto`: Análisis de ventas por producto
- `v_ventas_por_mesa`: Ventas agrupadas por mesa
- `v_ventas_diarias`: Resumen de ventas por día
- `v_productos_mas_vendidos`: Ranking de productos
- `v_pagos_pendientes_proveedores`: Pagos pendientes a proveedores
- `v_rendimiento_meseros`: Estadísticas por mesero
- `v_estado_comandas`: Estado actual de comandas abiertas
- `v_inventario_proveedores`: Inventario y costos por proveedor

## Triggers automáticos

- `update_updated_at`: Actualiza automáticamente el campo `updated_at`
- `calcular_subtotal_pedido`: Calcula el subtotal de cada pedido
- `actualizar_total_comanda`: Actualiza el total de la comanda al agregar/modificar pedidos

## Consultas útiles

### Ver comandas abiertas
```sql
SELECT * FROM v_estado_comandas;
```

### Ventas del día
```sql
SELECT * FROM v_ventas_diarias WHERE fecha = CURRENT_DATE;
```

### Top 10 productos más vendidos
```sql
SELECT * FROM v_productos_mas_vendidos LIMIT 10;
```

### Pagos pendientes a proveedores
```sql
SELECT * FROM v_pagos_pendientes_proveedores WHERE monto_pendiente > 0;
```
