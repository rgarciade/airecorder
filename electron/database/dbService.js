const Database = require('better-sqlite3');
const {
  CREATE_TABLE_RECORDINGS,
  INSERT_OR_UPDATE_RECORDING,
  UPDATE_STATUS,
  GET_DASHBOARD_STATS,
  SELECT_ALL_RECORDINGS,
  SELECT_BY_PATH,
  SELECT_BY_ID,
  DELETE_BY_PATH,
  CREATE_TABLE_PROJECTS,
  CREATE_TABLE_PROJECT_RECORDINGS,
  INSERT_PROJECT,
  UPDATE_PROJECT,
  UPDATE_PROJECT_SYNC_STATUS,
  DELETE_PROJECT,
  SELECT_ALL_PROJECTS,
  SELECT_PROJECT_BY_ID,
  INSERT_PROJECT_RECORDING,
  DELETE_PROJECT_RECORDING,
  SELECT_PROJECT_RECORDING_IDS,
  SELECT_RECORDING_PROJECT,
  GET_PROJECT_TOTAL_DURATION,
  CREATE_TABLE_CHATS,
  CREATE_TABLE_MESSAGES,
  CREATE_TABLE_QUEUE,
  INSERT_CHAT,
  UPDATE_CHAT_TIME,
  SELECT_PROJECT_CHATS,
  DELETE_CHAT,
  INSERT_MESSAGE,
  SELECT_CHAT_MESSAGES,
  DELETE_CHAT_MESSAGES,
  INSERT_QUEUE_TASK,
  UPDATE_QUEUE_TASK,
  UPDATE_QUEUE_TASK_WITH_START,
  RESET_STUCK_TASKS,
  GET_NEXT_QUEUE_TASK,
  GET_ACTIVE_QUEUE_TASKS,
  GET_QUEUE_HISTORY,
  GET_TASK_STATUS_BY_RECORDING,
  UPDATE_TRANSCRIPTION_MODEL,
  UPDATE_DURATION,
  CREATE_TABLE_TASK_SUGGESTIONS,
  INSERT_TASK_SUGGESTION,
  UPDATE_TASK_SUGGESTION,
  DELETE_TASK_SUGGESTION,
  SELECT_TASK_SUGGESTIONS
} = require('./queries');

class DbService {
  constructor() {
    this.db = null;
  }

