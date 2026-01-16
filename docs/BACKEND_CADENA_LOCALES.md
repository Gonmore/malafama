# Cambios Backend: Soporte para Cadena de Locales

## Resumen
Este documento detalla los cambios necesarios en el backend para soportar la funcionalidad de **Cadena de Locales** en la aplicación móvil de admin. La cadena de locales permite a un admin crear múltiples locales con el mismo menú, proveedores y configuración inicial, pero con sockets independientes y usuarios diferenciados por local.

---

## 1. Modelo de Datos

### 1.1 Tabla `locales`
**Campo nuevo a agregar:**
- `cadena` (VARCHAR, nullable): Nombre de la cadena a la que pertenece el local. Si es `NULL`, el local es independiente.

**Migración SQL:**
```sql
ALTER TABLE locales ADD COLUMN cadena VARCHAR(255);
CREATE INDEX idx_locales_cadena ON locales(cadena);
```

### 1.2 Tabla `usuarios`
**Cambio en generación de emails:**
- Para locales en cadena, los usuarios (mesero, cocina, bar) deben tener emails diferenciados por local.
- Formato sugerido: `{rol}.{ciudad}@{cadena}.com`
  - Ejemplo: `mesero.lapaz@pizzahut.com`, `cocina.lapaz@pizzahut.com`, `bar.santacruz@pizzahut.com`

**Validación:**
- El campo `email` debe permitir duplicados parciales (diferentes locales, mismo rol) pero ser único globalmente.

---

## 2. Endpoints

### 2.1 POST `/api/locales` (Modificación)
**Descripción:** Crear un local individual o múltiples locales como parte de una cadena.

**Request Body (existente):**
```json
{
  "nombre": "Pizza Hut La Paz",
  "direccion": "La Paz, Zona Sur, Calle 21",
  "telefono": "12345678",
  "logo": "data:image/jpeg;base64,...",
  "cadena": null
}
```

**Request Body (nuevo - para cadena):**
```json
{
  "nombre": "Pizza Hut La Paz",
  "direccion": "La Paz, Zona Sur, Calle 21",
  "telefono": "12345678",
  "logo": "data:image/jpeg;base64,...",
  "cadena": "Pizza Hut"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "local": {
      "id": 1,
      "nombre": "Pizza Hut La Paz",
      "direccion": "La Paz, Zona Sur, Calle 21",
      "cadena": "Pizza Hut",
      "logo": "http://...",
      "createdAt": "2025-12-15T00:00:00.000Z"
    }
  }
}
```

**Cambios en controlador:**
- Aceptar el campo `cadena` en el payload.
- Si `cadena` existe, guardarlo en el registro del local.
- El logo debe replicarse en todos los locales de la cadena (o almacenarse una sola vez y referenciarse).

---

### 2.2 POST `/api/locales/cadena` (Nuevo - Opcional)
**Descripción:** Endpoint especializado para crear múltiples locales de una cadena de una sola vez.

**Request Body:**
```json
{
  "cadenaNombre": "Pizza Hut",
  "logo": "data:image/jpeg;base64,...",
  "locales": [
    {
      "nombre": "Pizza Hut La Paz",
      "direccion": "La Paz, Zona Sur, Calle 21",
      "telefono": "12345678"
    },
    {
      "nombre": "Pizza Hut Santa Cruz",
      "direccion": "Santa Cruz, Centro, Av. Monseñor Rivero",
      "telefono": "87654321"
    }
  ],
  "configuracion": {
    "cantidadMesas": 10,
    "capacidadMesas": 4,
    "crearUsuarios": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "cadena": "Pizza Hut",
    "locales": [
      {
        "id": 1,
        "nombre": "Pizza Hut La Paz",
        "direccion": "La Paz, Zona Sur, Calle 21",
        "usuarios": [
          { "email": "mesero.lapaz@pizzahut.com", "tipo": "atencion" },
          { "email": "cocina.lapaz@pizzahut.com", "tipo": "cocina" },
          { "email": "bar.lapaz@pizzahut.com", "tipo": "bar" }
        ]
      },
      {
        "id": 2,
        "nombre": "Pizza Hut Santa Cruz",
        "direccion": "Santa Cruz, Centro, Av. Monseñor Rivero",
        "usuarios": [
          { "email": "mesero.santacruz@pizzahut.com", "tipo": "atencion" },
          { "email": "cocina.santacruz@pizzahut.com", "tipo": "cocina" },
          { "email": "bar.santacruz@pizzahut.com", "tipo": "bar" }
        ]
      }
    ],
    "totalLocales": 2,
    "totalUsuarios": 6
  }
}
```

