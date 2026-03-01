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