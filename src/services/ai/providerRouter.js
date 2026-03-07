/**
 * Router centralizado para selección de proveedor de IA
 * Punto único de decisión entre todos los proveedores soportados.
 * Todas las llamadas pasan por aiQueueService para serializarse y ser observables.
 */

import { getSettings } from '../settingsService';
import { sendToGemini, sendToGeminiStreaming } from './geminiProvider';
import { sendToDeepseek, sendToDeepseekStreaming, getDeepseekAvailableModels } from './deepseekProvider';
import { sendToKimi, sendToKimiStreaming, getKimiAvailableModels } from './kimiProvider';
import { sendToLMStudio, sendToLMStudioStreaming, getLMStudioModels } from './lmStudioProvider';
import { generateContent as ollamaGenerate, generateContentStreaming as ollamaGenerateStreaming } from './ollamaProvider';
import { aiQueueService, AI_TASK_TYPES } from './aiQueueService';

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

/**
 * Resuelve el nombre legible del motor de IA activo para mostrarlo en la cola.
 */
function _resolveEngineName(settings, provider, options = {}) {
  if (provider === 'ollama') {
    const model = options?.model || options?.ragModel || settings.ollamaModel || '';
    return model ? `Ollama: ${model}` : 'Ollama';
  }
  if (provider === 'lmstudio') {
    const model = options?.model || options?.ragModel || settings.lmStudioModel || '';
    return model ? `LM Studio: ${model}` : 'LM Studio';
  }
  if (provider === 'deepseek') return 'DeepSeek';
  if (provider === 'kimi') return 'Kimi';
  if (provider === 'gemini') return 'Gemini Pro';
  if (provider === 'geminifree') return 'Gemini Free';
  return provider || 'IA';
}

/**
 * Lógica real de callProvider (sin cola). Se ejecuta dentro de la tarea encolada.
 */
async function _runCallProvider(prompt, options) {
  const settings = await getSettings();
  const provider = settings.aiProvider || 'ollama';

  switch (provider) {
    case 'ollama': {
      const model = options.model || options.ragModel || settings.ollamaModel;
      if (!model) throw new Error('No se ha seleccionado un modelo de Ollama en los ajustes.');
      const response = await ollamaGenerate(model, prompt, options);
      return { text: response || 'Sin respuesta', provider: 'ollama', model };
    }

    case 'lmstudio': {
      const model = options.model || options.ragModel || settings.lmStudioModel;
      if (!model) throw new Error('No se ha seleccionado un modelo en LM Studio.');
      const response = await sendToLMStudio(prompt, model);
      return { text: response || 'Sin respuesta', provider: 'lmstudio', model };
    }

    case 'deepseek': {
      if (!settings.deepseekApiKey) throw new Error('No se ha configurado la DeepSeek API Key en los ajustes.');
      const response = await sendToDeepseek(prompt, options.model || null);
      return { text: response || 'Sin respuesta', provider: 'deepseek' };
    }

    case 'kimi': {
      if (!settings.kimiApiKey) throw new Error('No se ha configurado la Kimi API Key en los ajustes.');
      const response = await sendToKimi(prompt, options.model || null);
      return { text: response || 'Sin respuesta', provider: 'kimi' };
    }

    case 'gemini': {
      if (!settings.geminiApiKey) throw new Error('No se ha configurado la Gemini API Key en los ajustes.');
      const result = await sendToGemini(prompt, true, false);
      const text = result?.candidates?.[0]?.content?.parts?.[0]?.text || 'Sin respuesta';
      return { text, provider: 'gemini' };
    }

    case 'geminifree':
    default: {
      const apiKey = settings.geminiFreeApiKey || settings.geminiApiKey;
      if (!apiKey) throw new Error('No se ha configurado la Gemini Free API Key en los ajustes.');
      const result = await sendToGemini(prompt, true, true);
      const text = result?.candidates?.[0]?.content?.parts?.[0]?.text || 'Sin respuesta';
      return { text, provider: 'geminifree' };
    }
  }
}

/**
 * Lógica real de callProviderStreaming (sin cola). Se ejecuta dentro de la tarea encolada.
 */
