import { describe, it, expect, vi, beforeEach } from 'vitest';

const getStatus = vi.fn();
const search = vi.fn();
const callChatProviderStreaming = vi.fn();
const generateAiResponse = vi.fn();

vi.mock('../../../../services/ragService.js', () => ({
  default: { getStatus, search },
}));

vi.mock('../../../../services/projectChatService.js', () => ({
  default: { generateAiResponse },
}));

vi.mock('../../../../services/ai/providerRouter.js', () => ({
  callChatProviderStreaming,
}));

describe('runSearch (/buscar)', () => {
  let runSearch;

  beforeEach(async () => {
    vi.clearAllMocks();
    ({ runSearch } = await import('../../../../services/chat/commands/searchCommand.js'));
  });

  const history = [{ id: 'u1', tipo: 'usuario', contenido: 'hola' }];

  function makeCtx(overrides = {}) {
    return {
      getHistory: () => history,
      replaceHistory: vi.fn().mockResolvedValue(undefined),
      scope: 'recording',
      model: undefined,
      ragRecordingId: 'folder-123',
      t: (key) => key,
      ...overrides,
    };
  }

  it('guard: empty query returns emptyQuery WITHOUT calling any RAG service', async () => {
    const ctx = makeCtx();
    const result = await runSearch(ctx, '   ');

    expect(result).toEqual({ success: false, error: 'chatCommands.buscar.emptyQuery' });
    expect(getStatus).not.toHaveBeenCalled();
    expect(generateAiResponse).not.toHaveBeenCalled();
  });

  it('happy path (scope recording): forces topK=40 and appends both the question and the answer', async () => {
    const ctx = makeCtx();
    getStatus.mockResolvedValue({ success: true, indexed: true });
    search.mockResolvedValue({ success: true, chunks: [{ textDisplay: 'contenido relevante', startTime: 0, endTime: 5 }] });
    callChatProviderStreaming.mockResolvedValue({ text: 'La respuesta encontrada.' });

    const result = await runSearch(ctx, '¿qué se decidió?');

    expect(result).toEqual({ success: true });
    expect(search).toHaveBeenCalledWith('folder-123', '¿qué se decidió?', 40);
    const [entries] = ctx.replaceHistory.mock.calls[0];
    expect(entries).toHaveLength(3); // historial (1) + pregunta (1) + respuesta (1)
    expect(entries[1].tipo).toBe('usuario');
    expect(entries[1].contenido).toBe('/buscar ¿qué se decidió?');
    expect(entries[2].tipo).toBe('asistente');
    expect(entries[2].contenido).toBe('La respuesta encontrada.');
  });

  it('guard (scope recording): recording not RAG-indexed returns notIndexed without querying chunks', async () => {
    const ctx = makeCtx();
    getStatus.mockResolvedValue({ success: true, indexed: false });

    const result = await runSearch(ctx, 'pregunta');
    expect(result).toEqual({ success: false, error: 'chatCommands.buscar.notIndexed' });
    expect(search).not.toHaveBeenCalled();
  });

  it('happy path (scope project): delegates to projectChatService with ragMode forced to "detallado"', async () => {
    const ctx = makeCtx({ scope: 'project', projectId: 'p1', chatId: 'c1', ragRecordingId: undefined });
    generateAiResponse.mockResolvedValue({ text: 'Respuesta de proyecto.' });

    const result = await runSearch(ctx, 'pregunta de proyecto');

    expect(result).toEqual({ success: true });
    expect(generateAiResponse).toHaveBeenCalledWith(
      'p1', 'pregunta de proyecto', 'c1', history, 'detallado', expect.any(Object), expect.any(Function)
    );
    const [entries] = ctx.replaceHistory.mock.calls[0];
    expect(entries[2].contenido).toBe('Respuesta de proyecto.');
  });

  it('guard (scope project): missing chatId returns noTarget without calling the service', async () => {
    const ctx = makeCtx({ scope: 'project', projectId: 'p1', chatId: undefined, ragRecordingId: undefined });

    const result = await runSearch(ctx, 'pregunta');
    expect(result).toEqual({ success: false, error: 'chatCommands.buscar.noTarget' });
    expect(generateAiResponse).not.toHaveBeenCalled();
  });

  it('propagates cancellation as {success:true, cancelled:true} without touching the history', async () => {
    const ctx = makeCtx();
    getStatus.mockResolvedValue({ success: true, indexed: true });
    search.mockResolvedValue({ success: true, chunks: [{ textDisplay: 'x' }] });
    const cancelError = new Error('Cancelado por el usuario');
    cancelError.cancelled = true;
    callChatProviderStreaming.mockRejectedValue(cancelError);

    const result = await runSearch(ctx, 'pregunta');
    expect(result).toEqual({ success: true, cancelled: true });
    expect(ctx.replaceHistory).not.toHaveBeenCalled();
  });
});
