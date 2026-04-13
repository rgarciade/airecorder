$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$VenvDir = Join-Path $ProjectRoot "venv"
$PythonDir = Join-Path $ProjectRoot "python"
$OutputDir = Join-Path $ProjectRoot "python-dist"
$Arch = "x64"

Write-Host "=== Building audio_sync_analyzer binary ==="
Write-Host "Project root: $ProjectRoot"

# Asegurar que el venv existe
$PythonExe = Join-Path $VenvDir "Scripts\python.exe"
$PipExe = Join-Path $VenvDir "Scripts\pip.exe"

if (-not (Test-Path $PythonExe)) {
    Write-Host "🔧 No se encontro el venv. Creando uno nuevo..."
    & python -m venv "$VenvDir"
    Write-Host "📦 Instalando dependencias base..."
    $ReqFile = Join-Path $ProjectRoot "requirements.txt"
    & $PipExe install -r "$ReqFile" pyinstaller
}

# Asegurar que las dependencias criticas estan instaladas (incluyendo pyannote.audio)
Write-Host "🔍 Verificando dependencias criticas..."
$CriticalDeps = @("PyInstaller", "pyannote.audio")
foreach ($dep in $CriticalDeps) {
    # Check both original and underscore version (e.g. pyannote.audio vs pyannote_audio)
    $safeDep = $dep -replace '\.', '_'
    & $PythonExe -c "import $dep" 2>$null
    if ($LASTEXITCODE -ne 0) {
        & $PythonExe -c "import $safeDep" 2>$null
        if ($LASTEXITCODE -ne 0) {
            Write-Host "📥 Dependencia '$dep' no detectada. Instalando..."
            & $PipExe install $dep
        }
    }
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
