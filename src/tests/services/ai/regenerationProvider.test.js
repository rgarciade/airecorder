import { describe, expect, it, vi } from 'vitest';
import {
  REGENERATION_PROVIDER_OPTIONS,
  buildRegenerationProviderOverrides,
  canUseRegenerationProvider,
  getCodexRegenerationStatus,
} from '../../../services/ai/regenerationProvider';

describe('regenerationProvider', () => {
  it('offers Codex for generative regeneration only when the subscription is usable', () => {
    expect(REGENERATION_PROVIDER_OPTIONS).toContainEqual({
      value: 'codex',
      label: 'Codex (ChatGPT subscription)',
    });
    expect(canUseRegenerationProvider('codex', {
      codexStatus: { available: true, connected: true },
    })).toBe(true);
    expect(canUseRegenerationProvider('codex', {
      codexStatus: { available: true, connected: false },
    })).toBe(false);
    expect(canUseRegenerationProvider('codex', {
      codexStatus: { available: false, connected: false },
    })).toBe(false);
  });

  it('checks the Codex session without loading or refreshing its model catalog', async () => {
    const electronAPI = {
      getCodexStatus: vi.fn().mockResolvedValue({ available: true, connected: true }),
      listCodexModels: vi.fn(),
    };

    await expect(getCodexRegenerationStatus(electronAPI)).resolves.toEqual({
      available: true,
      connected: true,
    });
    expect(electronAPI.getCodexStatus).toHaveBeenCalledOnce();
    expect(electronAPI.listCodexModels).not.toHaveBeenCalled();
  });

  it('propagates the saved Codex model and reasoning effort to every regeneration call', () => {
    expect(buildRegenerationProviderOverrides({
      provider: 'codex',
      settings: {
        codexModel: 'gpt-5.6-sol',
        codexReasoningEffort: 'high',
      },
    })).toEqual({
      providerOverride: 'codex',
      model: 'gpt-5.6-sol',
      codexReasoningEffort: 'high',
    });
  });

  it('does not leak Codex overrides into other providers', () => {
    expect(buildRegenerationProviderOverrides({
      provider: 'openai',
      settings: {
        codexModel: 'gpt-5.6-sol',
        codexReasoningEffort: 'high',
      },
    })).toEqual({ providerOverride: 'openai' });
  });

  it('preserves saved model overrides for providers that already supported regeneration', () => {
    expect(buildRegenerationProviderOverrides({
      provider: 'ollama',
      settings: { ollamaModel: 'llama-saved' },
    })).toEqual({ providerOverride: 'ollama', model: 'llama-saved' });
    expect(buildRegenerationProviderOverrides({
      provider: 'lmstudio',
      settings: { lmStudioModel: 'lm-saved' },
    })).toEqual({ providerOverride: 'lmstudio', model: 'lm-saved' });
    expect(buildRegenerationProviderOverrides({
      provider: 'custom:one',
      settings: { customGeneralModel: 'custom-saved' },
    })).toEqual({ providerOverride: 'custom:one', model: 'custom-saved' });
  });
});
