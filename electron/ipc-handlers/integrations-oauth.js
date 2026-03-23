/**
 * IPC Handlers para integraciones OAuth externas (Google Chat, Teams).
 *
 * Canales IPC expuestos:
 *   start-oauth-flow        — abre el navegador con la URL de OAuth
 *   get-platform-connections — lista cuentas conectadas (sin tokens)
 *   disconnect-platform     — elimina una conexión y sus project_integrations
 *   get-available-channels  — lista canales/spaces de una conexión
 *   get-project-integrations — canales vinculados a un proyecto
 *   link-channel-to-project — vincula un canal a un proyecto
 *   unlink-channel-from-project — desvincula
 *   sync-project-integrations — descarga mensajes nuevos de todos los canales vinculados
 */

const { ipcMain, shell, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const dbService = require('../database/dbService');
const { getRecordingsPath } = require('../utils/paths');
const { buildTranscriptionTxt, buildTranscriptionJson, assignRelativeTimestamps } = require('../integrations/chatSyncUtils');
const googleChat = require('../integrations/googleChatSyncService');
const teams = require('../integrations/teamsSyncService');

// ── Constantes ─────────────────────────────────────────────────────────────────
const REDIRECT_URI_GOOGLE = 'airecorder://google-chat-callback';
const REDIRECT_URI_TEAMS  = 'airecorder://teams-callback';

// Mapa de states pendientes para validar callbacks OAuth
// state → { platform, resolve, reject }
const pendingOAuthFlows = new Map();

// ── Helpers ────────────────────────────────────────────────────────────────────

function encryptToken(token) {
  if (!token) return null;
  try {
    return safeStorage.encryptString(token);
  } catch {
    // safeStorage puede no estar disponible en tests/CI
    return Buffer.from(token);
  }
}

function decryptToken(buffer) {
  if (!buffer) return null;
  try {
    return safeStorage.decryptString(Buffer.from(buffer));
  } catch {
    return Buffer.from(buffer).toString();
  }
}

/**
 * Obtiene un access_token válido para una conexión, renovándolo si ha expirado.
 * @param {object} connection  fila completa de platform_connections (con tokens cifrados)
 * @param {object} settings    ajustes del usuario (para leer client_id/secret)
 * @returns {string} accessToken
 */
async function getValidAccessToken(connection, settings) {
  const now = new Date();
  const expiresAt = connection.token_expires_at ? new Date(connection.token_expires_at) : null;
  const isExpired = !expiresAt || expiresAt <= now;

  const accessToken = decryptToken(connection.access_token_encrypted);

  if (!isExpired) return accessToken;

  // Token expirado — renovar
  const refreshToken = decryptToken(connection.refresh_token_encrypted);
  if (!refreshToken) throw new Error('No refresh token available');

  let refreshed;
  if (connection.platform === 'google-chat') {
    const clientId = settings?.googleChatClientId;
    const clientSecret = settings?.googleChatClientSecret;
    if (!clientId || !clientSecret) throw new Error('Google Chat credentials not configured');
    refreshed = await googleChat.refreshAccessToken(refreshToken, clientId, clientSecret);
  } else if (connection.platform === 'teams') {
    const clientId = settings?.teamsClientId;
    if (!clientId) throw new Error('Teams client ID not configured');
    refreshed = await teams.refreshAccessToken(refreshToken, clientId);
  } else {
    throw new Error(`Unknown platform: ${connection.platform}`);
  }

  dbService.updatePlatformConnectionTokens(
    connection.id,
    encryptToken(refreshed.accessToken),
    encryptToken(refreshed.refreshToken || refreshToken),
    refreshed.expiresAt
  );

  return refreshed.accessToken;
}

// ── Registro de handlers ───────────────────────────────────────────────────────

module.exports.registerIntegrationsOAuthHandlers = () => {

  /**
   * Inicia el flujo OAuth abriendo el navegador.
   * platform: 'google-chat' | 'teams'
   * settings: { googleChatClientId, googleChatClientSecret, teamsClientId }
   */
  ipcMain.handle('start-oauth-flow', async (event, { platform, settings }) => {
    return new Promise((resolve, reject) => {
      const state = crypto.randomBytes(16).toString('hex');
      pendingOAuthFlows.set(state, { platform, settings, resolve, reject });

      let authUrl;
      try {
        if (platform === 'google-chat') {
          if (!settings?.googleChatClientId) {
            pendingOAuthFlows.delete(state);
            return resolve({ success: false, error: 'Falta el Client ID de Google Chat' });
          }
          authUrl = googleChat.buildAuthUrl(settings.googleChatClientId, REDIRECT_URI_GOOGLE, state);
        } else if (platform === 'teams') {
          if (!settings?.teamsClientId) {
            pendingOAuthFlows.delete(state);
            return resolve({ success: false, error: 'Falta el Client ID de Teams' });
          }
          authUrl = teams.buildAuthUrl(settings.teamsClientId, REDIRECT_URI_TEAMS, state);
        } else {
          pendingOAuthFlows.delete(state);
          return resolve({ success: false, error: `Plataforma desconocida: ${platform}` });
        }
      } catch (err) {
        pendingOAuthFlows.delete(state);
        return resolve({ success: false, error: err.message });
      }

      shell.openExternal(authUrl);

      // Timeout de 5 minutos para no dejar flows colgados
      setTimeout(() => {
        if (pendingOAuthFlows.has(state)) {
          pendingOAuthFlows.delete(state);
          resolve({ success: false, error: 'OAuth timeout — el usuario no completó la autorización' });
        }
      }, 5 * 60 * 1000);
    });
  });

  // ── Listar conexiones ──────────────────────────────────────────────────────
  ipcMain.handle('get-platform-connections', () => {
    const connections = dbService.getAllPlatformConnections();
    return connections.map(c => ({
      id: c.id,
      platform: c.platform,
      accountName: c.account_name,
      accountId: c.account_id,
      scopes: JSON.parse(c.scopes || '[]'),
      connectedAt: c.connected_at
    }));
  });

  // ── Desconectar plataforma ─────────────────────────────────────────────────
  ipcMain.handle('disconnect-platform', (event, connectionId) => {
    return dbService.deletePlatformConnection(connectionId);
  });

  // ── Listar canales disponibles ─────────────────────────────────────────────
  ipcMain.handle('get-available-channels', async (event, { connectionId, settings }) => {
    try {
      const connection = dbService.getPlatformConnectionById(connectionId);
      if (!connection) return { success: false, error: 'Conexión no encontrada' };

      const accessToken = await getValidAccessToken(connection, settings);

      if (connection.platform === 'google-chat') {
        const spaces = await googleChat.listSpaces(accessToken);
        return { success: true, channels: spaces.map(s => ({ id: s.id, name: s.displayName, type: s.type })) };
      }

      if (connection.platform === 'teams') {
        const teamsList = await teams.listTeams(accessToken);
        const channels = [];
        for (const team of teamsList) {
          const teamChannels = await teams.listChannels(team.id, accessToken);
          channels.push(...teamChannels.map(c => ({
            id: c.id,
            name: `${team.displayName} / ${c.displayName}`,
            teamId: c.teamId,
            channelId: c.channelId
          })));
        }
        return { success: true, channels };
      }

      return { success: false, error: 'Plataforma no soportada' };
    } catch (err) {
      console.error('[OAuth] get-available-channels error:', err);
      return { success: false, error: err.message };
    }
  });

  // ── Obtener integraciones de un proyecto ──────────────────────────────────
  ipcMain.handle('get-project-integrations', (event, projectId) => {
    return dbService.getProjectIntegrations(projectId);
  });

  // ── Vincular canal a proyecto ─────────────────────────────────────────────
  ipcMain.handle('link-channel-to-project', (event, { projectId, connectionId, channelId, channelName }) => {
    return dbService.addProjectIntegration(projectId, connectionId, channelId, channelName);
  });

  // ── Desvincular canal de proyecto ─────────────────────────────────────────
  ipcMain.handle('unlink-channel-from-project', (event, integrationId) => {
    return dbService.deleteProjectIntegration(integrationId);
  });

  // ── Obtener integraciones de un chat ──────────────────────────────────────
  ipcMain.handle('get-chat-integrations', (event, chatId) => {
    return dbService.getChatIntegrations(chatId);
  });

  // ── Vincular canal a un chat ──────────────────────────────────────────────
  ipcMain.handle('link-channel-to-chat', (event, { projectId, chatId, connectionId, channelId, channelName, dateFrom, dateTo }) => {
    return dbService.addProjectIntegration(projectId, connectionId, channelId, channelName, chatId, dateFrom || null, dateTo || null);
  });

  // ── Desvincular canal de un chat ──────────────────────────────────────────
  ipcMain.handle('unlink-channel-from-chat', (event, integrationId) => {
    return dbService.deleteProjectIntegration(integrationId);
  });

  // ── Sincronizar integraciones de un chat ──────────────────────────────────
  ipcMain.handle('sync-chat-integrations', async (event, { chatId, projectId, settings }) => {
    const integrations = dbService.getChatIntegrations(chatId);
    if (!integrations.length) return { success: true, synced: 0, newMessages: 0 };

    let totalNew = 0;
    let synced = 0;
    const errors = [];
    const recordingsDir = await getRecordingsPath();

    for (const integration of integrations) {
      try {
        const connection = dbService.getPlatformConnectionById(integration.connection_id);
        if (!connection) continue;

        const accessToken = await getValidAccessToken(connection, settings);
        const after = integration.last_sync_at || integration.date_from || null;
        const dateTo = integration.date_to || null;

        let rawMessages = [];
        if (connection.platform === 'google-chat') {
          rawMessages = await googleChat.fetchMessages(integration.channel_id, accessToken, after);
        } else if (connection.platform === 'teams') {
          rawMessages = await teams.fetchMessages(integration.channel_id, accessToken, after);
        }

        // Filtrar por date_to si se ha especificado
        if (dateTo) {
          const dateToMs = new Date(dateTo).getTime();
          rawMessages = rawMessages.filter(m => new Date(m.timestamp || m.createTime || 0).getTime() <= dateToMs);
        }

        if (!rawMessages.length) { synced++; continue; }

        // Calcular offset para timestamps continuos
        let startOffset = 0;
        let existingJson = [];
        const folderPath = integration.recording_id
          ? await _getRecordingFolder(integration.recording_id, recordingsDir)
          : null;

        if (folderPath) {
          try {
            const jsonPath = path.join(folderPath, 'analysis', 'transcripcion_combinada.json');
            const existing = JSON.parse(await fs.promises.readFile(jsonPath, 'utf8'));
            existingJson = existing;
            if (existing.length > 0) startOffset = (existing[existing.length - 1].end || 0) + 3;
          } catch { /* primera vez */ }
        }

        const newSegments = assignRelativeTimestamps(rawMessages.map(m => ({ speaker: m.speaker, text: m.text })), startOffset);
        const allSegments = [...existingJson.map(s => ({ start: s.start, end: s.end, speaker: s.speaker, text: s.text })), ...newSegments];

        let recordingFolderPath = folderPath;
        let recordingId = integration.recording_id;

        if (!recordingFolderPath) {
          const platformPrefix = connection.platform === 'google-chat' ? 'gchat' : 'teams_sync';
          const safeName = (integration.channel_name || 'channel').replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 40);
          const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
          const folderName = `${platformPrefix}_${safeName}_${ts}`;
          recordingFolderPath = path.join(recordingsDir, folderName);
          await fs.promises.mkdir(path.join(recordingFolderPath, 'analysis'), { recursive: true });
          await fs.promises.writeFile(
            path.join(recordingFolderPath, 'metadata.json'),
            JSON.stringify({ customName: integration.channel_name || integration.channel_id }, null, 2), 'utf8'
          );
          const transcriptionModel = connection.platform === 'google-chat' ? 'gchat-sync' : 'teams-sync';
          const dbResult = dbService.saveRecording(folderName, 0, 'transcribed', new Date().toISOString(), transcriptionModel);
          if (!dbResult.success) throw new Error('Error guardando grabación en BD');
          recordingId = dbResult.id;
          if (projectId) dbService.addRecordingToProject(projectId, recordingId);
        }

        const analysisDir = path.join(recordingFolderPath, 'analysis');
        await fs.promises.writeFile(path.join(analysisDir, 'transcripcion_combinada.txt'), buildTranscriptionTxt(allSegments), 'utf8');
        await fs.promises.writeFile(path.join(analysisDir, 'transcripcion_combinada.json'), JSON.stringify(buildTranscriptionJson(allSegments), null, 2), 'utf8');
        dbService.updateDuration(path.basename(recordingFolderPath), allSegments.length > 0 ? allSegments[allSegments.length - 1].end : 0);
        dbService.updateProjectIntegrationSync(integration.id, recordingId, new Date().toISOString());

        totalNew += rawMessages.length;
        synced++;
      } catch (err) {
        console.error(`[ChatSync] Error sincronizando integración ${integration.id}:`, err);
        errors.push({ integrationId: integration.id, error: err.message });
      }
    }

    return { success: true, synced, newMessages: totalNew, errors };
  });

  // ── Sincronizar integraciones del proyecto ────────────────────────────────
  ipcMain.handle('sync-project-integrations', async (event, { projectId, settings }) => {
    const integrations = dbService.getProjectIntegrations(projectId);
    if (!integrations.length) return { success: true, synced: 0, newMessages: 0 };

    let totalNew = 0;
    let synced = 0;
    const errors = [];

    const recordingsDir = await getRecordingsPath();

    for (const integration of integrations) {
      try {
        const connection = dbService.getPlatformConnectionById(integration.connection_id);
        if (!connection) continue;

        const accessToken = await getValidAccessToken(connection, settings);
        const after = integration.last_sync_at || null;

        // Descargar mensajes nuevos
        let rawMessages = [];
        if (connection.platform === 'google-chat') {
          rawMessages = await googleChat.fetchMessages(integration.channel_id, accessToken, after);
        } else if (connection.platform === 'teams') {
          rawMessages = await teams.fetchMessages(integration.channel_id, accessToken, after);
        }

        if (!rawMessages.length) {
          synced++;
          continue;
        }

        // Calcular offset para timestamps continuos (si ya hay grabación)
        let startOffset = 0;
        let existingJson = [];
        const folderPath = integration.recording_id
          ? await _getRecordingFolder(integration.recording_id, recordingsDir)
          : null;

        if (folderPath) {
          try {
            const jsonPath = path.join(folderPath, 'analysis', 'transcripcion_combinada.json');
            const existing = JSON.parse(await fs.promises.readFile(jsonPath, 'utf8'));
            existingJson = existing;
            if (existing.length > 0) {
              startOffset = (existing[existing.length - 1].end || 0) + 3;
            }
          } catch { /* primera vez */ }
        }

        // Normalizar mensajes → segmentos con timestamps
        const newMessages = rawMessages.map(m => ({ speaker: m.speaker, text: m.text }));
        const newSegments = assignRelativeTimestamps(newMessages, startOffset);

        // Combinar con existentes y escribir archivos
        const allSegments = [...existingJson.map(s => ({
          start: s.start, end: s.end, speaker: s.speaker, text: s.text
        })), ...newSegments];

        let recordingFolderPath = folderPath;
        let recordingId = integration.recording_id;

        if (!recordingFolderPath) {
          // Primera sync: crear carpeta de grabación
          const platformPrefix = connection.platform === 'google-chat' ? 'gchat' : 'teams_sync';
          const safeName = (integration.channel_name || 'channel').replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 40);
          const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
          const folderName = `${platformPrefix}_${safeName}_${ts}`;
          recordingFolderPath = path.join(recordingsDir, folderName);
          await fs.promises.mkdir(path.join(recordingFolderPath, 'analysis'), { recursive: true });

          const customName = integration.channel_name || integration.channel_id;
          await fs.promises.writeFile(
            path.join(recordingFolderPath, 'metadata.json'),
            JSON.stringify({ customName }, null, 2), 'utf8'
          );

          const transcriptionModel = connection.platform === 'google-chat' ? 'gchat-sync' : 'teams-sync';
          const dbResult = dbService.saveRecording(folderName, 0, 'transcribed', new Date().toISOString(), transcriptionModel);
          if (!dbResult.success) throw new Error('Error guardando grabación en BD');
          recordingId = dbResult.id;

          // Vincular al proyecto
          dbService.addRecordingToProject(projectId, recordingId);
        }

        const analysisDir = path.join(recordingFolderPath, 'analysis');
        await fs.promises.writeFile(
          path.join(analysisDir, 'transcripcion_combinada.txt'),
          buildTranscriptionTxt(allSegments), 'utf8'
        );
        await fs.promises.writeFile(
          path.join(analysisDir, 'transcripcion_combinada.json'),
          JSON.stringify(buildTranscriptionJson(allSegments), null, 2), 'utf8'
        );

        // Actualizar duración estimada
        const totalDuration = allSegments.length > 0 ? allSegments[allSegments.length - 1].end : 0;
        dbService.updateDuration(path.basename(recordingFolderPath), totalDuration);

        dbService.updateProjectIntegrationSync(integration.id, recordingId, new Date().toISOString());

        totalNew += newMessages.length;
        synced++;
      } catch (err) {
        console.error(`[OAuth Sync] Error sincronizando integración ${integration.id}:`, err);
        errors.push({ integrationId: integration.id, error: err.message });
      }
    }

    return { success: true, synced, newMessages: totalNew, errors };
  });
};

