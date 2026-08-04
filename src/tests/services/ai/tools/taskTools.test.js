import { describe, it, expect, vi, beforeEach } from 'vitest';

const getTaskSuggestions = vi.fn();
const getProjectTaskSuggestions = vi.fn();
const addTaskSuggestion = vi.fn();
const createProjectTask = vi.fn();
const updateTaskSuggestion = vi.fn();
const deleteTaskSuggestion = vi.fn();

vi.mock('../../../../services/recordingsService.js', () => ({
  default: {
    getTaskSuggestions,
    getProjectTaskSuggestions,
    addTaskSuggestion,
    createProjectTask,
    updateTaskSuggestion,
    deleteTaskSuggestion,
  },
}));

describe('taskTools', () => {
  let executeTool;
  let executeConfirmedAction;

  const EXISTING = [
    { id: 10, title: 'Arreglar login', content: 'Detalle A', layer: 'backend', status: 'backlog' },
    { id: 11, title: 'Arreglar dashboard', content: 'Detalle B', layer: 'frontend', status: 'in_progress' },
  ];

  const recordingContext = { scope: 'recording', recordingId: 42 };
  const projectContext = { scope: 'project', projectId: 7 };

  beforeEach(async () => {
    vi.clearAllMocks();
    ({ executeTool, executeConfirmedAction } = await import('../../../../services/ai/tools'));
  });

  describe('find_tasks', () => {
    it('returns the compact task list (recording scope) when no query is given', async () => {
      getTaskSuggestions.mockResolvedValue(EXISTING);

      const result = await executeTool('find_tasks', {}, recordingContext);

      expect(getTaskSuggestions).toHaveBeenCalledWith(42);
      expect(result).toEqual({
        tasks: [
          { id: 10, title: 'Arreglar login', layer: 'backend', status: 'backlog' },
          { id: 11, title: 'Arreglar dashboard', layer: 'frontend', status: 'in_progress' },
        ],
      });
    });

    it('filters tasks by query (case-insensitive substring on title)', async () => {
      getTaskSuggestions.mockResolvedValue(EXISTING);

      const result = await executeTool('find_tasks', { query: 'LOGIN' }, recordingContext);

      expect(result.tasks).toEqual([{ id: 10, title: 'Arreglar login', layer: 'backend', status: 'backlog' }]);
    });

    it('uses getProjectTaskSuggestions for scope "project"', async () => {
      getProjectTaskSuggestions.mockResolvedValue(EXISTING);

      const result = await executeTool('find_tasks', {}, projectContext);

      expect(getProjectTaskSuggestions).toHaveBeenCalledWith(7);
      expect(getTaskSuggestions).not.toHaveBeenCalled();
      expect(result.tasks).toHaveLength(2);
    });

    it('treats a fetch failure as "no known tasks" instead of throwing', async () => {
      getTaskSuggestions.mockRejectedValue(new Error('IPC no disponible'));

      const result = await executeTool('find_tasks', {}, recordingContext);

      expect(result).toEqual({ tasks: [] });
    });
  });

  // --- create_task: el modelo SOLO puede proponer, nunca ejecutar (el schema
  // ya no expone `confirm` — ver docstring de taskTools.js) ---
  describe('create_task (model-facing, via executeTool) — always proposes, never executes', () => {
    it('always returns confirmation_required with the proposed task and a question+options for the UI', async () => {
      const result = await executeTool('create_task', { title: 'Nueva tarea', content: 'algo', layer: 'backend' }, recordingContext);

      expect(result).toEqual({
        status: 'confirmation_required',
        proposed: { title: 'Nueva tarea', content: 'algo', layer: 'backend' },
        question: expect.any(String),
        options: ['Sí', 'No'],
        message: expect.any(String),
      });
      expect(result.question).toContain('Nueva tarea');
      expect(addTaskSuggestion).not.toHaveBeenCalled();
      expect(createProjectTask).not.toHaveBeenCalled();
    });

    it('ignores a confirm:true field even if present in args — the model-facing handler never executes', async () => {
      const result = await executeTool(
        'create_task',
        { title: 'Nueva tarea', content: 'algo', layer: 'backend', confirm: true },
        recordingContext
      );

      expect(result.status).toBe('confirmation_required');
      expect(addTaskSuggestion).not.toHaveBeenCalled();
    });

    it('falls back an invalid layer to "general" in the proposal', async () => {
      const result = await executeTool('create_task', { title: 'Tarea rara', layer: 'not-a-real-layer' }, recordingContext);

      expect(result.proposed).toEqual({ title: 'Tarea rara', content: '', layer: 'general' });
      expect(addTaskSuggestion).not.toHaveBeenCalled();
    });

    it('rejects without a title, without calling the IPC layer', async () => {
      const result = await executeTool('create_task', { title: '   ' }, recordingContext);

      expect(result).toEqual({ error: 'invalid_arguments', message: expect.any(String) });
      expect(addTaskSuggestion).not.toHaveBeenCalled();
    });
  });

  describe('update_task (model-facing, via executeTool) — always proposes, never executes', () => {
    it('rejects an invented id that is not in the fetched allowlist, without calling updateTaskSuggestion', async () => {
      getTaskSuggestions.mockResolvedValue(EXISTING);

      const result = await executeTool('update_task', { id: 999, status: 'done' }, recordingContext);

      expect(result).toEqual({ error: 'task_not_found', message: expect.any(String) });
      expect(updateTaskSuggestion).not.toHaveBeenCalled();
    });

    it('always returns confirmation_required with the merged proposal and a question+options for the UI', async () => {
      getTaskSuggestions.mockResolvedValue(EXISTING);

      const result = await executeTool('update_task', { id: 10, status: 'done' }, recordingContext);

      expect(result).toEqual({
        status: 'confirmation_required',
        proposed: { id: 10, title: 'Arreglar login', content: 'Detalle A', layer: 'backend', status: 'done' },
        question: expect.any(String),
        options: ['Sí', 'No'],
        message: expect.any(String),
      });
      expect(result.question).toContain('Arreglar login');
      expect(updateTaskSuggestion).not.toHaveBeenCalled();
    });

    it('ignores a confirm:true field even if present in args — the model-facing handler never executes', async () => {
      getTaskSuggestions.mockResolvedValue(EXISTING);

      const result = await executeTool('update_task', { id: 10, status: 'done', confirm: true }, recordingContext);

      expect(result.status).toBe('confirmation_required');
      expect(updateTaskSuggestion).not.toHaveBeenCalled();
    });

    it('falls back an invalid layer/status to safe defaults in the proposal instead of persisting garbage', async () => {
      getTaskSuggestions.mockResolvedValue(EXISTING);

      const result = await executeTool('update_task', { id: 10, layer: 'not-real', status: 'not-real' }, recordingContext);

      // status inválido -> se conserva el status existente ('backlog'); layer inválido -> 'general'
      expect(result.proposed).toEqual({ id: 10, title: 'Arreglar login', content: 'Detalle A', layer: 'general', status: 'backlog' });
      expect(updateTaskSuggestion).not.toHaveBeenCalled();
    });

    it('rejects without a valid numeric id', async () => {
      const result = await executeTool('update_task', { status: 'done' }, recordingContext);

      expect(result).toEqual({ error: 'invalid_arguments', message: expect.any(String) });
      expect(getTaskSuggestions).not.toHaveBeenCalled();
    });
  });

  describe('delete_task (model-facing, via executeTool) — always proposes, never executes', () => {
    it('rejects an invented id that is not in the fetched allowlist, without calling deleteTaskSuggestion', async () => {
      getTaskSuggestions.mockResolvedValue(EXISTING);

      const result = await executeTool('delete_task', { id: 999 }, recordingContext);

      expect(result).toEqual({ error: 'task_not_found', message: expect.any(String) });
      expect(deleteTaskSuggestion).not.toHaveBeenCalled();
    });

    it('always returns confirmation_required with a question+options for the UI', async () => {
      getTaskSuggestions.mockResolvedValue(EXISTING);

      const result = await executeTool('delete_task', { id: 10 }, recordingContext);

      expect(result).toEqual({
        status: 'confirmation_required',
        task: { id: 10, title: 'Arreglar login' },
        question: expect.any(String),
        options: ['Sí', 'No'],
        message: expect.any(String),
      });
      expect(result.question).toContain('Arreglar login');
      expect(deleteTaskSuggestion).not.toHaveBeenCalled();
    });

    it('ignores a confirm:true field even if present in args — the model-facing handler never executes', async () => {
      getTaskSuggestions.mockResolvedValue(EXISTING);

      const result = await executeTool('delete_task', { id: 10, confirm: true }, recordingContext);

      expect(result.status).toBe('confirmation_required');
      expect(deleteTaskSuggestion).not.toHaveBeenCalled();
    });
  });

  // --- Ejecutores confirmados: SOLO alcanzables vía executeConfirmedAction,
  // nunca vía executeTool (el dispatcher que consume la IA) ---
  describe('createTaskConfirmed (via executeConfirmedAction) — real execution', () => {
    it('creates a task via addTaskSuggestion for scope "recording"', async () => {
      addTaskSuggestion.mockResolvedValue({ id: 20, title: 'Nueva tarea', content: '', layer: 'backend', status: 'backlog' });

      const result = await executeConfirmedAction(
        'create_task',
        { title: 'Nueva tarea', content: 'algo', layer: 'backend' },
        recordingContext
      );

      expect(addTaskSuggestion).toHaveBeenCalledWith(42, 'Nueva tarea', 'algo', 'backend', true);
      expect(result).toEqual({ status: 'created', task: { id: 20, title: 'Nueva tarea', layer: 'backend', status: 'backlog' } });
    });

    it('creates a task via createProjectTask for scope "project"', async () => {
      createProjectTask.mockResolvedValue({ id: 21, title: 'Tarea proyecto', content: '', layer: 'fullstack', status: 'backlog' });

      await executeConfirmedAction('create_task', { title: 'Tarea proyecto', content: '', layer: 'fullstack' }, projectContext);

      expect(createProjectTask).toHaveBeenCalledWith(7, 'Tarea proyecto', '', 'fullstack', 'backlog');
    });

    it('never throws even if the IPC layer rejects unexpectedly', async () => {
      addTaskSuggestion.mockRejectedValue(new Error('boom'));

      const result = await executeConfirmedAction('create_task', { title: 'Algo', content: '', layer: 'general' }, recordingContext);

      expect(result).toEqual({ error: 'create_failed', message: 'boom' });
    });
  });

  describe('updateTaskConfirmed (via executeConfirmedAction) — real execution', () => {
    it('applies the already-merged proposal directly, without re-fetching or re-validating the allowlist', async () => {
      updateTaskSuggestion.mockResolvedValue({ id: 10, title: 'Arreglar login', content: 'Detalle A', layer: 'backend', status: 'done' });

      const result = await executeConfirmedAction(
        'update_task',
        { id: 10, title: 'Arreglar login', content: 'Detalle A', layer: 'backend', status: 'done' },
        recordingContext
      );

      expect(updateTaskSuggestion).toHaveBeenCalledWith(10, 'Arreglar login', 'Detalle A', 'backend', 'done');
      expect(getTaskSuggestions).not.toHaveBeenCalled();
      expect(result).toEqual({ status: 'updated', task: { id: 10, title: 'Arreglar login', layer: 'backend', status: 'done' } });
    });

    it('never throws even if the IPC layer rejects unexpectedly', async () => {
      updateTaskSuggestion.mockRejectedValue(new Error('boom'));

      const result = await executeConfirmedAction(
        'update_task',
        { id: 10, title: 'Arreglar login', content: 'Detalle A', layer: 'backend', status: 'done' },
        recordingContext
      );

      expect(result).toEqual({ error: 'update_failed', message: 'boom' });
    });
  });

  describe('deleteTaskConfirmed (via executeConfirmedAction) — real execution', () => {
    it('deletes directly using the given id, without re-fetching or re-validating the allowlist', async () => {
      deleteTaskSuggestion.mockResolvedValue(true);

      const result = await executeConfirmedAction('delete_task', { id: 10, title: 'Arreglar login' }, recordingContext);

      expect(deleteTaskSuggestion).toHaveBeenCalledWith(10);
      expect(getTaskSuggestions).not.toHaveBeenCalled();
      expect(result).toEqual({ status: 'deleted', task: { id: 10, title: 'Arreglar login' } });
    });

    it('never throws even if the IPC layer rejects unexpectedly', async () => {
      deleteTaskSuggestion.mockRejectedValue(new Error('boom'));

      const result = await executeConfirmedAction('delete_task', { id: 10, title: 'Arreglar login' }, recordingContext);

      expect(result).toEqual({ error: 'delete_failed', message: 'boom' });
    });
  });

  describe('unknown function', () => {
    it('executeTool returns {error: "unknown_function"} without throwing', async () => {
      const result = await executeTool('delete_everything', {}, recordingContext);

      expect(result).toEqual({ error: 'unknown_function', message: expect.any(String) });
    });

    it('executeConfirmedAction returns {error: "unknown_function"} for a tool with no confirmed executor', async () => {
      const result = await executeConfirmedAction('find_tasks', {}, recordingContext);

      expect(result).toEqual({ error: 'unknown_function', message: expect.any(String) });
    });
  });

  describe('defensive error handling', () => {
    it('never throws even if the IPC layer rejects unexpectedly during find_tasks', async () => {
      getTaskSuggestions.mockRejectedValue(new Error('boom'));

      const result = await executeTool('find_tasks', {}, recordingContext);

      expect(result).toEqual({ tasks: [] });
    });
  });
});
