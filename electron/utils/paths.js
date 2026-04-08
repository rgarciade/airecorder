const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const dbService = require('../database/dbService');

const DEFAULT_BASE_RECORDER_PATH = path.join(app.getPath('desktop'), 'recorder');
const PROJECTS_PATH = path.join(DEFAULT_BASE_RECORDER_PATH, 'projects');
const settingsPath = path.join(app.getPath('userData'), 'settings.json');

async function getRecordingsPath() {
  let recordingPath = path.join(DEFAULT_BASE_RECORDER_PATH, 'grabaciones'); // Default
  try {
    if (fs.existsSync(settingsPath)) {
      const data = await fs.promises.readFile(settingsPath, 'utf8');
      const settings = JSON.parse(data);
      if (settings.outputDirectory) {
        recordingPath = settings.outputDirectory;
      }
    }
  } catch (error) {
    console.error('Error leyendo configuración para ruta:', error);
  }
  
  // COMPATIBILIDAD
  const subGrabaciones = path.join(recordingPath, 'grabaciones');
  if (fs.existsSync(subGrabaciones)) return subGrabaciones;
  return recordingPath;
}

async function getFolderPathFromId(recordingId) {
  if (typeof recordingId === 'number' || !isNaN(Number(recordingId))) {
    const dbEntry = dbService.db.prepare("SELECT relative_path FROM recordings WHERE id = ?").get(recordingId);
    return dbEntry ? dbEntry.relative_path : recordingId.toString();
  }
  return recordingId;
}

/**
 * Lee un setting específico del archivo de configuración de forma síncrona.
 * @param {string} key - Clave del setting
 * @param {*} defaultValue - Valor por defecto si no existe o hay error
 */
function getSetting(key, defaultValue = null) {
  try {
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, 'utf8');
      const settings = JSON.parse(data);
      return settings[key] !== undefined ? settings[key] : defaultValue;
    }
  } catch (e) {
    console.error(`[Settings] Error leyendo setting "${key}":`, e);
  }
  return defaultValue;
}

module.exports = {
  DEFAULT_BASE_RECORDER_PATH,
  PROJECTS_PATH,
  settingsPath,
  getRecordingsPath,
  getFolderPathFromId,
  getSetting
};