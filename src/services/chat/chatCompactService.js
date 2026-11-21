/**
 * Lógica IA del comando `/compact`: resume la parte antigua del historial y
 * la reemplaza por un mensaje-resumen, conservando los últimos `keepRecent`
 * mensajes intactos.
 *
 * Agnóstico del storage: no toca disco ni SQLite — solo devuelve datos en
 * memoria. La persistencia atómica la hace el caller (`useChatCommands`) a
 * través de `replaceHistory`.
 */

import { callProvider } from '../ai/providerRouter';
import { AI_TASK_TYPES } from '../ai/aiQueueService';
import { consolidateSummaryPrompt } from '../../prompts/common/aiPrompts';
import { compactChatPrompt } from '../../prompts/common/chatCommandPrompts';
import { mapHistoryToMessages } from '../../prompts/common/ragPrompts';
import { normalizeChatHistory, serializeHistoryForPrompt } from './chatHistory';
import { DEFAULT_KEEP_RECENT, estimateTextTokens } from './chatTokens';

const DEFAULT_MAX_CHUNK_CHARS = 24000;

function _makeError(message, code) {
  const err = new Error(message);
  err.code = code;
  return err;
}

/**
 * Llama al proveedor de IA en "modo análisis": concatena system+user en un
 * único prompt y pasa systemPrompt:null (compatibilidad con modelos locales
 * que ignoran el campo `system` del payload). Mismo patrón que
 * `recordingAiService._callAiProvider`.
 */
async function _callAi(systemPrompt, userContent, options = {}) {
  const prompt = userContent ? `${systemPrompt}\n\n${userContent}` : systemPrompt;
  try {
    return await callProvider(prompt, { ...options, systemPrompt: null });
  } catch (err) {
    // Guardia no negociable: una cancelación del usuario (Monitor de Procesos)
    // se propaga TAL CUAL, sin envolver ni tragar. El caller debe verla intacta
    // para no tocar disco/SQLite a medias.
    if (err.cancelled) throw err;
    throw err;
  }
}

/**
 * Trocea una lista de bloques de texto (un bloque = un mensaje serializado) en
 * trozos que no superan `maxChunkChars`, cortando siempre por FRONTERA de
 * mensaje (nunca a mitad de un mensaje).
 */
