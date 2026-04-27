# Plan: Sistema de Expertos (Specialty Mode)

## Objetivo
Convertir AIRecorder en una herramienta multipropósito mediante un "Modo de Especialidad" configurable. El sistema inyecta un prompt base de experto (A) + indicaciones extras por funcionalidad (B) + el prompt de la acción (C) antes de cada llamada a la IA.

---

## Arquitectura General

### Orden de concatenación del payload final
```
[A] Prompt de Especialidad (base del experto activo)
      +
[B] ### REGLAS ESTRICTAS DE FORMATO Y COMPORTAMIENTO: {extra_instructions} ###
      +
[C] Prompt principal de la acción (sin modificar)
```

---

## Cambios por Capa

### 1. Estructura de archivos de prompts

**Antes:**
```
src/prompts/
  aiPrompts.js
  ragPrompts.js
```

**Después:**
```
src/prompts/
  common/
    summaryPrompts.js      # detailedSummaryPrompt, shortSummaryPrompt, consolidateSummaryPrompt
    keyPointsPrompts.js    # keyPointsPrompt, pointDefinition
    taskPrompts.js         # taskSuggestionsPrompt, taskImprovementSystemPrompt, etc.
    chatPrompts.js         # chatSystemPrompt, chatQuestionPrompt
    participantPrompts.js  # participantsPrompt
    projectPrompts.js      # projectAnalysisSystemPrompt
    ragPrompts.js          # sin cambios, movido desde raíz
    utils.js               # langName helper
  experts/
    developer.js           # prompt de especialidad: Programador (el comportamiento actual)
    psychologist.js        # prompt de especialidad: Psicólogo (nuevo)
  promptBuilder.js         # NUEVO: lógica A+B+C
  index.js                 # re-exports de backward compat (mantiene imports existentes válidos)
```

**Nota:** `index.js` re-exporta todo desde `common/` para no romper los imports existentes en `recordingAiService.js` y `projectAiService.js`.

---

### 2. Base de datos — Nueva tabla

**Archivo:** `electron/database/queries.js`

```sql
CREATE TABLE IF NOT EXISTS expert_customizations (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  expert_id    TEXT NOT NULL,   -- 'developer' | 'psychologist' | ...
  feature      TEXT NOT NULL,   -- 'short_summary' | 'long_summary' | 'key_points' | 'chat' | 'tasks' | 'specialty_base'
  instructions TEXT NOT NULL DEFAULT '',
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_expert_customizations
  ON expert_customizations(expert_id, feature);
```

**`feature = 'specialty_base'`** permite que el usuario edite el prompt base del experto sin tocar el código fuente (las modificaciones van a BD; el archivo `.js` del experto es el original de fábrica).

**Archivo:** `electron/database/dbService.js` — agregar `expert_customizations` al método `init()`.

---

### 3. IPC Handlers — Nuevo archivo

**Archivo:** `electron/ipc-handlers/experts.js`

| Canal IPC | Acción |
|-----------|--------|
| `get-expert-customizations` | Recibe `expertId`, devuelve objeto `{ feature: instructions }` |
| `save-expert-customization` | Recibe `{ expertId, feature, instructions }`, hace UPSERT en BD |

**Preload:** exponer `getExpertCustomizations(expertId)` y `saveExpertCustomization(data)` en `window.electronAPI`.

**Main:** registrar los handlers del nuevo archivo en `electron/main.js`.

---

### 4. Settings JSON — Nuevo campo

**Archivo:** `src/services/settingsService.js` — agregar a defaults:
```js
activeExpert: 'developer',
```

---

### 5. Nuevo servicio: promptBuilder

**Archivo:** `src/services/ai/promptBuilder.js`

