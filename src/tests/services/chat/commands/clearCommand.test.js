import { describe, it, expect, vi } from 'vitest';
import { runClear } from '../../../../services/chat/commands/clearCommand.js';

function makeCtx(history) {
  return {
    getHistory: () => history,
    replaceHistory: vi.fn().mockResolvedValue(undefined),
    t: (key) => key,
  };
}

describe('runClear (/clear)', () => {
  it('happy path: replaces a non-empty history with an empty array', async () => {
    const ctx = makeCtx([{ id: '1', tipo: 'usuario', contenido: 'hola' }]);
    const result = await runClear(ctx);

    expect(result).toEqual({ success: true });
    expect(ctx.replaceHistory).toHaveBeenCalledWith([]);
  });

  it('guard: no-op (does not call replaceHistory) when the history is already empty', async () => {
    const ctx = makeCtx([]);
    const result = await runClear(ctx);

    expect(result).toEqual({ success: true });
    expect(ctx.replaceHistory).not.toHaveBeenCalled();
  });

  it('never rejects: wraps a replaceHistory failure as a resolved error result', async () => {
    const ctx = makeCtx([{ id: '1', tipo: 'usuario', contenido: 'hola' }]);
    ctx.replaceHistory.mockRejectedValue(new Error('disco lleno'));

    const result = await runClear(ctx);
    expect(result).toEqual({ success: false, error: 'chatCommands.clear.error' });
  });
});
