/**
 * Estimación de tokens del chat + umbral de aviso de límite de contexto.
 * Punto único de la heurística chars/token usada por ambos chats (grabación y proyecto).
 */

import { mapHistoryToMessages } from '../../prompts/common/ragPrompts';

// Heurística ya usada en el resto de la app (attachmentsService.js, projectAiService.js, etc.)
export const CHARS_PER_TOKEN = 4;

// Umbral de aviso proactivo: al alcanzar este % de maxContextLength, ContextBar
// muestra "Cerca del límite" + botón Compactar. Punto único de ajuste.
export const CONTEXT_WARNING_RATIO = 0.75;

// Cuántos mensajes recientes deja intactos /compact por defecto (el resto se resume).
// Punto único: chatCompactService.js lo usa como default de `keepRecent` en la guarda
// real, y de él se deriva MIN_COMPACT_HISTORY_MESSAGES para que chatCommands.js valide
// con el mismo umbral que la ejecución real exige (evita que la UI deje intentar /compact
// con menos mensajes de los que compactChatHistory acabará rechazando).
export const DEFAULT_KEEP_RECENT = 4;

// Mínimo de mensajes en el historial para poder ejecutar /compact (debe quedar al menos
// 1 mensaje que resumir además de los `DEFAULT_KEEP_RECENT` que se conservan intactos).
export const MIN_COMPACT_HISTORY_MESSAGES = DEFAULT_KEEP_RECENT + 2;

// Mínimo de mensajes para /resumen (no destructivo). A diferencia de /compact, no está
// atado a `keepRecent` (no descarta nada del historial), así que el umbral es independiente
// y deliberadamente más bajo: solo evita resumir una conversación vacía o de un único mensaje.
// Punto único: chatCommands.js (registro) y summaryCommand.js (ejecución real) importan
// esta misma constante para que la UI nunca deje intentar /resumen con menos mensajes de
// los que la ejecución real acabará rechazando (mismo patrón que MIN_COMPACT_HISTORY_MESSAGES).
export const MIN_SUMMARY_HISTORY_MESSAGES = 2;

// Overhead aproximado por mensaje (delimitadores de rol que cada proveedor añade
// al armar el payload nativo de chat: { role, content }).
const ROLE_OVERHEAD_TOKENS = 4;

/**
 * Estima los tokens de un texto plano.
 * @param {string} text
 * @returns {number}
 */
export function estimateTextTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Estima los tokens de un historial completo (formato interno de AIRecorder,
 * en cualquiera de sus 3 formatos). Reutiliza `mapHistoryToMessages` para contar
 * EXACTAMENTE los mensajes que se envían al LLM (ya descarta los `⚠️ ...`).
 * @param {Array} history
 * @returns {number}
 */
export function estimateHistoryTokens(history) {
  const messages = mapHistoryToMessages(history);
  return messages.reduce(
    (total, msg) => total + estimateTextTokens(msg.content) + ROLE_OVERHEAD_TOKENS,
    0
  );
}

/**
 * Construye el objeto `contextInfo` real (system prompt + historial + adjuntos),
 * punto único usado por los 4 lugares que hoy calculan tokens del chat.
 *
 * @param {Object} params
 * @param {'rag'|'full'} params.mode
 * @param {string} [params.systemContent] - Contenido completo del system prompt ya construido
 * @param {Array} [params.history] - Historial de chat (formato interno)
 * @param {number} [params.attachmentTokens]
 * @param {number} [params.chunksUsed] - Solo aplica a modo 'rag'
 * @returns {{ mode: string, chunksUsed: number|undefined, systemTokens: number, historyTokens: number, attachmentTokens: number, baseTokens: number, estimatedTokens: number }}
 */
export function buildContextInfo({
  mode,
  systemContent = '',
  history = [],
  attachmentTokens = 0,
  chunksUsed,
} = {}) {
  const systemTokens = estimateTextTokens(systemContent);
  const historyTokens = estimateHistoryTokens(history);
  const baseTokens = systemTokens + historyTokens;

  return {
    mode,
    chunksUsed,
    systemTokens,
    historyTokens,
    attachmentTokens,
    baseTokens,
    estimatedTokens: baseTokens + attachmentTokens,
  };
}