  init(dbPath) {
    try {
      this.db = new Database(dbPath);
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('foreign_keys = ON');
      
      // Inicializar todas las tablas
      this.db.prepare(CREATE_TABLE_RECORDINGS).run();
      this.db.prepare(CREATE_TABLE_PROJECTS).run();
      
      // Migración para añadir transcription_model a recordings si no existe
      try {
        const tableInfo = this.db.prepare("PRAGMA table_info(recordings)").all();
        if (!tableInfo.some(c => c.name === 'transcription_model')) {
          console.log('[DB] Añadiendo columna transcription_model a la tabla recordings...');
          this.db.prepare("ALTER TABLE recordings ADD COLUMN transcription_model TEXT").run();
        }
      } catch (e) {
        console.error('[DB] Error migrando recordings:', e);
      }

      this.db.prepare(CREATE_TABLE_QUEUE).run();
      
      // Migración para añadir model a transcription_queue si no existe
      try {
        const tableInfo = this.db.prepare("PRAGMA table_info(transcription_queue)").all();
        if (!tableInfo.some(c => c.name === 'model')) {
          console.log('[DB] Añadiendo columna model a la tabla transcription_queue...');
          this.db.prepare("ALTER TABLE transcription_queue ADD COLUMN model TEXT").run();
        }
        if (!tableInfo.some(c => c.name === 'started_at')) {
          console.log('[DB] Añadiendo columna started_at a la tabla transcription_queue...');
          this.db.prepare("ALTER TABLE transcription_queue ADD COLUMN started_at DATETIME").run();
        }
      } catch (e) {
        console.error('[DB] Error migrando queue:', e);
      }
      
      // Limpiar tareas atascadas al arrancar
      this.db.prepare(RESET_STUCK_TASKS).run();
      
      // Migración para añadir is_updated a projects si no existe
      try {
        const tableInfo = this.db.prepare("PRAGMA table_info(projects)").all();
        if (!tableInfo.some(c => c.name === 'is_updated')) {
          console.log('[DB] Añadiendo columna is_updated a la tabla projects...');
          this.db.prepare("ALTER TABLE projects ADD COLUMN is_updated INTEGER DEFAULT 1").run();
        }
      } catch (e) {
        console.error('[DB] Error añadiendo is_updated:', e);
      }
      
      // Migración para project_recordings (asegurar PK en recording_id y FK correcta)
      try {
        const tableInfo = this.db.prepare("PRAGMA table_info(project_recordings)").all();
        if (tableInfo.length > 0) {
          const hasRecordingId = tableInfo.some(c => c.name === 'recording_id');
          if (!hasRecordingId) {
            console.log('[DB] Migrando project_recordings de recording_path a recording_id...');
            // Backup data
            const oldData = this.db.prepare("SELECT * FROM project_recordings").all();
            this.db.prepare("DROP TABLE project_recordings").run();
            this.db.prepare(CREATE_TABLE_PROJECT_RECORDINGS).run();
            
            // Restore data mapping paths to IDs
            const insert = this.db.prepare("INSERT OR REPLACE INTO project_recordings (project_id, recording_id, created_at) VALUES (?, ?, ?)");
            for (const row of oldData) {
              const rec = this.db.prepare("SELECT id FROM recordings WHERE relative_path = ?").get(row.recording_path);
              if (rec) {
                insert.run(row.project_id, rec.id, row.created_at);
              }
            }
          }
        } else {
          this.db.prepare(CREATE_TABLE_PROJECT_RECORDINGS).run();
        }
      } catch (e) {
        console.error('[DB] Error migrando project_recordings:', e);
        this.db.prepare(CREATE_TABLE_PROJECT_RECORDINGS).run();
      }
      
      this.db.prepare(CREATE_TABLE_CHATS).run();
      this.db.prepare(CREATE_TABLE_MESSAGES).run();
      this.db.prepare(CREATE_TABLE_TASK_SUGGESTIONS).run();

      // Migración para añadir layer a task_suggestions si no existe
      try {
        const tsInfo = this.db.prepare("PRAGMA table_info(task_suggestions)").all();
        if (tsInfo.length > 0 && !tsInfo.some(c => c.name === 'layer')) {
          console.log('[DB] Añadiendo columna layer a task_suggestions...');
          this.db.prepare("ALTER TABLE task_suggestions ADD COLUMN layer TEXT DEFAULT 'general'").run();
        }
      } catch (e) {
        console.error('[DB] Error migrando task_suggestions:', e);
      }

      // Migración para añadir rag_status a recordings (para RAG)
      try {
        const recInfo = this.db.prepare("PRAGMA table_info(recordings)").all();
        if (!recInfo.some(c => c.name === 'rag_status')) {
          console.log('[DB] Añadiendo columna rag_status a recordings...');
          this.db.prepare("ALTER TABLE recordings ADD COLUMN rag_status TEXT").run();
        }
      } catch (e) {
        console.error('[DB] Error migrando rag_status:', e);
      }

      console.log(`[DB] Inicializada en: ${dbPath}`);
      return true;
    } catch (error) {
      console.error('[DB] Error init:', error);
      return false;
    }
  }

  // Guardar o actualizar grabación
  saveRecording(relativePath, duration, status = 'recorded', createdAt = null, transcriptionModel = null) {
    if (!this.db) return { success: false };
    try {
      const date = createdAt || new Date().toISOString();
      const stmt = this.db.prepare(INSERT_OR_UPDATE_RECORDING);
      const info = stmt.run(relativePath, duration, status, transcriptionModel, date);
      
      // Intentar obtener el ID (ya sea por lastInsertRowid o buscando si ya existía)
      let id = info.lastInsertRowid;
      if (id === 0 || id === undefined) {
        const existing = this.getRecording(relativePath);
        id = existing ? existing.id : null;
      }
      
      return { success: true, id };
    } catch (error) {
      console.error('[DB] Error saveRecording:', error);
      return { success: false, error: error.message };
    }
  }

  // Actualizar modelo de transcripción
  updateTranscriptionModel(relativePath, model) {
    if (!this.db) return { success: false };
    try {
      const stmt = this.db.prepare(UPDATE_TRANSCRIPTION_MODEL);
      stmt.run(model, relativePath);
      return { success: true };
    } catch (error) {
      console.error('[DB] Error updateTranscriptionModel:', error);
      return { success: false, error: error.message };
    }
  }

  // Actualizar duración
  updateDuration(relativePath, duration) {
    if (!this.db) return { success: false };
    try {
      const stmt = this.db.prepare(UPDATE_DURATION);
      stmt.run(duration, relativePath);
      return { success: true };
    } catch (error) {
      console.error('[DB] Error updateDuration:', error);
      return { success: false, error: error.message };
    }
  }

  // Actualizar estado (transcribed, analyzed)
  updateStatus(relativePath, status) {
    if (!this.db) return { success: false };
    try {
      const stmt = this.db.prepare(UPDATE_STATUS);
      stmt.run(status, relativePath);
      return { success: true };
    } catch (error) {
      console.error('[DB] Error updateStatus:', error);
      return { success: false, error: error.message };
    }
  }

