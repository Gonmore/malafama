# MalaFama Frontend

Aplicación web React para el sistema de gestión de pedidos de restaurante.

## Stack Tecnológico

- React 18
- Vite
- React Router v6
- Zustand (State Management)
- TailwindCSS
- Axios
- Socket.io Client
- React Hook Form
- React Hot Toast

## Instalación

1. Instalar dependencias:
```bash
npm install
```

2. Configurar variables de entorno:
```bash
# Crear archivo .env
VITE_API_URL=http://localhost:5000/api/v1
```

3. Iniciar en modo desarrollo:
```bash
npm run dev
```

4. Build para producción:
```bash
npm run build
npm run preview
```

## Estructura del Proyecto

```
frontend/
├── src/
│   ├── components/       # Componentes reutilizables
│   ├── pages/           # Páginas por rol
│   │   ├── admin/       # Vistas de administrador
│   │   ├── atencion/    # Vistas de atención
│   │   ├── cocina/      # Vistas de cocina
│   │   └── proveedor/   # Vistas de proveedor
│   ├── services/        # Servicios API
│   ├── store/           # Estado global (Zustand)
│   ├── App.jsx          # Componente principal
│   └── main.jsx         # Punto de entrada
├── index.html
├── vite.config.js
├── tailwind.config.js
└── package.json
```

## Características

### Autenticación
- Login con JWT
- Persistencia de sesión
- Rutas protegidas por rol
- Auto-logout en token expirado

### Roles de Usuario

#### Admin
- Dashboard con estadísticas
- Gestión de productos
- Gestión de mesas
- Gestión de usuarios
- Reportes y análisis
- Web scraping de menús

#### Atención (Mesero)
- Selección de mesas
- Creación de comandas
- Agregar pedidos
- Cerrar comandas (cuenta)
- Notificaciones de pedidos listos

#### Cocina
- Cola de comandas pendientes
- Alertas visuales y sonoras
- Marcar pedidos como listos
- Vista en tiempo real

#### Proveedor
- Dashboard de ventas de sus productos
- Pagos pendientes
- Historial de pagos
- Reportes por período

### Notificaciones en Tiempo Real
- Socket.io para comunicación bidireccional
- Alertas de nuevas comandas (cocina)
- Notificaciones de pedidos listos (atención)
- Actualizaciones automáticas de estado

## Scripts Disponibles

- `npm run dev` - Iniciar servidor de desarrollo
- `npm run build` - Construir para producción
- `npm run preview` - Preview del build
- `npm run lint` - Ejecutar linter

## Variables de Entorno

- `VITE_API_URL` - URL del backend API

## Próximos Pasos

- [ ] Implementar todas las funcionalidades de cada rol
- [ ] Conectar con APIs del backend
- [ ] Implementar Socket.io para notificaciones
- [ ] Agregar módulo de web scraping
- [ ] Implementar reportes con gráficas
- [ ] Agregar text-to-speech para cocina
- [ ] Optimizar rendimiento
- [ ] Tests con Vitest
