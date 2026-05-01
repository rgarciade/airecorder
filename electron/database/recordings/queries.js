// Recordings & Transcription Queue — consultas SQL
module.exports = {
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

  INSERT_OR_UPDATE_RECORDING: `
    INSERT INTO recordings (relative_path, duration, status, transcription_model, source, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(relative_path) DO UPDATE SET
      duration = excluded.duration,
      status = excluded.status,
      transcription_model = COALESCE(excluded.transcription_model, recordings.transcription_model),
      source = COALESCE(excluded.source, recordings.source);
  `,

  UPDATE_STATUS: `
    UPDATE recordings SET status = ? WHERE relative_path = ?;
  `,

  UPDATE_TRANSCRIPTION_MODEL: `
    UPDATE recordings SET transcription_model = ? WHERE relative_path = ?;
  `,

  UPDATE_DURATION: `
    UPDATE recordings SET duration = ? WHERE relative_path = ?;
  `,

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

  SELECT_ALL_RECORDINGS: `
    SELECT * FROM recordings ORDER BY created_at DESC;
  `,

  SELECT_BY_PATH: `
    SELECT * FROM recordings WHERE relative_path = ?;
  `,

  SELECT_BY_ID: `
    SELECT * FROM recordings WHERE id = ?;
  `,

  DELETE_BY_PATH: `
    DELETE FROM recordings WHERE relative_path = ?;
  `,

  // ── Transcription Queue ─────────────────────────────────────────────────────

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
  `
};