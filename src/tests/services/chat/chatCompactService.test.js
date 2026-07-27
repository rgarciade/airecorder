import { describe, it, expect, vi, beforeEach } from 'vitest';

const callProvider = vi.fn();

// Mismo patrón de mocking que src/tests/services/ai/providerRouter.test.js: se sustituye
// el módulo entero por un stub controlado por el test, sin tocar la red ni providers reales.
vi.mock('../../../services/ai/providerRouter.js', () => ({
  callProvider,
}));

// aiQueueService.js instancia un singleton a nivel de módulo que usa localStorage
// (no disponible en el entorno 'node' de vitest) — se mockea solo lo que
// chatCompactService.js realmente consume de él.
vi.mock('../../../services/ai/aiQueueService.js', () => ({
  AI_TASK_TYPES: { GENERAL: 'general', CHAT: 'chat' },
}));

describe('compactChatHistory', () => {
  let compactChatHistory;
  let estimateTextTokens;

  beforeEach(async () => {
    vi.clearAllMocks();
    ({ compactChatHistory } = await import('../../../services/chat/chatCompactService.js'));
    ({ estimateTextTokens } = await import('../../../services/chat/chatTokens.js'));
  });

  const buildHistory = (count) =>
    Array.from({ length: count }, (_, i) => ({
      id: `m${i}`,
      tipo: i % 2 === 0 ? 'usuario' : 'asistente',
      contenido: i % 2 === 0 ? `Pregunta ${i}` : `Respuesta ${i}`,
      fecha: `2024-01-0${i + 1}T00:00:00Z`,
    }));

  it('happy path: with the new 6-message threshold, compacts everything but the last 4 and returns a valid summary', async () => {
    const history = buildHistory(6); // umbral mínimo exacto tras el fix del bug #2
    const mockSummary = 'Resumen de prueba compacto.';
    callProvider.mockResolvedValue({ text: mockSummary });

    const result = await compactChatHistory({ history, lang: 'es', scope: 'recording' });

    expect(callProvider).toHaveBeenCalledTimes(1);
    // _callAi pasa systemPrompt:null explícitamente (compatibilidad con providers locales).
    expect(callProvider).toHaveBeenCalledWith(
      expect.stringContaining('Pregunta 0'),
      expect.objectContaining({ systemPrompt: null })
    );

    expect(result.summary).toBe(mockSummary);
    expect(result.compactedCount).toBe(2); // 6 - keepRecent(4) = 2
    expect(result.keptHistory).toHaveLength(4);
    expect(result.keptHistory.map((m) => m.id)).toEqual(['m2', 'm3', 'm4', 'm5']);

    // Los tokens se calculan reutilizando estimateTextTokens (bug #6) — mismo punto único
    // de la heurística chars/token que el resto de la app.
    const expectedOriginalTokens = estimateTextTokens('Pregunta 0') + estimateTextTokens('Respuesta 1');
    expect(result.originalTokens).toBe(expectedOriginalTokens);
    expect(result.summaryTokens).toBe(estimateTextTokens(mockSummary));
  });

  it.each([0, 3, 5])('throws HISTORY_TOO_SHORT for histories shorter than the 6-message threshold (length=%i)', async (len) => {
    const history = buildHistory(len);

    await expect(compactChatHistory({ history })).rejects.toMatchObject({ code: 'HISTORY_TOO_SHORT' });
    // La guarda debe cortocircuitar ANTES de llamar a la IA — nunca gastar una llamada
    // (ni arriesgar tocar disco/SQLite) con un historial que ya se sabe insuficiente.
    expect(callProvider).not.toHaveBeenCalled();
  });

  it('throws EMPTY_SUMMARY when the AI returns an empty/whitespace-only summary', async () => {
    const history = buildHistory(6);
    callProvider.mockResolvedValue({ text: '   ' });

    await expect(compactChatHistory({ history })).rejects.toMatchObject({ code: 'EMPTY_SUMMARY' });
  });

  it('propagates a cancelled error unchanged (contract: never wrap, never swallow, never touch storage)', async () => {
    const history = buildHistory(6);
    const cancelError = new Error('Cancelado por el usuario');
    cancelError.cancelled = true;
    callProvider.mockRejectedValue(cancelError);

    // Identidad estricta: debe ser EXACTAMENTE el mismo objeto de error, no uno envuelto.
    await expect(compactChatHistory({ history })).rejects.toBe(cancelError);
  });

  it('bug #7: aborts with EMPTY_SUMMARY as soon as one chunk comes back empty in the map-reduce path, without attempting consolidation', async () => {
    const history = buildHistory(6);
    // maxChunkChars diminuto para forzar el troceado por frontera de mensaje con solo
    // 2 mensajes a compactar (uno por chunk).
    callProvider
      .mockResolvedValueOnce({ text: 'Resumen parcial 1' }) // parte 1/2 — ok
      .mockResolvedValueOnce({ text: '' }); // parte 2/2 — vacío, debe abortar aquí

    await expect(
      compactChatHistory({ history, maxChunkChars: 5 })
    ).rejects.toMatchObject({ code: 'EMPTY_SUMMARY' });

    // Solo las 2 llamadas de troceado — NUNCA debe llegar a la llamada de consolidación
    // (reduce) con un parcial vacío contaminando el resumen final.
    expect(callProvider).toHaveBeenCalledTimes(2);
  });
});
