import { describe, it, expect } from 'vitest';
import { migrateGeminiFreeTier, migrateCustomChatModelField } from '../../../../electron/utils/settingsMigrations.js';

describe('migrateCustomChatModelField — rol de IA "chat" renombrado a "general"', () => {
  it('copia customChatModel a customGeneralModel cuando el nuevo campo está vacío', () => {
    const settings = { customChatModel: 'gpt-4o-mini' };

    const changed = migrateCustomChatModelField(settings);

    expect(changed).toBe(true);
    expect(settings.customGeneralModel).toBe('gpt-4o-mini');
    expect(settings.customChatModel).toBe('gpt-4o-mini'); // clave vieja NO se borra
  });

  it('no sobreescribe customGeneralModel si ya tiene valor', () => {
    const settings = { customChatModel: 'old-model', customGeneralModel: 'new-model' };

    const changed = migrateCustomChatModelField(settings);

    expect(changed).toBe(false);
    expect(settings.customGeneralModel).toBe('new-model');
  });

  it('no hace nada si no hay customChatModel legacy', () => {
    const settings = { aiProvider: 'ollama' };

    const changed = migrateCustomChatModelField(settings);

    expect(changed).toBe(false);
    expect(settings.customGeneralModel).toBeUndefined();
  });

  it('no hace nada si customChatModel legacy está vacío', () => {
    const settings = { customChatModel: '' };

    const changed = migrateCustomChatModelField(settings);

    expect(changed).toBe(false);
    expect(settings.customGeneralModel).toBeUndefined();
  });
});

// Cobertura de regresión para la migración hermana (preexistente, sin tests hasta ahora)
describe('migrateGeminiFreeTier', () => {
  it('normaliza aiProvider y embeddingProvider de geminifree a gemini', () => {
    const settings = { aiProvider: 'geminifree', embeddingProvider: 'geminifree' };

    const changed = migrateGeminiFreeTier(settings);

    expect(changed).toBe(true);
    expect(settings.aiProvider).toBe('gemini');
    expect(settings.embeddingProvider).toBe('gemini');
  });

  it('rescata apiKey y modelo del tier free si el tier pago no estaba configurado', () => {
    const settings = { geminiFreeApiKey: 'free-key', geminiFreeModel: 'gemini-1.5-flash' };

    const changed = migrateGeminiFreeTier(settings);

    expect(changed).toBe(true);
    expect(settings.geminiApiKey).toBe('free-key');
    expect(settings.geminiModel).toBe('gemini-1.5-flash');
  });

  it('no hace nada si no hay rastros de geminifree', () => {
    const settings = { aiProvider: 'ollama' };

    const changed = migrateGeminiFreeTier(settings);

    expect(changed).toBe(false);
  });
});
