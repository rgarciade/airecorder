/**
 * diarizationService.js
 *
 * Servicio de resolución de diarización.
 *
 * Responsabilidades:
 *   - Leer y parsear diarization.json
 *   - Detectar schema (v2.0 con embeddings vs legacy)
 *   - Coordinar con speakerManager para resolución
 *   - Enriquecer suggestions con timestamps
 *
 * No modifica el JSON de transcripción directamente.
 */

const fs = require('fs');
const path = require('path');
const speakerManager = require('./speakerManager');
const dbService = require('../database/dbService');

/**
 * @typedef {Object} SpeakerResolutionResult
 * @property {Object} resolutionMap - { ephemeralId: { speakerId, displayName, isNew } }
 * @property {Array} pendingSuggestions - [{ ephemeralId, candidateSpeakerId, candidateDisplayName, similarity, firstSegmentStart }]
 * @property {string} _source - 'diarization' | 'segments'
 */

/**
 * @typedef {Object} DiarizationData
 * @property {Object} [speaker_embeddings] - Mapa de embeddings (v2.0)
 * @property {Array} [segments] - Lista de segmentos
 * @property {string} [version] - Versión del esquema
 */

class DiarizationService {
  /**
   * Lee y parsea el archivo diarization.json.
   * Maneja errores de archivo no encontrado o JSON inválido retornando null.
   *
   * @param {string} diarizationPath - Ruta absoluta al archivo
   * @returns {DiarizationData|null}
   */
  parseDiarizationFile(diarizationPath) {
    try {
      // Usar readFileSync directamente - si el archivo no existe, lanza ENOENT que capturamos en catch
      const raw = fs.readFileSync(diarizationPath, 'utf8');
      const data = JSON.parse(raw);

      // Detectar schema v2.0: tiene speaker_embeddings con keys
      const hasEmbeddings =
        data?.speaker_embeddings &&
        typeof data.speaker_embeddings === 'object' &&
        Object.keys(data.speaker_embeddings).length > 0;

      return {
        speaker_embeddings: hasEmbeddings ? data.speaker_embeddings : null,
        segments: data?.segments || [],
        version: data?.version || 'unknown',
      };
    } catch (err) {
      if (err.code === 'ENOENT') {
        // Archivo no existe - retornar null silenciosamente para que resolveRecording haga fallback
        return null;
      } else if (err instanceof SyntaxError) {
        console.warn(`[DiarizationService] diarization.json malformed en ${diarizationPath}: ${err.message}`);
      } else {
        console.warn(`[DiarizationService] Error leyendo diarización: ${err.message}`);
      }
      return null;
    }
  }

  /**
   * Enriquece las sugerencias de hablantes con el timestamp del primer segmento.
   *
   * @param {Array} pendingSuggestions - Sugerencias devueltas por speakerManager
   * @param {Array} segments - Segmentos de diarización o transcripción
   * @returns {Array} - Sugerencias enriquecidas (mutado)
   */
  _enrichSuggestionsWithTimestamps(pendingSuggestions, segments) {
    if (!pendingSuggestions || pendingSuggestions.length === 0) {
      return pendingSuggestions;
    }

    const allSegments = Array.isArray(segments) ? segments : [];

    for (const suggestion of pendingSuggestions) {
      const firstSeg = allSegments.find(
        (s) => s.speaker === suggestion.ephemeralId && typeof s.start === 'number'
      );
      suggestion.firstSegmentStart = firstSeg ? firstSeg.start : null;
    }

    return pendingSuggestions;
  }

  /**
   * Orquesta la obtención de datos de hablantes para una grabación.
   *
   * @param {Object} params
   * @param {number|null} params.recordingId - ID de la grabación en BD
   * @param {string} params.folderName - Carpeta de la grabación
   * @param {string} params.baseOutputDir - Directorio base de grabaciones
   * @param {Array} params.transcriptionSegments - Segmentos de transcripción (para fallback)
   * @param {number} [params.threshold=0.85] - Umbral de similitud coseno
   * @returns {SpeakerResolutionResult}
   */
  resolveRecording({ recordingId, folderName, baseOutputDir, transcriptionSegments, threshold = 0.85 }) {
    // 1. Construir path a diarization.json
    const diarizationPath = path.join(baseOutputDir, folderName, 'analysis', 'diarization.json');

    // 2. Parsear diarization.json
    const diarizationData = this.parseDiarizationFile(diarizationPath);

    // 3. Si existe el archivo de diarización
    if (diarizationData !== null) {
      // 3a. Si hay embeddings → processEmbeddings
      if (diarizationData.speaker_embeddings) {
        const { resolutionMap, pendingSuggestions } = speakerManager.processEmbeddings(
          diarizationData.speaker_embeddings,
          recordingId,
          threshold
        );

        // Enriquecer suggestions con timestamps
        const enrichedSuggestions = this._enrichSuggestionsWithTimestamps(
          pendingSuggestions,
          diarizationData.segments.length > 0
            ? diarizationData.segments
            : transcriptionSegments || []
        );

        return {
          resolutionMap,
          pendingSuggestions: enrichedSuggestions,
          _source: 'diarization',
        };
      }

      // 3b. Fallback: diarización existe pero sin embeddings. Usar segments del propio archivo.
      if (diarizationData.segments && diarizationData.segments.length > 0) {
        const resolutionMap = speakerManager.resolveFromSegments(
          diarizationData.segments,
          recordingId
        );
        return {
          resolutionMap,
          pendingSuggestions: [],
          _source: 'diarization',
        };
      }

      // 3c. Archivo existe pero vacío (sin embeddings ni segments) → marcar como diarization
      return {
        resolutionMap: {},
        pendingSuggestions: [],
        _source: 'diarization',
      };
    }

    // 4. No existe diarization.json → fallback a transcription segments
    if (transcriptionSegments && transcriptionSegments.length > 0) {
      const resolutionMap = speakerManager.resolveFromSegments(transcriptionSegments, recordingId);
      return {
        resolutionMap,
        pendingSuggestions: [],
        _source: 'segments',
      };
    }

    // 5. Último recurso: nada disponible
    return {
      resolutionMap: {},
      pendingSuggestions: [],
      _source: 'segments',
    };
  }
}

module.exports = new DiarizationService();
