const Database = require('better-sqlite3');

// Domain services
const RecordingsDbService = require('./recordings/dbService');
const ProjectsDbService = require('./projects/dbService');
const ChatsDbService = require('./chats/dbService');
const TasksDbService = require('./tasks/dbService');
const SpeakersDbService = require('./speakers/dbService');
const IntegrationsDbService = require('./integrations/dbService');

// Queries
const expertQueries = require('./experts/queries');

class DbService {
  constructor() {
    this.db = null;
    this.dbPath = null;

    // Domain services — initialized in init()
    this.recordings = null;
    this.projects = null;
    this.chats = null;
    this.tasks = null;
    this.speakers = null;
    this.integrations = null;
  }

  close() {
    if (this.db) {
      try {
        this.db.close();
      } catch (e) {
        console.error('[DB] Error cerrando la base de datos:', e);
      }
      this.db = null;
    }
  }

  getCurrentPath() {
    return this.dbPath;
  }

  init(dbPath) {
    this.dbPath = dbPath;
    try {
      this.db = new Database(dbPath);

      // Desactivar WAL en volúmenes de red o externos para evitar corrupción
      if (dbPath.startsWith('/Volumes/')) {
        console.log('[DB] Ruta de red/externa detectada. Usando journal_mode = DELETE (seguro para NAS).');
        this.db.pragma('journal_mode = DELETE');
      } else {
        this.db.pragma('journal_mode = WAL');
      }

      this.db.pragma('foreign_keys = ON');

      // Inicializar domain services pasándoles la conexión
      this.recordings = new RecordingsDbService(this.db);
      this.projects = new ProjectsDbService(this.db);
      this.chats = new ChatsDbService(this.db);
      this.tasks = new TasksDbService(this.db);
      this.speakers = new SpeakersDbService(this.db);
      this.integrations = new IntegrationsDbService(this.db);

      // Crear tablas de todos los dominios
      this.recordings.init();
      this.projects.init();
      this.chats.init();
      this.tasks.init();
      this.speakers.init();
      this.integrations.init();

      // ── Expert Customizations ───────────────────────────────────────────────
      this.db.exec(expertQueries.CREATE_TABLE_EXPERT_CUSTOMIZATIONS);

      // ── Migraciones de columnas (solo si existen en recordings) ──────────────
      this._runMigrations();

      console.log(`[DB] Inicializada en: ${dbPath}`);
      return true;
    } catch (error) {
      console.error('[DB] Error init:', error);
      return false;
    }
  }

  // ── Migraciones ────────────────────────────────────────────────────────────
  // Solo se ejecutan si la columna no existe ( SQLite no tiene ALTER TABLE IF NOT EXISTS para columnas)

