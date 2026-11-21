---
title: Arquitectura Técnica
description: Arquitectura interna de AIRecorder y flujo de datos.
---

# Arquitectura Técnica

AIRecorder está construida sobre cuatro pilares tecnológicos que trabajan en conjunto para ofrecer una experiencia completa de grabación, transcripción y análisis de audio.

## Los Cuatro Pilares

| Tecnología | Rol |
|------------|-----|
| **Electron** | Ventana de escritorio y gestión de procesos |
| **React** | Interfaz de usuario y estado |
| **Python** | Procesamiento de audio y transcripción |
| **SQLite** | Almacenamiento local de datos |

## Flujo de Comunicación (IPC)

AIRecorder sigue el modelo de procesos de Electron:

### Main Process (`electron/main.js`)

Gestiona:
- Ventanas y navegador
- Sistema de archivos
- Procesos de Python
- Comunicación con la base de datos

### Renderer Process (React App)

La interfaz de usuario que interactúa con el usuario final.

### Preload (`electron/preload.js`)

Archivo intermedio que expone los canales IPC al renderer de forma segura usando `contextBridge`.

### Canales IPC Principales

| Canal | Función |
|-------|---------|
| `recording:start` | Inicia la captura de audio |
| `recording:stop` | Detiene y guarda el archivo WAV |
| `transcription:process` | Lanza el proceso Python de Whisper |
| `ai:analyze` | Envía texto al proveedor de IA |
| `db:*` | Operaciones de lectura/escritura en SQLite |

## Base de Datos (SQLite)

Los metadatos de transcripciones, proyectos, hablantes y configuraciones se almacenan en una base de datos SQLite local gestionada por `better-sqlite3`.

Características:
- Base de datos embebida (no requiere servidor)
- Todo vive en un único archivo `.db`
- Ubicación: `~/Library/Application Support/AIRecorder`

## Transcription Manager

El módulo `electron/transcriptionManager.js` orquesta el pipeline de transcripción:

1. Recibe el archivo WAV
2. Invoca el script Python (`python/audio_sync_analyzer.py`)
3. Captura la salida JSON con los segmentos transcritos
4. Almacena los datos en la base de datos
5. Si la diarización está activa, ejecuta pyannote para identificar hablantes