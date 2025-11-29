# 📚 API Reference - MalaFama

**Base URL:** `http://localhost:5000/api/v1`

**Última actualización:** 20 de Noviembre 2025

---

## 🔐 Autenticación

Todos los endpoints (excepto registro y login) requieren autenticación JWT.

**Header requerido:**
```
Authorization: Bearer <token>
```

**Obtener Token:**
```bash
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"usuario@example.com","password":"password"}'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "uuid",
      "nombre": "Usuario",
      "email": "usuario@example.com",
      "tipo": "admin|atencion|cocina|proveedor"
    }
  }
}
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
Cerrar comanda y generar total (Admin/Atención)

**Body (opcional):**
```json
{
  "metodoPago": "efectivo|qr|mixto",
  "montoEfectivo": 100.00,
  "montoQr": 50.00,
  "imagenComprobante": "base64_string_or_file"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "total": 150.50,
    "estado": "cerrada",
    "metodoPago": "mixto",
    "fechaCierre": "2024-11-20T10:30:00Z"
  }
}
```

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

### GET `/reportes/periodo`
Obtener reporte por período predefinido (usado por el front-end para 'mensual', 'trimestral', 'semestral', 'anual').
- Query: `?localId=<uuid>&periodo=mensual|trimestral|semestral|anual`
- Response: `data` contiene resumen (resumen, ventasPorDia, productosMasVendidos, insights, etc.)

### Reportes programados / Schedules (`/reportes/schedules`)
**Acceso:** Admin

### GET `/reportes/schedules`
Listar programaciones de reportes (schedules)

### POST `/reportes/schedules`
Crear una nueva programación de reporte
```json
{
  "localId": "uuid-del-local",
  "nombre": "Reporte mensual Ventas",
  "frecuencia": "monthly|weekly|daily",
  "tiempo": "HH:MM",
  "diaSemana": 1, // opcional para weekly
  "diaMes": 1, // opcional para monthly
  "formato": "pdf|xlsx|csv",
  "destinatarios": ["a@dominio.com","+59112345678"],
  "activo": true
}
```

### POST `/reportes/schedules/:id/run`
Ejecutar (run) inmediatamente una programación existente (genera y envía el reporte según settings del schedule).

### DELETE `/reportes/schedules/:id`
Eliminar una programación existente.

### Admin manual generation endpoints
### POST `/reportes/admin/generar`
Generar manualmente reportes para debug o pruebas
- Query: `?localId=<uuid>&date=YYYY-MM-DD`

### GET `/reportes/admin/stored`
Listar reportes persistidos (reportes diarios guardados)
- Query: `?localId=<uuid>&date=YYYY-MM-DD`

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

## 🔌 WebSocket Events (Socket.io)

El sistema usa Socket.io para notificaciones en tiempo real.

### Conexión

```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:5000');

// Unirse a room según rol
socket.emit('join-room', 'cocina'); // o 'bar', 'atencion', 'admin'
```

### Events que Emite el Cliente

| Event | Payload | Descripción |
|-------|---------|-------------|
| `join-room` | `'cocina' \| 'bar' \| 'atencion' \| 'admin'` | Unirse a una sala |
| `leave-room` | `'cocina' \| 'bar'` | Salir de una sala |
| `register` | `{ userId, userType }` | Registrar usuario conectado |
| `ping` | - | Test de conexión |

### Events que Escucha el Cliente

| Event | Payload | Descripción | Room |
|-------|---------|-------------|------|
| `nueva-comanda` | `{ comanda, pedidos }` | Nueva comanda creada | `cocina`, `bar` |
| `nuevos-pedidos` | `{ comandaId, pedidos }` | Pedidos agregados a comanda | `cocina`, `bar` |
| `pedido-listo` | `{ pedidoId, comandaId, mesaId }` | Pedido marcado como listo | `atencion` |
| `comanda-completa` | `{ comandaId, mesaId }` | Todos los pedidos listos | `atencion` |
| `pedido-cancelado` | `{ pedidoId, comandaId }` | Pedido cancelado | `cocina`, `bar` |
| `pong` | `{ timestamp }` | Respuesta a ping | individual |

### Ejemplo de Uso (React)

```javascript
import { useEffect } from 'react';
import io from 'socket.io-client';

function CocinaView() {
  useEffect(() => {
    const socket = io('http://localhost:5000');
    
    // Unirse a room
    socket.emit('join-room', 'cocina');
    
    // Escuchar nueva comanda
    socket.on('nueva-comanda', (data) => {
      console.log('Nueva comanda:', data);
      // Actualizar UI + reproducir sonido
      new Audio('/notification.mp3').play();
    });
    
    // Cleanup
    return () => {
      socket.emit('leave-room', 'cocina');
      socket.disconnect();
    };
  }, []);
  
  return <div>Vista de Cocina</div>;
}
```

---

## 📝 Notas Importantes

### Sistema de Tipos de Productos

Los productos se categorizan automáticamente:
- `tipo: 'comida'` → Pedidos van a cocina
- `tipo: 'bebida'` → Pedidos van a bar
- `tipo: 'otros'` → No se notifica

### Sistema de Notas en Pedidos

Cada pedido puede incluir notas:
```json
{
  "productoId": "uuid",
  "cantidad": 2,
  "notas": "Sin picante, sin cebolla"
}
```

Las notas se muestran con ícono 📝 en cocina y bar.

### Sistema de Pagos

Métodos soportados:
1. **Efectivo**: Solo monto efectivo
2. **QR**: Requiere comprobante (imagen)
3. **Mixto**: Efectivo + QR (validación: suma = total)

---

## 🔧 Troubleshooting

### Error 401 Unauthorized
- Verifica que el token JWT sea válido
- El token expira después de 24 horas

### Error 403 Forbidden
- El usuario no tiene permisos para ese endpoint
- Verifica el rol del usuario

### Socket.io no conecta
- Verifica que el backend esté corriendo en puerto 5000
- Verifica CORS en `backend/src/index.js`

---

## 📖 Documentación Relacionada

- [README Principal](./README.md)
- [Bitácora del Proyecto](./BITACORA.md)

---

**Total de Endpoints:** 70+  
**Versión API:** v1  
**Puerto por defecto:** 5000  
**Autor**: Supernovatel S.R.L. (gonzalo.m@supernovatel.com)  
**Ubicación**: La Paz, Bolivia
