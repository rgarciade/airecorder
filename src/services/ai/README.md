# 🤖 Integración de IA y Prompts (AIRecorder)

Este directorio maneja todo el enrutamiento y la generación de contenido a través de diferentes Modelos de Lenguaje Grandes (LLMs).

## 1. Arquitectura de Proveedores (El Router)

Para evitar atar el código de la interfaz a una API de IA específica, el sistema utiliza un **Patrón de Enrutador** (`providerRouter.js`).

*   **Proveedores disponibles:** Gemini (`geminiProvider.js`), Ollama (`ollamaProvider.js`), DeepSeek (`deepseekProvider.js`), Kimi (`kimiProvider.js`), LM Studio (`lmStudioProvider.js`), y conexiones OpenAI personalizadas (`customOpenAIProvider.js`).
*   **Flujo:** React llama directamente a las APIs de IA usando las claves guardadas en los `Settings`. `providerRouter.js` selecciona el proveedor activo basado en `settings.aiProvider`. Los valores con prefijo `custom:{id}` se resuelven a partir de `settings.customConnections`.
*   **Cómo añadir un nuevo proveedor:** Crea un archivo `nuevoProvider.js` con dos tipos de funciones:
    1. `sendToNuevo(textContent, modelOverride, systemPrompt)` — para análisis/resúmenes con system prompt separado.
    2. `chatCompletionStreaming(messages, onChunk, modelOverride)` — para chat nativo con historial (array de mensajes OpenAI-compatible).
    Añádelo a los tres `switch` en `providerRouter.js`: `_runCallProvider` (para análisis), `_runCallProviderStreaming` (para streaming) y `_runCallChatProviderStreaming` (para chat).

### Conexiones OpenAI personalizadas

El archivo `customOpenAIProvider.js` expone la clase `CustomOpenAIProvider`, instanciada con `{baseUrl, apiKey, model}`. Implementa los mismos métodos que los proveedores locales:

| Método | Uso |
|--------|-----|
| `sendMessage(prompt, systemPrompt)` | Análisis / resúmenes |
| `sendMessageStreaming(prompt, onChunk, systemPrompt)` | Chat streaming con prompt simple |
| `chatCompletionStreaming(messages, onChunk)` | Chat nativo con historial de mensajes |
| `listModels()` | Lista modelos desde `GET /v1/models` |

El router usa `isCustom(provider)` y `resolveCustomConnection(settings, provider)` para detectar el prefijo `custom:` y resolver la conexión. Si el `id` no existe, devuelve un error seguro sin crashear. Los proveedores integrados siguen funcionando sin cambios.

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
| `taskImprovementUserContent(title, content, context, userInstructions)` | User | Tarea + instrucciones del usuario + contexto a mejorar |
| `projectAnalysisSystemPrompt(lang)` | System | Instrucciones para análisis de proyecto |
| `chatSystemPrompt(transcription, lang, docContext)` | System | System prompt del chat interactivo (incluye instrucciones de timestamps `[TS: \| MM:SS]`) |
| `conversationNormalizationPrompt(rawContent)` | Full Prompt | Normaliza un transcript crudo (cualquier formato) al JSON canónico de segmentos para importación de conversaciones |

El contenido de usuario (transcripción, resumen, etc.) siempre se pasa **por separado** como segundo argumento de `_callAiProvider` o como `prompt` en `callProvider` con `options.systemPrompt`.

> **Nota sobre `conversationNormalizationPrompt`:** A diferencia de los demás prompts de esta tabla, este es un prompt completo (instrucciones + contenido en un único string). No usa la separación System/User — el `rawContent` ya va embebido dentro del mismo prompt. El formato de salida esperado es:
> ```json
> { "segments": [{ "id": 0, "start": 0.0, "end": 3.0, "speaker": "Nombre", "text": "...", "source": "conversation-import" }] }
> ```
> Si `JSON.parse` falla en el caller (`handleImportConversation` en `Home.jsx`), se usa un segmento de fallback con el texto crudo completo. El campo `source: "conversation-import"` distingue estos segmentos de los generados por Whisper.

### Prompt Builder de Note Templates (`src/prompts/common/templatePrompts.js`)

`templatePrompts.js` centraliza la construcción de prompts para notas por plantilla y expone:

- `buildTemplateSystemPrompt(template, lang, specialtyPrompt)` — genera el system prompt con reglas de formato por tipo de sección, idioma obligatorio y política de campos requeridos/opcionales.
- `buildTemplateUserContent(transcript, existingSummary)` — arma el contenido de usuario con resumen previo (si existe) + transcripción completa.

Este builder se usa exclusivamente por `src/services/noteTemplateService.js`.

### Prompt para Wiki Inicial (`src/prompts/common/wikiPrompts.js`)

Se agregó `wikiStarterPagePrompt(projectName, analysisContent, language)` para generar la primera página de Wiki de un proyecto.

- **Cuándo se usa:** al abrir la pestaña Wiki por primera vez si el proyecto no tiene páginas y existe `projects_analysis/{projectId}.json`.
- **Inputs:**
  - `projectName`: nombre del proyecto
  - `analysisContent`: JSON de análisis del proyecto (persistido previamente)
  - `language`: idioma de UI (`es` / `en`)
- **Output esperado:** string en Markdown (sin JSON ni bloques de código) para persistir como página “Resumen del proyecto” / “Project summary”.

### Bundle size (NFR-WIKI-004)

