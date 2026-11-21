import { describe, it, expect, vi, beforeEach } from 'vitest';

const compactChatHistory = vi.fn();

vi.mock('../../../../services/chat/chatCompactService.js', () => ({
  compactChatHistory,
}));

describe('runCompact (/compact wrapper)', () => {
  let runCompact;

  beforeEach(async () => {
    vi.clearAllMocks();
    ({ runCompact } = await import('../../../../services/chat/commands/compactCommand.js'));
  });

  function makeCtx(overrides = {}) {
    return {
      getHistory: () => [{ id: 'a', tipo: 'usuario', contenido: 'hola' }],
      replaceHistory: vi.fn().mockResolvedValue(undefined),
      lang: 'es',
      scope: 'recording',
      model: undefined,
      onCompacted: vi.fn(),
      t: (key, opts) => (opts?.count != null ? `${key}:${opts.count}` : key),
      ...overrides,
    };
  }

  it('happy path: replaces the history with [summary, ...keptHistory] and notifies onCompacted', async () => {
    const ctx = makeCtx();
    compactChatHistory.mockResolvedValue({
      summary: 'Resumen',
      compactedCount: 3,
      keptHistory: [{ id: 'k1', tipo: 'asistente', contenido: 'reciente' }],
    });

    const result = await runCompact(ctx, 'foco opcional');

    expect(result).toEqual({ success: true });
    expect(compactChatHistory).toHaveBeenCalledWith(
      expect.objectContaining({ instructions: 'foco opcional', lang: 'es', scope: 'recording' })
    );
    const [entries] = ctx.replaceHistory.mock.calls[0];
    expect(entries).toHaveLength(2); // resumen + 1 kept
    expect(entries[0].contenido).toContain('Resumen');
    expect(entries[1]).toEqual({ id: 'k1', tipo: 'asistente', contenido: 'reciente' });
    expect(ctx.onCompacted).toHaveBeenCalledTimes(1);
  });

  it('maps HISTORY_TOO_SHORT to a friendly error without touching the history', async () => {
    const ctx = makeCtx();
    const err = new Error('corto');
    err.code = 'HISTORY_TOO_SHORT';
    compactChatHistory.mockRejectedValue(err);

    const result = await runCompact(ctx, '');
    expect(result).toEqual({ success: false, error: 'chatCommands.compact.tooShort' });
    expect(ctx.replaceHistory).not.toHaveBeenCalled();
  });

  it('propagates cancellation as {success:true, cancelled:true} without touching the history', async () => {
    const ctx = makeCtx();
    const cancelError = new Error('Cancelado por el usuario');
    cancelError.cancelled = true;
    compactChatHistory.mockRejectedValue(cancelError);

    const result = await runCompact(ctx, '');
    expect(result).toEqual({ success: true, cancelled: true });
    expect(ctx.replaceHistory).not.toHaveBeenCalled();
  });
});
