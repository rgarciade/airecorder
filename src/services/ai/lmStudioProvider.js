// Servicio para interactuar con LM Studio (API compatible con OpenAI)
import { getSettings } from '../settingsService';

// Endpoints de la API de LM Studio (OpenAI-compat)
const LM_STUDIO_ENDPOINTS = {
  models:          '/v1/models',
  chatCompletions: '/v1/chat/completions',
  completions:     '/v1/completions',
  embeddings:      '/v1/embeddings',
  responses:       '/v1/responses',
};

/**
 * Normaliza la URL base de LM Studio: elimina el sufijo /v1 si está presente.
 * Los paths siempre se añaden explícitamente desde LM_STUDIO_ENDPOINTS.
 */
function normalizeBaseUrl(url) {
  return url.replace(/\/v1\/?$/, '').replace(/\/$/, '');
}

async function getBaseUrl(overrideUrl = null) {
  if (overrideUrl) return normalizeBaseUrl(overrideUrl);
  try {
    const settings = await getSettings();
    return normalizeBaseUrl(settings.lmStudioHost || 'http://localhost:1234');
  } catch (e) {
    return 'http://localhost:1234';
  }
}

/**
 * Obtiene los modelos disponibles en LM Studio
 * @param {string} [baseUrl] - URL base opcional (por defecto http://localhost:1234)
 * @returns {Promise<Array>} Lista de modelos
 */
export async function getLMStudioModels(baseUrl = null) {
  const url = await getBaseUrl(baseUrl);
  try {
    const response = await fetch(`${url}${LM_STUDIO_ENDPOINTS.models}`);
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
 * Obtiene información de contexto de un modelo de LM Studio.
 * Intenta primero localizar el modelo por ID en el formato nativo (que incluye
 * loaded_instances con context_length configurado por el usuario). Si no hay
 * coincidencia exacta, usa el primer modelo cargado que tenga context_length.
 * @param {string} modelId - ID del modelo
 * @param {string} [baseUrl] - URL base opcional
 * @returns {Promise<{numCtx: number}|null>}
 */
export async function getLMStudioModelInfo(modelId, baseUrl = null) {
  const url = await getBaseUrl(baseUrl);
  try {
    const response = await fetch(`${url}${LM_STUDIO_ENDPOINTS.models}`);
    if (!response.ok) return null;
    const data = await response.json();

    // Formato nativo LM Studio: { models: [{ key, loaded_instances, max_context_length }] }
    const nativeModels = data.models || [];

    // 1. Coincidencia exacta por ID en formato nativo
    const exactMatch = nativeModels.find(m =>
      m.key === modelId ||
      m.id === modelId ||
      m.loaded_instances?.some(i => i.id === modelId)
    );
    if (exactMatch) {
      const numCtx =
        exactMatch.loaded_instances?.[0]?.config?.context_length ||
        exactMatch.max_context_length ||
        null;
      if (numCtx) return { numCtx };
    }

    // 2. Fallback: primer modelo nativo con context_length configurado en loaded_instances
    for (const m of nativeModels) {
      const instance = m.loaded_instances?.find(i => i.config?.context_length);
      if (instance) return { numCtx: instance.config.context_length };
    }

    // 3. Último recurso: max_context_length de cualquier modelo nativo
    const withMax = nativeModels.find(m => m.max_context_length);
    if (withMax) return { numCtx: withMax.max_context_length };

    return null;
  } catch {
    return null;
  }
}

/**
 * Verifica si LM Studio está disponible
 * @param {string} [baseUrl] - URL base opcional
 * @returns {Promise<boolean>} true si está disponible
 */
export async function checkLMStudioAvailability(baseUrl = null) {
  const url = await getBaseUrl(baseUrl);
  try {
    const response = await fetch(`${url}${LM_STUDIO_ENDPOINTS.models}`);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Envía una petición a LM Studio (modo normal)
 * @param {string} textContent - Mensaje de usuario
 * @param {string|null} modelOverride - Modelo a usar (opcional)
 * @param {string|null} systemPrompt - Instrucciones de sistema (opcional)
 */
export async function sendToLMStudio(textContent, modelOverride = null, systemPrompt = null) {
  const settings = await getSettings();
  const url = normalizeBaseUrl(settings.lmStudioHost || 'http://localhost:1234');
  const model = modelOverride || settings.lmStudioModel;

  if (!model) throw new Error('No hay modelo cargado o seleccionado en LM Studio');

  // Construir array de mensajes: system primero (si existe), luego user
  const messages = [
    ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
    { role: 'user', content: textContent }
  ];

  const response = await fetch(`${url}${LM_STUDIO_ENDPOINTS.chatCompletions}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      stream: false
    })
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    const errMsg = typeof errBody.error === 'string'
      ? errBody.error
      : (errBody.error?.message || errBody.message || '');
    throw new Error(`LM Studio Error: ${response.status}${errMsg ? ' — ' + errMsg : ''}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

/**
 * Envía una petición a LM Studio (modo streaming)
 */
export async function sendToLMStudioStreaming(textContent, onChunk, modelOverride = null) {
  const settings = await getSettings();
  const url = normalizeBaseUrl(settings.lmStudioHost || 'http://localhost:1234');
  const model = modelOverride || settings.lmStudioModel;

  if (!model) throw new Error('No hay modelo cargado o seleccionado en LM Studio');

  const response = await fetch(`${url}${LM_STUDIO_ENDPOINTS.chatCompletions}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: textContent }],
      stream: true
    })
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    const errMsg = typeof errBody.error === 'string'
      ? errBody.error
      : (errBody.error?.message || errBody.message || '');
    throw new Error(`LM Studio Error: ${response.status}${errMsg ? ' — ' + errMsg : ''}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let fullText = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');

    // Guardar el último elemento incompleto en el buffer
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith('data: ') && trimmedLine !== 'data: [DONE]') {
        try {
          const data = JSON.parse(trimmedLine.slice(6));
          const content = data.choices[0]?.delta?.content;
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

// ---------------------------------------------------------------------------
// Chat nativo via array de mensajes — para uso exclusivo del chat con historial
// ---------------------------------------------------------------------------

/**
 * Envía un array de mensajes a LM Studio (modo streaming nativo).
 * @param {Array<{role:'system'|'user'|'assistant', content: string}>} messages
 * @param {Function} onChunk
 * @param {string|null} modelOverride
 * @returns {Promise<string>}
 */
export async function chatCompletionStreaming(messages, onChunk, modelOverride = null) {
  const settings = await getSettings();
  const url = normalizeBaseUrl(settings.lmStudioHost || 'http://localhost:1234');
  const model = modelOverride || settings.lmStudioModel;

  if (!model) throw new Error('No hay modelo cargado o seleccionado en LM Studio');

  const response = await fetch(`${url}${LM_STUDIO_ENDPOINTS.chatCompletions}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, stream: true }),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    const errMsg = typeof errBody.error === 'string'
      ? errBody.error
      : (errBody.error?.message || errBody.message || '');
    throw new Error(`LM Studio Error: ${response.status}${errMsg ? ' — ' + errMsg : ''}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let fullText = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith('data: ') && trimmedLine !== 'data: [DONE]') {
        try {
          const data = JSON.parse(trimmedLine.slice(6));
          const content = data.choices[0]?.delta?.content;
          if (content) {
            fullText += content;
            if (onChunk) onChunk(content);
          }
        } catch (e) { /* ignorar */ }
      }
    }
  }

  return fullText;
}
