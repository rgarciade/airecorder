// Speakers & Embeddings — base de datos
const BaseDbService = require('../baseDbService');
const {
  CREATE_TABLE_SPEAKERS,
  CREATE_TABLE_SPEAKER_EMBEDDINGS,
  INSERT_SPEAKER,
  SELECT_SPEAKER_BY_ALIAS,
  INSERT_SPEAKER_EMBEDDING,
  SELECT_ALL_SPEAKER_EMBEDDINGS,
  SELECT_SPEAKER_EMBEDDINGS_BY_SPEAKER,
  DELETE_SPEAKER_EMBEDDING,
  REASSIGN_SPEAKER_EMBEDDINGS,
  DELETE_SPEAKER,
  CREATE_TABLE_RECORDING_SPEAKER_RESOLUTIONS,
  UPSERT_RECORDING_SPEAKER_RESOLUTION,
  SELECT_RECORDING_SPEAKER_RESOLUTIONS,
  DELETE_RECORDING_SPEAKER_RESOLUTION,
  REASSIGN_RECORDING_SPEAKER_RESOLUTIONS
} = require('./queries');

class SpeakersDbService extends BaseDbService {
  constructor(db) {
    super(db, 'speakers');
  }

  // ── Tablas ──────────────────────────────────────────────────────────────────

  init() {
    this.db.prepare(CREATE_TABLE_SPEAKERS).run();
    this.db.prepare(CREATE_TABLE_SPEAKER_EMBEDDINGS).run();
    this.db.prepare(CREATE_TABLE_RECORDING_SPEAKER_RESOLUTIONS).run();
  }

  // ── Hablantes ──────────────────────────────────────────────────────────────

  createSpeaker(alias) {
    if (!this.db) return null;
    try {
      const { randomUUID } = require('crypto');
      const id = randomUUID();
      this.db.prepare(INSERT_SPEAKER).run(id, alias);
      return this._getOne('SELECT * FROM speakers WHERE id = ?', [id], null);
    } catch (error) {
      this._log('Error createSpeaker:', error);
      return null;
    }
  }

  getSpeakerByAlias(alias) {
    return this._getOne(SELECT_SPEAKER_BY_ALIAS, [alias], null);
  }

  getAllSpeakers() {
    return this._getMany('SELECT id, display_name, created_at FROM speakers ORDER BY display_name ASC');
  }

  deleteSpeaker(speakerId) {
    return this._run(DELETE_SPEAKER, [speakerId]);
  }

  // ── Embeddings ─────────────────────────────────────────────────────────────

  saveSpeakerEmbedding(speakerId, embeddingBlob, recordingId = null) {
    return this._insert(INSERT_SPEAKER_EMBEDDING, [speakerId, embeddingBlob, recordingId]);
  }

  getAllSpeakerEmbeddings() {
    return this._getMany(SELECT_ALL_SPEAKER_EMBEDDINGS);
  }

  getEmbeddingsBySpeakerId(speakerId) {
    return this._getMany(SELECT_SPEAKER_EMBEDDINGS_BY_SPEAKER, [speakerId]);
  }

  deleteSpeakerEmbedding(embeddingId) {
    return this._run(DELETE_SPEAKER_EMBEDDING, [embeddingId]);
  }

  reassignSpeakerEmbeddings(fromSpeakerId, toSpeakerId) {
    return this._modify(REASSIGN_SPEAKER_EMBEDDINGS, [toSpeakerId, fromSpeakerId]);
  }

  // ── Resoluciones persistentes ─────────────────────────────────────────────

  getRecordingSpeakerResolutions(recordingId) {
    const rows = this._getMany(SELECT_RECORDING_SPEAKER_RESOLUTIONS, [recordingId]);
    if (!rows || rows.length === 0) return null;
    const map = {};
    for (const row of rows) {
      map[row.ephemeral_id] = { speakerId: row.speaker_id, displayName: row.display_name, isNew: false };
    }
    return map;
  }

  upsertRecordingSpeakerResolution(recordingId, ephemeralId, speakerId) {
    return this._run(UPSERT_RECORDING_SPEAKER_RESOLUTION, [recordingId, ephemeralId, speakerId]);
  }

  deleteRecordingSpeakerResolution(recordingId, ephemeralId) {
    return this._run(DELETE_RECORDING_SPEAKER_RESOLUTION, [recordingId, ephemeralId]);
  }

  reassignRecordingSpeakerResolutions(fromSpeakerId, toSpeakerId) {
    return this._modify(REASSIGN_RECORDING_SPEAKER_RESOLUTIONS, [toSpeakerId, fromSpeakerId]);
  }
}

module.exports = SpeakersDbService;