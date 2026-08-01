/**
 * Utilidades internas compartidas por los comandos de chat de esta carpeta.
 *
 * NO forma parte del mapa público `commands/index.js` — es un módulo de soporte
 * consumido solo por los `*Command.js` de este directorio, para no duplicar en
 * cada uno el mismo boilerplate de "llamar a la IA en modo análisis" / "serializar
 * el historial" / "construir una entrada de historial V2".
 */

import { callProvider } from '../../ai/providerRouter';
import { mapHistoryToMessages } from '../../../prompts/common/ragPrompts';
import { serializeHistoryForPrompt } from '../chatHistory';

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
