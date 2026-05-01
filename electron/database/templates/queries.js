// SQL Queries for Note Templates and Recording Notes

module.exports = {
  // ── Table Creation ──────────────────────────────────────────────────────────

  CREATE_TABLE_NOTE_TEMPLATES: `
    CREATE TABLE IF NOT EXISTS note_templates (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      slug            TEXT NOT NULL UNIQUE,
      name            TEXT NOT NULL,
      icon            TEXT,
      description     TEXT,
      expert_id       TEXT,
      sections_json   TEXT NOT NULL,
      output_format   TEXT DEFAULT 'markdown',
      is_builtin      INTEGER DEFAULT 0,
      is_enabled      INTEGER DEFAULT 1,
      version         INTEGER DEFAULT 1,
      created_at      TEXT DEFAULT (datetime('now')),
      updated_at      TEXT DEFAULT (datetime('now'))
    );
  `,

  CREATE_TABLE_RECORDING_NOTES: `
    CREATE TABLE IF NOT EXISTS recording_notes (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      recording_id    INTEGER NOT NULL,
      template_slug   TEXT NOT NULL,
      content_md      TEXT NOT NULL,
      generated_at    TEXT DEFAULT (datetime('now')),
      updated_at      TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (recording_id) REFERENCES recordings(id) ON DELETE CASCADE
    );
  `,

  CREATE_INDEX_RECORDING_NOTES: `
    CREATE INDEX IF NOT EXISTS idx_recording_notes_rec
      ON recording_notes(recording_id);
  `,

  // ── Template Queries ───────────────────────────────────────────────────────

  LIST_TEMPLATES: `
    SELECT * FROM note_templates
    WHERE is_enabled = 1
    ORDER BY is_builtin DESC, name ASC;
  `,

  GET_TEMPLATE_BY_SLUG: `
    SELECT * FROM note_templates WHERE slug = ?;
  `,

  UPSERT_BUILTIN_TEMPLATE: `
    INSERT INTO note_templates
      (slug, name, icon, description, expert_id, sections_json, is_builtin, version)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?)
    ON CONFLICT(slug) DO UPDATE SET
      name          = excluded.name,
      icon          = excluded.icon,
      description   = excluded.description,
      expert_id     = excluded.expert_id,
      sections_json = excluded.sections_json,
      version       = excluded.version,
      updated_at    = datetime('now')
    WHERE note_templates.is_builtin = 1
      AND note_templates.version < excluded.version;
  `,

  CREATE_USER_TEMPLATE: `
    INSERT INTO note_templates
      (slug, name, icon, description, expert_id, sections_json, is_builtin)
    VALUES (?, ?, ?, ?, ?, ?, 0);
  `,

  UPDATE_USER_TEMPLATE: `
    UPDATE note_templates SET
      name          = ?,
      icon          = ?,
      description   = ?,
      expert_id     = ?,
      sections_json = ?,
      updated_at    = datetime('now')
    WHERE slug = ? AND is_builtin = 0;
  `,

  DELETE_USER_TEMPLATE: `
    DELETE FROM note_templates WHERE slug = ? AND is_builtin = 0;
  `,

  TOGGLE_TEMPLATE_ENABLED: `
    UPDATE note_templates SET
      is_enabled = ?,
      updated_at = datetime('now')
    WHERE slug = ?;
  `,

  // ── Note Queries ───────────────────────────────────────────────────────────

  GET_NOTES_FOR_RECORDING: `
    SELECT * FROM recording_notes
    WHERE recording_id = ?
    ORDER BY generated_at DESC;
  `,

  GET_NOTE_BY_ID: `
    SELECT * FROM recording_notes WHERE id = ?;
  `,

  INSERT_NOTE: `
    INSERT INTO recording_notes (recording_id, template_slug, content_md)
    VALUES (?, ?, ?);
  `,

  UPDATE_NOTE_CONTENT: `
    UPDATE recording_notes SET
      content_md = ?,
      updated_at = datetime('now')
    WHERE id = ?;
  `,

  DELETE_NOTE: `
    DELETE FROM recording_notes WHERE id = ?;
  `
};