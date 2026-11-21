const path = require('path');
const dbService = require('../database/dbService');
const { getRecordingsPath, getFolderPathFromId } = require('../utils/paths');
const { updateRecordingMetadata } = require('../utils/recordingMetadata');

// Lee de la BD sin propagar errores. Es aceptable tragar el fallo: la metadata es un espejo
// informativo (SQLite es la fuente de verdad) y no debe alterar el resultado IPC tras escribir en la BD
function readOrDefault(read, fallback) {
  try {
    return read();
  } catch (error) {
    console.error('Error leyendo datos para sincronizar metadata:', error);
    return fallback;
  }
}

// Sincroniza el proyecto actual de una grabación (o null si no tiene) en su metadata.json
async function syncRecordingProjectName(recordingId) {
  await syncProjectName([recordingId], readOrDefault(() => dbService.getRecordingProject(recordingId)?.name ?? null, null));
}

// Refleja el nombre del proyecto en el metadata.json de cada grabación.
// Informativo: SQLite es la fuente de verdad. Nunca lanza; un fallo no afecta al resto.
async function syncProjectName(recordingIds, projectName) {
  let baseDir;
  try {
    baseDir = await getRecordingsPath();
  } catch (error) {
    console.error('Error resolviendo la ruta de grabaciones para metadata:', error);
    return;
  }
  for (const recordingId of recordingIds) {
    try {
      const folderName = await getFolderPathFromId(recordingId);
      await updateRecordingMetadata(path.join(baseDir, folderName), { projectName });
    } catch (error) {
      console.error(`Error actualizando projectName en metadata de ${recordingId}:`, error);
    }
  }
}

module.exports = { readOrDefault, syncProjectName, syncRecordingProjectName };
