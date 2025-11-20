# Script de prueba del sistema de onboarding (PowerShell)
# Ejecutar después de iniciar backend y frontend

$API_URL = "http://localhost:5000/api/v1"
$TOKEN = ""

Write-Host "🧪 Testing del Sistema de Onboarding" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# 1. Registro de admin
Write-Host "1️⃣ Registrando nuevo admin..." -ForegroundColor Yellow
$registerBody = @{
    nombre = "Admin Test"
    email = "admin-test@malafama.com"
    password = "test123"
    tipo = "admin"
} | ConvertTo-Json

$registerResponse = Invoke-RestMethod -Uri "$API_URL/auth/register" `
    -Method Post `
    -ContentType "application/json" `
    -Body $registerBody

Write-Host ($registerResponse | ConvertTo-Json -Depth 5)
$TOKEN = $registerResponse.data.token

if ([string]::IsNullOrEmpty($TOKEN)) {
    Write-Host "❌ Error: No se pudo obtener token" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Admin registrado. Token: $($TOKEN.Substring(0,20))..." -ForegroundColor Green
Write-Host ""

# 2. Estado del onboarding
Write-Host "2️⃣ Verificando estado del onboarding..." -ForegroundColor Yellow
$headers = @{ Authorization = "Bearer $TOKEN" }
$estadoResponse = Invoke-RestMethod -Uri "$API_URL/onboarding/estado" `
    -Method Get `
    -Headers $headers

Write-Host ($estadoResponse | ConvertTo-Json -Depth 5)
Write-Host ""

# 3. Paso 1: Crear mesas
Write-Host "3️⃣ Paso 1: Creando 10 mesas..." -ForegroundColor Yellow
$mesasBody = @{
    cantidad = 10
    ubicacion = "General"
    capacidad = 4
} | ConvertTo-Json

$mesasResponse = Invoke-RestMethod -Uri "$API_URL/onboarding/paso1/mesas" `
    -Method Post `
    -Headers $headers `
    -ContentType "application/json" `
    -Body $mesasBody

Write-Host ($mesasResponse | ConvertTo-Json -Depth 5)
Write-Host ""

# 4. Crear un proveedor primero
Write-Host "4️⃣ Creando proveedor de prueba..." -ForegroundColor Yellow
$proveedorBody = @{
    nombre = "Distribuidora Test"
    contacto = "Juan Pérez"
    email = "contacto@distributest.com"
    telefono = "+1234567890"
} | ConvertTo-Json

$proveedorResponse = Invoke-RestMethod -Uri "$API_URL/proveedores" `
    -Method Post `
    -Headers $headers `
    -ContentType "application/json" `
    -Body $proveedorBody

Write-Host ($proveedorResponse | ConvertTo-Json -Depth 5)
$PROVEEDOR_ID = $proveedorResponse.data.proveedor.id
Write-Host "✅ Proveedor creado: $PROVEEDOR_ID" -ForegroundColor Green
Write-Host ""

# 5. Paso 2 y 3: Crear productos
Write-Host "5️⃣ Paso 2 & 3: Creando productos con costos..." -ForegroundColor Yellow
$productosBody = @{
    productos = @(
        @{
            nombre = "Pizza Margarita Test"
            descripcion = "Tomate, mozzarella, albahaca"
            categoria = "Pizzas"
            precio = 15.99
            costo = 7.50
            proveedor_id = $PROVEEDOR_ID
        },
        @{
            nombre = "Hamburguesa Clásica Test"
            descripcion = "Carne, lechuga, tomate, queso"
            categoria = "Hamburguesas"
            precio = 12.50
            costo = 5.80
            proveedor_id = $PROVEEDOR_ID
        },
        @{
            nombre = "Ensalada César Test"
            descripcion = "Lechuga, pollo, queso parmesano"
            categoria = "Ensaladas"
            precio = 9.99
            costo = 4.20
            proveedor_id = $PROVEEDOR_ID
        }
    )
} | ConvertTo-Json -Depth 5

$productosResponse = Invoke-RestMethod -Uri "$API_URL/onboarding/productos/bulk" `
    -Method Post `
    -Headers $headers `
    -ContentType "application/json" `
    -Body $productosBody

Write-Host ($productosResponse | ConvertTo-Json -Depth 5)
Write-Host ""

# 6. Completar onboarding
Write-Host "6️⃣ Completando onboarding..." -ForegroundColor Yellow
$completarResponse = Invoke-RestMethod -Uri "$API_URL/onboarding/completar" `
    -Method Post `
    -Headers $headers

Write-Host ($completarResponse | ConvertTo-Json -Depth 5)
Write-Host ""

# 7. Verificar estado final
Write-Host "7️⃣ Verificando estado final..." -ForegroundColor Yellow
$estadoFinal = Invoke-RestMethod -Uri "$API_URL/onboarding/estado" `
    -Method Get `
    -Headers $headers

Write-Host ($estadoFinal | ConvertTo-Json -Depth 5)
Write-Host ""

# Resumen
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "✅ Test completado!" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Resumen:" -ForegroundColor Cyan
Write-Host "  • Mesas creadas: 10"
Write-Host "  • Productos creados: 3"
Write-Host "  • Proveedor: Distribuidora Test"
Write-Host "  • Onboarding completado: ✅"
Write-Host ""
Write-Host "🌐 Credenciales de prueba:" -ForegroundColor Yellow
Write-Host "  Email: admin-test@malafama.com"
Write-Host "  Password: test123"
Write-Host ""
Write-Host "👉 Ahora puedes hacer login en http://localhost:3000" -ForegroundColor Green
