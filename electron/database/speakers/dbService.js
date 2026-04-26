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
  DELETE_SPEAKER_EMBEDDING_BY_SPEAKER_AND_RECORDING,
  REASSIGN_SPEAKER_EMBEDDINGS,
  DELETE_SPEAKER,
  CREATE_TABLE_RECORDING_SPEAKER_RESOLUTIONS,
  UPSERT_RECORDING_SPEAKER_RESOLUTION,
  SELECT_RECORDING_SPEAKER_RESOLUTIONS,
  DELETE_RECORDING_SPEAKER_RESOLUTION,
  DELETE_RECORDING_SPEAKER_RESOLUTIONS_BY_SPEAKER_AND_RECORDING,
  REASSIGN_RECORDING_SPEAKER_RESOLUTIONS,
  GET_SPEAKER_STATS,
  GET_AVG_EMBEDDINGS_PER_SPEAKER,
  GET_LOW_QUALITY_SPEAKERS,
  GET_RECENT_SPEAKERS,
  GET_SPEAKERS_WITH_RECORDING_COUNT,
  GET_SPEAKER_RECORDINGS,
  GET_SPEAKER_BY_ID
} = require('./queries');

/**
 * Calcula la similitud coseno entre dos vectores.
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number}
 */
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Deserializa un embedding desde BLOB/Buffer a array de números.
 * @param {Buffer|string} blob
 * @returns {number[]|null}
 */
