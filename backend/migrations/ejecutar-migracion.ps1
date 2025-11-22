# Script para ejecutar migración en PostgreSQL desde Windows
# Asegúrate de tener PostgreSQL instalado

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  EJECUTAR MIGRACION - MalaFama" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Buscar psql en rutas comunes de instalación
$psqlPaths = @(
    "C:\Program Files\PostgreSQL\16\bin\psql.exe",
    "C:\Program Files\PostgreSQL\15\bin\psql.exe",
    "C:\Program Files\PostgreSQL\14\bin\psql.exe",
    "C:\Program Files\PostgreSQL\13\bin\psql.exe",
    "C:\Program Files (x86)\PostgreSQL\16\bin\psql.exe",
    "C:\Program Files (x86)\PostgreSQL\15\bin\psql.exe"
)

$psqlExe = $null
foreach ($path in $psqlPaths) {
    if (Test-Path $path) {
        $psqlExe = $path
        break
    }
}

if (-not $psqlExe) {
    Write-Host "ERROR: No se encontró psql.exe" -ForegroundColor Red
    Write-Host ""
    Write-Host "Por favor, instala PostgreSQL o agrega psql al PATH" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Alternativa: Ejecuta la migración manualmente desde pgAdmin o DBeaver:" -ForegroundColor Cyan
    Write-Host "  1. Abre pgAdmin o DBeaver" -ForegroundColor White
    Write-Host "  2. Conecta a la base de datos 'malafama'" -ForegroundColor White
    Write-Host "  3. Abre el archivo: backend/migrations/20251121_add_payment_fields_to_comandas.sql" -ForegroundColor White
    Write-Host "  4. Ejecuta el script SQL" -ForegroundColor White
    Write-Host ""
    exit 1
}

Write-Host "PostgreSQL encontrado en: $psqlExe" -ForegroundColor Green
Write-Host ""

# Solicitar credenciales
$dbUser = Read-Host "Usuario de PostgreSQL (default: postgres)"
if ([string]::IsNullOrWhiteSpace($dbUser)) {
    $dbUser = "postgres"
}

$dbName = Read-Host "Nombre de la base de datos (default: malafama)"
if ([string]::IsNullOrWhiteSpace($dbName)) {
    $dbName = "malafama"
}

Write-Host ""
Write-Host "Ejecutando migración..." -ForegroundColor Yellow

# Cambiar al directorio raíz del proyecto
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent (Split-Path -Parent $scriptDir)
Set-Location $projectRoot

# Ejecutar migración
$migrationFile = "backend\migrations\20251121_add_payment_fields_to_comandas.sql"

if (-not (Test-Path $migrationFile)) {
    Write-Host "ERROR: No se encontró el archivo de migración: $migrationFile" -ForegroundColor Red
    exit 1
}

try {
    & $psqlExe -U $dbUser -d $dbName -f $migrationFile
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Green
        Write-Host "  MIGRACION COMPLETADA EXITOSAMENTE" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "Campos agregados a la tabla 'comandas':" -ForegroundColor Cyan
        Write-Host "  - forma_pago (efectivo, qr, mixto)" -ForegroundColor White
        Write-Host "  - cantidad_efectivo" -ForegroundColor White
        Write-Host "  - cantidad_qr" -ForegroundColor White
        Write-Host "  - comprobante" -ForegroundColor White
        Write-Host ""
    } else {
        Write-Host ""
        Write-Host "ERROR: La migración falló con código $LASTEXITCODE" -ForegroundColor Red
        Write-Host ""
    }
} catch {
    Write-Host ""
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
}
