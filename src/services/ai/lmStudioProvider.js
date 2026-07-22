// Servicio para interactuar con LM Studio (API compatible con OpenAI)
import { getSettings } from '../settingsService';

/**
 * Elimina artefactos de modelos razonadores de una respuesta de LM Studio:
 * - Bloques <think>...</think> (DeepSeek R1, QwQ, etc.)
 * - Tokens especiales de plantilla: <｜begin▁of▁sentence｜>, <｜end▁of▁sentence｜>,
 *   <|im_start|>, <|im_end|> y variantes similares
 */
function stripThinkBlocks(text) {
  if (!text) return text;

  // 1. Tokens especiales de plantilla (DeepSeek, Qwen, etc.)
  //    Usando caracteres literales del token ｜ (U+FF5C) y ▁ (U+2581)
  text = text.replace(/<[｜|][^<>]*[｜|]>/g, '');
  text = text.replace(/<\|[^|<>]*\|>/g, '');

  // 2. Bloques <think>...</think> — bucle por si hay varios consecutivos
  let prev;
  do {
    prev = text;
    text = text.replace(/<think>[\s\S]*?<\/think>/gi, '');
  } while (text !== prev);

  return text.trim();
}

/**
 * Filtro de estado para streams: acumula texto y suprime chunks que estén
 * dentro de un bloque <think>...</think>. Devuelve solo el texto "exterior".
 * También elimina tokens de plantilla de modelo al final de cada emisión.
 */
function createThinkFilter() {
  let buffer = '';
  let insideThink = false;

  // Regex para tokens especiales de plantilla (DeepSeek, Qwen, etc.)
  const specialTokenRe = /(<[｜|][^<>]*[｜|]>|<\|[^|<>]*\|>)/g;

  return function filter(chunk) {
    buffer += chunk;
    let output = '';

    while (buffer.length > 0) {
      if (insideThink) {
        const closeIdx = buffer.indexOf('</think>');
        if (closeIdx !== -1) {
          buffer = buffer.slice(closeIdx + '</think>'.length);
          insideThink = false;
        } else {
          // Conservar solo los últimos chars por si el cierre llega partido
          const safeLen = Math.max(0, buffer.length - '</think>'.length);
          buffer = buffer.slice(safeLen);
          break;
        }
      } else {
        const openIdx = buffer.indexOf('<think>');
        if (openIdx !== -1) {
          output += buffer.slice(0, openIdx);
          buffer = buffer.slice(openIdx + '<think>'.length);
          insideThink = true;
        } else {
          // Emitir todo salvo los últimos chars (por si '<think>' llega partido)
          const safeLen = Math.max(0, buffer.length - '<think>'.length);
          output += buffer.slice(0, safeLen);
          buffer = buffer.slice(safeLen);
          break;
        }
      }
    }

    // Eliminar tokens de plantilla del fragmento emitido
    return output.replace(specialTokenRe, '');
  };
}

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
 * @param {AbortSignal} [signal] - Permite cancelar la petición en curso
 */
export async function sendToLMStudio(textContent, modelOverride = null, systemPrompt = null, signal = null) {
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
      stream: false,
      // Desactiva el bloque <think> en modelos razonadores (DeepSeek R1, QwQ, etc.)
      // LM Studio ≥ 0.3.x lo soporta; los modelos no-razonadores lo ignoran.
      reasoning_effort: 'none'
    }),
    signal,
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    const errMsg = typeof errBody.error === 'string'
      ? errBody.error
      : (errBody.error?.message || errBody.message || '');
    throw new Error(`LM Studio Error: ${response.status}${errMsg ? ' — ' + errMsg : ''}`);
  }

  const data = await response.json();
  return stripThinkBlocks(data.choices[0].message.content);
}

/**
 * Envía una petición a LM Studio (modo streaming)
 * @param {AbortSignal} [signal] - Permite cancelar la petición en curso
 */
export async function sendToLMStudioStreaming(textContent, onChunk, modelOverride = null, signal = null) {
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
      stream: true,
      reasoning_effort: 'none'
    }),
    signal,
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
  const thinkFilter = createThinkFilter();
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
            const filtered = thinkFilter(content);
            fullText += filtered;
            if (onChunk && filtered) onChunk(filtered);
          }
        } catch (e) {
          // Ignorar chunks mal formateados
        }
      }
    }
  }

  return stripThinkBlocks(fullText);
}

// ---------------------------------------------------------------------------
// Chat nativo via array de mensajes — para uso exclusivo del chat con historial
// ---------------------------------------------------------------------------

/**
 * Envía un array de mensajes a LM Studio (modo streaming nativo).
 * @param {Array<{role:'system'|'user'|'assistant', content: string}>} messages
 * @param {Function} onChunk
 * @param {string|null} modelOverride
 * @param {AbortSignal} [signal] - Permite cancelar la petición en curso
 * @returns {Promise<string>}
 */
export async function chatCompletionStreaming(messages, onChunk, modelOverride = null, signal = null) {
  const settings = await getSettings();
  const url = normalizeBaseUrl(settings.lmStudioHost || 'http://localhost:1234');
  const model = modelOverride || settings.lmStudioModel;

  if (!model) throw new Error('No hay modelo cargado o seleccionado en LM Studio');

  const response = await fetch(`${url}${LM_STUDIO_ENDPOINTS.chatCompletions}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, stream: true, reasoning_effort: 'none' }),
    signal,
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
  const thinkFilter = createThinkFilter();
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
            const filtered = thinkFilter(content);
            fullText += filtered;
            if (onChunk && filtered) onChunk(filtered);
          }
        } catch (e) { /* ignorar */ }
      }
    }
  }

  return stripThinkBlocks(fullText);
}
