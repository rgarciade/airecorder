// Servicio para interactuar con LM Studio (API compatible con OpenAI)

import { getSettings } from '../settingsService';

/**
 * Obtiene los modelos disponibles en LM Studio
 * @param {string} [baseUrl] - URL base opcional (por defecto http://localhost:1234/v1)
 * @returns {Promise<Array>} Lista de modelos
 */
export async function getLMStudioModels(baseUrl = null) {
  const settings = await getSettings();
  const url = baseUrl || settings.lmStudioHost || 'http://localhost:1234/v1';
  
  try {
    const response = await fetch(`${url}/models`);
    if (!response.ok) throw new Error('LM Studio no responde');
    const data = await response.json();
    return data.data.map(m => ({
      name: m.id,
      label: m.id,
      description: 'Modelo local cargado en LM Studio'
    }));
  } catch (error) {
    console.error('Error obteniendo modelos de LM Studio:', error);
    return [];
  }
}

/**
 * Verifica si LM Studio está disponible
 * @param {string} [baseUrl] - URL base opcional
 * @returns {Promise<boolean>} true si está disponible
 */
export async function checkLMStudioAvailability(baseUrl = null) {
  const settings = await getSettings();
  const url = baseUrl || settings.lmStudioHost || 'http://localhost:1234/v1';
  try {
    const response = await fetch(`${url}/models`);
    return response.ok;
  } catch (error) {
    return false;
  }
}

/**
 * Envía una petición a LM Studio (modo normal)
 */
export async function sendToLMStudio(textContent) {
  const settings = await getSettings();
  const url = settings.lmStudioHost || 'http://localhost:1234/v1';
  const model = settings.lmStudioModel;

  if (!model) throw new Error('No hay modelo cargado o seleccionado en LM Studio');

  const response = await fetch(`${url}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: model,
      messages: [{ role: 'user', content: textContent }],
      stream: false
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`LM Studio Error: ${response.status} ${error.error?.message || ''}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

/**
 * Envía una petición a LM Studio (modo streaming)
 */
export async function sendToLMStudioStreaming(textContent, onChunk) {
  const settings = await getSettings();
  const url = settings.lmStudioHost || 'http://localhost:1234/v1';
  const model = settings.lmStudioModel;

  if (!model) throw new Error('No hay modelo cargado o seleccionado en LM Studio');

  const response = await fetch(`${url}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: model,
      messages: [{ role: 'user', content: textContent }],
      stream: true
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`LM Studio Error: ${response.status} ${error.error?.message || ''}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ') && line !== 'data: [DONE]') {
        try {
          const data = JSON.parse(line.slice(6));
          const content = data.choices[0].delta.content;
          if (content) {
            fullText += content;
            if (onChunk) onChunk(content);
          }
        } catch (e) {
          // Ignorar chunks mal formateados
        }
      }
    }
  }

  return fullText;
}
