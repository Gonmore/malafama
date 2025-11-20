# 📚 API Endpoints Reference - MalaFama

**Base URL:** `http://localhost:5000/api/v1`

**Última actualización:** ${new Date().toLocaleDateString('es-ES')}

---

## 🔐 Autenticación

Todos los endpoints requieren autenticación excepto los de registro/login.

**Header requerido:**
```
Authorization: Bearer <token>
```

---

## 📍 Auth Routes (`/auth`)

### POST `/auth/register`
Registrar nuevo usuario
```json
{
  "nombre": "string",
  "email": "string",
  "password": "string",
  "tipo": "admin|atencion|cocina",
  "telefono": "string",
  "direccion": "string"
}
```

### POST `/auth/login`
Iniciar sesión
```json
{
  "email": "string",
  "password": "string"
}
```

### GET `/auth/profile`
Obtener perfil del usuario autenticado

### PUT `/auth/profile`
Actualizar perfil
```json
{
  "nombre": "string",
  "telefono": "string",
  "direccion": "string"
}
```

---

## 👥 Usuario Routes (`/users`)

**Acceso:** Solo Admin (excepto ver propio perfil)

### GET `/users`
Listar todos los usuarios
- Query: `?tipo=admin|atencion|cocina&activo=true|false&search=texto`

### GET `/users/tipo/:tipo`
Obtener usuarios por tipo

### GET `/users/:id`
Obtener usuario por ID

### POST `/users`
Crear nuevo usuario
```json
{
  "nombre": "string",
  "email": "string",
  "password": "string",
  "tipo": "admin|atencion|cocina",
  "telefono": "string",
  "direccion": "string"
}
```

### PUT `/users/:id`
Actualizar usuario

### PUT `/users/:id/password`
Cambiar contraseña
```json
{
  "passwordActual": "string",
  "passwordNueva": "string"
}
```

### PUT `/users/:id/activar`
Activar usuario

### PUT `/users/:id/desactivar`
Desactivar usuario

### DELETE `/users/:id`
Eliminar (soft delete) usuario

---

## 🍕 Producto Routes (`/products`)

### GET `/products`
Listar productos
- Query: `?categoria=string&disponible=true|false&proveedor=id&search=texto`

### GET `/products/categorias`
Obtener lista de categorías

### GET `/products/:id`
Obtener producto por ID

### POST `/products`
Crear producto (Admin/Proveedor)
```json
{
  "nombre": "string",
  "descripcion": "string",
  "precio": 12.50,
  "categoria": "string",
  "foto": "string (URL)",
  "disponible": true,
  "proveedorId": 1,
  "costoProveedor": 8.00
}
```

### POST `/products/bulk`
Crear múltiples productos (para scraping)
```json
{
  "productos": [
    {
      "nombre": "string",
      "descripcion": "string",
      "precio": 12.50,
      "categoria": "string"
    }
  ]
}
```

### PUT `/products/:id`
Actualizar producto

### PUT `/products/:id/proveedor`
Asignar proveedor y costo
```json
{
  "proveedorId": 1,
  "costoProveedor": 8.00
}
```

### DELETE `/products/:id`
Eliminar (soft delete) producto

---

## 🏢 Proveedor Routes (`/proveedores`)

### GET `/proveedores`
Listar todos los proveedores
- Query: `?activo=true|false&search=texto`

### GET `/proveedores/propio`
Obtener datos del proveedor autenticado

### GET `/proveedores/:id`
Obtener proveedor por ID

### POST `/proveedores`
Crear proveedor (Admin)
```json
{
  "nombre": "string",
  "email": "string",
  "password": "string",
  "telefono": "string",
  "direccion": "string",
  "ruc": "string"
}
```

### PUT `/proveedores/:id`
Actualizar proveedor

### DELETE `/proveedores/:id`
Eliminar proveedor

---

## 🔍 Web Scraping Routes (`/scraping`)

**Acceso:** Solo Admin

### POST `/scraping/scrapear`
Iniciar web scraping
```json
{
  "url": "https://restaurante.com/menu"
}
```

### POST `/scraping/previsualizar`
Vista previa del scraping sin guardar
```json
{
  "url": "https://restaurante.com/menu"
}
```

### POST `/scraping/confirmar`
Confirmar y guardar productos scrapeados
```json
{
  "productos": [
    {
      "nombre": "string",
      "descripcion": "string",
      "precio": 12.50,
      "categoria": "string"
    }
  ]
}
```

### POST `/scraping/test`
Probar scraping (modo debug)
```json
{
  "url": "https://restaurante.com/menu"
}
```

