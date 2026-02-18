/**
 * Router centralizado para selección de proveedor de IA
 * Punto único de decisión entre todos los proveedores soportados
 */

import { getSettings } from '../settingsService';
import { sendToGemini, sendToGeminiStreaming } from './geminiProvider';
import { sendToDeepseek, sendToDeepseekStreaming, getDeepseekAvailableModels } from './deepseekProvider';
import { sendToKimi, sendToKimiStreaming, getKimiAvailableModels } from './kimiProvider';
import { sendToLMStudio, sendToLMStudioStreaming, getLMStudioModels } from './lmStudioProvider';
import { generateContent as ollamaGenerate, generateContentStreaming as ollamaGenerateStreaming } from './ollamaProvider';

/**
 * Envía un prompt al proveedor de IA configurado en settings
 * @param {string} prompt - Prompt completo (ya construido con contexto si aplica)
 * @param {Object} options - Opciones adicionales (ej: { format: 'json' } para Ollama)
 * @returns {Promise<{text: string, provider: string}>}
 */
export async function callProvider(prompt, options = {}) {
  const settings = await getSettings();
  const provider = settings.aiProvider || 'ollama';

  switch (provider) {
    case 'ollama': {
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

    case 'lmstudio': {
      const response = await sendToLMStudio(prompt);
      return {
        text: response || 'Sin respuesta',
        provider: 'lmstudio'
      };
    }

    case 'deepseek': {
      if (!settings.deepseekApiKey) {
        throw new Error('No se ha configurado la DeepSeek API Key en los ajustes.');
      }
      const response = await sendToDeepseek(prompt);
      return {
        text: response || 'Sin respuesta',
        provider: 'deepseek'
      };
    }

    case 'kimi': {
      if (!settings.kimiApiKey) {
        throw new Error('No se ha configurado la Kimi API Key en los ajustes.');
      }
      const response = await sendToKimi(prompt);
      return {
        text: response || 'Sin respuesta',
        provider: 'kimi'
      };
    }

    case 'gemini': {
      if (!settings.geminiApiKey) {
        throw new Error('No se ha configurado la Gemini API Key en los ajustes.');
      }
      const result = await sendToGemini(prompt, true, false); // useFreeTier = false
      const text = result?.candidates?.[0]?.content?.parts?.[0]?.text || 'Sin respuesta';
      return {
        text,
        provider: 'gemini'
      };
    }

    case 'geminifree':
    default: {
      // Gemini Free usa la misma implementación que Gemini Pro
      // Pero puede tener una API key diferente
      const apiKey = settings.geminiFreeApiKey || settings.geminiApiKey;
      if (!apiKey) {
        throw new Error('No se ha configurado la Gemini Free API Key en los ajustes.');
      }
      // Usar sendToGemini con useFreeTier = true
      const result = await sendToGemini(prompt, true, true);
      const text = result?.candidates?.[0]?.content?.parts?.[0]?.text || 'Sin respuesta';
      return {
        text,
        provider: 'geminifree'
      };
    }
  }
}

/**
 * Valida la configuración del proveedor de IA actual
 * @returns {Promise<{valid: boolean, error: string|null}>}
 */
export async function validateProviderConfig() {
  try {
    const settings = await getSettings();
    const provider = settings.aiProvider || 'geminifree';

    switch (provider) {
      case 'geminifree':
        if (!settings.geminiFreeApiKey && !settings.geminiApiKey) {
          return { valid: false, error: 'Falta configurar la Gemini Free API Key' };
        }
        break;
      case 'gemini':
        if (!settings.geminiApiKey) {
          return { valid: false, error: 'Falta configurar la Gemini API Key' };
        }
        break;
      case 'deepseek':
        if (!settings.deepseekApiKey) {
          return { valid: false, error: 'Falta configurar la DeepSeek API Key' };
        }
        break;
      case 'kimi':
        if (!settings.kimiApiKey) {
          return { valid: false, error: 'Falta configurar la Kimi API Key' };
        }
        break;
      case 'ollama':
        if (!settings.ollamaModel) {
          return { valid: false, error: 'Falta seleccionar un modelo de Ollama' };
        }
        break;
      case 'lmstudio':
        if (!settings.lmStudioModel) {
          return { valid: false, error: 'Falta seleccionar un modelo en LM Studio' };
        }
        break;
    }

    return { valid: true, error: null };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

/**
 * Envía un prompt al proveedor de IA configurado con soporte para streaming
 * Todos los proveedores soportan streaming nativamente
 * @param {string} prompt - Prompt completo (ya construido con contexto si aplica)
 * @param {Function} onChunk - Callback que recibe cada chunk de la respuesta
 * @returns {Promise<{text: string, provider: string, streaming: boolean}>}
 */
export async function callProviderStreaming(prompt, onChunk) {
  const settings = await getSettings();
  const provider = settings.aiProvider || 'geminifree';

  console.log(`[callProviderStreaming] Provider: ${provider}`);

  switch (provider) {
    case 'geminifree': {
      console.log('[callProviderStreaming] Iniciando streaming con Gemini Free');
      const fullResponse = await sendToGeminiStreaming(prompt, onChunk, true); // useFreeTier = true
      return {
        text: fullResponse || 'Sin respuesta',
        provider: 'geminifree',
        streaming: true
      };
    }

    case 'gemini': {
      console.log('[callProviderStreaming] Iniciando streaming con Gemini Pro');
      const fullResponse = await sendToGeminiStreaming(prompt, onChunk, false); // useFreeTier = false
      return {
        text: fullResponse || 'Sin respuesta',
        provider: 'gemini',
        streaming: true
      };
    }

    case 'deepseek': {
      console.log('[callProviderStreaming] Iniciando streaming con DeepSeek');
      const fullResponse = await sendToDeepseekStreaming(prompt, onChunk);
      return {
        text: fullResponse || 'Sin respuesta',
        provider: 'deepseek',
        streaming: true
      };
    }

    case 'kimi': {
      console.log('[callProviderStreaming] Iniciando streaming con Kimi');
      const fullResponse = await sendToKimiStreaming(prompt, onChunk);
      return {
        text: fullResponse || 'Sin respuesta',
        provider: 'kimi',
        streaming: true
      };
    }

    case 'lmstudio': {
      console.log('[callProviderStreaming] Iniciando streaming con LM Studio');
      const fullResponse = await sendToLMStudioStreaming(prompt, onChunk);
      return {
        text: fullResponse || 'Sin respuesta',
        provider: 'lmstudio',
        streaming: true
      };
    }

    case 'ollama': {
      // Ollama solo si el modelo lo soporta
      if (settings.ollamaModelSupportsStreaming) {
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
      console.log(`🔄 Usando modo no-streaming para Ollama`);
      const result = await callProvider(prompt);
      if (onChunk && result.text) {
        onChunk(result.text);
      }
      return {
        ...result,
        streaming: false
      };
    }

    default:
      // Fallback para cualquier otro proveedor
      console.log(`🔄 Usando modo no-streaming para ${provider}`);
      const result = await callProvider(prompt);
      if (onChunk && result.text) {
        onChunk(result.text);
      }
      return {
        ...result,
        streaming: false
      };
  }
}

// Re-exportar funciones útiles
export { getDeepseekAvailableModels, getKimiAvailableModels, getLMStudioModels };
