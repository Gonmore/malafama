# Migraciones de Base de Datos

## Cómo ejecutar migraciones

### Opción 1: Usando Node.js (recomendado)
```bash
cd backend
node migrations/ejecutar-migracion.js
```

### Opción 2: Usando PowerShell (si psql está instalado)
```powershell
cd backend/migrations
.\ejecutar-migracion.ps1
```

### Opción 3: Desde pgAdmin o DBeaver
1. Abrir el archivo SQL correspondiente
2. Conectarse a la base de datos `malafama`
3. Ejecutar el script

## Limpieza de datos de prueba

Si después de ejecutar tests quedan datos huérfanos en la base de datos:

```bash
cd backend
node migrations/cleanup-test-data.js
```

Este script eliminará:
- ✅ Comandas, mesas y productos sin local_id
- ✅ Proveedores y locales de test
- ✅ Usuarios con email de test
- ✅ Todos los datos relacionados en cascada

## Orden de ejecución de migraciones

Las migraciones deben ejecutarse en orden cronológico según su timestamp:

1. `20251117_add_moneda_to_locales.sql`
2. `20251117_add_bar_type_and_rol_cocina.sql`
3. `20251121_add_payment_fields_to_comandas.sql` - Campos de pago
4. `20251121_fix_comandas_total.sql` - Arreglar totales

## Últimas migraciones

### 20251121_add_payment_fields_to_comandas.sql
Agrega campos de forma de pago a la tabla `comandas`:
- `forma_pago` (efectivo, qr, mixto)
- `cantidad_efectivo`
- `cantidad_qr`
- `comprobante`

### 20251121_fix_comandas_total.sql
Actualiza el total de comandas cerradas calculando la suma de subtotales de pedidos.

## Scripts de utilidad

- `ejecutar-migracion.js` - Ejecuta la última migración
- `fix-totales.js` - Recalcula totales de comandas
- `cleanup-test-data.js` - Limpia datos de prueba huérfanos
