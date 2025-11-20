# MalaFama Mobile

Aplicación móvil React Native con Expo para el sistema de gestión de pedidos de restaurante.

## Stack Tecnológico

- React Native
- Expo (~50.0.0)
- Expo Router (File-based routing)
- Zustand (State Management)
- Axios
- Socket.io Client
- AsyncStorage

## Instalación

1. Instalar dependencias:
```bash
npm install
```

2. Iniciar Expo:
```bash
# Iniciar en modo desarrollo
npm start

# Android
npm run android

# iOS
npm run ios

# Web
npm run web
```

## Estructura del Proyecto (Planeada)

```
mobile/
├── app/                 # Expo Router (file-based routing)
│   ├── (auth)/         # Rutas de autenticación
│   │   └── login.js
│   ├── (tabs)/         # Navegación por tabs
│   │   ├── admin.js
│   │   ├── atencion.js
│   │   ├── cocina.js
│   │   └── proveedor.js
│   ├── _layout.js      # Layout principal
│   └── index.js        # Página inicial
├── components/          # Componentes reutilizables
├── services/           # Servicios API
├── store/              # Estado global
├── assets/             # Imágenes y recursos
├── app.json            # Configuración Expo
└── package.json
```

## Características Planeadas

### Roles de Usuario

#### Admin (Móvil)
- Vista de estadísticas
- Gestión básica de productos
- Reportes resumidos
- Notificaciones importantes

#### Atención (Móvil) - Principal uso
- Escaneo rápido de mesas (QR codes)
- Toma de pedidos con interfaz táctil
- Agregar/modificar pedidos
- Cerrar comandas
- Notificaciones de pedidos listos con vibración

#### Cocina (Móvil)
- Cola de comandas con prioridad
- Alertas push de nuevas comandas
- Sonido y vibración
- Marcar pedidos listos con un tap
- Vista simplificada y clara

#### Proveedor (Móvil)
- Dashboard de ventas
- Notificaciones de ventas
- Ver productos más vendidos

### Funcionalidades Móviles

- **Notificaciones Push**: Alertas en tiempo real
- **Vibración**: Feedback háptico para cocina
- **Audio**: Sonidos de alerta
- **Cámara**: QR codes para mesas (opcional)
- **Offline-first**: Caché local con AsyncStorage
- **Dark Mode**: Soporte para tema oscuro

## Desarrollo

### Requisitos Previos

- Node.js 18+
- Expo CLI
- Expo Go app (para testing en dispositivo físico)
- Android Studio / Xcode (para emuladores)

### Testing

```bash
# En dispositivo físico
1. Instalar Expo Go desde Play Store / App Store
2. Ejecutar: npm start
3. Escanear QR code con Expo Go

# En emulador
npm run android  # Android
npm run ios      # iOS (solo macOS)
```

## Variables de Entorno

Crear archivo `.env`:
```
API_URL=http://tu-ip-local:5000/api/v1
SOCKET_URL=http://tu-ip-local:5000
```

> **Nota**: En desarrollo móvil, usar IP local en lugar de localhost

## Build para Producción

```bash
# Android APK
expo build:android

# iOS (requiere cuenta Apple Developer)
expo build:ios

# Usando EAS Build (recomendado)
eas build --platform android
eas build --platform ios
```

## Estado Actual

📋 **Estructura básica creada**
- Configuración de Expo
- package.json con dependencias
- Estructura de carpetas base

⏳ **Pendiente de implementación**:
- Todas las pantallas y componentes
- Integración con API
- Socket.io para notificaciones
- Navegación completa
- Autenticación móvil
- Notificaciones push

> La app móvil se desarrollará después de completar y validar el backend y frontend web.

## Próximos Pasos

1. Completar backend y frontend web
2. Implementar navegación con Expo Router
3. Crear pantallas por rol
4. Integrar con API del backend
5. Implementar notificaciones push
6. Testing en dispositivos físicos
7. Optimización de rendimiento
8. Build y distribución

## Recursos

- [Expo Documentation](https://docs.expo.dev/)
- [React Native Documentation](https://reactnative.dev/)
- [Expo Router](https://expo.github.io/router/)