  _runMigrations() {
    // Migración: transcription_model en recordings
    try {
      const tableInfo = this.db.prepare("PRAGMA table_info(recordings)").all();
      if (!tableInfo.some(c => c.name === 'transcription_model')) {
        console.log('[DB] Añadiendo columna transcription_model a la tabla recordings...');
        this.db.prepare("ALTER TABLE recordings ADD COLUMN transcription_model TEXT").run();
      }
    } catch (e) {
      console.error('[DB] Error migrando recordings:', e);
    }

    // Migración: model y started_at en transcription_queue
    try {
      const queueInfo = this.db.prepare("PRAGMA table_info(transcription_queue)").all();
      if (queueInfo.length > 0) {
        if (!queueInfo.some(c => c.name === 'model')) {
          console.log('[DB] Añadiendo columna model a transcription_queue...');
          this.db.prepare("ALTER TABLE transcription_queue ADD COLUMN model TEXT").run();
        }
        if (!queueInfo.some(c => c.name === 'started_at')) {
          console.log('[DB] Añadiendo columna started_at a transcription_queue...');
          this.db.prepare("ALTER TABLE transcription_queue ADD COLUMN started_at DATETIME").run();
        }
      }
    } catch (e) {
      console.error('[DB] Error migrando queue:', e);
    }

    // Limpiar tareas atascadas al arrancar
    this.recordings.resetStuckTasks();

    // Migración: is_updated en projects
    try {
      const projInfo = this.db.prepare("PRAGMA table_info(projects)").all();
      if (!projInfo.some(c => c.name === 'is_updated')) {
        console.log('[DB] Añadiendo columna is_updated a projects...');
        this.db.prepare("ALTER TABLE projects ADD COLUMN is_updated INTEGER DEFAULT 1").run();
      }
    } catch (e) {
      console.error('[DB] Error añadiendo is_updated:', e);
    }

    // Migración: project_recordings (asegurar PK en recording_id)
    try {
      const prInfo = this.db.prepare("PRAGMA table_info(project_recordings)").all();
      if (prInfo.length > 0) {
        if (!prInfo.some(c => c.name === 'recording_id')) {
          console.log('[DB] Migrando project_recordings...');
          const oldData = this.db.prepare("SELECT * FROM project_recordings").all();
          this.db.prepare("DROP TABLE project_recordings").run();
          this.projects.init(); // recrear tabla
          const insert = this.db.prepare("INSERT OR REPLACE INTO project_recordings (project_id, recording_id, created_at) VALUES (?, ?, ?)");
          for (const row of oldData) {
            const rec = this.db.prepare("SELECT id FROM recordings WHERE relative_path = ?").get(row.recording_path);
            if (rec) insert.run(row.project_id, rec.id, row.created_at);
          }
        }
      } else {
        this.projects.init();
      }
    } catch (e) {
      console.error('[DB] Error migrando project_recordings:', e);
    }

    // Migración: task_suggestions (layer, status, sort_order, project_id)
    try {
      const tsInfo = this.db.prepare("PRAGMA table_info(task_suggestions)").all();
      if (tsInfo.length > 0) {
        if (!tsInfo.some(c => c.name === 'layer')) {
          this.db.prepare("ALTER TABLE task_suggestions ADD COLUMN layer TEXT DEFAULT 'general'").run();
        }
        if (!tsInfo.some(c => c.name === 'status')) {
          this.db.prepare("ALTER TABLE task_suggestions ADD COLUMN status TEXT DEFAULT 'backlog'").run();
        }
        if (!tsInfo.some(c => c.name === 'sort_order')) {
          this.db.prepare("ALTER TABLE task_suggestions ADD COLUMN sort_order INTEGER DEFAULT 0").run();
        }
        if (!tsInfo.some(c => c.name === 'project_id')) {
          console.log('[DB] Migrando task_suggestions: añadiendo project_id...');
          this.db.exec(`
            PRAGMA foreign_keys = OFF;
            BEGIN;
            CREATE TABLE task_suggestions_v2 (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              recording_id INTEGER,
              project_id INTEGER,
              title TEXT NOT NULL,
              content TEXT,
              layer TEXT DEFAULT 'general',
              status TEXT DEFAULT 'backlog',
              sort_order INTEGER DEFAULT 0,
              created_by_ai INTEGER DEFAULT 1,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            INSERT INTO task_suggestions_v2
              (id, recording_id, title, content, layer, status, created_by_ai, created_at, updated_at)
            SELECT id, recording_id, title, content, layer, status, created_by_ai, created_at, updated_at
            FROM task_suggestions;
            DROP TABLE task_suggestions;
            ALTER TABLE task_suggestions_v2 RENAME TO task_suggestions;
            COMMIT;
            PRAGMA foreign_keys = ON;
          `);
        }
      }
    } catch (e) {
      console.error('[DB] Error migrando task_suggestions:', e);
    }

    // Migración: chat_id, date_from, date_to en project_integrations
    try {
      const piInfo = this.db.prepare("PRAGMA table_info(project_integrations)").all();
      if (piInfo.length > 0) {
        if (!piInfo.some(c => c.name === 'chat_id')) {
          this.db.prepare("ALTER TABLE project_integrations ADD COLUMN chat_id TEXT").run();
        }
        if (!piInfo.some(c => c.name === 'date_from')) {
          this.db.prepare("ALTER TABLE project_integrations ADD COLUMN date_from TEXT").run();
        }
        if (!piInfo.some(c => c.name === 'date_to')) {
          this.db.prepare("ALTER TABLE project_integrations ADD COLUMN date_to TEXT").run();
        }
      }
    } catch (e) {
      console.error('[DB] Error migrando project_integrations:', e);
    }

    // Migración: rag_status en recordings
    try {
      const recInfo = this.db.prepare("PRAGMA table_info(recordings)").all();
      if (!recInfo.some(c => c.name === 'rag_status')) {
        console.log('[DB] Añadiendo columna rag_status a recordings...');
        this.db.prepare("ALTER TABLE recordings ADD COLUMN rag_status TEXT").run();
      }
    } catch (e) {
      console.error('[DB] Error migrando rag_status:', e);
    }
  }