async function _runCallProviderStreaming(prompt, onChunk, options) {
  const settings = await getSettings();
  const provider = settings.aiProvider || 'geminifree';

  console.log(`[callProviderStreaming] Provider: ${provider}`);

  switch (provider) {
    case 'geminifree': {
      console.log('[callProviderStreaming] Iniciando streaming con Gemini Free');
      const fullResponse = await sendToGeminiStreaming(prompt, onChunk, true);
      return { text: fullResponse || 'Sin respuesta', provider: 'geminifree', streaming: true };
    }

    case 'gemini': {
      console.log('[callProviderStreaming] Iniciando streaming con Gemini Pro');
      const fullResponse = await sendToGeminiStreaming(prompt, onChunk, false);
      return { text: fullResponse || 'Sin respuesta', provider: 'gemini', streaming: true };
    }

    case 'deepseek': {
      console.log('[callProviderStreaming] Iniciando streaming con DeepSeek');
      const fullResponse = await sendToDeepseekStreaming(prompt, onChunk, options.model || null);
      return { text: fullResponse || 'Sin respuesta', provider: 'deepseek', streaming: true };
    }

    case 'kimi': {
      console.log('[callProviderStreaming] Iniciando streaming con Kimi');
      const fullResponse = await sendToKimiStreaming(prompt, onChunk, options.model || null);
      return { text: fullResponse || 'Sin respuesta', provider: 'kimi', streaming: true };
    }

    case 'lmstudio': {
      const model = options.model || options.ragModel || settings.lmStudioModel;
      if (!model) throw new Error('No se ha seleccionado un modelo en LM Studio.');
      console.log(`[callProviderStreaming] Iniciando streaming con LM Studio modelo: ${model}`);
      const fullResponse = await sendToLMStudioStreaming(prompt, onChunk, model);
      return { text: fullResponse || 'Sin respuesta', provider: 'lmstudio', model, streaming: true };
    }

    case 'ollama': {
      const model = options.model || options.ragModel || settings.ollamaModel;
      if (!model) throw new Error('No se ha seleccionado un modelo de Ollama en los ajustes.');

      const useStreaming = settings.ollamaModelSupportsStreaming && !options.ragModel;

      if (useStreaming) {
        console.log(`[callProviderStreaming] Iniciando streaming con Ollama modelo: ${model}`);
        const fullResponse = await ollamaGenerateStreaming(model, prompt, onChunk);
        return { text: fullResponse || 'Sin respuesta', provider: 'ollama', model, streaming: true };
      }

      // Fallback no-streaming
      console.log(`🔄 Usando modo no-streaming para Ollama${options.ragModel ? ` (RAG model: ${model})` : ''}`);
      const result = await _runCallProvider(prompt, options);
      if (onChunk && result.text) onChunk(result.text);
      return { ...result, streaming: false };
    }

    default: {
      console.log(`🔄 Usando modo no-streaming para ${provider}`);
      const result = await _runCallProvider(prompt, options);
      if (onChunk && result.text) onChunk(result.text);
      return { ...result, streaming: false };
    }
  }
}

// ---------------------------------------------------------------------------
// API pública — pasan por la cola
// ---------------------------------------------------------------------------

/**
 * Envía un prompt al proveedor de IA configurado.
 * La llamada se encola y se ejecuta en orden FIFO.
 *
 * @param {string} prompt - Prompt completo
 * @param {Object} options - Opciones adicionales.
 *   options.queueMeta?: { name?: string, type?: string, engine?: string }
 *   para personalizar cómo aparece en la cola de la UI.
 * @returns {Promise<{text: string, provider: string}>}
 */
export async function callProvider(prompt, options = {}) {
  // Leer settings para resolver nombre del motor (display inmediato en la cola)
  let engine = 'IA';
  try {
    const settings = await getSettings();
    const provider = settings.aiProvider || 'geminifree';
    engine = _resolveEngineName(settings, provider, options);
  } catch {
    // Si falla la lectura, usamos el fallback
  }

  const meta = {
    name: options.queueMeta?.name || 'Llamada a IA',
    type: options.queueMeta?.type || AI_TASK_TYPES.GENERAL,
    engine: options.queueMeta?.engine || engine,
  };

  return aiQueueService.enqueue(() => _runCallProvider(prompt, options), meta);
}

/**
 * Envía un prompt al proveedor de IA configurado con soporte para streaming.
 * La llamada se encola; onChunk se invoca en tiempo real mientras la tarea está activa.
 *
 * @param {string} prompt - Prompt completo
 * @param {Function} onChunk - Callback que recibe cada chunk de la respuesta
 * @param {Object} options - Opciones adicionales (igual que callProvider)
 * @returns {Promise<{text: string, provider: string, streaming: boolean}>}
 */
export async function callProviderStreaming(prompt, onChunk, options = {}) {
  let engine = 'IA';
  try {
    const settings = await getSettings();
    const provider = settings.aiProvider || 'geminifree';
    engine = _resolveEngineName(settings, provider, options);
  } catch {
    // fallback
  }

  const meta = {
    name: options.queueMeta?.name || 'Chat con IA',
    type: options.queueMeta?.type || AI_TASK_TYPES.CHAT,
    engine: options.queueMeta?.engine || engine,
  };

  return aiQueueService.enqueue(
    () => _runCallProviderStreaming(prompt, onChunk, options),
    meta
  );
}

/**
 * Valida la configuración del proveedor de IA actual.
 * @returns {Promise<{valid: boolean, error: string|null}>}
 */
export async function validateProviderConfig() {
  try {
    const settings = await getSettings();
    const provider = settings.aiProvider || 'geminifree';

    switch (provider) {
      case 'geminifree':
        if (!settings.geminiFreeApiKey && !settings.geminiApiKey)
          return { valid: false, error: 'Falta configurar la Gemini Free API Key' };
        break;
      case 'gemini':
        if (!settings.geminiApiKey)
          return { valid: false, error: 'Falta configurar la Gemini API Key' };
        break;
      case 'deepseek':
        if (!settings.deepseekApiKey)
          return { valid: false, error: 'Falta configurar la DeepSeek API Key' };
        break;
      case 'kimi':
        if (!settings.kimiApiKey)
          return { valid: false, error: 'Falta configurar la Kimi API Key' };
        break;
      case 'ollama':
        if (!settings.ollamaModel)
          return { valid: false, error: 'Falta seleccionar un modelo de Ollama' };
        break;
      case 'lmstudio':
        if (!settings.lmStudioModel)
          return { valid: false, error: 'Falta seleccionar un modelo en LM Studio' };
        break;
    }

    return { valid: true, error: null };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

// Re-exportar funciones útiles de proveedores
export { getDeepseekAvailableModels, getKimiAvailableModels, getLMStudioModels };
