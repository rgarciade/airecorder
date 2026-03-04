#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
VENV_DIR="$PROJECT_ROOT/venv"
PYTHON_DIR="$PROJECT_ROOT/python"
OUTPUT_DIR="$PROJECT_ROOT/python-dist"

echo "=== Building audio_sync_analyzer binary ==="
echo "Project root: $PROJECT_ROOT"

# Verificar que el venv existe
if [ ! -f "$VENV_DIR/bin/python" ]; then
    echo "ERROR: No se encontró el venv en $VENV_DIR"
    echo "Ejecuta: python3 -m venv venv && venv/bin/pip install -r requirements.txt pyinstaller"
    exit 1
fi

# Verificar que PyInstaller está instalado
if ! "$VENV_DIR/bin/python" -c "import PyInstaller" 2>/dev/null; then
    echo "ERROR: PyInstaller no está instalado en el venv"
    echo "Ejecuta: venv/bin/pip install pyinstaller"
    exit 1
fi

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
