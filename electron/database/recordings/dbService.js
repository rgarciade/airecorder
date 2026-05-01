// Recordings & Transcription Queue — base de datos
const BaseDbService = require('../baseDbService');
const {
  CREATE_TABLE_RECORDINGS,
  INSERT_OR_UPDATE_RECORDING,
  UPDATE_STATUS,
  UPDATE_TRANSCRIPTION_MODEL,
  UPDATE_DURATION,
  GET_DASHBOARD_STATS,
  SELECT_ALL_RECORDINGS,
  SELECT_BY_PATH,
  SELECT_BY_ID,
  DELETE_BY_PATH,
  CREATE_TABLE_QUEUE,
  INSERT_QUEUE_TASK,
  UPDATE_QUEUE_TASK,
  UPDATE_QUEUE_TASK_WITH_START,
  RESET_STUCK_TASKS,
  GET_NEXT_QUEUE_TASK,
  GET_ACTIVE_QUEUE_TASKS,
  GET_QUEUE_HISTORY,
  GET_TASK_STATUS_BY_RECORDING,
  GET_TASK_BY_ID
} = require('./queries');

class RecordingsDbService extends BaseDbService {
  constructor(db) {
    super(db, 'recordings');
  }

  // ── Tablas ──────────────────────────────────────────────────────────────────

  init() {
    this.db.prepare(CREATE_TABLE_RECORDINGS).run();
    this.db.prepare(CREATE_TABLE_QUEUE).run();
  }

  // ── Grabaciones ────────────────────────────────────────────────────────────

  saveRecording(relativePath, duration, status = 'recorded', createdAt = null, transcriptionModel = null, source = null) {
    const date = createdAt || new Date().toISOString();
    // Default para source: 'audio' si no se especifica (para grabaciones normales)
    const sourceValue = source || 'audio';
    const result = this._insert(INSERT_OR_UPDATE_RECORDING, [relativePath, duration, status, transcriptionModel, sourceValue, date]);
    if (!result.success) return result;

    let id = result.id;
    if (id === 0 || id === undefined) {
      const existing = this.getRecording(relativePath);
      id = existing ? existing.id : null;
    }
    return { success: true, id };
  }

  updateTranscriptionModel(relativePath, model) {
    return this._run(UPDATE_TRANSCRIPTION_MODEL, [model, relativePath]);
  }

  updateDuration(relativePath, duration) {
    return this._run(UPDATE_DURATION, [duration, relativePath]);
  }

  updateStatus(relativePath, status) {
    return this._run(UPDATE_STATUS, [status, relativePath]);
  }

  getDashboardStats() {
    const result = this._getOne(GET_DASHBOARD_STATS, [], {
      totalSeconds: 0, totalTranscriptions: 0, totalRecordings: 0, weekSeconds: 0
    });
    return {
      totalHours: result.totalSeconds ? (result.totalSeconds / 3600).toFixed(1) : "0.0",
      totalTranscriptions: result.totalTranscriptions,
      totalRecordings: result.totalRecordings,
      weekHours: result.weekSeconds ? (result.weekSeconds / 3600).toFixed(1) : "0.0"
    };
  }

  getAllRecordings() {
    return this._getMany(SELECT_ALL_RECORDINGS);
  }

  getRecording(relativePath) {
    return this._getOne(SELECT_BY_PATH, [relativePath], null);
  }

  getRecordingById(id) {
    return this._getOne(SELECT_BY_ID, [id], null);
  }

  deleteRecording(relativePath) {
    return this._run(DELETE_BY_PATH, [relativePath]);
  }

  // ── Cola de transcripción ─────────────────────────────────────────────────

  enqueueTask(recordingId, model = null) {
    const result = this._insert(INSERT_QUEUE_TASK, [recordingId, model]);
    return result.success ? result.id : null;
  }

  updateTask(id, status, step, progress, error = null) {
    const query = status === 'processing' && progress === 10
      ? UPDATE_QUEUE_TASK_WITH_START
      : UPDATE_QUEUE_TASK;
    return this._run(query, [status, step, progress, error, id]);
  }

  getNextTask() {
    return this._getOne(GET_NEXT_QUEUE_TASK, [], null);
  }

  getActiveQueue() {
    return this._getMany(GET_ACTIVE_QUEUE_TASKS);
  }

  getQueueHistory() {
    return this._getMany(GET_QUEUE_HISTORY);
  }

  getRecordingTaskStatus(recordingId) {
    return this._getOne(GET_TASK_STATUS_BY_RECORDING, [recordingId], null);
  }

  getTaskById(id) {
    return this._getOne(GET_TASK_BY_ID, [id], null);
  }

  resetStuckTasks() {
    return this._run(RESET_STUCK_TASKS, []);
  }
}

module.exports = RecordingsDbService;