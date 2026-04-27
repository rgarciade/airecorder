/**
 * speakersSlice.js
 *
 * Slice de Redux para gestionar el mapa de alias de hablantes.
 *
 * Estado:
 *   {
 *     map: {
 *       "SPEAKER_00": { speakerId: "uuid-...", displayName: "Juan" },
 *       "SPEAKER_01": { speakerId: "uuid-...", displayName: "María" }
 *     },
 *     allSpeakers: [
 *       { id: "uuid-...", display_name: "Juan" },
 *       ...
 *     ]
 *   }
 *
 * IMPORTANTE — Separación ID vs Alias:
 *   - Los ephemeralId ("SPEAKER_00") son generados por el modelo de diarización
 *     y cambian en cada sesión. Son TEMPORALES.
 *   - Los speakerId (UUID) son persistentes en BD y representan a la persona.
 *   - Los displayName (alias) son los nombres legibles que el usuario asigna.
 *   - El JSON de transcripción nunca se modifica; este mapa actúa como capa
 *     de presentación sobre los ephemeralId almacenados en los segmentos.
 */

import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  /**
   * Mapa ephemeralId → { speakerId, displayName }
   * Ej: { "SPEAKER_00": { speakerId: "abc-123", displayName: "Juan" } }
   */
  map: {},

  /**
   * Lista de todos los hablantes conocidos en BD.
   * Se usa para autocompletado en la UI.
   * Ej: [{ id: "abc-123", display_name: "Juan", created_at: "..." }]
   */
  allSpeakers: [],

  /**
   * ID de la grabación cuyos aliases están cargados en `map`.
   * Permite detectar si un remount es para la misma grabación (no sobreescribir)
   * o para una distinta (reemplazar mapa completo).
   */
  currentRecordingId: null,
};

export const speakersSlice = createSlice({
  name: 'speakers',
  initialState,
  reducers: {
    /**
     * Inicializa/reemplaza el mapa completo de hablantes.
     * Se usa cuando se carga una transcripción con embeddings ya resueltos.
     *
     * @param {Object} action.payload - Mapa completo:
     *   { "SPEAKER_00": { speakerId, displayName }, ... }
     */
    setAliases(state, action) {
      if (action.payload && typeof action.payload === 'object') {
        state.map = action.payload;
      }
    },

    /**
     * Inicializa los aliases para una grabación de forma inteligente:
     *   - Si `recordingId` es distinto al actual → reemplaza el mapa completo.
     *   - Si `recordingId` es el mismo → solo añade entradas que FALTEN en el mapa.
     *     Las entradas existentes (editadas por el usuario) NO se sobreescriben.
     *
     * Esto evita que al volver a montar TranscriptionViewer (navegación entre tabs),
     * las ediciones del usuario queden revertidas por el speakerResolution obsoleto
     * que el padre tiene cacheado en su estado.
     *
     * @param {Object} action.payload
     * @param {number|string|null} action.payload.recordingId  - ID de la grabación.
     * @param {Object}             action.payload.speakerResolution - Mapa inicial de BD.
     */
    initAliases(state, action) {
      const { recordingId, speakerResolution } = action.payload ?? {};
      if (!speakerResolution || typeof speakerResolution !== 'object') return;

      // La BD es la fuente de verdad: cuando llega speakerResolution desde el backend,
      // reemplaza siempre el mapa en memoria para evitar aliases stale en Redux.
      state.map = speakerResolution;
      state.currentRecordingId = recordingId ?? null;
    },

    /**
     * Actualiza o añade el alias de un hablante ephemeral específico.
     *
     * @param {Object} action.payload
     * @param {string} action.payload.ephemeralId - ID efímero ("SPEAKER_00").
     * @param {string} action.payload.speakerId   - UUID persistente del hablante.
     * @param {string} action.payload.displayName - Nombre legible para mostrar.
     */
    updateAlias(state, action) {
      const { ephemeralId, speakerId, displayName } = action.payload;
      if (ephemeralId && displayName !== undefined) {
        state.map[ephemeralId] = { speakerId, displayName };
      }
    },

    /**
     * Fusiona varios ephemeralIds hacia un único alias/speakerId.
     * Útil cuando el usuario indica que SPEAKER_00 y SPEAKER_01 son la misma persona.
     *
     * @param {Object} action.payload
     * @param {string[]} action.payload.sourceEphemeralIds - IDs que se absorben.
     * @param {string}   action.payload.targetSpeakerId    - UUID del perfil destino.
     * @param {string}   action.payload.displayName        - Alias unificado.
     */
    mergeSpeakers(state, action) {
      const { sourceEphemeralIds, targetSpeakerId, displayName } = action.payload;
      if (!Array.isArray(sourceEphemeralIds) || !targetSpeakerId || !displayName) return;
      for (const ephemeralId of sourceEphemeralIds) {
        state.map[ephemeralId] = { speakerId: targetSpeakerId, displayName };
      }
    },

    /**
     * Establece la lista completa de hablantes conocidos en BD.
     * Se usa para poblar el autocompletado.
     *
     * @param {Object[]} action.payload - Array de speakers de BD.
     */
    setAllSpeakers(state, action) {
      if (Array.isArray(action.payload)) {
        state.allSpeakers = action.payload;
      }
    },

    /**
     * Limpia el mapa de la sesión actual (al cerrar una transcripción, por ejemplo).
     */
    clearAliases(state) {
      state.map = {};
      state.currentRecordingId = null;
    },
  },
});

export const {
  setAliases,
  initAliases,
  updateAlias,
  mergeSpeakers,
  setAllSpeakers,
  clearAliases,
} = speakersSlice.actions;

// ── Selectors ──────────────────────────────────────────────────────────────────

/**
 * Retorna el alias a mostrar para un ephemeralId.
 * Si no hay alias, retorna el ephemeralId original como fallback.
 */
export const selectDisplayName = (ephemeralId) => (state) => {
  const entry = state.speakers.map[ephemeralId];
  return entry?.displayName || ephemeralId;
};

/**
 * Retorna el UUID persistente asociado a un ephemeralId.
 * Necesario para persistir cambios de alias en BD.
 */
export const selectSpeakerId = (ephemeralId) => (state) =>
  state.speakers.map[ephemeralId]?.speakerId ?? null;

/**
 * Retorna el mapa completo ephemeralId → { speakerId, displayName }.
 */
export const selectSpeakersMap = (state) => state.speakers.map;

/**
 * Retorna la lista de todos los hablantes conocidos (para autocompletado).
 */
export const selectAllSpeakers = (state) => state.speakers.allSpeakers;

export default speakersSlice.reducer;