  // Obtener estadísticas
  getDashboardStats() {
    if (!this.db) return { totalHours: 0, totalTranscriptions: 0, totalRecordings: 0 };
    try {
      const stmt = this.db.prepare(GET_DASHBOARD_STATS);
      const result = stmt.get();
      // Convertir segundos a horas formateadas (ej: 1.5)
      const totalHours = result.totalSeconds ? (result.totalSeconds / 3600).toFixed(1) : "0.0";
      return {
        totalHours,
        totalTranscriptions: result.totalTranscriptions,
        totalRecordings: result.totalRecordings
      };
    } catch (error) {
      console.error('[DB] Error getStats:', error);
      return { totalHours: 0, totalTranscriptions: 0, totalRecordings: 0 };
    }
  }

  getAllRecordings() {
    if (!this.db) return [];
    return this.db.prepare(SELECT_ALL_RECORDINGS).all();
  }

  getRecording(relativePath) {
    if (!this.db) return null;
    return this.db.prepare(SELECT_BY_PATH).get(relativePath);
  }

  getRecordingById(id) {
    if (!this.db) return null;
    const { SELECT_BY_ID } = require('./queries'); // Asegurar acceso a la consulta
    return this.db.prepare(SELECT_BY_ID).get(id);
  }

  deleteRecording(relativePath) {
    if (!this.db) return;
    this.db.prepare(DELETE_BY_PATH).run(relativePath);
  }

  // PROYECTOS
  getAllProjects() {
    if (!this.db) return [];
    const projects = this.db.prepare(SELECT_ALL_PROJECTS).all();
    return projects.map(p => ({ ...p, members: JSON.parse(p.members || '[]') }));
  }

  getProjectById(id) {
    if (!this.db) return null;
    const project = this.db.prepare(SELECT_PROJECT_BY_ID).get(id);
    if (!project) return null;
    return { ...project, members: JSON.parse(project.members || '[]') };
  }

  createProject(name, description = '', members = []) {
    if (!this.db) return null;
    const stmt = this.db.prepare(INSERT_PROJECT);
    const info = stmt.run(name, description, JSON.stringify(members));
    return this.getProjectById(info.lastInsertRowid);
  }

  updateProject(id, name, description, members) {
    if (!this.db) return null;
    const stmt = this.db.prepare(UPDATE_PROJECT);
    stmt.run(name, description, JSON.stringify(members), id);
    return this.getProjectById(id);
  }

  deleteProject(id) {
    if (!this.db) return;
    this.db.prepare(DELETE_PROJECT).run(id);
  }

  updateProjectSyncStatus(projectId, status) {
    if (!this.db) return;
    this.db.prepare(UPDATE_PROJECT_SYNC_STATUS).run(status, projectId);
  }

  // RELACIONES PROYECTO-GRABACIÓN
  addRecordingToProject(projectId, recordingId) {
    if (!this.db) return;
    this.db.prepare(INSERT_PROJECT_RECORDING).run(projectId, recordingId);
    // Marcar proyecto como "desactualizado"
    this.updateProjectSyncStatus(projectId, 0);
  }

  removeRecordingFromProject(projectId, recordingId) {
    if (!this.db) return;
    this.db.prepare(DELETE_PROJECT_RECORDING).run(projectId, recordingId);
    // Marcar proyecto como "desactualizado"
    this.updateProjectSyncStatus(projectId, 0);
  }

  getProjectRecordingIds(projectId) {
    if (!this.db) return [];
    return this.db.prepare(SELECT_PROJECT_RECORDING_IDS).all(projectId).map(r => r.recording_id);
  }

  getRecordingProject(recordingId) {
    if (!this.db) return null;
    // Si recibimos un string, intentamos buscar por path para retrocompatibilidad interna en main.js
    let id = recordingId;
    if (typeof recordingId === 'string' && isNaN(Number(recordingId))) {
      const rec = this.getRecording(recordingId);
      if (!rec) return null;
      id = rec.id;
    }
    
    const project = this.db.prepare(SELECT_RECORDING_PROJECT).get(id);
    if (!project) return null;
    return { ...project, members: JSON.parse(project.members || '[]') };
  }

  getProjectTotalDuration(projectId) {
    if (!this.db) return 0;
    const result = this.db.prepare(GET_PROJECT_TOTAL_DURATION).get(projectId);
    return result ? result.totalDuration || 0 : 0;
  }

  // CHATS
  getProjectChats(projectId) {
    if (!this.db) return [];
    const chats = this.db.prepare(SELECT_PROJECT_CHATS).all(projectId);
    return chats.map(c => ({
      ...c,
      contexto: JSON.parse(c.context_recordings || '[]'),
      ultimo_mensaje: c.updated_at,
      nombre: c.name
    }));
  }

