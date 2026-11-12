import { useState } from 'react';
import { listGlmModels } from '../../services/ai/glmProvider';

/**
 * Estado de GLM (Z.AI Coding Plan) en el onboarding: solo clave + modelo, endpoint 'plan'.
 * Ante un fallo de /models cae a la lista de respaldo en silencio.
 */
export default function useGlmOnboarding() {
  const [glmApiKey, setGlmApiKey] = useState('');
  const [glmModels, setGlmModels] = useState([]);
  const [glmModelsLoading, setGlmModelsLoading] = useState(false);
  const [selectedGlmModel, setSelectedGlmModel] = useState('');

  const loadGlmModelsOnboarding = async (apiKey) => {
    if (!apiKey) {
      setGlmModels([]);
      return;
    }
    setGlmModelsLoading(true);
    try {
      // listGlmModels nunca lanza: ante un fallo devuelve los modelos de respaldo
      const models = await listGlmModels({ glmApiKey: apiKey, glmEndpointMode: 'plan' });
      setGlmModels(models);
      if (models.length > 0 && !selectedGlmModel) {
        setSelectedGlmModel(models[0].name);
      }
    } finally {
      setGlmModelsLoading(false);
    }
  };

  return {
    glmApiKey, setGlmApiKey,
    glmModels,
    glmModelsLoading,
    selectedGlmModel, setSelectedGlmModel,
    loadGlmModelsOnboarding,
  };
}
