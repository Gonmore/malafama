# Script de inicialización rápida del sistema MalaFama (PowerShell)
# Crea usuarios, mesas y productos de prueba

Write-Host "🚀 Inicializando sistema MalaFama..." -ForegroundColor Cyan

$API_URL = "http://localhost:5000/api/v1"

# Función para hacer peticiones
function Make-Request {
    param(
        [string]$Method,
        [string]$Endpoint,
        [string]$Data,
        [string]$Token = ""
    )
    
    $headers = @{
        "Content-Type" = "application/json"
    }
    
    if ($Token) {
        $headers["Authorization"] = "Bearer $Token"
    }
    
    try {
        $response = Invoke-RestMethod -Uri "$API_URL$Endpoint" `
            -Method $Method `
            -Headers $headers `
            -Body $Data
        return $response
    } catch {
        return $null
    }
}

# 1. Crear admin
Write-Host "`n📝 Creando usuario admin..." -ForegroundColor Blue
$adminData = @{
    nombre = "Admin Principal"
    email = "admin@malafama.com"
    password = "admin123"
    tipo = "admin"
} | ConvertTo-Json

$adminResponse = Make-Request -Method POST -Endpoint "/auth/register" -Data $adminData

if ($adminResponse.success) {
    Write-Host "✅ Admin creado" -ForegroundColor Green
} else {
    Write-Host "❌ Error creando admin (puede que ya exista)" -ForegroundColor Red
}

# 2. Login para obtener token
Write-Host "`n🔑 Obteniendo token..." -ForegroundColor Blue
$loginData = @{
    email = "admin@malafama.com"
    password = "admin123"
} | ConvertTo-Json

$loginResponse = Make-Request -Method POST -Endpoint "/auth/login" -Data $loginData

if (-not $loginResponse -or -not $loginResponse.token) {
    Write-Host "❌ Error obteniendo token. Verifica que el backend esté corriendo." -ForegroundColor Red
    exit 1
}

$TOKEN = $loginResponse.token
Write-Host "✅ Token obtenido" -ForegroundColor Green

# 3. Crear mesas
Write-Host "`n🪑 Creando 20 mesas..." -ForegroundColor Blue
$mesasData = @{
    cantidad = 20
    ubicacion = "Salón Principal"
    capacidad = 4
} | ConvertTo-Json

$mesasResponse = Make-Request -Method POST -Endpoint "/mesas/bulk" -Data $mesasData -Token $TOKEN

if ($mesasResponse.success) {
    Write-Host "✅ 20 mesas creadas" -ForegroundColor Green
} else {
    Write-Host "❌ Error creando mesas" -ForegroundColor Red
}

# 4. Crear productos
Write-Host "`n🍕 Creando productos de prueba..." -ForegroundColor Blue

$productos = @(
    @{nombre="Pizza Margarita"; descripcion="Pizza con tomate y mozzarella"; precio=15.99; categoria="Pizzas"; disponible=$true},
    @{nombre="Pizza Pepperoni"; descripcion="Pizza con pepperoni"; precio=17.99; categoria="Pizzas"; disponible=$true},
    @{nombre="Hamburguesa Clásica"; descripcion="Hamburguesa con queso"; precio=12.50; categoria="Hamburguesas"; disponible=$true},
    @{nombre="Hamburguesa BBQ"; descripcion="Hamburguesa con salsa BBQ"; precio=13.50; categoria="Hamburguesas"; disponible=$true},
    @{nombre="Ensalada César"; descripcion="Lechuga, pollo, parmesano"; precio=9.99; categoria="Ensaladas"; disponible=$true},
    @{nombre="Ensalada Griega"; descripcion="Tomate, pepino, feta"; precio=8.99; categoria="Ensaladas"; disponible=$true},
    @{nombre="Pasta Alfredo"; descripcion="Pasta con salsa Alfredo"; precio=11.50; categoria="Pastas"; disponible=$true},
    @{nombre="Pasta Carbonara"; descripcion="Pasta con bacon y huevo"; precio=12.00; categoria="Pastas"; disponible=$true},
    @{nombre="Refresco"; descripcion="Coca Cola, Pepsi, Sprite"; precio=2.50; categoria="Bebidas"; disponible=$true},
    @{nombre="Agua Mineral"; descripcion="Agua sin gas"; precio=1.50; categoria="Bebidas"; disponible=$true},
    @{nombre="Cerveza"; descripcion="Cerveza nacional"; precio=3.50; categoria="Bebidas"; disponible=$true},
    @{nombre="Helado"; descripcion="Helado de vainilla o chocolate"; precio=5.00; categoria="Postres"; disponible=$true},
    @{nombre="Brownie"; descripcion="Brownie con helado"; precio=6.50; categoria="Postres"; disponible=$true}
)

foreach ($producto in $productos) {
    $productoJson = $producto | ConvertTo-Json
    $productoResponse = Make-Request -Method POST -Endpoint "/products" -Data $productoJson -Token $TOKEN
    
    if ($productoResponse.success) {
        Write-Host "  ✅ $($producto.nombre)" -ForegroundColor Green
    }
}

# 5. Crear usuarios de prueba
Write-Host "`n👥 Creando usuarios de prueba..." -ForegroundColor Blue

# Usuario de atención
$atencionData = @{
    nombre = "Mesero Juan"
    email = "juan@malafama.com"
    password = "juan123"
    tipo = "atencion"
} | ConvertTo-Json

$atencionResponse = Make-Request -Method POST -Endpoint "/users" -Data $atencionData -Token $TOKEN

if ($atencionResponse.success) {
    Write-Host "✅ Usuario de atención creado (juan@malafama.com / juan123)" -ForegroundColor Green
}

# Usuario de cocina
$cocinaData = @{
    nombre = "Chef María"
    email = "maria@malafama.com"
    password = "maria123"
    tipo = "cocina"
} | ConvertTo-Json

$cocinaResponse = Make-Request -Method POST -Endpoint "/users" -Data $cocinaData -Token $TOKEN

if ($cocinaResponse.success) {
    Write-Host "✅ Usuario de cocina creado (maria@malafama.com / maria123)" -ForegroundColor Green
}

# Resumen
Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host "✅ Sistema inicializado correctamente" -ForegroundColor Green
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host "`n📋 Usuarios creados:" -ForegroundColor Blue
Write-Host "  👨‍💼 Admin:    admin@malafama.com / admin123"
Write-Host "  👨‍🍳 Cocina:   maria@malafama.com / maria123"
Write-Host "  👨‍💼 Atención: juan@malafama.com  / juan123"
Write-Host "`n🪑 Mesas: 20 mesas creadas" -ForegroundColor Blue
Write-Host "🍕 Productos: 13 productos creados" -ForegroundColor Blue
Write-Host "`n🌐 Frontend: http://localhost:5173" -ForegroundColor Blue
Write-Host "🔌 Backend:  http://localhost:5000" -ForegroundColor Blue
Write-Host "`n¡Listo para usar!`n" -ForegroundColor Green
