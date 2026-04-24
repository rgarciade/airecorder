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
}

module.exports = { registerSpeakersHandlers };
