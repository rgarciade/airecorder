/**
 * Servicio para gestionar grabaciones y transcripciones
 * Maneja la búsqueda de carpetas de grabación y sus análisis correspondientes
 */

class RecordingsService {
  constructor() {
    this.baseRecordingPath = '/Users/raul.garciad/Desktop/recorder/grabaciones';
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
        id: folder.folderName, // Usar el nombre de la carpeta física para rutas y archivos
        dbId: folder.id,       // ID numérico de la base de datos
        name: folder.name,     // Nombre de visualización (custom o carpeta)
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
        files: folder.files || [],
        duration: folder.duration,
        status: folder.status,
        transcriptionModel: folder.transcriptionModel,
        project: folder.project,
        queueStatus: folder.queueStatus
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
   * Obtiene la transcripción combinada en texto plano de una grabación específica
   * @param {string} recordingId - ID de la grabación
   * @returns {Promise<string|null>} Texto plano o null si no existe
   */
  async getTranscriptionTxt(recordingId) {
    try {
      if (!window.electronAPI?.getTranscriptionTxt) {
        throw new Error('API de Electron no disponible');
      }
      const result = await window.electronAPI.getTranscriptionTxt(recordingId);
      if (!result.success) {
        console.warn(`No se encontró TXT para ${recordingId}:`, result.error);
        return null;
      }
      return result.text;
    } catch (error) {
      console.error('Error obteniendo TXT de transcripción:', error);
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
   * @param {string} model - Tamaño del modelo opcional
   * @returns {Promise<Object>} Estado de la transcripción
   */
  async transcribeRecording(recordingId, model = null) {
    try {
      if (!window.electronAPI?.transcribeRecording) {
        throw new Error('API de Electron no disponible');
      }
      const result = await window.electronAPI.transcribeRecording(recordingId, model);
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

  /**
   * Guarda el resumen de Gemini en la carpeta de análisis
   */
  async saveAiSummary(recordingId, summaryJson) {
    try {
      if (!window.electronAPI?.saveAiSummary) throw new Error('API de Electron no disponible');
      console.log('summaryJson', summaryJson);
      const result = await window.electronAPI.saveAiSummary(recordingId, summaryJson);
      return result.success;
    } catch (error) {
      console.error('Error guardando resumen Gemini:', error);
      return false;
    }
  }

  /**
   * Lee el resumen de Gemini de la carpeta de análisis
   */
  async getAiSummary(recordingId) {
    try {
      if (!window.electronAPI?.getAiSummary) throw new Error('API de Electron no disponible');
      const result = await window.electronAPI.getAiSummary(recordingId);
      if (!result.success) return null;
      return result.summary;
    } catch (error) {
      console.error('Error leyendo resumen Gemini:', error);
      return null;
    }
  }

  /**
   * Guarda una pregunta/respuesta en el histórico
   */
  async saveQuestionHistory(recordingId, qa) {
    try {
      if (!window.electronAPI?.saveQuestionHistory) throw new Error('API de Electron no disponible');
      const result = await window.electronAPI.saveQuestionHistory(recordingId, qa);
      return result.success;
    } catch (error) {
      console.error('Error guardando histórico de preguntas:', error);
      return false;
    }
  }

  /**
   * Lee el histórico de preguntas y respuestas
   */
  async getQuestionHistory(recordingId) {
    try {
      if (!window.electronAPI?.getQuestionHistory) throw new Error('API de Electron no disponible');
      const result = await window.electronAPI.getQuestionHistory(recordingId);
      if (!result.success) return [];
      return result.history;
    } catch (error) {
      console.error('Error leyendo histórico de preguntas:', error);
      return [];
    }
  }

  /**
   * Guarda los participantes de la reunión
   */
  async saveParticipants(recordingId, participants) {
    try {
      if (!window.electronAPI?.saveParticipants) throw new Error('API de Electron no disponible');
      const result = await window.electronAPI.saveParticipants(recordingId, participants);
      return result.success;
    } catch (error) {
      console.error('Error guardando participantes:', error);
      return false;
    }
  }

  /**
   * Renombra una grabación (actualiza el nombre de visualización en los metadatos)
   * @param {string} recordingId - ID de la grabación
   * @param {string} newName - Nuevo nombre para la grabación
   * @returns {Promise<boolean>} True si se renombró correctamente
   */
  async renameRecording(recordingId, newName) {
    try {
      if (!window.electronAPI?.renameRecording) {
        throw new Error('API de Electron no disponible');
      }
      const result = await window.electronAPI.renameRecording(recordingId, newName);
      if (!result.success) {
        throw new Error(result.error || 'Error renombrando grabación');
      }
      return result;
    } catch (error) {
      console.error('Error renombrando grabación:', error);
      throw error;
    }
  }

  /**
   * Lee los participantes de la reunión
   */
  async getParticipants(recordingId) {
    try {
      if (!window.electronAPI?.getParticipants) throw new Error('API de Electron no disponible');
      const result = await window.electronAPI.getParticipants(recordingId);
      if (!result.success) return [];
      return result.participants;
    } catch (error) {
      console.error('Error leyendo participantes:', error);
      return [];
    }
  }

  /**
   * Genera el análisis completo de una grabación (resumen detallado, corto y key points)
   * @param {string} recordingId
   * @param {string} transcriptionTxt - Texto opcional para evitar doble lectura
   * @returns {Promise<Object>} Resultado del análisis
   */
  async generateFullAnalysis(recordingId, transcriptionTxt = null) {
    try {
      // 1. Verificar si ya existe
      const existing = await this.getAiSummary(recordingId);
      if (existing && existing.resumen_breve && Array.isArray(existing.ideas)) {
        console.log(`Análisis ya existente para ${recordingId}`);
        return existing;
      }

      // 2. Obtener texto si no se proporcionó
      let txt = transcriptionTxt;
      if (!txt) {
        txt = await this.getTranscriptionTxt(recordingId);
      }
      
      if (!txt) {
        throw new Error('No se pudo obtener el texto de la transcripción');
      }

      // Importar dependencias dinámicamente para evitar ciclos o problemas de carga
      const { generateWithContext } = await import('./aiService');
      const { detailedSummaryPrompt, shortSummaryPrompt, keyPointsPrompt } = await import('../prompts/aiPrompts');

      // 3. Generar resumen detallado primero (contexto para los demás)
      const detailedResponse = await generateWithContext(detailedSummaryPrompt, txt);
      const detailedText = detailedResponse.text || '';

      // 4. Generar resumen corto y puntos clave en paralelo
      const [shortSummary, keyPointResponse] = await Promise.all([
        generateWithContext(shortSummaryPrompt, detailedText || txt),
        generateWithContext(keyPointsPrompt, detailedText || txt)
      ]);

      const shortSummaryText = shortSummary.text || '';
      const keyPointText = keyPointResponse.text || '';

      // 5. Procesar ideas
      let ideas = [];
      if (keyPointText) {
        ideas = keyPointText.split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0 && (line.startsWith('-') || line.startsWith('•') || /^\d+\./.test(line)))
          .map(line => line.replace(/^[•-]\s*|^\d+\.\s*/, ''));
      }

      const dataToSave = {
        resumen_breve: shortSummaryText,
        ideas: ideas,
        resumen_detallado: detailedText,
        key_points: keyPointText,
        resumen_corto: shortSummaryText
      };

      // 6. Guardar
      await this.saveAiSummary(recordingId, dataToSave);
      
      return dataToSave;

    } catch (error) {
      console.error(`Error generando análisis completo para ${recordingId}:`, error);
      throw error;
    }
  }
}

// Instancia singleton del servicio
const recordingsService = new RecordingsService();

export default recordingsService; 