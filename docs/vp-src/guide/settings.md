---
title: Ajustes
description: Todas las opciones de configuración de AIRecorder explicadas en detalle.
---

# Ajustes

AIRecorder tiene 3 pestañas de configuración. Aquí tienes cada opción explicada.

---

## Agentes IA

La pestaña principal donde configuras el motor de IA.

### Proveedores Locales (Ollama / LM Studio)

| Campo | Descripción |
|-------|-------------|
| **Host / Base URL** | Dirección del servidor local. Ollama: `http://localhost:11434`. LM Studio: `http://localhost:1234/v1`. La app lo detecta automáticamente si el servicio está corriendo. |
| **Modelo General** | Para generar automáticamente resúmenes, tareas, puntos clave y análisis tras cada transcripción. |
| **Modelo de Chat** | Para las conversaciones interactivas en el panel de chat (RAG). Si se deja vacío, se usa el Modelo General. |
| **Modelo de Embedding** | Convierte texto en vectores para la búsqueda semántica (RAG). Si cambias este modelo, necesitas re-indexar tus transcripciones. |
| **Ventana de Contexto** | Tokens máximos que el modelo puede procesar a la vez. Usa el botón **"Detectar"** para auto-configurarlo según tu modelo y hardware. |

### Proveedores Cloud

| Proveedor | Requiere | Descripción |
|-----------|----------|-------------|
| **Gemini Free** | API Key de Google | Modelo gratuito de Google. El modelo se carga dinámicamente desde la API. |
| **Gemini Pro** | API Key de Google | Versión avanzada de Gemini con mejores capacidades. |
| **DeepSeek** | API Key | Modelo cloud con buena relación calidad/precio. |
| **Kimi (Moonshot)** | API Key | Proveedor cloud alternativo. |

::: tip ¿Local o Cloud?
- **Local**: Privacidad total, sin coste, sin internet (tras descargar modelos)
- **Cloud**: Modelos más potentes, ideal para reuniones muy largas o hardware limitado
:::

---

## General

### Almacenamiento

| Opción | Descripción |
|--------|-------------|
| **Directorio de grabaciones** | Carpeta donde se guardan los archivos WAV y las transcripciones. Puedes cambiarla con el selector de carpetas. |
| **Base de datos** | Ubicación del archivo SQLite con los metadatos. Puedes migrarla a otra ubicación manteniendo tus datos. |

### Transcripción

| Opción | Descripción |
|--------|-------------|
| **Idioma de transcripción** | Idioma que espera Whisper en el audio. Déjalo en "Auto" si no sabes el idioma de antemano. |
| **Modelo Whisper** | `tiny` (más rápido) → `large` (más preciso). A mayor modelo, más RAM y tiempo de proceso. |
| **Hilos CPU** | Núcleos usados para transcribir. Más hilos = más rápido, pero consume más CPU. |
| **Auto-transcripción** | Si está activo, al detener una grabación se lanza la transcripción automáticamente. |
| **Auto-análisis IA** | Si está activo, tras la transcripción se generan automáticamente resumen, tareas y puntos clave. Requiere IA configurada. |

::: tip Flujo automático completo
Con **Auto-transcripción** + **Auto-análisis IA** activados: grabas → detienes → la IA transcribe y analiza todo sin que toques nada más.
:::

### Diarización de Interlocutores ⚡ Experimental

| Opción | Descripción |
|--------|-------------|
| **Activar** | Identifica automáticamente quién habla en cada momento usando pyannote.audio. |
| **HuggingFace Token** | Token de acceso para descargar el modelo de diarización. La primera activación requiere internet. |
| **Umbral de similitud** | 50–99%. Valores bajos = más permisivo (une voces similares). Valores altos = más estricto (separa más). Por defecto: 85%. |

### Apariencia

| Opción | Descripción |
|--------|-------------|
| **Tema** | Claro, Oscuro, o seguir el sistema. |
| **Idioma de la interfaz** | Español o English. Cambio inmediato sin reiniciar. |
| **Tamaño de fuente** | Ajusta el texto de toda la interfaz. |

### Proyectos

| Opción | Descripción |
|--------|-------------|
| **Reuniones recientes** | Cuántas grabaciones mostrar en el panel de cada proyecto (1–10). |

### Audio

| Opción | Descripción |
|--------|-------------|
| **Micrófono** | Selecciona el dispositivo de entrada de audio del sistema. |

### Sistema

| Opción | Descripción |
|--------|-------------|
| **Notificaciones del sistema** | Mostrar notificaciones nativas al completar transcripciones o análisis. |
| **Developer Tools** | Abre las herramientas de desarrollo de Electron (consola, red, elementos). |

### Permisos

Muestra el estado del permiso de micrófono. Si está denegado, puedes abrir las Preferencias del Sistema desde aquí para concederlo.

### Acerca de

Muestra la versión actual de AIRecorder instalada.

---

## Experts

La pestaña Experts permite configurar prompts personalizados y ajustes avanzados de IA. (Esta sección se ampliará en el futuro.)

---

## Ver también

- [IA Local](/guide/local-ai) — Configurar Ollama o LM Studio
- [Diarización](/reference/diarization) — Detalles técnicos del reconocimiento de hablantes
- [Sistema RAG](/reference/rag) — Cómo funciona la búsqueda semántica
