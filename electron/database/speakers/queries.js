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

  DELETE_SPEAKER_EMBEDDING_BY_SPEAKER_AND_RECORDING: `
    DELETE FROM speaker_embeddings WHERE speaker_id = ? AND recording_id = ?;
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

  DELETE_RECORDING_SPEAKER_RESOLUTIONS_BY_SPEAKER_AND_RECORDING: `
    DELETE FROM recording_speaker_resolutions
    WHERE speaker_id = ? AND recording_id = ?;
  `,

  REASSIGN_RECORDING_SPEAKER_RESOLUTIONS: `
    UPDATE recording_speaker_resolutions
    SET speaker_id = ?,
        confirmed_at = CURRENT_TIMESTAMP
    WHERE speaker_id = ?;
  `,

  // ── Estadísticas de hablantes ──────────────────────────────────────────────

  GET_SPEAKER_STATS: `
    SELECT
      (SELECT COUNT(*) FROM speakers) AS totalSpeakers,
      (SELECT COUNT(*) FROM speaker_embeddings) AS totalEmbeddings,
      (SELECT COUNT(DISTINCT speaker_id) FROM recording_speaker_resolutions) AS speakersWithRecordings,
      (SELECT COUNT(*) FROM speakers WHERE id NOT IN (SELECT DISTINCT speaker_id FROM speaker_embeddings)) AS speakersWithoutEmbeddings,
      (SELECT COUNT(*) FROM recording_speaker_resolutions) AS recordingsWithResolution;
  `,

  GET_AVG_EMBEDDINGS_PER_SPEAKER: `
    SELECT AVG(cnt) AS avgEmbeddingsPerSpeaker
    FROM (
      SELECT COUNT(*) AS cnt
      FROM speaker_embeddings
      GROUP BY speaker_id
    );
  `,

  GET_LOW_QUALITY_SPEAKERS: `
    SELECT s.id, s.display_name, COUNT(se.id) AS embeddingsCount
    FROM speakers s
    LEFT JOIN speaker_embeddings se ON se.speaker_id = s.id
    GROUP BY s.id
    HAVING embeddingsCount <= 1
    ORDER BY embeddingsCount ASC;
  `,

  GET_RECENT_SPEAKERS: `
    SELECT s.id, s.display_name, s.created_at,
           COUNT(DISTINCT rsr.recording_id) AS recordingsCount,
           COUNT(se.id) AS embeddingsCount
    FROM speakers s
    LEFT JOIN recording_speaker_resolutions rsr ON rsr.speaker_id = s.id
    LEFT JOIN speaker_embeddings se ON se.speaker_id = s.id
    GROUP BY s.id
    ORDER BY s.created_at DESC
    LIMIT 10;
  `,

  // ── Lista de hablantes con nº de grabaciones ───────────────────────────────

  GET_SPEAKERS_WITH_RECORDING_COUNT: `
    SELECT s.id, s.display_name, s.created_at,
           COUNT(DISTINCT rsr.recording_id) AS recordingsCount,
           COUNT(DISTINCT se.id) AS embeddingsCount
    FROM speakers s
    LEFT JOIN recording_speaker_resolutions rsr ON rsr.speaker_id = s.id
    LEFT JOIN speaker_embeddings se ON se.speaker_id = s.id
    GROUP BY s.id
    ORDER BY recordingsCount DESC;
  `,

  // ── Grabaciones de un hablante específico ──────────────────────────────────

  GET_SPEAKER_RECORDINGS: `
    SELECT DISTINCT r.id, r.relative_path, r.relative_path AS recordingName, r.duration, r.created_at
    FROM recordings r
    JOIN recording_speaker_resolutions rsr ON rsr.recording_id = r.id
    WHERE rsr.speaker_id = ?
    ORDER BY r.created_at DESC;
  `,

  GET_SPEAKER_BY_ID: `
    SELECT id, display_name, created_at FROM speakers WHERE id = ?;
  `
};