/**
 * Handler del callback OAuth. Llamado desde main.js cuando llega el deep-link.
 * @param {string} url  e.g. "airecorder://google-chat-callback?code=...&state=..."
 */
async function handleOAuthCallback(url) {
  try {
    const parsed = new URL(url);
    const code = parsed.searchParams.get('code');
    const state = parsed.searchParams.get('state');
    const error = parsed.searchParams.get('error');

    if (!state || !pendingOAuthFlows.has(state)) {
      console.error('[OAuth] Callback con state desconocido:', state);
      return;
    }

    const { platform, settings, resolve } = pendingOAuthFlows.get(state);
    pendingOAuthFlows.delete(state);

    if (error) {
      return resolve({ success: false, error: `OAuth denegado: ${error}` });
    }
    if (!code) {
      return resolve({ success: false, error: 'No se recibió código de autorización' });
    }

    let tokens, userInfo;
    if (platform === 'google-chat') {
      tokens = await googleChat.exchangeCodeForTokens(code, settings.googleChatClientId, settings.googleChatClientSecret, REDIRECT_URI_GOOGLE);
      userInfo = await googleChat.getUserInfo(tokens.accessToken);
    } else if (platform === 'teams') {
      tokens = await teams.exchangeCodeForTokens(code, settings.teamsClientId, REDIRECT_URI_TEAMS, state);
      userInfo = await teams.getUserInfo(tokens.accessToken);
    } else {
      return resolve({ success: false, error: `Plataforma desconocida: ${platform}` });
    }

    const accountName = userInfo.name || userInfo.displayName || userInfo.email || 'Unknown';
    const accountId = userInfo.id || userInfo.sub || '';

    const result = dbService.savePlatformConnection(
      platform,
      accountName,
      accountId,
      encryptToken(tokens.accessToken),
      encryptToken(tokens.refreshToken),
      tokens.expiresAt,
      tokens.scopes
    );

    if (!result.success) {
      return resolve({ success: false, error: 'Error guardando conexión en base de datos' });
    }

    resolve({
      success: true,
      connection: { id: result.id, platform, accountName, accountId, connectedAt: new Date().toISOString() }
    });
  } catch (err) {
    console.error('[OAuth] Error en callback:', err);
    const firstPending = [...pendingOAuthFlows.values()][0];
    if (firstPending) {
      pendingOAuthFlows.clear();
      firstPending.resolve({ success: false, error: err.message });
    }
  }
}

module.exports.handleOAuthCallback = handleOAuthCallback;

// ── Helper privado ─────────────────────────────────────────────────────────────

async function _getRecordingFolder(recordingId, recordingsDir) {
  try {
    const recording = dbService.getRecordingById(recordingId);
    if (recording?.relative_path) {
      return path.join(recordingsDir, recording.relative_path);
    }
  } catch { /* ignore */ }
  return null;
}
