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
| `chatSystemPrompt(transcription, lang, docContext)` | System | System prompt del chat interactivo (incluye instrucciones de timestamps `[TS: \| MM:SS]`) |

El contenido de usuario (transcripción, resumen, etc.) siempre se pasa **por separado** como segundo argumento de `_callAiProvider` o como `prompt` en `callProvider` con `options.systemPrompt`.

### Reglas Críticas al Modificar Prompts
1.  **Idioma dinámico:** Usar `langName(lang)` para que el idioma respete la configuración del usuario.
2.  **Formato de Puntos Clave:** El prompt de puntos clave **DEBE EXIGIR** estrictamente el formato:
    `--|-- N --|-- texto del punto`
    *(Cualquier alteración romperá el parsing de la UI).*
3.  **JSON estricto:** Para prompts que devuelven JSON, indicar explícitamente que no incluya markdown ni bloques de código.
4.  **Sin LaTeX en resúmenes:** Los prompts de resumen deben pedir texto Markdown plano, sin notación matemática inline como `$\\rightarrow$`.

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

## 4.5 Timestamps Navegables en el Chat (Enlaces Clicables)

### ¿Qué son?

Cuando la IA menciona un momento específico de una grabación o proyecto (ej: "en el minuto 3:45"), puede usar un formato especial que el frontend convierte en **botones clicables** que navegan directamente a ese punto en el audio, sin reproducir.

### Formato para la IA

**Grabación individual:**
```
[TS: | MM:SS]
Ejemplo: "Esto se discutió [TS: | 03:45] cuando se habló del presupuesto."
```

**Proyecto (múltiples grabaciones):**
```
[TS: recordingId | MM:SS | "Título de la reunión"]
Ejemplo: "Fue decidido en [TS: 45 | 12:30 | "Daily standup"] que comenzaría mañana."
```

El `recordingId` es el identificador numérico de la grabación. El frontend lo usa para saber cuál grabación abrir.

### Instrucciones en los Prompts

Cada system prompt ya incluye instrucciones para que la IA use este formato:

