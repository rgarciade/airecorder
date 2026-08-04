import { describe, it, expect, vi } from 'vitest';
import { runHelp } from '../../../../services/chat/commands/helpCommand.js';
import { CHAT_COMMANDS } from '../../../../services/chat/chatCommands.js';

function fakeT(key, opts) {
  if (key === 'chatCommands.help.header') return '## Comandos disponibles';
  if (key.endsWith('.description')) return `desc:${key}`;
  return key;
}

function makeCtx(history) {
  return {
    getHistory: () => history,
    replaceHistory: vi.fn().mockResolvedValue(undefined),
    t: fakeT,
  };
}

describe('runHelp (/help)', () => {
  it('happy path: appends a single assistant message listing every registered command', async () => {
    const history = [{ id: '1', tipo: 'usuario', contenido: 'hola' }];
    const ctx = makeCtx(history);

    const result = await runHelp(ctx);

    expect(result).toEqual({ success: true });
    expect(ctx.replaceHistory).toHaveBeenCalledTimes(1);
    const [entries] = ctx.replaceHistory.mock.calls[0];
    expect(entries).toHaveLength(2); // historial original + 1 mensaje nuevo
    expect(entries[0]).toBe(history[0]);

    const helpEntry = entries[1];
    expect(helpEntry.tipo).toBe('asistente');
    expect(helpEntry.chatVersion).toBe(2);
    // Lista TODOS los comandos registrados, no un subconjunto hardcodeado.
    for (const cmd of CHAT_COMMANDS) {
      expect(helpEntry.contenido).toContain(`/${cmd.name}`);
    }
  });

  it('works even with an empty history (primer mensaje del chat)', async () => {
    const ctx = makeCtx([]);
    const result = await runHelp(ctx);

    expect(result).toEqual({ success: true });
    const [entries] = ctx.replaceHistory.mock.calls[0];
    expect(entries).toHaveLength(1);
  });

  it('never rejects: wraps a replaceHistory failure as a resolved error result', async () => {
    const ctx = makeCtx([]);
    ctx.replaceHistory.mockRejectedValue(new Error('fallo'));

    const result = await runHelp(ctx);
    expect(result).toEqual({ success: false, error: 'chatCommands.help.error' });
  });
});
