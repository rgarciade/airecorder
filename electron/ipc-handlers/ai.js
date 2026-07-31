const { ipcMain, shell } = require('electron');
const fs = require('fs');
let codexService = require('../services/codexService');

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
  ipcMainInstance.handle('ai:custom-list-models', async (event, connectionId, connectionData) => {
    try {
      if (!connectionId) {
        return { success: false, error: 'Falta el identificador de conexión' };
      }

      const connection = connectionData || findCustomConnection(loadSettings(), connectionId);
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

  ipcMainInstance.handle('ai:codex-status', () => codexService.getStatus());
  ipcMainInstance.handle('ai:codex-models', async () => {
    try {
      const models = await codexService.listModels();
      return { success: true, models, error: null };
    } catch (error) {
      return { success: false, models: [], error: error.message || String(error) };
    }
  });
  ipcMainInstance.handle('ai:codex-login', async (event, requestId) => codexService.startLogin({ requestId, onProgress: (progress) => { if (!event.sender?.isDestroyed?.()) { event.sender.send('ai:codex-login-progress', progress); if (progress.url) shell.openExternal(progress.url).catch(() => {}); } } }));
  ipcMainInstance.handle('ai:codex-login-cancel', (_event, requestId) => ({ success: codexService.cancelLogin(requestId) }));
  ipcMainInstance.handle('ai:codex-cancel', (_event, requestId) => ({ success: codexService.cancel(requestId) }));
  ipcMainInstance.handle('ai:codex-run', async (event, request) => {
    try {
      const result = await codexService.run({ ...request, onChunk: (text) => event.sender.send('ai:codex-chunk', { requestId: request.requestId, text }) });
      return { success: true, ...result };
    } catch (error) {
      return { success: false, error: error.message, code: error.code };
    }
  });
};

module.exports.__setCodexService = (service) => { codexService = service; };

module.exports.__setSettingsPath = (path) => {
  settingsPathOverride = path;
};
