/* global require, module */
const fs = require('fs');
const path = require('path');

const DEFAULT_OLLAMA_URL = 'http://localhost:11434';
const DEFAULT_LMSTUDIO_URL = 'http://localhost:1234';

// Endpoints de LM Studio (siempre con /v1 explícito)
const LM_STUDIO_ENDPOINTS = {
  models:     '/v1/models',
  embeddings: '/v1/embeddings',
};

/**
 * Normaliza la URL base de LM Studio: elimina el sufijo /v1 si está presente
 * para que los endpoints se añadan siempre de forma explícita.
 */
function normalizeBaseLMUrl(url) {
  return url.replace(/\/v1\/?$/, '').replace(/\/$/, '');
}
const DEFAULT_EMBEDDING_MODEL_FALLBACK = 'nomic-embed-text'; // Fallback si no hay config
const EMBEDDING_DIMENSION = 768;
const BATCH_SIZE = 10;
const MAX_INPUT_CHARS = 2000; // Límite de seguridad para no exceder context length del modelo de embeddings

// Cloud embedding config
const GEMINI_EMBEDDING_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_EMBEDDING_MODEL = 'text-embedding-004'; // 768 dims — compatible con nomic-embed-text
const KIMI_EMBEDDING_BASE = 'https://api.moonshot.ai/v1';
const KIMI_EMBEDDING_MODEL = 'moonshot-embedding-v1';

// Ruta del archivo de configuración
const { app } = require('electron');
const settingsPath = path.join(app.getPath('userData'), 'settings.json');

/**
 * Lee la configuración actual desde disco
 */
function loadSettings() {
  try {
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('[EmbeddingService] Error leyendo settings:', error.message);
  }
  return {};
}

/**
 * Obtiene el modelo de embeddings configurado según el proveedor activo
 */
function getEmbeddingModel() {
  const settings = loadSettings();
  const provider = settings.aiProvider;

  if (provider === 'gemini' || provider === 'geminiFree') return GEMINI_EMBEDDING_MODEL;
  if (provider === 'kimi') return KIMI_EMBEDDING_MODEL;
  if (provider === 'lmstudio' && settings.lmStudioEmbeddingModel) {
    return settings.lmStudioEmbeddingModel;
  }
  return settings.ollamaEmbeddingModel || DEFAULT_EMBEDDING_MODEL_FALLBACK;
}

/**
 * Detecta qué provider de embeddings está disponible.
 * Prioridad: proveedor cloud activo > local según provider activo > fallback al otro local
 * @returns {Promise<{ provider: string, baseUrl?: string, apiKey?: string } | null>}
 */
async function detectEmbeddingProvider() {
  const settings = loadSettings();
  const activeProvider = settings.aiProvider;

  // ── Proveedores cloud: no requieren servidor local ──────────────────────────
  if (activeProvider === 'gemini' && settings.geminiApiKey) {
    console.log('[EmbeddingService] Usando Gemini para embeddings');
    return { provider: 'gemini', apiKey: settings.geminiApiKey };
  }
  if (activeProvider === 'geminiFree' && settings.geminiFreeApiKey) {
    console.log('[EmbeddingService] Usando Gemini Free para embeddings');
    return { provider: 'gemini', apiKey: settings.geminiFreeApiKey };
  }
  if (activeProvider === 'kimi' && settings.kimiApiKey) {
    console.log('[EmbeddingService] Usando Kimi para embeddings');
    return { provider: 'kimi', apiKey: settings.kimiApiKey };
  }

  // ── Proveedores locales ─────────────────────────────────────────────────────
  // Si el proveedor activo es lmstudio, intentar LM Studio primero
  if (activeProvider === 'lmstudio') {
    const lmStudioUrl = normalizeBaseLMUrl(settings.lmStudioHost || DEFAULT_LMSTUDIO_URL);
    try {
      const response = await fetch(`${lmStudioUrl}${LM_STUDIO_ENDPOINTS.models}`, { signal: AbortSignal.timeout(3000) });
      if (response.ok) {
        return { provider: 'lmstudio', baseUrl: lmStudioUrl };
      }
    } catch {
      // LM Studio no disponible
    }
  }

  // Intentar Ollama
  const ollamaUrl = settings.ollamaHost || DEFAULT_OLLAMA_URL;
  try {
    const response = await fetch(`${ollamaUrl}/api/tags`, { signal: AbortSignal.timeout(3000) });
    if (response.ok) {
      return { provider: 'ollama', baseUrl: ollamaUrl };
    }
  } catch {
    // Ollama no disponible
  }

  // Intentar LM Studio como fallback
  if (activeProvider !== 'lmstudio') {
    const lmStudioUrl = normalizeBaseLMUrl(settings.lmStudioHost || DEFAULT_LMSTUDIO_URL);
    try {
      const response = await fetch(`${lmStudioUrl}${LM_STUDIO_ENDPOINTS.models}`, { signal: AbortSignal.timeout(3000) });
      if (response.ok) {
        return { provider: 'lmstudio', baseUrl: lmStudioUrl };
      }
    } catch {
      // LM Studio no disponible
    }
  }

  return null;
}

