/**
 * Router centralizado para selección de proveedor de IA
 * Punto único de decisión entre Gemini y Ollama
 */

import { getSettings } from '../settingsService';
import { sendToGemini, sendToGeminiStreaming } from './geminiProvider';
import { generateContent as ollamaGenerate, generateContentStreaming as ollamaGenerateStreaming } from './ollamaProvider';

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

/**
 * Envía un prompt al proveedor de IA configurado con soporte para streaming
 * Gemini y Ollama (si el modelo lo soporta) usan streaming
 * @param {string} prompt - Prompt completo (ya construido con contexto si aplica)
 * @param {Function} onChunk - Callback que recibe cada chunk de la respuesta
 * @returns {Promise<{text: string, provider: string, streaming: boolean}>}
 */
export async function callProviderStreaming(prompt, onChunk) {
  const settings = await getSettings();
  const provider = settings.aiProvider || 'gemini';
  
  console.log(`[callProviderStreaming] Provider: ${provider}`);

  // Gemini siempre soporta streaming nativamente
  if (provider === 'gemini') {
    console.log('[callProviderStreaming] Iniciando streaming con Gemini');
    const fullResponse = await sendToGeminiStreaming(prompt, onChunk);
    return {
      text: fullResponse || 'Sin respuesta',
      provider: 'gemini',
      streaming: true
    };
  }

  // Ollama solo si el modelo lo soporta
  if (provider === 'ollama' && settings.ollamaModelSupportsStreaming) {
    const model = settings.ollamaModel;
    if (!model) {
      throw new Error('No se ha seleccionado un modelo de Ollama en los ajustes.');
    }

    console.log(`[callProviderStreaming] Iniciando streaming con Ollama modelo: ${model}`);
    const fullResponse = await ollamaGenerateStreaming(model, prompt, onChunk);
    return {
      text: fullResponse || 'Sin respuesta',
      provider: 'ollama',
      streaming: true
    };
  }

  // Fallback: modo normal sin streaming
  console.log(`🔄 Usando modo no-streaming para ${provider}`);
  const result = await callProvider(prompt);
  if (onChunk && result.text) {
    // Simular streaming llamando al callback con el texto completo
    onChunk(result.text);
  }
  return {
    ...result,
    streaming: false
  };
}
