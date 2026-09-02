import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';

const nodeRequire = createRequire(import.meta.url);
const electronPath = nodeRequire.resolve('electron');
const sentryPreloadPath = nodeRequire.resolve('@sentry/electron/preload');
const preloadPath = nodeRequire.resolve('../../../electron/preload.js');
let originalElectron; let originalSentry; let originalPreload; let exposedApi;
const invoke = vi.fn();

beforeAll(() => {
  originalElectron = nodeRequire.cache[electronPath];
  originalSentry = nodeRequire.cache[sentryPreloadPath];
  originalPreload = nodeRequire.cache[preloadPath];
  nodeRequire.cache[electronPath] = {
    id: electronPath, filename: electronPath, loaded: true,
    exports: {
      contextBridge: { exposeInMainWorld: (_name, api) => { exposedApi = api; } },
      ipcRenderer: { invoke, on: vi.fn(), removeListener: vi.fn(), send: vi.fn() },
      shell: {},
    },
  };
  nodeRequire.cache[sentryPreloadPath] = { id: sentryPreloadPath, filename: sentryPreloadPath, loaded: true, exports: {} };
  delete nodeRequire.cache[preloadPath];
  nodeRequire(preloadPath);
});

afterAll(() => {
  if (originalElectron) nodeRequire.cache[electronPath] = originalElectron; else delete nodeRequire.cache[electronPath];
  if (originalSentry) nodeRequire.cache[sentryPreloadPath] = originalSentry; else delete nodeRequire.cache[sentryPreloadPath];
  if (originalPreload) nodeRequire.cache[preloadPath] = originalPreload; else delete nodeRequire.cache[preloadPath];
});

describe('Codex preload bridge', () => {
  it('exposes listCodexModels through the exact IPC channel', async () => {
    invoke.mockResolvedValue({ success: true, models: [], error: null });
    await exposedApi.listCodexModels();
    expect(invoke).toHaveBeenCalledWith('ai:codex-models');
  });
});
