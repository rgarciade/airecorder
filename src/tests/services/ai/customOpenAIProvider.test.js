import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('customOpenAIProvider', () => {
  let fetchSpy;
  let CustomOpenAIProvider;

  beforeEach(async () => {
    fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: 'hello' } }] }),
      body: null,
    });
    ({ CustomOpenAIProvider } = await import('../../../services/ai/customOpenAIProvider.js'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends Bearer auth header and correct endpoint for chat completions', async () => {
    const provider = new CustomOpenAIProvider({
      baseUrl: 'http://localhost:9999',
      apiKey: 'test-key',
      model: 'my-model',
    });

    const result = await provider.sendMessage('hello', 'you are a tester');

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:9999/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-key',
        }),
        body: expect.stringContaining('my-model'),
      })
    );
    expect(result).toBe('hello');
  });

  it('normalizes baseUrl with trailing /v1', async () => {
    const provider = new CustomOpenAIProvider({
      baseUrl: 'http://localhost:9999/v1',
      apiKey: 'k2',
      model: 'm2',
    });

    await provider.sendMessage('hi');

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:9999/v1/chat/completions',
      expect.any(Object)
    );
  });

  it('lists models with Bearer auth against /v1/models', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: [{ id: 'model-a' }, { id: 'model-b' }] }),
    });

    const provider = new CustomOpenAIProvider({
      baseUrl: 'http://localhost:9999',
      apiKey: 'list-key',
      model: 'any',
    });

    const models = await provider.listModels();

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:9999/v1/models',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer list-key',
        }),
      })
    );
    expect(models).toHaveLength(2);
    expect(models[0].name).toBe('model-a');
  });

  it('throws a structured error when the API returns a failure', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'bad key' } }),
    });

    const provider = new CustomOpenAIProvider({
      baseUrl: 'http://localhost:9999',
      apiKey: 'bad-key',
      model: 'm',
    });

    await expect(provider.sendMessage('x')).rejects.toThrow(/Custom OpenAI Error: 401.*bad key/);
  });

  describe('apiPrefix and errorLabel options', () => {
    it('posts to `${baseUrl}/chat/completions` when apiPrefix is empty', async () => {
      const provider = new CustomOpenAIProvider({
        baseUrl: 'https://api.z.ai/api/coding/paas/v4',
        apiKey: 'glm-key',
        model: 'glm-5.2',
        apiPrefix: '',
      });

      await provider.sendMessage('hi');

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.z.ai/api/coding/paas/v4/chat/completions',
        expect.any(Object)
      );
    });

    it('lists models from `${baseUrl}/models` when apiPrefix is empty', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [{ id: 'glm-5.2' }] }),
      });
      const provider = new CustomOpenAIProvider({
        baseUrl: 'https://api.z.ai/api/coding/paas/v4',
        apiKey: 'glm-key',
        model: 'glm-5.2',
        apiPrefix: '',
      });

      await provider.listModels();

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.z.ai/api/coding/paas/v4/models',
        expect.any(Object)
      );
    });

    it('keeps the /v1 prefix when no apiPrefix is given', async () => {
      const provider = new CustomOpenAIProvider({
        baseUrl: 'https://api.example.com',
        apiKey: 'k',
        model: 'm',
      });

      await provider.sendMessage('hi');

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.example.com/v1/chat/completions',
        expect.any(Object)
      );
    });

    it('uses errorLabel in the error text', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: { message: 'invalid api key' } }),
      });
      const provider = new CustomOpenAIProvider({
        baseUrl: 'https://api.z.ai/api/coding/paas/v4',
        apiKey: 'bad',
        model: 'glm-5.2',
        apiPrefix: '',
        errorLabel: 'GLM',
      });

      await expect(provider.sendMessage('x')).rejects.toThrow('GLM Error: 401 — invalid api key');
    });
  });
});