function deserializeEmbedding(blob) {
  if (!blob) return null;
  try {
    if (typeof blob === 'string') {
      return JSON.parse(blob);
    }
    return JSON.parse(blob.toString('utf8'));
  } catch {
    return null;
  }
}

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

  /**
   * Elimina el embedding de un hablante para una grabación específica.
   * @param {string} speakerId - UUID del hablante
   * @param {number} recordingId - ID de la grabación
   * @returns {{ changes: number }} Resultado con el número de filas eliminadas
   */
  deleteSpeakerEmbeddingBySpeakerAndRecording(speakerId, recordingId) {
    return this._run(DELETE_SPEAKER_EMBEDDING_BY_SPEAKER_AND_RECORDING, [speakerId, recordingId]);
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

  /**
   * Elimina todas las resoluciones de un hablante para una grabación específica.
   * @param {string} speakerId - UUID del hablante
   * @param {number} recordingId - ID de la grabación
   * @returns {{ changes: number }} Resultado con el número de filas eliminadas
   */
  deleteRecordingSpeakerResolutionsBySpeakerAndRecording(speakerId, recordingId) {
    return this._run(DELETE_RECORDING_SPEAKER_RESOLUTIONS_BY_SPEAKER_AND_RECORDING, [speakerId, recordingId]);
  }

  /**
   * Elimina de forma atómica (transacción) la relación hablante-grabación:
   *   1) Borra embeddings del hablante para esa grabación
   *   2) Borra resoluciones persistentes del hablante para esa grabación
   *
   * Si falla cualquiera de los pasos, se revierte todo (ROLLBACK).
   *
   * @param {string} speakerId - UUID del hablante
   * @param {number} recordingId - ID de la grabación
   * @returns {{ success: boolean, deletedEmbeddings?: number, deletedResolutions?: number, deletedCount?: number, error?: string }}
   */
  deleteSpeakerRecordingRelationAtomically(speakerId, recordingId) {
    if (!this.db) return { success: false, error: 'DB no inicializada' };

    try {
      const runTx = this.db.transaction((spkId, recId) => {
        const deleteEmbInfo = this.db
          .prepare(DELETE_SPEAKER_EMBEDDING_BY_SPEAKER_AND_RECORDING)
          .run(spkId, recId);

        const deleteRelInfo = this.db
          .prepare(DELETE_RECORDING_SPEAKER_RESOLUTIONS_BY_SPEAKER_AND_RECORDING)
          .run(spkId, recId);

        return {
          deletedEmbeddings: deleteEmbInfo.changes,
          deletedResolutions: deleteRelInfo.changes,
          deletedCount: deleteRelInfo.changes
        };
      });

      const result = runTx(speakerId, recordingId);
      return {
        success: true,
        deletedEmbeddings: result.deletedEmbeddings,
        deletedResolutions: result.deletedResolutions,
        deletedCount: result.deletedCount
      };
    } catch (error) {
      this._log('Error deleteSpeakerRecordingRelationAtomically:', error);
      return { success: false, error: error.message || String(error) };
    }
  }

  reassignRecordingSpeakerResolutions(fromSpeakerId, toSpeakerId) {
    return this._modify(REASSIGN_RECORDING_SPEAKER_RESOLUTIONS, [toSpeakerId, fromSpeakerId]);
  }

  // ── Estadísticas y queries de directorio ──────────────────────────────────

  /**
   * Devuelve métricas agregadas del sistema de reconocimiento de hablantes.
   * Si la BD está vacía, devuelve contadores en 0 y arrays vacíos.
   */
  getSpeakerStats() {
    if (!this.db) {
      return this._emptyStats();
    }
    try {
      const stats = this.db.prepare(GET_SPEAKER_STATS).get();
      const avgRow = this.db.prepare(GET_AVG_EMBEDDINGS_PER_SPEAKER).get();
      const lowQuality = this.db.prepare(GET_LOW_QUALITY_SPEAKERS).all();
      const recent = this.db.prepare(GET_RECENT_SPEAKERS).all();

      return {
        totalSpeakers: stats?.totalSpeakers ?? 0,
        totalEmbeddings: stats?.totalEmbeddings ?? 0,
        avgEmbeddingsPerSpeaker: avgRow?.avgEmbeddingsPerSpeaker
          ? Math.round(avgRow.avgEmbeddingsPerSpeaker * 10) / 10
          : 0,
        speakersWithRecordings: stats?.speakersWithRecordings ?? 0,
        speakersWithoutEmbeddings: stats?.speakersWithoutEmbeddings ?? 0,
        recordingsWithResolution: stats?.recordingsWithResolution ?? 0,
        lowQualitySpeakers: lowQuality ?? [],
        recentSpeakers: recent ?? []
      };
    } catch (error) {
      this._log('Error getSpeakerStats:', error);
      return this._emptyStats();
    }
  }

  _emptyStats() {
    return {
      totalSpeakers: 0,
      totalEmbeddings: 0,
      avgEmbeddingsPerSpeaker: 0,
      speakersWithRecordings: 0,
      speakersWithoutEmbeddings: 0,
      recordingsWithResolution: 0,
      lowQualitySpeakers: [],
      recentSpeakers: []
    };
  }

  /**
   * Devuelve todos los hablantes ordenados por nº de grabaciones DESC.
   */
  getSpeakersWithRecordingCount() {
    return this._getMany(GET_SPEAKERS_WITH_RECORDING_COUNT);
  }

  /**
   * Devuelve las grabaciones donde aparece un hablante específico.
   * @param {string} speakerId - UUID del hablante
   * @returns {{ speaker: object, recordings: array } | null}
   */
  getSpeakerRecordings(speakerId) {
    if (!this.db) return null;
    try {
      const speaker = this.db.prepare(GET_SPEAKER_BY_ID).get(speakerId);
      if (!speaker) return null;

      const recordings = this._getMany(GET_SPEAKER_RECORDINGS, [speakerId]);

      return {
        speaker: {
          id: speaker.id,
          displayName: speaker.display_name,
          createdAt: speaker.created_at
        },
        recordings: recordings ?? []
      };
    } catch (error) {
      this._log('Error getSpeakerRecordings:', error);
      return null;
    }
  }

  /**
   * Devuelve los speakers más similares al indicado, basándose en la similitud
   * coseno de sus embeddings. Solo incluye speakers con similitud ≥ 70%.
   * @param {string} speakerId - UUID del hablante de referencia
   * @param {number} [limit=5] - Máximo número de resultados
   * @returns {Array<{ id: string, displayName: string, similarity: number, recordingId?: number, recordingPath?: string }>}
   */
  getSimilarSpeakers(speakerId, limit = 5) {
    if (!this.db) return [];
    try {
      // 1. Obtener embeddings del speaker de referencia
      const sourceEmbeddings = this.getEmbeddingsBySpeakerId(speakerId);
      if (!sourceEmbeddings || sourceEmbeddings.length === 0) return [];

      // 2. Obtener todos los embeddings de la BD
      const allEmbeddings = this.getAllSpeakerEmbeddings();
      if (!allEmbeddings || allEmbeddings.length === 0) return [];

      // 3. Calcular similitud con cada otro speaker
      // Mapa: speakerId → { similarity, bestEmbRow }
      const bestBySpeaker = new Map();

      for (const sourceEmb of sourceEmbeddings) {
        const sourceVector = deserializeEmbedding(sourceEmb.embedding);
        if (!sourceVector) continue;

        for (const row of allEmbeddings) {
          // Saltar embeddings del mismo speaker
          if (row.speaker_id === speakerId) continue;

          const targetVector = deserializeEmbedding(row.embedding);
          if (!targetVector || targetVector.length !== sourceVector.length) continue;

          const sim = cosineSimilarity(sourceVector, targetVector);

          // Solo considerar si supera el umbral del 70%
          if (sim < 0.70) continue;

          const current = bestBySpeaker.get(row.speaker_id);
          if (current === undefined || sim > current.similarity) {
            bestBySpeaker.set(row.speaker_id, { similarity: sim, bestEmbRow: row });
          }
        }
      }

      // 4. Obtener nombres de los speakers similares
      const allSpeakers = this.getAllSpeakers();
      const nameMap = new Map();
      for (const s of allSpeakers) {
        nameMap.set(s.id, s.display_name);
      }

      // 5. Obtener recordingPath de referencia para cada speaker similar
      const recordingPathBySpeaker = new Map();
      for (const [similarId, { bestEmbRow }] of bestBySpeaker.entries()) {
        let foundPath = null;

        if (bestEmbRow?.recording_id) {
          const rec = this._getOne(
            'SELECT id, relative_path FROM recordings WHERE id = ?',
            [bestEmbRow.recording_id],
            null
          );
          if (rec?.relative_path) {
            foundPath = rec.relative_path;
          }
        }

        if (!foundPath) {
          const fallbackRec = this._getOne(
            `SELECT r.id, r.relative_path
             FROM recordings r
             JOIN recording_speaker_resolutions rsr ON rsr.recording_id = r.id
             WHERE rsr.speaker_id = ?
             ORDER BY r.created_at DESC
             LIMIT 1`,
            [similarId],
            null
          );
          if (fallbackRec?.relative_path) {
            foundPath = fallbackRec.relative_path;
          }
        }

        if (foundPath) {
          recordingPathBySpeaker.set(similarId, foundPath);
        }
      }

      // 6. Ordenar por similitud descendente y limitar
      return Array.from(bestBySpeaker.entries())
        .map(([id, { similarity, bestEmbRow }]) => {
          const recId = bestEmbRow?.recording_id;
          return {
            id,
            displayName: nameMap.get(id) || 'Desconocido',
            similarity: Math.round(similarity * 1000) / 1000,
            recordingId: recId || null,
            recordingPath: recordingPathBySpeaker.get(id) || null
          };
        })
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);
    } catch (error) {
      this._log('Error getSimilarSpeakers:', error);
      return [];
    }
  }

  /**
   * Devuelve el start_time del primer segmento de un hablante en una grabación,
   * leyendo directamente del archivo transcripcion_combinada.json.
   *
   * Flujo:
   *   1. Obtener el ephemeral_id del hablante en esa grabación desde recording_speaker_resolutions
   *   2. Construir la ruta al JSON de transcripción
   *   3. Leer el JSON y buscar el primer segmento donde speaker == ephemeral_id
   *
   * @param {string} speakerId - UUID del hablante persistente
   * @param {number} recordingId - ID numérico de la grabación
   * @returns {Promise<{ startTime: number, ephemeralId: string } | null>}
   */
  async getSpeakerFirstSegmentTime(speakerId, recordingId) {
    if (!this.db || !speakerId || !recordingId) return null;

    try {
      // 1. Obtener el ephemeral_id para este hablante en esta grabación
      const resolution = this._getOne(
        `SELECT rsr.ephemeral_id
         FROM recording_speaker_resolutions rsr
         WHERE rsr.recording_id = ? AND rsr.speaker_id = ?
         LIMIT 1`,
        [recordingId, speakerId],
        null
      );

      if (!resolution?.ephemeral_id) {
        // El hablante no tiene resolución para esta grabación específica
        return null;
      }

      const ephemeralId = resolution.ephemeral_id;

      // 2. Obtener la ruta de la grabación para construir la ruta al JSON
      const recording = this._getOne(
        'SELECT relative_path FROM recordings WHERE id = ?',
        [recordingId],
        null
      );

      if (!recording?.relative_path) {
        return null;
      }

      // 3. Necesitamos el basePath para construir la ruta absoluta
      // Usamos getRecordingsPath de paths.js (async)
      const { getRecordingsPath } = require('../../utils/paths');
      let basePath;
      try {
        basePath = await getRecordingsPath();
      } catch {
        // Si falla, no podemos localizar el JSON
        return null;
      }

      const jsonPath = require('path').join(
        basePath,
        recording.relative_path,
        'analysis',
        'transcripcion_combinada.json'
      );

      // 4. Leer y parsear el JSON de transcripción
      const fs = require('fs');
      if (!fs.existsSync(jsonPath)) {
        return null;
      }

      const content = fs.readFileSync(jsonPath, 'utf8');
      const data = JSON.parse(content);

      if (!Array.isArray(data.segments) || data.segments.length === 0) {
        return null;
      }

      // 5. Buscar el primer segmento donde el speaker coincida con el ephemeral_id
      const firstSegment = data.segments.find(
        (s) => s.speaker === ephemeralId && typeof s.start === 'number'
      );

      if (!firstSegment) {
        return null;
      }

      return {
        startTime: firstSegment.start,
        ephemeralId
      };
    } catch (error) {
      this._log('Error getSpeakerFirstSegmentTime:', error);
      return null;
    }
  }

}

module.exports = SpeakersDbService;
