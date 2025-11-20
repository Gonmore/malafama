# 🚀 Guía de Integración Frontend-Backend

## ✅ Cambios Implementados

### Servicios API Creados
- ✅ `mesaService.js` - Gestión de mesas
- ✅ `comandaService.js` - Gestión de comandas
- ✅ `pedidoService.js` - Gestión de pedidos
- ✅ `productoService.js` - Gestión de productos
- ✅ `reporteService.js` - Reportes y dashboard
- ✅ `socketService.js` - WebSocket para notificaciones en tiempo real

### Hook Personalizado
- ✅ `useSocket.js` - Hook para Socket.io con notificaciones de sonido

### Componentes Nuevos
- ✅ `Modal.jsx` - Modal reutilizable
- ✅ `Alert.jsx` - Alertas con diferentes tipos
- ✅ `LoadingSpinner.jsx` - Indicador de carga

### Dashboards Actualizados
- ✅ **Admin Dashboard** - Conectado con APIs de reportes, mesas, productos
- ✅ **Atención Dashboard** - Sistema completo de creación de comandas con Socket.io
- ✅ **Cocina Dashboard** - Cola de pedidos en tiempo real con notificaciones

---

## 📦 Instalación y Configuración

### 1. Instalar Dependencias (si es necesario)

El frontend ya tiene las dependencias instaladas, pero verifica:

```bash
cd frontend
npm install
```

### 2. Configurar Variables de Entorno

Crea `.env` en `frontend/`:

```env
VITE_API_URL=http://localhost:5000/api/v1
```

### 3. Agregar Sonido de Notificación

Descarga un sonido de notificación (notification.mp3) y colócalo en `frontend/public/`:

```bash
# Opción 1: Usar un sonido de ejemplo (puedes buscar en freesound.org)
# Opción 2: Generar uno con: https://notificationsounds.com/

# El archivo debe estar en:
frontend/public/notification.mp3
```

**Alternativa rápida:** Comenta la línea del audio en `useSocket.js` si no tienes el archivo:

```javascript
// audioRef.current = new Audio('/notification.mp3');
```

---

## 🚀 Iniciar el Sistema Completo

### Terminal 1: Base de Datos
```bash
docker-compose up -d postgres
```

### Terminal 2: Backend
```bash
cd backend
npm run dev
```

### Terminal 3: Frontend
```bash
cd frontend
npm run dev
```

---

## 🧪 Probar el Sistema

### 1. Crear Usuario Admin

**Método 1: Postman/Insomnia**
```http
POST http://localhost:5000/api/v1/auth/register
Content-Type: application/json

{
  "nombre": "Admin Principal",
  "email": "admin@malafama.com",
  "password": "admin123",
  "tipo": "admin"
}
```

**Método 2: cURL**
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

### 2. Login en Frontend

1. Abre: `http://localhost:5173`
2. Login con:
   - Email: `admin@malafama.com`
   - Password: `admin123`

### 3. Crear Mesas (Admin)

```bash
# Crear 20 mesas de una vez
curl -X POST http://localhost:5000/api/v1/mesas/bulk \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TU_TOKEN_AQUI" \
  -d '{
    "cantidad": 20,
    "ubicacion": "Salón Principal",
    "capacidad": 4
  }'
```

### 4. Crear Productos de Prueba

```bash
curl -X POST http://localhost:5000/api/v1/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TU_TOKEN_AQUI" \
  -d '{
    "nombre": "Pizza Margarita",
    "descripcion": "Pizza con tomate y mozzarella",
    "precio": 15.99,
    "categoria": "Pizzas",
    "disponible": true
  }'
```

### 5. Crear Usuarios de Atención y Cocina

```bash
# Usuario de Atención
curl -X POST http://localhost:5000/api/v1/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TU_TOKEN_AQUI" \
  -d '{
    "nombre": "Mesero Juan",
    "email": "juan@malafama.com",
    "password": "juan123",
    "tipo": "atencion"
  }'

# Usuario de Cocina
curl -X POST http://localhost:5000/api/v1/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TU_TOKEN_AQUI" \
  -d '{
    "nombre": "Chef María",
    "email": "maria@malafama.com",
    "password": "maria123",
    "tipo": "cocina"
  }'
```

---

## 🎯 Flujo de Prueba Completo

### Paso 1: Login como Mesero
1. Logout del admin
2. Login con: `juan@malafama.com` / `juan123`

### Paso 2: Crear Comanda
1. Selecciona una mesa disponible (verde)
2. Click en "Agregar Producto"
3. Selecciona productos
4. Ajusta cantidades
5. Click en "Enviar a Cocina"

