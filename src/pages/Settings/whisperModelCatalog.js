/**
 * Catálogo dinámico de modelos Whisper para `SettingsContext.jsx` (PR2, Fase 1).
 *
 * Reemplaza la lista estática hardcodeada que vivía antes en
 * `SettingsContext.jsx` (L27-33) por datos obtenidos vía el IPC
 * `resources.list()` — única fuente de verdad para el inventario de modelos
 * (INV1/INV6, `design.md` — contrato IPC `resources:*`).
 *
 * Extraído a un módulo aparte (en vez de testear el provider gigante
 * completo) porque `SettingsContext.jsx` orquesta ~10 servicios distintos
 * (audio, settings, ollama, gemini, lmStudio, openai custom, codex...);
 * renderizar el provider real exigiría 7+ mocks solo para esta pieza de
 * lógica — la regla "Extract-Before-Mock" de strict-tdd.md aplica: se separa
 * la lógica pura/aislada y se testea sin necesidad de montar React.
 */

/**
 * Obtiene el catálogo de modelos desde el proceso main vía IPC
 * `resources.list()`. Degrada con gracia a un array vacío si el IPC no está
 * disponible, si el handler devuelve `ok:false`, o si la llamada falla —
 * nunca lanza (mismo criterio que el resto de `SettingsContext.jsx`).
 *
 * @param {object|undefined} electronAPI - `window.electronAPI` (o mock en tests)
 * @returns {Promise<Array>} lista de `ResourceItem` (id/repoId/estimatedBytes/state/...)
 */
export async function fetchModelCatalog(electronAPI) {
  try {
    const result = await electronAPI?.resources?.list?.();
    return result?.ok && Array.isArray(result.items) ? result.items : [];
  } catch (error) {
    console.warn('No se pudo obtener el catálogo de modelos Whisper vía IPC:', error?.message || error);
    return [];
  }
}

/**
 * Deriva las opciones `{value,label}` para selectores (patrón `mockLanguages`/
 * `fontSizes`) a partir del catálogo dinámico, en vez de una lista fija.
 *
 * @param {Array} catalogItems - items del catálogo (`ResourceItem[]`)
 * @param {(key: string) => string} t - función de traducción (i18next)
 * @returns {Array<{value: string, label: string}>}
 */
export function computeWhisperModelOptions(catalogItems, t) {
  if (!Array.isArray(catalogItems)) return [];
  return catalogItems.map((item) => ({
    value: item.id,
    label: t(`settings.whisperModels.${item.id}`),
  }));
}
