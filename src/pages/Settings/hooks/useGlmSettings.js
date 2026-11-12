import { useState } from 'react';
import { fetchGlmModels, GLM_FALLBACK_MODELS } from '../../../services/ai/glmProvider';

/**
 * Estado y carga de modelos de GLM (Z.AI Coding Plan) para Ajustes.
 * @param {(key: string) => string} t - Función de traducción.
 */
export default function useGlmSettings(t) {
  const [glmApiKey, setGlmApiKey] = useState('');
  const [glmModel, setGlmModel] = useState('');
  const [glmModels, setGlmModels] = useState([]);
  const [glmModelsLoading, setGlmModelsLoading] = useState(false);
  const [glmModelsNotice, setGlmModelsNotice] = useState('');
  const [glmEndpointMode, setGlmEndpointMode] = useState('plan');
  const [glmBaseUrl, setGlmBaseUrl] = useState('');

  /**
   * Carga los modelos de GLM. Si /models falla, `fetchGlmModels` devuelve los modelos
   * de respaldo (`isFallback`) y se muestra un aviso no bloqueante.
   * @param {string} apiKey
   * @param {{glmEndpointMode?: string, glmBaseUrl?: string}} [overrides] - Ajustes de endpoint
   *   (por defecto, el estado actual).
   */
  const loadGlmModels = async (apiKey, overrides = {}) => {
    if (!apiKey) {
      setGlmModels([]);
      setGlmModelsNotice('');
      return;
    }

    setGlmModelsLoading(true);
    setGlmModelsNotice('');

    try {
      const { models, isFallback } = await fetchGlmModels({
        glmApiKey: apiKey,
        glmEndpointMode: overrides.glmEndpointMode ?? glmEndpointMode,
        glmBaseUrl: overrides.glmBaseUrl ?? glmBaseUrl,
      });
      setGlmModels(models);
      setGlmModelsNotice(isFallback ? t('settings.providers.glmModelsFallback') : '');
      setGlmModel((current) => {
        const currentModelExists = models.some(m => m.name === current);
        return currentModelExists || models.length === 0 ? current : models[0].name;
      });
    } catch (error) {
      console.error('Error cargando modelos de GLM:', error);
      setGlmModels(GLM_FALLBACK_MODELS);
      setGlmModelsNotice(t('settings.providers.glmModelsFallback'));
    } finally {
      setGlmModelsLoading(false);
    }
  };

  return {
    glmApiKey, setGlmApiKey,
    glmModel, setGlmModel,
    glmModels,
    glmModelsLoading,
    glmModelsNotice,
    loadGlmModels,
    glmEndpointMode, setGlmEndpointMode,
    glmBaseUrl, setGlmBaseUrl,
  };
}
