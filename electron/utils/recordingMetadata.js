const fs = require('fs');
const path = require('path');

/**
 * Fusiona (shallow) un patch en el metadata.json de una grabación.
 * - Si la carpeta no existe, no hace nada (nunca la crea).
 * - Si metadata.json no existe o está corrupto, parte de un objeto vacío.
 * @param {string} folderPath - Ruta absoluta de la carpeta de la grabación
 * @param {Object} patch - Claves a escribir (null se escribe como null)
 * @returns {Promise<{written: boolean}>}
 */
async function updateRecordingMetadata(folderPath, patch) {
  if (!fs.existsSync(folderPath)) {
    return { written: false };
  }

  const metadataPath = path.join(folderPath, 'metadata.json');
  let metadata = {};
  try {
    const parsed = JSON.parse(await fs.promises.readFile(metadataPath, 'utf8'));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      metadata = parsed;
    } else {
      console.warn(`metadata.json de ${folderPath} no es un objeto, se sobrescribe`);
    }
  } catch (e) {
    if (e.code !== 'ENOENT') {
      console.warn(`metadata.json ilegible en ${folderPath}, se sobrescribe:`, e.message);
    }
  }

  await fs.promises.writeFile(metadataPath, JSON.stringify({ ...metadata, ...patch }, null, 2), 'utf8');
  return { written: true };
}

module.exports = { updateRecordingMetadata };
