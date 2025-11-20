# 🍽️ MalaFama - Sistema de Gestión de Pedidos para Restaurante

Sistema completo de gestión de pedidos en tiempo real para restaurantes, que incluye backend API, aplicación web y aplicación móvil.

[![Status](https://img.shields.io/badge/status-80%25%20completo-green)]()
[![Backend](https://img.shields.io/badge/backend-100%25%20funcional-success)]()
[![Frontend](https://img.shields.io/badge/frontend-80%25%20integrado-success)]()
[![Onboarding](https://img.shields.io/badge/onboarding-100%25%20funcional-brightgreen)]()

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

## 🚀 Inicio Rápido (Instalación Completa)

### Prerrequisitos

- Node.js 18+
- PostgreSQL 14+
- Docker (opcional)

### Opción 1: Inicio Rápido con Docker

```bash
# 1. Clonar repositorio
git clone <repo-url>
cd MalaFama

# 2. Iniciar base de datos
docker-compose up -d postgres

# 3. Ejecutar scripts SQL
psql -h localhost -U postgres -d malafama -f database/schema.sql
psql -h localhost -U postgres -d malafama -f database/views.sql

# 4. Backend (Terminal 1)
cd backend
cp .env.example .env  # Editar si es necesario
npm install
npm run dev

# 5. Frontend (Terminal 2)
cd frontend
npm install
npm run dev

# 6. Inicializar datos de prueba (Terminal 3)
# En Windows PowerShell:
.\init-data.ps1

# En Linux/Mac:
chmod +x init-data.sh
./init-data.sh
```

### Opción 2: Instalación Manual

#### 1. Configurar Base de Datos

```bash
# Crear base de datos
createdb malafama

# Ejecutar scripts
psql -d malafama -f database/schema.sql
psql -d malafama -f database/views.sql
```

#### 2. Backend

```bash
cd backend
npm install
cp .env.example .env
# Editar .env con tus credenciales
npm run dev
```

El backend estará corriendo en `http://localhost:5000`

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

El frontend estará en `http://localhost:3000`

### 4. Mobile (Opcional)

```bash
cd mobile
npm install
npm start
# Escanea el QR con Expo Go
```

## 🎭 Roles de Usuario

### 👨‍💼 Admin
- Dashboard con estadísticas en tiempo real
- Gestión de productos, mesas y usuarios
- Web scraping de menús online
- Asignación de costos y proveedores
- Reportes y analytics completos
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

- **Onboarding**: `docs/ONBOARDING.md` - Sistema de configuración inicial
- **Integración Frontend**: `INTEGRACION_FRONTEND.md` - Guía de integración completa
- **Bitácora del Proyecto**: `BITACORA.md` - Registro completo de desarrollo
- **Backend**: `backend/README.md`
- **Frontend**: `frontend/README.md`
- **Mobile**: `mobile/README.md`
- **Database**: `database/README.md`

## 🚧 Estado del Proyecto

Ver `BITACORA.md` para el registro detallado de progreso.

**Completado (80%)**:
- ✅ Base de datos completa con vistas
- ✅ Backend API (70+ endpoints)
- ✅ Sistema de onboarding
- ✅ Web scraping de menús
- ✅ Frontend con 3 dashboards integrados
- ✅ Socket.io en tiempo real
- ✅ Notificaciones con audio

**En Desarrollo (15%)**:
- 🔄 Dashboard Proveedor
- 🔄 Páginas CRUD para gestión
- 🔄 Reportes con gráficas

**Pendiente (5%)**:
- ⏳ App móvil funcional
- ⏳ Tests automatizados
- ⏳ Deploy y CI/CD
- 🔄 Funcionalidades por rol

**Pendiente (~30%)**:
- ⏳ Web scraping
- ⏳ Reportes completos
- ⏳ App móvil funcional
- ⏳ Tests y optimización

## 🤝 Contribuir

Este es un proyecto en desarrollo activo. Para contribuir:

1. Consulta `BITACORA.md` para ver el estado actual
2. Revisa las tareas pendientes
3. Sigue la estructura establecida
4. Documenta tus cambios en la bitácora

## 📄 Licencia

ISC

## 👤 Autor

Proyecto desarrollado para gestión de pedidos en restaurantes.

---

**Nota Importante**: Al continuar trabajando en el proyecto, siempre adjunta el archivo `BITACORA.md` para mantener el contexto del desarrollo.