---

## ⚙️ Configuración Routes (`/config`)

**Acceso:** Solo Admin

### GET `/config`
Obtener configuración del restaurante

### POST `/config`
Crear configuración inicial
```json
{
  "nombreRestaurante": "string",
  "direccion": "string",
  "telefono": "string",
  "email": "string",
  "cantidadMesas": 20
}
```

### PUT `/config/:id`
Actualizar configuración

### PUT `/config/:id/scraping-completado`
Marcar scraping como completado

### PUT `/config/:id/finalizar`
Finalizar configuración inicial

### GET `/config/verificar`
Verificar estado de configuración
```json
Response: {
  "configuracionCreada": true,
  "mesasCreadas": true,
  "productosCreados": true,
  "usuariosCreados": true,
  "completo": true
}
```

---

## 🪑 Mesa Routes (`/mesas`)

### GET `/mesas`
Listar mesas
- Query: `?activo=true|false&disponible=true|false`

### GET `/mesas/ocupacion`
Obtener estado de ocupación
```json
Response: {
  "totalMesas": 20,
  "mesasOcupadas": 8,
  "mesasDisponibles": 12,
  "porcentajeOcupacion": 40
}
```

### GET `/mesas/:id`
Obtener mesa por ID

### POST `/mesas`
Crear mesa (Admin)
```json
{
  "nombre": "Mesa 1",
  "numero": 1,
  "ubicacion": "Terraza",
  "capacidad": 4
}
```

### POST `/mesas/bulk`
Crear múltiples mesas (Admin)
```json
{
  "cantidad": 20,
  "ubicacion": "Salón Principal",
  "capacidad": 4
}
```

### PUT `/mesas/:id`
Actualizar mesa (Admin)

### DELETE `/mesas/:id`
Eliminar mesa (Admin)

---

## 📝 Comanda Routes (`/comandas`)

### GET `/comandas`
Listar comandas
- Query: `?estado=abierta|cerrada&usuarioAtencionId=1&fecha=2024-01-15&limit=50`

### GET `/comandas/abiertas`
Obtener todas las comandas abiertas

### GET `/comandas/:id`
Obtener comanda por ID

### GET `/comandas/mesa/:mesaId`
Obtener comandas de una mesa
- Query: `?estado=abierta|cerrada&limit=10`

### POST `/comandas`
Crear comanda (Admin/Atención)
```json
{
  "mesaId": 1,
  "usuarioAtencionId": 2,
  "observaciones": "Cliente alérgico al maní",
  "pedidos": [
    {
      "productoId": 5,
      "cantidad": 2,
      "observaciones": "Sin cebolla"
    }
  ]
}
```

### POST `/comandas/:id/pedidos`
Agregar pedidos a comanda existente (Admin/Atención)
```json
{
  "pedidos": [
    {
      "productoId": 3,
      "cantidad": 1
    }
  ]
}
```

### PUT `/comandas/:id/cerrar`
Cerrar comanda (Admin/Atención)

---

## 🍽️ Pedido Routes (`/pedidos`)

### GET `/pedidos/cocina/pendientes`
Obtener pedidos pendientes (Admin/Cocina)
- Query: `?estado=pendiente,preparando`
```json
Response: [
  {
    "comanda": { "id": 1, "mesa": { "numero": 5 } },
    "pedidos": [...]
  }
]
```

### GET `/pedidos/:id`
Obtener pedido por ID

### GET `/pedidos/comanda/:comandaId`
Obtener pedidos de una comanda

### PUT `/pedidos/:id/estado`
Actualizar estado de pedido (Admin/Cocina)
```json
{
  "estado": "pendiente|preparando|listo|entregado|cancelado"
}
```

### PUT `/pedidos/:id/listo`
Marcar pedido como listo (Admin/Cocina)

### PUT `/pedidos/:id/cantidad`
Actualizar cantidad (Admin/Atención)
```json
{
  "cantidad": 3
}
```

### PUT `/pedidos/:id/cancelar`
Cancelar pedido (Admin/Atención)
```json
{
  "motivo": "Cliente cambió de opinión"
}
```

---

## 📊 Reporte Routes (`/reportes`)

**Acceso:** Solo Admin (excepto algunos para Proveedor)

### GET `/reportes/dashboard`
Resumen general del dashboard
```json
Response: {
  "ventasHoy": { "total_ventas": 1250.50, "total_comandas": 45 },
  "comandasAbiertas": 8,
  "topProductos": [...],
  "pagosPendientes": 3500.00
}
```

