/**
 * Servicio frontend para RAG - wrapper sobre IPC calls
 */
class RagService {
  /**
   * Indexa una transcripción para RAG
   * @param {string|number} recordingId
   * @returns {Promise<{ success: boolean, indexed?: boolean, skippedRag?: boolean, totalChunks?: number, error?: string }>}
   */
  async indexRecording(recordingId) {
    if (!window.electronAPI?.indexRecording) {
      return { success: false, error: 'API de RAG no disponible' };
    }
    return await window.electronAPI.indexRecording(recordingId);
  }

  /**
   * Busca chunks relevantes para una query
   * @param {string|number} recordingId
   * @param {string} query
   * @param {number} topK
   * @returns {Promise<{ success: boolean, chunks?: Array }>}
   */
  async search(recordingId, query, topK = 5) {
    if (!window.electronAPI?.searchRecording) {
      return { success: false, error: 'API de RAG no disponible' };
    }
    return await window.electronAPI.searchRecording(recordingId, query, topK);
  }

  /**
   * Obtiene el estado de indexación de un recording
   * @param {string|number} recordingId
   * @returns {Promise<{ success: boolean, indexed?: boolean, totalChunks?: number }>}
   */
  async getStatus(recordingId) {
    if (!window.electronAPI?.getRagStatus) {
      return { success: false, indexed: false };
    }
    return await window.electronAPI.getRagStatus(recordingId);
  }

  /**
   * Elimina el índice RAG de un recording
   * @param {string|number} recordingId
   * @returns {Promise<{ success: boolean }>}
   */
  async deleteIndex(recordingId) {
    if (!window.electronAPI?.deleteRagIndex) {
      return { success: false, error: 'API de RAG no disponible' };
    }
    return await window.electronAPI.deleteRagIndex(recordingId);
  }
}

const ragService = new RagService();
export default ragService;
