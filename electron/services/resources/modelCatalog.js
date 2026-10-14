/**
 * Catálogo estático y versionado de modelos Whisper soportados por la app.
 * Única fuente de verdad de id/repoId/tamaño estimado para todo el sistema
 * de inventario y descargas (ver design.md — D1, D2, D3).
 *
 * `estimatedBytes` para tiny/small/medium/large-v3 fueron VERIFICADOS contra
 * `huggingface_hub.scan_cache_dir()` sobre una caché real con los 4 modelos
 * ya descargados (resuelve el "Open Question" de design.md sobre este
 * catálogo). `base` no estaba presente en esa caché de referencia — su valor
 * es una estimación por interpolación de parámetros (ratio base/tiny de
 * Whisper ≈ 1.9x, consistente con la proporción real small/tiny ≈ 6.2x).
 */

const MODEL_CATALOG = [
  { id: 'tiny', repoId: 'Systran/faster-whisper-tiny', estimatedBytes: 78_203_619, recommended: false },
  { id: 'base', repoId: 'Systran/faster-whisper-base', estimatedBytes: 148_000_000, recommended: false },
  { id: 'small', repoId: 'Systran/faster-whisper-small', estimatedBytes: 486_212_372, recommended: true },
  { id: 'medium', repoId: 'Systran/faster-whisper-medium', estimatedBytes: 1_530_571_735, recommended: false },
  { id: 'large-v3', repoId: 'Systran/faster-whisper-large-v3', estimatedBytes: 3_090_835_702, recommended: false },
];

/**
 * Devuelve el catálogo completo como copias defensivas (nunca la referencia interna).
 * @returns {Array<{id: string, repoId: string, estimatedBytes: number, recommended: boolean}>}
 */
function getModelCatalog() {
  return MODEL_CATALOG.map((entry) => ({ ...entry }));
}

/**
 * Busca una entrada del catálogo por id.
 * @param {string} id
 * @returns {{id: string, repoId: string, estimatedBytes: number, recommended: boolean}|null}
 */
function getCatalogEntry(id) {
  const entry = MODEL_CATALOG.find((model) => model.id === id);
  return entry ? { ...entry } : null;
}

module.exports = { MODEL_CATALOG, getModelCatalog, getCatalogEntry };