  // ── Expert Customizations (delegado al domain service inline) ──────────────

  getExpertCustomizations(expertId) {
    if (!this.db) return {};
    try {
      const rows = this.db.prepare(expertQueries.GET_EXPERT_CUSTOMIZATIONS).all(expertId);
      return rows.reduce((acc, row) => {
        acc[row.feature] = row.instructions;
        return acc;
      }, {});
    } catch (e) {
      console.error('[DB] Error getExpertCustomizations:', e);
      return {};
    }
  }

  saveExpertCustomization(expertId, feature, instructions) {
    if (!this.db) return { success: false };
    try {
      this.db.prepare(expertQueries.UPSERT_EXPERT_CUSTOMIZATION).run(expertId, feature, instructions);
      return { success: true };
    } catch (e) {
      console.error('[DB] Error saveExpertCustomization:', e);
      return { success: false, error: e.message };
    }
  }

  resetExpertCustomization(expertId, feature) {
    if (!this.db) return { success: false };
    try {
      this.db.prepare(expertQueries.RESET_EXPERT_CUSTOMIZATION).run(expertId, feature);
      return { success: true };
    } catch (e) {
      console.error('[DB] Error resetExpertCustomization:', e);
      return { success: false, error: e.message };
    }
  }

  // ── RAG (pertenece a recordings) ────────────────────────────────────────────

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

  // ── Proxies a domain services ──────────────────────────────────────────────
  // Mantienen la API original para no romper main.js
  // Son defensivos: si el domain service no está inicializado, devuelven valores seguros

  // Recordings
  saveRecording(...args) { return this.recordings?.saveRecording(...args) ?? { success: false }; }
  updateTranscriptionModel(...args) { return this.recordings?.updateTranscriptionModel(...args) ?? { success: false }; }
  updateDuration(...args) { return this.recordings?.updateDuration(...args) ?? { success: false }; }
  updateStatus(...args) { return this.recordings?.updateStatus(...args) ?? { success: false }; }
  getDashboardStats(...args) { return this.recordings?.getDashboardStats(...args) ?? { totalHours: '0.0', totalTranscriptions: 0, totalRecordings: 0, weekHours: '0.0' }; }
  getAllRecordings(...args) { return this.recordings?.getAllRecordings(...args) ?? []; }
  getRecording(...args) { return this.recordings?.getRecording(...args) ?? null; }
  getRecordingById(...args) { return this.recordings?.getRecordingById(...args) ?? null; }
  deleteRecording(...args) { return this.recordings?.deleteRecording(...args); }

