// Servicio para interactuar con conexiones OpenAI personalizadas
// (API compatible con OpenAI, parametrizada por baseUrl, apiKey y model)

export const OPENAI_BASE_URL = 'https://api.openai.com';

const CUSTOM_ENDPOINTS = {
  models: '/v1/models',
  chatCompletions: '/v1/chat/completions',
};

/**
 * Normaliza la URL base eliminando el sufijo /v1 si está presente.
 * Los paths siempre se añaden explícitamente desde CUSTOM_ENDPOINTS.
 */
function normalizeBaseUrl(url) {
  if (!url) return '';
  return url.replace(/\/v1\/?$/, '').replace(/\/$/, '');
}

/**
 * Elimina artefactos de modelos razonadores de una respuesta:
 * - Bloques <think>...</think>
 * - Tokens especiales de plantilla
 */
function stripThinkBlocks(text) {
  if (!text) return text;

  text = text.replace(/<[｜|][^<>]*[｜|]>/g, '');
  text = text.replace(/<\|[^|<>]*\|>/g, '');

  let prev;
  do {
    prev = text;
    text = text.replace(/<think>[\s\S]*?<\/think>/gi, '');
  } while (text !== prev);

  return text.trim();
}

function createThinkFilter() {
  let buffer = '';
  let insideThink = false;
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
          const safeLen = Math.max(0, buffer.length - '<think>'.length);
          output += buffer.slice(0, safeLen);
          buffer = buffer.slice(safeLen);
          break;
        }
      }
    }

    return output.replace(specialTokenRe, '');
  };
}

function buildErrorMessage(response, errBody) {
  const errMsg =
    typeof errBody.error === 'string'
      ? errBody.error
      : errBody.error?.message || errBody.message || '';
  return `Custom OpenAI Error: ${response.status}${errMsg ? ' — ' + errMsg : ''}`;
}

export class CustomOpenAIProvider {
  constructor({ baseUrl, apiKey, model }) {
    this.baseUrl = normalizeBaseUrl(baseUrl);
    this.apiKey = apiKey || '';
    this.model = model || '';
  }

  _headers() {
    const headers = { 'Content-Type': 'application/json' };
    if (this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`;
    return headers;
  }

  _requireModel() {
    if (!this.model) throw new Error('No hay modelo configurado para la conexión personalizada.');
  }

  /**
   * Envía un prompt a la conexión personalizada (modo normal, para análisis/resúmenes).
   * @param {string} prompt - Contenido del usuario
   * @param {string|null} systemPrompt - Instrucciones de sistema (opcional)
   * @param {AbortSignal} [signal] - Permite cancelar la petición en curso
   * @returns {Promise<string>}
   */
  async sendMessage(prompt, systemPrompt = null, signal = null) {
    this._requireModel();

    const messages = [
      ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
      { role: 'user', content: prompt },
    ];

    const response = await fetch(`${this.baseUrl}${CUSTOM_ENDPOINTS.chatCompletions}`, {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify({
        model: this.model,
        messages,
        stream: false,
      }),
      signal,
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(buildErrorMessage(response, errBody));
    }

    const data = await response.json();
    return stripThinkBlocks(data.choices[0]?.message?.content ?? '');
  }

  /**
   * Envía un prompt a la conexión personalizada (modo streaming).
   * @param {string} prompt - Contenido del usuario
   * @param {Function} onChunk - Callback por chunk
   * @param {string|null} systemPrompt - Instrucciones de sistema (opcional)
   * @param {AbortSignal} [signal] - Permite cancelar la petición en curso
   * @returns {Promise<string>}
   */
  async sendMessageStreaming(prompt, onChunk, systemPrompt = null, signal = null) {
    this._requireModel();

    const messages = [
      ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
      { role: 'user', content: prompt },
    ];

    return this._streamChatCompletions(messages, onChunk, signal);
  }

  /**
   * Chat nativo con array de mensajes (modo streaming).
   * @param {Array<{role:string, content:string}>} messages
   * @param {Function} onChunk
   * @param {AbortSignal} [signal] - Permite cancelar la petición en curso
   * @returns {Promise<string>}
   */
  async chatCompletionStreaming(messages, onChunk, signal = null) {
    this._requireModel();
    return this._streamChatCompletions(messages, onChunk, signal);
  }

  async _streamChatCompletions(messages, onChunk, signal) {
    const response = await fetch(`${this.baseUrl}${CUSTOM_ENDPOINTS.chatCompletions}`, {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify({
        model: this.model,
        messages,
        stream: true,
      }),
      signal,
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(buildErrorMessage(response, errBody));
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
          } catch {
            // Ignorar chunks mal formateados
          }
        }
      }
    }

    return stripThinkBlocks(fullText);
  }

  /**
   * Obtiene los modelos disponibles en la conexión personalizada.
   * @returns {Promise<Array<{name:string, label:string, description:string}>>}
   */
  async listModels() {
    const response = await fetch(`${this.baseUrl}${CUSTOM_ENDPOINTS.models}`, {
      headers: this._headers(),
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(buildErrorMessage(response, errBody));
    }

    const data = await response.json();
    return (data.data || []).map((m) => ({
      name: m.id,
      label: m.id,
      description: m.object || 'Modelo disponible en la conexión personalizada',
    }));
  }
}
