/**
 * Servicio para gestionar grabaciones y transcripciones
 * Maneja la búsqueda de carpetas de grabación y sus análisis correspondientes
 */

class RecordingsService {
  constructor() {
    this.baseRecordingPath = '/Users/raul.garciad/Desktop/recorder';
  }

  /**
   * Obtiene todas las grabaciones disponibles
   * @returns {Promise<Array>} Lista de grabaciones con metadata
   */
  async getRecordings() {
    try {
      if (!window.electronAPI?.getRecordingFolders) {
        throw new Error('API de Electron no disponible');
      }

      const result = await window.electronAPI.getRecordingFolders();
      
      if (!result.success) {
        throw new Error(result.error || 'Error obteniendo grabaciones');
      }

      // Procesar y formatear los datos de las grabaciones
      return result.folders.map(folder => ({
        id: folder.name,
        name: folder.name,
        date: new Date(folder.createdAt).toLocaleDateString('es-ES', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        createdAt: folder.createdAt,
        path: folder.path,
        hasTranscription: folder.hasAnalysis,
        files: folder.files || []
      }));

    } catch (error) {
      console.error('Error obteniendo grabaciones:', error);
      return [];
    }
  }

  /**
   * Obtiene la transcripción combinada de una grabación específica
   * @param {string} recordingId - ID de la grabación
   * @returns {Promise<Object|null>} Datos de transcripción o null si no existe
   */
  async getTranscription(recordingId) {
    try {
      if (!window.electronAPI?.getTranscription) {
        throw new Error('API de Electron no disponible');
      }

      const result = await window.electronAPI.getTranscription(recordingId);
      
      if (!result.success) {
        console.warn(`No se encontró transcripción para ${recordingId}:`, result.error);
        return null;
      }

      return result.transcription;

    } catch (error) {
      console.error('Error obteniendo transcripción:', error);
      return null;
    }
  }

  /**
   * Elimina una grabación completa (carpeta y análisis)
   * @param {string} recordingId - ID de la grabación a eliminar
   * @returns {Promise<boolean>} True si se eliminó correctamente
   */
  async deleteRecording(recordingId) {
    try {
      if (!window.electronAPI?.deleteRecording) {
        throw new Error('API de Electron no disponible');
      }

      const result = await window.electronAPI.deleteRecording(recordingId);
      
      if (!result.success) {
        throw new Error(result.error || 'Error eliminando grabación');
      }

      return true;

    } catch (error) {
      console.error('Error eliminando grabación:', error);
      throw error;
    }
  }

  /**
   * Descarga los archivos de una grabación
   * @param {string} recordingId - ID de la grabación
   * @returns {Promise<boolean>} True si se descargó correctamente
   */
  async downloadRecording(recordingId) {
    try {
      if (!window.electronAPI?.downloadRecording) {
        throw new Error('API de Electron no disponible');
      }

      const result = await window.electronAPI.downloadRecording(recordingId);
      
      if (!result.success) {
        throw new Error(result.error || 'Error descargando grabación');
      }

      return true;

    } catch (error) {
      console.error('Error descargando grabación:', error);
      throw error;
    }
  }

  /**
   * Lanza el proceso de transcripción para una grabación
   * @param {string} recordingId
   * @returns {Promise<Object>} Estado de la transcripción
   */
  async transcribeRecording(recordingId) {
    try {
      if (!window.electronAPI?.transcribeRecording) {
        throw new Error('API de Electron no disponible');
      }
      const result = await window.electronAPI.transcribeRecording(recordingId);
      return result;
    } catch (error) {
      console.error('Error lanzando transcripción:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Formatea los segmentos de transcripción para mostrar en la UI
   * @param {Array} segments - Segmentos de transcripción
   * @returns {Array} Segmentos formateados para la UI
   */
  formatTranscriptionSegments(segments) {
    if (!segments || !Array.isArray(segments)) {
      return [];
    }

    return segments.map(segment => ({
      id: `${segment.start}-${segment.source}`,
      timestamp: this.formatTimestamp(segment.start),
      text: segment.text,
      source: segment.source,
      speaker: segment.speaker,
      emoji: segment.emoji,
      startTime: segment.start,
      endTime: segment.end,
      duration: segment.end - segment.start
    }));
  }

  /**
   * Formatea un timestamp en segundos a formato legible
   * @param {number} seconds - Segundos
   * @returns {string} Timestamp formateado (MM:SS)
   */
  formatTimestamp(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  /**
   * Agrupa los segmentos por speaker para facilitar la visualización
   * @param {Array} segments - Segmentos de transcripción
   * @returns {Object} Segmentos agrupados por tipo (micrófono/sistema)
   */
  groupSegmentsBySource(segments) {
    const microphoneSegments = [];
    const systemSegments = [];

    segments.forEach(segment => {
      if (segment.source === 'micrófono') {
        microphoneSegments.push(segment);
      } else if (segment.source === 'sistema') {
        systemSegments.push(segment);
      }
    });

    return {
      microphone: microphoneSegments,
      system: systemSegments,
      all: segments.sort((a, b) => a.startTime - b.startTime)
    };
  }
}

// Instancia singleton del servicio
const recordingsService = new RecordingsService();

export default recordingsService; 