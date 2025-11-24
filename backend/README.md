# MalaFama Backend

API REST para el sistema de gestión de pedidos de restaurante.

## Stack Tecnológico

- Node.js + Express
- PostgreSQL
- Sequelize ORM
- JWT Authentication
- Socket.io (Real-time notifications)
- Puppeteer (Web scraping)

## Instalación

1. Instalar dependencias:
```bash
npm install
```

2. Configurar variables de entorno:
```bash
cp .env.example .env
# Editar .env con tus credenciales
```

3. Configurar base de datos:
```bash
# Ejecutar los scripts SQL en database/
psql -U postgres -d malafama -f ../database/schema.sql
psql -U postgres -d malafama -f ../database/views.sql
```

4. Iniciar servidor:
```bash
# Desarrollo
npm run dev

# Producción
npm start
```

## Estructura del Proyecto

```
backend/
├── src/
│   ├── config/          # Configuraciones (DB, JWT, Socket.io)
│   ├── controllers/     # Lógica de negocio
│   ├── middlewares/     # Middlewares (auth, validación)
│   ├── models/          # Modelos Sequelize
│   ├── routes/          # Definición de rutas
│   ├── services/        # Servicios (scraping, reportes)
│   └── index.js         # Punto de entrada
├── uploads/             # Archivos subidos
├── .env.example         # Ejemplo de variables de entorno
└── package.json
```

## API Endpoints

### Autenticación
- `POST /api/v1/auth/register` - Registrar usuario
- `POST /api/v1/auth/login` - Iniciar sesión
- `GET /api/v1/auth/profile` - Obtener perfil (requiere auth)
- `PUT /api/v1/auth/profile` - Actualizar perfil (requiere auth)

### Usuarios
- `GET /api/v1/users` - Listar usuarios (admin)
- `POST /api/v1/users` - Crear usuario (admin)
- `PUT /api/v1/users/:id` - Actualizar usuario (admin)
- `DELETE /api/v1/users/:id` - Eliminar usuario (admin)

### Productos
- `GET /api/v1/products` - Listar productos
- `POST /api/v1/products` - Crear producto (admin)
- `PUT /api/v1/products/:id` - Actualizar producto (admin)
- `DELETE /api/v1/products/:id` - Eliminar producto (admin)

### Mesas
- `GET /api/v1/mesas` - Listar mesas
- `POST /api/v1/mesas` - Crear mesa (admin)
- `PUT /api/v1/mesas/:id` - Actualizar mesa (admin)

### Comandas
- `GET /api/v1/comandas` - Listar comandas
- `POST /api/v1/comandas` - Crear comanda (atención)
- `POST /api/v1/comandas/:id/pedidos` - Agregar pedidos
- `PUT /api/v1/comandas/:id/cerrar` - Cerrar comanda

### Pedidos
- `GET /api/v1/pedidos/:id` - Obtener pedido
- `PUT /api/v1/pedidos/:id/estado` - Actualizar estado (cocina)

### Proveedores
- `GET /api/v1/proveedores` - Listar proveedores
- `POST /api/v1/proveedores` - Crear proveedor (admin)
- `PUT /api/v1/proveedores/:id` - Actualizar proveedor

### Reportes
- `GET /api/v1/reportes/ventas` - Reporte de ventas
- `GET /api/v1/reportes/productos` - Productos más vendidos
- `GET /api/v1/reportes/proveedores` - Pagos a proveedores

#### Reportes diarios persistidos (snapshot)

- El backend genera snapshots diarios por local que capturan el estado del día de negocio (periodo 06:00 → 06:00). Estos se guardan en la tabla `reportes_diarios` y pueden consultarse desde el panel admin.
- Endpoints útiles:
	- `POST /api/v1/reportes/admin/generar?localId=<id>&date=YYYY-MM-DD` → Fuerza la generación y persistencia de un reporte diario para el `localId` y `date` (si no se indica `date` se usa la fecha negocio actual). Requiere autenticación y rol `admin`.
	- `GET /api/v1/reportes/admin/stored?localId=<id>&date=YYYY-MM-DD` → Devuelve los reportes persistidos (si existen) para el local y fecha indicada.

#### Scripts de ayuda (dev)

Hay un pequeño helper para crear reportes de ejemplo para los días Viernes y Sábado de las últimas 3 semanas (útil para probar el calendario del admin):

```bash
# Desde el directorio backend
npm run seed:reportes:fri-sat
```

Este script busca `locales` activos y crea un `ReporteDiario` sintético para cada viernes y sábado recientes (si no existe ya) — útil para probar la UI sin tener que generar comandas reales.


### Scraping
- `POST /api/v1/scraping/menu` - Extraer menú de URL (admin)

### Configuración
- `GET /api/v1/config` - Obtener configuración
- `POST /api/v1/config` - Crear configuración inicial (admin)

## WebSocket Events

### Cliente → Servidor
- `register` - Registrar usuario conectado
- `ping` - Verificar conexión

### Servidor → Cliente
- `nueva_comanda` - Nueva comanda creada (→ cocina)
- `pedido_listo` - Pedido marcado como listo (→ atención)
- `comanda_cerrada` - Comanda cerrada (→ admin)
- `pong` - Respuesta a ping

## Variables de Entorno

Ver `.env.example` para la lista completa de variables requeridas.

## Desarrollo

El servidor incluye:
- Hot reload con nodemon
- Logs con morgan
- Validación con Joi
- Seguridad con Helmet
- Rate limiting
- CORS configurado

## Próximos Pasos

- [ ] Implementar todos los controladores
- [ ] Agregar tests unitarios
- [ ] Documentación con Swagger
- [ ] Optimizar queries de reportes
- [ ] Implementar caché con Redis
