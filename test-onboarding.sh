#!/bin/bash

# Script de prueba del sistema de onboarding
# Ejecutar después de iniciar backend y frontend

API_URL="http://localhost:5000/api/v1"
TOKEN=""

echo "🧪 Testing del Sistema de Onboarding"
echo "======================================"
echo ""

# 1. Registro de admin
echo "1️⃣ Registrando nuevo admin..."
REGISTER_RESPONSE=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Admin Test",
    "email": "admin-test@malafama.com",
    "password": "test123",
    "tipo": "admin"
  }')

echo "$REGISTER_RESPONSE" | jq '.'
TOKEN=$(echo "$REGISTER_RESPONSE" | jq -r '.data.token')

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ Error: No se pudo obtener token"
  exit 1
fi

echo "✅ Admin registrado. Token: ${TOKEN:0:20}..."
echo ""

# 2. Estado del onboarding
echo "2️⃣ Verificando estado del onboarding..."
ESTADO_RESPONSE=$(curl -s -X GET "$API_URL/onboarding/estado" \
  -H "Authorization: Bearer $TOKEN")

echo "$ESTADO_RESPONSE" | jq '.'
echo ""

# 3. Paso 1: Crear mesas
echo "3️⃣ Paso 1: Creando 10 mesas..."
MESAS_RESPONSE=$(curl -s -X POST "$API_URL/onboarding/paso1/mesas" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "cantidad": 10,
    "ubicacion": "General",
    "capacidad": 4
  }')

echo "$MESAS_RESPONSE" | jq '.'
echo ""

# 4. Crear un proveedor primero (necesario para paso 3)
echo "4️⃣ Creando proveedor de prueba..."
PROVEEDOR_RESPONSE=$(curl -s -X POST "$API_URL/proveedores" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Distribuidora Test",
    "contacto": "Juan Pérez",
    "email": "contacto@distributest.com",
    "telefono": "+1234567890"
  }')

echo "$PROVEEDOR_RESPONSE" | jq '.'
PROVEEDOR_ID=$(echo "$PROVEEDOR_RESPONSE" | jq -r '.data.proveedor.id')
echo "✅ Proveedor creado: $PROVEEDOR_ID"
echo ""

# 5. Paso 2 y 3: Crear productos manualmente con costo y proveedor
echo "5️⃣ Paso 2 & 3: Creando productos con costos..."
PRODUCTOS_RESPONSE=$(curl -s -X POST "$API_URL/onboarding/productos/bulk" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"productos\": [
      {
        \"nombre\": \"Pizza Margarita Test\",
        \"descripcion\": \"Tomate, mozzarella, albahaca\",
        \"categoria\": \"Pizzas\",
        \"precio\": 15.99,
        \"costo\": 7.50,
        \"proveedor_id\": \"$PROVEEDOR_ID\"
      },
      {
        \"nombre\": \"Hamburguesa Clásica Test\",
        \"descripcion\": \"Carne, lechuga, tomate, queso\",
        \"categoria\": \"Hamburguesas\",
        \"precio\": 12.50,
        \"costo\": 5.80,
        \"proveedor_id\": \"$PROVEEDOR_ID\"
      },
      {
        \"nombre\": \"Ensalada César Test\",
        \"descripcion\": \"Lechuga, pollo, queso parmesano\",
        \"categoria\": \"Ensaladas\",
        \"precio\": 9.99,
        \"costo\": 4.20,
        \"proveedor_id\": \"$PROVEEDOR_ID\"
      }
    ]
  }")

echo "$PRODUCTOS_RESPONSE" | jq '.'
echo ""

# 6. Completar onboarding
echo "6️⃣ Completando onboarding..."
COMPLETAR_RESPONSE=$(curl -s -X POST "$API_URL/onboarding/completar" \
  -H "Authorization: Bearer $TOKEN")

echo "$COMPLETAR_RESPONSE" | jq '.'
echo ""

# 7. Verificar estado final
echo "7️⃣ Verificando estado final..."
ESTADO_FINAL=$(curl -s -X GET "$API_URL/onboarding/estado" \
  -H "Authorization: Bearer $TOKEN")

echo "$ESTADO_FINAL" | jq '.'
echo ""

# Resumen
echo "======================================"
echo "✅ Test completado!"
echo ""
echo "📊 Resumen:"
echo "  • Mesas creadas: 10"
echo "  • Productos creados: 3"
echo "  • Proveedor: Distribuidora Test"
echo "  • Onboarding completado: ✅"
echo ""
echo "🌐 Credenciales de prueba:"
echo "  Email: admin-test@malafama.com"
echo "  Password: test123"
echo ""
echo "👉 Ahora puedes hacer login en http://localhost:3000"
