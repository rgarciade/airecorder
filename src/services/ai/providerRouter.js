/**
 * Router centralizado para selección de proveedor de IA
 * Punto único de decisión entre Gemini y Ollama
 */

import { getSettings } from '../settingsService';
import { sendToGemini } from './geminiProvider';
import { generateContent as ollamaGenerate } from './ollamaProvider';

/**
 * Envía un prompt al proveedor de IA configurado en settings
 * @param {string} prompt - Prompt completo (ya construido con contexto si aplica)
 * @param {Object} options - Opciones adicionales (ej: { format: 'json' } para Ollama)
 * @returns {Promise<{text: string, provider: string}>}
 */
export async function callProvider(prompt, options = {}) {
  const settings = await getSettings();
  const provider = settings.aiProvider || 'gemini';

  if (provider === 'ollama') {
    const model = settings.ollamaModel;
    if (!model) {
      throw new Error('No se ha seleccionado un modelo de Ollama en los ajustes.');
    }
    const response = await ollamaGenerate(model, prompt, options);
    return {
      text: response || 'Sin respuesta',
      provider: 'ollama'
    };
  }

  // Gemini - siempre isRaw=true porque el prompt ya viene completo
  const result = await sendToGemini(prompt, true);
  const text = result?.candidates?.[0]?.content?.parts?.[0]?.text || 'Sin respuesta';
  return {
    text,
    provider: 'gemini'
  };
}

/**
 * Valida la configuración del proveedor de IA actual
 * @returns {Promise<{valid: boolean, error: string|null}>}
 */
export async function validateProviderConfig() {
  try {
    const settings = await getSettings();
    const provider = settings.aiProvider || 'gemini';

    if (provider === 'gemini' && !settings.geminiApiKey) {
      return { valid: false, error: 'Falta configurar la Gemini API Key' };
    }
    if (provider === 'ollama' && !settings.ollamaModel) {
      return { valid: false, error: 'Falta seleccionar un modelo de Ollama' };
    }

    return { valid: true, error: null };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}
