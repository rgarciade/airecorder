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
      COUNT(id) as totalRecordings,
      COALESCE(SUM(CASE
        WHEN created_at >= datetime('now', 'localtime', '-' || ((CAST(strftime('%w', 'now', 'localtime') AS INTEGER) + 6) % 7) || ' days', 'start of day')
         AND created_at < datetime('now', 'localtime', '-' || ((CAST(strftime('%w', 'now', 'localtime') AS INTEGER) + 6) % 7) || ' days', 'start of day', '+5 days')
        THEN duration
        ELSE 0
      END), 0) as weekSeconds
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
  `,

  INSERT_TASK_SUGGESTION: `
    INSERT INTO task_suggestions (recording_id, title, content, layer, created_by_ai) VALUES (?, ?, ?, ?, ?);
  `,

  INSERT_PROJECT_TASK: `
    INSERT INTO task_suggestions (project_id, title, content, layer, status, created_by_ai) VALUES (?, ?, ?, ?, ?, 0);
  `,

  ADD_TASK_TO_PROJECT: `
    UPDATE task_suggestions SET project_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?;
  `,

  REMOVE_TASK_FROM_PROJECT: `
    UPDATE task_suggestions SET project_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?;
  `,

  UPDATE_TASK_SUGGESTION: `
    UPDATE task_suggestions SET title = ?, content = ?, layer = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?;
  `,

  DELETE_TASK_SUGGESTION: `
    DELETE FROM task_suggestions WHERE id = ?;
  `,

  SELECT_TASK_SUGGESTIONS: `
    SELECT * FROM task_suggestions WHERE recording_id = ? ORDER BY created_at ASC;
  `,

  SELECT_TASK_SUGGESTIONS_BY_PROJECT: `
    SELECT ts.*, r.id AS recording_db_id
    FROM task_suggestions ts
    LEFT JOIN recordings r ON ts.recording_id = r.id
    WHERE ts.project_id = ?
    ORDER BY ts.sort_order ASC, ts.created_at ASC;
  `,

  // ========================================
  // COMENTARIOS DE TAREAS
  // ========================================

  CREATE_TABLE_TASK_COMMENTS: `
    CREATE TABLE IF NOT EXISTS task_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES task_suggestions(id) ON DELETE CASCADE
    );
  `,

  INSERT_TASK_COMMENT: `
    INSERT INTO task_comments (task_id, content) VALUES (?, ?);
  `,

  SELECT_TASK_COMMENTS: `
    SELECT * FROM task_comments WHERE task_id = ? ORDER BY created_at ASC;
  `,

  DELETE_TASK_COMMENT: `
    DELETE FROM task_comments WHERE id = ?;
  `,

  // ========================================
  // INTEGRACIONES EXTERNAS (OAuth)
  // ========================================

  CREATE_TABLE_PLATFORM_CONNECTIONS: `
    CREATE TABLE IF NOT EXISTS platform_connections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform TEXT NOT NULL,
      account_name TEXT,
      account_id TEXT,
      access_token_encrypted BLOB,
      refresh_token_encrypted BLOB,
      token_expires_at DATETIME,
      scopes TEXT DEFAULT '[]',
      connected_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `,

  CREATE_TABLE_PROJECT_INTEGRATIONS: `
    CREATE TABLE IF NOT EXISTS project_integrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      connection_id INTEGER NOT NULL,
      channel_id TEXT NOT NULL,
      channel_name TEXT,
      recording_id INTEGER,
      last_sync_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (connection_id) REFERENCES platform_connections(id) ON DELETE CASCADE
    );
  `,

  INSERT_PLATFORM_CONNECTION: `
    INSERT INTO platform_connections (platform, account_name, account_id, access_token_encrypted, refresh_token_encrypted, token_expires_at, scopes)
    VALUES (?, ?, ?, ?, ?, ?, ?);
  `,

  UPDATE_PLATFORM_CONNECTION_TOKENS: `
    UPDATE platform_connections
    SET access_token_encrypted = ?, refresh_token_encrypted = ?, token_expires_at = ?
    WHERE id = ?;
  `,

  SELECT_ALL_PLATFORM_CONNECTIONS: `
    SELECT id, platform, account_name, account_id, scopes, connected_at FROM platform_connections;
  `,

  SELECT_PLATFORM_CONNECTION_BY_ID: `
    SELECT * FROM platform_connections WHERE id = ?;
  `,

  DELETE_PLATFORM_CONNECTION: `
    DELETE FROM platform_connections WHERE id = ?;
  `,

  INSERT_PROJECT_INTEGRATION: `
    INSERT INTO project_integrations (project_id, connection_id, channel_id, channel_name, chat_id, date_from, date_to)
    VALUES (?, ?, ?, ?, ?, ?, ?);
  `,

  UPDATE_PROJECT_INTEGRATION_SYNC: `
    UPDATE project_integrations SET recording_id = ?, last_sync_at = ? WHERE id = ?;
  `,

  SELECT_PROJECT_INTEGRATIONS: `
    SELECT pi.*, pc.platform, pc.account_name
    FROM project_integrations pi
    JOIN platform_connections pc ON pi.connection_id = pc.id
    WHERE pi.project_id = ?
    ORDER BY pi.created_at ASC;
  `,

  SELECT_CHAT_INTEGRATIONS: `
    SELECT pi.*, pc.platform, pc.account_name
    FROM project_integrations pi
    JOIN platform_connections pc ON pi.connection_id = pc.id
    WHERE pi.chat_id = ?
    ORDER BY pi.created_at ASC;
  `,

  DELETE_PROJECT_INTEGRATION: `
    DELETE FROM project_integrations WHERE id = ?;
  `,

  // ========================================
  // EXPERT CUSTOMIZATIONS
  // ========================================

  CREATE_TABLE_EXPERT_CUSTOMIZATIONS: `
    CREATE TABLE IF NOT EXISTS expert_customizations (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      expert_id    TEXT NOT NULL,
      feature      TEXT NOT NULL,
      instructions TEXT NOT NULL DEFAULT '',
      updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_expert_customizations
      ON expert_customizations(expert_id, feature);
  `,

  GET_EXPERT_CUSTOMIZATIONS: `
    SELECT feature, instructions FROM expert_customizations WHERE expert_id = ?;
  `,

  UPSERT_EXPERT_CUSTOMIZATION: `
    INSERT INTO expert_customizations (expert_id, feature, instructions, updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(expert_id, feature) DO UPDATE SET
      instructions = excluded.instructions,
      updated_at   = excluded.updated_at;
  `,

  RESET_EXPERT_CUSTOMIZATION: `
    DELETE FROM expert_customizations WHERE expert_id = ? AND feature = ?;
  `,

  // ========================================
  // IDENTIFICACIÓN DE HABLANTES
  // ========================================

  CREATE_TABLE_SPEAKERS: `
    CREATE TABLE IF NOT EXISTS speakers (
      id TEXT PRIMARY KEY,
      display_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `,

  CREATE_TABLE_SPEAKER_EMBEDDINGS: `
    CREATE TABLE IF NOT EXISTS speaker_embeddings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      speaker_id TEXT NOT NULL,
      embedding BLOB NOT NULL,
      recording_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (speaker_id) REFERENCES speakers(id) ON DELETE CASCADE,
      FOREIGN KEY (recording_id) REFERENCES recordings(id) ON DELETE SET NULL
    );
  `,

  // Insertar un nuevo hablante (id = UUID externo, display_name = alias)
  INSERT_SPEAKER: `
    INSERT INTO speakers (id, display_name) VALUES (?, ?);
  `,

  // Buscar hablante por alias (display_name)
  SELECT_SPEAKER_BY_ALIAS: `
    SELECT * FROM speakers WHERE display_name = ? LIMIT 1;
  `,

  // Insertar un embedding de hablante
  INSERT_SPEAKER_EMBEDDING: `
    INSERT INTO speaker_embeddings (speaker_id, embedding, recording_id) VALUES (?, ?, ?);
  `,

  // Obtener todos los embeddings de hablantes
  SELECT_ALL_SPEAKER_EMBEDDINGS: `
    SELECT * FROM speaker_embeddings;
  `,

  // Reasignar todos los embeddings de un hablante a otro (usado en fusión)
  REASSIGN_SPEAKER_EMBEDDINGS: `
    UPDATE speaker_embeddings SET speaker_id = ? WHERE speaker_id = ?;
  `,

  // Eliminar un perfil de hablante por ID
  DELETE_SPEAKER: `
    DELETE FROM speakers WHERE id = ?;
  `,

  // ── Tabla de resolución persistente de hablantes por grabación ──────────────
  // Guarda el mapa ephemeral_id → speaker_id una sola vez por grabación,
  // evitando recalcular embeddings y crear duplicados en cada apertura.
  CREATE_TABLE_RECORDING_SPEAKER_RESOLUTIONS: `
    CREATE TABLE IF NOT EXISTS recording_speaker_resolutions (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      recording_id INTEGER NOT NULL,
      ephemeral_id TEXT    NOT NULL,
      speaker_id   TEXT    NOT NULL,
      confirmed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (recording_id) REFERENCES recordings(id) ON DELETE CASCADE,
      FOREIGN KEY (speaker_id)   REFERENCES speakers(id)   ON DELETE CASCADE,
      UNIQUE (recording_id, ephemeral_id)
    );
  `,

  // Insertar o reemplazar la resolución de un hablante efímero en una grabación
  UPSERT_RECORDING_SPEAKER_RESOLUTION: `
    INSERT INTO recording_speaker_resolutions (recording_id, ephemeral_id, speaker_id)
    VALUES (?, ?, ?)
    ON CONFLICT (recording_id, ephemeral_id) DO UPDATE SET
      speaker_id   = excluded.speaker_id,
      confirmed_at = CURRENT_TIMESTAMP;
  `,

  // Obtener todas las resoluciones de una grabación
  SELECT_RECORDING_SPEAKER_RESOLUTIONS: `
    SELECT rsr.ephemeral_id, rsr.speaker_id, s.display_name
    FROM recording_speaker_resolutions rsr
    JOIN speakers s ON s.id = rsr.speaker_id
    WHERE rsr.recording_id = ?;
  `,

  // Eliminar la resolución de un hablante efímero concreto (para re-asignar)
  DELETE_RECORDING_SPEAKER_RESOLUTION: `
    DELETE FROM recording_speaker_resolutions
    WHERE recording_id = ? AND ephemeral_id = ?;
  `,

  // Reasignar todas las resoluciones persistidas que apuntan a un speaker hacia otro.
  REASSIGN_RECORDING_SPEAKER_RESOLUTIONS: `
    UPDATE recording_speaker_resolutions
    SET speaker_id = ?,
        confirmed_at = CURRENT_TIMESTAMP
    WHERE speaker_id = ?;
  `
};
