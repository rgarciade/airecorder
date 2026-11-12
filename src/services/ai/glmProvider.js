// Proveedor GLM (Z.AI Coding Plan). API compatible con OpenAI, reutiliza
// CustomOpenAIProvider con apiPrefix '' (la URL base de Z.AI ya incluye /v4).

import { CustomOpenAIProvider } from './customOpenAIProvider';

export const GLM_ENDPOINTS = {
  plan: 'https://api.z.ai/api/coding/paas/v4',
  general: 'https://api.z.ai/api/paas/v4',
};

// Modelos mostrados cuando /models no responde (sin conexión, clave inválida...).
export const GLM_FALLBACK_MODELS = [
  { name: 'glm-5.2', label: 'glm-5.2', description: 'GLM 5.2' },
  { name: 'glm-5-turbo', label: 'glm-5-turbo', description: 'GLM 5 Turbo' },
  { name: 'glm-4.7', label: 'glm-4.7', description: 'GLM 4.7' },
];

/**
 * Resuelve la URL base de GLM: una URL personalizada no vacía gana; si no,
 * según `glmEndpointMode` ('plan' por defecto, o 'general').
 */
export function resolveGlmBaseUrl(settings = {}) {
  const custom = (settings.glmBaseUrl || '').trim().replace(/\/+$/, '');
  if (custom) return custom;
  return settings.glmEndpointMode === 'general' ? GLM_ENDPOINTS.general : GLM_ENDPOINTS.plan;
}

export function createGlmClient(settings = {}, model = '') {
  return new CustomOpenAIProvider({
    baseUrl: resolveGlmBaseUrl(settings),
    apiPrefix: '',
    errorLabel: 'GLM',
    apiKey: settings.glmApiKey,
    model,
  });
}

/**
 * Lista los modelos de GLM; ante cualquier fallo devuelve los modelos de respaldo.
 * @returns {Promise<Array<{name:string, label:string, description:string}>>}
 */
export async function listGlmModels(settings = {}) {
  try {
    const models = await createGlmClient(settings).listModels();
    return models.length ? models : GLM_FALLBACK_MODELS;
  } catch (error) {
    console.warn('[glmProvider] No se pudo obtener la lista de modelos, usando respaldo:', error.message);
    return GLM_FALLBACK_MODELS;
  }
}
