// Consultas SQL para la gestión de grabaciones
module.exports = {
  // Crear la tabla si no existe
  CREATE_TABLE_RECORDINGS: `
    CREATE TABLE IF NOT EXISTS recordings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      relative_path TEXT NOT NULL UNIQUE,
      duration REAL DEFAULT 0,
      status TEXT CHECK(status IN ('recorded', 'transcribed', 'analyzed')) DEFAULT 'recorded',
      transcription_model TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `,

  // Insertar una nueva grabación
  INSERT_OR_UPDATE_RECORDING: `
    INSERT INTO recordings (relative_path, duration, status, transcription_model, created_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(relative_path) DO UPDATE SET
      duration = excluded.duration,
      status = excluded.status,
      transcription_model = COALESCE(excluded.transcription_model, recordings.transcription_model);
  `,

  // Actualizar solo el estado
  UPDATE_STATUS: `
    UPDATE recordings SET status = ? WHERE relative_path = ?;
  `,

  // Actualizar modelo de transcripción
  UPDATE_TRANSCRIPTION_MODEL: `
    UPDATE recordings SET transcription_model = ? WHERE relative_path = ?;
  `,

  // Actualizar duración
  UPDATE_DURATION: `
    UPDATE recordings SET duration = ? WHERE relative_path = ?;
  `,

  // Obtener estadísticas para el Dashboard
  GET_DASHBOARD_STATS: `
    SELECT 
      COALESCE(SUM(duration), 0) as totalSeconds,
      COUNT(CASE WHEN status IN ('transcribed', 'analyzed') THEN 1 END) as totalTranscriptions,
      COUNT(id) as totalRecordings
    FROM recordings;
  `,

  // Obtener todas las grabaciones ordenadas por fecha
  SELECT_ALL_RECORDINGS: `
    SELECT * FROM recordings ORDER BY created_at DESC;
  `,

  // Obtener una grabación por ruta
  SELECT_BY_PATH: `
    SELECT * FROM recordings WHERE relative_path = ?;
  `,

  // Obtener una grabación por ID
  SELECT_BY_ID: `
    SELECT * FROM recordings WHERE id = ?;
  `,

  // Eliminar grabación
  DELETE_BY_PATH: `
    DELETE FROM recordings WHERE relative_path = ?;
  `,

  // ========================================
  // PROYECTOS
  // ========================================

  CREATE_TABLE_PROJECTS: `
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      members TEXT DEFAULT '[]',
      is_updated INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `,

  CREATE_TABLE_PROJECT_RECORDINGS: `
    CREATE TABLE IF NOT EXISTS project_recordings (
      project_id INTEGER,
      recording_id INTEGER PRIMARY KEY,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (recording_id) REFERENCES recordings(id) ON DELETE CASCADE
    );
  `,

  INSERT_PROJECT: `
    INSERT INTO projects (name, description, members, is_updated) VALUES (?, ?, ?, 1);
  `,

  UPDATE_PROJECT: `
    UPDATE projects SET name = ?, description = ?, members = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?;
  `,

  UPDATE_PROJECT_SYNC_STATUS: `
    UPDATE projects SET is_updated = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?;
  `,

  DELETE_PROJECT: `
    DELETE FROM projects WHERE id = ?;
  `,

  SELECT_ALL_PROJECTS: `
    SELECT * FROM projects ORDER BY updated_at DESC;
  `,

  SELECT_PROJECT_BY_ID: `
    SELECT * FROM projects WHERE id = ?;
  `,

  // RELACIONES
  INSERT_PROJECT_RECORDING: `
    INSERT OR REPLACE INTO project_recordings (project_id, recording_id) VALUES (?, ?);
  `,

  DELETE_PROJECT_RECORDING: `
    DELETE FROM project_recordings WHERE project_id = ? AND recording_id = ?;
  `,

  DELETE_ALL_PROJECT_RECORDINGS: `
    DELETE FROM project_recordings WHERE project_id = ?;
  `,

  SELECT_PROJECT_RECORDING_IDS: `
    SELECT recording_id FROM project_recordings WHERE project_id = ?;
  `,

  SELECT_RECORDING_PROJECT: `
    SELECT p.* FROM projects p
    JOIN project_recordings pr ON p.id = pr.project_id
    WHERE pr.recording_id = ?;
  `,

  GET_PROJECT_TOTAL_DURATION: `
    SELECT SUM(r.duration) as totalDuration 
    FROM recordings r
    JOIN project_recordings pr ON r.id = pr.recording_id
    WHERE pr.project_id = ?;
  `,

  // ========================================
  // COLA DE TRANSCRIPCIÓN
  // ========================================

  CREATE_TABLE_QUEUE: `
    CREATE TABLE IF NOT EXISTS transcription_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recording_id INTEGER,
      status TEXT CHECK(status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
      step TEXT DEFAULT 'queued', -- 'queued', 'transcribing', 'analyzing'
      progress INTEGER DEFAULT 0,
      model TEXT,
      error TEXT,
      started_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (recording_id) REFERENCES recordings(id) ON DELETE CASCADE
    );
  `,

  INSERT_QUEUE_TASK: `
    INSERT INTO transcription_queue (recording_id, status, step, model) VALUES (?, 'pending', 'queued', ?);
  `,

  UPDATE_QUEUE_TASK: `
    UPDATE transcription_queue 
    SET status = ?, step = ?, progress = ?, error = ?, updated_at = CURRENT_TIMESTAMP 
    WHERE id = ?;
  `,

  UPDATE_QUEUE_TASK_WITH_START: `
    UPDATE transcription_queue 
    SET status = ?, step = ?, progress = ?, error = ?, started_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
    WHERE id = ?;
  `,

  RESET_STUCK_TASKS: `
    UPDATE transcription_queue SET status = 'pending', step = 'queued', progress = 0 WHERE status = 'processing';
  `,

  GET_NEXT_QUEUE_TASK: `
    SELECT * FROM transcription_queue WHERE status = 'pending' ORDER BY created_at ASC LIMIT 1;
  `,

  GET_ACTIVE_QUEUE_TASKS: `
    SELECT q.*, r.relative_path as recording_name 
    FROM transcription_queue q
    JOIN recordings r ON q.recording_id = r.id
    WHERE q.status IN ('pending', 'processing')
    ORDER BY q.created_at ASC;
  `,

  GET_QUEUE_HISTORY: `
    SELECT q.*, r.relative_path as recording_name 
    FROM transcription_queue q
    JOIN recordings r ON q.recording_id = r.id
    WHERE q.status IN ('completed', 'failed')
    ORDER BY q.updated_at DESC LIMIT 20;
  `,

  GET_TASK_STATUS_BY_RECORDING: `
    SELECT id, status, step, progress FROM transcription_queue WHERE recording_id = ? ORDER BY created_at DESC LIMIT 1;
  `,

  GET_TASK_BY_ID: `
    SELECT * FROM transcription_queue WHERE id = ?;
  `,

  // ========================================
  // CHATS DE PROYECTO
  // ========================================

  CREATE_TABLE_CHATS: `
    CREATE TABLE IF NOT EXISTS project_chats (
      id TEXT PRIMARY KEY,
      project_id INTEGER,
      name TEXT NOT NULL,
      context_recordings TEXT DEFAULT '[]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `,

  CREATE_TABLE_MESSAGES: `
    CREATE TABLE IF NOT EXISTS project_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id TEXT,
      type TEXT NOT NULL, -- 'usuario' | 'asistente'
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (chat_id) REFERENCES project_chats(id) ON DELETE CASCADE
    );
  `,

  INSERT_CHAT: `
    INSERT INTO project_chats (id, project_id, name, context_recordings) VALUES (?, ?, ?, ?);
  `,

  UPDATE_CHAT_TIME: `
    UPDATE project_chats SET updated_at = CURRENT_TIMESTAMP WHERE id = ?;
  `,

  SELECT_PROJECT_CHATS: `
    SELECT * FROM project_chats WHERE project_id = ? ORDER BY updated_at DESC;
  `,

  DELETE_CHAT: `
    DELETE FROM project_chats WHERE id = ?;
  `,

  INSERT_MESSAGE: `
    INSERT INTO project_messages (chat_id, type, content) VALUES (?, ?, ?);
  `,

  SELECT_CHAT_MESSAGES: `
    SELECT * FROM project_messages WHERE chat_id = ? ORDER BY created_at ASC;
  `,

  DELETE_CHAT_MESSAGES: `
    DELETE FROM project_messages WHERE chat_id = ?;
  `,

  // ========================================
  // SUGERENCIAS DE TAREAS
  // ========================================

  CREATE_TABLE_TASK_SUGGESTIONS: `
    CREATE TABLE IF NOT EXISTS task_suggestions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recording_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      content TEXT,
      layer TEXT DEFAULT 'general',
      created_by_ai INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (recording_id) REFERENCES recordings(id) ON DELETE CASCADE
    );
  `,

  INSERT_TASK_SUGGESTION: `
    INSERT INTO task_suggestions (recording_id, title, content, layer, created_by_ai) VALUES (?, ?, ?, ?, ?);
  `,

  UPDATE_TASK_SUGGESTION: `
    UPDATE task_suggestions SET title = ?, content = ?, layer = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?;
  `,

  DELETE_TASK_SUGGESTION: `
    DELETE FROM task_suggestions WHERE id = ?;
  `,

  SELECT_TASK_SUGGESTIONS: `
    SELECT * FROM task_suggestions WHERE recording_id = ? ORDER BY created_at ASC;
  `
};
