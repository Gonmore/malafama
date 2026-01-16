# Test: Generación de Usuarios con Dominio del Admin

## Resumen del Cambio
Los usuarios (mesero, cocina, bar) creados automáticamente al crear un local ahora usan el dominio del email del admin que crea el local.

### Antes:
- Admin con email: `admin@malafama.com` 
- Usuarios generados:
  - `mesero@pizzahut.local`
  - `cocina@pizzahut.local`
  - `bar@pizzahut.local`

### Ahora:
- Admin con email: `admin@malafama.com`
- Usuarios generados:
  - `mesero@malafama.com`
  - `cocina@malafama.com`
  - `bar@malafama.com`

## Cambios Implementados

### Backend (`backend/src/controllers/local.controller.js`)
1. **Nueva función `extraerDominioEmail(email)`**
   - Extrae el dominio de un email (ej: "malafama.com" de "admin@malafama.com")
   - Fallback a "local.com" si el formato es inválido

2. **Nueva función `generarEmailUnico(rol, dominio)`**
   - Genera emails únicos para cada rol (mesero, cocina, bar)
   - Verifica si el email ya existe en la BD
   - Si existe, agrega un contador: `mesero1@malafama.com`, `mesero2@malafama.com`, etc.

3. **Modificación en `crearLocal()`**
   - Obtiene el dominio del admin: `const adminEmail = req.user.email;`
   - Extrae dominio: `const dominio = extraerDominioEmail(adminEmail);`
   - Genera emails únicos para cada usuario usando el dominio del admin
   - Retorna los usuarios generados en la respuesta

### Frontend (`mobile/app/admin/select-local.tsx`)
1. **Importación de API directa**
   - `import api from '../../src/services/api';`

2. **Nuevo estado para usuarios generados**
   - `const [usuariosGenerados, setUsuariosGenerados] = useState<Array<{localId: string, usuarios: any[], localNombre: string}>>([]);`

3. **Modificación en `handleCrearLocal()`**
   - Llama a `api.post('/locales', payload)` en lugar de `localService.crear()`
   - Captura la respuesta completa incluyendo usuarios generados
   - Almacena los usuarios en el estado para mostrar en resumen

4. **Modificación en `handleCrearCadena()`**
   - Para cada local creado, captura los usuarios generados
   - Almacena todos los usuarios en `usuariosGenerados`

5. **Actualización del Step 5 (Resumen de Cadena)**
   - Muestra los usuarios generados desde el backend
   - Formato: `{rol}@{dominio}` o `{rol}{numero}@{dominio}` si hay duplicados
   - Ejemplo: `mesero@malafama.com`, `mesero1@malafama.com`, etc.

6. **Nueva función `resetearOnboarding()`**
   - Limpia todos los estados cuando se completa el onboarding
   - Asegura que el siguiente onboarding comience limpio

## Casos de Uso

### Caso 1: Admin Crea Un Local
1. Admin con email `admin@pizzahut.com` crea un local "Pizza Hut La Paz"
2. Backend genera automáticamente:
   - `mesero@pizzahut.com`
   - `cocina@pizzahut.com`
   - `bar@pizzahut.com`
3. Frontend muestra estos emails en el resumen

### Caso 2: Admin Crea Segundo Local (Cadena)
1. Admin con email `admin@pizzahut.com` crea segundo local "Pizza Hut Santa Cruz"
2. Backend intenta generar:
   - `mesero@pizzahut.com` → Ya existe, genera `mesero1@pizzahut.com`
   - `cocina@pizzahut.com` → Ya existe, genera `cocina1@pizzahut.com`
   - `bar@pizzahut.com` → Ya existe, genera `bar1@pizzahut.com`
3. Frontend muestra todos los usuarios generados en resumen de cadena

### Caso 3: Admin Crea Cadena de Múltiples Locales
1. Admin llena:
   - Nombre cadena: "Pizza Hut"
   - Cantidad locales: 3
   - Direcciones: 3 locales diferentes
2. Sistema crea los 3 locales y genera usuarios con numeración:
   - Local 1: mesero@pizzahut.com, cocina@pizzahut.com, bar@pizzahut.com
   - Local 2: mesero1@pizzahut.com, cocina1@pizzahut.com, bar1@pizzahut.com
   - Local 3: mesero2@pizzahut.com, cocina2@pizzahut.com, bar2@pizzahut.com
3. Frontend muestra resumen con todos los usuarios

## Testing Manual

### Pre-requisitos:
1. Backend corriendo en `http://localhost:3000` (o configurado)
2. Admin autenticado con email: `admin@dominiodeltest.com`
3. Base de datos limpia o sin usuarios mesero/cocina/bar existentes

### Pasos:
1. Abrir app móvil
2. Ir a admin > Crear Local
3. Ingresar datos del local
4. Completar onboarding (mesas, proveedor, productos)
5. **Verificar:** En resumen, se muestran emails con dominio `@dominiodeltest.com`
6. Crear segundo local con mismos datos
7. **Verificar:** Segundo local muestra emails numerados (mesero1@, cocina1@, bar1@)

## Validación de Cambios
- ✅ Backend genera emails con dominio del admin
- ✅ Frontend captura y muestra emails generados
- ✅ Duplicados se manejan con sufijos numéricos
- ✅ Resumen de cadena muestra todos los usuarios correctos
- ✅ Estados se limpian después de completar onboarding
