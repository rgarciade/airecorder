/**
 * whisperModelGuard.js — lógica pura compartida para el hardening "solo
 * instalados" de los 4 selectores/puntos de transcripción de modelos
 * Whisper (INV6, design.md — "Fuente única para los 4 selectores").
 *
 * Extraído como módulo puro (Extract-Before-Mock, strict-tdd.md) en vez de
 * duplicar la misma decisión en `Home.jsx`, `RecordingOverlay.jsx` y
 * `RecordingDetailWithTranscription.jsx` — varios de ellos con 7+
 * dependencias externas que harían el montaje completo del componente
 * violar la regla de higiene de mocks. Mismo criterio ya usado en PR2 para
 * `whisperModelCatalog.js`/`formatBytes.js`.
 */

/**
 * @param {Array|null|undefined} items - `ResourceItem[]` del snapshot de `resources.list()`
 * @param {string|null|undefined} modelId
 * @returns {boolean} `true` solo si el modelo existe en el catálogo y su estado es `installed`.
 */
export function isModelInstalled(items, modelId) {
  if (!Array.isArray(items) || !modelId) return false;
  const item = items.find((entry) => entry.id === modelId);
  return item?.state === 'installed';
}

/**
 * @param {Array|null|undefined} items
 * @returns {boolean} `true` si al menos un modelo del catálogo está instalado.
 */
export function hasAnyInstalledModel(items) {
  return Array.isArray(items) && items.some((entry) => entry.state === 'installed');
}

/**
 * Deriva las opciones de un `<select>` a partir del catálogo dinámico:
 * TODAS visibles (para que el usuario sepa qué existe), pero los modelos no
 * instalados quedan `disabled` — "atenuados" — con una etiqueta distinta que
 * indica que hace falta ir a Ajustes a descargarlos (INV6). Nunca dispara
 * una descarga: solo describe cómo debe renderizarse cada `<option>`.
 *
 * @param {Array|null|undefined} items
 * @param {(key: string, opts?: object) => string} t - función de traducción (i18next)
 * @returns {Array<{value: string, label: string, disabled: boolean}>}
 */
export function buildSelectableModelOptions(items, t) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => {
    const installed = item.state === 'installed';
    const baseLabel = t(`settings.whisperModels.${item.id}`);
    return {
      value: item.id,
      label: installed ? baseLabel : t('settings.whisperModels.notInstalledSuffix', { model: baseLabel }),
      disabled: !installed,
    };
  });
}
