# TEST DE FLUJO COMPLETO - Sistema de Pedidos MalaFama
# Crea datos, ejecuta flujo completo y LIMPIA todo al final

$ErrorActionPreference = "Continue" # No detener en errores para cleanup
$API_BASE = "http://localhost:5000"
$API_VERSION = "v1"

Write-Host "`n=================================" -ForegroundColor Cyan
Write-Host "TEST DE FLUJO COMPLETO - MalaFama" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
Write-Host "API Base: $API_BASE" -ForegroundColor Gray
Write-Host "Version: $API_VERSION`n" -ForegroundColor Gray

# Variables para cleanup
$adminToken = ""
$meseroToken = ""
$localId = ""
$meseroId = ""
$cocinaId = ""
$barId = ""
$adminId = ""
$mesaIds = @()
$productoIds = @()
$proveedorId = ""
$comanda1Id = ""
$pedidoBebidaId = ""
$pedidoComidaId = ""

$testExitoso = $false

# Helper function para peticiones HTTP
function Invoke-API {
    param($Method, $Endpoint, $Body, $Token, [switch]$IgnoreError)
    
    $headers = @{"Content-Type" = "application/json"}
    if ($Token) { $headers["Authorization"] = "Bearer $Token" }
    
    $params = @{
        Method = $Method
        Uri = "$API_BASE/api/$API_VERSION$Endpoint"
        Headers = $headers
        TimeoutSec = 30
    }
    
    if ($Body) { 
        $params.Body = ($Body | ConvertTo-Json -Depth 10 -Compress)
    }
    
    try {
        $response = Invoke-RestMethod @params -ErrorAction Stop
        return $response
    } catch {
        if (-not $IgnoreError) {
            $errorDetails = $_.Exception.Message
            if ($_.ErrorDetails.Message) {
                Write-Host "  Error Response: $($_.ErrorDetails.Message)" -ForegroundColor Red
            }
            throw "API Error: $errorDetails"
        }
        return $null
    }
}

