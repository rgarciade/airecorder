// Speakers & Embeddings — consultas SQL
module.exports = {
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

  INSERT_SPEAKER: `
    INSERT INTO speakers (id, display_name) VALUES (?, ?);
  `,

  SELECT_SPEAKER_BY_ALIAS: `
    SELECT * FROM speakers WHERE display_name = ? LIMIT 1;
  `,

  INSERT_SPEAKER_EMBEDDING: `
    INSERT INTO speaker_embeddings (speaker_id, embedding, recording_id) VALUES (?, ?, ?);
  `,

  SELECT_ALL_SPEAKER_EMBEDDINGS: `
    SELECT * FROM speaker_embeddings;
  `,

  SELECT_SPEAKER_EMBEDDINGS_BY_SPEAKER: `
    SELECT id, speaker_id, embedding, recording_id, created_at
    FROM speaker_embeddings
    WHERE speaker_id = ?
    ORDER BY created_at ASC;
  `,

  DELETE_SPEAKER_EMBEDDING: `
    DELETE FROM speaker_embeddings WHERE id = ?;
  `,

  REASSIGN_SPEAKER_EMBEDDINGS: `
    UPDATE speaker_embeddings SET speaker_id = ? WHERE speaker_id = ?;
  `,

  DELETE_SPEAKER: `
    DELETE FROM speakers WHERE id = ?;
  `,

  // ── Resolución persistente de hablantes por grabación ──────────────────────

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

  UPSERT_RECORDING_SPEAKER_RESOLUTION: `
    INSERT INTO recording_speaker_resolutions (recording_id, ephemeral_id, speaker_id)
    VALUES (?, ?, ?)
    ON CONFLICT (recording_id, ephemeral_id) DO UPDATE SET
      speaker_id   = excluded.speaker_id,
      confirmed_at = CURRENT_TIMESTAMP;
  `,

  SELECT_RECORDING_SPEAKER_RESOLUTIONS: `
    SELECT rsr.ephemeral_id, rsr.speaker_id, s.display_name
    FROM recording_speaker_resolutions rsr
    JOIN speakers s ON s.id = rsr.speaker_id
    WHERE rsr.recording_id = ?;
  `,

  DELETE_RECORDING_SPEAKER_RESOLUTION: `
    DELETE FROM recording_speaker_resolutions
    WHERE recording_id = ? AND ephemeral_id = ?;
  `,

  REASSIGN_RECORDING_SPEAKER_RESOLUTIONS: `
    UPDATE recording_speaker_resolutions
    SET speaker_id = ?,
        confirmed_at = CURRENT_TIMESTAMP
    WHERE speaker_id = ?;
  `
};