  // Queue
  enqueueTask(...args) { return this.recordings?.enqueueTask(...args) ?? null; }
  updateTask(...args) { return this.recordings?.updateTask(...args); }
  getNextTask(...args) { return this.recordings?.getNextTask(...args) ?? null; }
  getActiveQueue(...args) { return this.recordings?.getActiveQueue(...args) ?? []; }
  getQueueHistory(...args) { return this.recordings?.getQueueHistory(...args) ?? []; }
  getRecordingTaskStatus(...args) { return this.recordings?.getRecordingTaskStatus(...args) ?? null; }
  getTaskById(...args) { return this.recordings?.getTaskById(...args) ?? null; }

  // Projects
  getAllProjects(...args) { return this.projects?.getAllProjects(...args) ?? []; }
  getProjectById(...args) { return this.projects?.getProjectById(...args) ?? null; }
  createProject(...args) { return this.projects?.createProject(...args) ?? null; }
  updateProject(...args) { return this.projects?.updateProject(...args) ?? null; }
  deleteProject(...args) { return this.projects?.deleteProject(...args); }
  updateProjectSyncStatus(...args) { return this.projects?.updateProjectSyncStatus(...args); }
  addRecordingToProject(...args) { return this.projects?.addRecordingToProject(...args); }
  removeRecordingFromProject(...args) { return this.projects?.removeRecordingFromProject(...args); }
  getProjectRecordingIds(...args) { return this.projects?.getProjectRecordingIds(...args) ?? []; }
  getRecordingProject(...args) { return this.projects?.getRecordingProject(...args) ?? null; }
  getProjectTotalDuration(...args) { return this.projects?.getProjectTotalDuration(...args) ?? 0; }

  // Chats
  getProjectChats(...args) { return this.chats?.getProjectChats(...args) ?? []; }
  createProjectChat(...args) { return this.chats?.createProjectChat(...args) ?? null; }
  deleteProjectChat(...args) { return this.chats?.deleteProjectChat(...args); }
  getChatMessages(...args) { return this.chats?.getChatMessages(...args) ?? []; }
  clearChatMessages(...args) { return this.chats?.clearChatMessages(...args); }
  saveProjectChatMessage(...args) { return this.chats?.saveProjectChatMessage(...args) ?? null; }

  // Tasks
  getTaskSuggestions(...args) { return this.tasks?.getTaskSuggestions(...args) ?? []; }
  getTaskSuggestionsByProject(...args) { return this.tasks?.getTaskSuggestionsByProject(...args) ?? []; }
  addTaskSuggestion(...args) { return this.tasks?.addTaskSuggestion(...args) ?? null; }
  updateTaskSuggestion(...args) { return this.tasks?.updateTaskSuggestion(...args) ?? null; }
  deleteTaskSuggestion(...args) { return this.tasks?.deleteTaskSuggestion(...args); }
  createProjectTask(...args) { return this.tasks?.createProjectTask(...args) ?? null; }
  addTaskToProject(...args) { return this.tasks?.addTaskToProject(...args) ?? null; }
  removeTaskFromProject(...args) { return this.tasks?.removeTaskFromProject(...args); }
  updateTasksSortOrder(...args) { return this.tasks?.updateTasksSortOrder(...args); }

  // Task Comments
  getTaskComments(...args) { return this.tasks?.getTaskComments(...args) ?? []; }
  addTaskComment(...args) { return this.tasks?.addTaskComment(...args) ?? null; }
  deleteTaskComment(...args) { return this.tasks?.deleteTaskComment(...args); }