Medición de referencia (build de producción con `npm run build`, 2026-06-14):

- `dist/assets/index-BG7mzrvb.js`: **660.69 kB gzip**
- `dist/assets/index-C3wqrVIJ.css`: **57.78 kB gzip**

Para la feature Wiki:

- `@uiw/react-md-editor` quedó empaquetado dentro del chunk JS principal (no se generó chunk lazy específico).
- Con este empaquetado, no se puede demostrar un delta aislado < 100 kB gzip para Wiki.
- Estado NFR-WIKI-004: **no verificado / potencial incumplimiento** hasta aplicar lazy-loading real del editor y volver a medir.

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

## 5. Plantillas de Notas (Note Templates)

Sistema de generación de notas estructuradas basadas en plantillas predefinidas o personalizadas. El flujo reutiliza el sistema de providers existente y los prompts de expertos.

El orquestador frontend de este flujo es `src/services/noteTemplateService.js`, que coordina la carga de plantilla, recuperación de contexto (transcripción + resumen AI), construcción de prompts, llamada al proveedor y persistencia final de la nota.

### Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                    NoteTemplateService                      │
│                   (src/services/noteTemplateService.js)      │
└─────────────────────┬───────────────────────────────────────┘
                      │
          ┌───────────┴───────────┐
          │                       │
    callProvider()         Provider Router
    (analysis mode)        (providerRouter.js)
          │                       │
          │              ┌────────┴────────┐
          │              │                 │
    templatePrompts.js   Gemini   Ollama   DeepSeek
          │              (cloud)   (local)  (cloud)
          │
    Expert Prompts
    (aiPrompts.js)
```

### Flujo de Generación

1. **Usuario selecciona plantilla** → `NoteTemplateModal` permite elegir entre plantillas predefinidas o personalizadas.
2. **Carga de plantilla** → Se obtiene la plantilla via IPC `templates:getBySlug`.
3. **Construcción de prompt** → `templatePrompts.js` construye el prompt dinámico según las secciones de la plantilla:
   - Cada sección tiene `type` (text, list, checklist, table, qa, summary, action_items, custom) y `instructions`.
   - El prompt pide al LLM devolver un JSON con el contenido de cada sección.
4. **Selección de experto** → Se usa el `expert_id` de la plantilla (ej. `general`, `developer`) para cargar el system prompt del experto desde `aiPrompts.js`.
5. **Llamada al provider** → Se usa `callProvider()` (modo análisis) con el prompt construido + el system prompt del experto.
6. **Parseo y guardado** → El contenido se parsea desde JSON a Markdown y se guarda en `recording_notes` via IPC `templates:saveNote`.

### Prompt Builder (`src/prompts/common/templatePrompts.js`)

Construye prompts dinámicos basados en la estructura de la plantilla:

```js
// Ejemplo de secciones con tipos
const sections = [
  { id: "yesterday", title: "Yesterday", type: "list", instructions: "What was accomplished yesterday?", required: true },
  { id: "today", title: "Today", type: "list", instructions: "What will be done today?", required: true },
  { id: "blockers", title: "Blockers", type: "text", instructions: "Any blockers or impediments?", required: false }
];

// El prompt pediría:
/*
Genera notas en JSON con las siguientes secciones:
- yesterday (type: list): What was accomplished yesterday?
- today (type: list): What will be done today?
- blockers (type: text, optional): Any blockers?

Devuelve JSON con keys: yesterday, today, blockers (si blockers no aplica, null)
*/
```

### Sección de Tipos de Plantilla

| Tipo | Descripción | Uso típico |
|------|-------------|------------|
| `standup` | Daily standup: Yesterday/Today/Blockers | Reuniones diarias de equipo |
| `one-on-one` | 1:1 Meeting: Logros, preocupaciones, acciones | Reuniones 1:1 con manager |
| `customer-interview` | Entrevista cliente: Pain points, citas, JTBD, next steps | Descubrimiento de cliente |
| `sales-discovery` | Discovery comercial: BANT, objeciones, próximo paso | Calificación de oportunidades |
| `daily-journal` | Diario personal: Mood, gratitud, focos | Reflexión personal |
| `lecture-notes` | Notas de clase: Temas, definiciones, ejemplos, preguntas | Estudio |
| `brainstorm` | Brainstorm: Idea pool, temas, top picks, risks | Sesiones de ideación |
| `custom` | Plantilla personalizada | Creada por el usuario |

### Integración con Expertos

Cada plantilla especifica un `expert_id` que se usa para cargar el system prompt del experto correspondiente. Por ejemplo:
- Plantilla `standup` → `expert_id: 'developer'` → usa `developerSystemPrompt()` de `aiPrompts.js`
- Plantilla `daily-journal` → `expert_id: 'general'` → usa el prompt base general

Esto permite que las notas generadas respeten el contexto y tono del experto activo.

### Internacionalización (i18n)

Las traducciones de la UI de plantillas están en `src/i18n/locales/{es,en}.json` bajo la clave `templates`:
- `templates.modal.*` — Modal de selección de plantilla
- `templates.tab.*` — Pestaña de notas en RecordingDetail
- `templates.actions.*` — Acciones sobre notas (editar, exportar, copiar, eliminar)
- `templates.settings.*` — Página de gestión de plantillas
- `templates.editor.*` — Editor de plantilla (crear/editar)
- `templates.builtin.*` — Metadatos de plantillas predefinidas
