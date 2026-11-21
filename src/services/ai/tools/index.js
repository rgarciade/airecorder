/**
 * Punto de entrada público del function-calling nativo (tools) usado durante la
 * conversación NORMAL del chat — mismo rol que `src/services/chat/commands/index.js`
 * para comandos de chat. Agrega el catálogo de TODOS los topics de tools
 * registrados y expone el dispatcher genérico + los traductores de formato por
 * proveedor.
 *
 * Añadir un topic de tools nuevo:
 * 1. Crear `<nombre>Tools.js` en esta carpeta exportando su catálogo
 *    `<NOMBRE>_TOOLS` (array `{name, description, parameters}`) y su mapa de
 *    handlers `<NOMBRE>_TOOL_HANDLERS` (`{[name]: async (args, toolContext) => result}`).
 * 2. Importarlo aquí y agregarlo al spread de `ALL_TOOLS` y `TOOL_HANDLERS`.
 * No hace falta tocar `providerRouter.js` ni los call sites en
 * `RecordingDetailWithTranscription.jsx`/`ProjectDetail.jsx` — ambos ya consumen
 * `ALL_TOOLS` completo.
 *
 * `executeTool` vs `executeConfirmedAction` — separación estructural propose/
 * execute (ver docstring de `taskTools.js` para el bug real que la motivó):
 * `executeTool` es lo único que alcanza el loop de tool-calling que consume la
 * IA (`_runToolCallingLoop` en `providerRouter.js`) — para tools de mutación
 * (`create_task`/`update_task`/`delete_task`) SIEMPRE devuelve una propuesta,
 * nunca ejecuta. `executeConfirmedAction` es un dispatcher SEPARADO que solo
 * llaman los click handlers de la UI (`handleResolvePendingAction` en
 * `RecordingDetailWithTranscription.jsx`/`ProjectDetail.jsx`) tras un click
 * real de confirmación del usuario — la IA no tiene ninguna vía para
 * alcanzarlo.
 */

import { TASK_TOOLS, TASK_TOOL_HANDLERS, TASK_TOOL_CONFIRMED_EXECUTORS } from './taskTools';
import { INTERACTION_TOOLS, INTERACTION_TOOL_HANDLERS } from './interactionTools';

/** Catálogo agregado de TODOS los topics de tools registrados (tareas + interacción genérica). */
export const ALL_TOOLS = [...TASK_TOOLS, ...INTERACTION_TOOLS];

/** Mapa de dispatch agregado de todos los topics — agregar futuros topics acá. */
const TOOL_HANDLERS = { ...TASK_TOOL_HANDLERS, ...INTERACTION_TOOL_HANDLERS };

/**
 * Mapa de ejecutores CONFIRMADOS agregado de todos los topics que tengan
 * mutaciones reales — hoy solo "tareas" (`taskTools.js`). `ask_user`
 * (`interactionTools.js`) no necesita entrada acá: nunca muta nada, los call
 * sites ya lo manejan aparte re-inyectando la opción elegida como mensaje del
 * usuario, sin pasar por `executeConfirmedAction`.
 */
const CONFIRMED_EXECUTORS = { ...TASK_TOOL_CONFIRMED_EXECUTORS };

/**
 * Ejecuta una función del catálogo `ALL_TOOLS` con los argumentos ya parseados
 * desde el tool call del proveedor activo.
 *
 * NUNCA lanza — cualquier fallo (IPC, función desconocida, argumentos inválidos)
 * se traduce a `{error, message}`, que el loop de `providerRouter.js` reenvía tal
 * cual a la IA como resultado de la función. Los handlers individuales (ver
 * `taskTools.js`) ya tienen su propia red de errores interna para sus propios
 * fallos esperados (IPC, argumentos inválidos) — este try/catch es la red final
 * para cualquier excepción inesperada que se les escape.
 *
 * @param {string} name - Nombre de la función (ej. `find_tasks`|`create_task`|`update_task`|`delete_task`)
 * @param {Object} args - Argumentos ya parseados (objeto JS, no string)
 * @param {{scope:'recording'|'project', recordingId?:number, projectId?:string}} toolContext
 * @returns {Promise<Object>}
 */
export async function executeTool(name, args, toolContext) {
  const handler = TOOL_HANDLERS[name];
  if (!handler) {
    return { error: 'unknown_function', message: `Unknown function: ${name}` };
  }

  try {
    return await handler(args, toolContext);
  } catch (err) {
    // Red de seguridad final: ningún error interno inesperado debe romper el
    // loop de tool-calling ni la conversación.
    console.error('[tools] Error inesperado ejecutando función:', name, err);
    return { error: 'execution_failed', message: err?.message || 'Unexpected error executing the function.' };
  }
}

/**
 * Ejecuta de verdad una mutación previamente PROPUESTA por `executeTool` (ver
 * separación estructural propose/execute documentada en `taskTools.js`). Solo
 * lo llama el código de página (`handleResolvePendingAction` en
 * `RecordingDetailWithTranscription.jsx`/`ProjectDetail.jsx`), nunca el loop
 * de tool-calling que consume la IA — no hay forma de que un modelo alcance
 * este dispatcher.
 *
 * @param {string} toolName - Nombre de la función original que generó la propuesta (`create_task`|`update_task`|`delete_task`).
 * @param {Object} toolArgs - Los datos YA RESUELTOS del `pendingAction` (`proposed`/`task`), no argumentos crudos de la IA.
 * @param {{scope:'recording'|'project', recordingId?:number, projectId?:string}} toolContext
 * @returns {Promise<Object>}
 */
export async function executeConfirmedAction(toolName, toolArgs, toolContext) {
  const executor = CONFIRMED_EXECUTORS[toolName];
  if (!executor) {
    return { error: 'unknown_function', message: `No confirmed executor for: ${toolName}` };
  }

  try {
    return await executor(toolArgs, toolContext);
  } catch (err) {
    console.error('[tools] Error inesperado ejecutando acción confirmada:', toolName, err);
    return { error: 'execution_failed', message: err?.message || 'Unexpected error executing the confirmed action.' };
  }
}

/**
 * Traduce el catálogo agnóstico al formato `tools` estándar OpenAI
 * (`{type:'function', function:{name, description, parameters}}`). Lo reutilizan
 * TODOS los proveedores OpenAI-compatibles: `customOpenAIProvider.js` (OpenAI +
 * conexiones personalizadas), `deepseekProvider.js`, `kimiProvider.js`,
 * `lmStudioProvider.js` y `ollamaProvider.js` (su endpoint `/api/chat` acepta el
 * mismo formato de `tools` desde Ollama ≥ 0.3 — ver README para el detalle de
 * soporte real por proveedor).
 *
 * @param {Array} [catalog]
 * @returns {Array<{type:'function', function:{name:string, description:string, parameters:Object}}>}
 */
export function toOpenAIToolsFormat(catalog = ALL_TOOLS) {
  return catalog.map((fn) => ({
    type: 'function',
    function: {
      name: fn.name,
      description: fn.description,
      parameters: fn.parameters,
    },
  }));
}

/**
 * Traduce el catálogo agnóstico al formato nativo de Gemini:
 * `tools: [{ functionDeclarations: [{name, description, parameters}, ...] }]`.
 *
 * @param {Array} [catalog]
 * @returns {Array<{functionDeclarations: Array}>}
 */
export function toGeminiToolsFormat(catalog = ALL_TOOLS) {
  return [
    {
      functionDeclarations: catalog.map((fn) => ({
        name: fn.name,
        description: fn.description,
        parameters: fn.parameters,
      })),
    },
  ];
}