// ── Funciones de embedding cloud ─────────────────────────────────────────────

/**
 * Genera embedding usando Gemini text-embedding-004 (768 dims)
 * Compatible con nomic-embed-text: no requiere re-indexación al alternar entre ambos
 * @param {string} apiKey
 * @param {string} text
 * @returns {Promise<number[]>}
 */
async function embedWithGemini(apiKey, text) {
  const url = `${GEMINI_EMBEDDING_BASE}/${GEMINI_EMBEDDING_MODEL}:embedContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: { parts: [{ text }] },
      taskType: 'RETRIEVAL_DOCUMENT'
    })
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Gemini embedding error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  return data.embedding.values;
}

/**
 * Genera embeddings en lote usando la API batch de Gemini (más eficiente)
 * @param {string} apiKey
 * @param {string[]} texts
 * @returns {Promise<number[][]>}
 */
async function embedBatchWithGemini(apiKey, texts) {
  const url = `${GEMINI_EMBEDDING_BASE}/${GEMINI_EMBEDDING_MODEL}:batchEmbedContents?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: texts.map(text => ({
        model: `models/${GEMINI_EMBEDDING_MODEL}`,
        content: { parts: [{ text }] },
        taskType: 'RETRIEVAL_DOCUMENT'
      }))
    })
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Gemini batch embedding error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  return data.embeddings.map(e => e.values);
}

/**
 * Genera embedding usando Kimi (Moonshot) con API OpenAI-compatible
 * @param {string} apiKey
 * @param {string} text
 * @returns {Promise<number[]>}
 */
async function embedWithKimi(apiKey, text) {
  const response = await fetch(`${KIMI_EMBEDDING_BASE}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: KIMI_EMBEDDING_MODEL,
      input: text
    })
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Kimi embedding error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

// ── Funciones de embedding local (Ollama / LM Studio) ────────────────────────

/**
 * Genera embedding para un texto usando Ollama
 * @param {string} baseUrl
 * @param {string} text
 * @returns {Promise<number[]>}
 */
async function embedWithOllama(baseUrl, text, retryCount = 0) {
  const model = getEmbeddingModel();
  const maxRetries = 3;

  try {
    const response = await fetch(`${baseUrl}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model,
        prompt: text
      })
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Ollama embeddings error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    return data.embedding;
  } catch (error) {
    // NO reintentar errores de context length (son determinísticos, el texto siempre será igual)
    if (error.message.includes('context length')) {
      throw error;
    }
    // Reintentar si hay error de conexión o 500 transitorio (modelo crasheado, etc.)
    if (retryCount < maxRetries && (
      error.message.includes('500') ||
      error.message.includes('EOF') ||
      error.message.includes('no longer running') ||
      error.message.includes('ECONNREFUSED') ||
      error.message.includes('fetch failed')
    )) {
      const delayMs = 2000 * (retryCount + 1); // 2s, 4s, 6s
      console.log(`[EmbeddingService] Reintentando embedding (intento ${retryCount + 2}/${maxRetries + 1}) tras ${delayMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
      return embedWithOllama(baseUrl, text, retryCount + 1);
    }
    throw error;
  }
}

/**
 * Genera embeddings para múltiples textos en una sola petición usando la API batch de Ollama (/api/embed).
 * Más eficiente que llamadas individuales. Retorna null si el endpoint no está disponible.
 * @param {string} baseUrl
 * @param {string[]} texts
 * @returns {Promise<number[][]|null>}
 */
async function embedBatchWithOllama(baseUrl, texts) {
  const model = getEmbeddingModel();
  try {
    const response = await fetch(`${baseUrl}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, input: texts })
    });

    if (!response.ok) return null; // Fallback a llamadas individuales

    const data = await response.json();
    // La API batch devuelve { embeddings: number[][] }
    if (Array.isArray(data.embeddings) && data.embeddings.length === texts.length) {
      return data.embeddings;
    }
    return null;
  } catch {
    return null; // Fallback si el endpoint no existe (versión antigua de Ollama)
  }
}

