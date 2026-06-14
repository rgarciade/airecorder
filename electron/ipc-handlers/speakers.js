/**
 * ipc-handlers/speakers.js
 *
 * Handlers IPC para la funcionalidad de re-identificación y gestión de hablantes.
 *
 * Canales registrados:
 *   - `resolve-speaker`  → Procesa los embeddings de una sesión de diarización
 *                          y devuelve el mapa de resolución ephemeral → UUID.
 *   - `assign-alias`     → Persiste el alias personalizado de un hablante y
 *                          opcionalmente guarda su embedding actualizado.
 */

const { ipcMain } = require('electron');
const speakerManager = require('../services/speakerManager');
const dbService = require('../database/dbService');

function registerSpeakersHandlers() {
  /**
   * `resolve-speaker`
   *
   * Recibe el mapa `speaker_embeddings` de la diarización y devuelve un mapa
   * de resolución que asocia cada ID efímero con un perfil persistente en BD.
   *
   * Payload: {
   *   speakerEmbeddings: { "SPEAKER_00": [float, ...], ... },
   *   recordingId?: number,
   *   threshold?: number   // Umbral de similitud coseno (default: 0.85)
   * }
   *
   * Respuesta: {
   *   success: true,
   *   data: {
   *     "SPEAKER_00": { speakerId: "uuid", displayName: "Juan", isNew: false },
   *     ...
   *   }
   * }
   */
  ipcMain.handle('resolve-speaker', async (_event, { speakerEmbeddings, recordingId, threshold } = {}) => {
    try {
      const resolutionMap = speakerManager.processEmbeddings(
        speakerEmbeddings,
        recordingId ?? null,
        threshold ?? 0.85
      );
      return { success: true, data: resolutionMap };
    } catch (error) {
      console.error('[IPC:resolve-speaker] Error:', error);
      return { success: false, error: error.message || String(error) };
    }
  });

  /**
   * `assign-alias`
   *
   * Persiste un alias personalizado para un hablante identificado por su UUID.
   * Opcionalmente actualiza el embedding almacenado (útil cuando el usuario
   * confirma una re-identificación con alta confianza).
   *
   * Payload: {
   *   speakerId?: string,     // UUID actual del hablante en la transcripción
   *   alias: string,          // Nombre personalizado (ej. "Juan García")
   *   embedding?: number[],   // Vector actualizado (opcional)
   *   recordingId?: number,   // Grabación de origen del embedding (opcional)
   *   ephemeralId?: string    // ID efímero de la transcripción actual
   * }
   *
   * Respuesta: { success: true, speakerId, displayName } | { success: false, error: string }
   */
  ipcMain.handle('assign-alias', async (_event, { speakerId, alias, embedding, recordingId, ephemeralId } = {}) => {
    try {
      const result = speakerManager.assignAlias(
        speakerId,
        alias,
        embedding ?? null,
        recordingId ?? null,
        ephemeralId ?? null
      );
      return result;
    } catch (error) {
      console.error('[IPC:assign-alias] Error:', error);
      return { success: false, error: error.message || String(error) };
    }
  });

  /**
   * `get-all-speakers`
   *
   * Devuelve todos los hablantes registrados en la BD.
   * Se usa en el frontend al montar la vista de transcripción para poblar
   * el autocompletado de alias y pre-cargar el mapa de resolución.
   *
   * Respuesta: {
   *   success: true,
   *   data: [{ id, display_name, created_at, updated_at }, ...]
   * }
   */
  ipcMain.handle('get-all-speakers', async (_event) => {
    try {
      const speakers = dbService.getAllSpeakers();
      return { success: true, data: speakers };
    } catch (error) {
      console.error('[IPC:get-all-speakers] Error:', error);
      return { success: false, error: error.message || String(error), data: [] };
    }
  });

  /**
   * `merge-speakers`
   *
   * Fusiona múltiples perfiles de hablante en uno solo:
   *   1. Actualiza el alias del hablante "ganador".
   *   2. Reasigna todos los embeddings de los "perdedores" al ganador.
   *   3. Elimina los perfiles perdedores de la BD.
   *
   * Payload: {
   *   sourceEphemeralIds: string[],  // IDs efímeros seleccionados
   *   speakersMap: Object,           // Mapa ephemeralId → { speakerId, displayName }
   *   targetAlias: string            // Nombre unificado
   * }
   *
   * Respuesta: {
   *   success: true,
   *   targetSpeakerId: string,
   *   displayName: string
   * } | { success: false, error: string }
   */
  ipcMain.handle('merge-speakers', async (_event, { sourceEphemeralIds, speakersMap, targetAlias } = {}) => {
    try {
      const result = speakerManager.mergeSpeakers(sourceEphemeralIds, speakersMap, targetAlias);
      return result;
    } catch (error) {
      console.error('[IPC:merge-speakers] Error:', error);
      return { success: false, error: error.message || String(error) };
    }
  });

  /**
   * `get-speaker-stats`
   *
   * Devuelve métricas agregadas del sistema de reconocimiento de hablantes.
   * Se usa para el dashboard o vistas de análisis.
   *
   * Respuesta: {
   *   success: true,
   *   data: {
   *     totalSpeakers, totalEmbeddings, avgEmbeddingsPerSpeaker,
   *     speakersWithRecordings, speakersWithoutEmbeddings,
   *     recordingsWithResolution, lowQualitySpeakers[], recentSpeakers[]
   *   }
   * }
   */
  ipcMain.handle('get-speaker-stats', async (_event) => {
    try {
      const stats = dbService.getSpeakerStats();
      return { success: true, data: stats };
    } catch (error) {
      console.error('[IPC:get-speaker-stats] Error:', error);
      return { success: false, error: error.message || String(error) };
    }
  });

  /**
   * `get-speakers-with-recordings`
   *
   * Devuelve todos los hablantes ordenados por nº de grabaciones DESC.
   * Se usa para el directorio de hablantes.
   *
   * Respuesta: {
   *   success: true,
   *   data: [{ id, displayName, recordingsCount, embeddingsCount }, ...]
   * }
   */
  ipcMain.handle('get-speakers-with-recordings', async (_event) => {
    try {
      const speakers = dbService.getSpeakersWithRecordingCount();
      // Normalizar a camelCase
      const normalized = speakers.map(s => ({
        id: s.id,
        displayName: s.display_name,
        createdAt: s.created_at,
        recordingsCount: s.recordingsCount,
        embeddingsCount: s.embeddingsCount
      }));
      return { success: true, data: normalized };
    } catch (error) {
      console.error('[IPC:get-speakers-with-recordings] Error:', error);
      return { success: false, error: error.message || String(error), data: [] };
    }
  });

  /**
   * `get-speaker-recordings`
   *
   * Devuelve las grabaciones donde aparece un hablante específico.
   *
   * Payload: { speakerId: string }
   *
   * Respuesta: {
   *   success: true,
   *   data: {
   *     speaker: { id, displayName, createdAt },
   *     recordings: [{ id, relative_path, recordingName, duration, created_at, confirmed_at }, ...]
   *   }
   * }
   */
  ipcMain.handle('get-speaker-recordings', async (_event, { speakerId } = {}) => {
    try {
      if (!speakerId) {
        return { success: false, error: 'speakerId es requerido' };
      }
      const result = dbService.getSpeakerRecordings(speakerId);
      if (!result) {
        return { success: false, error: 'Hablante no encontrado' };
      }
      return { success: true, data: result };
    } catch (error) {
      console.error('[IPC:get-speaker-recordings] Error:', error);
      return { success: false, error: error.message || String(error) };
    }
  });

  /**
   * `get-similar-speakers`
   *
   * Devuelve los hablantes más similares al indicado, basándose en la similitud
   * coseno de sus embeddings.
   *
   * Payload: { speakerId: string, limit?: number }
   *
   * Respuesta: {
   *   success: true,
   *   data: [{ id, displayName, similarity }, ...]
   * }
   */
  ipcMain.handle('get-similar-speakers', async (_event, { speakerId, limit } = {}) => {
    try {
      if (!speakerId) {
        return { success: false, error: 'speakerId es requerido' };
      }
      const similar = dbService.getSimilarSpeakers(speakerId, limit ?? 5);
      return { success: true, data: similar };
    } catch (error) {
      console.error('[IPC:get-similar-speakers] Error:', error);
      return { success: false, error: error.message || String(error), data: [] };
    }
  });

  /**
   * `merge-similar-speaker`
   *
   * Fusiona un speaker similar en el speaker actual (target).
   * Reasigna todas las resoluciones y embeddings del similar al target,
   * y elimina el perfil del similar.
   *
   * Payload: { targetSpeakerId: string, sourceSpeakerId: string }
   *
   * Respuesta: { success: true, mergedName } | { success: false, error }
   */
  ipcMain.handle('merge-similar-speaker', async (_event, { targetSpeakerId, sourceSpeakerId } = {}) => {
    try {
      if (!targetSpeakerId || !sourceSpeakerId) {
        return { success: false, error: 'targetSpeakerId y sourceSpeakerId son requeridos' };
      }

      // 1. Obtener nombre del target (sin usar helpers privados de dbService)
      const target = dbService
        .getAllSpeakers()
        .find((speaker) => speaker.id === targetSpeakerId);
      if (!target) {
        return { success: false, error: 'El hablante target no existe' };
      }

      // 2. Reasignar resoluciones del source al target
      dbService.reassignRecordingSpeakerResolutions(sourceSpeakerId, targetSpeakerId);

      // 3. Reasignar embeddings del source al target
      dbService.reassignSpeakerEmbeddings(sourceSpeakerId, targetSpeakerId);

      // 4. Eliminar el perfil del source
      dbService.deleteSpeaker(sourceSpeakerId);

      return { success: true, mergedName: target.display_name };
    } catch (error) {
      console.error('[IPC:merge-similar-speaker] Error:', error);
      return { success: false, error: error.message || String(error) };
    }
  });

  /**
   * `get-speaker-first-segment-time`
   *
   * Devuelve el timestamp del primer segmento de un hablante en una grabación,
   * leyendo del archivo transcripcion_combinada.json. Se usa para hacer seek
   * al punto exacto donde ese hablante empieza a hablar al reproducir "su voz".
   *
   * Payload: { speakerId: string, recordingId: number }
   *
   * Respuesta: {
   *   success: true,
   *   data: { startTime: number, ephemeralId: string }
   * } | { success: false, error: string }
   */
  ipcMain.handle('get-speaker-first-segment-time', async (_event, { speakerId, recordingId } = {}) => {
    try {
      if (!speakerId || !recordingId) {
        return { success: false, error: 'speakerId y recordingId son requeridos' };
      }
      const result = await dbService.getSpeakerFirstSegmentTime(speakerId, recordingId);
      if (!result) {
        return { success: false, error: 'No se encontró el timestamp del hablante en esta grabación' };
      }
      return { success: true, data: result };
    } catch (error) {
      console.error('[IPC:get-speaker-first-segment-time] Error:', error);
      return { success: false, error: error.message || String(error) };
    }
  });

/**
    * `preview-merge-speakers`
    *
    * Devuelve una vista previa de un merge entre dos hablantes, incluyendo:
    * - origen y destino finales (con auto-swap si origen tiene embeddings y destino no)
    * - advertencias de embeddings que se reasignarán
    *
    * Payload: { sourceSpeakerId: string, targetSpeakerId: string }
    *
    * Respuesta: {
    *   success: true,
    *   data: {
    *     finalSourceId: string,
    *     finalTargetId: string,
    *     swapped: boolean,
    *     sourceEmbeddings: number,
    *     targetEmbeddings: number,
    *     warnings: string[]
    *   }
    * } | { success: false, error }
    */
  ipcMain.handle('preview-merge-speakers', async (_event, { sourceSpeakerId, targetSpeakerId } = {}) => {
    try {
      if (!sourceSpeakerId || !targetSpeakerId) {
        return { success: false, error: 'sourceSpeakerId y targetSpeakerId son requeridos' };
      }

      if (sourceSpeakerId === targetSpeakerId) {
        return { success: false, error: 'No se puede fusionar un hablante consigo mismo' };
      }

      // Obtener el número de embeddings de cada hablante
      const sourceEmbeddings = dbService.getSpeakerEmbeddingCount(sourceSpeakerId);
      const targetEmbeddings = dbService.getSpeakerEmbeddingCount(targetSpeakerId);

      // Obtener datos de los speakers
      const allSpeakers = dbService.getAllSpeakers();
      const sourceSpeaker = allSpeakers.find(s => s.id === sourceSpeakerId);
      const targetSpeaker = allSpeakers.find(s => s.id === targetSpeakerId);

      if (!sourceSpeaker || !targetSpeaker) {
        return { success: false, error: 'Uno o ambos hablantes no existen' };
      }

      // Auto-swap: si origen tiene embeddings y destino NO, invertimos roles
      // para preservar los embeddings en el destino
      let finalSourceId = sourceSpeakerId;
      let finalTargetId = targetSpeakerId;
      let swapped = false;
      let warnings = [];

      if (sourceEmbeddings > 0 && targetEmbeddings === 0) {
        // Auto-swap para preservar embeddings
        finalSourceId = targetSpeakerId;
        finalTargetId = sourceSpeakerId;
        swapped = true;
        warnings.push(`Los ${sourceEmbeddings} embeddings del hablante "${sourceSpeaker.display_name}" se reasignarán a "${targetSpeaker.display_name}"`);
      } else if (sourceEmbeddings > 0 && targetEmbeddings > 0) {
        // Ambos tienen embeddings - advertencia
        warnings.push(`Ambos hablantes tienen embeddings (${sourceEmbeddings} y ${targetEmbeddings}). Los embeddings del hablante de origen se reasignarán al de destino.`);
      } else if (sourceEmbeddings === 0 && targetEmbeddings === 0) {
        // Ninguno tiene embeddings
        warnings.push('Ninguno de los dos hablantes tiene embeddings. La fusión es segura.');
      }

      return {
        success: true,
        data: {
          finalSourceId,
          finalTargetId,
          swapped,
          sourceEmbeddings: swapped ? targetEmbeddings : sourceEmbeddings,
          targetEmbeddings: swapped ? sourceEmbeddings : targetEmbeddings,
          warnings
        }
      };
    } catch (error) {
      console.error('[IPC:preview-merge-speakers] Error:', error);
      return { success: false, error: error.message || String(error) };
    }
  });

  /**
    * `delete-speaker-recording-resolution`
    *
    * Elimina la relación entre un hablante y una grabación específica.
    * Esto elimina tanto la resolución (la asociación) como el embedding para esa grabación.
   *
   * Payload: { speakerId: string, recordingId: number }
   *
   * Respuesta: { success: true, deletedCount: number } | { success: false, error: string }
   */
  ipcMain.handle('delete-speaker-recording-resolution', async (_event, { speakerId, recordingId } = {}) => {
    try {
      if (!speakerId || !recordingId) {
        return { success: false, error: 'speakerId y recordingId son requeridos' };
      }

      // Operación atómica: embedding + resolución en una sola transacción
      const txResult = dbService.deleteSpeakerRecordingRelationAtomically(speakerId, recordingId);
      if (!txResult?.success) {
        return { success: false, error: txResult?.error || 'No se pudo eliminar la relación del hablante' };
      }

      return {
        success: true,
        deletedCount: txResult.deletedCount ?? 0,
        deletedEmbeddings: txResult.deletedEmbeddings ?? 0,
        deletedResolutions: txResult.deletedResolutions ?? 0
      };
    } catch (error) {
      console.error('[IPC:delete-speaker-recording-resolution] Error:', error);
      return { success: false, error: error.message || String(error) };
    }
  });

}

module.exports = { registerSpeakersHandlers };
