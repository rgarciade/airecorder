# 🤖 Integración de IA y Prompts (AIRecorder)

Este directorio maneja todo el enrutamiento y la generación de contenido a través de diferentes Modelos de Lenguaje Grandes (LLMs).

## 1. Arquitectura de Proveedores (El Router)

Para evitar atar el código de la interfaz a una API de IA específica, el sistema utiliza un **Patrón de Enrutador** (`providerRouter.js`).

*   **Proveedores disponibles:** Gemini (`geminiProvider.js`), Ollama (`ollamaProvider.js`), DeepSeek (`deepseekProvider.js`), Kimi, LM Studio, etc.
*   **Flujo:** 
    1. React pide un análisis al backend.
    2. El backend invoca a los proveedores que están en React. (En realidad, el servicio en React llama directamente a las APIs usando las claves guardadas en los `Settings`).
    3. `src/services/aiService.js` delega en `providerRouter.js` para seleccionar el proveedor activo basado en la configuración del usuario (`settings.aiProvider`).
*   **Cómo añadir un nuevo proveedor:** Si necesitas añadir uno nuevo (ej. Claude/Anthropic), debes crear un archivo `nuevoProvider.js` que implemente dos tipos de funciones:
    1. `sendToNuevo(textContent)` — para análisis/resúmenes (Prompt Stuffing clásico).
    2. `chatCompletionStreaming(messages, onChunk, modelOverride)` — para chat nativo con historial (array de mensajes OpenAI-compatible).
    Y añadirlo a los dos `switch` dentro de `providerRouter.js` (`_runCallProvider` para análisis y `_runCallChatProviderStreaming` para chat).

## 2. Los Prompts y Plantillas (`src/prompts/aiPrompts.js`)

**Todo el comportamiento del LLM (su personalidad, su idioma y el formato en el que devuelve los datos) está definido en `src/prompts/aiPrompts.js`.**

### Reglas Críticas al Modificar Prompts
1.  **Siempre en Español:** Las instrucciones deben forzar a la IA a que devuelva todo el texto generado en español.
2.  **Inyección de Texto:** Usa literales de plantilla (template literals) para inyectar el texto de la transcripción en el prompt.
3.  **Formato de Puntos Clave:** Esto es vital. La UI de React hace un "parsing" (análisis) del texto devuelto por la IA para crear elementos visuales en la interfaz. El prompt de los Puntos Clave **DEBE EXIGIR** estrictamente que la IA devuelva cada punto con el formato:
    `--|-- Palabra Clave --|-- Descripción del punto`
    *(Cualquier alteración a esta regla en el prompt romperá la UI).*

## 3. Dos Paradigmas de IA — Análisis vs. Chat

El sistema distingue claramente dos tipos de llamadas a la IA:

| Tipo | Función pública | Uso |
|------|----------------|-----|
| **Análisis** (Resúmenes, Tareas, Participantes) | `callProvider(prompt, options)` | Envía un String gigante con todo el contexto embebido (Prompt Stuffing). Sin historial. |
| **Chat interactivo** (Chat de grabación y proyecto) | `callChatProviderStreaming(messages, onChunk, options)` | Envía un Array de mensajes `[{role, content}]` usando el protocolo nativo de cada proveedor. Historial completo. |

### Protocolo de mensajes del Chat (V2)

Los mensajes siguen el estándar OpenAI:
```js
[
  { role: 'system',    content: 'Eres un asistente...' }, // Instrucciones + contexto RAG/transcripción
  { role: 'user',      content: 'Primera pregunta' },
  { role: 'assistant', content: 'Primera respuesta' },
  { role: 'user',      content: 'Segunda pregunta' },   // Última pregunta del usuario
]
```

Cada proveedor mapea este array a su formato nativo:
- **Ollama:** endpoint `/api/chat` (en lugar de `/api/generate`)
- **Gemini:** `contents` array con `role: 'model'` para asistente + `system_instruction` separado
- **DeepSeek, Kimi, LM Studio:** Formato OpenAI nativo (`/chat/completions`), sin traducción

### Detección de Chats Legacy (V1)

Los mensajes nuevos se guardan con `chatVersion: 2`. Si un chat tiene mensajes pero ninguno tiene esta marca, `ChatInterface.jsx` muestra un banner de migración y deshabilita el input para forzar el reseteo antes de continuar.

## 4. El Flujo de Análisis de IA Secuencial

Cuando el usuario hace clic en "Analizar Grabación" (desde `RecordingDetail.jsx`), el frontend ejecuta un flujo de llamadas para crear el documento final `ai_summary.json`:

1.  **Extracción de texto:** Obtiene la transcripción pura del backend.
2.  **Llamadas Secuenciales:** Ejecuta llamadas independientes (no paralelas, para no colapsar ciertos proveedores locales como Ollama):
    *   Genera un Resumen Detallado.
    *   Genera un Resumen Corto.
    *   Extrae los Puntos Clave.
    *   Extrae los Participantes.
3.  **Ensamblaje y Guardado:** Junta todas las respuestas en un objeto estructurado y llama a `window.electronAPI.saveAiSummary()` para que Electron guarde el JSON resultante en la carpeta `analysis/` de la grabación. Finalmente se actualiza el estado a `analyzed` en la base de datos.