import { describe, it, expect, vi, beforeEach } from 'vitest';

const summarizeMessages = vi.fn();

// Igual que chatCompactService.test.js: se sustituye el módulo entero para no depender
// de callProvider real. summaryCommand.js solo consume `summarizeMessages` de aquí.
vi.mock('../../../../services/chat/chatCompactService.js', () => ({
  summarizeMessages,
}));

describe('runSummary (/resumen)', () => {
  let runSummary;

  beforeEach(async () => {
    vi.clearAllMocks();
    ({ runSummary } = await import('../../../../services/chat/commands/summaryCommand.js'));
  });

  const buildHistory = (count) =>
    Array.from({ length: count }, (_, i) => ({
      id: `m${i}`,
      tipo: i % 2 === 0 ? 'usuario' : 'asistente',
      contenido: i % 2 === 0 ? `Pregunta ${i}` : `Respuesta ${i}`,
      fecha: `2024-01-0${i + 1}T00:00:00Z`,
    }));

  function makeCtx(history, overrides = {}) {
    return {
      getHistory: () => history,
      replaceHistory: vi.fn().mockResolvedValue(undefined),
      lang: 'es',
      scope: 'recording',
      model: undefined,
      t: (key, opts) => (opts?.count != null ? `${key}:${opts.count}` : key),
      ...overrides,
    };
  }

  it('happy path: appends the summary as a new assistant message WITHOUT dropping any existing message', async () => {
    const history = buildHistory(4);
    const ctx = makeCtx(history);
    summarizeMessages.mockResolvedValue('Resumen de toda la conversación.');

    const result = await runSummary(ctx, '');

    expect(result).toEqual({ success: true });
    expect(summarizeMessages).toHaveBeenCalledTimes(1);
    // full:true se propaga hasta compactChatPrompt vía el systemPrompt ya construido —
    // aquí solo verificamos que se resumió TODO el historial, no un recorte.
    const callArgs = summarizeMessages.mock.calls[0][0];
    expect(callArgs.messages).toHaveLength(4);

    expect(ctx.replaceHistory).toHaveBeenCalledTimes(1);
    const [entries] = ctx.replaceHistory.mock.calls[0];
    // No destructivo: los 4 mensajes originales siguen intactos + 1 nuevo al final.
    expect(entries).toHaveLength(5);
    expect(entries.slice(0, 4)).toEqual(history);
    expect(entries[4].tipo).toBe('asistente');
    expect(entries[4].contenido).toContain('Resumen de toda la conversación.');
  });

  it('guard: returns tooShort without calling the AI when the history has fewer than MIN_SUMMARY_HISTORY_MESSAGES', async () => {
    const { MIN_SUMMARY_HISTORY_MESSAGES } = await import('../../../../services/chat/chatTokens.js');
    const history = buildHistory(MIN_SUMMARY_HISTORY_MESSAGES - 1);
    const ctx = makeCtx(history);

    const result = await runSummary(ctx, '');

    expect(result).toEqual({ success: false, error: 'chatCommands.resumen.tooShort' });
    expect(summarizeMessages).not.toHaveBeenCalled();
    expect(ctx.replaceHistory).not.toHaveBeenCalled();
  });

  it('maps EMPTY_SUMMARY to a friendly error and does not touch the history', async () => {
    const history = buildHistory(4);
    const ctx = makeCtx(history);
    const err = new Error('vacío');
    err.code = 'EMPTY_SUMMARY';
    summarizeMessages.mockRejectedValue(err);

    const result = await runSummary(ctx, '');
    expect(result).toEqual({ success: false, error: 'chatCommands.resumen.empty' });
    expect(ctx.replaceHistory).not.toHaveBeenCalled();
  });

  it('propagates cancellation as {success:true, cancelled:true} without touching the history', async () => {
    const history = buildHistory(4);
    const ctx = makeCtx(history);
    const cancelError = new Error('Cancelado por el usuario');
    cancelError.cancelled = true;
    summarizeMessages.mockRejectedValue(cancelError);

    const result = await runSummary(ctx, '');
    expect(result).toEqual({ success: true, cancelled: true });
    expect(ctx.replaceHistory).not.toHaveBeenCalled();
  });
});
