# 🎯 Sistema de Onboarding - MalaFama

## Descripción General

Sistema de configuración inicial guiada para nuevos administradores del restaurante. Permite configurar el sistema en 3 pasos simples:

1. **Configurar Mesas**: Definir cantidad, ubicación y capacidad
2. **Crear Productos**: Web scraping automático o creación manual
3. **Asignar Costos**: Definir costos y proveedores para calcular márgenes

## 🏗️ Arquitectura

### Backend

#### Modelo Usuario
```javascript
{
  onboarding_completado: BOOLEAN, // default: false
  // ... otros campos
}
```

#### API Endpoints

**Base:** `/api/v1/onboarding`

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/estado` | Estado del onboarding (pasos completados) |
| POST | `/paso1/mesas` | Crear mesas en bulk |
| POST | `/paso2/preview` | Preview de scraping |
| POST | `/paso3/importar` | Importar productos con costo/proveedor |
| POST | `/productos/bulk` | Crear productos manualmente |
| POST | `/completar` | Marcar onboarding como completado |

#### Controlador: `onboarding.controller.js`

```javascript
// GET /api/v1/onboarding/estado
{
  success: true,
  data: {
    onboarding_completado: false,
    pasos: {
      mesas: true,
      productos: false
    },
    totales: {
      mesas: 10,
      productos: 0
    }
  }
}

// POST /api/v1/onboarding/paso1/mesas
// Body: { cantidad: 10, ubicacion: 'General', capacidad: 4 }
{
  success: true,
  message: "10 mesas creadas exitosamente",
  data: {
    mesas: [...],
    total: 10
  }
}

// POST /api/v1/onboarding/paso2/preview
// Body: { url: 'https://ejemplo.com/menu' }
{
  success: true,
  message: "15 productos encontrados",
  data: {
    url: "https://ejemplo.com/menu",
    productos: [
      {
        nombre: "Pizza Margarita",
        precio: 15.99,
        descripcion: "Tomate, mozzarella, albahaca",
        categoria: "Pizzas"
      }
    ],
    total: 15
  }
}

// POST /api/v1/onboarding/paso3/importar
// Body: { productos: [{ nombre, precio, costo, proveedor_id, categoria }] }
{
  success: true,
  message: "15 productos importados exitosamente",
  data: {
    productos: [...],
    total: 15
  }
}

// POST /api/v1/onboarding/completar
{
  success: true,
  message: "¡Configuración inicial completada!",
  data: {
    onboarding_completado: true,
    resumen: {
      mesas: 10,
      productos: 15
    }
  }
}
```

### Frontend

#### Componentes

```
frontend/src/pages/onboarding/
├── OnboardingWizard.jsx          # Componente principal (wizard)
└── steps/
    ├── Paso1Mesas.jsx             # Formulario de mesas
    ├── Paso2Productos.jsx          # Web scraping o manual
    └── Paso3CostoProveedor.jsx     # Asignar costos y proveedores
```

#### Servicio: `onboardingService.js`

```javascript
import onboardingService from '@/services/onboardingService';

// Obtener estado
const estado = await onboardingService.getEstado();

// Crear mesas
const response = await onboardingService.crearMesas(10, 'General', 4);

// Preview scraping
const productos = await onboardingService.previewScraping('https://ejemplo.com/menu');

// Importar productos
await onboardingService.importarProductos(productosConCosto);

// Crear productos manualmente
await onboardingService.crearProductosBulk(productos);

