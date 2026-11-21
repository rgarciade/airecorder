import { describe, it, expect } from 'vitest';
import { getModelCatalog, getCatalogEntry } from '../../../../../electron/services/resources/modelCatalog.js';

describe('modelCatalog — catálogo versionado de modelos Whisper', () => {
  it('expone los 5 modelos soportados: tiny/base/small/medium/large-v3', () => {
    const catalog = getModelCatalog();
    const ids = catalog.map((model) => model.id);
    expect(ids).toEqual(['tiny', 'base', 'small', 'medium', 'large-v3']);
  });

  it('cada modelo expone id/repoId/estimatedBytes/recommended', () => {
    const catalog = getModelCatalog();
    catalog.forEach((model) => {
      expect(typeof model.id).toBe('string');
      expect(typeof model.repoId).toBe('string');
      expect(model.repoId).toMatch(/^[\w.-]+\/[\w.-]+$/); // formato org/repo de Hugging Face
      expect(typeof model.estimatedBytes).toBe('number');
      expect(model.estimatedBytes).toBeGreaterThan(0);
      expect(typeof model.recommended).toBe('boolean');
    });
  });

  it('marca únicamente "small" como recomendado', () => {
    const catalog = getModelCatalog();
    const recommended = catalog.filter((model) => model.recommended);
    expect(recommended).toHaveLength(1);
    expect(recommended[0].id).toBe('small');
  });

  it('getCatalogEntry devuelve la entrada exacta por id', () => {
    const entry = getCatalogEntry('medium');
    expect(entry.id).toBe('medium');
    expect(entry.repoId).toBe('Systran/faster-whisper-medium');
  });

  it('getCatalogEntry devuelve null para un id desconocido', () => {
    expect(getCatalogEntry('nonexistent')).toBeNull();
  });

  it('getModelCatalog devuelve copias, no la referencia interna (inmutabilidad defensiva)', () => {
    const catalog = getModelCatalog();
    catalog[0].estimatedBytes = 999;
    const catalogAgain = getModelCatalog();
    expect(catalogAgain[0].estimatedBytes).not.toBe(999);
  });
});
