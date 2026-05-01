/**
 * Servicio para acceder a las estadísticas y directorio de hablantes
 */

class SpeakersService {
  /**
   * Obtiene métricas agregadas del sistema de reconocimiento de hablantes
   * @returns {Promise<Object>} Estadísticas de speakers
   */
  async getSpeakerStats() {
    try {
      if (!window.electronAPI?.getSpeakerStats) {
        throw new Error('API de Electron no disponible');
      }
      const result = await window.electronAPI.getSpeakerStats();
      if (!result.success) {
        throw new Error(result.error || 'Error obteniendo estadísticas de hablantes');
      }
      return result.data;
    } catch (error) {
      console.error('Error obteniendo estadísticas de hablantes:', error);
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
  }

  /**
   * Obtiene todos los hablantes ordenados por nº de grabaciones DESC
   * @returns {Promise<Array>} Lista de hablantes con recordingCount y embeddingsCount
   */
  async getSpeakersWithRecordings() {
    try {
      if (!window.electronAPI?.getSpeakersWithRecordings) {
        throw new Error('API de Electron no disponible');
      }
      const result = await window.electronAPI.getSpeakersWithRecordings();
      if (!result.success) {
        throw new Error(result.error || 'Error obteniendo hablantes');
      }
      return result.data || [];
    } catch (error) {
      console.error('Error obteniendo hablantes:', error);
      return [];
    }
  }

  /**
   * Obtiene las grabaciones donde aparece un hablante específico
   * @param {string} speakerId - UUID del hablante
   * @returns {Promise<{ speaker: Object, recordings: Array } | null>}
   */
  async getSpeakerRecordings(speakerId) {
    try {
      if (!window.electronAPI?.getSpeakerRecordings) {
        throw new Error('API de Electron no disponible');
      }
      const result = await window.electronAPI.getSpeakerRecordings({ speakerId });
      if (!result.success) {
        return null;
      }
      return result.data;
    } catch (error) {
      console.error('Error obteniendo grabaciones del hablante:', error);
      return null;
    }
  }

  /**
   * Obtiene los hablantes más similares al indicado, basándose en similitud coseno
   * @param {string} speakerId - UUID del hablante de referencia
   * @param {number} [limit=5] - Máximo número de resultados
   * @returns {Promise<Array<{ id: string, displayName: string, similarity: number }>>}
   */
  async getSimilarSpeakers(speakerId, limit = 5) {
    try {
      if (!window.electronAPI?.getSimilarSpeakers) {
        throw new Error('API de Electron no disponible');
      }
      const result = await window.electronAPI.getSimilarSpeakers({ speakerId, limit });
      if (!result.success) {
        return [];
      }
      return result.data || [];
    } catch (error) {
      console.error('Error obteniendo hablantes similares:', error);
      return [];
    }
  }

/**
    * Fusiona un speaker similar en el speaker actual
    * @param {string} targetSpeakerId - UUID del speaker que absorbe
    * @param {string} sourceSpeakerId - UUID del speaker que se fusiona
    * @returns {Promise<{ success: boolean, mergedName?: string, error?: string }>}
    */
  async mergeSimilarSpeaker(targetSpeakerId, sourceSpeakerId) {
    try {
      if (!window.electronAPI?.mergeSimilarSpeaker) {
        throw new Error('API de Electron no disponible');
      }
      const result = await window.electronAPI.mergeSimilarSpeaker({ targetSpeakerId, sourceSpeakerId });
      return result;
    } catch (error) {
      console.error('Error fusionando hablantes:', error);
      return { success: false, error: error.message || String(error) };
    }
  }

  /**
    * Previsualiza un merge entre dos hablantes.
    * Devuelve origen/destino finales (con auto-swap), recuentos de embeddings y advertencias.
    *
    * @param {string} sourceSpeakerId - UUID del speaker de origen
    * @param {string} targetSpeakerId - UUID del speaker de destino
    * @returns {Promise<{ success: boolean, data?: { finalSourceId: string, finalTargetId: string, swapped: boolean, sourceEmbeddings: number, targetEmbeddings: number, warnings: string[] }, error?: string }>}
    */
  async previewMergeSpeakers(sourceSpeakerId, targetSpeakerId) {
    try {
      if (!window.electronAPI?.previewMergeSpeakers) {
        throw new Error('API de Electron no disponible');
      }
      const result = await window.electronAPI.previewMergeSpeakers({ sourceSpeakerId, targetSpeakerId });
      return result;
    } catch (error) {
      console.error('Error en previsualización de merge:', error);
      return { success: false, error: error.message || String(error) };
    }
  }

  /**
   * Obtiene el timestamp del primer segmento de un hablante en una grabación,
   * leyendo del archivo transcripcion_combinada.json.
   * Se usa para hacer seek al punto exacto donde ese hablante empieza a hablar.
   *
   * @param {string} speakerId - UUID del hablante persistente
   * @param {number} recordingId - ID numérico de la grabación
   * @returns {Promise<{ startTime: number, ephemeralId: string } | null>}
   */
  async getSpeakerFirstSegmentTime(speakerId, recordingId) {
    try {
      if (!window.electronAPI?.getSpeakerFirstSegmentTime) {
        throw new Error('API de Electron no disponible');
      }
      const result = await window.electronAPI.getSpeakerFirstSegmentTime({ speakerId, recordingId });
      if (!result.success) {
        return null;
      }
      return result.data;
    } catch (error) {
      console.error('Error obteniendo timestamp del hablante:', error);
      return null;
    }
  }

  /**
   * Elimina la relación entre un hablante y una grabación específica.
   * Esto elimina tanto la resolución (la asociación) como el embedding para esa grabación.
   *
   * @param {string} speakerId - UUID del hablante
   * @param {number} recordingId - ID de la grabación
   * @returns {Promise<{ success: boolean, deletedCount?: number, error?: string }>}
   */
  async deleteSpeakerRecordingResolution(speakerId, recordingId) {
    try {
      if (!window.electronAPI?.deleteSpeakerRecordingResolution) {
        throw new Error('API de Electron no disponible');
      }
      const result = await window.electronAPI.deleteSpeakerRecordingResolution({ speakerId, recordingId });
      return result;
    } catch (error) {
      console.error('Error eliminando relación hablante-grabación:', error);
      return { success: false, error: error.message || String(error) };
    }
  }
}

// Instancia singleton del servicio
const speakersService = new SpeakersService();

export default speakersService;
