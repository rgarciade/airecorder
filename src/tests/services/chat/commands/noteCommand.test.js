import { describe, it, expect, vi, beforeEach } from 'vitest';

const callProvider = vi.fn();
const saveNote = vi.fn();

vi.mock('../../../../services/ai/providerRouter.js', () => ({
  callProvider,
}));

// aiQueueService.js instancia un singleton a nivel de módulo que usa localStorage
// (no disponible en el entorno 'node' de vitest) — mismo mock que chatCompactService.test.js.
vi.mock('../../../../services/ai/aiQueueService.js', () => ({
  AI_TASK_TYPES: { GENERAL: 'general', CHAT: 'chat' },
}));

describe('runNote (/nota)', () => {
  let runNote;

  beforeEach(async () => {
    vi.clearAllMocks();
    global.window = {
      electronAPI: {
        templates: { saveNote },
      },
    };
    ({ runNote } = await import('../../../../services/chat/commands/noteCommand.js'));
  });

  const history = [
    { id: 'u1', tipo: 'usuario', contenido: 'Repasemos el proyecto X.' },
    { id: 'a1', tipo: 'asistente', contenido: 'Claro, aquí va el resumen.' },
  ];

  function makeCtx(overrides = {}) {
    return {
      getHistory: () => history,
      replaceHistory: vi.fn().mockResolvedValue(undefined),
      lang: 'es',
      scope: 'recording',
      model: undefined,
      recordingId: 42,
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
    const [entries] = ctx.replaceHistory.mock.calls[0];
    expect(entries).toHaveLength(3); // historial original (2) + confirmación (1), NO destructivo
    expect(entries[2].contenido).toContain('Contenido generado.');
  });

  it('guard: scope "project" is not supported and never calls the AI or saveNote', async () => {
    const ctx = makeCtx({ scope: 'project' });

    const result = await runNote(ctx, '');
    expect(result).toEqual({ success: false, error: 'chatCommands.nota.projectUnsupported' });
    expect(callProvider).not.toHaveBeenCalled();
    expect(saveNote).not.toHaveBeenCalled();
  });

  it('guard: missing recordingId returns noTarget without calling the AI', async () => {
    const ctx = makeCtx({ recordingId: undefined });

    const result = await runNote(ctx, '');
    expect(result).toEqual({ success: false, error: 'chatCommands.nota.noTarget' });
    expect(callProvider).not.toHaveBeenCalled();
  });

  it('maps a failed saveNote (e.g. DB error) to a friendly error without touching the chat history', async () => {
    const ctx = makeCtx();
    callProvider.mockResolvedValue({ text: 'Contenido' });
    saveNote.mockResolvedValue({ success: false, error: 'boom' });

    const result = await runNote(ctx, '');
    expect(result).toEqual({ success: false, error: 'chatCommands.nota.error' });
    expect(ctx.replaceHistory).not.toHaveBeenCalled();
  });

  it('propagates cancellation as {success:true, cancelled:true} without persisting anything', async () => {
    const ctx = makeCtx();
    const cancelError = new Error('Cancelado por el usuario');
    cancelError.cancelled = true;
    callProvider.mockRejectedValue(cancelError);

    const result = await runNote(ctx, '');
    expect(result).toEqual({ success: true, cancelled: true });
    expect(saveNote).not.toHaveBeenCalled();
  });
});
