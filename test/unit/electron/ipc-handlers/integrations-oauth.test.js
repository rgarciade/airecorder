/**
 * integrations-oauth.test.js
 *
 * Tests unitarios para electron/ipc-handlers/integrations-oauth.js — 12
 * canales IPC que orquestan el flujo OAuth de Google Chat / Teams (inicio de
 * flujo, callback de deep-link, listado/gestión de conexiones y canales, y
 * la sincronización incremental de mensajes hacia el sistema de
 * grabaciones/transcripción).
 *
 * integrations-oauth.js hace, a nivel de módulo:
 *   const { ipcMain, shell, safeStorage } = require('electron');
 *   const dbService = require('../database/dbService');
 *   const { getRecordingsPath } = require('../utils/paths');
 *   const { buildTranscriptionTxt, buildTranscriptionJson, assignRelativeTimestamps } = require('../integrations/chatSyncUtils');
 *   const googleChat = require('../integrations/googleChatSyncService');
 *   const teams = require('../integrations/teamsSyncService');
 * Todos son CJS puro cargados con `require()` nativo (sin "type":"module" en
 * package.json), así que `vi.mock()` no intercepta ninguno — mismo patrón
 * establecido en el resto de la sesión (ver cabecera de
 * speakerManager.test.js): mocks inyectados en `require.cache` de Node vía
 * `createRequire(import.meta.url)` en `beforeAll`/`afterAll`, e import
 * dinámico del módulo bajo test dentro de `beforeEach`.
 *
 * googleChatSyncService.js y teamsSyncService.js YA están completamente
 * testeados en pases anteriores de esta sesión — aquí sólo se mockean sus
 * funciones exportadas como `vi.fn()` controlados por escenario, sin
 * re-derivar su lógica interna. Lo mismo para chatSyncUtils.js.
 *
 * `ipcMain.handle` se mockea igual que en export.test.js: captura cada
 * callback registrado en un objeto `handlers` para invocarlo directamente.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'fs';
import crypto from 'crypto';

const nodeRequire = createRequire(import.meta.url);
const electronPath = nodeRequire.resolve('electron');
const dbServicePath = nodeRequire.resolve('../../../../electron/database/dbService.js');
const pathsPath = nodeRequire.resolve('../../../../electron/utils/paths.js');
const chatSyncUtilsPath = nodeRequire.resolve('../../../../electron/integrations/chatSyncUtils.js');
const googleChatPath = nodeRequire.resolve('../../../../electron/integrations/googleChatSyncService.js');
const teamsPath = nodeRequire.resolve('../../../../electron/integrations/teamsSyncService.js');

let originalElectronEntry;
let originalDbServiceEntry;
let originalPathsEntry;
let originalChatSyncUtilsEntry;
let originalGoogleChatEntry;
let originalTeamsEntry;

// ── Mocks de electron ───────────────────────────────────────────────────
const handlers = {};
const ipcMainMock = {
  handle: vi.fn((channel, cb) => {
    handlers[channel] = cb;
  }),
};
const shellMock = { openExternal: vi.fn() };
const safeStorageMock = {
  encryptString: vi.fn((s) => Buffer.from(`enc:${s}`)),
  decryptString: vi.fn((buf) => Buffer.from(buf).toString().replace(/^enc:/, '')),
};

// ── Mock de dbService (singleton, igual forma que el real: métodos planos) ──
const dbServiceMock = {
  getAllPlatformConnections: vi.fn(),
  deletePlatformConnection: vi.fn(),
  getPlatformConnectionById: vi.fn(),
  getProjectIntegrations: vi.fn(),
  addProjectIntegration: vi.fn(),
  deleteProjectIntegration: vi.fn(),
  getChatIntegrations: vi.fn(),
  updateProjectIntegrationSync: vi.fn(),
  saveRecording: vi.fn(),
  addRecordingToProject: vi.fn(),
  getRecordingById: vi.fn(),
  updatePlatformConnectionTokens: vi.fn(),
  savePlatformConnection: vi.fn(),
  updateDuration: vi.fn(),
};

// ── Mock de paths.js ────────────────────────────────────────────────────
const pathsMock = { getRecordingsPath: vi.fn() };

// ── Mock de chatSyncUtils.js ────────────────────────────────────────────
const chatSyncUtilsMock = {
  buildTranscriptionTxt: vi.fn(),
  buildTranscriptionJson: vi.fn(),
  assignRelativeTimestamps: vi.fn(),
};

// ── Mocks de googleChatSyncService.js / teamsSyncService.js ────────────
const googleChatMock = {
  buildAuthUrl: vi.fn(),
  exchangeCodeForTokens: vi.fn(),
  refreshAccessToken: vi.fn(),
  getUserInfo: vi.fn(),
  listSpaces: vi.fn(),
  fetchMessages: vi.fn(),
};

const teamsMock = {
  buildAuthUrl: vi.fn(),
  exchangeCodeForTokens: vi.fn(),
  refreshAccessToken: vi.fn(),
  getUserInfo: vi.fn(),
  listTeams: vi.fn(),
  listChannels: vi.fn(),
  fetchMessages: vi.fn(),
};

beforeAll(() => {
  originalElectronEntry = nodeRequire.cache[electronPath];
  nodeRequire.cache[electronPath] = {
    id: electronPath,
    filename: electronPath,
    loaded: true,
    exports: { ipcMain: ipcMainMock, shell: shellMock, safeStorage: safeStorageMock },
  };

  originalDbServiceEntry = nodeRequire.cache[dbServicePath];
  nodeRequire.cache[dbServicePath] = {
    id: dbServicePath,
    filename: dbServicePath,
    loaded: true,
    exports: dbServiceMock,
  };

  originalPathsEntry = nodeRequire.cache[pathsPath];
  nodeRequire.cache[pathsPath] = {
    id: pathsPath,
    filename: pathsPath,
    loaded: true,
    exports: pathsMock,
  };

  originalChatSyncUtilsEntry = nodeRequire.cache[chatSyncUtilsPath];
  nodeRequire.cache[chatSyncUtilsPath] = {
    id: chatSyncUtilsPath,
    filename: chatSyncUtilsPath,
    loaded: true,
    exports: chatSyncUtilsMock,
  };

  originalGoogleChatEntry = nodeRequire.cache[googleChatPath];
  nodeRequire.cache[googleChatPath] = {
    id: googleChatPath,
    filename: googleChatPath,
    loaded: true,
    exports: googleChatMock,
  };

  originalTeamsEntry = nodeRequire.cache[teamsPath];
  nodeRequire.cache[teamsPath] = {
    id: teamsPath,
    filename: teamsPath,
    loaded: true,
    exports: teamsMock,
  };
});

afterAll(() => {
  if (originalElectronEntry) nodeRequire.cache[electronPath] = originalElectronEntry;
  else delete nodeRequire.cache[electronPath];
  if (originalDbServiceEntry) nodeRequire.cache[dbServicePath] = originalDbServiceEntry;
  else delete nodeRequire.cache[dbServicePath];
  if (originalPathsEntry) nodeRequire.cache[pathsPath] = originalPathsEntry;
  else delete nodeRequire.cache[pathsPath];
  if (originalChatSyncUtilsEntry) nodeRequire.cache[chatSyncUtilsPath] = originalChatSyncUtilsEntry;
  else delete nodeRequire.cache[chatSyncUtilsPath];
  if (originalGoogleChatEntry) nodeRequire.cache[googleChatPath] = originalGoogleChatEntry;
  else delete nodeRequire.cache[googleChatPath];
  if (originalTeamsEntry) nodeRequire.cache[teamsPath] = originalTeamsEntry;
  else delete nodeRequire.cache[teamsPath];
});

let oauthHandlers;

function resetAllMocks() {
  [
    ipcMainMock.handle,
    shellMock.openExternal,
    safeStorageMock.encryptString,
    safeStorageMock.decryptString,
    ...Object.values(dbServiceMock),
    ...Object.values(pathsMock),
    ...Object.values(chatSyncUtilsMock),
    ...Object.values(googleChatMock),
    ...Object.values(teamsMock),
  ].forEach((fn) => fn.mockReset());

  // Reinstalar implementaciones por defecto tras el reset.
  ipcMainMock.handle.mockImplementation((channel, cb) => {
    handlers[channel] = cb;
  });
  safeStorageMock.encryptString.mockImplementation((s) => Buffer.from(`enc:${s}`));
  safeStorageMock.decryptString.mockImplementation((buf) => Buffer.from(buf).toString().replace(/^enc:/, ''));
}

beforeEach(async () => {
  Object.keys(handlers).forEach((k) => delete handlers[k]);
  resetAllMocks();

  vi.restoreAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(fs.promises, 'readFile').mockRejectedValue(new Error('ENOENT: no existe'));
  vi.spyOn(fs.promises, 'writeFile').mockResolvedValue(undefined);
  vi.spyOn(fs.promises, 'mkdir').mockResolvedValue(undefined);
  vi.spyOn(crypto, 'randomBytes').mockImplementation((n) => Buffer.alloc(n, 7));

  pathsMock.getRecordingsPath.mockResolvedValue('/fake/recordings');
  chatSyncUtilsMock.buildTranscriptionTxt.mockReturnValue('txt-content');
  chatSyncUtilsMock.buildTranscriptionJson.mockReturnValue([{ id: 0 }]);
  chatSyncUtilsMock.assignRelativeTimestamps.mockImplementation((messages, startOffset = 0) =>
    messages.map((m, i) => ({ ...m, start: startOffset + i * 3, end: startOffset + i * 3 + 3 }))
  );

  oauthHandlers = await import('../../../../electron/ipc-handlers/integrations-oauth.js');
  // Igual que export.test.js: llamarlo de nuevo cada test simplemente
  // repuebla `handlers`; nuestro ipcMain.handle mockeado no valida
  // duplicados (eso sólo ocurriría contra un ipcMain real de Electron).
  oauthHandlers.registerIntegrationsOAuthHandlers();
});

function encToken(plain) {
  return Buffer.from(`enc:${plain}`);
}

// ─────────────────────────────────────────────────────────────────────────
// start-oauth-flow
// ─────────────────────────────────────────────────────────────────────────

describe('start-oauth-flow', () => {
  it('platform desconocida → resuelve success:false sin abrir el navegador', async () => {
    const result = await handlers['start-oauth-flow']({}, { platform: 'bogus', settings: {} });

    expect(result).toEqual({ success: false, error: 'Plataforma desconocida: bogus' });
    expect(shellMock.openExternal).not.toHaveBeenCalled();
  });

  it("platform 'google-chat' sin googleChatClientId en settings → error específico", async () => {
    const result = await handlers['start-oauth-flow']({}, { platform: 'google-chat', settings: {} });

    expect(result).toEqual({ success: false, error: 'Falta el Client ID de Google Chat' });
    expect(googleChatMock.buildAuthUrl).not.toHaveBeenCalled();
  });

  it("platform 'teams' sin teamsClientId en settings → error específico", async () => {
    const result = await handlers['start-oauth-flow']({}, { platform: 'teams', settings: {} });

    expect(result).toEqual({ success: false, error: 'Falta el Client ID de Teams' });
    expect(teamsMock.buildAuthUrl).not.toHaveBeenCalled();
  });

  it('buildAuthUrl lanza (p.ej. credenciales corruptas) → error resuelto con el mensaje de la excepción', async () => {
    googleChatMock.buildAuthUrl.mockImplementation(() => {
      throw new Error('boom construyendo URL');
    });

    const result = await handlers['start-oauth-flow'](
      {},
      { platform: 'google-chat', settings: { googleChatClientId: 'cid' } }
    );

    expect(result).toEqual({ success: false, error: 'boom construyendo URL' });
    expect(shellMock.openExternal).not.toHaveBeenCalled();
  });

  it('camino feliz google-chat: construye la URL, abre el navegador, y el callback resuelve la promesa con la conexión', async () => {
    googleChatMock.buildAuthUrl.mockReturnValue('https://accounts.google.com/auth?state=xxx');
    googleChatMock.exchangeCodeForTokens.mockResolvedValue({
      accessToken: 'at-1',
      refreshToken: 'rt-1',
      expiresAt: '2030-01-01T00:00:00Z',
      scopes: ['a'],
    });
    googleChatMock.getUserInfo.mockResolvedValue({ name: 'Ana', id: 'u1' });
    dbServiceMock.savePlatformConnection.mockReturnValue({ success: true, id: 42 });

    const flowPromise = handlers['start-oauth-flow'](
      {},
      { platform: 'google-chat', settings: { googleChatClientId: 'cid' } }
    );

    expect(shellMock.openExternal).toHaveBeenCalledWith('https://accounts.google.com/auth?state=xxx');
    const state = googleChatMock.buildAuthUrl.mock.calls[0][2];

    await oauthHandlers.handleOAuthCallback(`airecorder://google-chat-callback?code=abc&state=${state}`);

    const result = await flowPromise;
    expect(result).toEqual({
      success: true,
      connection: expect.objectContaining({ id: 42, platform: 'google-chat', accountName: 'Ana', accountId: 'u1' }),
    });
  });

  it('timeout de 5 minutos: si nunca llega el callback, resuelve con error de timeout', async () => {
    vi.useFakeTimers();
    try {
      googleChatMock.buildAuthUrl.mockReturnValue('https://accounts.google.com/auth?state=xxx');

      const flowPromise = handlers['start-oauth-flow'](
        {},
        { platform: 'google-chat', settings: { googleChatClientId: 'cid' } }
      );

      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);

      const result = await flowPromise;
      expect(result).toEqual({ success: false, error: 'OAuth timeout — el usuario no completó la autorización' });
    } finally {
      vi.useRealTimers();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────
// handleOAuthCallback (exportada aparte, invocada desde main.js en el deep-link real)
// ─────────────────────────────────────────────────────────────────────────

describe('handleOAuthCallback', () => {
  it('state desconocido/ausente → no lanza, sólo loguea error (no hay flow que resolver)', async () => {
    await expect(oauthHandlers.handleOAuthCallback('airecorder://google-chat-callback?code=x&state=nope')).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });

  it('callback con error= (usuario denegó permiso) → resuelve success:false con "OAuth denegado: <error>"', async () => {
    googleChatMock.buildAuthUrl.mockReturnValue('https://accounts.google.com/auth');
    const flowPromise = handlers['start-oauth-flow'](
      {},
      { platform: 'google-chat', settings: { googleChatClientId: 'cid' } }
    );
    const state = googleChatMock.buildAuthUrl.mock.calls[0][2];

    await oauthHandlers.handleOAuthCallback(`airecorder://google-chat-callback?error=access_denied&state=${state}`);

    expect(await flowPromise).toEqual({ success: false, error: 'OAuth denegado: access_denied' });
  });

  it('callback sin code ni error → resuelve success:false "No se recibió código de autorización"', async () => {
    googleChatMock.buildAuthUrl.mockReturnValue('https://accounts.google.com/auth');
    const flowPromise = handlers['start-oauth-flow'](
      {},
      { platform: 'google-chat', settings: { googleChatClientId: 'cid' } }
    );
    const state = googleChatMock.buildAuthUrl.mock.calls[0][2];

    await oauthHandlers.handleOAuthCallback(`airecorder://google-chat-callback?state=${state}`);

    expect(await flowPromise).toEqual({ success: false, error: 'No se recibió código de autorización' });
  });

  it('camino feliz teams: intercambia código, obtiene perfil, guarda conexión', async () => {
    teamsMock.buildAuthUrl.mockReturnValue('https://login.microsoftonline.com/auth');
    teamsMock.exchangeCodeForTokens.mockResolvedValue({
      accessToken: 'at-teams',
      refreshToken: 'rt-teams',
      expiresAt: '2030-01-01T00:00:00Z',
      scopes: [],
    });
    teamsMock.getUserInfo.mockResolvedValue({ displayName: 'Bruno', id: 'u2' });
    dbServiceMock.savePlatformConnection.mockReturnValue({ success: true, id: 7 });

    const flowPromise = handlers['start-oauth-flow']({}, { platform: 'teams', settings: { teamsClientId: 'cid' } });
    const state = teamsMock.buildAuthUrl.mock.calls[0][2];

    await oauthHandlers.handleOAuthCallback(`airecorder://teams-callback?code=abc&state=${state}`);

    expect(await flowPromise).toEqual({
      success: true,
      connection: expect.objectContaining({ id: 7, platform: 'teams', accountName: 'Bruno', accountId: 'u2' }),
    });
  });

  it('accountName/accountId con fallbacks: sin name/displayName usa email, y "Unknown" si tampoco hay email; sin id usa sub, y "" si tampoco hay sub', async () => {
    googleChatMock.buildAuthUrl.mockReturnValue('https://accounts.google.com/auth');
    googleChatMock.exchangeCodeForTokens.mockResolvedValue({ accessToken: 'at', refreshToken: 'rt', expiresAt: 'x', scopes: [] });
    googleChatMock.getUserInfo.mockResolvedValue({}); // sin name, displayName, email, id ni sub
    dbServiceMock.savePlatformConnection.mockReturnValue({ success: true, id: 1 });

    const flowPromise = handlers['start-oauth-flow'](
      {},
      { platform: 'google-chat', settings: { googleChatClientId: 'cid' } }
    );
    const state = googleChatMock.buildAuthUrl.mock.calls[0][2];
    await oauthHandlers.handleOAuthCallback(`airecorder://google-chat-callback?code=abc&state=${state}`);

    const result = await flowPromise;
    expect(result.connection.accountName).toBe('Unknown');
    expect(result.connection.accountId).toBe('');
  });

  it('dbService.savePlatformConnection falla → resuelve success:false "Error guardando conexión en base de datos"', async () => {
    googleChatMock.buildAuthUrl.mockReturnValue('https://accounts.google.com/auth');
    googleChatMock.exchangeCodeForTokens.mockResolvedValue({ accessToken: 'at', refreshToken: 'rt', expiresAt: 'x', scopes: [] });
    googleChatMock.getUserInfo.mockResolvedValue({ name: 'Ana', id: 'u1' });
    dbServiceMock.savePlatformConnection.mockReturnValue({ success: false });

    const flowPromise = handlers['start-oauth-flow'](
      {},
      { platform: 'google-chat', settings: { googleChatClientId: 'cid' } }
    );
    const state = googleChatMock.buildAuthUrl.mock.calls[0][2];
    await oauthHandlers.handleOAuthCallback(`airecorder://google-chat-callback?code=abc&state=${state}`);

    expect(await flowPromise).toEqual({ success: false, error: 'Error guardando conexión en base de datos' });
  });

  it('REGRESIÓN: si exchangeCodeForTokens lanza, la promesa original de start-oauth-flow se resuelve con el error (no queda colgada)', async () => {
    // Antes del fix, el catch externo de handleOAuthCallback buscaba el flow
    // a notificar en `[...pendingOAuthFlows.values()][0]` — pero el flow que
    // acababa de fallar ya había sido borrado del mapa unas líneas antes
    // (`pendingOAuthFlows.delete(state)`), así que sin otro flow pendiente
    // nadie resolvía la promesa original y el renderer quedaba esperando
    // para siempre. El fix guarda la referencia al flow (`pendingFlow`) antes
    // del borrado para que el catch pueda resolverlo directamente.
    googleChatMock.buildAuthUrl.mockReturnValue('https://accounts.google.com/auth');
    googleChatMock.exchangeCodeForTokens.mockRejectedValue(new Error('token exchange failed'));

    const flowPromise = handlers['start-oauth-flow'](
      {},
      { platform: 'google-chat', settings: { googleChatClientId: 'cid' } }
    );
    const state = googleChatMock.buildAuthUrl.mock.calls[0][2];

    await oauthHandlers.handleOAuthCallback(`airecorder://google-chat-callback?code=abc&state=${state}`);

    await expect(flowPromise).resolves.toEqual({ success: false, error: 'token exchange failed' });
    expect(console.error).toHaveBeenCalled();
  });

  it('excepción inesperada en el callback sin flows pendientes en absoluto → no lanza (catch la absorbe)', async () => {
    // new URL(url) lanza si la URL es inválida — camino de excepción distinto
    // al de exchangeCodeForTokens, pero mismo catch externo.
    await expect(oauthHandlers.handleOAuthCallback('esto-no-es-una-url-valida')).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// get-platform-connections
// ─────────────────────────────────────────────────────────────────────────

describe('get-platform-connections', () => {
  it('mapea filas de BD a la forma pública, parseando scopes JSON', async () => {
    dbServiceMock.getAllPlatformConnections.mockReturnValue([
      { id: 1, platform: 'google-chat', account_name: 'Ana', account_id: 'u1', scopes: '["a","b"]', connected_at: 't1' },
    ]);

    const result = await handlers['get-platform-connections']();

    expect(result).toEqual([
      { id: 1, platform: 'google-chat', accountName: 'Ana', accountId: 'u1', scopes: ['a', 'b'], connectedAt: 't1' },
    ]);
  });

  it('scopes ausente/null → cae a array vacío en vez de lanzar', async () => {
    dbServiceMock.getAllPlatformConnections.mockReturnValue([
      { id: 2, platform: 'teams', account_name: 'Bruno', account_id: 'u2', scopes: null, connected_at: 't2' },
    ]);

    const [result] = await handlers['get-platform-connections']();

    expect(result.scopes).toEqual([]);
  });

  it('sin conexiones → array vacío', async () => {
    dbServiceMock.getAllPlatformConnections.mockReturnValue([]);
    expect(await handlers['get-platform-connections']()).toEqual([]);
  });
});

describe('disconnect-platform', () => {
  it('delega en dbService.deletePlatformConnection con el id recibido', async () => {
    dbServiceMock.deletePlatformConnection.mockReturnValue({ success: true });

    const result = await handlers['disconnect-platform']({}, 99);

    expect(dbServiceMock.deletePlatformConnection).toHaveBeenCalledWith(99);
    expect(result).toEqual({ success: true });
  });
});

// ─────────────────────────────────────────────────────────────────────────
// get-available-channels + getValidAccessToken (helper interno, no exportado
// — se ejerce indirectamente a través de este handler, el más simple de los
// que la usan).
// ─────────────────────────────────────────────────────────────────────────

describe('get-available-channels (y getValidAccessToken indirectamente)', () => {
  it('conexión no encontrada → error específico sin tocar getValidAccessToken', async () => {
    dbServiceMock.getPlatformConnectionById.mockReturnValue(null);

    const result = await handlers['get-available-channels']({}, { connectionId: 1, settings: {} });

    expect(result).toEqual({ success: false, error: 'Conexión no encontrada' });
  });

  it('google-chat, token NO expirado → usa el access token directo sin refrescar', async () => {
    dbServiceMock.getPlatformConnectionById.mockReturnValue({
      id: 1,
      platform: 'google-chat',
      access_token_encrypted: encToken('at-valid'),
      refresh_token_encrypted: encToken('rt-valid'),
      token_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
    });
    googleChatMock.listSpaces.mockResolvedValue([{ id: 's1', displayName: 'Espacio', type: 'SPACE' }]);

    const result = await handlers['get-available-channels']({}, { connectionId: 1, settings: {} });

    expect(googleChatMock.listSpaces).toHaveBeenCalledWith('at-valid');
    expect(googleChatMock.refreshAccessToken).not.toHaveBeenCalled();
    expect(result).toEqual({ success: true, channels: [{ id: 's1', name: 'Espacio', type: 'SPACE' }] });
  });

  it('google-chat, token expirado → refresca y persiste los nuevos tokens antes de listar', async () => {
    dbServiceMock.getPlatformConnectionById.mockReturnValue({
      id: 5,
      platform: 'google-chat',
      access_token_encrypted: encToken('at-old'),
      refresh_token_encrypted: encToken('rt-old'),
      token_expires_at: new Date(Date.now() - 1000).toISOString(),
    });
    googleChatMock.refreshAccessToken.mockResolvedValue({
      accessToken: 'at-new',
      refreshToken: 'rt-new',
      expiresAt: '2030-01-01T00:00:00Z',
    });
    googleChatMock.listSpaces.mockResolvedValue([]);

    await handlers['get-available-channels'](
      {},
      { connectionId: 5, settings: { googleChatClientId: 'cid', googleChatClientSecret: 'secret' } }
    );

    expect(googleChatMock.refreshAccessToken).toHaveBeenCalledWith('rt-old', 'cid', 'secret');
    expect(dbServiceMock.updatePlatformConnectionTokens).toHaveBeenCalledWith(
      5,
      expect.any(Buffer),
      expect.any(Buffer),
      '2030-01-01T00:00:00Z'
    );
    expect(googleChatMock.listSpaces).toHaveBeenCalledWith('at-new');
  });

  it('token sin expiresAt (null) también se trata como expirado (boundary)', async () => {
    dbServiceMock.getPlatformConnectionById.mockReturnValue({
      id: 6,
      platform: 'google-chat',
      access_token_encrypted: encToken('at-old'),
      refresh_token_encrypted: encToken('rt-old'),
      token_expires_at: null,
    });
    googleChatMock.refreshAccessToken.mockResolvedValue({ accessToken: 'at-new', expiresAt: 'x' });
    googleChatMock.listSpaces.mockResolvedValue([]);

    await handlers['get-available-channels'](
      {},
      { connectionId: 6, settings: { googleChatClientId: 'cid', googleChatClientSecret: 'secret' } }
    );

    expect(googleChatMock.refreshAccessToken).toHaveBeenCalled();
  });

  it('token expirado sin refresh token disponible → error "No refresh token available"', async () => {
    dbServiceMock.getPlatformConnectionById.mockReturnValue({
      id: 7,
      platform: 'google-chat',
      access_token_encrypted: encToken('at-old'),
      refresh_token_encrypted: null,
      token_expires_at: new Date(Date.now() - 1000).toISOString(),
    });

    const result = await handlers['get-available-channels']({}, { connectionId: 7, settings: {} });

    expect(result).toEqual({ success: false, error: 'No refresh token available' });
  });

  it('google-chat expirado sin credenciales en settings → error "Google Chat credentials not configured"', async () => {
    dbServiceMock.getPlatformConnectionById.mockReturnValue({
      id: 8,
      platform: 'google-chat',
      access_token_encrypted: encToken('at-old'),
      refresh_token_encrypted: encToken('rt-old'),
      token_expires_at: new Date(Date.now() - 1000).toISOString(),
    });

    const result = await handlers['get-available-channels']({}, { connectionId: 8, settings: {} });

    expect(result).toEqual({ success: false, error: 'Google Chat credentials not configured' });
  });

  it('teams expirado sin teamsClientId en settings → error "Teams client ID not configured"', async () => {
    dbServiceMock.getPlatformConnectionById.mockReturnValue({
      id: 9,
      platform: 'teams',
      access_token_encrypted: encToken('at-old'),
      refresh_token_encrypted: encToken('rt-old'),
      token_expires_at: new Date(Date.now() - 1000).toISOString(),
    });

    const result = await handlers['get-available-channels']({}, { connectionId: 9, settings: {} });

    expect(result).toEqual({ success: false, error: 'Teams client ID not configured' });
  });

  it('platform desconocida en la conexión (expirada) → error "Unknown platform: <platform>"', async () => {
    dbServiceMock.getPlatformConnectionById.mockReturnValue({
      id: 10,
      platform: 'slack',
      access_token_encrypted: encToken('at-old'),
      refresh_token_encrypted: encToken('rt-old'),
      token_expires_at: new Date(Date.now() - 1000).toISOString(),
    });

    const result = await handlers['get-available-channels']({}, { connectionId: 10, settings: {} });

    expect(result).toEqual({ success: false, error: 'Unknown platform: slack' });
  });

  it('teams: aplana canales de múltiples equipos con el nombre "Equipo / Canal"', async () => {
    dbServiceMock.getPlatformConnectionById.mockReturnValue({
      id: 11,
      platform: 'teams',
      access_token_encrypted: encToken('at'),
      refresh_token_encrypted: encToken('rt'),
      token_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
    });
    teamsMock.listTeams.mockResolvedValue([{ id: 't1', displayName: 'Equipo A' }]);
    teamsMock.listChannels.mockResolvedValue([{ id: 'c1', displayName: 'General', teamId: 't1', channelId: 'c1' }]);

    const result = await handlers['get-available-channels']({}, { connectionId: 11, settings: {} });

    expect(teamsMock.listChannels).toHaveBeenCalledWith('t1', 'at');
    expect(result).toEqual({
      success: true,
      channels: [{ id: 'c1', name: 'Equipo A / General', teamId: 't1', channelId: 'c1' }],
    });
  });

  it('plataforma soportada en la conexión pero sin rama google-chat/teams alcanzada → "Plataforma no soportada"', async () => {
    // Token vigente (no dispara getValidAccessToken con error) pero
    // connection.platform no es ni 'google-chat' ni 'teams'.
    dbServiceMock.getPlatformConnectionById.mockReturnValue({
      id: 12,
      platform: 'slack',
      access_token_encrypted: encToken('at'),
      refresh_token_encrypted: encToken('rt'),
      token_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
    });

    const result = await handlers['get-available-channels']({}, { connectionId: 12, settings: {} });

    expect(result).toEqual({ success: false, error: 'Plataforma no soportada' });
  });

  it('listSpaces lanza (p.ej. token revocado) → capturado, success:false con el mensaje', async () => {
    dbServiceMock.getPlatformConnectionById.mockReturnValue({
      id: 13,
      platform: 'google-chat',
      access_token_encrypted: encToken('at'),
      refresh_token_encrypted: encToken('rt'),
      token_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
    });
    googleChatMock.listSpaces.mockRejectedValue(new Error('401 unauthorized'));

    const result = await handlers['get-available-channels']({}, { connectionId: 13, settings: {} });

    expect(result).toEqual({ success: false, error: '401 unauthorized' });
  });

  it('safeStorage.decryptString lanza (no disponible en CI) → cae al fallback Buffer.toString() sin romper', async () => {
    safeStorageMock.decryptString.mockImplementation(() => {
      throw new Error('safeStorage no disponible');
    });
    dbServiceMock.getPlatformConnectionById.mockReturnValue({
      id: 14,
      platform: 'google-chat',
      access_token_encrypted: Buffer.from('plain-at'),
      refresh_token_encrypted: Buffer.from('plain-rt'),
      token_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
    });
    googleChatMock.listSpaces.mockResolvedValue([]);

    await handlers['get-available-channels']({}, { connectionId: 14, settings: {} });

    expect(googleChatMock.listSpaces).toHaveBeenCalledWith('plain-at');
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Wrappers finos de dbService (1-2 tests cada uno, boilerplate según el
// enunciado de la tarea).
// ─────────────────────────────────────────────────────────────────────────

describe('wrappers finos de dbService', () => {
  it('get-project-integrations delega en dbService.getProjectIntegrations', async () => {
    dbServiceMock.getProjectIntegrations.mockReturnValue([{ id: 1 }]);
    const result = await handlers['get-project-integrations']({}, 42);
    expect(dbServiceMock.getProjectIntegrations).toHaveBeenCalledWith(42);
    expect(result).toEqual([{ id: 1 }]);
  });

  it('link-channel-to-project delega en dbService.addProjectIntegration', async () => {
    dbServiceMock.addProjectIntegration.mockReturnValue({ success: true, id: 5 });
    const result = await handlers['link-channel-to-project'](
      {},
      { projectId: 1, connectionId: 2, channelId: 'c1', channelName: 'General' }
    );
    expect(dbServiceMock.addProjectIntegration).toHaveBeenCalledWith(1, 2, 'c1', 'General');
    expect(result).toEqual({ success: true, id: 5 });
  });

  it('unlink-channel-from-project delega en dbService.deleteProjectIntegration', async () => {
    dbServiceMock.deleteProjectIntegration.mockReturnValue({ success: true });
    const result = await handlers['unlink-channel-from-project']({}, 9);
    expect(dbServiceMock.deleteProjectIntegration).toHaveBeenCalledWith(9);
    expect(result).toEqual({ success: true });
  });

  it('get-chat-integrations delega en dbService.getChatIntegrations', async () => {
    dbServiceMock.getChatIntegrations.mockReturnValue([{ id: 3 }]);
    const result = await handlers['get-chat-integrations']({}, 'chat-1');
    expect(dbServiceMock.getChatIntegrations).toHaveBeenCalledWith('chat-1');
    expect(result).toEqual([{ id: 3 }]);
  });

  it('unlink-channel-from-chat delega en dbService.deleteProjectIntegration', async () => {
    dbServiceMock.deleteProjectIntegration.mockReturnValue({ success: true });
    const result = await handlers['unlink-channel-from-chat']({}, 11);
    expect(dbServiceMock.deleteProjectIntegration).toHaveBeenCalledWith(11);
    expect(result).toEqual({ success: true });
  });

  it('link-channel-to-chat con dateFrom/dateTo provistos los pasa tal cual', async () => {
    dbServiceMock.addProjectIntegration.mockReturnValue({ success: true, id: 1 });
    await handlers['link-channel-to-chat'](
      {},
      { projectId: 1, chatId: 'chat-1', connectionId: 2, channelId: 'c1', channelName: 'General', dateFrom: '2024-01-01', dateTo: '2024-02-01' }
    );
    expect(dbServiceMock.addProjectIntegration).toHaveBeenCalledWith(1, 2, 'c1', 'General', 'chat-1', '2024-01-01', '2024-02-01');
  });

  it('link-channel-to-chat sin dateFrom/dateTo → los normaliza a null (boundary del fallback ||)', async () => {
    dbServiceMock.addProjectIntegration.mockReturnValue({ success: true, id: 1 });
    await handlers['link-channel-to-chat'](
      {},
      { projectId: 1, chatId: 'chat-1', connectionId: 2, channelId: 'c1', channelName: 'General' }
    );
    expect(dbServiceMock.addProjectIntegration).toHaveBeenCalledWith(1, 2, 'c1', 'General', 'chat-1', null, null);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// sync-chat-integrations — el handler con más lógica de orquestación junto
// con sync-project-integrations.
// ─────────────────────────────────────────────────────────────────────────

describe('sync-chat-integrations', () => {
  function connection(overrides = {}) {
    return {
      id: 1,
      platform: 'google-chat',
      access_token_encrypted: encToken('at'),
      refresh_token_encrypted: encToken('rt'),
      token_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
      ...overrides,
    };
  }

  function integration(overrides = {}) {
    return {
      id: 100,
      connection_id: 1,
      channel_id: 'space/1',
      channel_name: 'General',
      recording_id: null,
      last_sync_at: null,
      date_from: null,
      date_to: null,
      ...overrides,
    };
  }

  it('sin integraciones → {success:true, synced:0, newMessages:0} (sin la clave `errors`)', async () => {
    dbServiceMock.getChatIntegrations.mockReturnValue([]);

    const result = await handlers['sync-chat-integrations']({}, { chatId: 'chat-1', projectId: 1, settings: {} });

    expect(result).toEqual({ success: true, synced: 0, newMessages: 0 });
  });

  it('conexión no encontrada para una integración → se omite (no cuenta ni como synced ni como error)', async () => {
    dbServiceMock.getChatIntegrations.mockReturnValue([integration()]);
    dbServiceMock.getPlatformConnectionById.mockReturnValue(null);

    const result = await handlers['sync-chat-integrations']({}, { chatId: 'chat-1', projectId: 1, settings: {} });

    expect(result).toEqual({ success: true, synced: 0, newMessages: 0, errors: [] });
  });

  it('sin mensajes nuevos tras el fetch → synced++ sin crear carpeta ni tocar saveRecording', async () => {
    dbServiceMock.getChatIntegrations.mockReturnValue([integration()]);
    dbServiceMock.getPlatformConnectionById.mockReturnValue(connection());
    googleChatMock.fetchMessages.mockResolvedValue([]);

    const result = await handlers['sync-chat-integrations']({}, { chatId: 'chat-1', projectId: 1, settings: {} });

    expect(result).toEqual({ success: true, synced: 1, newMessages: 0, errors: [] });
    expect(dbServiceMock.saveRecording).not.toHaveBeenCalled();
  });

  it('date_to filtra mensajes posteriores al cutoff antes de contarlos como nuevos', async () => {
    dbServiceMock.getChatIntegrations.mockReturnValue([integration({ date_to: '2024-01-01T00:00:00Z' })]);
    dbServiceMock.getPlatformConnectionById.mockReturnValue(connection());
    googleChatMock.fetchMessages.mockResolvedValue([
      { speaker: 'Ana', text: 'antes del corte', timestamp: '2023-12-31T23:00:00Z' },
      { speaker: 'Ana', text: 'después del corte', timestamp: '2024-02-01T00:00:00Z' },
    ]);
    dbServiceMock.saveRecording.mockReturnValue({ success: true, id: 55 });

    const result = await handlers['sync-chat-integrations']({}, { chatId: 'chat-1', projectId: 1, settings: {} });

    expect(result.newMessages).toBe(1);
    expect(chatSyncUtilsMock.assignRelativeTimestamps).toHaveBeenCalledWith([{ speaker: 'Ana', text: 'antes del corte' }], 0);
  });

  it('primera sync (sin recording_id): crea carpeta, guarda grabación y la vincula al proyecto si projectId está presente', async () => {
    dbServiceMock.getChatIntegrations.mockReturnValue([integration()]);
    dbServiceMock.getPlatformConnectionById.mockReturnValue(connection());
    googleChatMock.fetchMessages.mockResolvedValue([{ speaker: 'Ana', text: 'hola', timestamp: 't1' }]);
    dbServiceMock.saveRecording.mockReturnValue({ success: true, id: 200 });

    const result = await handlers['sync-chat-integrations']({}, { chatId: 'chat-1', projectId: 9, settings: {} });

    expect(dbServiceMock.saveRecording).toHaveBeenCalled();
    expect(dbServiceMock.addRecordingToProject).toHaveBeenCalledWith(9, 200);
    expect(result).toEqual({ success: true, synced: 1, newMessages: 1, errors: [] });
  });

  it('primera sync sin projectId → NO vincula la grabación a ningún proyecto', async () => {
    dbServiceMock.getChatIntegrations.mockReturnValue([integration()]);
    dbServiceMock.getPlatformConnectionById.mockReturnValue(connection());
    googleChatMock.fetchMessages.mockResolvedValue([{ speaker: 'Ana', text: 'hola', timestamp: 't1' }]);
    dbServiceMock.saveRecording.mockReturnValue({ success: true, id: 201 });

    await handlers['sync-chat-integrations']({}, { chatId: 'chat-1', projectId: null, settings: {} });

    expect(dbServiceMock.addRecordingToProject).not.toHaveBeenCalled();
  });

  it('grabación existente (recording_id resuelve a carpeta): calcula el offset a partir del último segmento existente', async () => {
    dbServiceMock.getChatIntegrations.mockReturnValue([integration({ recording_id: 77 })]);
    dbServiceMock.getPlatformConnectionById.mockReturnValue(connection());
    dbServiceMock.getRecordingById.mockReturnValue({ relative_path: 'grabacion-existente' });
    fs.promises.readFile.mockResolvedValue(JSON.stringify([{ start: 0, end: 30, speaker: 'Ana', text: 'previo' }]));
    googleChatMock.fetchMessages.mockResolvedValue([{ speaker: 'Bruno', text: 'nuevo', timestamp: 't2' }]);

    await handlers['sync-chat-integrations']({}, { chatId: 'chat-1', projectId: 1, settings: {} });

    // offset = último `end` (30) + 3 = 33
    expect(chatSyncUtilsMock.assignRelativeTimestamps).toHaveBeenCalledWith([{ speaker: 'Bruno', text: 'nuevo' }], 33);
    expect(dbServiceMock.saveRecording).not.toHaveBeenCalled();
  });

  it('lectura del JSON existente falla (primera vez real) → offset 0 sin romper el flujo', async () => {
    dbServiceMock.getChatIntegrations.mockReturnValue([integration({ recording_id: 78 })]);
    dbServiceMock.getPlatformConnectionById.mockReturnValue(connection());
    dbServiceMock.getRecordingById.mockReturnValue({ relative_path: 'grabacion-sin-analysis' });
    // fs.promises.readFile ya rechaza por defecto en beforeEach.
    googleChatMock.fetchMessages.mockResolvedValue([{ speaker: 'Ana', text: 'primero', timestamp: 't1' }]);

    await handlers['sync-chat-integrations']({}, { chatId: 'chat-1', projectId: 1, settings: {} });

    expect(chatSyncUtilsMock.assignRelativeTimestamps).toHaveBeenCalledWith([{ speaker: 'Ana', text: 'primero' }], 0);
  });

  it('dbService.saveRecording falla → error capturado y empujado a `errors`, no interrumpe el resto', async () => {
    dbServiceMock.getChatIntegrations.mockReturnValue([integration()]);
    dbServiceMock.getPlatformConnectionById.mockReturnValue(connection());
    googleChatMock.fetchMessages.mockResolvedValue([{ speaker: 'Ana', text: 'hola', timestamp: 't1' }]);
    dbServiceMock.saveRecording.mockReturnValue({ success: false });

    const result = await handlers['sync-chat-integrations']({}, { chatId: 'chat-1', projectId: 1, settings: {} });

    expect(result.synced).toBe(0);
    expect(result.errors).toEqual([{ integrationId: 100, error: 'Error guardando grabación en BD' }]);
  });

  it('plataforma teams también funciona (fetchMessages de teamsSyncService)', async () => {
    dbServiceMock.getChatIntegrations.mockReturnValue([integration({ connection_id: 2 })]);
    dbServiceMock.getPlatformConnectionById.mockReturnValue(connection({ id: 2, platform: 'teams' }));
    teamsMock.fetchMessages.mockResolvedValue([{ speaker: 'Carla', text: 'hola teams', timestamp: 't1' }]);
    dbServiceMock.saveRecording.mockReturnValue({ success: true, id: 300 });

    const result = await handlers['sync-chat-integrations']({}, { chatId: 'chat-1', projectId: 1, settings: {} });

    expect(teamsMock.fetchMessages).toHaveBeenCalled();
    expect(googleChatMock.fetchMessages).not.toHaveBeenCalled();
    expect(result.newMessages).toBe(1);
  });

  it('múltiples integraciones: agrega correctamente sincronizadas y nuevos mensajes', async () => {
    dbServiceMock.getChatIntegrations.mockReturnValue([
      integration({ id: 1, connection_id: 1 }),
      integration({ id: 2, connection_id: 1, channel_id: 'space/2' }),
    ]);
    dbServiceMock.getPlatformConnectionById.mockReturnValue(connection());
    googleChatMock.fetchMessages
      .mockResolvedValueOnce([{ speaker: 'Ana', text: 'msg1', timestamp: 't1' }])
      .mockResolvedValueOnce([
        { speaker: 'Bruno', text: 'msg2', timestamp: 't2' },
        { speaker: 'Bruno', text: 'msg3', timestamp: 't3' },
      ]);
    dbServiceMock.saveRecording.mockReturnValue({ success: true, id: 400 });

    const result = await handlers['sync-chat-integrations']({}, { chatId: 'chat-1', projectId: 1, settings: {} });

    expect(result).toEqual({ success: true, synced: 2, newMessages: 3, errors: [] });
  });
});

// ─────────────────────────────────────────────────────────────────────────
// sync-project-integrations — misma orquestación, a nivel de proyecto en vez
// de chat individual (sin filtro date_to, sin guard de projectId al vincular).
// ─────────────────────────────────────────────────────────────────────────

describe('sync-project-integrations', () => {
  function connection(overrides = {}) {
    return {
      id: 1,
      platform: 'google-chat',
      access_token_encrypted: encToken('at'),
      refresh_token_encrypted: encToken('rt'),
      token_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
      ...overrides,
    };
  }

  function integration(overrides = {}) {
    return {
      id: 500,
      connection_id: 1,
      channel_id: 'space/1',
      channel_name: 'General',
      recording_id: null,
      last_sync_at: null,
      ...overrides,
    };
  }

  it('sin integraciones → {success:true, synced:0, newMessages:0} (sin `errors`)', async () => {
    dbServiceMock.getProjectIntegrations.mockReturnValue([]);

    const result = await handlers['sync-project-integrations']({}, { projectId: 1, settings: {} });

    expect(result).toEqual({ success: true, synced: 0, newMessages: 0 });
  });

  it('conexión no encontrada → se omite sin contarla', async () => {
    dbServiceMock.getProjectIntegrations.mockReturnValue([integration()]);
    dbServiceMock.getPlatformConnectionById.mockReturnValue(null);

    const result = await handlers['sync-project-integrations']({}, { projectId: 1, settings: {} });

    expect(result).toEqual({ success: true, synced: 0, newMessages: 0, errors: [] });
  });

  it('sin mensajes nuevos → synced++ sin crear grabación', async () => {
    dbServiceMock.getProjectIntegrations.mockReturnValue([integration()]);
    dbServiceMock.getPlatformConnectionById.mockReturnValue(connection());
    googleChatMock.fetchMessages.mockResolvedValue([]);

    const result = await handlers['sync-project-integrations']({}, { projectId: 1, settings: {} });

    expect(result).toEqual({ success: true, synced: 1, newMessages: 0, errors: [] });
    expect(dbServiceMock.saveRecording).not.toHaveBeenCalled();
  });

  it('primera sync crea grabación y SIEMPRE la vincula al proyecto (sin guard de projectId)', async () => {
    dbServiceMock.getProjectIntegrations.mockReturnValue([integration()]);
    dbServiceMock.getPlatformConnectionById.mockReturnValue(connection());
    googleChatMock.fetchMessages.mockResolvedValue([{ speaker: 'Ana', text: 'hola', timestamp: 't1' }]);
    dbServiceMock.saveRecording.mockReturnValue({ success: true, id: 600 });

    await handlers['sync-project-integrations']({}, { projectId: 3, settings: {} });

    expect(dbServiceMock.addRecordingToProject).toHaveBeenCalledWith(3, 600);
  });

  it('grabación existente calcula offset desde el último segmento', async () => {
    dbServiceMock.getProjectIntegrations.mockReturnValue([integration({ recording_id: 88 })]);
    dbServiceMock.getPlatformConnectionById.mockReturnValue(connection());
    dbServiceMock.getRecordingById.mockReturnValue({ relative_path: 'existente' });
    fs.promises.readFile.mockResolvedValue(JSON.stringify([{ start: 0, end: 12, speaker: 'Ana', text: 'previo' }]));
    googleChatMock.fetchMessages.mockResolvedValue([{ speaker: 'Bruno', text: 'nuevo', timestamp: 't2' }]);

    await handlers['sync-project-integrations']({}, { projectId: 1, settings: {} });

    expect(chatSyncUtilsMock.assignRelativeTimestamps).toHaveBeenCalledWith([{ speaker: 'Bruno', text: 'nuevo' }], 15);
  });

  it('dbService.saveRecording falla → error empujado a `errors`, no interrumpe el resto de integraciones', async () => {
    dbServiceMock.getProjectIntegrations.mockReturnValue([integration({ id: 501 }), integration({ id: 502, channel_id: 'space/2' })]);
    dbServiceMock.getPlatformConnectionById.mockReturnValue(connection());
    googleChatMock.fetchMessages.mockResolvedValue([{ speaker: 'Ana', text: 'x', timestamp: 't1' }]);
    dbServiceMock.saveRecording
      .mockReturnValueOnce({ success: false })
      .mockReturnValueOnce({ success: true, id: 700 });

    const result = await handlers['sync-project-integrations']({}, { projectId: 1, settings: {} });

    expect(result.synced).toBe(1);
    expect(result.errors).toEqual([{ integrationId: 501, error: 'Error guardando grabación en BD' }]);
  });

  it('plataforma teams también funciona en sync-project-integrations', async () => {
    dbServiceMock.getProjectIntegrations.mockReturnValue([integration({ connection_id: 2 })]);
    dbServiceMock.getPlatformConnectionById.mockReturnValue(connection({ id: 2, platform: 'teams' }));
    teamsMock.fetchMessages.mockResolvedValue([{ speaker: 'Carla', text: 'hola', timestamp: 't1' }]);
    dbServiceMock.saveRecording.mockReturnValue({ success: true, id: 800 });

    const result = await handlers['sync-project-integrations']({}, { projectId: 1, settings: {} });

    expect(teamsMock.fetchMessages).toHaveBeenCalled();
    expect(result.newMessages).toBe(1);
  });
});
