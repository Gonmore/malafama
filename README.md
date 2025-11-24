# 🍽️ MalaFama - Sistema de Gestión de Pedidos para Restaurante

Sistema completo de gestión de pedidos en tiempo real para restaurantes, que incluye backend API, aplicación web y aplicación móvil.

[![Status](https://img.shields.io/badge/status-90%25%20completo-green)]()
[![Backend](https://img.shields.io/badge/backend-100%25%20funcional-success)]()
[![Frontend](https://img.shields.io/badge/frontend-90%25%20integrado-success)]()
[![Onboarding](https://img.shields.io/badge/onboarding-100%25%20funcional-brightgreen)]()
[![Dark Mode](https://img.shields.io/badge/dark%20mode-100%25%20implementado-brightgreen)]()
[![Testing](https://img.shields.io/badge/tests-flujo%20completo-green)]()

## 📖 Descripción

MalaFama es una solución integral que digitaliza y optimiza el flujo de trabajo en restaurantes, desde la toma de pedidos hasta la preparación en cocina y el control administrativo.

### ✨ Características Implementadas

- ✅ **Onboarding Inteligente** - Configuración guiada en 3 pasos (Mesas → Productos → Costos)
- ✅ **Autenticación multi-rol** (Admin, Atención, Cocina, Proveedor)
- ✅ **Backend completo** 70+ endpoints API REST
- ✅ **Frontend React integrado** con 3 dashboards funcionando
- ✅ **Notificaciones en tiempo real** con Socket.io
- ✅ **Web Scraping avanzado** para importar menús (Preview + Import)
- ✅ **Reportes avanzados** con vistas SQL optimizadas
 - ✅ **Reportes avanzados** con vistas SQL optimizadas
 - ✅ **Generación automática de reportes diarios** a las 06:00 (snapshot por local) — los reportes se guardan en la tabla `reportes_diarios` y están disponibles para revisión en el panel admin
  - Sistema adicional de reportes diarios automáticos (6AM): el backend genera y persiste un snapshot por cada local con la información del periodo 06:00→06:00 para que el admin los consulte o descargue.
- ✅ **Control de costos** y cálculo de márgenes automático
- ✅ **Gestión completa de comandas** con estados
- 🔄 **Sistema de pedidos** con actualización en tiempo real
- ⏳ App móvil (estructura básica creada)

## 🎯 Flujo de Trabajo

```
1. Mesero → Selecciona Mesa → Agrega Productos
                ↓
2. Envía Comanda → Notificación a Cocina (Socket.io + Sonido)
                ↓
3. Cocina → Ve Cola de Pedidos → Prepara
                ↓
4. Marca "Listo" → Notificación a Mesero (Socket.io)
                ↓
5. Mesero → Cierra Cuenta → Mesa Disponible
```

## 🏗️ Arquitectura

```
┌─────────────────┐
│   PostgreSQL    │  Base de datos relacional
└────────┬────────┘
         │
┌────────▼────────┐
│  Backend API    │  Node.js + Express + Socket.io
│  (Port 5000)    │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
┌───▼──┐  ┌──▼────┐
│ Web  │  │ Mobile│
│React │  │  RN   │
└──────┘  └───────┘
```

## 📁 Estructura del Proyecto

```
MalaFama/
├── backend/          # API Node.js + Express
│   ├── src/
│   │   ├── config/       # Configuraciones (DB, JWT, Socket)
│   │   ├── controllers/  # Lógica de negocio
│   │   ├── middlewares/  # Auth, validación
│   │   ├── models/       # Modelos Sequelize
│   │   ├── routes/       # Definición de rutas
│   │   ├── services/     # Servicios (scraping, reportes)
│   │   └── index.js      # Punto de entrada
│   └── package.json
│
├── frontend/         # Aplicación web React
│   ├── src/
│   │   ├── components/   # Componentes reutilizables
│   │   ├── pages/        # Páginas por rol
│   │   ├── services/     # Servicios API
│   │   ├── store/        # Estado global (Zustand)
│   │   └── App.jsx
│   └── package.json
│
├── mobile/          # App móvil React Native
│   ├── app/             # Expo Router
│   ├── components/      # Componentes móviles
│   └── package.json
│
├── database/        # Scripts SQL y migraciones
│   ├── schema.sql       # Estructura de BD
│   ├── views.sql        # Vistas para reportes
│   └── README.md
│
├── BITACORA.md      # Registro de todas las tareas
└── README.md        # Este archivo
```

## 🚀 Inicio Rápido

### Prerrequisitos

- Node.js 18+
- PostgreSQL 14+
- Docker (opcional)

### Opción 1: Con Docker (Recomendado)

```bash
# 1. Clonar repositorio
git clone <repo-url>
cd MalaFama

# 2. Iniciar todos los servicios
docker-compose up -d

# 3. Ver logs
docker-compose logs -f

# 4. Detener servicios
docker-compose down
```

Esto iniciará:
- PostgreSQL en puerto 5432
- Backend en puerto 5000
- Frontend en puerto 3000

### Opción 2: Instalación Manual

#### 1. Base de Datos

```bash
# Crear base de datos
createdb malafama

# O con psql
psql -U postgres
CREATE DATABASE malafama;
\q

# Ejecutar scripts
psql -U postgres -d malafama -f database/schema.sql
psql -U postgres -d malafama -f database/views.sql
```

#### 2. Backend

```bash
cd backend
npm install
cp .env.example .env
# Editar .env con tus credenciales:
# - DB_PASSWORD=tu_password
# - JWT_SECRET=una_clave_secreta_segura
npm run dev
```

Backend corriendo en: `http://localhost:5000`

#### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend corriendo en: `http://localhost:3000`

#### 4. Mobile (Opcional)

```bash
cd mobile
npm install
npm start
# Escanear QR con Expo Go app
```

### Verificar Instalación

```bash
# Health check backend
curl http://localhost:5000/health
# Debería responder: {"status":"OK","timestamp":"...","service":"MalaFama API"}

# Frontend - Abrir en navegador
http://localhost:3000
```

### Crear Usuario Admin

```bash
# Con curl
curl -X POST http://localhost:5000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Admin Principal",
    "email": "admin@malafama.com",
    "password": "password123",
    "tipo": "admin"
  }'

# O con PowerShell (Windows)
Invoke-RestMethod -Uri "http://localhost:5000/api/v1/auth/register" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"nombre":"Admin Principal","email":"admin@malafama.com","password":"password123","tipo":"admin"}'
```

### Troubleshooting

**Backend no inicia:**
- Verifica que PostgreSQL esté corriendo
- Verifica las credenciales en `.env`
- Verifica que el puerto 5000 esté libre

**Frontend no conecta:**
- Verifica que el backend esté corriendo
- Verifica la URL en `frontend/.env`

**Puerto ocupado (Windows):**
```bash
netstat -ano | findstr :5000
taskkill /PID [PID] /F
```

**Reset completo de BD:**
```bash
dropdb malafama
createdb malafama
psql -U postgres -d malafama -f database/schema.sql
psql -U postgres -d malafama -f database/views.sql
```

## 🎭 Roles de Usuario

### 👨‍💼 Admin
- Dashboard con estadísticas en tiempo real
- Gestión de productos, mesas y usuarios
- Web scraping de menús online
- Asignación de costos y proveedores
- Reportes y analytics completos

## 🗂️ Reportes diarios — snapshots y pruebas

El sistema crea un snapshot persistido por local cada día a las 06:00 (definición de día negocio: 06:00 → 06:00). Estos reportes se guardan en la tabla `reportes_diarios` y están disponibles en el panel de administración.

Si quieres generar o probar reportes manualmente (útil en desarrollo):

- Endpoint manual (requiere admin):

```bash
# Generar reporte para local y fecha (YYYY-MM-DD)
curl -X POST "http://localhost:5000/api/v1/reportes/admin/generar?localId=<LOCAL_ID>&date=2025-11-21" -H "Authorization: Bearer <TOKEN>"

# PowerShell (Windows)
Invoke-RestMethod -Uri "http://localhost:5000/api/v1/reportes/admin/generar?localId=<LOCAL_ID>&date=2025-11-21" `
  -Method POST `
  -Headers @{"Authorization" = "Bearer <TOKEN>"}
```

- Seed helper (dev): el backend incluye un script que crea reportes de ejemplo para Fridays/Saturdays recientes:

```powershell
cd backend
npm run seed:reportes:fri-sat
```

En la UI admin (Reportes diarios) verás ahora una vista de mes con días marcados. Los días con reporte persistido muestran un marcador diferente (📌) de los días que sólo tienen actividad calculada (📝). Además, la vista del calendario muestra qué día de la semana corresponde a cada fecha (Lun..Dom) para navegación más intuitiva.

- Control de pagos a proveedores

### 🤵 Atención (Mesero)
- Selección rápida de mesas
- Creación y gestión de comandas
- Agregar pedidos a comandas existentes
- Notificaciones cuando pedidos están listos
- Cerrar comandas (generar cuenta)

### 👨‍🍳 Cocina
- Cola de comandas en tiempo real
- Alertas visuales y sonoras de nuevas comandas
- Text-to-speech de pedidos
- Marcar pedidos como listos
- Vista priorizada de pendientes

### 🚚 Proveedor
- Dashboard de ventas de sus productos
- Pagos pendientes por período
- Historial de pagos
- Reportes personalizados

## 🔄 Flujo de Trabajo

1. **Setup Inicial (Admin)**
   - Admin se registra
   - Define cantidad de mesas
   - Opcionalmente ejecuta web scraping del menú existente
   - Asigna proveedores y costos a productos
   - Crea usuarios de atención y cocina

2. **Operación Diaria**
   - Mesero selecciona mesa y toma pedidos
   - Envía a cocina → Notificación inmediata
   - Cocina ve alerta y escucha pedidos
   - Cocina marca pedidos listos → Notificación a mesero
   - Mesero entrega y puede agregar más pedidos
   - Mesero cierra comanda cuando solicitan cuenta

3. **Reportes y Pagos**
   - Admin ve reportes en tiempo real
   - Cálculo automático de pagos a proveedores
   - Proveedores ven sus ventas y pagos pendientes

## 🛠️ Tecnologías

### Backend
- Node.js + Express
- PostgreSQL + Sequelize ORM
- JWT Authentication
- Socket.io
- Puppeteer (Web Scraping)
- Bcrypt, Helmet, CORS

### Frontend Web
- React 18
- Vite
- TailwindCSS
- Zustand
- React Router v6
- Axios
- Socket.io Client

### Mobile
- React Native
- Expo
- Expo Router
- AsyncStorage

## 📊 Base de Datos

### Tablas Principales
- `usuarios` - Usuarios del sistema
- `proveedores` - Proveedores de productos
- `productos` - Catálogo con precios y costos
- `mesas` - Mesas del restaurante
- `comandas` - Comandas por mesa
- `pedidos` - Pedidos individuales
- `configuracion_restaurante` - Config inicial
- `pagos_proveedores` - Control de pagos
- `auditoria` - Log de cambios

### Vistas para Reportes
- Ventas por producto
- Ventas por mesa
- Ventas diarias
- Productos más vendidos
- Pagos pendientes a proveedores
- Rendimiento por mesero
- Estado de comandas
- Inventario y costos

## 🔌 API Endpoints

Ver documentación completa en `backend/README.md`

**Autenticación:**
- `POST /api/v1/auth/register` - Registro
- `POST /api/v1/auth/login` - Login

**Onboarding (Admin):**
- `GET /api/v1/onboarding/estado` - Estado del onboarding
- `POST /api/v1/onboarding/paso1/mesas` - Crear mesas masivamente
- `POST /api/v1/onboarding/paso2/preview` - Preview de web scraping
- `POST /api/v1/onboarding/paso3/importar` - Importar productos con costos
- `POST /api/v1/onboarding/completar` - Marcar configuración completada

**Principales:**
- `GET /api/v1/productos` - Listar productos
- `POST /api/v1/comandas` - Crear comanda
- `PUT /api/v1/pedidos/:id/estado` - Actualizar estado
- `GET /api/v1/reportes/ventas` - Reporte de ventas
- `POST /api/v1/scraping/preview` - Web scraping de menú

## 📱 WebSocket Events

- `nueva-comanda` → Cocina recibe nueva comanda
- `nuevos-pedidos` → Cocina actualiza cola
- `pedido-listo` → Atención recibe notificación
- `comanda-completa` → Admin recibe actualización
- `pedido-cancelado` → Cocina actualiza vista

## 🧪 Testing

```bash
# Backend
cd backend
npm test

# Frontend
cd frontend
npm test
```

## 📝 Documentación

- **README.md** (este archivo) - Guía principal del proyecto
- **BITACORA.md** - Registro completo de desarrollo y tareas
- **API_REFERENCE.md** - Documentación completa de endpoints
- **Backend**: `backend/README.md`
- **Frontend**: `frontend/README.md`
- **Mobile**: `mobile/README.md`
- **Database**: `database/README.md`

## 🛠️ Comandos Útiles

### Desarrollo Diario

```bash
# Iniciar backend (Terminal 1)
cd backend && npm run dev

# Iniciar frontend (Terminal 2)
cd frontend && npm run dev

# Con Docker (todo en uno)
docker-compose up
```

### Base de Datos

```bash
# Conectar a PostgreSQL
psql -U postgres -d malafama

# Backup
pg_dump -U postgres malafama > backup.sql

# Restore
psql -U postgres -d malafama < backup.sql

# Ver tablas
\dt

# Ver vistas
\dv
```

### Testing

```bash
# Backend
cd backend && npm test

# Frontend
cd frontend && npm test

# Lint
npm run lint
```

### Docker

```bash
# Ver logs en tiempo real
docker-compose logs -f

# Reconstruir
docker-compose up --build

# Limpiar todo
docker-compose down -v
docker system prune -a
```

### Git

```bash
# Commit con formato convencional
git commit -m "feat: descripción"
git commit -m "fix: descripción"
git commit -m "docs: descripción"

# Push
git push origin main
```

## 🚧 Estado del Proyecto

Ver `BITACORA.md` para el registro detallado de progreso.

### Completado (90%)

**Infraestructura:**
- ✅ Base de datos PostgreSQL (9 tablas + 8 vistas)
- ✅ Backend API completo (70+ endpoints)
- ✅ Autenticación JWT multi-rol
- ✅ Socket.io para tiempo real
- ✅ Web scraping (Puppeteer + Cheerio)

**Frontend Web:**
- ✅ Sistema de onboarding completo
- ✅ Dashboard Mesero con comandas funcionales
- ✅ Dashboard Cocina con cola en tiempo real
- ✅ Dashboard Bar con gestión de bebidas
- ✅ Modal de pago con cámara para comprobantes
- ✅ Notificaciones con audio
- ✅ Vista compacta en cocina/bar
- ✅ Sistema de notas en pedidos
- ✅ **Dark Mode** en Mesero, Bar y Cocina (ambiente oscuro para teatro)
- ✅ **Sistema de Acknowledgment** (reconocimiento de entrega)
- ✅ Footer adaptativo con logo dinámico
- ✅ Animaciones y transiciones suaves

**Funcionalidades Core:**
- ✅ Gestión completa de mesas
- ✅ Creación y cierre de comandas
- ✅ Pedidos con notas personalizadas
- ✅ Categorización automática de productos (comida/bebida)
- ✅ Cálculo automático de totales
- ✅ Sistema de pagos (efectivo/QR/mixto)
- ✅ Reconocimiento visual de comandas entregadas
- ✅ Indicadores visuales para comandas listas (parpadeo + emoji)

### En Desarrollo (10%)

- 🔄 Dashboard Admin con reportes visuales
- 🔄 Dashboard Proveedor
- 🔄 Páginas CRUD para gestión de productos/usuarios
- 🔄 Gráficas y analytics

### Pendiente (5%)

- ⏳ App móvil React Native
- ⏳ Tests automatizados
- ⏳ Deploy y CI/CD
- ⏳ Documentación Swagger/OpenAPI

## 🤝 Contribuir

Este es un proyecto en desarrollo activo. Para contribuir:

1. Consulta `BITACORA.md` para ver el estado actual
2. Revisa las tareas pendientes
3. Sigue la estructura establecida
4. Documenta tus cambios en la bitácora

## 📄 Licencia

ISC

## 👤 Autor

Supernovatel S.R.L.
gonzalo.m@supernovatel.com
Gonzalo Moreno Dolz
La Paz, Bolivia

---

**Nota Importante**: Al continuar trabajando en el proyecto, siempre adjunta el archivo `BITACORA.md` para mantener el contexto del desarrollo.
