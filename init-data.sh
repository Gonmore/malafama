#!/bin/bash

# Script de inicialización rápida del sistema MalaFama
# Crea usuarios, mesas y productos de prueba

echo "🚀 Inicializando sistema MalaFama..."

# Colores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

API_URL="http://localhost:5000/api/v1"

# Función para hacer peticiones
make_request() {
    local method=$1
    local endpoint=$2
    local data=$3
    local token=$4
    
    if [ -z "$token" ]; then
        curl -s -X $method "${API_URL}${endpoint}" \
            -H "Content-Type: application/json" \
            -d "$data"
    else
        curl -s -X $method "${API_URL}${endpoint}" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer $token" \
            -d "$data"
    fi
}

# 1. Crear admin
echo -e "\n${BLUE}📝 Creando usuario admin...${NC}"
ADMIN_RESPONSE=$(make_request POST "/auth/register" '{
  "nombre": "Admin Principal",
  "email": "admin@malafama.com",
  "password": "admin123",
  "tipo": "admin"
}')

if echo "$ADMIN_RESPONSE" | grep -q "success"; then
    echo -e "${GREEN}✅ Admin creado${NC}"
else
    echo -e "${RED}❌ Error creando admin (puede que ya exista)${NC}"
fi

# 2. Login para obtener token
echo -e "\n${BLUE}🔑 Obteniendo token...${NC}"
LOGIN_RESPONSE=$(make_request POST "/auth/login" '{
  "email": "admin@malafama.com",
  "password": "admin123"
}')

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    echo -e "${RED}❌ Error obteniendo token. Verifica que el backend esté corriendo.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Token obtenido${NC}"

# 3. Crear mesas
echo -e "\n${BLUE}🪑 Creando 20 mesas...${NC}"
MESAS_RESPONSE=$(make_request POST "/mesas/bulk" '{
  "cantidad": 20,
  "ubicacion": "Salón Principal",
  "capacidad": 4
}' "$TOKEN")

if echo "$MESAS_RESPONSE" | grep -q "success"; then
    echo -e "${GREEN}✅ 20 mesas creadas${NC}"
else
    echo -e "${RED}❌ Error creando mesas${NC}"
fi

# 4. Crear productos
echo -e "\n${BLUE}🍕 Creando productos de prueba...${NC}"

PRODUCTOS=(
    '{"nombre":"Pizza Margarita","descripcion":"Pizza con tomate y mozzarella","precio":15.99,"categoria":"Pizzas","disponible":true}'
    '{"nombre":"Pizza Pepperoni","descripcion":"Pizza con pepperoni","precio":17.99,"categoria":"Pizzas","disponible":true}'
    '{"nombre":"Hamburguesa Clásica","descripcion":"Hamburguesa con queso","precio":12.50,"categoria":"Hamburguesas","disponible":true}'
    '{"nombre":"Hamburguesa BBQ","descripcion":"Hamburguesa con salsa BBQ","precio":13.50,"categoria":"Hamburguesas","disponible":true}'
    '{"nombre":"Ensalada César","descripcion":"Lechuga, pollo, parmesano","precio":9.99,"categoria":"Ensaladas","disponible":true}'
    '{"nombre":"Ensalada Griega","descripcion":"Tomate, pepino, feta","precio":8.99,"categoria":"Ensaladas","disponible":true}'
    '{"nombre":"Pasta Alfredo","descripcion":"Pasta con salsa Alfredo","precio":11.50,"categoria":"Pastas","disponible":true}'
    '{"nombre":"Pasta Carbonara","descripcion":"Pasta con bacon y huevo","precio":12.00,"categoria":"Pastas","disponible":true}'
    '{"nombre":"Refresco","descripcion":"Coca Cola, Pepsi, Sprite","precio":2.50,"categoria":"Bebidas","disponible":true}'
    '{"nombre":"Agua Mineral","descripcion":"Agua sin gas","precio":1.50,"categoria":"Bebidas","disponible":true}'
    '{"nombre":"Cerveza","descripcion":"Cerveza nacional","precio":3.50,"categoria":"Bebidas","disponible":true}'
    '{"nombre":"Helado","descripcion":"Helado de vainilla o chocolate","precio":5.00,"categoria":"Postres","disponible":true}'
    '{"nombre":"Brownie","descripcion":"Brownie con helado","precio":6.50,"categoria":"Postres","disponible":true}'
)

for producto in "${PRODUCTOS[@]}"; do
    PRODUCTO_RESPONSE=$(make_request POST "/products" "$producto" "$TOKEN")
    
    if echo "$PRODUCTO_RESPONSE" | grep -q "success"; then
        NOMBRE=$(echo $producto | grep -o '"nombre":"[^"]*' | cut -d'"' -f4)
        echo -e "${GREEN}  ✅ $NOMBRE${NC}"
    fi
done

# 5. Crear usuarios de prueba
echo -e "\n${BLUE}👥 Creando usuarios de prueba...${NC}"

# Usuario de atención
ATENCION_RESPONSE=$(make_request POST "/users" '{
  "nombre": "Mesero Juan",
  "email": "juan@malafama.com",
  "password": "juan123",
  "tipo": "atencion"
}' "$TOKEN")

if echo "$ATENCION_RESPONSE" | grep -q "success"; then
    echo -e "${GREEN}✅ Usuario de atención creado (juan@malafama.com / juan123)${NC}"
fi

# Usuario de cocina
COCINA_RESPONSE=$(make_request POST "/users" '{
  "nombre": "Chef María",
  "email": "maria@malafama.com",
  "password": "maria123",
  "tipo": "cocina"
}' "$TOKEN")

if echo "$COCINA_RESPONSE" | grep -q "success"; then
    echo -e "${GREEN}✅ Usuario de cocina creado (maria@malafama.com / maria123)${NC}"
fi

# Resumen
echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Sistema inicializado correctamente${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "\n${BLUE}📋 Usuarios creados:${NC}"
echo -e "  👨‍💼 Admin:    admin@malafama.com / admin123"
echo -e "  👨‍🍳 Cocina:   maria@malafama.com / maria123"
echo -e "  👨‍💼 Atención: juan@malafama.com  / juan123"
echo -e "\n${BLUE}🪑 Mesas:${NC} 20 mesas creadas"
echo -e "${BLUE}🍕 Productos:${NC} 13 productos creados"
echo -e "\n${BLUE}🌐 Frontend:${NC} http://localhost:5173"
echo -e "${BLUE}🔌 Backend:${NC}  http://localhost:5000"
echo -e "\n${GREEN}¡Listo para usar!${NC}\n"
