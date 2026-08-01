import { describe, it, expect, vi, beforeEach } from 'vitest';

const callProvider = vi.fn();
const addTaskSuggestion = vi.fn();
const createProjectTask = vi.fn();

vi.mock('../../../../services/ai/providerRouter.js', () => ({
  callProvider,
}));

// aiQueueService.js instancia un singleton a nivel de módulo que usa localStorage
// (no disponible en el entorno 'node' de vitest) — mismo mock que chatCompactService.test.js.
vi.mock('../../../../services/ai/aiQueueService.js', () => ({
  AI_TASK_TYPES: { GENERAL: 'general', CHAT: 'chat', TASK_SUGGESTIONS: 'task-suggestions' },
}));

vi.mock('../../../../services/recordingsService.js', () => ({
  default: {
    addTaskSuggestion,
    createProjectTask,
  },
}));

describe('runTasks (/tareas)', () => {
  let runTasks;

  beforeEach(async () => {
    vi.clearAllMocks();
    ({ runTasks } = await import('../../../../services/chat/commands/tasksCommand.js'));
  });

  const history = [
    { id: 'u1', tipo: 'usuario', contenido: 'Necesitamos arreglar el login y el dashboard.' },
    { id: 'a1', tipo: 'asistente', contenido: 'Entendido, lo anoto.' },
  ];

  function makeCtx(overrides = {}) {
    return {
      getHistory: () => history,
      replaceHistory: vi.fn().mockResolvedValue(undefined),
      lang: 'es',
      scope: 'recording',
      model: undefined,
      recordingId: 42,
      projectId: undefined,
      t: (key, opts) => (opts?.count != null ? `${key}:${opts.count}` : key),
      ...overrides,
    };
  }

  it('happy path (scope recording): parses the AI JSON array and persists each task via addTaskSuggestion', async () => {
    const ctx = makeCtx();
    callProvider.mockResolvedValue({
      text: JSON.stringify([
        { title: 'Arreglar login', content: 'Detalle', layer: 'backend' },
        { title: 'Arreglar dashboard', content: 'Detalle 2', layer: 'frontend' },
      ]),
    });
    addTaskSuggestion.mockResolvedValueOnce({ id: 1, title: 'Arreglar login' });
    addTaskSuggestion.mockResolvedValueOnce({ id: 2, title: 'Arreglar dashboard' });

    const result = await runTasks(ctx, '');

    expect(result).toEqual({ success: true });
    expect(addTaskSuggestion).toHaveBeenCalledTimes(2);
    expect(addTaskSuggestion).toHaveBeenNthCalledWith(1, 42, 'Arreglar login', 'Detalle', 'backend', true);
    expect(createProjectTask).not.toHaveBeenCalled();

    const [entries] = ctx.replaceHistory.mock.calls[0];
    expect(entries).toHaveLength(3); // historial original (2) + resumen (1)
    expect(entries[2].tipo).toBe('asistente');
    expect(entries[2].contenido).toContain('chatCommands.tareas.summaryHeader:2');
  });

  it('happy path (scope project): persists via createProjectTask instead of addTaskSuggestion', async () => {
    const ctx = makeCtx({ scope: 'project', recordingId: undefined, projectId: 7 });
    callProvider.mockResolvedValue({
      text: JSON.stringify([{ title: 'Tarea de proyecto', content: '', layer: 'fullstack' }]),
    });
    createProjectTask.mockResolvedValueOnce({ id: 9, title: 'Tarea de proyecto' });

    const result = await runTasks(ctx, '');

    expect(result).toEqual({ success: true });
    expect(createProjectTask).toHaveBeenCalledWith(7, 'Tarea de proyecto', '', 'fullstack', 'backlog');
    expect(addTaskSuggestion).not.toHaveBeenCalled();
  });

  it('guard: returns noTarget without calling the AI when the required scope id is missing', async () => {
    const ctx = makeCtx({ recordingId: undefined });

    const result = await runTasks(ctx, '');
    expect(result).toEqual({ success: false, error: 'chatCommands.tareas.noTarget' });
    expect(callProvider).not.toHaveBeenCalled();
  });

  it('falls back to an invalid AI layer as "general" (never persists an out-of-domain layer)', async () => {
    const ctx = makeCtx();
    callProvider.mockResolvedValue({
      text: JSON.stringify([{ title: 'Tarea rara', content: '', layer: 'not-a-real-layer' }]),
    });
    addTaskSuggestion.mockResolvedValueOnce({ id: 3, title: 'Tarea rara' });

    await runTasks(ctx, '');
    expect(addTaskSuggestion).toHaveBeenCalledWith(42, 'Tarea rara', '', 'general', true);
  });

  it('propagates cancellation as {success:true, cancelled:true} without persisting anything', async () => {
    const ctx = makeCtx();
    const cancelError = new Error('Cancelado por el usuario');
    cancelError.cancelled = true;
    callProvider.mockRejectedValue(cancelError);

    const result = await runTasks(ctx, '');
    expect(result).toEqual({ success: true, cancelled: true });
    expect(addTaskSuggestion).not.toHaveBeenCalled();
    expect(ctx.replaceHistory).not.toHaveBeenCalled();
  });
});
