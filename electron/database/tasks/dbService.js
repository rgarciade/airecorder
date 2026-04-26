// Task Suggestions & Comments — base de datos
const BaseDbService = require('../baseDbService');
const {
  CREATE_TABLE_TASK_SUGGESTIONS,
  INSERT_TASK_SUGGESTION,
  INSERT_PROJECT_TASK,
  ADD_TASK_TO_PROJECT,
  REMOVE_TASK_FROM_PROJECT,
  UPDATE_TASK_SUGGESTION,
  DELETE_TASK_SUGGESTION,
  SELECT_TASK_SUGGESTIONS,
  SELECT_TASK_SUGGESTIONS_BY_PROJECT,
  CREATE_TABLE_TASK_COMMENTS,
  INSERT_TASK_COMMENT,
  SELECT_TASK_COMMENTS,
  DELETE_TASK_COMMENT
} = require('./queries');

class TasksDbService extends BaseDbService {
  constructor(db) {
    super(db, 'tasks');
  }

  // ── Tablas ──────────────────────────────────────────────────────────────────

  init() {
    this.db.prepare(CREATE_TABLE_TASK_SUGGESTIONS).run();
    this.db.prepare(CREATE_TABLE_TASK_COMMENTS).run();
  }

  // ── Tareas ─────────────────────────────────────────────────────────────────

  getTaskSuggestions(recordingId) {
    return this._getMany(SELECT_TASK_SUGGESTIONS, [recordingId]);
  }

  getTaskSuggestionsByProject(projectId) {
    return this._getMany(SELECT_TASK_SUGGESTIONS_BY_PROJECT, [projectId]);
  }

  addTaskSuggestion(recordingId, title, content, layer = 'general', createdByAi = 1) {
    const result = this._insert(INSERT_TASK_SUGGESTION,
      [recordingId, title, content || '', layer || 'general', createdByAi ? 1 : 0]);
    if (!result.success) return null;
    return this._getOne('SELECT * FROM task_suggestions WHERE id = ?', [result.id], null);
  }

  updateTaskSuggestion(id, title, content, layer = 'general', status = 'backlog') {
    const modified = this._modify(UPDATE_TASK_SUGGESTION,
      [title, content || '', layer || 'general', status || 'backlog', id]);
    if (!modified.success) return null;
    return this._getOne('SELECT * FROM task_suggestions WHERE id = ?', [id], null);
  }

  deleteTaskSuggestion(id) {
    return this._run(DELETE_TASK_SUGGESTION, [id]);
  }

  createProjectTask(projectId, title, content, layer = 'general', status = 'backlog') {
    const result = this._insert(INSERT_PROJECT_TASK,
      [projectId, title, content || '', layer || 'general', status || 'backlog']);
    if (!result.success) return null;
    return this._getOne('SELECT * FROM task_suggestions WHERE id = ?', [result.id], null);
  }

  addTaskToProject(taskId, projectId) {
    const modified = this._modify(ADD_TASK_TO_PROJECT, [projectId, taskId]);
    if (!modified.success) return null;
    return this._getOne('SELECT * FROM task_suggestions WHERE id = ?', [taskId], null);
  }

  removeTaskFromProject(taskId) {
    return this._run(REMOVE_TASK_FROM_PROJECT, [taskId]);
  }

  updateTasksSortOrder(updates) {
    if (!updates?.length) return;
    const stmt = this.db.prepare(
      'UPDATE task_suggestions SET sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    );
    const runAll = this.db.transaction((rows) => {
      for (const row of rows) stmt.run(row.sort_order, row.id);
    });
    runAll(updates);
  }

  // ── Comentarios ────────────────────────────────────────────────────────────

  getTaskComments(taskId) {
    return this._getMany(SELECT_TASK_COMMENTS, [taskId]);
  }

  addTaskComment(taskId, content) {
    const result = this._insert(INSERT_TASK_COMMENT, [taskId, content]);
    if (!result.success) return null;
    return this._getOne('SELECT * FROM task_comments WHERE id = ?', [result.id], null);
  }

  deleteTaskComment(id) {
    return this._run(DELETE_TASK_COMMENT, [id]);
  }
}

module.exports = TasksDbService;