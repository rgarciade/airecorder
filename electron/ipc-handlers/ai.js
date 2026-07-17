const { ipcMain } = require('electron');
const fs = require('fs');

let settingsPathOverride = null;

function normalizeBaseUrl(url) {
  if (!url) return '';
  return url.replace(/\/v1\/?$/, '').replace(/\/$/, '');
}

function loadSettings() {
  try {
    const targetPath = settingsPathOverride || require('../utils/paths').settingsPath;
    if (fs.existsSync(targetPath)) {
      const data = fs.readFileSync(targetPath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('[AI] Error loading settings:', error);
  }
  return {};
}

function findCustomConnection(settings, connectionId) {
  return (settings?.customConnections || []).find((conn) => conn.id === connectionId);
}

function buildCustomError(response, errBody) {
  const errMsg =
    typeof errBody.error === 'string'
      ? errBody.error
      : errBody.error?.message || errBody.message || `HTTP ${response.status}`;
  return `Custom OpenAI Error: ${response.status}${errMsg ? ' — ' + errMsg : ''}`;
}

module.exports.registerAiHandlers = (ipcMainInstance = ipcMain) => {
  ipcMainInstance.handle('ai:custom-list-models', async (event, connectionId) => {
    try {
      if (!connectionId) {
        return { success: false, error: 'Falta el identificador de conexión' };
      }

      const settings = loadSettings();
      const connection = findCustomConnection(settings, connectionId);
      if (!connection) {
        return { success: false, error: 'Conexión personalizada no encontrada' };
      }

      const baseUrl = normalizeBaseUrl(connection.baseUrl);
      if (!baseUrl) {
        return { success: false, error: 'La conexión no tiene una URL base válida' };
      }

      const headers = {};
      if (connection.apiKey) {
        headers.Authorization = `Bearer ${connection.apiKey}`;
      }

      const response = await fetch(`${baseUrl}/v1/models`, { headers });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        return { success: false, error: buildCustomError(response, errBody) };
      }

      const data = await response.json();
      const models = (data.data || []).map((m) => ({
        name: m.id,
        label: m.id,
        description: m.object || 'Modelo disponible en la conexión personalizada',
      }));

      return { success: true, models };
    } catch (error) {
      console.error('[AI] Error listing custom models:', error);
      return { success: false, error: error.message || String(error) };
    }
  });
};

module.exports.__setSettingsPath = (path) => {
  settingsPathOverride = path;
};
