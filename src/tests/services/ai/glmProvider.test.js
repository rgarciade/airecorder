import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolveGlmBaseUrl, listGlmModels } from '../../../services/ai/glmProvider.js';

const PLAN_BASE_URL = 'https://api.z.ai/api/coding/paas/v4';
const GENERAL_BASE_URL = 'https://api.z.ai/api/paas/v4';
const FALLBACK_MODEL_NAMES = ['glm-5.2', 'glm-5-turbo', 'glm-4.7'];

describe('resolveGlmBaseUrl', () => {
  it('defaults to the Coding Plan endpoint', () => {
    expect(resolveGlmBaseUrl({})).toBe(PLAN_BASE_URL);
  });

  it('uses the general endpoint when glmEndpointMode is general', () => {
    expect(resolveGlmBaseUrl({ glmEndpointMode: 'general' })).toBe(GENERAL_BASE_URL);
  });

  it('lets a non-empty custom glmBaseUrl win and trims its trailing slash', () => {
    expect(
      resolveGlmBaseUrl({
        glmEndpointMode: 'general',
        glmBaseUrl: '  https://open.bigmodel.cn/api/coding/paas/v4/  ',
      })
    ).toBe('https://open.bigmodel.cn/api/coding/paas/v4');
  });

  it('ignores a blank glmBaseUrl', () => {
    expect(resolveGlmBaseUrl({ glmEndpointMode: 'plan', glmBaseUrl: '   ' })).toBe(PLAN_BASE_URL);
  });
});

describe('listGlmModels', () => {
  let fetchSpy;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('maps the live /models response to {name, label, description}', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [{ id: 'glm-5.2', object: 'model' }, { id: 'glm-4.7', object: 'model' }] }),
    });

    const models = await listGlmModels({ glmApiKey: 'glm-key' });

    expect(fetchSpy).toHaveBeenCalledWith(
      `${PLAN_BASE_URL}/models`,
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer glm-key' }),
      })
    );
    expect(models.map((m) => m.name)).toEqual(['glm-5.2', 'glm-4.7']);
    expect(models[0]).toEqual({
      name: 'glm-5.2',
      label: 'glm-5.2',
      description: expect.any(String),
    });
  });

  it('returns the fallback models when the request is rejected', async () => {
    fetchSpy.mockRejectedValue(new Error('network down'));

    const models = await listGlmModels({ glmApiKey: 'glm-key' });

    expect(models.map((m) => m.name)).toEqual(FALLBACK_MODEL_NAMES);
  });

  it('returns the fallback models when the API answers 401', async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'invalid api key' } }),
    });

    const models = await listGlmModels({ glmApiKey: 'bad' });

    expect(models.map((m) => m.name)).toEqual(FALLBACK_MODEL_NAMES);
  });
});
