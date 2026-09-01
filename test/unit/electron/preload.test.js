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

describe('resources preload bridge', () => {
  it('exposes list/refresh/checkSpace/download/cancel/retry/remove/getQueue through the exact IPC channels', async () => {
    invoke.mockResolvedValue({ ok: true });

    await exposedApi.resources.list();
    expect(invoke).toHaveBeenCalledWith('resources:list');

    await exposedApi.resources.refresh();
    expect(invoke).toHaveBeenCalledWith('resources:refresh');

    await exposedApi.resources.checkSpace('small');
    expect(invoke).toHaveBeenCalledWith('resources:check-space', 'small');

    await exposedApi.resources.download('small');
    expect(invoke).toHaveBeenCalledWith('resources:download', 'small');

    await exposedApi.resources.cancel('small');
    expect(invoke).toHaveBeenCalledWith('resources:cancel', 'small');

    await exposedApi.resources.retry('small');
    expect(invoke).toHaveBeenCalledWith('resources:retry', 'small');

    await exposedApi.resources.remove('small');
    expect(invoke).toHaveBeenCalledWith('resources:delete', 'small');

    await exposedApi.resources.getQueue();
    expect(invoke).toHaveBeenCalledWith('resources:get-queue');
  });

  it('onProgress se suscribe a resources:progress y devuelve un unsubscribe explícito', () => {
    const onMock = nodeRequire.cache[electronPath].exports.ipcRenderer.on;
    const removeListenerMock = nodeRequire.cache[electronPath].exports.ipcRenderer.removeListener;
    onMock.mockClear();
    removeListenerMock.mockClear();

    const listener = vi.fn();
    const unsubscribe = exposedApi.resources.onProgress(listener);

    expect(onMock).toHaveBeenCalledWith('resources:progress', expect.any(Function));
    const wrapped = onMock.mock.calls[0][1];

    const payload = { ok: true, items: [] };
    wrapped(null, payload);
    expect(listener).toHaveBeenCalledWith(payload);

    unsubscribe();
    expect(removeListenerMock).toHaveBeenCalledWith('resources:progress', wrapped);
  });
});
