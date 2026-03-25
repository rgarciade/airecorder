$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$VenvDir = Join-Path $ProjectRoot "venv"
$PythonDir = Join-Path $ProjectRoot "python"
$OutputDir = Join-Path $ProjectRoot "python-dist"
$Arch = "x64"

Write-Host "=== Building audio_sync_analyzer binary ==="
Write-Host "Project root: $ProjectRoot"

# Verificar que el venv existe
$PythonExe = Join-Path $VenvDir "Scripts\python.exe"
if (-not (Test-Path $PythonExe)) {
    Write-Error "ERROR: No se encontro el venv en $VenvDir"
    Write-Host "Ejecuta: python -m venv venv && venv\Scripts\pip install -r requirements.txt pyinstaller"
    exit 1
}

# Verificar que PyInstaller esta instalado
& $PythonExe -c "import PyInstaller" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Error "ERROR: PyInstaller no esta instalado en el venv"
    Write-Host "Ejecuta: venv\Scripts\pip install pyinstaller"
    exit 1
}

Write-Host "Arquitectura: $Arch"
Write-Host "Output dir: $OutputDir\$Arch"

# Limpiar builds anteriores
$BuildDir = Join-Path $PythonDir "build"
$ArchOutputDir = Join-Path $OutputDir $Arch
if (Test-Path $BuildDir) { Remove-Item $BuildDir -Recurse -Force }
if (Test-Path $ArchOutputDir) { Remove-Item $ArchOutputDir -Recurse -Force }

# Ejecutar PyInstaller
Set-Location $PythonDir
& $PythonExe -m PyInstaller `
    --distpath "$ArchOutputDir" `
    --workpath "$BuildDir" `
    --noconfirm `
    audio_sync_analyzer.spec

# Limpiar artefactos intermedios
if (Test-Path $BuildDir) { Remove-Item $BuildDir -Recurse -Force }

# Mostrar resultado
Write-Host ""
Write-Host "=== Build completado ==="
$BinPath = Join-Path $ArchOutputDir "audio_sync_analyzer"
Write-Host "Binario: $BinPath\audio_sync_analyzer.exe"