// Completar onboarding
await onboardingService.completarOnboarding();
```

## 📝 Flujo de Usuario

### Registro y Primera Vez

1. **Admin se registra** → `onboarding_completado = false`
2. **Login exitoso** → Redirige a `/onboarding` (ProtectedRoute)
3. **Completa 3 pasos** del wizard
4. **Marca completado** → `onboarding_completado = true`
5. **Redirige** a `/admin/dashboard`

### Paso 1: Configurar Mesas

```
┌─────────────────────────────────────┐
│  Paso 1: Configurar Mesas           │
├─────────────────────────────────────┤
│  ¿Cuántas mesas tiene tu            │
│  restaurante? [10]                  │
│                                     │
│  Ubicación: [General ▼]            │
│  Capacidad: [4 personas ▼]         │
│                                     │
│  📋 Resumen:                        │
│  • Se crearán 10 mesas              │
│  • Numeradas del 1 al 10            │
│  • Ubicación: General               │
│  • Capacidad: 4 personas            │
│                                     │
│              [Continuar →]          │
└─────────────────────────────────────┘
```

**Funcionalidad:**
- Selector de cantidad (1-100)
- Select de ubicación predefinida
- Select de capacidad (2, 4, 6, 8)
- Preview del resumen
- Llamada a `POST /api/v1/onboarding/paso1/mesas`

### Paso 2: Crear Productos

#### Opción A: Web Scraping

```
┌─────────────────────────────────────┐
│  Paso 2: Crear Productos            │
├─────────────────────────────────────┤
│  [🌐 Web Scraping] [✏️ Manual]     │
│                                     │
│  URL de tu menú web:                │
│  [https://ejemplo.com/menu]         │
│                        [Extraer]    │
│                                     │
│  ✅ 15 productos encontrados        │
│  ┌─────────────────────────────┐   │
│  │ Pizza Margarita      $15.99 │   │
│  │ Hamburguesa Clásica  $12.50 │   │
│  │ Ensalada César       $9.99  │   │
│  │ ...                          │   │
│  └─────────────────────────────┘   │
│                                     │
│  [← Atrás] [Continuar con estos →] │
└─────────────────────────────────────┘
```

**Funcionalidad:**
- Input de URL con validación
- Botón "Extraer" que llama `POST /api/v1/onboarding/paso2/preview`
- Loading spinner durante scraping
- Lista scrollable de productos encontrados
- Manejo de errores (URL inválida, sin productos)

#### Opción B: Creación Manual

```
┌─────────────────────────────────────┐
│  Paso 2: Crear Productos            │
├─────────────────────────────────────┤
│  [🌐 Web Scraping] [✏️ Manual]     │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ Nombre: [Pizza Margarita   ]│   │
│  │ Categoría: [Pizzas ▼]       │   │
│  │ Precio: [$15.99]            │   │
│  │ Descripción: [Opcional...]  │   │
│  │              [🗑️ Eliminar]  │   │
│  └─────────────────────────────┘   │
│                                     │
│  [+ Agregar otro producto]          │
│                                     │
│  [← Atrás]           [Continuar →] │
└─────────────────────────────────────┘
```

**Funcionalidad:**
- Lista dinámica de formularios de producto
- Botón "Agregar otro producto"
- Validación: nombre y precio requeridos
- Select de categorías predefinidas

### Paso 3: Asignar Costos y Proveedores

```
┌─────────────────────────────────────┐
│  Paso 3: Asignar Costos             │
├─────────────────────────────────────┤
│  👥 Proveedores: [+ Agregar]        │
│  [Distribuidora XYZ]                │
│                                     │
│  [⚡ Aplicar costo masivo]          │
│  [⚡ Aplicar proveedor masivo]      │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ Pizza Margarita             │   │
│  │ Pizzas • Venta: $15.99      │   │
│  │ Margen: 88%                 │   │
│  │ Costo: [$8.50]              │   │
│  │ Proveedor: [Distrib. XYZ ▼] │   │
│  └─────────────────────────────┘   │
│                                     │
│  💡 Sobre los márgenes              │
│  • Margen > 100%: Excelente         │
│  • Margen 50-100%: Buena            │
│                                     │
│  [← Atrás] [✅ Completar config]   │
└─────────────────────────────────────┘
```

**Funcionalidad:**
- Gestión de proveedores (crear nuevo inline)
- Acciones masivas (aplicar % de costo, asignar proveedor a todos)
- Inputs de costo por producto
- Cálculo automático de margen: `((precio - costo) / costo) * 100`
- Indicador visual de margen (verde > 100%, amarillo 50-100%, rojo < 50%)
- Validación: todos deben tener costo y proveedor

## 🔐 Seguridad y Validaciones

### Backend

```javascript
// Middleware: Solo admin puede acceder
router.use(authenticate, authorize('admin'));

// Validación en completarOnboarding
if (mesasCount === 0 || productosCount === 0) {
  return res.status(400).json({
    success: false,
    message: 'Debes completar todos los pasos'
  });
}
```

### Frontend

```javascript
// ProtectedRoute verifica onboarding_completado
if (requireOnboarding && user.tipo === 'admin' && user.onboarding_completado === false) {
  return <Navigate to="/onboarding" replace />
}
```

## 🗄️ Base de Datos

### Migración

```sql
-- 002_add_onboarding_field.sql
ALTER TABLE usuarios 
ADD COLUMN IF NOT EXISTS onboarding_completado BOOLEAN DEFAULT FALSE;

-- Auto-completar si ya tienen datos
UPDATE usuarios u
SET onboarding_completado = TRUE
WHERE u.tipo = 'admin' 
AND (SELECT COUNT(*) FROM mesas) > 0
AND (SELECT COUNT(*) FROM productos) > 0;
```

## 🎨 UI/UX

### Barra de Progreso

```
[✓] ───────── [2] ───────── [3]
Mesas      Productos    Costos
```

### Estados Visuales

- **Paso activo**: Fondo azul, texto blanco
- **Paso completado**: Check verde
- **Paso pendiente**: Gris

### Colores y Estilos

- Primary: `bg-blue-600`
- Success: `bg-green-600`
- Warning: `bg-yellow-50`
- Gradient: `from-blue-50 to-indigo-100`

## 🧪 Testing

### Flujo Completo

1. **Registro**
```bash
curl -X POST http://localhost:5000/api/v1/auth/register \
-H "Content-Type: application/json" \
-d '{
  "nombre": "Admin Nuevo",
  "email": "admin@test.com",
  "password": "admin123",
  "tipo": "admin"
}'
```

2. **Login** → Redirige a `/onboarding`

3. **Paso 1: Mesas**
```bash
curl -X POST http://localhost:5000/api/v1/onboarding/paso1/mesas \
-H "Authorization: Bearer $TOKEN" \
-H "Content-Type: application/json" \
-d '{ "cantidad": 10, "ubicacion": "General", "capacidad": 4 }'
```

4. **Paso 2: Scraping**
```bash
curl -X POST http://localhost:5000/api/v1/onboarding/paso2/preview \
-H "Authorization: Bearer $TOKEN" \
-H "Content-Type: application/json" \
-d '{ "url": "https://ejemplo.com/menu" }'
```

5. **Paso 3: Importar**
```bash
curl -X POST http://localhost:5000/api/v1/onboarding/paso3/importar \
-H "Authorization: Bearer $TOKEN" \
-H "Content-Type: application/json" \
-d '{
  "productos": [
    {
      "nombre": "Pizza Margarita",
      "precio": 15.99,
      "costo": 8.50,
      "proveedor_id": "uuid",
      "categoria": "Pizzas"
    }
  ]
}'
```

6. **Completar**
```bash
curl -X POST http://localhost:5000/api/v1/onboarding/completar \
-H "Authorization: Bearer $TOKEN"
```

## 📊 Casos de Uso

### 1. Admin Nuevo Sin Menú Web

1. Paso 1: Crea 10 mesas
2. Paso 2: Selecciona "Manual", agrega 5 productos
3. Paso 3: Crea proveedor, asigna costos
4. ✅ Completa onboarding

### 2. Admin con Menú Web

1. Paso 1: Crea 15 mesas
2. Paso 2: Pega URL → Scraping encuentra 25 productos
3. Paso 3: Usa "Aplicar costo masivo" (40% del precio) → Asigna proveedor masivo
4. ✅ Completa onboarding

### 3. Scraping Falla

1. Paso 1: Crea mesas
2. Paso 2: URL inválida o sin productos detectados
3. → Toast de error + Cambia automáticamente a método "Manual"
4. Usuario crea productos manualmente
5. ✅ Completa onboarding

## 🔧 Mantenimiento

### Editar Configuración Después

Los administradores pueden modificar después:

- **Mesas**: CRUD desde `/admin/mesas`
- **Productos**: CRUD desde `/admin/productos`
- **Proveedores**: CRUD desde `/admin/proveedores`

### Resetear Onboarding (Admin Avanzado)

```sql
UPDATE usuarios 
SET onboarding_completado = FALSE 
WHERE email = 'admin@ejemplo.com';
```

## 🚀 Mejoras Futuras

- [ ] Paso 4: Crear usuarios (atención, cocina)
- [ ] Importar desde Excel/CSV
- [ ] Tutorial interactivo (tooltips)
- [ ] Guardar progreso parcial (draft)
- [ ] Previsualización de scraping mejorada (editar productos)
- [ ] Sugerencias de categorías basadas en IA
- [ ] Cálculo automático de costos sugeridos

## 📚 Referencias

- API: `/api/v1/onboarding`
- Componente: `frontend/src/pages/onboarding/OnboardingWizard.jsx`
- Servicio: `frontend/src/services/onboardingService.js`
- Controlador: `backend/src/controllers/onboarding.controller.js`
- Rutas: `backend/src/routes/onboarding.routes.js`
- Migración: `database/migrations/002_add_onboarding_field.sql`
