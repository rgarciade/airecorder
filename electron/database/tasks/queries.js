// Task Suggestions & Comments — consultas SQL
module.exports = {
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

  // ── Comentarios ─────────────────────────────────────────────────────────────

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
  `
};