**Lógica del controlador:**
1. Crear cada local con el campo `cadena` establecido.
2. Para cada local:
   - Crear mesas según `cantidadMesas` y `capacidadMesas`.
   - Si `crearUsuarios` es `true`, crear 3 usuarios por defecto (mesero, cocina, bar).
   - Generar emails diferenciados usando la primera palabra de `direccion` (ciudad) y el `cadenaNombre`.
3. Retornar resumen completo.

**Función auxiliar para emails:**
```javascript
function generarEmailCadena(rol, direccion, cadenaNombre) {
  const ciudad = direccion.split(',')[0].trim().toLowerCase().replace(/\s+/g, '');
  const cadena = cadenaNombre.toLowerCase().replace(/\s+/g, '');
  return `${rol}.${ciudad}@${cadena}.com`;
}
```

---

### 2.3 POST `/api/onboarding/mesas` (Modificación)
**Descripción:** Crear mesas en un local o múltiples locales.

**Request Body (actual):**
```json
{
  "cantidad": 10,
  "localId": "1",
  "ubicacion": "General",
  "capacidad": 4
}
```

**Request Body (nuevo - para múltiples locales):**
```json
{
  "cantidad": 10,
  "localIds": ["1", "2", "3"],
  "ubicacion": "General",
  "capacidad": 4
}
```

**Cambios:**
- Si `localIds` es un array, iterar y crear mesas en cada local.
- Mantener compatibilidad con `localId` único.

---

### 2.4 POST `/api/proveedores` (Modificación)
**Descripción:** Crear proveedor en uno o múltiples locales.

**Request Body (actual):**
```json
{
  "nombre": "Propio",
  "telefono": "12345678",
  "email": "proveedor@example.com",
  "localId": "1"
}
```

**Request Body (nuevo - para múltiples locales):**
```json
{
  "nombre": "Propio",
  "telefono": "12345678",
  "email": "proveedor@example.com",
  "localIds": ["1", "2", "3"]
}
```

**Cambios:**
- Si `localIds` es un array, crear un proveedor por cada local con el mismo nombre y datos.
- Mantener compatibilidad con `localId` único.

---

### 2.5 POST `/api/onboarding/productos/bulk` (Modificación)
**Descripción:** Crear productos en múltiples locales.

**Request Body (actual):**
```json
{
  "productos": [
    { "nombre": "Pizza Margarita", "precio": 50, "costo": 20, "proveedorId": "1", "tipo": "comida" }
  ],
  "localId": "1"
}
```

**Request Body (nuevo - para múltiples locales):**
```json
{
  "productos": [
    { "nombre": "Pizza Margarita", "precio": 50, "costo": 20, "tipo": "comida" }
  ],
  "localIds": ["1", "2", "3"],
  "proveedorNombre": "Propio"
}
```

**Cambios:**
- Si `localIds` es un array:
  1. Para cada `localId`, buscar el proveedor con el nombre `proveedorNombre`.
  2. Crear los productos asociándolos al proveedor correspondiente de ese local.
- Mantener compatibilidad con `localId` y `proveedorId` únicos.

---

## 3. Sockets

### 3.1 Salas de Socket por Local
**Descripción:** Cada local tiene su propia sala de socket para que las comandas y pedidos sean independientes.

**Implementación actual:**
- Los usuarios se unen a una sala basada en su `localId`.
- Ejemplo: `socket.join(`local-${localId}`)`

**Verificación:**
- Confirmar que el socket service ya implementa salas por local.
- Si no, modificar `backend/src/services/socket.js`:

```javascript
io.on('connection', (socket) => {
  const { localId } = socket.handshake.query;
  
  if (localId) {
    socket.join(`local-${localId}`);
    console.log(`Usuario se unió a sala: local-${localId}`);
  }

  // Emitir eventos solo a la sala del local
  socket.on('nueva-comanda', (data) => {
    io.to(`local-${data.localId}`).emit('comanda-creada', data);
  });

  socket.on('disconnect', () => {
    console.log(`Usuario desconectado de local-${localId}`);
  });
});
```

---

## 4. Reportes (Admin)

### 4.1 GET `/api/reportes/local/:localId` (Existente)
**Descripción:** Obtener reportes de un local específico.

**Response:**
```json
{
  "success": true,
  "data": {
    "localId": "1",
    "nombre": "Pizza Hut La Paz",
    "totalVentas": 5000,
    "totalComandas": 120,
    "productosMasVendidos": [...]
  }
}
```

---

### 4.2 GET `/api/reportes/cadena/:cadenaNombre` (Nuevo)
**Descripción:** Obtener reportes consolidados de todos los locales de una cadena.

