/**
 * Presupuesto de contexto para el chat de proyecto (RAG unificado).
 * Funciones puras: estiman tokens de chunks, calculan cuántos caben y
 * seleccionan los mejores entre todas las grabaciones.
 */

import { estimateTextTokens, CONTEXT_WARNING_RATIO } from '../chat/chatTokens';

// Tokens fijos por chunk (etiqueta [Reunión: "..." · id · mm:ss - mm:ss] y saltos de línea)
export const CHUNK_HEADER_TOKENS = 20;

// Tokens que se reservan para la respuesta del modelo (el llamador los suma a las partes fijas)
export const RESPONSE_RESERVE_TOKENS = 1500;

const DEFAULT_CONTEXT_LIMIT = 8000;
const MAX_CHUNK_BUDGET_AUTO = 8000;
const MAX_CHUNK_BUDGET_DETAILED = 20000;
const MIN_CHUNK_BUDGET = 1000;

/** Tokens estimados de un chunk tal y como se inyecta en el prompt. */
export function estimateChunkTokens(chunk) {
  return estimateTextTokens(chunk?.textDisplay || chunk?.text || '') + CHUNK_HEADER_TOKENS;
}

/**
 * Tokens disponibles para chunks una vez descontadas las partes fijas del prompt.
 * @param {{ contextTokenLimit?: number, fixedTokens?: number, ragMode?: string }} params
 */
export function computeChunkTokenBudget({ contextTokenLimit, fixedTokens = 0, ragMode } = {}) {
  const limit = contextTokenLimit || DEFAULT_CONTEXT_LIMIT;
  const cap = ragMode === 'detallado' ? MAX_CHUNK_BUDGET_DETAILED : MAX_CHUNK_BUDGET_AUTO;
  const available = Math.floor(limit * CONTEXT_WARNING_RATIO) - fixedTokens;
  return Math.max(MIN_CHUNK_BUDGET, Math.min(available, cap));
}

/**
 * Selecciona los mejores chunks (por score) que caben en `tokenBudget`.
 * - Siempre conserva al menos `minChunks` (los mejores), aunque excedan el presupuesto.
 * - Máximo `maxKeywordOnlyPerRecording` chunks solo-keyword por grabación.
 * - Un chunk que no cabe se salta y se prueba el siguiente.
 * Salida ordenada por primera aparición de la grabación en la entrada y luego startTime asc.
 */
export function selectChunksWithinBudget(candidates, { tokenBudget, minChunks = 3, maxKeywordOnlyPerRecording = 2 } = {}) {
  if (!candidates || candidates.length === 0) return { selected: [], includedRecordingIds: [] };

  const recordingOrder = new Map();
  candidates.forEach((c) => {
    if (!recordingOrder.has(c.recordingId)) recordingOrder.set(c.recordingId, recordingOrder.size);
  });

  const byScore = [...candidates].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  // Tope de chunks solo-keyword por grabación
  const keywordCount = new Map();
  const eligible = byScore.filter((c) => {
    if (!c.keywordOnly) return true;
    const n = keywordCount.get(c.recordingId) || 0;
    if (n >= maxKeywordOnlyPerRecording) return false;
    keywordCount.set(c.recordingId, n + 1);
    return true;
  });

  const floor = Math.min(minChunks, eligible.length);
  const selected = [];
  let used = 0;
  for (const chunk of eligible) {
    const tokens = estimateChunkTokens(chunk);
    if (selected.length < floor || used + tokens <= tokenBudget) {
      selected.push(chunk);
      used += tokens;
    }
  }

  selected.sort((a, b) => {
    const byRec = recordingOrder.get(a.recordingId) - recordingOrder.get(b.recordingId);
    return byRec !== 0 ? byRec : (a.startTime ?? 0) - (b.startTime ?? 0);
  });

  const includedRecordingIds = [...new Set(selected.map((c) => c.recordingId))];
  return { selected, includedRecordingIds };
}