### GET `/reportes/ventas-periodo`
Ventas por período
- Query: `?fechaInicio=2024-01-01&fechaFin=2024-01-31` (REQUERIDO)

### GET `/reportes/productos-mas-vendidos`
Productos más vendidos
- Query: `?fechaInicio=2024-01-01&fechaFin=2024-01-31&limit=20`

### GET `/reportes/ventas-producto`
Ventas por producto
- Query: `?fechaInicio=2024-01-01&fechaFin=2024-01-31&categoria=Entradas`

### GET `/reportes/ventas-mesa`
Ventas por mesa
- Query: `?fechaInicio=2024-01-01&fechaFin=2024-01-31`

### GET `/reportes/pagos-pendientes`
Pagos pendientes a proveedores (Admin/Proveedor)

### GET `/reportes/rendimiento-meseros`
Rendimiento de meseros
- Query: `?fechaInicio=2024-01-01&fechaFin=2024-01-31`

### GET `/reportes/estado-comandas`
Estado actual de comandas abiertas

### GET `/reportes/inventario-proveedores`
Inventario de proveedores (Admin/Proveedor)
- Query: `?proveedorId=1`

---

## 🔔 WebSocket Events

**Conexión:** `ws://localhost:5000`

### Rooms (Salas)
- `cocina` - Para usuarios tipo cocina
- `atencion` - Para usuarios tipo atención
- `admin` - Para usuarios admin
- `proveedor` - Para usuarios proveedor

### Events Emitidos (Backend → Cliente)

#### `nueva-comanda`
```json
{
  "comanda": { ... },
  "mensaje": "Nueva comanda #123 - Mesa 5"
}
```

#### `nuevos-pedidos`
```json
{
  "comandaId": 123,
  "mesa": 5,
  "pedidos": 2,
  "mensaje": "2 nuevo(s) pedido(s) - Mesa 5"
}
```

#### `pedido-listo`
```json
{
  "pedidoId": 456,
  "productoNombre": "Pizza Margarita",
  "mesa": 5,
  "comandaId": 123,
  "mensaje": "Pizza Margarita listo - Mesa 5"
}
```

#### `comanda-completa`
```json
{
  "comandaId": 123,
  "mesa": 5,
  "mensaje": "Todos los pedidos de Mesa 5 están listos"
}
```

#### `pedido-cancelado`
```json
{
  "pedidoId": 456,
  "productoNombre": "Pizza Margarita",
  "comandaId": 123,
  "motivo": "Cliente cambió de opinión"
}
```

---

## 🛠️ Códigos de Estado HTTP

| Código | Significado |
|--------|-------------|
| 200 | OK - Operación exitosa |
| 201 | Created - Recurso creado |
| 400 | Bad Request - Error en los datos enviados |
| 401 | Unauthorized - No autenticado |
| 403 | Forbidden - Sin permisos |
| 404 | Not Found - Recurso no encontrado |
| 500 | Internal Server Error - Error del servidor |

---

## 📋 Formato de Respuestas

### Éxito
```json
{
  "success": true,
  "message": "Operación exitosa",
  "data": { ... }
}
```

### Error
```json
{
  "success": false,
  "message": "Descripción del error",
  "error": "Detalles técnicos (solo en desarrollo)"
}
```

---

## 🔑 Roles y Permisos

| Rol | Permisos |
|-----|----------|
| **admin** | Acceso total a todo el sistema |
| **atencion** | Crear comandas, agregar pedidos, ver mesas |
| **cocina** | Ver pedidos, actualizar estado de pedidos |
| **proveedor** | Ver sus productos, ver reportes propios |

---

## 🚀 Testing con cURL

### Registrar Admin
```bash
curl -X POST http://localhost:5000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Admin Principal",
    "email": "admin@malafama.com",
    "password": "admin123",
    "tipo": "admin"
  }'
```

### Login
```bash
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@malafama.com",
    "password": "admin123"
  }'
```

### Crear Mesa (con token)
```bash
curl -X POST http://localhost:5000/api/v1/mesas/bulk \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "cantidad": 20,
    "ubicacion": "Salón Principal"
  }'
```

---

## 📖 Documentación Relacionada

- [README Principal](../README.md)
- [Bitácora del Proyecto](../BITACORA.md)
- [Estado del Proyecto](../STATUS.md)
- [Guía de Inicio Rápido](../QUICKSTART.md)

---

**Total de Endpoints:** 65+
**Versión API:** v1
**Puerto por defecto:** 5000