**Response:**
```json
{
  "success": true,
  "data": {
    "cadena": "Pizza Hut",
    "totalLocales": 3,
    "totalVentas": 15000,
    "totalComandas": 360,
    "reportesPorLocal": [
      {
        "localId": "1",
        "nombre": "Pizza Hut La Paz",
        "totalVentas": 5000,
        "totalComandas": 120
      },
      {
        "localId": "2",
        "nombre": "Pizza Hut Santa Cruz",
        "totalVentas": 7000,
        "totalComandas": 150
      },
      {
        "localId": "3",
        "nombre": "Pizza Hut Cochabamba",
        "totalVentas": 3000,
        "totalComandas": 90
      }
    ]
  }
}
```

**Lógica del controlador:**
1. Buscar todos los locales con `cadena = cadenaNombre`.
2. Agregar las ventas y comandas de cada local.
3. Retornar el consolidado.

---

## 5. Creación de Usuarios por Defecto

### 5.1 Función: `crearUsuariosPorDefecto(localId, direccion, cadenaNombre)`
**Ubicación:** `backend/src/services/usuario.service.js` (nuevo archivo) o en controlador de locales.

**Descripción:** Crear 3 usuarios (mesero, cocina, bar) para un local con emails diferenciados.

**Código de referencia:**
```javascript
async function crearUsuariosPorDefecto(localId, direccion, cadenaNombre) {
  const ciudad = direccion.split(',')[0].trim().toLowerCase().replace(/\s+/g, '');
  const cadena = cadenaNombre ? cadenaNombre.toLowerCase().replace(/\s+/g, '') : 'local';
  
  const roles = [
    { tipo: 'atencion', nombre: 'Mesero' },
    { tipo: 'cocina', nombre: 'Cocina' },
    { tipo: 'bar', nombre: 'Bar' }
  ];

  const usuariosCreados = [];

  for (const rol of roles) {
    const email = `${rol.tipo}.${ciudad}@${cadena}.com`;
    const password = await bcrypt.hash('password123', 10); // Cambiar por generación segura

    const usuario = await Usuario.create({
      nombre: rol.nombre,
      email: email,
      password: password,
      tipo: rol.tipo,
      localId: localId
    });

    usuariosCreados.push({ email, tipo: rol.tipo, id: usuario.id });
  }

  return usuariosCreados;
}

module.exports = { crearUsuariosPorDefecto };
```

**Uso:**
- Llamar esta función después de crear cada local en el flujo de cadena.
- Los usuarios tendrán contraseña por defecto `password123` (se puede enviar por email o mostrar en resumen).

---

## 6. Validaciones

### 6.1 Direcciones
- Validar que cada dirección tenga al menos 3 palabras separadas por comas o espacios (Ciudad, zona, calle).
- Ejemplo válido: `"La Paz, Zona Sur, Calle 21"`
- Ejemplo inválido: `"La Paz"`

### 6.2 Emails Únicos
- Garantizar que no existan emails duplicados en la tabla `usuarios`.
- Si un usuario ya existe con ese email (por ejemplo, de otra cadena), agregar un sufijo numérico: `mesero.lapaz2@pizzahut.com`.

### 6.3 Nombre de Cadena
- No permitir caracteres especiales en `cadenaNombre` (solo letras, números y espacios).
- Convertir a minúsculas y sin espacios al generar emails.

---

## 7. Testing

### 7.1 Casos de Prueba
1. **Crear local individual** sin campo `cadena`.
2. **Crear local individual** con campo `cadena`.
3. **Crear cadena con 2 locales** usando endpoint `/api/locales/cadena`.
4. **Crear cadena con 5 locales** y verificar usuarios únicos por local.
5. **Crear mesas en cadena** usando `localIds`.
6. **Crear proveedores en cadena** usando `localIds`.
7. **Crear productos en cadena** con proveedor compartido.
8. **Obtener reportes de cadena** consolidados.
9. **Sockets independientes**: verificar que eventos en local 1 no afecten local 2.

### 7.2 Scripts de Migración
- Crear script SQL para agregar campo `cadena` a `locales`.
- Crear script de rollback para eliminar el campo si es necesario.

---

## 8. Implementación Sugerida (Orden)

1. **Migración de base de datos**: Agregar campo `cadena` a tabla `locales`.
2. **Modificar modelo `Local`**: Incluir campo `cadena`.
3. **Endpoint `/api/locales`**: Aceptar campo `cadena` en creación.
4. **Función `crearUsuariosPorDefecto`**: Crear en `usuario.service.js`.
5. **Endpoint `/api/locales/cadena`**: Crear endpoint especializado (opcional, la app móvil usa el flujo existente).
6. **Modificar `/api/onboarding/mesas`**: Soportar `localIds`.
7. **Modificar `/api/proveedores`**: Soportar `localIds`.
8. **Modificar `/api/onboarding/productos/bulk`**: Soportar `localIds` y `proveedorNombre`.
9. **Endpoint `/api/reportes/cadena/:cadenaNombre`**: Crear para reportes consolidados.
10. **Testing completo**: Ejecutar casos de prueba.

