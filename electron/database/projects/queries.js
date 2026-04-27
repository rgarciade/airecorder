// Projects & Project Recordings — consultas SQL
module.exports = {
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

  // ── Relaciones ─────────────────────────────────────────────────────────────

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
  `
};