---
title: IA Local
description: Configura Ollama o LM Studio para usar IA local con AIRecorder. Modelos recomendados y arquitectura dual.
---

# IA Local

AIRecorder puede funcionar completamente sin conexión a internet usando modelos de IA locales. Esto garantiza **privacidad total** — tus datos nunca salen de tu ordenador.

## ¿Por Qué IA Local?

- **Privacidad**: Tus transcripciones y datos no se envían a servidores externos
- **Sin costes**: No necesitas pagar API keys de servicios cloud
- **Sin internet**: Funciona offline una vez descargados los modelos
- **Control total**: Tú eliges qué modelos usar y cómo se ejecutan

---

## Arquitectura Dual: Modelo General vs. Chat

AIRecorder usa **dos modelos distintos** para tareas diferentes. Los puedes configurar por separado en Ajustes:

| Modelo | Función | ¿Cuándo se usa? |
|--------|---------|-----------------|
| **Modelo General** | Resúmenes, análisis, tareas, puntos clave, participantes | Tras cada transcripción (auto-análisis) |
| **Modelo de Chat** | Conversaciones interactivas con RAG | Cuando preguntas en el chat sobre una transcripción |
| **Modelo de Embedding** | Búsqueda semántica (vectores) | Indexación de transcripciones y búsquedas RAG |

::: tip 💡 Si no configuras el Modelo de Chat, AIRecorder usará el Modelo General para todo.
:::

### Proveedor Independiente por Rol

En **Ajustes > Agentes IA** hay dos sub-pestañas, **Chat** y **Embeddings**. Cada una tiene su propia selección de proveedor — podés usar Ollama para Chat y un proveedor cloud para Embeddings (o al revés), o el mismo proveedor local para ambos con modelos distintos. Las secciones "Proveedores Locales", "Proveedores en la Nube" y "Conexiones OpenAI Personalizadas" arrancan colapsadas — hacé clic en el título o en la flecha de cada una para desplegarla.

::: tip 💡 También disponible en el Onboarding
La pantalla de configuración inicial de IA (primera vez que abrís AIRecorder) tiene el mismo split Chat/Embeddings, con selección real de modelo para cada proveedor local.
:::

---

## Ollama (Recomendado)

Ollama es la opción más sencilla. Se ejecuta como servicio en segundo plano y AIRecorder lo detecta automáticamente.

### Instalación

1. Descarga Ollama desde [ollama.com/download](https://ollama.com/download)
2. Ejecuta el instalador
3. Abre tu terminal y descarga los modelos:

```bash
# Modelo principal para análisis y chat (Gemma 4 4B)
ollama pull gemma4:e4b

# Modelo de embedding para búsqueda semántica
ollama pull mxbai-embed-large
```

::: tip 💡 ¿e2b o e4b?
`gemma4:e4b` es el recomendado por defecto (mejor calidad). Si tu equipo tiene poca RAM, `gemma4:e2b` es la variante más liviana de la misma familia.
:::

### Configuración en AIRecorder

1. Ve a **Ajustes > Agentes IA**
2. Selecciona **Ollama** como proveedor
3. La URL por defecto es `http://localhost:11434` (AIRecorder la detecta automáticamente)
4. Selecciona `gemma4:e4b` (o `gemma4:e2b` si querés algo más liviano) como **Modelo General** y **Modelo de Chat**
5. Selecciona `mxbai-embed-large` como **Modelo de Embedding**
6. Usa el botón **"Detectar"** para auto-configurar la ventana de contexto
7. Pulsa **"Verificar modelo"** para confirmar que todo funciona

---

## LM Studio

LM Studio ofrece interfaz gráfica y control fino sobre los parámetros del modelo.

### Instalación

1. Descarga LM Studio desde [lmstudio.ai](https://lmstudio.ai)
2. Abre la aplicación
3. Busca y descarga los modelos:
   - **Chat**: `gemma-4-4b-it-GGUF` (o `gemma-4-2b-it-GGUF` para algo más liviano)
   - **Embedding**: `mxbai-embed-large-v1.Q8_0.gguf`

### Iniciar el Servidor

1. Ve a la pestaña **Local Server** (icono de red)
2. Carga tu modelo de chat
3. Habilita el modelo de embedding
4. Pulsa **Start Server**

### Configuración en AIRecorder

1. Ve a **Ajustes > Agentes IA**
2. Selecciona **LM Studio**
3. La URL suele ser `http://localhost:1234/v1`
4. Configura los modelos igual que con Ollama
5. Pulsa **"Verificar modelo"**

---

## Modelos Recomendados

### ⭐ Modelos de Chat / Generales

| Modelo | Tamaño | RAM mínima | Recomendado para |
|--------|--------|------------|------------------|
| **gemma4:e4b** ⭐ | ~4GB | 8 GB | **Principal** — rápido, preciso, ideal para análisis |
| gemma4:e2b 🪶 | ~2GB | 8 GB | Variante liviana de la misma familia |
| qwen2.5:7b | ~4GB | 16 GB | Análisis más profundos |
| deepseek-r1:8b | ~5GB | 16 GB | Razonamiento avanzado |

### ⭐ Modelos de Embedding

| Modelo | Precisión | Recomendado para |
|--------|-----------|------------------|
| **mxbai-embed-large** ⭐ | Alta | **Principal** — mejor precisión en búsquedas |
| nomic-embed-text 🪶 | Media | Alternativa ligera, compatible con todo |

::: warning ⚠️ Consistencia del modelo de embedding
El modelo de embedding debe ser el mismo al indexar y al buscar. Si cambias de modelo, necesitas **re-indexar** tus transcripciones desde Ajustes.
:::

---

## La Ventana de Contexto

El **contexto** es la "memoria a corto plazo" del modelo: la cantidad máxima de tokens (palabras) que puede procesar a la vez.

| Tamaño | RAM Requerida | Para... |
|--------|---------------|---------|
| 4096 | 8 GB | Ordenadores básicos |
| 8192 | 16 GB | **Recomendado** |
| 32768+ | 32 GB+ | Mac M-series, GPUs dedicadas |

::: tip 💡 El sistema RAG al rescate
No necesitas un contexto enorme para reuniones largas. AIRecorder usa el sistema RAG para buscar solo los **5 fragmentos más relevantes** de la transcripción y enviárselos a la IA. Así puedes consultar reuniones de horas con muy poca RAM.
:::

Usa el botón **"Detectar"** en Ajustes para que AIRecorder configure automáticamente el valor óptimo según tu hardware.

---

## Ver también

- [IA en la Nube](/guide/cloud-ai) — OpenAI, Gemini, Kimi y DeepSeek
- [Conexiones OpenAI Personalizadas](/guide/custom-ai) — Cualquier endpoint compatible con OpenAI
- [Añadir Contenido](/guide/recording) — Los 4 métodos de importación
- [Sistema RAG](/reference/rag) — Cómo funciona la búsqueda semántica
- [Ajustes](/guide/settings) — Todas las opciones de configuración
