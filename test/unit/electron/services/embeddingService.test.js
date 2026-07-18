import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';

const fetchSpy = vi.fn();

vi.stubGlobal('fetch', fetchSpy);

// No se requiere el mock de Electron; usamos __setSettingsPath para inyectar la ruta de settings.

describe('embeddingService — custom OpenAI-compatible embeddings', () => {
  let embeddingService;

  beforeEach(async () => {
    fetchSpy.mockReset();
    vi.restoreAllMocks();

    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(
      JSON.stringify({
        embeddingProvider: '',
        embeddingModel: '',
        customConnections: [],
      })
    );

    embeddingService = await import('../../../../electron/services/embeddingService.js');
    embeddingService.__setSettingsPath('/tmp/settings.json');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('embedWithCustom calls /v1/embeddings with Bearer auth and model', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: [
          { index: 0, embedding: [0.1, 0.2] },
          { index: 1, embedding: [0.3, 0.4] },
        ],
      }),
    });

    const result = await embeddingService.embedWithCustom(['hello', 'world'], {
      baseUrl: 'http://gpt.local',
      apiKey: 'secret-key',
      model: 'nomic-embed-text',
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://gpt.local/v1/embeddings',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer secret-key',
        }),
        body: expect.stringContaining('"model":"nomic-embed-text"'),
      })
    );

    expect(fetchSpy.mock.calls[0][1].body).toContain('"input":["hello","world"]');
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual([0.1, 0.2]);
    expect(result[1]).toEqual([0.3, 0.4]);
  });

  it('embedWithCustom normalizes baseUrl with trailing /v1', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [{ index: 0, embedding: [1] }] }),
    });

    await embeddingService.embedWithCustom(['text'], {
      baseUrl: 'http://gpt.local/v1',
      apiKey: 'k',
      model: 'm',
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://gpt.local/v1/embeddings',
      expect.any(Object)
    );
  });

  it('embedWithCustom throws when the API returns an error', async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'bad key',
    });

    await expect(
      embeddingService.embedWithCustom(['text'], {
        baseUrl: 'http://gpt.local',
        apiKey: 'bad-key',
        model: 'm',
      })
    ).rejects.toThrow(/401/);
  });

  describe('detectEmbeddingProvider — custom branch', () => {
    it('returns custom provider info when embeddingProvider is custom:{id}', async () => {
      vi.spyOn(fs, 'readFileSync').mockReturnValue(
        JSON.stringify({
          embeddingProvider: 'custom:conn-1',
          embeddingModel: 'mx',
          customConnections: [
            { id: 'conn-1', name: 'MyGPT', baseUrl: 'http://gpt.local', apiKey: 'k' },
          ],
        })
      );

      const provider = await embeddingService.detectEmbeddingProvider();

      expect(provider).toEqual({
        provider: 'custom-openai',
        connectionId: 'conn-1',
        baseUrl: 'http://gpt.local',
        apiKey: 'k',
        model: 'mx',
      });
    });

    it('returns null when the referenced custom connection does not exist', async () => {
      vi.spyOn(fs, 'readFileSync').mockReturnValue(
        JSON.stringify({
          embeddingProvider: 'custom:missing',
          embeddingModel: 'mx',
          customConnections: [],
        })
      );

      const provider = await embeddingService.detectEmbeddingProvider();

      expect(provider).toBeNull();
    });
  });

  describe('detectEmbeddingProvider — DeepSeek guard', () => {
    it('warns and returns null when embeddingProvider is deepseek (no embedding API)', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      vi.spyOn(fs, 'readFileSync').mockReturnValue(
        JSON.stringify({
          embeddingProvider: 'deepseek',
          aiProvider: 'ollama',
          deepseekApiKey: 'sk-test',
        })
      );

      fetchSpy.mockRejectedValue(new Error('connection refused'));

      const provider = await embeddingService.detectEmbeddingProvider();

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('DeepSeek does not support embeddings')
      );
      expect(provider).toBeNull();

      warnSpy.mockRestore();
    });

    it('warns and falls through when aiProvider is deepseek and embeddingProvider is empty', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      vi.spyOn(fs, 'readFileSync').mockReturnValue(
        JSON.stringify({
          embeddingProvider: '',
          aiProvider: 'deepseek',
          deepseekApiKey: 'sk-test',
        })
      );

      fetchSpy.mockRejectedValue(new Error('connection refused'));

      const provider = await embeddingService.detectEmbeddingProvider();

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('DeepSeek does not support embeddings')
      );
      expect(provider).toBeNull();

      warnSpy.mockRestore();
    });
  });

  describe('getEmbeddingModel', () => {
    it('returns settings.embeddingModel for a custom embeddings provider', () => {
      vi.spyOn(fs, 'readFileSync').mockReturnValue(
        JSON.stringify({
          embeddingProvider: 'custom:conn-1',
          embeddingModel: 'custom-embed',
          aiProvider: 'ollama',
          ollamaEmbeddingModel: 'nomic-embed-text',
        })
      );

      expect(embeddingService.getEmbeddingModel()).toBe('custom-embed');
    });
  });
});
