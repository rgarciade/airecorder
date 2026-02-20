// Servicio para interactuar con la API de DeepSeek

import { getSettings } from '../settingsService';

const DEEPSEEK_API_BASE = 'https://api.deepseek.com/v1';

// Modelos DeepSeek disponibles
const DEEPSEEK_MODELS = [
  { name: 'deepseek-chat', label: 'DeepSeek Chat (v3)', description: 'Modelo general para chat y tareas cotidianas' },
  { name: 'deepseek-reasoner', label: 'DeepSeek Reasoner', description: 'Modelo optimizado para razonamiento complejo' },
  { name: 'deepseek-coder', label: 'DeepSeek Coder', description: 'Especializado en generación de código' }
];

/**
 * Obtiene la lista de modelos DeepSeek disponibles
 * @returns {Array} Lista de modelos
 */
export function getDeepseekAvailableModels() {
  return DEEPSEEK_MODELS;
}

/**
 * Envía el texto a DeepSeek con manejo de reintentos
 * @param {string} textContent - El contenido a enviar
 * @returns {Promise<string>} - Respuesta generada
 */
export async function sendToDeepseek(textContent, modelOverride = null) {
  const MAX_RETRIES = 3;
  const BASE_DELAY = 2000;

  const settings = await getSettings();
  const apiKey = settings.deepseekApiKey;
  const model = modelOverride || settings.deepseekModel || 'deepseek-chat';

  if (!apiKey) {
    throw new Error('No se ha configurado la DeepSeek API Key en los ajustes.');
  }

  const body = {
    model: model,
    messages: [
      { role: 'user', content: textContent }
    ],
    stream: false
  };

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(`${DEEPSEEK_API_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (response.status === 429) {
        throw new Error('429 Too Many Requests');
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Error en la API de DeepSeek: ${response.status} ${errorData.error?.message || ''}`);
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content || 'Sin respuesta';

    } catch (error) {
      const isLastAttempt = attempt === MAX_RETRIES - 1;

      if (error.message.includes('429') && !isLastAttempt) {
        const delay = BASE_DELAY * Math.pow(2, attempt);
        console.warn(`⚠️ DeepSeek 429 (Límite excedido). Reintentando en ${delay/1000}s... (Intento ${attempt + 1}/${MAX_RETRIES})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      console.error('Error enviando a DeepSeek:', error);
      throw error;
    }
  }
}

/**
 * Envía el texto a DeepSeek en modo streaming
 * @param {string} textContent - El contenido a enviar
 * @param {Function} onChunk - Callback que recibe cada chunk de texto
 * @returns {Promise<string>} - Texto completo de la respuesta
 */
export async function sendToDeepseekStreaming(textContent, onChunk, modelOverride = null) {
  const MAX_RETRIES = 3;
  const BASE_DELAY = 2000;

  console.log('[DeepSeek] Iniciando petición streaming...');

  const settings = await getSettings();
  const apiKey = settings.deepseekApiKey;
  const model = modelOverride || settings.deepseekModel || 'deepseek-chat';

  if (!apiKey) {
    console.error('[DeepSeek] Falta API Key');
    throw new Error('No se ha configurado la DeepSeek API Key en los ajustes.');
  }

  const body = {
    model: model,
    messages: [
      { role: 'user', content: textContent }
    ],
    stream: true
  };

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      console.log(`[DeepSeek] Llamando a la API (Intento ${attempt + 1})...`);
      const response = await fetch(`${DEEPSEEK_API_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });

      console.log(`[DeepSeek] Respuesta recibida: ${response.status} ${response.statusText}`);

      if (response.status === 429) {
        throw new Error('429 Too Many Requests');
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[DeepSeek] Error API:', errorData);
        throw new Error(`Error en la API de DeepSeek: ${response.status} ${errorData.error?.message || ''}`);
      }

      // Procesar el stream SSE
      console.log('[DeepSeek] Empezando a leer stream...');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            const dataStr = trimmed.slice(6);
            if (dataStr === '[DONE]') continue;

            try {
              const data = JSON.parse(dataStr);
              const chunk = data.choices?.[0]?.delta?.content || '';
              if (chunk) {
                fullResponse += chunk;
                if (onChunk) onChunk(chunk);
              }
            } catch (e) {
              // Ignorar líneas que no son JSON válido
            }
          }
        }
      }

      return fullResponse;

    } catch (error) {
      const isLastAttempt = attempt === MAX_RETRIES - 1;

      if (error.message.includes('429') && !isLastAttempt) {
        const delay = BASE_DELAY * Math.pow(2, attempt);
        console.warn(`⚠️ DeepSeek 429 (Límite excedido). Reintentando en ${delay/1000}s... (Intento ${attempt + 1}/${MAX_RETRIES})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      console.error('Error en streaming de DeepSeek:', error);
      throw error;
    }
  }
}
