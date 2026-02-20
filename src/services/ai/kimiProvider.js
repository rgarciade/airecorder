// Servicio para interactuar con la API de Kimi (Moonshot AI)

import { getSettings } from '../settingsService';

const KIMI_API_BASE = 'https://api.moonshot.ai/v1';

// Modelos Kimi disponibles
const KIMI_MODELS = [
  { name: 'kimi-k2', label: 'Kimi K2', description: 'Modelo base con 1T parámetros, contexto 128K' },
  { name: 'kimi-k2-turbo-preview', label: 'Kimi K2 Turbo', description: 'Versión rápida, contexto 256K' },
  { name: 'kimi-k2.5', label: 'Kimi K2.5', description: 'Última versión multimodal' }
];

/**
 * Obtiene la lista de modelos Kimi disponibles
 * @returns {Array} Lista de modelos
 */
export function getKimiAvailableModels() {
  return KIMI_MODELS;
}

/**
 * Envía el texto a Kimi con manejo de reintentos
 * @param {string} textContent - El contenido a enviar
 * @returns {Promise<string>} - Respuesta generada
 */
export async function sendToKimi(textContent, modelOverride = null) {
  const MAX_RETRIES = 3;
  const BASE_DELAY = 2000;

  const settings = await getSettings();
  const apiKey = settings.kimiApiKey;
  const model = modelOverride || settings.kimiModel || 'kimi-k2';

  if (!apiKey) {
    throw new Error('No se ha configurado la Kimi API Key en los ajustes.');
  }

  const body = {
    model: model,
    messages: [
      { role: 'system', content: 'You are Kimi, an AI assistant provided by Moonshot AI. You are proficient in Chinese and English conversations. You provide users with safe, helpful, and accurate answers.' },
      { role: 'user', content: textContent }
    ],
    stream: false
  };

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(`${KIMI_API_BASE}/chat/completions`, {
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
        throw new Error(`Error en la API de Kimi: ${response.status} ${errorData.error?.message || ''}`);
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content || 'Sin respuesta';

    } catch (error) {
      const isLastAttempt = attempt === MAX_RETRIES - 1;

      if (error.message.includes('429') && !isLastAttempt) {
        const delay = BASE_DELAY * Math.pow(2, attempt);
        console.warn(`⚠️ Kimi 429 (Límite excedido). Reintentando en ${delay/1000}s... (Intento ${attempt + 1}/${MAX_RETRIES})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      console.error('Error enviando a Kimi:', error);
      throw error;
    }
  }
}

/**
 * Envía el texto a Kimi en modo streaming
 * @param {string} textContent - El contenido a enviar
 * @param {Function} onChunk - Callback que recibe cada chunk de texto
 * @returns {Promise<string>} - Texto completo de la respuesta
 */
export async function sendToKimiStreaming(textContent, onChunk, modelOverride = null) {
  const MAX_RETRIES = 3;
  const BASE_DELAY = 2000;

  console.log('[Kimi] Iniciando petición streaming...');

  const settings = await getSettings();
  const apiKey = settings.kimiApiKey;
  const model = modelOverride || settings.kimiModel || 'kimi-k2';

  if (!apiKey) {
    console.error('[Kimi] Falta API Key');
    throw new Error('No se ha configurado la Kimi API Key en los ajustes.');
  }

  const body = {
    model: model,
    messages: [
      { role: 'system', content: 'You are Kimi, an AI assistant provided by Moonshot AI. You are proficient in Chinese and English conversations. You provide users with safe, helpful, and accurate answers.' },
      { role: 'user', content: textContent }
    ],
    stream: true
  };

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      console.log(`[Kimi] Llamando a la API (Intento ${attempt + 1})...`);
      const response = await fetch(`${KIMI_API_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });

      console.log(`[Kimi] Respuesta recibida: ${response.status} ${response.statusText}`);

      if (response.status === 429) {
        throw new Error('429 Too Many Requests');
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[Kimi] Error API:', errorData);
        throw new Error(`Error en la API de Kimi: ${response.status} ${errorData.error?.message || ''}`);
      }

      // Procesar el stream SSE
      console.log('[Kimi] Empezando a leer stream...');
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
        console.warn(`⚠️ Kimi 429 (Límite excedido). Reintentando en ${delay/1000}s... (Intento ${attempt + 1}/${MAX_RETRIES})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      console.error('Error en streaming de Kimi:', error);
      throw error;
    }
  }
}