- **`ragSystemPrompt()`** (Regla #8): Instrucciones para grabaciones individuales — usar `[TS: | MM:SS]`
- **`projectRagSystemPrompt()`** (Regla #7): Instrucciones para proyectos — usar `[TS: recordingId | MM:SS | "título"]`
- **`chatSystemPrompt()`**: Instrucciones para modo clásico sin RAG — usar `[TS: | MM:SS]`

#### Cómo funciona el contexto para proyectos

En `projectAiService.js`, cada chunk de transcripción incluye:
```js
{
  textDisplay: "...",
  startTime: 120,      // segundos
  recordingTitle: "Daily standup",
  recordingId: 45      // ← Nuevo: necesario para la IA
}
```

El prompt etiqueta cada fragmento así:
```
[Reunión: "Daily standup" · id:45 · 12:30 - 15:45]
Texto del fragmento...
```

Esto permite a la IA saber qué ID corresponde a cada reunión cuando menciona timestamps.

### Cómo el Frontend Procesa los Timestamps

**1. Detección en nodos de texto (`ChatInterface.jsx`)**

El parser NO toca el Markdown — deja el texto tal cual. En el render, `processChildren()` recorre los nodos de texto de cada `<p>`, `<li>`, `<strong>` y `<em>`, detecta timestamps con un regex unificado y los sustituye por botones React directamente.

El regex unificado (`TS_REGEX`) detecta 4 patrones:
```js
/\[TS:\s*([^|\]]*?)\s*\|\s*(\d{1,2}:\d{2}(?::\d{2})?)\s*[-–]\s*(\d{1,2}:\d{2}(?::\d{2})?)\s*(?:\|\s*"?([^"\]]+?)"?)?\]|\[TS:\s*([^|\]]*?)\s*\|\s*(\d{1,2}:\d{2}(?::\d{2})?)\s*(?:\|\s*"?([^"\]]+?)"?)?\]|\*{0,2}\[(\d{1,2}:\d{2}(?::\d{2})?)\s*[-–]\s*(\d{1,2}:\d{2}(?::\d{2})?)\]\*{0,2}|(?<!\()\[(\d{1,2}:\d{2}(?::\d{2})?)\](?!\()/g
```

Conversiones (el texto Markdown queda intacto, los timestamps se transforman en botones inline):
- `[TS: | 0:44:11 - 0:44:28]` → botón `⏱ 0:44:11 – 0:44:28`
- `[TS: 45 | 12:30 | "Daily standup"]` → botón `⏱ Daily standup · 12:30`
- `[TS: | 03:45]` → botón `⏱ 03:45`
- `**[0:08:06 - 0:08:44]**` → botón `⏱ 0:08:06 – 0:08:44`
- `[3:45]` → botón `⏱ 3:45`

**2. Flujo al pulsar un timestamp**

```
Clic en botón ⏱ 03:45 (sin recId → grabación actual)
    ↓
ChatInterface.renderTextWithTimestamps → onSeekToTime(segundos)
    ↓
TranscriptionChatTab.handleSeek(segundos)  ← misma función que usa la transcripción
    ↓
playerRef.current.seekTo(segundos) + TranscriptionViewer scrollea
    ↓
Audio posicionado + texto resaltado

Clic en botón ⏱ 12:30 (con recId → otra grabación en proyecto)
    ↓
ChatInterface → onNavigateToRecording(recId, "12:30")
    ↓
App.jsx navega a esa grabación con el timestamp
    ↓
RecordingDetailWithTranscription recibe initialTimestamp, cambia a tab transcription
    ↓
TranscriptionChatTab ejecuta seekTo con reintentos (player puede no estar listo)
```

### Conversión de Timestamps

El formato `MM:SS` (o `H:MM:SS`) se convierte a segundos para el player:

```js
function parseTimestampToSeconds(ts) {
  // "03:45" → 225 segundos
  // "1:23:45" → 5025 segundos
  const parts = ts.split(':').map(Number);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}
```

### Vuelta Automática al Proyecto

Cuando navegas desde un chat de proyecto a una grabación específica:

1. `App.jsx` guarda `originView: 'project-detail'` en el objeto recording
2. El botón "← Volver" en `RecordingDetail` lo detecta
3. En vez de ir al Home, vuelve a `ProjectDetail` automáticamente

Esto mantiene el flujo de trabajo dentro del contexto del proyecto.

### Limitaciones y Consideraciones

- **Sincronización de IDs:** El `recordingId` que menciona la IA debe coincidir exactamente con el de la BD. El prompt incluye `· id:X` en cada fragmento para que la IA sepa qué ID usar.
- **Formato flexible:** Si la IA escribe `[TS: 45|03:45]` sin espacios, el regex aún la detecta (soporta espacios opcionales).
- **Solo para menciones explícitas:** Esta característica solo se activa cuando la IA menciona un timestamp de forma explícita en el formato esperado.

## 4. El Flujo de Análisis de IA Secuencial

Cuando el usuario hace clic en "Analizar Grabación" (desde `RecordingDetail.jsx`), el frontend ejecuta un flujo secuencial:

1.  **Extracción de texto:** Obtiene la transcripción pura del backend.
2.  **Detección de tamaño:** Si la transcripción supera `CHUNK_SIZE` caracteres, aplica Map-Reduce:
    - **Map:** Divide en fragmentos y genera un resumen parcial por fragmento (system: `detailedSummaryPrompt` + nota de parte X/N, user: el fragmento).
    - **Reduce:** Si los resúmenes parciales también superan el límite, los consolida (system: `consolidateSummaryPrompt`, user: resúmenes combinados).
3.  **Resumen breve + Puntos clave** en paralelo (via `Promise.all`), usando el resumen detallado como contexto.
4.  **Participantes** (system: instrucciones + suffix, user: texto a analizar).
5.  **Ensamblaje y guardado** en `analysis/ai_summary.json` vía `window.electronAPI.saveAiSummary()`.