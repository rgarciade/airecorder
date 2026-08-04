/**
 * Utilidades internas compartidas por los comandos de chat de esta carpeta.
 *
 * NO forma parte del mapa público `commands/index.js` — es un módulo de soporte
 * consumido solo por los `*Command.js` de este directorio, para no duplicar en
 * cada uno el mismo boilerplate de "llamar a la IA en modo análisis" / "serializar
 * el historial" / "construir una entrada de historial V2".
 */

import { callProvider } from '../../ai/providerRouter';
import { mapHistoryToMessages, ragSystemPrompt } from '../../../prompts/common/ragPrompts';
import { serializeHistoryForPrompt } from '../chatHistory';
import { MIN_SUMMARY_HISTORY_MESSAGES } from '../chatTokens';
import ragService from '../../ragService';

/**
 * Llama al proveedor de IA en "modo análisis": concatena system+user en un único
 * prompt y pasa `systemPrompt: null` (máxima compatibilidad con modelos locales que
 * ignoran el campo `system` del payload). Mismo patrón que
 * `chatCompactService.js` (`_callAi`) y `recordingAiService._callAiProvider`.
 *
 * Propaga cualquier rechazo TAL CUAL (incluida `error.cancelled === true`) — el
 * caller decide qué hacer con la cancelación, nunca se envuelve ni se traga aquí.
 *
 * @param {string} systemPrompt
 * @param {string} [userContent]
 * @param {Object} [options] - Opciones para callProvider (model, queueMeta, ...)
 * @returns {Promise<{text: string, provider: string}>}
 */
export function callAiAnalysis(systemPrompt, userContent, options = {}) {
  const prompt = userContent ? `${systemPrompt}\n\n${userContent}` : systemPrompt;
  return callProvider(prompt, { ...options, systemPrompt: null });
}

/**
 * Serializa el historial completo (cualquiera de los 3 formatos internos de
 * AIRecorder) a texto plano legible, listo para incluir como user content en un
 * prompt de análisis. Reutiliza `mapHistoryToMessages` (ya descarta mensajes
 * `⚠️ ...`) — el mismo criterio de "qué se le manda realmente a la IA" que usa
 * el chat en vivo.
 *
 * @param {Array} history
 * @returns {string}
 */
export function serializeChatForPrompt(history) {
  return serializeHistoryForPrompt(mapHistoryToMessages(history));
}

/**
 * Construye una entrada de historial `asistente` con el shape V2 usado en toda
 * la app (`{ id, tipo, contenido, fecha, chatVersion: 2 }`).
 *
 * @param {string} contenido
 * @param {string} [idPrefix]
 * @returns {Object}
 */
export function makeAssistantEntry(contenido, idPrefix = 'cmd') {
  return {
    id: `${idPrefix}_${Date.now()}`,
    tipo: 'asistente',
    contenido,
    fecha: new Date().toISOString(),
    chatVersion: 2,
  };
}

/**
 * Construye una entrada de historial `usuario` con el shape V2 usado en toda la
 * app. Usada por comandos que además de responder registran su propia pregunta
 * visible en el historial (ej. `/buscar <query>`).
 *
 * @param {string} contenido
 * @param {string} [idPrefix]
 * @returns {Object}
 */
export function makeUserEntry(contenido, idPrefix = 'cmd') {
  return {
    id: `${idPrefix}_${Date.now()}`,
    tipo: 'usuario',
    contenido,
    fecha: new Date().toISOString(),
    chatVersion: 2,
  };
}

/**
 * Posts a visible error message to the chat history for a real (non-cancelled) command
 * failure. `/tareas` and `/nota` now run `runsInBackground` (see chatCommands.js), so
 * `useChatCommands.runCommand` no longer awaits their promise nor inspects its return
 * value to show a `commandError` banner in ChatInterface — the ONLY way the user finds
 * out about a real failure is a message left in the chat history itself.
 *
 * @param {Object} ctx - Ver JSDoc de useChatCommands.js (usa getHistory/replaceHistory)
 * @param {string} message - Texto de error ya traducido (t(...))
 * @param {string} [idPrefix]
 * @returns {Promise<void>}
 */
export async function postCommandError(ctx, message, idPrefix = 'cmd_error') {
  const { getHistory, replaceHistory } = ctx;
  const history = getHistory();
  const entry = makeAssistantEntry(`⚠️ **${message}**`, idPrefix);
  await replaceHistory([...history, entry]);
}

