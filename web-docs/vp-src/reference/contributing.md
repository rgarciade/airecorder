---
title: Guía para Contribuidores
description: Cómo contribuir al proyecto AIRecorder.
---

# Guía para Contribuidores

AIRecorder es un proyecto open source y las contribuciones son bienvenidas. Esta guía te ayudará a empezar rápidamente.

## Stack Tecnológico

| Tecnología | Descripción |
|------------|-------------|
| **Electron** | Framework para aplicaciones de escritorio. Main process (`electron/main.js`), Preload (`electron/preload.js`), comunicación IPC. |
| **React + Vite** | Frontend con React, estilos Tailwind CSS, estado global con Redux Toolkit, internacionalización con i18next. |
| **Python** | Procesamiento de audio y transcripción con Whisper. Script principal: `python/audio_sync_analyzer.py`. |
| **SQLite** | Base de datos local con better-sqlite3. |

## Cómo Ejecutar en Desarrollo

```bash
npm run dev
```

Este comando:
- Inicia el frontend con Vite en modo hot-reload
- Lanza Electron con la ventana de la app
- Cualquier cambio en el código React se refleja automáticamente

## Comandos de Build

| Comando | Descripción |
|---------|-------------|
| `npm run build` | Build del frontend |
| `npm run electron:build` | Build de macOS DMG |

## Convenio de Commits

Utilizamos **Conventional Commits**. Cada commit debe empezar con un tipo seguido de dos puntos:

| Tipo | Descripción |
|------|-------------|
| `feat:` | Nueva funcionalidad |
| `fix:` | Corrección de bug |
| `refactor:` | Refactorización de código sin cambiar comportamiento |
| `docs:` | Cambios en documentación |
| `chore:` | Tareas de mantenimiento, dependencias, configuración |

## Reglas del Proyecto

### Límite de Líneas
Archivos de más de ~300 líneas son code smell. Divide en módulos más pequeños agrupados por contexto.

### Internacionalización
Todo texto visible en la UI debe usar claves de i18n, nunca texto hardcodeado.

### Seguridad
Nunca comitear claves API, tokens o credenciales. Usa variables de entorno o configuración del usuario.

### Documentación
Si modificas lógica en áreas clave, actualiza el README correspondiente (ver matriz de mantenimiento en AGENTS.md).

## Estructura del Proyecto

```
airecorder/
├── electron/               # Main process (Node.js / Electron)
│   ├── ipc-handlers/       # IPC communication handlers
│   ├── services/           # Transcription queue, audio, update checker
│   └── database/           # SQLite schema, queries, migrations
├── src/                    # Renderer process (React)
│   ├── pages/              # Full-page views (Home, Projects, Settings…)
│   ├── components/         # Reusable UI components
│   └── services/           # Audio capture, AI providers, Redux store
├── python/                 # Audio processing & transcription backend
│   └── audio_sync_analyzer.py
├── scripts/                # Build utilities
└── requirements.txt        # Python dependencies
```

## Requisitos Previos

- [Node.js](https://nodejs.org/) v20+
- [Python](https://www.python.org/) 3.10+

## Instalación

```bash
# 1. Clone the repository
git clone https://github.com/rgarciade/airecorder.git
cd airecorder

# 2. Install Node dependencies
npm install

# 3. Rebuild native modules for Electron
npm rebuild better-sqlite3 --runtime=electron --target=31.7.7 --dist-url=https://electronjs.org/headers --build-from-source

# 4. Install Python dependencies
pip install -r requirements.txt
```