  // Speakers
  createSpeaker(...args) { return this.speakers?.createSpeaker(...args) ?? null; }
  getSpeakerByAlias(...args) { return this.speakers?.getSpeakerByAlias(...args) ?? null; }
  getAllSpeakers(...args) { return this.speakers?.getAllSpeakers(...args) ?? []; }
  deleteSpeaker(...args) { return this.speakers?.deleteSpeaker(...args) ?? { success: false }; }
  saveSpeakerEmbedding(...args) { return this.speakers?.saveSpeakerEmbedding(...args) ?? { success: false }; }
  getAllSpeakerEmbeddings(...args) { return this.speakers?.getAllSpeakerEmbeddings(...args) ?? []; }
  getEmbeddingsBySpeakerId(...args) { return this.speakers?.getEmbeddingsBySpeakerId(...args) ?? []; }
  deleteSpeakerEmbedding(...args) { return this.speakers?.deleteSpeakerEmbedding(...args) ?? { success: false }; }
  deleteSpeakerEmbeddingBySpeakerAndRecording(...args) { return this.speakers?.deleteSpeakerEmbeddingBySpeakerAndRecording(...args) ?? { changes: 0 }; }
  deleteSpeakerRecordingRelationAtomically(...args) { return this.speakers?.deleteSpeakerRecordingRelationAtomically(...args) ?? { success: false, error: 'Speakers DB no disponible' }; }
  reassignSpeakerEmbeddings(...args) { return this.speakers?.reassignSpeakerEmbeddings(...args) ?? { success: false }; }
  getRecordingSpeakerResolutions(...args) { return this.speakers?.getRecordingSpeakerResolutions(...args) ?? null; }
  upsertRecordingSpeakerResolution(...args) { return this.speakers?.upsertRecordingSpeakerResolution(...args) ?? { success: false }; }
  deleteRecordingSpeakerResolution(...args) { return this.speakers?.deleteRecordingSpeakerResolution(...args) ?? { success: false }; }
  deleteRecordingSpeakerResolutionsBySpeakerAndRecording(...args) { return this.speakers?.deleteRecordingSpeakerResolutionsBySpeakerAndRecording(...args) ?? { changes: 0 }; }
  reassignRecordingSpeakerResolutions(...args) { return this.speakers?.reassignRecordingSpeakerResolutions(...args) ?? { success: false }; }
  getSpeakerStats(...args) { return this.speakers?.getSpeakerStats(...args) ?? this.speakers?._emptyStats() ?? { totalSpeakers: 0, totalEmbeddings: 0, avgEmbeddingsPerSpeaker: 0, speakersWithRecordings: 0, speakersWithoutEmbeddings: 0, recordingsWithResolution: 0, lowQualitySpeakers: [], recentSpeakers: [] }; }
  getSpeakersWithRecordingCount(...args) { return this.speakers?.getSpeakersWithRecordingCount(...args) ?? []; }
  getSpeakerRecordings(...args) { return this.speakers?.getSpeakerRecordings(...args) ?? null; }
  getSimilarSpeakers(...args) { return this.speakers?.getSimilarSpeakers(...args) ?? []; }
  async getSpeakerFirstSegmentTime(...args) { return this.speakers?.getSpeakerFirstSegmentTime(...args) ?? null; }

  // Integrations
  savePlatformConnection(...args) { return this.integrations?.savePlatformConnection(...args) ?? { success: false }; }
  updatePlatformConnectionTokens(...args) { return this.integrations?.updatePlatformConnectionTokens(...args) ?? { success: false }; }
  getAllPlatformConnections(...args) { return this.integrations?.getAllPlatformConnections(...args) ?? []; }
  getPlatformConnectionById(...args) { return this.integrations?.getPlatformConnectionById(...args) ?? null; }
  deletePlatformConnection(...args) { return this.integrations?.deletePlatformConnection(...args) ?? { success: false }; }
  addProjectIntegration(...args) { return this.integrations?.addProjectIntegration(...args) ?? { success: false }; }
  updateProjectIntegrationSync(...args) { return this.integrations?.updateProjectIntegrationSync(...args) ?? { success: false }; }
  getProjectIntegrations(...args) { return this.integrations?.getProjectIntegrations(...args) ?? []; }
  getChatIntegrations(...args) { return this.integrations?.getChatIntegrations(...args) ?? []; }
  deleteProjectIntegration(...args) { return this.integrations?.deleteProjectIntegration(...args) ?? { success: false }; }
}

module.exports = new DbService();
