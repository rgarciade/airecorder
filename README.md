# 🎙️ AIRecorder

Una aplicación de escritorio para macOS (Electron + React + Python) para grabar audio con transcripción y análisis impulsados por IA. 
Graba audio de doble canal (micrófono + sistema), transcribe mediante OpenAI Whisper (Python), y proporciona resúmenes/chat por IA mediante múltiples proveedores locales y en la nube (Gemini, Ollama, etc.).

## 📁 Navegación de Documentación (Para IAs y Desarrolladores)

Este proyecto utiliza un modelo de **Documentación por Proximidad**. Si vas a trabajar en un área específica, lee el README correspondiente a esa carpeta:

*   🤖 **Lógica de IA y Prompts:** Lee `src/services/ai/README.md`
*   🖥️ **Lógica Principal, IPC y Base de Datos (SQLite):** Lee `electron/README.md`
*   📜 **Reglas Generales y Comandos:** Lee `AGENTS.md` (o `CLAUDE.md`)

---

## 🐍 Pipeline de Audio y Transcripción (Python)

Esta sección documenta el funcionamiento del backend de procesamiento de audio escrito en Python y cómo se comunica con Electron.

### Arquitectura de Audio

1.  **Archivos:** 
    *   `python/audio_sync_analyzer.py`: Se encarga de procesar los audios (recortar, emparejar canales). Utiliza `librosa` para calcular el desfase (correlación cruzada) entre la pista del micrófono y la de sistema, y `whisper` para transcribir.
    *   `python/audio_stream_daemon.py`: (Uso en experimentación/streaming, revisar el código fuente para estado actual).

2.  **Gestor de Colas (Electron):**
    *   `electron/transcriptionManager.js` controla la ejecución.
    *   Mantiene una tabla SQLite `transcription_queue` (estado `pending`, `processing`, `completed`, `failed`).
    *   Se asegura de que **solo haya una transcripción activa a la vez** (`this.activeTask`).

### Comunicación Python <-> Electron (El patrón de Progreso)

Dado que la transcripción es un proceso pesado, Python informa al proceso de Node/Electron de su progreso imprimiendo cadenas formateadas en su salida estándar (`stdout`).

*   **Comando de ejecución:** Electron lanza Python mediante `child_process.spawn`:
    `python python/audio_sync_analyzer.py --basename <carpeta_del_audio> --model <modelo_whisper>`
*   **Reporte de Progreso:** Dentro de Python, cada cierto tiempo se imprime:
    `PROGRESS:15` (o el porcentaje correspondiente).
*   **Análisis (Parsing):** `transcriptionManager.js` captura el evento `.on('data', ...)` del proceso, busca la cadena `PROGRESS:XX`, actualiza la base de datos y emite un evento al frontend para actualizar la barra de progreso en React.

### Dependencias y Entorno
El código de Python requiere ejecutarse dentro de un entorno virtual que contenga `whisper`, `librosa`, `pydub`, `ffmpeg` (en sistema) y `torch`.
*   **Aviso para Agentes de IA:** Los scripts de Python pueden tener rutas hardcodeadas (como la ruta al ejecutable de `python` dentro de `venv/`). **Consérvalas a menos que el usuario pida explícitamente refactorizar la portabilidad.**

---

## 🚀 Construcción y Distribución

### Versiones y Releases

La app usa un **sistema de actualizaciones manual** (sin firma de Apple Developer). Las actualizaciones se distribuyen mediante **GitHub Releases**.

#### Versión Actual
- **Ubicación:** `package.json` → campo `"version"`
- **Formato:** Semántico (ej. `0.0.1`, `1.0.0`, `1.2.3`)
- **Sincronización:** La app consulta automáticamente `https://api.github.com/repos/rgarciade/airecorder/releases/latest` cada 4 horas

### Construir el DMG para macOS

**Prerequisitos:**
- Node.js v20+
- Python 3.10+ con `venv` activado y dependencias instaladas
- Xcode (para firmar código, aunque no sea obligatorio)

**Comando:**
```bash
npm run electron:build
```

**Qué hace:**
1. Compila el código Python con PyInstaller (`npm run python:build`)
2. Construye el frontend React (`vite build`)
3. Ofusca el código Electron (`npm run obfuscate:electron`)
4. Genera el DMG con electron-builder
5. Aplica protección ASAR con asarmor (dificulta la extracción)
6. Limpia carpetas temporales

**Salida:**
- `dist-electron/AIRecorder-0.0.1-arm64.dmg` (ajusta versión según tu `package.json`)

### Crear una Release en GitHub

#### Paso 1: Preparar la versión
```bash
# Edita package.json
nano package.json
# Cambia "version" de "0.0.1" a "0.0.2" (o la versión deseada)
```

#### Paso 2: Construir el DMG
```bash
npm run electron:build
```

#### Paso 3: Crear tag en Git
```bash
git tag v0.0.2  # Usa la misma versión que en package.json
git push origin v0.0.2
```

#### Paso 4: Crear Release en GitHub (opción A: CLI)
```bash
# Instala gh (GitHub CLI) si no lo tienes:
# brew install gh

# Crear release con el DMG adjunto
gh release create v0.0.2 \
  "dist-electron/AIRecorder-0.0.2-arm64.dmg" \
  --title "AIRecorder v0.0.2" \
  --notes "Descripción de cambios y nuevas funciones"
```

#### Paso 4: Crear Release en GitHub (opción B: Web)
1. Ve a https://github.com/rgarciade/airecorder/releases/new
2. Click en "Draft a new release"
3. Tag: `v0.0.2`
4. Title: `AIRecorder v0.0.2`
5. Description: Detalla los cambios (qué se mejoró, qué se corrigió)
6. Adjunta el DMG: Arrastra `dist-electron/AIRecorder-0.0.2-arm64.dmg` al campo de assets
7. Click "Publish release"

### Cómo actualizarán los usuarios

1. La app arranca y tras 5 segundos verifica automáticamente si hay una versión más nueva en GitHub
2. Si existe una versión más reciente (ej. app tiene v0.0.1, release es v0.0.2):
   - Muestra un diálogo nativo: *"¡Hay una nueva versión de AIRecorder disponible! v0.0.2"*
   - Usuario puede hacer click en "Descargar" → abre el navegador con el DMG de descarga
   - Usuario descarga el DMG, lo abre y arrastra la app a Aplicaciones
3. Los usuarios también pueden verificar manualmente: **Settings → General → "Buscar actualizaciones"**

### Protección de Código

La construcción aplica **3 capas de protección** automáticamente:

1. **Ofuscación JavaScript** (`scripts/obfuscate-electron.js`)
   - Copia `electron/` → `electron-obfuscated/`
   - Aplica ofuscación con control flow flattening, string array encoding, dead code injection
   - Solo se ejecuta en build, no afecta desarrollo

2. **Protección ASAR** (`scripts/protect-asar.js`)
   - Hook post-build que aplica `asarmor` al archivo `.asar`
   - Hace que `npx @electron/asar extract` sea mucho más difícil
   - Añade bloat ficticio (datos basura) que ralentiza intentos de extracción

3. **Minificación Frontend**
   - Vite minifica React en producción automáticamente

**Nota:** La protección es pragmática, no perfecta. Un usuario determinado siempre puede des-ofuscar el código. El objetivo es **elevar el esfuerzo requerido** para copiar la app.