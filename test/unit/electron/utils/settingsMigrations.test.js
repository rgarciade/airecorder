import { describe, it, expect } from 'vitest';
import { migrateGeminiFreeTier, migrateCustomChatModelField, migrateWhisperModelAlias } from '../../../../electron/utils/settingsMigrations.js';

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

// Migración D7 (design.md): 'large' -> 'large-v3' es un renombrado puro, sin
// re-descarga (mismo repo de HF, misma carpeta de caché) — INV2
describe('migrateWhisperModelAlias — large -> large-v3 (design.md D7, INV2)', () => {
  it('remapea whisperModel de "large" a "large-v3"', () => {
    const settings = { whisperModel: 'large' };

    const changed = migrateWhisperModelAlias(settings);

    expect(changed).toBe(true);
    expect(settings.whisperModel).toBe('large-v3');
  });

  it('es idempotente si whisperModel ya es "large-v3"', () => {
    const settings = { whisperModel: 'large-v3' };

    const changed = migrateWhisperModelAlias(settings);

    expect(changed).toBe(false);
    expect(settings.whisperModel).toBe('large-v3');
  });

  it('no hace nada si whisperModel es otro modelo (small, medium, etc.)', () => {
    const settings = { whisperModel: 'small' };

    const changed = migrateWhisperModelAlias(settings);

    expect(changed).toBe(false);
    expect(settings.whisperModel).toBe('small');
  });

  it('no hace nada si whisperModel no está seteado', () => {
    const settings = { aiProvider: 'ollama' };

    const changed = migrateWhisperModelAlias(settings);

    expect(changed).toBe(false);
    expect(settings.whisperModel).toBeUndefined();
  });
});