```js
export const FEATURE_TYPES = {
  SHORT_SUMMARY: 'short_summary',
  LONG_SUMMARY:  'long_summary',
  KEY_POINTS:    'key_points',
  CHAT:          'chat',
  TASKS:         'tasks',
}

/**
 * Construye el system prompt final: A + B + C
 * @param {string} featureType  - Constante de FEATURE_TYPES
 * @param {string} basePrompt   - El prompt C (acción actual)
 * @param {string} lang         - Código de idioma
 * @returns {Promise<string>}   - System prompt completo
 */
export async function buildSystemPrompt(featureType, basePrompt, lang) {
  const settings = await getSettings();
  const expertId = settings.activeExpert || 'developer';

  // A: Prompt de especialidad
  const expertModule = expertsMap[expertId];
  const customizations = await window.electronAPI.getExpertCustomizations(expertId);
  const specialtyBase = customizations['specialty_base']?.trim()
    || expertModule.getSpecialtyPrompt(lang);  // fallback al .js original

  // B: Indicaciones extras para esta feature
  const extraInstructions = customizations[featureType]?.trim() || '';

  // Ensamblar A + B + C
  let result = specialtyBase;
  if (extraInstructions) {
    result += `\n\n### REGLAS ESTRICTAS DE FORMATO Y COMPORTAMIENTO:\n${extraInstructions}\n###`;
  }
  result += `\n\n${basePrompt}`;

  return result;
}
```

---

### 6. Modificaciones en servicios de IA

**Archivo:** `src/services/recordingAiService.js`

Reemplazar cada llamada a `_callAiProvider(xPrompt(lang), content)` para que el system prompt pase por `buildSystemPrompt`:

| Acción | Feature type |
|--------|-------------|
| `detailedSummaryPrompt` | `LONG_SUMMARY` |
| `shortSummaryPrompt` | `SHORT_SUMMARY` |
| `keyPointsPrompt` | `KEY_POINTS` |
| `taskSuggestionsPrompt` | `TASKS` |
| `taskImprovementSystemPrompt` | *(sin cambio — es una mejora interna, no user-facing)* |
| `participantsPrompt` | *(sin cambio — extracción técnica, no afectada por experto)* |

El método `_callAiProvider` interno recibe el system prompt ya construido; la firma interna no cambia.

**Archivo:** `src/services/projectAiService.js`

- `_generateProjectAnalysis` → envolver `projectAnalysisSystemPrompt(lang)` con `buildSystemPrompt(LONG_SUMMARY, ...)`.
- Chat (RAG/classic) → inyectar el prompt de especialidad como primer mensaje `system` del array antes de llamar a `callChatProviderStreaming`.

**Archivo:** `src/pages/RecordingDetail/RecordingDetailWithTranscription.jsx`

- En `handleSendQuestion` (chat de grabación), el `ragSystemPrompt`/`chatSystemPrompt` se pasa por `buildSystemPrompt(FEATURE_TYPES.CHAT, ...)` antes de armar el array de mensajes.

---

### 7. Interfaz de Ajustes — Nueva sección "Expertos"

**Archivo:** `src/pages/Settings/Settings.jsx` (o componente dedicado extraído)

**Nueva pestaña:** "Expertos" (ícono: `MdPsychology` o `MdAutoAwesome`)

**Estructura de la UI:**

```
┌─────────────────────────────────────────────────────┐
│  MODO DE ESPECIALIDAD                                │
│                                                      │
│  Selecciona cómo quieres que la IA interprete        │
│  y procese las grabaciones.                          │
│                                                      │
│  ┌──────────────┐  ┌──────────────┐                 │
│  │ 💻            │  │ 🧠           │                 │
│  │ Programador  │  │ Psicólogo    │                 │
│  │ (activo)     │  │              │                 │
│  └──────────────┘  └──────────────┘                 │
│                                                      │
├─────────────────────────────────────────────────────┤
│  INDICACIONES EXTRAS — Programador                   │
│  Estas instrucciones se inyectan con máxima          │
│  prioridad en cada funcionalidad.                    │
│                                                      │
│  [Resumen Corto] [Resumen Largo] [Puntos Clave]      │
│  [Chat]          [Tareas]                            │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │                                                │  │
│  │  (textarea amplio con placeholder explicativo) │  │
│  │                                                │  │
│  └────────────────────────────────────────────────┘  │
│  💡 Ejemplo: "Prioriza siempre las decisiones        │
│     técnicas sobre las de negocio."                  │
│                                                      │
├─────────────────────────────────────────────────────┤
│  PROMPT BASE DEL EXPERTO                             │
│  Modifica el comportamiento base del experto         │
│  seleccionado. Dejar vacío usa el comportamiento     │
│  predeterminado de fábrica.                          │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │                                                │  │
│  │  (textarea con el prompt base actual)          │  │
│  │                                                │  │
│  └────────────────────────────────────────────────┘  │
│  [ Restaurar predeterminado ]        [ Guardar ]     │
└─────────────────────────────────────────────────────┘
```

**Componente:** `src/pages/Settings/ExpertsTab.jsx` (separado para no inflar `Settings.jsx`)

**Estado local del tab:**
- `selectedExpert`: el experto cuyas indicaciones se están editando (puede diferir del activo)
- `customizations`: objeto `{ feature: instructions }` cargado de BD al seleccionar experto
- `activeExpert`: guardado en `settings.json` al hacer clic en la card

**Guardado:** auto-save con debounce de 800ms por textarea, o botón "Guardar" explícito.

---

### 8. i18n

Agregar claves en `src/i18n/locales/es.json` y `en.json` para:
- Tab "Expertos"
- Labels de las 5 features
- Hints/placeholders de cada textarea
- Nombres de expertos

---

## Orden de Implementación

1. **DB**: Agregar tabla `expert_customizations` + método en `dbService.js`
2. **IPC**: Crear `electron/ipc-handlers/experts.js` + registrar en `main.js` + exponer en `preload.js`
3. **Prompts**: Crear estructura `src/prompts/common/` + `src/prompts/experts/` + mover archivos + `index.js` de re-exports
4. **promptBuilder**: Crear `src/services/ai/promptBuilder.js`
5. **recordingAiService**: Integrar `buildSystemPrompt` en los 4 puntos de llamada
6. **projectAiService + chat UI**: Integrar en chat y análisis de proyecto
7. **Settings defaults**: Agregar `activeExpert: 'developer'` en `settingsService.js`
8. **UI**: Crear `ExpertsTab.jsx` + agregarlo a `Settings.jsx`
9. **i18n**: Agregar claves de traducción

---

## Archivos que NO cambian
- `src/services/ai/providerRouter.js` — sin cambios
- `src/services/ai/aiQueueService.js` — sin cambios
- Todos los proveedores individuales — sin cambios
- `electron/database/dbService.js` — solo agregar creación de la nueva tabla en `init()`
