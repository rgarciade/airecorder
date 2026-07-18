import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

describe('useCustomConnections helpers', () => {
  let helpers;

  beforeEach(async () => {
    helpers = await import('../../hooks/useCustomConnections.js');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete global.window;
  });

  describe('connectionsReducer', () => {
    it('adds a connection', () => {
      const connection = { id: 'c1', name: 'MyGPT', baseUrl: 'http://gpt.local', apiKey: 'k1' };

      const result = helpers.connectionsReducer([], {
        type: helpers.CONNECTIONS_ACTIONS.ADD,
        connection,
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(connection);
    });

    it('updates a connection by id', () => {
      const initial = [{ id: 'c1', name: 'Old', baseUrl: 'http://old.local', apiKey: 'k1' }];

      const result = helpers.connectionsReducer(initial, {
        type: helpers.CONNECTIONS_ACTIONS.UPDATE,
        id: 'c1',
        updates: { name: 'New', baseUrl: 'http://new.local' },
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'c1',
        name: 'New',
        baseUrl: 'http://new.local',
        apiKey: 'k1',
      });
    });

    it('leaves other connections untouched on update', () => {
      const initial = [
        { id: 'c1', name: 'One', baseUrl: 'http://one.local', apiKey: 'k1' },
        { id: 'c2', name: 'Two', baseUrl: 'http://two.local', apiKey: 'k2' },
      ];

      const result = helpers.connectionsReducer(initial, {
        type: helpers.CONNECTIONS_ACTIONS.UPDATE,
        id: 'c1',
        updates: { name: 'Updated' },
      });

      expect(result[0].name).toBe('Updated');
      expect(result[1]).toEqual(initial[1]);
    });
  });

  describe('stagedDeletionsReducer', () => {
    it('stages a deletion', () => {
      const result = helpers.stagedDeletionsReducer([], {
        type: helpers.CONNECTIONS_ACTIONS.STAGE_DELETE,
        id: 'c1',
      });

      expect(result).toEqual(['c1']);
    });

    it('does not duplicate staged deletions', () => {
      const result = helpers.stagedDeletionsReducer(['c1'], {
        type: helpers.CONNECTIONS_ACTIONS.STAGE_DELETE,
        id: 'c1',
      });

      expect(result).toEqual(['c1']);
    });

    it('cancels a staged deletion', () => {
      const result = helpers.stagedDeletionsReducer(['c1', 'c2'], {
        type: helpers.CONNECTIONS_ACTIONS.CANCEL_DELETE,
        id: 'c1',
      });

      expect(result).toEqual(['c2']);
    });
  });

  describe('validateCustomConnectionsSave', () => {
    it('blocks save when the active chat connection is staged for deletion', () => {
      const result = helpers.validateCustomConnectionsSave({
        connections: [{ id: 'c1', name: 'Chat', baseUrl: 'http://x', apiKey: 'k' }],
        stagedDeletions: ['c1'],
        aiProvider: 'custom:c1',
        embeddingProvider: '',
      });

      expect(result.blocked).toBe(true);
      expect(result.error).toBe('settings.customConnections.errors.deletedConnectionInUse');
    });

    it('blocks save when the active embeddings connection is staged for deletion', () => {
      const result = helpers.validateCustomConnectionsSave({
        connections: [{ id: 'c2', name: 'Embeddings', baseUrl: 'http://x', apiKey: 'k' }],
        stagedDeletions: ['c2'],
        aiProvider: 'ollama',
        embeddingProvider: 'custom:c2',
      });

      expect(result.blocked).toBe(true);
      expect(result.error).toBe('settings.customConnections.errors.deletedConnectionInUse');
    });

    it('blocks save when no AI provider is assigned', () => {
      const result = helpers.validateCustomConnectionsSave({
        connections: [],
        stagedDeletions: [],
        aiProvider: '',
        embeddingProvider: '',
      });

      expect(result.blocked).toBe(true);
      expect(result.error).toBe('settings.customConnections.errors.noAiProvider');
    });

    it('allows save when staged deletions do not affect active roles', () => {
      const result = helpers.validateCustomConnectionsSave({
        connections: [
          { id: 'c1', name: 'Chat', baseUrl: 'http://x', apiKey: 'k' },
          { id: 'c2', name: 'Unused', baseUrl: 'http://y', apiKey: 'k' },
        ],
        stagedDeletions: ['c2'],
        aiProvider: 'custom:c1',
        embeddingProvider: '',
      });

      expect(result.blocked).toBe(false);
      expect(result.error).toBeNull();
    });

    it('allows save for built-in providers even with staged deletions', () => {
      const result = helpers.validateCustomConnectionsSave({
        connections: [{ id: 'c1', name: 'Unused', baseUrl: 'http://x', apiKey: 'k' }],
        stagedDeletions: ['c1'],
        aiProvider: 'ollama',
        embeddingProvider: '',
      });

      expect(result.blocked).toBe(false);
      expect(result.error).toBeNull();
    });
  });

  describe('buildCustomConnectionsSavePayload', () => {
    it('returns null payload and an error when save is blocked', () => {
      const result = helpers.buildCustomConnectionsSavePayload({
        connections: [{ id: 'c1', name: 'Chat', baseUrl: 'http://x', apiKey: 'k' }],
        stagedDeletions: ['c1'],
        aiProvider: 'custom:c1',
        embeddingProvider: '',
        customChatModel: 'model-chat',
        embeddingModel: '',
      });

      expect(result.validation.blocked).toBe(true);
      expect(result.payload).toBeNull();
    });

    it('returns the filtered customConnections array when save passes', () => {
      const result = helpers.buildCustomConnectionsSavePayload({
        connections: [
          { id: 'c1', name: 'Chat', baseUrl: 'http://x', apiKey: 'k' },
          { id: 'c2', name: 'Unused', baseUrl: 'http://y', apiKey: 'k' },
        ],
        stagedDeletions: ['c2'],
        aiProvider: 'custom:c1',
        embeddingProvider: '',
        customChatModel: 'model-chat',
        embeddingModel: '',
      });

      expect(result.validation.blocked).toBe(false);
      expect(result.payload.customConnections).toHaveLength(1);
      expect(result.payload.customConnections[0].id).toBe('c1');
      expect(result.payload.aiProvider).toBe('custom:c1');
      expect(result.payload.customChatModel).toBe('model-chat');
    });
  });

  describe('useCustomConnections hook', () => {
    it('exports the hook as a function', () => {
      expect(typeof helpers.useCustomConnections).toBe('function');
    });

    it('captures the hook and calls testConnection through a render probe', async () => {
      const listCustomModels = vi.fn().mockResolvedValue({
        success: true,
        models: [{ name: 'model-a', label: 'Model A', description: '' }],
      });
      global.window = { electronAPI: { listCustomModels } };

      let capturedHook = null;
      const HookProbe = () => {
        const hook = helpers.useCustomConnections([{ id: 'c1', name: 'Test', baseUrl: 'http://x', apiKey: 'k' }]);
        capturedHook = hook;
        return null;
      };

      renderToStaticMarkup(React.createElement(HookProbe));
      expect(capturedHook).not.toBeNull();

      const result = await capturedHook.testConnection('c1');

      expect(listCustomModels).toHaveBeenCalledWith('c1');
      expect(result.success).toBe(true);
      expect(result.models).toHaveLength(1);
      expect(result.models[0].name).toBe('model-a');
    });

    it('returns an error when testConnection IPC fails', async () => {
      const listCustomModels = vi.fn().mockResolvedValue({
        success: false,
        error: 'Connection refused',
      });
      global.window = { electronAPI: { listCustomModels } };

      let capturedHook = null;
      const HookProbe = () => {
        const hook = helpers.useCustomConnections([{ id: 'c1', name: 'Test', baseUrl: 'http://x', apiKey: 'k' }]);
        capturedHook = hook;
        return null;
      };

      renderToStaticMarkup(React.createElement(HookProbe));
      const result = await capturedHook.testConnection('c1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection refused');
    });

    it('returns an error when testConnection throws', async () => {
      const listCustomModels = vi.fn().mockRejectedValue(new Error('Network failure'));
      global.window = { electronAPI: { listCustomModels } };

      let capturedHook = null;
      const HookProbe = () => {
        const hook = helpers.useCustomConnections([{ id: 'c1', name: 'Test', baseUrl: 'http://x', apiKey: 'k' }]);
        capturedHook = hook;
        return null;
      };

      renderToStaticMarkup(React.createElement(HookProbe));
      const result = await capturedHook.testConnection('c1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network failure');
    });
  });
});
