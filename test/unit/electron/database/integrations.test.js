/**
 * Tests para IntegrationsDbService
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDB, initTestDB } from './dbSetup.js';

describe('IntegrationsDbService', () => {
  let db;
  let integrations;
  let projects;

  beforeEach(() => {
    db = createTestDB();
    const services = initTestDB(db);
    integrations = services.integrations;
    projects = services.projects;
  });

  describe('savePlatformConnection', () => {
    it('debería guardar una conexión de plataforma', () => {
      const result = integrations.savePlatformConnection(
        'slack',
        'mi-empresa',
        'account-123',
        Buffer.from('access-token'),
        Buffer.from('refresh-token'),
        new Date('2025-12-31').toISOString(),
        ['channels:read', 'chat:write']
      );
      expect(result.success).toBe(true);
      expect(result.id).toBeDefined();
    });

    it('debería guardar scopes como JSON', () => {
      const result = integrations.savePlatformConnection(
        'slack', 'test', 'acc-1',
        Buffer.from('token'), Buffer.from('refresh'), null,
        ['scope1', 'scope2']
      );
      expect(result.success).toBe(true);
    });

    it('debería manejar scopes vacíos', () => {
      const result = integrations.savePlatformConnection(
        'slack', 'test', 'acc-1',
        Buffer.from('token'), Buffer.from('refresh'), null, []
      );
      expect(result.success).toBe(true);
    });
  });

  describe('getAllPlatformConnections', () => {
    it('debería devolver todas las conexiones', () => {
      integrations.savePlatformConnection('slack', 'empresa1', 'acc1', Buffer.from('t1'), Buffer.from('r1'), null, []);
      integrations.savePlatformConnection('google', 'empresa2', 'acc2', Buffer.from('t2'), Buffer.from('r2'), null, []);
      const all = integrations.getAllPlatformConnections();
      expect(all.length).toBe(2);
    });

    it('debería devolver array vacío si no hay conexiones', () => {
      const all = integrations.getAllPlatformConnections();
      expect(all).toEqual([]);
    });

    it('debería incluir id, platform, account_name, account_id, scopes, connected_at', () => {
      integrations.savePlatformConnection('slack', 'test', 'acc-1', Buffer.from('t'), Buffer.from('r'), null, []);
      const all = integrations.getAllPlatformConnections();
      expect(all[0]).toHaveProperty('id');
      expect(all[0]).toHaveProperty('platform');
      expect(all[0]).toHaveProperty('account_name');
      expect(all[0]).toHaveProperty('account_id');
      expect(all[0]).toHaveProperty('scopes');
      expect(all[0]).toHaveProperty('connected_at');
    });
  });

  describe('getPlatformConnectionById', () => {
    it('debería obtener una conexión por ID', () => {
      const result = integrations.savePlatformConnection('slack', 'test', 'acc-1', Buffer.from('t'), Buffer.from('r'), null, []);
      const connection = integrations.getPlatformConnectionById(result.id);
      expect(connection).toBeDefined();
      expect(connection.platform).toBe('slack');
      expect(connection.account_name).toBe('test');
    });

    it('debería devolver null si no existe', () => {
      const connection = integrations.getPlatformConnectionById(999);
      expect(connection).toBeNull();
    });
  });

  describe('updatePlatformConnectionTokens', () => {
    it('debería actualizar tokens de una conexión', () => {
      const result = integrations.savePlatformConnection('slack', 'test', 'acc-1', Buffer.from('old-access'), Buffer.from('old-refresh'), null, []);
      const updateResult = integrations.updatePlatformConnectionTokens(
        result.id,
        Buffer.from('new-access'),
        Buffer.from('new-refresh'),
        new Date('2026-01-01').toISOString()
      );
      expect(updateResult.success).toBe(true);
      const connection = integrations.getPlatformConnectionById(result.id);
      expect(connection.access_token_encrypted).toEqual(Buffer.from('new-access'));
      expect(connection.token_expires_at).toBe('2026-01-01T00:00:00.000Z');
    });
  });

  describe('deletePlatformConnection', () => {
    it('debería eliminar una conexión', () => {
      const result = integrations.savePlatformConnection('slack', 'test', 'acc-1', Buffer.from('t'), Buffer.from('r'), null, []);
      const deleteResult = integrations.deletePlatformConnection(result.id);
      expect(deleteResult.success).toBe(true);
      const connection = integrations.getPlatformConnectionById(result.id);
      expect(connection).toBeNull();
    });

    it('debería eliminar integraciones de proyecto en cascada', () => {
      const connResult = integrations.savePlatformConnection('slack', 'test', 'acc-1', Buffer.from('t'), Buffer.from('r'), null, []);
      const project = projects.createProject('Test');
      integrations.addProjectIntegration(project.id, connResult.id, 'channel-1', 'General');
      integrations.deletePlatformConnection(connResult.id);
      const integrations_list = integrations.getProjectIntegrations(project.id);
      expect(integrations_list.length).toBe(0);
    });
  });

  describe('addProjectIntegration', () => {
    it('debería añadir una integración a un proyecto', () => {
      const connResult = integrations.savePlatformConnection('slack', 'test', 'acc-1', Buffer.from('t'), Buffer.from('r'), null, []);
      const project = projects.createProject('Test');
      const result = integrations.addProjectIntegration(
        project.id, connResult.id, 'channel-123', 'General',
        'chat-456', '2025-01-01', '2025-12-31'
      );
      expect(result.success).toBe(true);
      expect(result.id).toBeDefined();
    });

    it('debería permitir chat_id, date_from, date_to opcionales', () => {
      const connResult = integrations.savePlatformConnection('slack', 'test', 'acc-1', Buffer.from('t'), Buffer.from('r'), null, []);
      const project = projects.createProject('Test');
      const result = integrations.addProjectIntegration(project.id, connResult.id, 'channel-123', 'General');
      expect(result.success).toBe(true);
    });
  });

  describe('getProjectIntegrations', () => {
    it('debería devolver integraciones de un proyecto', () => {
      const connResult = integrations.savePlatformConnection('slack', 'test', 'acc-1', Buffer.from('t'), Buffer.from('r'), null, []);
      const project = projects.createProject('Test');
      integrations.addProjectIntegration(project.id, connResult.id, 'channel-1', 'General');
      integrations.addProjectIntegration(project.id, connResult.id, 'channel-2', 'Random');
      const all = integrations.getProjectIntegrations(project.id);
      expect(all.length).toBe(2);
    });

    it('debería incluir platform y account_name de la conexión', () => {
      const connResult = integrations.savePlatformConnection('slack', 'mi-empresa', 'acc-1', Buffer.from('t'), Buffer.from('r'), null, []);
      const project = projects.createProject('Test');
      integrations.addProjectIntegration(project.id, connResult.id, 'channel-1', 'General');
      const all = integrations.getProjectIntegrations(project.id);
      expect(all[0].platform).toBe('slack');
      expect(all[0].account_name).toBe('mi-empresa');
    });

    it('debería devolver array vacío si no hay integraciones', () => {
      const project = projects.createProject('Test');
      const all = integrations.getProjectIntegrations(project.id);
      expect(all).toEqual([]);
    });
  });

  describe('getChatIntegrations', () => {
    it('debería devolver integraciones de un chat', () => {
      const connResult = integrations.savePlatformConnection('slack', 'test', 'acc-1', Buffer.from('t'), Buffer.from('r'), null, []);
      const project = projects.createProject('Test');
      integrations.addProjectIntegration(project.id, connResult.id, 'channel-1', 'General', 'chat-1');
      integrations.addProjectIntegration(project.id, connResult.id, 'channel-2', 'Random', 'chat-1');
      const all = integrations.getChatIntegrations('chat-1');
      expect(all.length).toBe(2);
    });

    it('debería devolver array vacío si no hay integraciones para ese chat', () => {
      const connResult = integrations.savePlatformConnection('slack', 'test', 'acc-1', Buffer.from('t'), Buffer.from('r'), null, []);
      const project = projects.createProject('Test');
      integrations.addProjectIntegration(project.id, connResult.id, 'channel-1', 'General', 'chat-1');
      const all = integrations.getChatIntegrations('chat-999');
      expect(all).toEqual([]);
    });
  });

  describe('updateProjectIntegrationSync', () => {
    it('debería actualizar recording_id y last_sync_at', () => {
      const connResult = integrations.savePlatformConnection('slack', 'test', 'acc-1', Buffer.from('t'), Buffer.from('r'), null, []);
      const project = projects.createProject('Test');
      const result = integrations.addProjectIntegration(project.id, connResult.id, 'channel-1', 'General');
      const syncTime = new Date('2025-06-15T10:30:00Z').toISOString();
      const updateResult = integrations.updateProjectIntegrationSync(result.id, 1, syncTime);
      expect(updateResult.success).toBe(true);
      const all = integrations.getProjectIntegrations(project.id);
      expect(all[0].recording_id).toBe(1);
      expect(all[0].last_sync_at).toBe(syncTime);
    });
  });

  describe('deleteProjectIntegration', () => {
    it('debería eliminar una integración de proyecto', () => {
      const connResult = integrations.savePlatformConnection('slack', 'test', 'acc-1', Buffer.from('t'), Buffer.from('r'), null, []);
      const project = projects.createProject('Test');
      const result = integrations.addProjectIntegration(project.id, connResult.id, 'channel-1', 'General');
      const deleteResult = integrations.deleteProjectIntegration(result.id);
      expect(deleteResult.success).toBe(true);
      const all = integrations.getProjectIntegrations(project.id);
      expect(all.length).toBe(0);
    });
  });
});