function _chunkByMessageBoundary(blocks, maxChunkChars) {
  const chunks = [];
  let current = '';
  for (const block of blocks) {
    const candidate = current ? `${current}\n\n${block}` : block;
    if (candidate.length > maxChunkChars && current) {
      chunks.push(current);
      current = block;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

/**
 * Resume un array de mensajes ya mapeados/serializados, con troceado map-reduce
 * automático cuando el texto supera `maxChunkChars` (nunca corta un mensaje a mitad).
 *
 * Extraído de `compactChatHistory` para que `/resumen` (comando no destructivo,
 * `summaryCommand.js`) pueda reutilizar EXACTAMENTE el mismo mecanismo de chunking
 * sin duplicar ~40 líneas de lógica map-reduce. `compactChatHistory` sigue siendo la
 * única fuente de verdad para SU comportamiento (guardas de `keepRecent`,
 * `HISTORY_TOO_SHORT`, forma del resultado) — esta función solo encapsula la parte
 * "convertir texto serializado en un resumen de IA".
 *
 * @param {Object} params
 * @param {Array<{role:string, content:string}>} params.messages - Ya mapeados (mapHistoryToMessages)
 * @param {string} params.fullSerialized - Texto ya serializado (serializeHistoryForPrompt)
 * @param {string} params.systemPrompt - System prompt específico del comando que llama
 * @param {string} [params.lang]
 * @param {string} [params.model] - Override de modelo (sessionModel)
 * @param {number} [params.maxChunkChars]
 * @param {string} [params.taskName] - Nombre base para el meta de la cola de IA (display en la UI)
 * @returns {Promise<string>} Texto del resumen, ya recortado (`trim()`), nunca vacío
 * @throws {Error} con `.code === 'EMPTY_SUMMARY'` si la IA devuelve un resumen vacío (por trozo o al final)
 * @throws {Error} con `.cancelled === true` si la tarea fue cancelada desde el Monitor de Procesos
 */
export async function summarizeMessages({
  messages,
  fullSerialized,
  systemPrompt,
  lang = 'es',
  model,
  maxChunkChars = DEFAULT_MAX_CHUNK_CHARS,
  taskName = 'Resumir chat',
} = {}) {
  const queueMeta = { name: taskName, type: AI_TASK_TYPES.GENERAL };

  let summaryText;

  if (fullSerialized.length > maxChunkChars) {
    // Map: trocear por frontera de mensaje y resumir cada trozo por separado.
    const blocks = messages.map((m) => `[${m.role === 'user' ? 'USUARIO' : 'ASISTENTE'}]: ${m.content}`);
    const chunks = _chunkByMessageBoundary(blocks, maxChunkChars);
    const partials = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunkPrompt = `${systemPrompt}\n\nNote: this is part ${i + 1} of ${chunks.length} of a longer chat history. Summarize only this specific part.`;
      const result = await _callAi(chunkPrompt, chunks[i], {
        model,
        queueMeta: { ...queueMeta, name: `${taskName} (parte ${i + 1}/${chunks.length})` },
      });
      const partialText = result.text || '';
      // Misma guardia no negociable que el resumen final: un trozo vacío no debe
      // colarse en la consolidación (contaminaría o vaciaría el resumen final).
      if (!partialText.trim()) {
        throw _makeError(
          `La IA devolvió un resumen vacío en la parte ${i + 1}/${chunks.length}.`,
          'EMPTY_SUMMARY'
        );
      }
      partials.push(partialText);
    }

    // Reduce: consolidar los resúmenes parciales en uno solo (mismo prompt que
    // se usa para consolidar resúmenes de grabaciones largas).
    const combined = partials
      .map((p, i) => `Resumen Parte ${i + 1}\n${p}`)
      .join('\n\n');
    const finalResult = await _callAi(consolidateSummaryPrompt(lang), combined, {
      model,
      queueMeta: { ...queueMeta, name: `${taskName} (consolidación)` },
    });
    summaryText = finalResult.text;
  } else {
    const result = await _callAi(systemPrompt, fullSerialized, { model, queueMeta });
    summaryText = result.text;
  }

  // Guardia no negociable: nunca devolver un resumen vacío.
  if (!summaryText?.trim()) {
    throw _makeError('La IA devolvió un resumen vacío.', 'EMPTY_SUMMARY');
  }

  return summaryText.trim();
}

/**
 * Compacta el historial de un chat: resume todo salvo los últimos `keepRecent`
 * mensajes y devuelve el resumen + el historial reciente intacto.
 *
 * @param {Object} params
 * @param {Array} params.history - Historial completo (formato interno, cualquiera de los 3 formatos)
 * @param {string} [params.instructions] - Foco opcional del usuario (`/compact céntrate en...`)
 * @param {string} [params.lang]
 * @param {number} [params.keepRecent]
 * @param {'recording'|'project'} [params.scope]
 * @param {string} [params.model] - Override de modelo (sessionModel)
 * @param {number} [params.maxChunkChars]
 * @returns {Promise<{ summary: string, compactedCount: number, keptHistory: Array, originalTokens: number, summaryTokens: number }>}
 * @throws {Error} con `.code === 'HISTORY_TOO_SHORT'` si no hay suficiente historial que compactar
 * @throws {Error} con `.code === 'EMPTY_SUMMARY'` si la IA devuelve un resumen vacío
 * @throws {Error} con `.cancelled === true` si la tarea fue cancelada desde el Monitor de Procesos
 */
export async function compactChatHistory({
  history,
  instructions = '',
  lang = 'es',
  keepRecent = DEFAULT_KEEP_RECENT,
  scope = 'recording',
  model,
  maxChunkChars = DEFAULT_MAX_CHUNK_CHARS,
} = {}) {
  const normalized = normalizeChatHistory(history);

  if (normalized.length < keepRecent + 2) {
    throw _makeError('El historial es demasiado corto para compactar.', 'HISTORY_TOO_SHORT');
  }

  const toCompact = normalized.slice(0, normalized.length - keepRecent);
  const keptHistory = normalized.slice(normalized.length - keepRecent);

  const messages = mapHistoryToMessages(toCompact);
  const originalTokens = messages.reduce((sum, m) => sum + estimateTextTokens(m.content), 0);

  const fullSerialized = serializeHistoryForPrompt(messages);
  const systemPrompt = compactChatPrompt(lang, { scope, instructions });

  const summaryText = await summarizeMessages({
    messages,
    fullSerialized,
    systemPrompt,
    lang,
    model,
    maxChunkChars,
    taskName: 'Compactar chat',
  });

  return {
    summary: summaryText,
    compactedCount: toCompact.length,
    keptHistory,
    originalTokens,
    summaryTokens: estimateTextTokens(summaryText),
  };
}
