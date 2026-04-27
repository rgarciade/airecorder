// Platform Connections & Project Integrations — base de datos
const BaseDbService = require('../baseDbService');
const {
  CREATE_TABLE_PLATFORM_CONNECTIONS,
  CREATE_TABLE_PROJECT_INTEGRATIONS,
  INSERT_PLATFORM_CONNECTION,
  UPDATE_PLATFORM_CONNECTION_TOKENS,
  SELECT_ALL_PLATFORM_CONNECTIONS,
  SELECT_PLATFORM_CONNECTION_BY_ID,
  DELETE_PLATFORM_CONNECTION,
  INSERT_PROJECT_INTEGRATION,
  UPDATE_PROJECT_INTEGRATION_SYNC,
  SELECT_PROJECT_INTEGRATIONS,
  SELECT_CHAT_INTEGRATIONS,
  DELETE_PROJECT_INTEGRATION
} = require('./queries');

class IntegrationsDbService extends BaseDbService {
  constructor(db) {
    super(db, 'integrations');
  }

  // ── Tablas ──────────────────────────────────────────────────────────────────

  init() {
    this.db.prepare(CREATE_TABLE_PLATFORM_CONNECTIONS).run();
    this.db.prepare(CREATE_TABLE_PROJECT_INTEGRATIONS).run();
  }

  // ── Platform Connections ────────────────────────────────────────────────────

  savePlatformConnection(platform, accountName, accountId, accessTokenEncrypted, refreshTokenEncrypted, tokenExpiresAt, scopes) {
    return this._insert(INSERT_PLATFORM_CONNECTION, [
      platform, accountName, accountId, accessTokenEncrypted, refreshTokenEncrypted, tokenExpiresAt,
      JSON.stringify(scopes || [])
    ]);
  }

  updatePlatformConnectionTokens(id, accessTokenEncrypted, refreshTokenEncrypted, tokenExpiresAt) {
    return this._run(UPDATE_PLATFORM_CONNECTION_TOKENS, [accessTokenEncrypted, refreshTokenEncrypted, tokenExpiresAt, id]);
  }

  getAllPlatformConnections() {
    return this._getMany(SELECT_ALL_PLATFORM_CONNECTIONS);
  }

  getPlatformConnectionById(id) {
    return this._getOne(SELECT_PLATFORM_CONNECTION_BY_ID, [id], null);
  }

  deletePlatformConnection(id) {
    return this._run(DELETE_PLATFORM_CONNECTION, [id]);
  }

  // ── Project Integrations ────────────────────────────────────────────────────

  addProjectIntegration(projectId, connectionId, channelId, channelName, chatId = null, dateFrom = null, dateTo = null) {
    return this._insert(INSERT_PROJECT_INTEGRATION, [projectId, connectionId, channelId, channelName, chatId, dateFrom, dateTo]);
  }

  updateProjectIntegrationSync(id, recordingId, lastSyncAt) {
    return this._run(UPDATE_PROJECT_INTEGRATION_SYNC, [recordingId, lastSyncAt, id]);
  }

  getProjectIntegrations(projectId) {
    return this._getMany(SELECT_PROJECT_INTEGRATIONS, [projectId]);
  }

  getChatIntegrations(chatId) {
    return this._getMany(SELECT_CHAT_INTEGRATIONS, [chatId]);
  }

  deleteProjectIntegration(id) {
    return this._run(DELETE_PROJECT_INTEGRATION, [id]);
  }
}

module.exports = IntegrationsDbService;