---

## 9. Notas Adicionales

### 9.1 Contraseñas por Defecto
- Los usuarios creados automáticamente tienen contraseña `password123`.
- **Recomendación:** Enviar email de bienvenida con instrucciones para cambiar contraseña en primer login.

### 9.2 Logo Compartido
- El logo se guarda en cada local de la cadena (duplicado) o se puede optimizar para almacenar una sola vez en tabla `cadenas` (nueva tabla) y referenciar.
- **Opción 1 (simple):** Guardar logo en cada local.
- **Opción 2 (optimizada):** Crear tabla `cadenas` con campos `nombre`, `logo`, `propietarioId`.

### 9.3 Permisos de Admin
- Verificar que el admin propietario de la cadena pueda:
  - Crear locales en la cadena.
  - Ver reportes de todos los locales de su cadena.
  - Editar configuración de cada local.

### 9.4 Seguridad
- Validar que el `usuarioPropietarioId` sea el mismo para todos los locales de una cadena.
- Evitar que un admin ajeno pueda crear locales en una cadena que no le pertenece.

---

## 10. Ejemplo de Flujo Completo (Frontend → Backend)

### Paso 1: Admin selecciona "Crear cadena de locales"
- Frontend envía peticiones individuales para crear cada local:

```javascript
for (let i = 0; i < cantidadLocales; i++) {
  const payload = {
    nombre: `${cadenaNombre} - ${direccionesLocales[i].split(',')[0].trim()}`,
    direccion: direccionesLocales[i],
    telefono: localTelefono,
    logo: cadenaLogo,
    cadena: cadenaNombre
  };
  const nuevoLocal = await localService.crear(payload);
  localesCreados.push(nuevoLocal.id);
}
```

### Paso 2: Crear mesas en todos los locales
```javascript
for (const localId of localesCreados) {
  await onboardingService.completarMesas(cantidadMesas, localId, 'General', capacidadMesas);
}
```

### Paso 3: Crear proveedores en todos los locales
```javascript
for (const localId of localesCreados) {
  await proveedorService.crear({
    nombre: proveedorNombre,
    telefono: proveedorTelefono,
    email: proveedorEmail,
    localId: localId
  });
}
```

### Paso 4: Crear productos en todos los locales
```javascript
for (const localId of localesCreados) {
  const proveedoresLocal = await proveedorService.obtenerProveedores(localId);
  const proveedorLocal = proveedoresLocal.find(p => p.nombre === proveedorNombre);
  
  if (proveedorLocal) {
    await onboardingService.crearProductosBulk(productos, localId);
  }
}
```

### Paso 5: Backend crea usuarios por defecto (automático)
- Al crear cada local, el backend detecta el campo `cadena` y llama a `crearUsuariosPorDefecto(localId, direccion, cadena)`.
- Los usuarios se crean con emails diferenciados.

### Paso 6: Frontend muestra resumen
- Después de completar todos los pasos, el frontend muestra una vista de resumen (paso 5 del wizard) con:
  - Locales creados.
  - Usuarios generados por local.
  - Total de mesas y productos.

---

## 11. Implementación Actual: Generación de Usuarios con Dominio del Admin

### Cambio Realizado (v2.0)
Los usuarios por defecto (mesero, cocina, bar) ahora utilizan el dominio del email del admin que crea el local, en lugar del nombre del local.

**Backend:** 
- Función `extraerDominioEmail(email)` - extrae dominio del email del admin
- Función `generarEmailUnico(rol, dominio)` - genera emails únicos con manejo de duplicados
- Modificación en `crearLocal()` - usa dominio del admin para crear usuarios

**Frontend:**
- Captura usuarios generados desde la respuesta del backend
- Almacena en estado `usuariosGenerados`
- Muestra en Step 5 del wizard (resumen de cadena)

### Ejemplos
- Admin: `admin@pizzahut.com` 
  - Usuarios: `mesero@pizzahut.com`, `cocina@pizzahut.com`, `bar@pizzahut.com`

- Segundo local del mismo admin (duplicados):
  - Usuarios: `mesero1@pizzahut.com`, `cocina1@pizzahut.com`, `bar1@pizzahut.com`

---

## 12. Changelog

| Fecha       | Autor   | Cambio                                                |
|-------------|---------|------------------------------------------------------|
| 2025-12-15  | System  | Documento inicial: soporte para cadena de locales    |
| 2025-12-16  | System  | v2.0: Usuarios generados con dominio del admin      |

---

## 13. Contacto
Para consultas sobre implementación, contactar al equipo de desarrollo backend.