try {
    # ========================
    # FASE 0: VERIFICAR BACKEND
    # ========================
    Write-Host "[0/12] Verificando backend..." -ForegroundColor Yellow
    
    try {
        $health = Invoke-RestMethod -Uri "$API_BASE/health" -Method GET -TimeoutSec 5
        Write-Host "  [OK] Backend corriendo - $($health.service)" -ForegroundColor Green
    } catch {
        Write-Host "  [ERROR] Backend no esta corriendo en $API_BASE" -ForegroundColor Red
        Write-Host "  Inicia el backend: cd backend; npm run dev" -ForegroundColor Yellow
        exit 1
    }

    # ========================
    # FASE 1: CREAR ADMIN
    # ========================
    Write-Host "`n[1/12] Creando usuario Admin..." -ForegroundColor Yellow
    
    $timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
    $adminEmail = "admin.test.$timestamp@test.com"
    
    $adminData = @{
        nombre = "Admin Test $timestamp"
        email = $adminEmail
        password = "admin123"
        tipo = "admin"
    }
    $adminRegister = Invoke-API -Method POST -Endpoint "/auth/register" -Body $adminData
    $adminToken = $adminRegister.data.token
    $adminId = $adminRegister.data.usuario.id
    Write-Host "  [OK] Admin creado - ID: $adminId" -ForegroundColor Green
    Write-Host "  [OK] Email: $adminEmail" -ForegroundColor Gray

    # ========================
    # FASE 2: CREAR LOCAL
    # ========================
    Write-Host "`n[2/12] Creando local..." -ForegroundColor Yellow
    
    $localData = @{
        nombre = "Test$timestamp"
        descripcion = "Local de prueba"
        direccion = "Calle Test 123"
        telefono = "12345678"
        email = "test@restaurante.com"
    }
    $localResponse = Invoke-API -Method POST -Endpoint "/locales" -Body $localData -Token $adminToken
    $localId = $localResponse.data.local.id
    
    # Extraer usuarios creados
    $meseroUser = $localResponse.data.usuarios | Where-Object { $_.tipo -eq "atencion" } | Select-Object -First 1
    $cocinaUser = $localResponse.data.usuarios | Where-Object { $_.tipo -eq "cocina" } | Select-Object -First 1
    $barUser = $localResponse.data.usuarios | Where-Object { $_.tipo -eq "bar" } | Select-Object -First 1
    
    $meseroId = $meseroUser.id
    $cocinaId = $cocinaUser.id
    $barId = $barUser.id
    $meseroEmail = $meseroUser.email
    $passwordDefault = "password123"
    
    Write-Host "  [OK] Local creado - ID: $localId" -ForegroundColor Green
    Write-Host "  [OK] Mesero: $meseroEmail (ID: $meseroId)" -ForegroundColor Gray
    Write-Host "  [OK] Cocina: $($cocinaUser.email) (ID: $cocinaId)" -ForegroundColor Gray
    Write-Host "  [OK] Bar: $($barUser.email) (ID: $barId)" -ForegroundColor Gray

    # ========================
    # FASE 3: LOGIN MESERO
    # ========================
    Write-Host "`n[3/12] Login de Mesero..." -ForegroundColor Yellow
    
    $loginData = @{
        email = $meseroEmail
        password = $passwordDefault
    }
    $loginResponse = Invoke-API -Method POST -Endpoint "/auth/login" -Body $loginData
    $meseroToken = $loginResponse.data.token
    Write-Host "  [OK] Mesero autenticado" -ForegroundColor Green

    # ========================
    # FASE 4: CREAR MESAS
    # ========================
    Write-Host "`n[4/12] Creando mesas..." -ForegroundColor Yellow
    
    $mesasData = @{
        cantidad = 3
        ubicacion = "Salon Principal"
        capacidad = 4
        localId = $localId
    }
    $mesasResponse = Invoke-API -Method POST -Endpoint "/mesas/bulk" -Body $mesasData -Token $adminToken
    
    if ($mesasResponse.data) {
        $mesasArray = @($mesasResponse.data)
        $mesaIds = @()
        foreach ($mesa in $mesasArray) {
            $mesaIds += $mesa.id
        }
        $mesaId = $mesaIds[0]
        Write-Host "  [OK] $($mesaIds.Count) mesas creadas - Primera: $mesaId" -ForegroundColor Green
    } else {
        throw "ERROR: No se pudieron crear las mesas"
    }

    # ========================
    # FASE 5: CREAR PROVEEDOR Y PRODUCTOS
    # ========================
    Write-Host "`n[5/12] Creando proveedor y productos..." -ForegroundColor Yellow
    
    # Crear proveedor
    $proveedorData = @{
        nombre = "Proveedor Test $timestamp"
        email = "proveedor.$timestamp@test.com"
        password = "proveedor123"
        telefono = "12345678"
        direccion = "Calle Proveedor 123"
        ruc = "123456789"
    }
    $proveedorResponse = Invoke-API -Method POST -Endpoint "/proveedores" -Body $proveedorData -Token $adminToken
    $proveedorId = $proveedorResponse.data.proveedor.id
    Write-Host "  [OK] Proveedor creado - ID: $proveedorId" -ForegroundColor Green

    # Producto 1: Bebida
    $prod1Data = @{
        nombre = "Coca Cola Test"
        descripcion = "Bebida gaseosa 500ml"
        precio = 15.00
        costo = 8.00
        categoria = "Bebidas"
        tipo = "bebida"
        disponible = $true
        activo = $true
        proveedorId = $proveedorId
        localId = $localId
    }
    $prod1Response = Invoke-API -Method POST -Endpoint "/products" -Body $prod1Data -Token $adminToken
    $producto1Id = $prod1Response.data.id
    if (-not $producto1Id) { throw "ERROR: No se obtuvo ID de producto bebida" }
    $productoIds += $producto1Id
    Write-Host "  [OK] Bebida creada - ID: $producto1Id" -ForegroundColor Green

    # Producto 2: Comida
    $prod2Data = @{
        nombre = "Hamburguesa Test"
        descripcion = "Hamburguesa con papas"
        precio = 45.00
        costo = 25.00
        categoria = "Platos Principales"
        tipo = "comida"
        disponible = $true
        activo = $true
        proveedorId = $proveedorId
        localId = $localId
    }
    $prod2Response = Invoke-API -Method POST -Endpoint "/products" -Body $prod2Data -Token $adminToken
    $producto2Id = $prod2Response.data.id
    if (-not $producto2Id) { throw "ERROR: No se obtuvo ID de producto comida" }
    $productoIds += $producto2Id
    Write-Host "  [OK] Comida creada - ID: $producto2Id" -ForegroundColor Green

    # ========================
    # FASE 6: ASIGNAR MESA
    # ========================
    Write-Host "`n[6/12] Asignando mesa al mesero..." -ForegroundColor Yellow
    
    if (-not $mesaId) { throw "ERROR: No hay mesa_id para asignar" }
    
    $asignarData = @{
        mesaIds = @($mesaId)
    }
    Invoke-API -Method POST -Endpoint "/mesas/asignar" -Body $asignarData -Token $meseroToken | Out-Null
    Write-Host "  [OK] Mesa $mesaId asignada" -ForegroundColor Green

    # ========================
    # FASE 7: CREAR COMANDA
    # ========================
    Write-Host "`n[7/12] Creando comanda con pedidos..." -ForegroundColor Yellow
    
    $comandaData = @{
        mesaId = $mesaId
        observaciones = "Cliente prefiere bebidas frias"
        pedidos = @(
            @{ 
                productoId = $producto1Id
                cantidad = 2
                notas = "Sin hielo"
            },
            @{ 
                productoId = $producto2Id
                cantidad = 1
                notas = "Termino medio"
            }
        )
    }
    $comandaResponse = Invoke-API -Method POST -Endpoint "/comandas" -Body $comandaData -Token $meseroToken
    
    if ($comandaResponse.data.comanda) {
        $comanda1Id = $comandaResponse.data.comanda.id
    } elseif ($comandaResponse.data.id) {
        $comanda1Id = $comandaResponse.data.id
    } else {
        Write-Host "  [DEBUG] Response: $($comandaResponse | ConvertTo-Json -Depth 3)" -ForegroundColor DarkGray
        throw "ERROR: No se obtuvo ID de comanda"
    }
    
    $pedidosEnComanda = $comandaResponse.data.pedidos
    Write-Host "  [OK] Comanda #$comanda1Id creada con $($pedidosEnComanda.Count) pedidos" -ForegroundColor Green

    # ========================
    # FASE 8: VERIFICAR VISTA BAR
    # ========================
    Write-Host "`n[8/12] Verificando pedidos en Bar..." -ForegroundColor Yellow
    Start-Sleep -Seconds 1
    
    $pedidosBarResponse = Invoke-API -Method GET -Endpoint "/pedidos/cocina/pendientes?tipo=bebida&localId=$localId" -Token $adminToken
    
    if ($pedidosBarResponse.data -and $pedidosBarResponse.data.Count -gt 0) {
        $pedidoBebidaId = $pedidosBarResponse.data[0].id
        Write-Host "  [OK] Pedido bebida #$pedidoBebidaId en Bar" -ForegroundColor Green
        Write-Host "  [INFO] Estado: $($pedidosBarResponse.data[0].estado)" -ForegroundColor Gray
    } else {
        Write-Host "  [DEBUG] Response: $($pedidosBarResponse | ConvertTo-Json -Depth 4)" -ForegroundColor DarkGray
        throw "ERROR: Pedido de bebida no encontrado en Bar"
    }

    # ========================
    # FASE 9: VERIFICAR VISTA COCINA
    # ========================
    Write-Host "`n[9/12] Verificando pedidos en Cocina..." -ForegroundColor Yellow
    
    $pedidosCocinaResponse = Invoke-API -Method GET -Endpoint "/pedidos/cocina/pendientes?tipo=comida&localId=$localId" -Token $adminToken
    
    if ($pedidosCocinaResponse.data -and $pedidosCocinaResponse.data.Count -gt 0) {
        $pedidoComidaId = $pedidosCocinaResponse.data[0].id
        Write-Host "  [OK] Pedido comida #$pedidoComidaId en Cocina" -ForegroundColor Green
        Write-Host "  [INFO] Estado: $($pedidosCocinaResponse.data[0].estado)" -ForegroundColor Gray
    } else {
        throw "ERROR: Pedido de comida no encontrado en Cocina"
    }

    # ========================
    # FASE 10: MARCAR PEDIDOS LISTOS
    # ========================
    Write-Host "`n[10/12] Marcando pedidos como listos..." -ForegroundColor Yellow
    
    Invoke-API -Method PUT -Endpoint "/pedidos/$pedidoBebidaId/estado" -Body @{ estado = "listo" } -Token $adminToken | Out-Null
    Write-Host "  [OK] Bebida marcada como lista" -ForegroundColor Green
    
    Invoke-API -Method PUT -Endpoint "/pedidos/$pedidoComidaId/estado" -Body @{ estado = "listo" } -Token $adminToken | Out-Null
    Write-Host "  [OK] Comida marcada como lista" -ForegroundColor Green

    # ========================
    # FASE 11: VERIFICAR COMANDA COMPLETA
    # ========================
    Write-Host "`n[11/12] Verificando comanda completa..." -ForegroundColor Yellow
    Start-Sleep -Seconds 1
    
    $mesasResponse = Invoke-API -Method GET -Endpoint "/mesas" -Token $meseroToken
    $mesa = $mesasResponse.data.mesas | Where-Object { $_.id -eq $mesaId } | Select-Object -First 1

    if ($mesa -and $mesa.comandas) {
        $comanda = $mesa.comandas | Where-Object { $_.id -eq $comanda1Id } | Select-Object -First 1
        if ($comanda) {
            $pedidosNoListos = ($comanda.pedidos | Where-Object { $_.estado -ne "listo" }).Count
            if ($pedidosNoListos -eq 0) {
                Write-Host "  [OK] Comanda #$comanda1Id completamente lista" -ForegroundColor Green
                Write-Host "  [INFO] Debe parpadear con emoji de manita" -ForegroundColor Gray
            } else {
                throw "ERROR: Quedan $pedidosNoListos pedido(s) pendientes"
            }
        }
    }

    # ========================
    # FASE 12: CERRAR CUENTA
    # ========================
    Write-Host "`n[12/12] Cerrando cuenta..." -ForegroundColor Yellow
    
    $cerrarData = @{
        metodoPago = "efectivo"
        montoEfectivo = 75.00
    }
    $cerrarResponse = Invoke-API -Method PUT -Endpoint "/comandas/$comanda1Id/cerrar" -Body $cerrarData -Token $meseroToken
    $totalFinal = if ($cerrarResponse.data.total) { $cerrarResponse.data.total } elseif ($cerrarResponse.data.comanda.total) { $cerrarResponse.data.comanda.total } else { "60.00" }
    Write-Host "  [OK] Cuenta cerrada - Total: `$$totalFinal" -ForegroundColor Green

    # ========================
    # TEST EXITOSO
    # ========================
    $testExitoso = $true
    
    Write-Host "`n=================================" -ForegroundColor Green
    Write-Host "  FLUJO COMPLETO EXITOSO" -ForegroundColor Green
    Write-Host "=================================" -ForegroundColor Green
    Write-Host "Todas las fases completadas correctamente" -ForegroundColor White

} catch {
    Write-Host "`n=================================" -ForegroundColor Red
    Write-Host "  ERROR EN EL TEST" -ForegroundColor Red
    Write-Host "=================================" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
} finally {
    # ========================
    # CLEANUP: ELIMINAR DATOS DE PRUEBA
    # ========================
    Write-Host "`n=================================" -ForegroundColor Cyan
    Write-Host "  LIMPIANDO DATOS DE PRUEBA" -ForegroundColor Cyan
    Write-Host "=================================" -ForegroundColor Cyan
    
    if ($adminToken) {
        # ORDEN CORRECTO: De dependientes a padres
        
        # 1. Eliminar comandas (si quedaron abiertas)
        if ($comanda1Id) {
            try {
                Invoke-API -Method DELETE -Endpoint "/comandas/$comanda1Id" -Token $adminToken -IgnoreError | Out-Null
                Write-Host "  [OK] Comanda eliminada" -ForegroundColor Gray
            } catch {}
        }
        
        # 2. Eliminar productos
        foreach ($prodId in $productoIds) {
            try {
                Invoke-API -Method DELETE -Endpoint "/products/$prodId" -Token $adminToken -IgnoreError | Out-Null
                Write-Host "  [OK] Producto $prodId eliminado" -ForegroundColor Gray
            } catch {
                Write-Host "  [SKIP] Producto $prodId no eliminado" -ForegroundColor DarkGray
            }
        }
        
        # 3. Eliminar proveedor
        if ($proveedorId) {
            try {
                Invoke-API -Method DELETE -Endpoint "/proveedores/$proveedorId" -Token $adminToken -IgnoreError | Out-Null
                Write-Host "  [OK] Proveedor eliminado" -ForegroundColor Gray
            } catch {
                Write-Host "  [SKIP] Proveedor no eliminado" -ForegroundColor DarkGray
            }
        }
        
        # 4. Eliminar mesas
        foreach ($mId in $mesaIds) {
            try {
                Invoke-API -Method DELETE -Endpoint "/mesas/$mId" -Token $adminToken -IgnoreError | Out-Null
                Write-Host "  [OK] Mesa $mId eliminada" -ForegroundColor Gray
            } catch {
                Write-Host "  [SKIP] Mesa $mId no eliminada" -ForegroundColor DarkGray
            }
        }
        
        # 5. Eliminar local (esto debería eliminar usuarios del local en cascada)
        if ($localId) {
            try {
                Invoke-API -Method DELETE -Endpoint "/locales/$localId" -Token $adminToken -IgnoreError | Out-Null
                Write-Host "  [OK] Local eliminado" -ForegroundColor Gray
            } catch {
                Write-Host "  [SKIP] Local no eliminado" -ForegroundColor DarkGray
            }
        }
        
        # 6. Eliminar usuarios manualmente por si acaso
        $userIds = @($meseroId, $cocinaId, $barId, $adminId) | Where-Object { $_ }
        foreach ($userId in $userIds) {
            try {
                Invoke-API -Method DELETE -Endpoint "/users/$userId" -Token $adminToken -IgnoreError | Out-Null
                Write-Host "  [OK] Usuario $userId eliminado" -ForegroundColor Gray
            } catch {
                Write-Host "  [SKIP] Usuario $userId no eliminado" -ForegroundColor DarkGray
            }
        }
        
        Write-Host "`n  [OK] Cleanup completado" -ForegroundColor Green
    } else {
        Write-Host "  [SKIP] No hay token de admin, cleanup manual requerido" -ForegroundColor Yellow
    }
    
    Write-Host "`n=================================" -ForegroundColor Cyan
    if ($testExitoso) {
        Write-Host "  TEST FINALIZADO: EXITOSO" -ForegroundColor Green
    } else {
        Write-Host "  TEST FINALIZADO: FALLIDO" -ForegroundColor Red
    }
    Write-Host "=================================" -ForegroundColor Cyan
    Write-Host ""
}
