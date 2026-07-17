import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';

const fetchSpy = vi.fn();

vi.stubGlobal('fetch', fetchSpy);

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