  createProjectChat(id, projectId, name, contextRecordings = []) {
    if (!this.db) return null;
    this.db.prepare(INSERT_CHAT).run(id, projectId, name, JSON.stringify(contextRecordings));
    return {
      id,
      project_id: projectId,
      nombre: name,
      contexto: contextRecordings,
      fecha_creacion: new Date().toISOString(),
      ultimo_mensaje: new Date().toISOString()
    };
  }

  deleteProjectChat(chatId) {
    if (!this.db) return;
    this.db.prepare(DELETE_CHAT).run(chatId);
  }

  // MENSAJES
  getChatMessages(chatId) {
    if (!this.db) return [];
    const messages = this.db.prepare(SELECT_CHAT_MESSAGES).all(chatId);
    return messages.map(m => ({
      id: m.id,
      tipo: m.type,
      contenido: m.content,
      fecha: m.created_at
    }));
  }

  clearChatMessages(chatId) {
    if (!this.db) return;
    this.db.prepare(DELETE_CHAT_MESSAGES).run(chatId);
  }

  saveProjectChatMessage(chatId, type, content) {
    if (!this.db) return null;
    const info = this.db.prepare(INSERT_MESSAGE).run(chatId, type, content);
    this.db.prepare(UPDATE_CHAT_TIME).run(chatId);
    return {
      id: info.lastInsertRowid,
      tipo: type,
      contenido: content,
      fecha: new Date().toISOString()
    };
  }

  // QUEUE
  enqueueTask(recordingId, model = null) {
    if (!this.db) return null;
    const info = this.db.prepare(INSERT_QUEUE_TASK).run(recordingId, model);
    return info.lastInsertRowid;
  }

  updateTask(id, status, step, progress, error = null) {
    if (!this.db) return;
    if (status === 'processing' && progress === 10) { // Set started_at at the beginning of processing
      this.db.prepare(UPDATE_QUEUE_TASK_WITH_START).run(status, step, progress, error, id);
    } else {
      this.db.prepare(UPDATE_QUEUE_TASK).run(status, step, progress, error, id);
    }
  }

  getNextTask() {
    if (!this.db) return null;
    return this.db.prepare(GET_NEXT_QUEUE_TASK).get();
  }

  getActiveQueue() {
    if (!this.db) return [];
    return this.db.prepare(GET_ACTIVE_QUEUE_TASKS).all();
  }

  getQueueHistory() {
    if (!this.db) return [];
    return this.db.prepare(GET_QUEUE_HISTORY).all();
  }

  getRecordingTaskStatus(recordingId) {
    if (!this.db) return null;
    return this.db.prepare(GET_TASK_STATUS_BY_RECORDING).get(recordingId);
  }

  getTaskById(id) {
    if (!this.db) return null;
    const { GET_TASK_BY_ID } = require('./queries');
    return this.db.prepare(GET_TASK_BY_ID).get(id);
  }

  // SUGERENCIAS DE TAREAS
  getTaskSuggestions(recordingId) {
    if (!this.db) return [];
    return this.db.prepare(SELECT_TASK_SUGGESTIONS).all(recordingId);
  }

  addTaskSuggestion(recordingId, title, content, layer = 'general', createdByAi = 1) {
    if (!this.db) return null;
    const info = this.db.prepare(INSERT_TASK_SUGGESTION).run(recordingId, title, content || '', layer || 'general', createdByAi ? 1 : 0);
    return this.db.prepare('SELECT * FROM task_suggestions WHERE id = ?').get(info.lastInsertRowid);
  }

  updateTaskSuggestion(id, title, content, layer = 'general') {
    if (!this.db) return null;
    this.db.prepare(UPDATE_TASK_SUGGESTION).run(title, content || '', layer || 'general', id);
    return this.db.prepare('SELECT * FROM task_suggestions WHERE id = ?').get(id);
  }

  deleteTaskSuggestion(id) {
    if (!this.db) return;
    this.db.prepare(DELETE_TASK_SUGGESTION).run(id);
  }

  // RAG
  updateRagStatus(relativePath, status) {
    if (!this.db) return { success: false };
    try {
      this.db.prepare("UPDATE recordings SET rag_status = ? WHERE relative_path = ?").run(status, relativePath);
      return { success: true };
    } catch (error) {
      console.error('[DB] Error updateRagStatus:', error);
      return { success: false, error: error.message };
    }
  }

  getRagStatus(relativePath) {
    if (!this.db) return null;
    try {
      const row = this.db.prepare("SELECT rag_status FROM recordings WHERE relative_path = ?").get(relativePath);
      return row ? row.rag_status : null;
    } catch (error) {
      console.error('[DB] Error getRagStatus:', error);
      return null;
    }
  }
}

module.exports = new DbService();
