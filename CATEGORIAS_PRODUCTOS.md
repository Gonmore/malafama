# 📂 Sistema de Categorías de Productos

## ✅ Implementado

El sistema ahora organiza productos por categorías (Menú de Picoteo, Bebidas, Pizzas, etc.) para facilitar la selección por parte de los meseros.

---

## 🔧 Cambios Realizados

### Backend

#### 1. Controlador de Productos (`producto.controller.js`)

**Funciones Nuevas:**

- `getProductosPorCategoria()` - Retorna productos agrupados por categoría
  ```javascript
  GET /api/v1/products/agrupados?activo=true&localId=xxx
  
  Response: {
    success: true,
    data: [
      {
        categoria: "Menú de Picoteo",
        productos: [...],
        total: 8
      },
      {
        categoria: "Bebidas",
        productos: [...],
        total: 6
      },
      {
        categoria: "Pizzas",
        productos: [...],
        total: 8
      }
    ],
    totalCategorias: 3,
    totalProductos: 22
  }
  ```

**Funciones Mejoradas:**

- `getCategorias()` - Ahora retorna cantidad de productos por categoría
  ```javascript
  GET /api/v1/products/categorias?localId=xxx
  
  Response: {
    success: true,
    data: [
      { nombre: "Menú de Picoteo", cantidad: 8 },
      { nombre: "Bebidas", cantidad: 6 },
      { nombre: "Pizzas", cantidad: 8 }
    ]
  }
  ```

- `getAllProductos()` - Ahora ordena por categoría y nombre, soporta filtro por `localId`

#### 2. Rutas (`product.routes.js`)

**Nueva ruta:**
```javascript
GET /api/v1/products/agrupados
```

---

### Frontend

#### 1. Servicio de Productos (`productoService.js`)

**Nuevo método:**
```javascript
getAgrupados: async (params = {}) => {
  const response = await api.get('/products/agrupados', { params });
  return response.data;
}
```

#### 2. Componente `ProductosPorCategoria.jsx`

Componente visual para seleccionar productos organizados por categorías.

**Características:**
- ✅ Pestañas para cada categoría (Menú de Picoteo, Bebidas, Pizzas)
- ✅ Grid responsive de productos (1-4 columnas según tamaño de pantalla)
- ✅ Muestra foto, nombre, descripción y precio de cada producto
- ✅ Badge con cantidad de productos por categoría
- ✅ Manejo de loading y errores
- ✅ Callback `onProductoSeleccionado` para integración con otros componentes
- ✅ Soporte para filtrar por `localId` (multi-tenant)

**Props:**
```javascript
<ProductosPorCategoria
  onProductoSeleccionado={(producto) => {
    // Callback cuando se selecciona un producto
  }}
  localId={user?.localId}
/>
```

#### 3. Dashboard de Atención (`pages/atencion/Dashboard.jsx`)

**Actualización:**
- El modal de selección de productos ahora usa `ProductosPorCategoria`
- Modal ampliado a tamaño `xl` y altura fija de 600px
- Cierra automáticamente al seleccionar un producto

---

## 🎯 Flujo de Usuario (Mesero)

1. **Mesero selecciona una mesa**
2. **Hace clic en "Agregar Producto"**
3. **Se abre modal con productos por categorías:**
   - Ve pestañas: "Menú de Picoteo" | "Bebidas" | "Pizzas"
   - Cada pestaña muestra badge con cantidad (ej: "8")
4. **Hace clic en una categoría**
   - Ve grid de productos de esa categoría
   - Cada tarjeta muestra: foto, nombre, descripción, precio
5. **Selecciona un producto**
   - Se agrega al pedido
   - Modal se cierra automáticamente
6. **Puede ajustar cantidad** con botones +/-
7. **Envía pedido a cocina**

---

## 📊 Ejemplo de Datos

### Respuesta de `/api/v1/products/agrupados`

```json
{
  "success": true,
  "data": [
    {
      "categoria": "Menú de Picoteo",
      "total": 8,
      "productos": [
        {
          "id": "uuid-1",
          "nombre": "Nachos Chili con Carne",
          "descripcion": null,
          "precio": "50.00",
          "foto": null,
          "categoria": "Menú de Picoteo",
          "activo": true,
          "proveedor": {
            "id": "uuid-proveedor",
            "nombre": "Distribuidora Central"
          }
        },
        {
          "id": "uuid-2",
          "nombre": "Nachos con Queso y Pico de Gallo",
          "descripcion": null,
          "precio": "50.00",
          "foto": null,
          "categoria": "Menú de Picoteo",
          "activo": true
        }
        // ... más productos
      ]
    },
    {
      "categoria": "Bebidas",
      "total": 6,
      "productos": [ /* ... */ ]
    },
    {
      "categoria": "Pizzas",
      "total": 8,
      "productos": [ /* ... */ ]
    }
  ],
  "totalCategorias": 3,
  "totalProductos": 22
}
```

