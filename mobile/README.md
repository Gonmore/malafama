# MalaFama Mobile

Aplicación móvil React Native con Expo para el sistema de gestión de pedidos de restaurante.

## Stack Tecnológico

- React Native
- Expo (SDK 54)
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

2. Iniciar Expo (Expo Go):
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

> Para probar en Expo Go (sin builds nativas), evita librerías no soportadas. Este proyecto usa sólo APIs compatibles (Socket.IO, Axios, Zustand, Expo Haptics/AV).

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

Expo (SDK 54) expone variables que empiecen con `EXPO_PUBLIC_` en tiempo de ejecución.

Crear archivo `.env` (o exportarlas en tu shell):
```
EXPO_PUBLIC_BACKEND_ENV=local
# Nota: la app añade `/api/v1` al consumir `EXPO_PUBLIC_API_URL`. Define aquí solo el host y puerto (sin `/api/v1`):
EXPO_PUBLIC_API_URL=http://localhost:5000
EXPO_PUBLIC_WS_URL=http://localhost:5000
```

- En dispositivo físico, reemplaza `localhost` por tu IP de red LAN, por ejemplo:
	- `EXPO_PUBLIC_API_URL=http://192.168.1.50:5000/api/v1`
	- `EXPO_PUBLIC_WS_URL=http://192.168.1.50:5000`

PowerShell (Windows) ejemplo temporal por sesión:
```powershell
$env:EXPO_PUBLIC_BACKEND_ENV="local"; $env:EXPO_PUBLIC_API_URL="http://localhost:5000/api/v1"; $env:EXPO_PUBLIC_WS_URL="http://localhost:5000"; npm start
```

Para emulador Android con backend local:
```powershell
$env:EXPO_PUBLIC_API_URL="http://10.0.2.2:5000/api/v1"; $env:EXPO_PUBLIC_WS_URL="http://10.0.2.2:5000"; npm start
```

## Guía Rápida Expo Go (LAN)

```powershell
cd mobile
	# Para pruebas en dispositivo físico usa SOLO el host: puerto (sin /api/v1)
	$env:EXPO_PUBLIC_API_URL="http://<LAN-IP>:5000"
$env:EXPO_PUBLIC_WS_URL="http://<LAN-IP>:5000"
npx expo start
```

- Asegúrate que el backend esté accesible desde la red LAN (firewall permitido en el puerto 5000).
- En emulador Android, usa `10.0.2.2` para apuntar al host local.
- Si usas túnel de Expo, evita websockets en producción; preferible LAN para Socket.IO.

## Notas de Integración (Sockets y Alcance)

- Salas Socket.IO por rol y local: la app se une a `bar`, `bar:<localId>`, `cocina`, `cocina:<localId>` para recibir solo eventos de tu sede.
- Persistencia de modos de vista en móvil: `bar_modo_vista`, `cocina_modo_vista` (por defecto vistas compactas: `por-pedido-compacto` / `por-producto-compacto`).
- Servicios con filtros: Bar usa `tipo: 'bebida'`, Cocina usa `tipo: 'comida'`; `localId` se deriva de `/locales` si no está definido.

## Estado Actual (Mobile)

📱 **Paridad con Web en Bar/Cocina**
- Modos de vista por pedido y agrupados (producto/mesa en Bar) con variantes compactas.
- Pestaña "Recientes" disponible en Bar y Cocina con actualización en tiempo real.
- Haptics y sonido corto compatibles con Expo.

📊 **Dashboard Mesero**
- Gestión de mesas asignadas con vista lista y agrupada
- Botón de reporte diario (📊) con estadísticas:
  - Comandas abiertas/cerradas del día
  - Total cobrado (efectivo/QR)
  - Promedio de tiempo de entrega
- Soporte completo para dark mode

🔧 **Config y Entorno**
- Variables `EXPO_PUBLIC_API_URL` y `EXPO_PUBLIC_WS_URL` para alternar entre backend local y nube.
- Salas por local para reducir ruido de eventos en multi-sede.

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
