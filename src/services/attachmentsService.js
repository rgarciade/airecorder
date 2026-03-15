/**
 * Servicio de adjuntos para grabaciones.
 * Wrapper sobre las llamadas IPC de Electron para gestionar
 * archivos adjuntos (imágenes, PDFs, texto) asociados a una grabación.
 */

/**
 * Obtiene la lista de adjuntos de una grabación.
 * @param {number|string} recordingId
 * @returns {Promise<{filename, type, size, mimeType, createdAt}[]>}
 */
export async function getAttachments(recordingId) {
  const result = await window.electronAPI.getAttachments(recordingId);
  if (!result.success) {
    console.error('Error obteniendo adjuntos:', result.error);
    return [];
  }
  return result.attachments;
}

/**
 * Abre el selector de archivos del sistema y añade el/los archivos
 * seleccionados a la carpeta de adjuntos de la grabación.
 * @param {number|string} recordingId
 * @param {Object} options Opciones como { allowImages: boolean }
 * @returns {Promise<{attachments: [], canceled: boolean}>}
 */
export async function pickAndAddAttachment(recordingId, options = {}) {
  const result = await window.electronAPI.pickAndAddAttachment(recordingId, options);
  if (!result.success && !result.canceled) {
    console.error('Error añadiendo adjunto:', result.error);
    return { attachments: [], canceled: false };
  }
  return {
    attachments: result.attachments || [],
    canceled: result.canceled || false
  };
}

/**
 * Elimina un adjunto de una grabación.
 * @param {number|string} recordingId
 * @param {string} filename
 * @returns {Promise<boolean>}
 */
export async function deleteAttachment(recordingId, filename) {
  const result = await window.electronAPI.deleteAttachment(recordingId, filename);
  if (!result.success) {
    console.error('Error eliminando adjunto:', result.error);
    return false;
  }
  return true;
}

/**
 * Lee el contenido de un adjunto.
 * - Para imágenes: retorna base64 puro (sin prefijo data:)
 * - Para PDFs: retorna texto extraído
 * - Para texto/md: retorna el texto
 *
 * @param {number|string} recordingId
 * @param {string} filename
 * @returns {Promise<{type: 'image'|'text', data: string, mimeType: string}|null>}
 */
export async function readAttachmentContent(recordingId, filename) {
  const result = await window.electronAPI.readAttachmentContent(recordingId, filename);
  if (!result.success) {
    console.error('Error leyendo contenido de adjunto:', result.error);
    return null;
  }
  return { type: result.type, data: result.data, mimeType: result.mimeType };
}

/**
 * Obtiene la URL de thumbnail (data URL en base64) de una imagen adjunta.
 * @param {number|string} recordingId
 * @param {string} filename
 * @returns {Promise<string|null>} data URL o null si falla
 */
export async function getAttachmentThumbnail(recordingId, filename) {
  const result = await window.electronAPI.getAttachmentThumbnail(recordingId, filename);
  if (!result.success) {
    console.error('Error obteniendo thumbnail:', result.error);
    return null;
  }
  return result.data; // Ya viene como "data:image/png;base64,..."
}

/**
 * Estima los tokens que aportará un adjunto al contexto.
 * - Imágenes: ~256 tokens fijos (estimación conservadora Gemini)
 * - Texto/PDF: chars / 4
 *
 * @param {{type: string, data: string}} content - Resultado de readAttachmentContent
 * @returns {number}
 */
export function estimateAttachmentTokens(content) {
  if (!content) return 0;
  if (content.type === 'image') return 256;
  if (content.type === 'text' && content.data) {
    return Math.ceil(content.data.length / 4);
  }
  return 0;
}