---

## 🔄 Integración con Scraping

El scraping web ya asigna categorías automáticamente:

```javascript
// En scraping.service.js - extractProductsFromTab()
const producto = {
  nombre: cleanText(nombre),
  descripcion: null,
  precio: precio,
  foto: null,
  categoria: categoria, // ← Se asigna desde la pestaña clickeada
  costo: 0,
  proveedorId: null
};
```

**Flujo de scraping:**
1. Puppeteer hace clic en cada pestaña (Menú de Picoteo, Bebidas, Pizzas)
2. Extrae productos de cada pestaña
3. Asigna categoría según pestaña activa
4. Todos los productos se guardan con su categoría

---

## ✨ Ventajas del Sistema

1. **Mejor UX para meseros**
   - Encuentran productos rápidamente por categoría
   - No necesitan buscar en lista larga de 22+ productos
   
2. **Escalable**
   - Soporta múltiples categorías dinámicamente
   - No hay límite de productos por categoría

3. **Responsive**
   - Grid adaptable: 1 columna (móvil) → 4 columnas (desktop)
   - Pestañas con scroll horizontal en pantallas pequeñas

4. **Multi-tenant Ready**
   - Filtra por `localId` automáticamente
   - Cada local tiene sus propias categorías

5. **Reutilizable**
   - Componente `ProductosPorCategoria` puede usarse en:
     - Dashboard de atención (✅ implementado)
     - App móvil (futuro)
     - Kiosco de autoservicio (futuro)

---

## 🧪 Testing

### Backend

```bash
# Obtener productos agrupados
GET http://localhost:5000/api/v1/products/agrupados?activo=true
Authorization: Bearer <token>

# Obtener categorías con cantidad
GET http://localhost:5000/api/v1/products/categorias
Authorization: Bearer <token>
```

### Frontend

1. Iniciar backend: `cd backend && npm run dev`
2. Iniciar frontend: `cd frontend && npm run dev`
3. Login como mesero
4. Seleccionar una mesa
5. Hacer clic en "Agregar Producto"
6. **Verificar:**
   - ✅ Pestañas de categorías visibles
   - ✅ Badge con cantidad correcta
   - ✅ Productos se muestran en grid
   - ✅ Al hacer clic en producto, se agrega y cierra modal

---

## 📝 Próximos Pasos (Opcionales)

### Mejoras Futuras

1. **Búsqueda de productos**
   - Agregar input de búsqueda en el modal
   - Buscar por nombre en todas las categorías

2. **Favoritos/Recientes**
   - Categoría especial "Más Pedidos"
   - Categoría "Recientes" con últimos 10 productos

3. **Fotos de productos**
   - Upload de imágenes en admin
   - Mostrar fotos en tarjetas de productos

4. **Filtros adicionales**
   - Filtrar por proveedor
   - Filtrar por rango de precio
   - Solo productos con stock

5. **Analytics**
   - Productos más vendidos por categoría
   - Tiempo promedio de selección
   - Categorías más populares

---

## 🎓 Para Desarrolladores

### Agregar Nueva Categoría

Las categorías son **dinámicas** - se crean automáticamente cuando se agregan productos con una categoría nueva.

**Ejemplo:**
```javascript
// Crear producto con nueva categoría
POST /api/v1/products
{
  "nombre": "Ensalada César",
  "precio": 35,
  "categoria": "Ensaladas", // ← Nueva categoría
  "costo": 15,
  "proveedorId": "uuid-proveedor"
}
```

La categoría "Ensaladas" aparecerá automáticamente en:
- `GET /api/v1/products/categorias`
- `GET /api/v1/products/agrupados`
- Componente `ProductosPorCategoria`

### Personalizar Componente

```javascript
// Ejemplo: Solo mostrar categoría específica
<ProductosPorCategoria
  onProductoSeleccionado={handleSelect}
  localId={localId}
  // Props opcionales (agregar en futuro):
  // categoriasPermitidas={["Bebidas", "Pizzas"]}
  // mostrarDescripciones={false}
  // columnas={{ sm: 2, md: 3, lg: 4 }}
/>
```

---

**Fecha de implementación:** ${new Date().toLocaleDateString('es-ES')}
**Versión:** 1.0
**Estado:** ✅ Completado y funcional
