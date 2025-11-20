# 🚀 Guía de Inicio Rápido - MalaFama

## Opción 1: Con Docker (Recomendado)

### Requisitos
- Docker Desktop instalado
- Docker Compose

### Pasos

1. **Clonar/Navegar al proyecto**
```bash
cd c:\Users\arman\Gon_local\Desarrollos\MalaFama
```

2. **Iniciar todos los servicios**
```bash
docker-compose up -d
```

Esto iniciará:
- PostgreSQL en puerto 5432
- Backend en puerto 5000
- Frontend en puerto 3000

3. **Ver logs**
```bash
docker-compose logs -f
```

4. **Detener servicios**
```bash
docker-compose down
```

---

## Opción 2: Manual (Sin Docker)

### 1. Base de Datos

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

### 2. Backend

```bash
cd backend

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env

# Editar .env con tus datos:
# - DB_PASSWORD=tu_password
# - JWT_SECRET=una_clave_secreta_segura

# Iniciar en desarrollo
npm run dev
```

Backend corriendo en: http://localhost:5000

### 3. Frontend

```bash
cd frontend

# Instalar dependencias
npm install

# Iniciar en desarrollo
npm run dev
```

Frontend corriendo en: http://localhost:3000

### 4. Mobile (Opcional)

```bash
cd mobile

# Instalar dependencias
npm install

# Iniciar Expo
npm start

# Escanear QR con Expo Go app
```

---

## 🧪 Verificar que todo funciona

### Backend
```bash
# Health check
curl http://localhost:5000/health

# Debería responder:
# {"status":"OK","timestamp":"...","service":"MalaFama API"}
```

### Frontend
Abrir navegador en: http://localhost:3000

Deberías ver la página de login.

---

## 👤 Usuario de Prueba

Para crear el primer usuario admin:

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

# O con PowerShell
Invoke-RestMethod -Uri "http://localhost:5000/api/v1/auth/register" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"nombre":"Admin Principal","email":"admin@malafama.com","password":"password123","tipo":"admin"}'
```

Luego puedes hacer login con:
- Email: `admin@malafama.com`
- Password: `password123`

---

## 🔍 Troubleshooting

### Backend no inicia
- ✅ Verifica que PostgreSQL esté corriendo
- ✅ Verifica las credenciales en `.env`
- ✅ Verifica que el puerto 5000 esté libre

### Frontend no conecta con backend
- ✅ Verifica que el backend esté corriendo
- ✅ Verifica la URL en `frontend/.env` o usa el proxy de Vite

### Error de base de datos
```bash
# Recrear base de datos
dropdb malafama
createdb malafama
psql -U postgres -d malafama -f database/schema.sql
psql -U postgres -d malafama -f database/views.sql
```

### Puerto ocupado
```bash
# Windows - Liberar puerto 5000
netstat -ano | findstr :5000
taskkill /PID [PID] /F

# Linux/Mac
lsof -ti:5000 | xargs kill -9
```

---

## 📚 Próximos Pasos

1. Crear usuario admin (ver arriba)
2. Hacer login en http://localhost:3000
3. Configurar restaurante (mesas, productos)
4. Crear usuarios de atención y cocina
5. ¡Empezar a usar el sistema!

---

## 🆘 Ayuda

- Ver README principal: `README.md`
- Ver bitácora del proyecto: `BITACORA.md`
- Documentación backend: `backend/README.md`
- Documentación frontend: `frontend/README.md`
- Documentación database: `database/README.md`
