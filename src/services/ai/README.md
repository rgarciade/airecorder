# 🤖 Integración de IA y Prompts (AIRecorder)

Este directorio maneja todo el enrutamiento y la generación de contenido a través de diferentes Modelos de Lenguaje Grandes (LLMs).

## 1. Arquitectura de Proveedores (El Router)

Para evitar atar el código de la interfaz a una API de IA específica, el sistema utiliza un **Patrón de Enrutador** (`providerRouter.js`).

*   **Proveedores disponibles:** Gemini (`geminiProvider.js`), Ollama (`ollamaProvider.js`), DeepSeek (`deepseekProvider.js`), Kimi (`kimiProvider.js`), LM Studio (`lmStudioProvider.js`).
*   **Flujo:** React llama directamente a las APIs de IA usando las claves guardadas en los `Settings`. `providerRouter.js` selecciona el proveedor activo basado en `settings.aiProvider`.
*   **Cómo añadir un nuevo proveedor:** Crea un archivo `nuevoProvider.js` con dos tipos de funciones:
    1. `sendToNuevo(textContent, modelOverride, systemPrompt)` — para análisis/resúmenes con system prompt separado.
    2. `chatCompletionStreaming(messages, onChunk, modelOverride)` — para chat nativo con historial (array de mensajes OpenAI-compatible).
    Añádelo a los dos `switch` en `providerRouter.js`: `_runCallProvider` (para análisis) y `_runCallChatProviderStreaming` (para chat).

## 2. Los Prompts y Plantillas (`src/prompts/aiPrompts.js`)

**Todo el comportamiento del LLM está definido en `src/prompts/aiPrompts.js`.**

### Separación System Prompt / User Content

Las llamadas únicas (resúmenes, tareas, participantes, etc.) usan **system prompt separado del contenido de usuario**. Esto mejora la adherencia del modelo a las instrucciones.

Cada tarea tiene su propio par de funciones en `aiPrompts.js`:

| Función | Tipo | Descripción |
|---------|------|-------------|
| `shortSummaryPrompt(lang)` | System | Instrucciones para resumen breve |
| `keyPointsPrompt(lang)` | System | Instrucciones para puntos clave |
| `detailedSummaryPrompt(lang)` | System | Instrucciones para resumen detallado |
| `consolidateSummaryPrompt(lang)` | System | Instrucciones para consolidar resúmenes parciales |
| `participantsPrompt(lang)` + `participantsPromptSuffix` | System | Instrucciones para extracción de participantes |
| `taskSuggestionsPrompt(lang)` + `taskSuggestionsPromptSuffix` | System | Instrucciones para sugerencias de tareas |
| `taskImprovementSystemPrompt(lang)` | System | Instrucciones para mejorar una tarea |
| `taskImprovementUserContent(title, content, context)` | User | Tarea + contexto a mejorar |
| `projectAnalysisSystemPrompt(lang)` | System | Instrucciones para análisis de proyecto |
| `chatSystemPrompt(transcription, lang, docContext)` | System | System prompt del chat interactivo |

El contenido de usuario (transcripción, resumen, etc.) siempre se pasa **por separado** como segundo argumento de `_callAiProvider` o como `prompt` en `callProvider` con `options.systemPrompt`.

### Reglas Críticas al Modificar Prompts
1.  **Idioma dinámico:** Usar `langName(lang)` para que el idioma respete la configuración del usuario.
2.  **Formato de Puntos Clave:** El prompt de puntos clave **DEBE EXIGIR** estrictamente el formato:
    `--|-- N --|-- texto del punto`
    *(Cualquier alteración romperá el parsing de la UI).*
3.  **JSON estricto:** Para prompts que devuelven JSON, indicar explícitamente que no incluya markdown ni bloques de código.

## 3. Dos Paradigmas de IA — Análisis vs. Chat

| Tipo | Función pública | Uso |
|------|----------------|-----|
| **Análisis** (Resúmenes, Tareas, Participantes, Proyecto) | `callProvider(userContent, { systemPrompt, ...options })` | System prompt con instrucciones, user content con el texto a procesar. Sin historial. |
| **Chat interactivo** | `callChatProviderStreaming(messages, onChunk, options)` | Array de mensajes `[{role, content}]` usando el protocolo nativo de cada proveedor. Historial completo. |

### Arquitectura de campos de modelo (Ollama y LM Studio)

Cada proveedor local tiene **dos campos de modelo separados** en settings:

| Campo | Uso | Configurable en |
|-------|-----|----------------|
| `ollamaModel` / `lmStudioModel` | **Modelo General** — resúmenes, análisis, tareas, participantes, proyecto | Settings + Onboarding |
| `ollamaRagModel` / `lmStudioRagModel` | **Modelo de Chat** — conversaciones interactivas. Fallback al General si está vacío | Settings + Onboarding (Ollama) |
| `ollamaEmbeddingModel` / `lmStudioEmbeddingModel` | Embeddings para RAG (búsqueda semántica) | Settings + Onboarding |

**Cadena de prioridad para el chat** (`callChatProviderStreaming`):
```
options.model > options.ragModel > settings.ollamaRagModel > settings.ollamaModel
```

**Análisis/resúmenes** (`callProvider`) siempre usan el Modelo General:
```
options.model > settings.ollamaModel
```

Cuando el usuario cambia el modelo desde el dropdown del chat (`handleSessionModelChange`),
se guarda en `ollamaRagModel` / `lmStudioRagModel` — **nunca sobrescribe el Modelo General**.

### Cómo `callProvider` propaga el `systemPrompt` a cada proveedor

| Proveedor | Mecanismo |
|-----------|-----------|
| **Gemini** | Campo `system_instruction: { parts: [{ text }] }` en el body de `generateContent` |
| **Ollama** | Campo `system` en el body de `/api/generate` |
| **DeepSeek** | Mensaje `{ role: 'system', content }` antes del mensaje de usuario |
| **Kimi** | Reemplaza el system genérico hardcodeado por el system prompt específico de la tarea |
| **LM Studio** | Mensaje `{ role: 'system', content }` antes del mensaje de usuario |

### Protocolo de mensajes del Chat (V2)

```js
[
  { role: 'system',    content: 'Eres un asistente...' }, // Instrucciones + contexto RAG/transcripción
  { role: 'user',      content: 'Primera pregunta' },
  { role: 'assistant', content: 'Primera respuesta' },
  { role: 'user',      content: 'Segunda pregunta' },
]
```

Los mensajes nuevos se guardan con `chatVersion: 2`. Si un chat tiene mensajes sin esta marca, `ChatInterface.jsx` muestra un banner de migración.

## 4. El Flujo de Análisis de IA Secuencial

Cuando el usuario hace clic en "Analizar Grabación" (desde `RecordingDetail.jsx`), el frontend ejecuta un flujo secuencial:

1.  **Extracción de texto:** Obtiene la transcripción pura del backend.
2.  **Detección de tamaño:** Si la transcripción supera `CHUNK_SIZE` caracteres, aplica Map-Reduce:
    - **Map:** Divide en fragmentos y genera un resumen parcial por fragmento (system: `detailedSummaryPrompt` + nota de parte X/N, user: el fragmento).
    - **Reduce:** Si los resúmenes parciales también superan el límite, los consolida (system: `consolidateSummaryPrompt`, user: resúmenes combinados).
3.  **Resumen breve + Puntos clave** en paralelo (via `Promise.all`), usando el resumen detallado como contexto.
4.  **Participantes** (system: instrucciones + suffix, user: texto a analizar).
5.  **Ensamblaje y guardado** en `analysis/ai_summary.json` vía `window.electronAPI.saveAiSummary()`.