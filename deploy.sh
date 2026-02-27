#!/bin/bash
set -euo pipefail
# --- CONFIGURACIÓN ---
USER_DOCKER="gonmore14"  # Cambia esto por tu usuario de Docker Hub
SERVER_USER="home"      # Usuario en el servidor
SERVER_IP="192.168.10.57"
SERVER_PATH="~/app-server/proyectos/malafama"  # Ajusta la ruta en el servidor
API_PROD="https://comandas.malafamacomedia.com"  # URL de la API en producción
VERSION=$(date +%Y%m%d%H%M)

echo "🏗️  1. Iniciando construcción de versión: $VERSION"

# Build & Push Backend
docker build --progress=plain -t $USER_DOCKER/backend-malafama:$VERSION -f ./backend/Dockerfile.prod ./backend
docker push $USER_DOCKER/backend-malafama:$VERSION

# Build & Push Frontend (Inyectando URL de producción)
docker build -t $USER_DOCKER/frontend-malafama:$VERSION \
  --progress=plain \
  --build-arg VITE_API_URL=$API_PROD/api/v1 \
  -f ./frontend/Dockerfile.prod ./frontend
docker push $USER_DOCKER/frontend-malafama:$VERSION

echo "🚀 2. Actualizando servidor remoto..."

echo "📄 2.1 Sincronizando docker-compose.prod.yml al servidor..."
scp ./docker-compose.prod.yml "$SERVER_USER@$SERVER_IP:$SERVER_PATH/docker-compose.prod.yml"

ssh "$SERVER_USER@$SERVER_IP" "SERVER_PATH=$SERVER_PATH VERSION=$VERSION DOCKER_USER=$USER_DOCKER bash -s" << 'EOF'
  set -e
  cd "$SERVER_PATH"

  # Ensure external network exists (docker-compose.prod.yml expects it)
  if ! docker network inspect red-interna >/dev/null 2>&1; then
    echo "🕸️  Creando red externa red-interna..."
    docker network create red-interna >/dev/null
  fi

  # Leer RUN_SEED_ON_DEPLOY si existe (adaptado del ejemplo)
  RUN_SEED_ON_DEPLOY=0
  if [ -f .env ]; then
    value=$(grep -E '^RUN_SEED_ON_DEPLOY=' .env | tail -n 1 | cut -d= -f2- | tr -d '\r')
    if [ -n "${value:-}" ]; then
      RUN_SEED_ON_DEPLOY="$value"
    fi
  fi

  # Crear archivo de versión
  {
    echo "APP_VERSION=$VERSION"
    echo "DOCKER_USER=$DOCKER_USER"
  } > .env.version

  echo "📥 Descargando nuevas imágenes ($VERSION)..."
  docker compose --env-file .env --env-file .env.version -f docker-compose.prod.yml pull

  echo "🔄 Reiniciando contenedores..."
  docker compose --env-file .env --env-file .env.version -f docker-compose.prod.yml up -d --remove-orphans

  echo "📋 Estado de servicios:"
  docker compose --env-file .env --env-file .env.version -f docker-compose.prod.yml ps

  backend_status=$(docker inspect -f '{{.State.Status}}' backend-malafama 2>/dev/null || echo missing)
  frontend_status=$(docker inspect -f '{{.State.Status}}' frontend-malafama 2>/dev/null || echo missing)

  if [ "$backend_status" != "running" ]; then
    echo "❌ backend-malafama no está running (status=$backend_status)"
    docker logs --tail 200 backend-malafama || true
    exit 1
  fi

  if [ "$frontend_status" != "running" ]; then
    echo "❌ frontend-malafama no está running (status=$frontend_status)"
    docker logs --tail 200 frontend-malafama || true
    exit 1
  fi

  echo "✅ Despliegue completado en $VERSION"
EOF

echo "✅ Despliegue completado exitosamente"