// Servicio para interactuar con Ollama local
import { getSettings } from '../settingsService';

const DEFAULT_OLLAMA_URL = 'http://localhost:11434';

// Endpoints de la API de Ollama
const OLLAMA_ENDPOINTS = {
  models:   '/api/tags',
  show:     '/api/show',
  generate: '/api/generate',
};

async function getBaseUrl(overrideUrl = null) {
  if (overrideUrl) return overrideUrl;
  try {
    const settings = await getSettings();
    return settings.ollamaHost || DEFAULT_OLLAMA_URL;
  } catch (e) {
    return DEFAULT_OLLAMA_URL;
  }
}

/**
 * Obtiene la lista de modelos disponibles en Ollama
 * @param {string} [baseUrl] - URL base opcional
 * @returns {Promise<Array>} Lista de modelos
 */
export async function getAvailableModels(baseUrl = null) {
  const url = await getBaseUrl(baseUrl);
  try {
    const response = await fetch(`${url}${OLLAMA_ENDPOINTS.models}`);

    if (!response.ok) {
      throw new Error(`Error al obtener modelos de Ollama: ${response.status}`);
    }

    const data = await response.json();
    return data.models || [];
  } catch (error) {
    console.error('Error obteniendo modelos de Ollama:', error);
    if (error.message.includes('fetch')) {
      throw new Error(`Ollama no está disponible en ${url}`);
    }
    throw error;
  }
}

/**
 * Verifica si Ollama está disponible
 * @param {string} [baseUrl] - URL base opcional
 * @returns {Promise<boolean>} true si Ollama está disponible
 */
export async function checkOllamaAvailability(baseUrl = null) {
  const url = await getBaseUrl(baseUrl);
  try {
    const response = await fetch(`${url}${OLLAMA_ENDPOINTS.models}`);
    return response.ok;
  } catch (error) {
    return false;
  }
}

/**
 * Verifica si un modelo de Ollama soporta streaming
 * Hace una llamada de prueba con stream=true y verifica la respuesta
 * @param {string} model - Nombre del modelo a verificar
 * @param {string} [baseUrl] - URL base opcional
 * @returns {Promise<boolean>} true si el modelo soporta streaming
 */
export async function checkModelSupportsStreaming(model, baseUrl = null) {
  const url = await getBaseUrl(baseUrl);
  try {
    console.log(`🔍 Verificando soporte de streaming para modelo: ${model}`);

    const response = await fetch(`${url}${OLLAMA_ENDPOINTS.generate}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt: 'Hi', stream: true }),
    });

    if (!response.ok) {
      console.log(`❌ Modelo ${model} no soporta streaming (status: ${response.status})`);
      return false;
    }

    if (response.body && response.body.getReader) {
      response.body.getReader().cancel();
      console.log(`✅ Modelo ${model} SÍ soporta streaming`);
      return true;
    }

    console.log(`❌ Modelo ${model} no soporta streaming (no hay body stream)`);
    return false;
  } catch (error) {
    console.error(`❌ Error verificando streaming para modelo ${model}:`, error.message);
    return false;
  }
}

/**
 * Obtiene información de un modelo de Ollama (context length, etc.)
 * Prioridad: num_ctx del Modelfile (configurado por usuario) > máximo nativo del modelo
 * @param {string} modelName - Nombre del modelo
 * @param {string} [baseUrl] - URL base opcional
 * @returns {Promise<{numCtx: number|null}|null>} Info del modelo o null si hay error
 */
export async function getOllamaModelInfo(modelName, baseUrl = null) {
  const url = await getBaseUrl(baseUrl);
  try {
    const response = await fetch(`${url}${OLLAMA_ENDPOINTS.show}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelName })
    });
    if (!response.ok) return null;
    const data = await response.json();
    // Prioridad: valor configurado en Modelfile > máximo nativo del modelo
    const numCtx = extractNumCtxFromParams(data.parameters)
      || data.details?.num_ctx
      || data.model_info?.['llama.context_length']
      || data.model_info?.['context_length']
      || null;
    return { numCtx };
  } catch {
    return null;
  }
}

function extractNumCtxFromParams(params) {
  if (!params) return null;
  const match = params.match(/num_ctx\s+(\d+)/);
  return match ? parseInt(match[1]) : null;
}

/**
 * Genera contenido usando un modelo de Ollama
 * Incluye reintentos automáticos para errores de red y errores 5xx
 * @param {string} model - Nombre del modelo a usar
 * @param {string} prompt - Prompt para el modelo
 * @param {Object} options - Opciones adicionales (ej: { format: 'json' })
 * @returns {Promise<string>} Respuesta generada
 */
export async function generateContent(model, prompt, options = {}) {
  const MAX_RETRIES = 3;
  const BASE_DELAY = 1000;
  const url = await getBaseUrl();

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(`${url}${OLLAMA_ENDPOINTS.generate}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt,
          stream: false,
          ...(options.format ? { format: options.format } : {})
        }),
      });

      if (response.status >= 500) {
        throw new Error(`Ollama error ${response.status} (servidor)`);
      }

      if (!response.ok) {
        throw new Error(`Error en la API de Ollama: ${response.status}`);
      }

      const data = await response.json();
      return data.response || '';
    } catch (error) {
      const isRetryable = error.message.includes('servidor') ||
                          error.message.includes('fetch') ||
                          error.message.includes('network') ||
                          error.message.includes('Failed to fetch');
      const isLastAttempt = attempt === MAX_RETRIES - 1;

      if (isRetryable && !isLastAttempt) {
        const delay = BASE_DELAY * Math.pow(2, attempt);
        console.warn(`⚠️ Ollama error. Reintentando en ${delay / 1000}s... (Intento ${attempt + 1}/${MAX_RETRIES})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      console.error('Error generando contenido con Ollama:', error);
      throw error;
    }
  }
}

/**
 * Genera contenido usando un modelo de Ollama (versión con streaming)
 */
export async function generateContentStreaming(model, prompt, onChunk) {
  const url = await getBaseUrl();
  try {
    const response = await fetch(`${url}${OLLAMA_ENDPOINTS.generate}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt, stream: true }),
    });

    if (!response.ok) {
      throw new Error(`Error en la API de Ollama: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // Guarda la última línea incompleta en el buffer

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const data = JSON.parse(line);
          if (data.response) {
            fullResponse += data.response;
            if (onChunk) onChunk(data.response);
          }
        } catch (e) {
          console.error('Error parseando chunk de Ollama:', e, 'Línea:', line);
        }
      }
    }

    if (buffer.trim()) {
       try {
          const data = JSON.parse(buffer);
          if (data.response) {
             fullResponse += data.response;
             if (onChunk) onChunk(data.response);
          }
       } catch (e) {
          console.error('Error parseando último chunk de Ollama:', e);
       }
    }

    return fullResponse;
  } catch (error) {
    console.error('Error generando contenido con Ollama (streaming):', error);
    throw error;
  }
}
