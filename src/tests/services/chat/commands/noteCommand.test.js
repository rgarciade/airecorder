import { describe, it, expect, vi, beforeEach } from 'vitest';

const callProvider = vi.fn();
const saveNote = vi.fn();
const getStatus = vi.fn();
const search = vi.fn();

vi.mock('../../../../services/ai/providerRouter.js', () => ({
  callProvider,
}));

// aiQueueService.js instancia un singleton a nivel de módulo que usa localStorage
// (no disponible en el entorno 'node' de vitest) — mismo mock que chatCompactService.test.js.
vi.mock('../../../../services/ai/aiQueueService.js', () => ({
  AI_TASK_TYPES: { GENERAL: 'general', CHAT: 'chat' },
}));

// Mismo patrón de mock que searchCommand.test.js: gatherTaskContext (commands/_shared.js)
// reutiliza ragService para el fallback RAG cuando el chat es nuevo/corto.
vi.mock('../../../../services/ragService.js', () => ({
  default: { getStatus, search },
}));

describe('runNote (/nota)', () => {
  let runNote;
  let GENERIC_TASK_QUERY;

  beforeEach(async () => {
    vi.clearAllMocks();
    global.window = {
      electronAPI: {
        templates: { saveNote },
      },
    };
    ({ runNote } = await import('../../../../services/chat/commands/noteCommand.js'));
    ({ GENERIC_TASK_QUERY } = await import('../../../../services/chat/commands/_shared.js'));
  });

  // 2 mensajes reales = "chat rico" (>= MIN_SUMMARY_HISTORY_MESSAGES): gatherTaskContext
  // usa el chat directamente, sin tocar ragService — comportamiento histórico sin cambios.
  const richHistory = [
    { id: 'u1', tipo: 'usuario', contenido: 'Repasemos el proyecto X.' },
    { id: 'a1', tipo: 'asistente', contenido: 'Claro, aquí va el resumen.' },
  ];

  function makeCtx(overrides = {}) {
    return {
      getHistory: () => richHistory,
      replaceHistory: vi.fn().mockResolvedValue(undefined),
      lang: 'es',
      scope: 'recording',
      model: undefined,
      recordingId: 42,
      ragRecordingId: undefined,
      t: (key) => key,
      ...overrides,
    };
  }

  it('happy path: generates markdown content and persists it via templates.saveNote', async () => {
    const ctx = makeCtx();
    callProvider.mockResolvedValue({ text: '## Nota\n\nContenido generado.' });
    saveNote.mockResolvedValue({ success: true, id: 5 });

    const result = await runNote(ctx, '');

    expect(result).toEqual({ success: true });
    expect(saveNote).toHaveBeenCalledWith(
      expect.objectContaining({ recordingId: 42, contentMd: '## Nota\n\nContenido generado.' })
    );
    expect(getStatus).not.toHaveBeenCalled(); // chat rico: nunca se intenta el fallback RAG
    const [entries] = ctx.replaceHistory.mock.calls[0];
    expect(entries).toHaveLength(3); // historial original (2) + confirmación (1), NO destructivo
    expect(entries[2].contenido).toContain('Contenido generado.');
  });

  it('guard: scope "project" is not supported, never calls the AI or saveNote, and posts a visible error to history', async () => {
    const ctx = makeCtx({ scope: 'project' });

    const result = await runNote(ctx, '');
    expect(result).toEqual({ success: false, error: 'chatCommands.nota.projectUnsupported' });
    expect(callProvider).not.toHaveBeenCalled();
    expect(saveNote).not.toHaveBeenCalled();

    const [entries] = ctx.replaceHistory.mock.calls[0];
    expect(entries[entries.length - 1].contenido).toContain('chatCommands.nota.projectUnsupported');
  });

  it('guard: missing recordingId returns noTarget without calling the AI, and posts a visible error to history', async () => {
    const ctx = makeCtx({ recordingId: undefined });

    const result = await runNote(ctx, '');
    expect(result).toEqual({ success: false, error: 'chatCommands.nota.noTarget' });
    expect(callProvider).not.toHaveBeenCalled();

    const [entries] = ctx.replaceHistory.mock.calls[0];
    expect(entries[entries.length - 1].contenido).toContain('chatCommands.nota.noTarget');
  });

  it('guard: returns tooShort and posts a visible error when neither the chat nor a RAG fallback have any content', async () => {
    const ctx = makeCtx({ getHistory: () => [] }); // sin ragRecordingId: no hay a qué caer

    const result = await runNote(ctx, '');
    expect(result).toEqual({ success: false, error: 'chatCommands.nota.tooShort' });
    expect(callProvider).not.toHaveBeenCalled();

    const [entries] = ctx.replaceHistory.mock.calls[0];
    expect(entries[entries.length - 1].contenido).toContain('chatCommands.nota.tooShort');
  });

  it('regression (bug fix): falls back to RAG when the chat is new/empty but the recording is indexed — no longer "too short"', async () => {
    const ctx = makeCtx({ getHistory: () => [], ragRecordingId: 'folder-42' });
    getStatus.mockResolvedValue({ success: true, indexed: true });
    search.mockResolvedValue({
      success: true,
      chunks: [{ textDisplay: 'Se decidió migrar la base de datos a Postgres.', startTime: 10, endTime: 20 }],
    });
    callProvider.mockResolvedValue({ text: '## Nota\n\nContenido desde RAG.' });
    saveNote.mockResolvedValue({ success: true, id: 9 });

    const result = await runNote(ctx, '');

    expect(result).toEqual({ success: true });
    expect(search).toHaveBeenCalledWith('folder-42', GENERIC_TASK_QUERY, 40);
    expect(saveNote).toHaveBeenCalled();
  });

  it('maps a failed saveNote (e.g. DB error) to a friendly error AND posts it to the chat history (runsInBackground: nadie más espera esta promesa)', async () => {
    const ctx = makeCtx();
    callProvider.mockResolvedValue({ text: 'Contenido' });
    saveNote.mockResolvedValue({ success: false, error: 'boom' });

    const result = await runNote(ctx, '');
    expect(result).toEqual({ success: false, error: 'chatCommands.nota.error' });

    const [entries] = ctx.replaceHistory.mock.calls[0];
    expect(entries[entries.length - 1].tipo).toBe('asistente');
    expect(entries[entries.length - 1].contenido).toContain('chatCommands.nota.error');
  });

  it('propagates cancellation as {success:true, cancelled:true} without persisting anything or touching the history', async () => {
    const ctx = makeCtx();
    const cancelError = new Error('Cancelado por el usuario');
    cancelError.cancelled = true;
    callProvider.mockRejectedValue(cancelError);

    const result = await runNote(ctx, '');
    expect(result).toEqual({ success: true, cancelled: true });
    expect(saveNote).not.toHaveBeenCalled();
    expect(ctx.replaceHistory).not.toHaveBeenCalled();
  });
});
