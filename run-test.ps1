# Script para ejecutar el test de flujo completo
# Asegura que estés en el directorio correcto y verifica el backend

Write-Host "`n==================================" -ForegroundColor Cyan
Write-Host "  EJECUTAR TEST DE FLUJO COMPLETO" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan

# Verificar que el backend esté corriendo
Write-Host "`n[1/2] Verificando backend..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/health" -Method GET -TimeoutSec 5
    Write-Host "  [OK] Backend está corriendo" -ForegroundColor Green
} catch {
    Write-Host "  [ERROR] Backend no está corriendo en http://localhost:3000" -ForegroundColor Red
    Write-Host "  Por favor inicia el backend con: cd backend; npm run dev" -ForegroundColor Yellow
    exit 1
}

# Ejecutar el test
Write-Host "`n[2/2] Ejecutando test..." -ForegroundColor Yellow
& "$PSScriptRoot\tests\test-flujo-completo.ps1"