### Paso 3: Ver en Cocina (otra ventana/navegador)
1. Abre otra ventana: `http://localhost:5173`
2. Login con: `maria@malafama.com` / `maria123`
3. Verás la notificación en tiempo real
4. Verás la nueva comanda en la cola

### Paso 4: Preparar Pedidos
1. En dashboard de cocina, click "Iniciar" en un pedido
2. Estado cambia a "Preparando"
3. Cuando esté listo, click "Marcar Listo"
4. El mesero recibe notificación automática

### Paso 5: Cerrar Comanda
1. Vuelve a la ventana del mesero
2. En "Mis Comandas Abiertas", click "Cerrar Cuenta"
3. Se genera el total automáticamente
4. La mesa queda disponible nuevamente

---

## 🔔 Socket.io en Acción

Las notificaciones funcionan automáticamente cuando:

### Cocina recibe:
- 🔔 `nueva-comanda` - Nueva comanda creada
- 🔔 `nuevos-pedidos` - Pedidos agregados a comanda existente
- ❌ `pedido-cancelado` - Pedido cancelado por mesero

### Atención recibe:
- ✅ `pedido-listo` - Un pedido está listo
- 🎉 `comanda-completa` - Todos los pedidos de una mesa están listos

---

## 🎨 Características Implementadas

### Dashboard Admin
- ✅ Resumen con métricas en tiempo real
- ✅ Ventas del día
- ✅ Top productos del mes
- ✅ Estado de ocupación de mesas con barra de progreso
- ✅ Pagos pendientes a proveedores

### Dashboard Atención
- ✅ Selección visual de mesas (verde=disponible, rojo=ocupada)
- ✅ Agregar productos con modal
- ✅ Ajustar cantidades (+/-)
- ✅ Eliminar items del pedido
- ✅ Cálculo automático del total
- ✅ Lista de comandas abiertas del mesero
- ✅ Cerrar cuenta con validación
- ✅ Notificaciones cuando pedidos están listos

### Dashboard Cocina
- ✅ Cola de pedidos agrupados por comanda
- ✅ Indicador de tiempo transcurrido
- ✅ Alerta visual para pedidos urgentes (>15 min)
- ✅ Estados: Pendiente → Preparando → Listo
- ✅ Actualización automática con Socket.io
- ✅ Vista de mesero y observaciones
- ✅ Contador de notificaciones

---

## 🐛 Troubleshooting

### Error: "Cannot connect to Socket.io"
**Solución:** Verifica que el backend esté corriendo en el puerto 5000

### Error: "401 Unauthorized"
**Solución:** El token expiró, haz logout y vuelve a hacer login

### Las notificaciones no suenan
**Solución:** 
1. Verifica que exista `frontend/public/notification.mp3`
2. O comenta la línea del audio en `useSocket.js`

### Las mesas no aparecen
**Solución:** Crea mesas desde el backend usando el endpoint POST `/api/v1/mesas/bulk`

### Los productos no aparecen
**Solución:** Crea productos desde el backend usando POST `/api/v1/products`

---

## 📱 Próximos Pasos

### Pendientes en Frontend (Prioridad Media)
- [ ] Dashboard de Proveedor (conectar con APIs)
- [ ] Página de gestión de productos (CRUD visual)
- [ ] Página de gestión de usuarios
- [ ] Página de reportes con gráficas (Chart.js o Recharts)
- [ ] Formulario de web scraping
- [ ] Configuración inicial del restaurante

### Mejoras Opcionales
- [ ] Dark mode
- [ ] Internacionalización (i18n)
- [ ] PWA (Progressive Web App)
- [ ] Tests unitarios
- [ ] Animaciones con Framer Motion

---

## 🎉 ¡Sistema Funcional!

Con estos cambios, tienes un sistema **completamente funcional** de gestión de pedidos con:

- ✅ Backend API completo (65+ endpoints)
- ✅ Frontend React integrado
- ✅ Notificaciones en tiempo real con Socket.io
- ✅ 3 dashboards funcionando (Admin, Atención, Cocina)
- ✅ Flujo completo: Crear comanda → Cocina → Cerrar cuenta

**Solo falta:** Conectar el dashboard de Proveedor y agregar páginas de gestión adicionales.

---

## 📚 Recursos Útiles

- [API Reference](../API_REFERENCE.md) - Documentación de todos los endpoints
- [BITACORA.md](../BITACORA.md) - Historial del proyecto
- [STATUS.md](../STATUS.md) - Estado del progreso
- [RESUMEN_BACKEND.md](../RESUMEN_BACKEND.md) - Guía del backend

---

**¿Problemas?** Consulta los logs:
- Backend: Terminal donde corre `npm run dev`
- Frontend: Consola del navegador (F12)
- Socket.io: Busca mensajes con "✅ Socket.io conectado"
