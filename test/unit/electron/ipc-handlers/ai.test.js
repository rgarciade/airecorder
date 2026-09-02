import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'fs';

const fetchSpy = vi.fn();
const shellOpenExternal = vi.fn(() => Promise.resolve());
const nodeRequire = createRequire(import.meta.url);
const electronPath = nodeRequire.resolve('electron');
let originalElectronEntry;

vi.stubGlobal('fetch', fetchSpy);

beforeAll(() => {
  originalElectronEntry = nodeRequire.cache[electronPath];
  nodeRequire.cache[electronPath] = {
    id: electronPath,
    filename: electronPath,
    loaded: true,
    exports: { ipcMain: {}, shell: { openExternal: shellOpenExternal } },
  };
});

afterAll(() => {
  if (originalElectronEntry) nodeRequire.cache[electronPath] = originalElectronEntry;
  else delete nodeRequire.cache[electronPath];
});

describe('ai handlers', () => {
  let handlers;
  let ipcMain;

  beforeEach(async () => {
    handlers = new Map();
    ipcMain = {
      handle: vi.fn((channel, handler) => {
        handlers.set(channel, handler);
      }),
    };

    fetchSpy.mockReset();
    vi.restoreAllMocks();

    const aiHandlers = await import('../../../../electron/ipc-handlers/ai.js');
    aiHandlers.__setSettingsPath('/tmp/settings.json');
    aiHandlers.registerAiHandlers(ipcMain);
  });

  it('registra ai:custom-list-models y devuelve lista con Bearer', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(
      JSON.stringify({
        customConnections: [
          { id: 'conn-1', name: 'MyGPT', baseUrl: 'http://gpt.local', apiKey: 'secret-key' },
        ],
      })
    );
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [{ id: 'model-a', object: 'model' }] }),
    });

    const result = await handlers.get('ai:custom-list-models')(null, 'conn-1');

    expect(fs.existsSync).toHaveBeenCalledWith('/tmp/settings.json');
    expect(result.success).toBe(true);
    expect(fetchSpy).toHaveBeenCalledWith('http://gpt.local/v1/models', {
      headers: { Authorization: 'Bearer secret-key' },
    });
    expect(result).toEqual({
      success: true,
      models: [{ name: 'model-a', label: 'model-a', description: 'model' }],
    });
  });

  it('devuelve error estructurado si la conexión no existe', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({ customConnections: [] }));

    const result = await handlers.get('ai:custom-list-models')(null, 'missing');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/no encontrada/);
  });

  it('devuelve error estructurado si el API responde con error', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(
      JSON.stringify({
        customConnections: [
          { id: 'conn-1', name: 'MyGPT', baseUrl: 'http://gpt.local', apiKey: 'secret-key' },
        ],
      })
    );
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'bad key' } }),
    });

    const result = await handlers.get('ai:custom-list-models')(null, 'conn-1');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/401/);
    expect(result.error).toMatch(/bad key/);
  });

  it('normaliza baseUrl con sufijo /v1', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(
      JSON.stringify({
        customConnections: [
          { id: 'conn-1', name: 'MyGPT', baseUrl: 'http://gpt.local/v1', apiKey: 'k' },
        ],
      })
    );
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [] }),
    });

    await handlers.get('ai:custom-list-models')(null, 'conn-1');

    expect(fetchSpy).toHaveBeenCalledWith('http://gpt.local/v1/models', expect.any(Object));
  });
});

describe('Codex login IPC contract', () => {
  let handlers; let aiHandlers; let codex;
  beforeEach(async () => {
    handlers = new Map(); const ipc = { handle: vi.fn((channel, handler) => handlers.set(channel, handler)) };
    aiHandlers = await import('../../../../electron/ipc-handlers/ai.js');
    codex = { startLogin: vi.fn(), cancelLogin: vi.fn(), cancel: vi.fn(), getStatus: vi.fn(), listModels: vi.fn() };
    aiHandlers.__setCodexService(codex); aiHandlers.registerAiHandlers(ipc);
  });
  it('forwards URL and code when structured progress arrives separately', async () => {
    codex.startLogin.mockImplementation(async ({ onProgress }) => {
      onProgress({ requestId: 'r1', phase: 'device-auth', url: 'https://auth.openai.com/device' });
      onProgress({ requestId: 'r1', phase: 'device-auth', code: 'I7GK-YAWPT' });
      return { success: true };
    });
    const sender = { send: vi.fn(), isDestroyed: () => false };
    await handlers.get('ai:codex-login')({ sender }, 'r1');
    expect(codex.startLogin).toHaveBeenCalled();
    expect(sender.send).toHaveBeenNthCalledWith(1, 'ai:codex-login-progress', expect.objectContaining({ requestId: 'r1', url: 'https://auth.openai.com/device' }));
    expect(sender.send).toHaveBeenNthCalledWith(2, 'ai:codex-login-progress', expect.objectContaining({ requestId: 'r1', code: 'I7GK-YAWPT' }));
  });
  it('does not send to destroyed sender and forwards cancellation by requestId', async () => {
    codex.startLogin.mockImplementation(async ({ onProgress }) => { onProgress({ requestId: 'dead', text: 'x' }); return { success: false, error: 'failed' }; }); codex.cancelLogin.mockReturnValue(true);
    const sender = { send: vi.fn(), isDestroyed: () => true }; const result = await handlers.get('ai:codex-login')({ sender }, 'dead');
    expect(result).toMatchObject({ success: false, error: 'failed' }); expect(sender.send).not.toHaveBeenCalled();
    expect(handlers.get('ai:codex-login-cancel')(null, 'dead')).toEqual({ success: true }); expect(codex.cancelLogin).toHaveBeenCalledWith('dead');
  });
  it('returns the normalized model-list contract for success and failure', async () => {
    const models = [{ id: 'gpt-test' }];
    codex.listModels.mockResolvedValueOnce(models).mockRejectedValueOnce(new Error('catalog unavailable'));
    await expect(handlers.get('ai:codex-models')()).resolves.toEqual({ success: true, models, error: null });
    await expect(handlers.get('ai:codex-models')()).resolves.toEqual({ success: false, models: [], error: 'catalog unavailable' });
  });
});
