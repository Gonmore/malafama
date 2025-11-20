# 🛠️ Comandos Útiles - MalaFama

## 📦 Instalación Inicial

```bash
# Backend
cd backend
npm install

# Frontend
cd frontend
npm install

# Mobile
cd mobile
npm install
```

## 🚀 Desarrollo

### Iniciar servicios individualmente

```bash
# Backend (Terminal 1)
cd backend
npm run dev

# Frontend (Terminal 2)
cd frontend
npm run dev

# Mobile (Terminal 3)
cd mobile
npm start
```

### Con Docker

```bash
# Iniciar todo
docker-compose up

# Iniciar en background
docker-compose up -d

# Ver logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Detener todo
docker-compose down

# Reconstruir
docker-compose up --build
```

## 🗄️ Base de Datos

### PostgreSQL

```bash
# Conectar a la base de datos
psql -U postgres -d malafama

# Crear base de datos
createdb malafama

# Eliminar y recrear
dropdb malafama
createdb malafama

# Ejecutar scripts
psql -U postgres -d malafama -f database/schema.sql
psql -U postgres -d malafama -f database/views.sql

# Backup
pg_dump -U postgres malafama > backup.sql

# Restore
psql -U postgres -d malafama < backup.sql
```

### Queries útiles

```sql
-- Ver todas las tablas
\dt

-- Ver todas las vistas
\dv

-- Describir tabla
\d usuarios

-- Limpiar todo (¡CUIDADO!)
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

-- Ver usuarios
SELECT * FROM usuarios;

-- Ver comandas abiertas
SELECT * FROM v_estado_comandas;

-- Ventas del día
SELECT * FROM v_ventas_diarias WHERE fecha = CURRENT_DATE;
```

## 🔐 Autenticación

### Crear usuarios de prueba

```bash
# Admin
curl -X POST http://localhost:5000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Admin Principal",
    "email": "admin@malafama.com",
    "password": "admin123",
    "tipo": "admin"
  }'

# Atención
curl -X POST http://localhost:5000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Mesero Juan",
    "email": "mesero@malafama.com",
    "password": "mesero123",
    "tipo": "atencion"
  }'

# Cocina
curl -X POST http://localhost:5000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Chef María",
    "email": "cocina@malafama.com",
    "password": "cocina123",
    "tipo": "cocina"
  }'

# Proveedor
curl -X POST http://localhost:5000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Proveedor XYZ",
    "email": "proveedor@malafama.com",
    "password": "proveedor123",
    "tipo": "proveedor"
  }'
```

### PowerShell (Windows)

```powershell
# Admin
Invoke-RestMethod -Uri "http://localhost:5000/api/v1/auth/register" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"nombre":"Admin Principal","email":"admin@malafama.com","password":"admin123","tipo":"admin"}'

# Login
$response = Invoke-RestMethod -Uri "http://localhost:5000/api/v1/auth/login" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"email":"admin@malafama.com","password":"admin123"}'

$token = $response.data.token
Write-Host "Token: $token"
```

## 🧪 Testing

```bash
# Backend
cd backend
npm test
npm run test:watch

# Frontend
cd frontend
npm test

# Lint
cd backend
npm run lint

cd frontend
npm run lint
```

## 📊 Logs y Debug

```bash
# Ver logs del backend
cd backend
tail -f logs/app.log

# Ver logs de Docker
docker-compose logs -f

# Debug Node.js
cd backend
node --inspect src/index.js

# Debug Frontend
cd frontend
npm run dev -- --debug
```

## 🔍 Verificación de Servicios

```bash
# Health check backend
curl http://localhost:5000/health

# Test de conexión a DB
curl http://localhost:5000/api/v1/health/db

# Ver info del frontend
curl http://localhost:3000
```

## 📱 Mobile

```bash
cd mobile

# Iniciar
npm start

# Android
npm run android
# o
expo run:android

# iOS (solo macOS)
npm run ios
# o
expo run:ios

# Web
npm run web

# Limpiar caché
expo start -c

# Build
expo build:android
expo build:ios
```

## 🛠️ Utilidades

### Limpiar todo

```bash
# Node modules
rm -rf backend/node_modules frontend/node_modules mobile/node_modules

# Reinstalar todo
cd backend && npm install
cd ../frontend && npm install
cd ../mobile && npm install
```

### Actualizar dependencias

```bash
# Backend
cd backend
npm update
npm outdated

# Frontend
cd frontend
npm update
npm outdated
```

### Generar documentación

```bash
# Backend (si tienes JSDoc)
cd backend
npx jsdoc -c jsdoc.json

# Swagger/OpenAPI
# Visitar http://localhost:5000/api-docs (cuando se implemente)
```

## 🔧 Troubleshooting

### Puerto ocupado

```bash
# Windows
netstat -ano | findstr :5000
taskkill /PID [PID] /F

# Linux/Mac
lsof -ti:5000 | xargs kill -9
```

### Limpiar Docker

```bash
# Detener y eliminar contenedores
docker-compose down -v

# Eliminar imágenes
docker rmi malafama-backend malafama-frontend

# Limpiar todo Docker
docker system prune -a
```

### Reset completo de base de datos

```bash
# Opción 1: Con script SQL
psql -U postgres -d malafama -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
psql -U postgres -d malafama -f database/schema.sql
psql -U postgres -d malafama -f database/views.sql

# Opción 2: Recrear DB
dropdb malafama
createdb malafama
psql -U postgres -d malafama -f database/schema.sql
psql -U postgres -d malafama -f database/views.sql
```

## 📝 Git

```bash
# Estado
git status

# Agregar cambios
git add .

# Commit
git commit -m "feat: descripción del cambio"

# Push
git push origin main

# Pull
git pull origin main

# Nueva rama
git checkout -b feature/nueva-funcionalidad

# Ver ramas
git branch -a

# Merge
git checkout main
git merge feature/nueva-funcionalidad
```

## 🎯 Comandos de Desarrollo Rápido

```bash
# Iniciar desarrollo (backend + frontend)
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm run dev

# Con Docker (todo en uno)
docker-compose up

# Ver logs en tiempo real
docker-compose logs -f
```

---

💡 **Tip**: Guarda estos comandos en tus aliases de shell para acceso rápido.
