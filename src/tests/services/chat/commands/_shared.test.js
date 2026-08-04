import { describe, it, expect, vi, beforeEach } from 'vitest';

const getStatus = vi.fn();
const search = vi.fn();

// gatherTaskContext (commands/_shared.js) reutiliza ragService para el fallback RAG —
// mismo patrón de mock que searchCommand.test.js.
vi.mock('../../../../services/ragService.js', () => ({
  default: { getStatus, search },
}));

describe('gatherTaskContext', () => {
  let gatherTaskContext;
  let GENERIC_TASK_QUERY;

  beforeEach(async () => {
    vi.clearAllMocks();
    ({ gatherTaskContext, GENERIC_TASK_QUERY } = await import('../../../../services/chat/commands/_shared.js'));
  });

  function makeCtx(overrides = {}) {
    return {
      scope: 'recording',
      getHistory: () => [],
      ragRecordingId: undefined,
      ...overrides,
    };
  }

  it('uses the chat as-is when it already has enough content (>= MIN_SUMMARY_HISTORY_MESSAGES) — unchanged behavior', async () => {
    const ctx = makeCtx({
      getHistory: () => [
        { id: 'u1', tipo: 'usuario', contenido: 'Necesitamos arreglar el login.' },
        { id: 'a1', tipo: 'asistente', contenido: 'Entendido.' },
      ],
      ragRecordingId: 'folder-1', // presente pero NO debe usarse: el chat ya es rico
    });

    const result = await gatherTaskContext(ctx, '');

    expect(result.source).toBe('chat');
    expect(result.text).toContain('Necesitamos arreglar el login.');
    expect(getStatus).not.toHaveBeenCalled();
    expect(search).not.toHaveBeenCalled();
  });

  it('falls back to RAG (source: "rag") when the chat is completely empty but the recording is indexed', async () => {
    const ctx = makeCtx({ ragRecordingId: 'folder-1' });
    getStatus.mockResolvedValue({ success: true, indexed: true });
    search.mockResolvedValue({ success: true, chunks: [{ textDisplay: 'Se decidió X.', startTime: 5, endTime: 10 }] });

    const result = await gatherTaskContext(ctx, '');

    expect(result.source).toBe('rag');
    expect(result.text).toContain('Se decidió X.');
    expect(search).toHaveBeenCalledWith('folder-1', GENERIC_TASK_QUERY, 40);
  });

  it('combines RAG + chat (source: "chat+rag") when the chat is short but non-empty', async () => {
    const ctx = makeCtx({
      getHistory: () => [{ id: 'u1', tipo: 'usuario', contenido: 'hola' }], // 1 msg: bajo el umbral
      ragRecordingId: 'folder-1',
    });
    getStatus.mockResolvedValue({ success: true, indexed: true });
    search.mockResolvedValue({ success: true, chunks: [{ textDisplay: 'Se decidió X.' }] });

    const result = await gatherTaskContext(ctx, '');

    expect(result.source).toBe('chat+rag');
    expect(result.text).toContain('Se decidió X.');
    expect(result.text).toContain('hola');
  });

  it('uses `args` (trimmed) as the RAG search query when the user gives an explicit focus', async () => {
    const ctx = makeCtx({ ragRecordingId: 'folder-1' });
    getStatus.mockResolvedValue({ success: true, indexed: true });
    search.mockResolvedValue({ success: true, chunks: [{ textDisplay: 'chunk' }] });

    await gatherTaskContext(ctx, '  céntrate en el backend  ');

    expect(search).toHaveBeenCalledWith('folder-1', 'céntrate en el backend', 40);
  });

  it('falls back to the short/empty chat when the recording is not indexed', async () => {
    getStatus.mockResolvedValue({ success: true, indexed: false });
    const ctxWithChat = makeCtx({
      getHistory: () => [{ id: 'u1', tipo: 'usuario', contenido: 'hola' }],
      ragRecordingId: 'folder-1',
    });

    const result = await gatherTaskContext(ctxWithChat, '');
    expect(result.source).toBe('chat');
    expect(result.text).toContain('hola');
    expect(search).not.toHaveBeenCalled();
  });

  it('returns source "none" when there is neither chat content nor a RAG fallback available', async () => {
    const ctx = makeCtx(); // sin ragRecordingId, historial vacío

    const result = await gatherTaskContext(ctx, '');
    expect(result).toEqual({ text: '', source: 'none' });
    expect(getStatus).not.toHaveBeenCalled();
  });

  it('does not blow up the whole flow when ragService throws — falls back to chat/none instead', async () => {
    const ctx = makeCtx({ ragRecordingId: 'folder-1' });
    getStatus.mockRejectedValue(new Error('IPC no disponible'));
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await gatherTaskContext(ctx, '');
    expect(result).toEqual({ text: '', source: 'none' });
    consoleErrorSpy.mockRestore();
  });

  it('scope "project": never attempts the RAG fallback, even with a short chat — uses whatever content exists without blocking', async () => {
    const ctx = makeCtx({
      scope: 'project',
      getHistory: () => [{ id: 'u1', tipo: 'usuario', contenido: 'hola proyecto' }],
      ragRecordingId: 'folder-1', // aunque estuviera presente, no aplica en scope project
    });

    const result = await gatherTaskContext(ctx, '');

    expect(result.source).toBe('chat');
    expect(result.text).toContain('hola proyecto');
    expect(getStatus).not.toHaveBeenCalled();
    expect(search).not.toHaveBeenCalled();
  });

  it('scope "project": returns source "none" when the chat is completely empty (no lightweight RAG mechanism to fall back to)', async () => {
    const ctx = makeCtx({ scope: 'project' });

    const result = await gatherTaskContext(ctx, '');
    expect(result).toEqual({ text: '', source: 'none' });
  });
});
