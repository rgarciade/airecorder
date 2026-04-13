#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
VENV_DIR="$PROJECT_ROOT/venv"
PYTHON_DIR="$PROJECT_ROOT/python"
OUTPUT_DIR="$PROJECT_ROOT/python-dist"

echo "=== Building audio_sync_analyzer binary ==="
echo "Project root: $PROJECT_ROOT"

# Asegurar que el venv existe
if [ ! -f "$VENV_DIR/bin/python" ]; then
    echo "🔧 No se encontró el venv. Creando uno nuevo..."
    python3 -m venv "$VENV_DIR"
    echo "📦 Instalando dependencias base..."
    "$VENV_DIR/bin/pip" install -r "$PROJECT_ROOT/requirements.txt" pyinstaller
fi

# Asegurar que las dependencias críticas están instaladas (incluyendo pyannote.audio)
echo "🔍 Verificando dependencias críticas..."
CRITICAL_DEPS=("PyInstaller" "pyannote.audio")
for dep in "${CRITICAL_DEPS[@]}"; do
    if ! "$VENV_DIR/bin/python" -c "import $dep" 2>/dev/null && ! "$VENV_DIR/bin/python" -c "import ${dep//./_}" 2>/dev/null; then
        echo "📥 Dependencia '$dep' no detectada. Instalando..."
        "$VENV_DIR/bin/pip" install "${dep,,}"
    fi
done

# Obtener arquitectura actual
ARCH=$(uname -m)
echo "Arquitectura: $ARCH"
echo "Output dir: $OUTPUT_DIR/$ARCH"

# Limpiar builds anteriores
rm -rf "$PYTHON_DIR/build" "$OUTPUT_DIR/$ARCH"

# Ejecutar PyInstaller
cd "$PYTHON_DIR"
"$VENV_DIR/bin/pyinstaller" \
    --distpath "$OUTPUT_DIR/$ARCH" \
    --workpath "$PYTHON_DIR/build" \
    --noconfirm \
    audio_sync_analyzer.spec

# Limpiar artefactos intermedios
rm -rf "$PYTHON_DIR/build"

# Mostrar resultado
echo ""
echo "=== Build completado ==="
du -sh "$OUTPUT_DIR/$ARCH/audio_sync_analyzer/"
echo "Binario: $OUTPUT_DIR/$ARCH/audio_sync_analyzer/audio_sync_analyzer"
