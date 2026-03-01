/* global require, module */
const fs = require('fs');
const path = require('path');

const DEFAULT_OLLAMA_URL = 'http://localhost:11434';
const DEFAULT_LMSTUDIO_URL = 'http://localhost:1234/v1';
const DEFAULT_EMBEDDING_MODEL_FALLBACK = 'nomic-embed-text'; // Fallback si no hay config
const EMBEDDING_DIMENSION = 768;
const BATCH_SIZE = 10;
const MAX_INPUT_CHARS = 2000; // Límite de seguridad para no exceder context length del modelo

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
 * Obtiene el modelo de embeddings configurado
 */
function getEmbeddingModel() {
  const settings = loadSettings();
  return settings.ollamaEmbeddingModel || DEFAULT_EMBEDDING_MODEL_FALLBACK;
}

/**
 * Detecta qué provider de embeddings está disponible
 * Prioridad: Ollama > LM Studio
 * @returns {{ provider: string, baseUrl: string } | null}
 */
async function detectEmbeddingProvider() {
  const settings = loadSettings();

  // Intentar Ollama primero
  const ollamaUrl = settings.ollamaHost || DEFAULT_OLLAMA_URL;
  try {
    const response = await fetch(`${ollamaUrl}/api/tags`, { signal: AbortSignal.timeout(3000) });
    if (response.ok) {
      return { provider: 'ollama', baseUrl: ollamaUrl };
    }
  } catch {
    // Ollama no disponible
  }

  // Intentar LM Studio
  const lmStudioUrl = settings.lmStudioHost || DEFAULT_LMSTUDIO_URL;
  try {
    const response = await fetch(`${lmStudioUrl}/models`, { signal: AbortSignal.timeout(3000) });
    if (response.ok) {
      return { provider: 'lmstudio', baseUrl: lmStudioUrl };
    }
  } catch {
    // LM Studio no disponible
  }

  return null;
}

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
  const response = await fetch(`${baseUrl}/embeddings`, {
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
  return data.data[0].embedding;
}

/**
 * Genera embedding para un solo texto
 * @param {string} text
 * @param {{ provider: string, baseUrl: string }} providerInfo
 * @returns {Promise<number[]>}
 */
async function embed(text, providerInfo, retryCount = 0) {
  // Truncar texto como medida de seguridad para no exceder context length
  const safeText = text.length > MAX_INPUT_CHARS ? text.substring(0, MAX_INPUT_CHARS) : text;

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
 * @param {{ provider: string, baseUrl: string }} providerInfo
 * @returns {Promise<number[][]>}
 */
async function embedBatch(texts, providerInfo) {
  const results = [];

  // Truncar todos los textos antes de procesarlos
  const safeTexts = texts.map(t => t.length > MAX_INPUT_CHARS ? t.substring(0, MAX_INPUT_CHARS) : t);

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
 * @param {{ provider: string, baseUrl: string }} providerInfo
 * @returns {Promise<boolean>}
 */
async function ensureModel(providerInfo) {
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
