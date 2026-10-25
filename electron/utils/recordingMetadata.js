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

/**
 * Lee el nombre a mostrar de una grabación desde su metadata.json.
 * Devuelve customName si es un string no vacío; si no (ausente, corrupto, vacío), el fallback.
 * @param {string} folderPath - Ruta absoluta de la carpeta de la grabación
 * @param {string} fallback - Nombre a usar si no hay customName válido
 * @returns {string}
 */
function readDisplayName(folderPath, fallback) {
  const metadataPath = path.join(folderPath, 'metadata.json');
  if (!fs.existsSync(metadataPath)) {
    return fallback;
  }
  try {
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    const customName = metadata && typeof metadata === 'object' ? metadata.customName : null;
    if (typeof customName === 'string' && customName.trim() !== '') {
      return customName;
    }
  } catch (e) {
    console.warn(`Error leyendo metadata en ${folderPath}:`, e.message);
  }
  return fallback;
}

module.exports = { updateRecordingMetadata, readDisplayName };
