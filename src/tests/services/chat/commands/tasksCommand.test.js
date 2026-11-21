import { describe, it, expect, vi, beforeEach } from 'vitest';

const callProvider = vi.fn();
const addTaskSuggestion = vi.fn();
const createProjectTask = vi.fn();
const getTaskSuggestions = vi.fn();
const getProjectTaskSuggestions = vi.fn();
const updateTaskSuggestion = vi.fn();
const deleteTaskSuggestion = vi.fn();
const getStatus = vi.fn();
const search = vi.fn();

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
    getTaskSuggestions,
    getProjectTaskSuggestions,
    updateTaskSuggestion,
    deleteTaskSuggestion,
  },
}));

// Mismo patrón de mock que searchCommand.test.js: gatherTaskContext (commands/_shared.js)
// reutiliza ragService para el fallback RAG cuando el chat es nuevo/corto.
vi.mock('../../../../services/ragService.js', () => ({
  default: { getStatus, search },
}));

describe('runTasks (/tareas)', () => {
  let runTasks;
  let GENERIC_TASK_QUERY;

  beforeEach(async () => {
    vi.clearAllMocks();
    ({ runTasks } = await import('../../../../services/chat/commands/tasksCommand.js'));
    ({ GENERIC_TASK_QUERY } = await import('../../../../services/chat/commands/_shared.js'));
  });

  // 2 mensajes reales = "chat rico" (>= MIN_SUMMARY_HISTORY_MESSAGES): gatherTaskContext
  // usa el chat directamente, sin tocar ragService — comportamiento histórico sin cambios.
  const richHistory = [
    { id: 'u1', tipo: 'usuario', contenido: 'Necesitamos arreglar el login y el dashboard.' },
    { id: 'a1', tipo: 'asistente', contenido: 'Entendido, lo anoto.' },
  ];

  function makeCtx(overrides = {}) {
    return {
      getHistory: () => richHistory,
      replaceHistory: vi.fn().mockResolvedValue(undefined),
      lang: 'es',
      scope: 'recording',
      model: undefined,
      recordingId: 42,
      projectId: undefined,
      ragRecordingId: undefined,
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
    expect(getStatus).not.toHaveBeenCalled(); // chat rico: nunca se intenta el fallback RAG

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

  it('still includes the "USER FOCUS" block when the chat is rich enough (unchanged behavior)', async () => {
    const ctx = makeCtx();
    callProvider.mockResolvedValue({ text: '[]' });

    await runTasks(ctx, 'céntrate en el backend');

    const [prompt] = callProvider.mock.calls[0];
    expect(prompt).toContain('USER FOCUS');
    expect(prompt).toContain('céntrate en el backend');
  });

  it('guard: returns noTarget without calling the AI when the required scope id is missing, and posts a visible error to the chat history', async () => {
    const ctx = makeCtx({ recordingId: undefined });

    const result = await runTasks(ctx, '');
    expect(result).toEqual({ success: false, error: 'chatCommands.tareas.noTarget' });
    expect(callProvider).not.toHaveBeenCalled();

    // Regresión Parte B: runsInBackground hace que nadie espere esta promesa desde
    // useChatCommands — el único aviso real que le llega al usuario es este mensaje.
    const [entries] = ctx.replaceHistory.mock.calls[0];
    expect(entries[entries.length - 1].tipo).toBe('asistente');
    expect(entries[entries.length - 1].contenido).toContain('chatCommands.tareas.noTarget');
  });

  it('guard: returns tooShort and posts a visible error when neither the chat nor a RAG fallback have any content', async () => {
    const ctx = makeCtx({ getHistory: () => [] }); // sin ragRecordingId: no hay a qué caer

    const result = await runTasks(ctx, '');
    expect(result).toEqual({ success: false, error: 'chatCommands.tareas.tooShort' });
    expect(callProvider).not.toHaveBeenCalled();

    const [entries] = ctx.replaceHistory.mock.calls[0];
    expect(entries[entries.length - 1].contenido).toContain('chatCommands.tareas.tooShort');
  });

  it('regression (bug fix): falls back to RAG when the chat is new/empty but the recording is indexed — no longer "too short"', async () => {
    const ctx = makeCtx({ getHistory: () => [], ragRecordingId: 'folder-42' });
    getStatus.mockResolvedValue({ success: true, indexed: true });
    search.mockResolvedValue({
      success: true,
      chunks: [{ textDisplay: 'Se decidió migrar la base de datos a Postgres.', startTime: 10, endTime: 20 }],
    });
    callProvider.mockResolvedValue({
      text: JSON.stringify([{ title: 'Migrar a Postgres', content: '', layer: 'backend' }]),
    });
    addTaskSuggestion.mockResolvedValueOnce({ id: 1, title: 'Migrar a Postgres' });

    const result = await runTasks(ctx, '');

    expect(result).toEqual({ success: true });
    expect(search).toHaveBeenCalledWith('folder-42', GENERIC_TASK_QUERY, 40);
    expect(addTaskSuggestion).toHaveBeenCalledTimes(1);
  });

  it('regression: uses `args` as the RAG query instead of the generic fallback when the user gives an explicit focus', async () => {
    const ctx = makeCtx({ getHistory: () => [], ragRecordingId: 'folder-42' });
    getStatus.mockResolvedValue({ success: true, indexed: true });
    search.mockResolvedValue({ success: true, chunks: [{ textDisplay: 'chunk relevante' }] });
    callProvider.mockResolvedValue({ text: '[]' });

    await runTasks(ctx, 'céntrate en el backend');

    expect(search).toHaveBeenCalledWith('folder-42', 'céntrate en el backend', 40);
  });

  it('does not duplicate the user focus as a "USER FOCUS" block when it was already consumed as the RAG query', async () => {
    const ctx = makeCtx({ getHistory: () => [], ragRecordingId: 'folder-42' });
    getStatus.mockResolvedValue({ success: true, indexed: true });
    search.mockResolvedValue({ success: true, chunks: [{ textDisplay: 'chunk relevante' }] });
    callProvider.mockResolvedValue({ text: '[]' });

    await runTasks(ctx, 'céntrate en el backend');

    const [prompt] = callProvider.mock.calls[0];
    expect(prompt).not.toContain('USER FOCUS');
  });

  it('scope project: never attempts the RAG fallback and uses whatever short chat exists without blocking (documented limitation — no lightweight project RAG mechanism)', async () => {
    const ctx = makeCtx({
      scope: 'project',
      recordingId: undefined,
      projectId: 7,
      getHistory: () => [{ id: 'u1', tipo: 'usuario', contenido: 'hola' }], // 1 mensaje: por debajo del umbral de "chat rico"
    });
    callProvider.mockResolvedValue({
      text: JSON.stringify([{ title: 'Tarea corta', content: '', layer: 'general' }]),
    });
    createProjectTask.mockResolvedValueOnce({ id: 1, title: 'Tarea corta' });

    const result = await runTasks(ctx, '');

    expect(result).toEqual({ success: true });
    expect(getStatus).not.toHaveBeenCalled();
    expect(createProjectTask).toHaveBeenCalled();
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

  it('propagates cancellation as {success:true, cancelled:true} without persisting anything or touching the history', async () => {
    const ctx = makeCtx();
    const cancelError = new Error('Cancelado por el usuario');
    cancelError.cancelled = true;
    callProvider.mockRejectedValue(cancelError);

    const result = await runTasks(ctx, '');
    expect(result).toEqual({ success: true, cancelled: true });
    expect(addTaskSuggestion).not.toHaveBeenCalled();
    expect(ctx.replaceHistory).not.toHaveBeenCalled();
  });

  it('a real AI failure (not cancelled) posts a visible error to the chat history', async () => {
    const ctx = makeCtx();
    callProvider.mockRejectedValue(new Error('boom'));

    const result = await runTasks(ctx, '');
    expect(result).toEqual({ success: false, error: 'chatCommands.tareas.error' });
    const [entries] = ctx.replaceHistory.mock.calls[0];
    expect(entries[entries.length - 1].contenido).toContain('chatCommands.tareas.error');
  });

  // --- Acciones create/update/delete (guarda de seguridad) -----------------------------

  const EXISTING = [
    { id: 10, title: 'Tarea A', content: 'Contenido A', layer: 'backend', status: 'backlog' },
    { id: 11, title: 'Tarea B', content: 'Contenido B', layer: 'frontend', status: 'in_progress' },
  ];

  it('happy path: with explicit args, a mixed create+update+delete AI response executes all three and the summary has all three sections', async () => {
    const ctx = makeCtx();
    getTaskSuggestions.mockResolvedValue(EXISTING);
    callProvider.mockResolvedValue({
      text: JSON.stringify([
        { action: 'create', title: 'Tarea nueva', content: '', layer: 'backend' },
        { action: 'update', id: 10, status: 'done' },
        { action: 'delete', id: 11 },
      ]),
    });
    addTaskSuggestion.mockResolvedValueOnce({ id: 20, title: 'Tarea nueva' });
    updateTaskSuggestion.mockResolvedValueOnce({ id: 10, title: 'Tarea A' });
    deleteTaskSuggestion.mockResolvedValueOnce(true);

    const result = await runTasks(ctx, 'marca la tarea A como hecha y borra la B');

    expect(result).toEqual({ success: true });
    expect(addTaskSuggestion).toHaveBeenCalledWith(42, 'Tarea nueva', '', 'backend', true);
    expect(updateTaskSuggestion).toHaveBeenCalledWith(10, 'Tarea A', 'Contenido A', 'backend', 'done');
    expect(deleteTaskSuggestion).toHaveBeenCalledWith(11);

    const [entries] = ctx.replaceHistory.mock.calls[0];
    const summary = entries[entries.length - 1].contenido;
    expect(summary).toContain('chatCommands.tareas.summaryHeader:1');
    expect(summary).toContain('chatCommands.tareas.updatedHeader:1');
    expect(summary).toContain('chatCommands.tareas.deletedHeader:1');
    expect(summary).not.toContain('discardedNotice');
  });

  it('guard: without explicit args, update/delete actions are discarded (never called) while create actions in the same response still execute', async () => {
    const ctx = makeCtx();
    getTaskSuggestions.mockResolvedValue(EXISTING);
    callProvider.mockResolvedValue({
      text: JSON.stringify([
        { action: 'create', title: 'Tarea nueva', content: '', layer: 'backend' },
        { action: 'update', id: 10, status: 'done' },
        { action: 'delete', id: 11 },
      ]),
    });
    addTaskSuggestion.mockResolvedValueOnce({ id: 20, title: 'Tarea nueva' });

    const result = await runTasks(ctx, ''); // sin instrucciones explícitas

    expect(result).toEqual({ success: true });
    expect(addTaskSuggestion).toHaveBeenCalledWith(42, 'Tarea nueva', '', 'backend', true);
    expect(updateTaskSuggestion).not.toHaveBeenCalled();
    expect(deleteTaskSuggestion).not.toHaveBeenCalled();

    const [entries] = ctx.replaceHistory.mock.calls[0];
    const summary = entries[entries.length - 1].contenido;
    expect(summary).toContain('chatCommands.tareas.summaryHeader:1');
    expect(summary).toContain('chatCommands.tareas.discardedNotice:2');
  });

  it('guard: with explicit args, an update/delete targeting an id NOT in the fetched existing tasks is discarded even though the rest execute normally', async () => {
    const ctx = makeCtx();
    getTaskSuggestions.mockResolvedValue(EXISTING);
    callProvider.mockResolvedValue({
      text: JSON.stringify([
        { action: 'update', id: 999, status: 'done' }, // id inventado por la IA
        { action: 'delete', id: 10 }, // id real
      ]),
    });
    deleteTaskSuggestion.mockResolvedValueOnce(true);

    const result = await runTasks(ctx, 'borra la tarea A');

    expect(result).toEqual({ success: true });
    expect(updateTaskSuggestion).not.toHaveBeenCalled();
    expect(deleteTaskSuggestion).toHaveBeenCalledWith(10);

    const [entries] = ctx.replaceHistory.mock.calls[0];
    const summary = entries[entries.length - 1].contenido;
    expect(summary).toContain('chatCommands.tareas.deletedHeader:1');
    expect(summary).toContain('chatCommands.tareas.discardedNotice:1');
  });

  it('partial update: an AI response with only {action, id, status} calls updateTaskSuggestion preserving the original title/content/layer', async () => {
    const ctx = makeCtx();
    getTaskSuggestions.mockResolvedValue(EXISTING);
    callProvider.mockResolvedValue({
      text: JSON.stringify([{ action: 'update', id: 10, status: 'done' }]),
    });
    updateTaskSuggestion.mockResolvedValueOnce({ id: 10, title: 'Tarea A' });

    await runTasks(ctx, 'marca la tarea A como hecha');

    expect(updateTaskSuggestion).toHaveBeenCalledWith(10, 'Tarea A', 'Contenido A', 'backend', 'done');
  });

  it('fetches existing tasks via getProjectTaskSuggestions for scope "project" instead of getTaskSuggestions', async () => {
    const ctx = makeCtx({ scope: 'project', recordingId: undefined, projectId: 7 });
    getProjectTaskSuggestions.mockResolvedValue(EXISTING);
    callProvider.mockResolvedValue({
      text: JSON.stringify([{ action: 'delete', id: 10 }]),
    });
    deleteTaskSuggestion.mockResolvedValueOnce(true);

    await runTasks(ctx, 'borra la tarea A');

    expect(getProjectTaskSuggestions).toHaveBeenCalledWith(7);
    expect(getTaskSuggestions).not.toHaveBeenCalled();
    expect(deleteTaskSuggestion).toHaveBeenCalledWith(10);
  });

  it('a failure fetching existing tasks does not abort the command: falls back to create-only (update/delete have no known ids to match)', async () => {
    const ctx = makeCtx();
    getTaskSuggestions.mockRejectedValue(new Error('IPC no disponible'));
    callProvider.mockResolvedValue({
      text: JSON.stringify([
        { action: 'create', title: 'Tarea nueva', content: '', layer: 'backend' },
        { action: 'update', id: 10, status: 'done' },
      ]),
    });
    addTaskSuggestion.mockResolvedValueOnce({ id: 20, title: 'Tarea nueva' });

    const result = await runTasks(ctx, 'marca la tarea A como hecha');

    expect(result).toEqual({ success: true });
    expect(addTaskSuggestion).toHaveBeenCalledWith(42, 'Tarea nueva', '', 'backend', true);
    expect(updateTaskSuggestion).not.toHaveBeenCalled(); // id 10 desconocido: no se pudo fetchear
  });
});
