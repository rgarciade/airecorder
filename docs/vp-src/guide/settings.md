---
title: Ajustes
description: Todas las opciones de configuración de AIRecorder explicadas en detalle.
---

# Ajustes

AIRecorder tiene 4 pestañas de configuración: **Agentes de IA**, **General**, **Expertos** e **Integraciones**. Aquí tienes cada opción explicada.

---

## Agentes IA

La pestaña principal donde configuras el motor de IA. Tiene dos sub-pestañas, **General** y **Embeddings**, con selección de proveedor independiente para cada rol — podés usar, por ejemplo, Ollama para General y Gemini para Embeddings al mismo tiempo. Dentro de cada sub-pestaña hay tres secciones colapsables (hacé clic en el título o en la flecha para desplegarlas):

### Proveedores Locales (Ollama / LM Studio)

| Campo | Descripción |
|-------|-------------|
| **Host / Base URL** | Dirección del servidor local. Ollama: `http://localhost:11434`. LM Studio: `http://localhost:1234/v1`. La app lo detecta automáticamente si el servicio está corriendo. |
| **Modelo General** | Para generar automáticamente resúmenes, tareas, puntos clave y análisis tras cada transcripción. Solo visible en la sub-pestaña General. |
| **Modelo de Chat** | Para las conversaciones interactivas en el panel de chat (RAG). Si se deja vacío, se usa el Modelo General. Solo visible en la sub-pestaña General. |
| **Modelo de Embedding** | Convierte texto en vectores para la búsqueda semántica (RAG). Solo visible en la sub-pestaña Embeddings. Si cambias este modelo, necesitas re-indexar tus transcripciones. |
| **Ventana de Contexto** | Tokens máximos que el modelo puede procesar a la vez. Usa el botón **"Detectar"** para auto-configurarlo según tu modelo y hardware. |

Ver [IA Local](/guide/local-ai) para la guía completa de instalación y modelos recomendados.

### Proveedores en la Nube

| Proveedor | Requiere | Modelo General | Modelo de Embedding |
|-----------|----------|-----------------|----------------------|
| **OpenAI** | API Key de OpenAI | Lista real de tu cuenta | Fijo |
| **Gemini** | API Key de Google AI Studio | Lista real de tu cuenta | Fijo |
| **Kimi (Moonshot)** | API Key de Moonshot | Lista corta predefinida | Fijo |
| **DeepSeek** | API Key de DeepSeek | Lista corta predefinida | No soportado (oculto en la sub-pestaña Embeddings) |

Ver [IA en la Nube](/guide/cloud-ai) para el detalle completo de cada proveedor.

### Conexiones OpenAI Personalizadas

Conectá cualquier servicio compatible con la API de OpenAI (OpenRouter, Groq, vLLM propio, etc.) con nombre, URL base y API Key opcional. Ver [Conexiones OpenAI Personalizadas](/guide/custom-ai) para la guía completa.

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
| **Auto-generar Esquema** | Si está activo, al completar el análisis IA se genera el esquema/mind-map automáticamente (si no existe). Requiere auto-análisis activo. |

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

- [Esquema](/guide/schema) — Mind-map interactivo generado por IA
- [IA Local](/guide/local-ai) — Configurar Ollama o LM Studio
- [IA en la Nube](/guide/cloud-ai) — OpenAI, Gemini, Kimi y DeepSeek
- [Conexiones OpenAI Personalizadas](/guide/custom-ai) — Cualquier endpoint compatible con OpenAI
- [Diarización](/reference/diarization) — Detalles técnicos del reconocimiento de hablantes
- [Sistema RAG](/reference/rag) — Cómo funciona la búsqueda semántica