/**
 * Genera embedding para un texto usando LM Studio (API OpenAI-compatible)
 * @param {string} baseUrl
 * @param {string} text
 * @returns {Promise<number[]>}
 */
async function embedWithLMStudio(baseUrl, text) {
  const model = getEmbeddingModel();
  const response = await fetch(`${baseUrl}${LM_STUDIO_ENDPOINTS.embeddings}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: model,
      input: text
    })
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`LM Studio embeddings error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const embedding = data?.data?.[0]?.embedding;
  if (!embedding) {
    throw new Error(`LM Studio: respuesta de embeddings inesperada — ${JSON.stringify(data).substring(0, 200)}`);
  }
  return embedding;
}

// ── API pública ───────────────────────────────────────────────────────────────

/**
 * Genera embedding para un solo texto
 * @param {string} text
 * @param {{ provider: string, baseUrl?: string, apiKey?: string }} providerInfo
 * @returns {Promise<number[]>}
 */
async function embed(text, providerInfo, retryCount = 0) {
  // Truncar texto como medida de seguridad para no exceder context length del modelo de embeddings
  const safeText = text.length > MAX_INPUT_CHARS ? text.substring(0, MAX_INPUT_CHARS) : text;

  if (providerInfo.provider === 'gemini') {
    return embedWithGemini(providerInfo.apiKey, safeText);
  }
  if (providerInfo.provider === 'kimi') {
    return embedWithKimi(providerInfo.apiKey, safeText);
  }
  if (providerInfo.provider === 'ollama') {
    return embedWithOllama(providerInfo.baseUrl, safeText, retryCount);
  } else if (providerInfo.provider === 'lmstudio') {
    return embedWithLMStudio(providerInfo.baseUrl, safeText);
  }
  throw new Error(`Provider de embeddings no soportado: ${providerInfo.provider}`);
}

/**
 * Genera embeddings para un array de textos en lotes
 * @param {string[]} texts
 * @param {{ provider: string, baseUrl?: string, apiKey?: string }} providerInfo
 * @returns {Promise<number[][]>}
 */
async function embedBatch(texts, providerInfo) {
  // Truncar todos los textos antes de procesarlos
  const safeTexts = texts.map(t => t.length > MAX_INPUT_CHARS ? t.substring(0, MAX_INPUT_CHARS) : t);

  // ── Gemini: batch API nativa (muy eficiente, 1 petición por lote de 10) ────
  if (providerInfo.provider === 'gemini') {
    const results = [];
    for (let i = 0; i < safeTexts.length; i += BATCH_SIZE) {
      const batch = safeTexts.slice(i, i + BATCH_SIZE);
      const batchEmbeddings = await embedBatchWithGemini(providerInfo.apiKey, batch);
      results.push(...batchEmbeddings);
      if (i + BATCH_SIZE < safeTexts.length) {
        await new Promise(resolve => setTimeout(resolve, 200)); // rate limit
      }
    }
    return results;
  }

  // ── Kimi: llamadas individuales (sin batch API) ───────────────────────────
  if (providerInfo.provider === 'kimi') {
    const results = [];
    for (const text of safeTexts) {
      results.push(await embedWithKimi(providerInfo.apiKey, text));
      await new Promise(resolve => setTimeout(resolve, 100)); // rate limit
    }
    return results;
  }

  // ── Proveedores locales ───────────────────────────────────────────────────
  const results = [];

  for (let i = 0; i < safeTexts.length; i += BATCH_SIZE) {
    const batch = safeTexts.slice(i, i + BATCH_SIZE);

    // Para Ollama: intentar la API batch nativa primero (más rápido, 1 sola petición HTTP)
    if (providerInfo.provider === 'ollama') {
      const batchEmbeddings = await embedBatchWithOllama(providerInfo.baseUrl, batch);
      if (batchEmbeddings) {
        results.push(...batchEmbeddings);
        if (i + BATCH_SIZE < safeTexts.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        continue;
      }
    }

    // Fallback: peticiones individuales (Ollama antiguo o LM Studio)
    const batchResults = [];
    for (const text of batch) {
      let embedding;
      let attemptText = text;
      let contextRetries = 0;
      const maxContextRetries = 3;
      while (!embedding && contextRetries <= maxContextRetries) {
        try {
          embedding = await embed(attemptText, providerInfo);
        } catch (error) {
          if (error.message.includes('context length') && contextRetries < maxContextRetries) {
            attemptText = attemptText.substring(0, Math.floor(attemptText.length / 2));
            contextRetries++;
            console.warn(`[EmbeddingService] Texto demasiado largo, reduciendo a ${attemptText.length} chars (intento ${contextRetries}/${maxContextRetries})`);
          } else {
            console.error(`[EmbeddingService] Error generando embedding: ${error.message}`);
            throw error;
          }
        }
      }
      batchResults.push(embedding);
    }
    results.push(...batchResults);

    if (i + BATCH_SIZE < safeTexts.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return results;
}

/**
 * Verifica que el modelo de embeddings esté disponible y lo descarga si es necesario (Ollama)
 * Para proveedores cloud, retorna true directamente (no hay setup local necesario)
 * @param {{ provider: string, baseUrl?: string, apiKey?: string }} providerInfo
 * @returns {Promise<boolean>}
 */
async function ensureModel(providerInfo) {
  // Cloud providers: no hay modelo local que verificar
  if (providerInfo.provider === 'gemini' || providerInfo.provider === 'kimi') {
    return true;
  }

  const model = getEmbeddingModel();

  if (providerInfo.provider === 'ollama') {
    try {
      // Verificar si el modelo existe
      const response = await fetch(`${providerInfo.baseUrl}/api/show`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: model })
      });

      if (!response.ok) {
        // Modelo no existe, intentar pull
        console.log(`[EmbeddingService] Descargando modelo ${model}...`);
        const pullResponse = await fetch(`${providerInfo.baseUrl}/api/pull`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: model })
        });

        if (!pullResponse.ok) {
          throw new Error(`Error descargando modelo: ${pullResponse.status}`);
        }

        // Consumir el stream de progreso
        const reader = pullResponse.body.getReader();
        while (true) {
          const { done } = await reader.read();
          if (done) break;
        }
        console.log(`[EmbeddingService] Modelo ${model} descargado.`);
      }
      return true;
    } catch (error) {
      console.error('[EmbeddingService] Error verificando modelo:', error.message);
      return false;
    }
  }

  // Para LM Studio, asumimos que el modelo está cargado
  return true;
}

module.exports = {
  detectEmbeddingProvider,
  embed,
  embedBatch,
  ensureModel,
  EMBEDDING_DIMENSION,
  DEFAULT_EMBEDDING_MODEL: DEFAULT_EMBEDDING_MODEL_FALLBACK
};