// Query RAG genérica usada cuando el usuario no da un foco explícito (`/tareas` o `/nota`
// sin argumentos) y hace falta un fallback RAG — ver `gatherTaskContext`.
export const GENERIC_TASK_QUERY = 'tareas pendientes, decisiones tomadas, action items, próximos pasos';

// Mismo valor que FORCED_TOPK en searchCommand.js ("topK generoso" para una búsqueda puntual).
const TASK_CONTEXT_TOPK = 40;

/**
 * Reúne el mejor contexto disponible para `/tareas` y `/nota`.
 *
 * Prioriza la conversación visible del chat cuando YA tiene contenido suficiente
 * (>= MIN_SUMMARY_HISTORY_MESSAGES) — comportamiento histórico sin cambios cuando el
 * chat sí tiene contenido. Si el chat es nuevo o corto, cae a un fallback RAG sobre la
 * transcripción de la grabación (mismo mecanismo que `runSearch` en searchCommand.js:
 * `ragService.getStatus` → `ragService.search` → `ragSystemPrompt`), usando `args` como
 * query si el usuario dio uno, o una query genérica fija si no. Corrige el bug reportado:
 * en un chat nuevo, `/tareas <instrucciones>` daba "conversación demasiado corta" en vez
 * de generar tareas a partir de la transcripción/RAG de la grabación.
 *
 * Scope 'project': HALLAZGO (verificado) — no existe hoy un mecanismo liviano equivalente
 * para devolver chunks crudos de una grabación específica del proyecto sin pasar por
 * `projectChatService.generateAiResponse` (que genera una respuesta conversacional
 * completa, no contexto crudo reutilizable aquí). Reproducir ese camino requeriría además
 * resolver `chat.contexto` (IDs de grabación del chat activo) vía
 * `projectChatService.getProjectChats(projectId)` y luego buscar chunks por cada
 * grabación — lógica hoy privada dentro de `projectAiService.askProjectQuestion`, no
 * expuesta como una función reutilizable de "solo dame el contexto". No se inventa esa
 * API nueva en este cambio: para 'project' se usa lo que haya en el chat SIN aplicar el
 * umbral de "chat rico" (si hay algo, aunque sea poco, se usa igual — nunca se bloquea
 * preventivamente por longitud de historial).
 *
 * @param {Object} ctx - Ver JSDoc de useChatCommands.js
 * @param {string} [args] - Foco/query opcional del usuario
 * @returns {Promise<{text: string, source: 'chat'|'rag'|'chat+rag'|'none'}>}
 */
export async function gatherTaskContext(ctx, args) {
  const { getHistory, scope, ragRecordingId } = ctx;
  const history = getHistory();
  const serialized = serializeChatForPrompt(history);
  const hasRichChat = Boolean(serialized.trim()) && history.length >= MIN_SUMMARY_HISTORY_MESSAGES;

  if (hasRichChat) {
    return { text: serialized, source: 'chat' };
  }

  // Scope 'project': sin fallback RAG liviano disponible (ver hallazgo en el docstring) —
  // se usa lo que haya en el chat sin exigir el umbral de "chat rico".
  if (scope === 'project') {
    return serialized.trim() ? { text: serialized, source: 'chat' } : { text: '', source: 'none' };
  }

  // Scope 'recording': fallback RAG, mismo mecanismo que runSearch (searchCommand.js).
  if (ragRecordingId) {
    const query = (args || '').trim() || GENERIC_TASK_QUERY;
    try {
      const status = await ragService.getStatus(ragRecordingId);
      if (status?.success && status.indexed) {
        const searchResult = await ragService.search(ragRecordingId, query, TASK_CONTEXT_TOPK);
        if (searchResult?.success && searchResult.chunks?.length) {
          const ragText = ragSystemPrompt(searchResult.chunks);
          return serialized.trim()
            ? { text: `${ragText}\n\n${serialized}`, source: 'chat+rag' }
            : { text: ragText, source: 'rag' };
        }
      }
    } catch (err) {
      // Fallback opcional: si RAG falla (no indexado, IPC no disponible, etc.) no se
      // propaga el error hacia el comando — se cae al camino de "solo lo que haya en
      // el chat" (o 'none' si tampoco hay nada) en vez de romper /tareas o /nota.
      console.error('[gatherTaskContext] Fallback RAG falló:', err);
    }
  }

  return serialized.trim() ? { text: serialized, source: 'chat' } : { text: '', source: 'none' };
}
