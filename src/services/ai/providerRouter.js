/**
 * Router centralizado para selección de proveedor de IA
 * Punto único de decisión entre todos los proveedores soportados.
 * Todas las llamadas pasan por aiQueueService para serializarse y ser observables.
 */

import { getSettings } from '../settingsService';
import { sendToGemini, sendToGeminiStreaming, sendToGeminiChatStreaming, sendToGeminiChatOnce } from './geminiProvider';
import { sendToDeepseek, sendToDeepseekStreaming, getDeepseekAvailableModels, chatCompletionStreaming as deepseekChatStreaming, chatCompletionOnce as deepseekChatOnce } from './deepseekProvider';
import { sendToKimi, sendToKimiStreaming, getKimiAvailableModels, chatCompletionStreaming as kimiChatStreaming, chatCompletionOnce as kimiChatOnce } from './kimiProvider';
import { sendToLMStudio, sendToLMStudioStreaming, getLMStudioModels, getLMStudioModelInfo, chatCompletionStreaming as lmStudioChatStreaming, chatCompletionOnce as lmStudioChatOnce } from './lmStudioProvider';
import { generateContent as ollamaGenerate, generateContentStreaming as ollamaGenerateStreaming, chatCompletionStreaming as ollamaChatStreaming, chatCompletionOnce as ollamaChatOnce, getOllamaModelInfo } from './ollamaProvider';
import { CustomOpenAIProvider, OPENAI_BASE_URL } from './customOpenAIProvider';
import { aiQueueService, AI_TASK_TYPES } from './aiQueueService';
import { executeTool } from './tools';
import { CODEX_TASK_OUTPUT_SCHEMA, formatExistingTasksForCodex, buildCodexTaskInstructions } from './codexTaskBridge';


const CUSTOM_PROVIDER_PREFIX = 'custom:';

/**
 * Providers cloud/hospedados con ventana de contexto grande (≥128k), donde no
 * hace falta detección local ni chunking manual — a diferencia de Ollama/LM
 * Studio, que corren modelos locales de tamaño variable y sí necesitan detectar
 * su `numCtx` real. ÚNICA fuente de verdad: antes existían 3 copias de este
 * mismo array (`getActiveProviderContextWindow` acá, `isCloudProvider` en
 * `recordingAiService.js`, y el badge de `CloudProvidersSection.jsx`) — cuando
 * se agregaron `openai`/`codex` como providers, solo se actualizaron 2 de las 3,
 * y la tercera (`recordingAiService.js`) quedó desincronizada: trataba a Codex
 * como un modelo local de 4096 tokens y partía transcripciones normales en ~10
 * fragmentos sin necesidad (bug real, ya corregido). Importá esta constante en
 * vez de declarar el array de nuevo.
 */
export const CLOUD_PROVIDERS = ['gemini', 'deepseek', 'kimi', 'openai', 'codex'];
const CODEX_REASONING_EFFORTS = new Set(['minimal', 'low', 'medium', 'high', 'xhigh']);

function createCodexRequestId() {
  return `codex-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function resolveCodexReasoningEffort(value) {
  if (value == null || value === '') return undefined;
  if (typeof value !== 'string' || !CODEX_REASONING_EFFORTS.has(value)) {
    throw new Error('El nivel de razonamiento de Codex no es válido.');
  }
  return value;
}

async function runCodexInMain(prompt, model, reasoningEffort, onChunk, signal, outputSchema) {
  const api = window.electronAPI;
  if (!api?.runCodex || !api?.onCodexChunk || !api?.cancelCodex) {
    throw new Error('Codex requiere ejecutar AIRecorder desde Electron.');
  }
  const requestId = createCodexRequestId();
  const unsubscribe = api.onCodexChunk(({ requestId: receivedId, text }) => {
    if (receivedId === requestId && text) onChunk?.(text);
  });
  const abort = () => { api.cancelCodex(requestId).catch(() => {}); };
  signal?.addEventListener('abort', abort, { once: true });
  try {
    const request = { requestId, prompt, model: model || undefined };
    const validatedReasoningEffort = resolveCodexReasoningEffort(reasoningEffort);
    if (validatedReasoningEffort) request.reasoningEffort = validatedReasoningEffort;
    // Ver codexTaskBridge.js: cuando viene presente, Main fuerza la respuesta final
    // a JSON válido contra este schema (SDK: `TurnOptions.outputSchema`), en vez
    // de texto libre en streaming.
    if (outputSchema) request.outputSchema = outputSchema;
    const result = await api.runCodex(request);
    if (!result?.success) {
      const error = new Error(result?.error || 'Codex no pudo completar la solicitud.');
      if (result?.code === 'CODEX_CANCELLED') error.name = 'AbortError';
      throw error;
    }
    return result;
  } finally {
    signal?.removeEventListener('abort', abort);
    unsubscribe();
  }
}

function formatCodexChat(messages) {
  return messages.map(({ role, content }) => `[${role.toUpperCase()}]\n${content}`).join('\n\n');
}

/**
 * Determina si un proveedor es una conexión OpenAI personalizada.
 * @param {string} provider
 * @returns {boolean}
 */
export function isCustom(provider) {
  return typeof provider === 'string' && provider.startsWith(CUSTOM_PROVIDER_PREFIX);
}

/**
 * Resuelve la conexión personalizada referenciada por `provider`.
 * @param {Object} settings
 * @param {string} provider - Valor con prefijo `custom:{id}`
 * @returns {Object|undefined}
 */
export function resolveCustomConnection(settings, provider) {
  if (!isCustom(provider)) return undefined;
  const id = provider.slice(CUSTOM_PROVIDER_PREFIX.length);
  return (settings?.customConnections || []).find((conn) => conn.id === id);
}

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

/**
 * Resuelve el nombre legible del motor de IA activo para mostrarlo en la cola.
 */
function _resolveEngineName(settings, provider, options = {}) {
  if (provider === 'ollama') {
    const model = options?.model || options?.ragModel || settings.ollamaModel || '';
    return model ? `Ollama: ${model}` : 'Ollama';
  }
  if (provider === 'lmstudio') {
    const model = options?.model || options?.ragModel || settings.lmStudioModel || '';
    return model ? `LM Studio: ${model}` : 'LM Studio';
  }
  if (provider === 'deepseek') return 'DeepSeek';
  if (provider === 'kimi') return 'Kimi';
  if (provider === 'gemini') return 'Gemini';
  if (provider === 'codex') {
    const model = options?.model || settings.codexModel || '';
    return model ? `Codex: ${model}` : 'Codex (ChatGPT)';
  }
  if (provider === 'openai') {
    const model = options?.model || settings.openaiModel || '';
    return model ? `OpenAI: ${model}` : 'OpenAI';
  }

  const customConnection = isCustom(provider)
    ? resolveCustomConnection(settings, provider)
    : null;
  if (customConnection) return customConnection.name || provider;

  return provider || 'IA';
}

/**
 * Lógica real de callProvider (sin cola). Se ejecuta dentro de la tarea encolada.
 * @param {AbortSignal} [signal] - Permite cancelar la llamada HTTP en curso.
 */
async function _runCallProvider(prompt, options, signal) {
  const settings = await getSettings();
  const provider = options.providerOverride || settings.aiProvider || 'ollama';
  const systemPrompt = options.systemPrompt || null;

  switch (provider) {
    case 'ollama': {
      const model = options.model || options.ragModel || settings.ollamaModel;
      if (!model) throw new Error('No se ha seleccionado un modelo de Ollama en los ajustes.');
      const response = await ollamaGenerate(model, prompt, { ...options, images: options.images || [], systemPrompt, signal });
      return { text: response || 'Sin respuesta', provider: 'ollama', model };
    }

    case 'lmstudio': {
      const model = options.model || options.ragModel || settings.lmStudioModel;
      if (!model) throw new Error('No se ha seleccionado un modelo en LM Studio.');
      const response = await sendToLMStudio(prompt, model, systemPrompt, signal);
      return { text: response || 'Sin respuesta', provider: 'lmstudio', model };
    }

    case 'deepseek': {
      if (!settings.deepseekApiKey) throw new Error('No se ha configurado la DeepSeek API Key en los ajustes.');
      const response = await sendToDeepseek(prompt, options.model || null, systemPrompt, signal);
      return { text: response || 'Sin respuesta', provider: 'deepseek' };
    }

    case 'kimi': {
      if (!settings.kimiApiKey) throw new Error('No se ha configurado la Kimi API Key en los ajustes.');
      const response = await sendToKimi(prompt, options.model || null, systemPrompt, signal);
      return { text: response || 'Sin respuesta', provider: 'kimi' };
    }

    case 'codex': {
      const model = options.model || settings.codexModel || '';
      const reasoningEffort = options.codexReasoningEffort ?? settings.codexReasoningEffort;
      const result = await runCodexInMain([systemPrompt, prompt].filter(Boolean).join('\n\n'), model, reasoningEffort, null, signal);
      return { text: result.text || 'Sin respuesta', provider: 'codex', model };
    }

    case 'openai': {
      if (!settings.openaiApiKey) throw new Error('No se ha configurado la OpenAI API Key en los ajustes.');
      const model = options.model || settings.openaiModel;
      if (!model) throw new Error('No se ha seleccionado un modelo de OpenAI.');
      const client = new CustomOpenAIProvider({ baseUrl: OPENAI_BASE_URL, apiKey: settings.openaiApiKey, model });
      const response = await client.sendMessage(prompt, systemPrompt, signal);
      return { text: response || 'Sin respuesta', provider: 'openai', model };
    }

    case 'gemini':
    default: {
      if (isCustom(provider)) {
        const connection = resolveCustomConnection(settings, provider);
        if (!connection) throw new Error('Conexión personalizada no encontrada');
        const model = options.model || settings.customGeneralModel;
        if (!model) throw new Error('No se ha seleccionado un modelo para la conexión personalizada.');
        const client = new CustomOpenAIProvider({
          baseUrl: connection.baseUrl,
          apiKey: connection.apiKey,
          model,
        });
        const response = await client.sendMessage(prompt, systemPrompt, signal);
        return { text: response || 'Sin respuesta', provider, model };
      }

      if (!settings.geminiApiKey) throw new Error('No se ha configurado la Gemini API Key en los ajustes.');
      const result = await sendToGemini(prompt, true, options.images || [], systemPrompt, signal);
      const text = result?.candidates?.[0]?.content?.parts?.[0]?.text || 'Sin respuesta';
      return { text, provider: 'gemini' };
    }
  }
}

/**
 * Lógica real de callProviderStreaming (sin cola). Se ejecuta dentro de la tarea encolada.
 * @param {AbortSignal} [signal] - Permite cancelar la llamada HTTP en curso.
 */
async function _runCallProviderStreaming(prompt, onChunk, options, signal) {
  const settings = await getSettings();
  const provider = options.providerOverride || settings.aiProvider || 'gemini';
  const systemPrompt = options.systemPrompt || null;

  console.log(`[callProviderStreaming] Provider: ${provider}`);

  switch (provider) {
    case 'gemini': {
      console.log('[callProviderStreaming] Iniciando streaming con Gemini');
      const fullResponse = await sendToGeminiStreaming(prompt, onChunk, options.images || [], signal);
      return { text: fullResponse || 'Sin respuesta', provider: 'gemini', streaming: true };
    }

    case 'codex': {
      const model = options.model || settings.codexModel || '';
      const reasoningEffort = options.codexReasoningEffort ?? settings.codexReasoningEffort;
      const result = await runCodexInMain([systemPrompt, prompt].filter(Boolean).join('\n\n'), model, reasoningEffort, onChunk, signal);
      return { text: result.text || 'Sin respuesta', provider: 'codex', model, streaming: true };
    }

    case 'openai': {
      if (!settings.openaiApiKey) throw new Error('No se ha configurado la OpenAI API Key en los ajustes.');
      const model = options.model || settings.openaiModel;
      if (!model) throw new Error('No se ha seleccionado un modelo de OpenAI.');
      console.log(`[callProviderStreaming] Iniciando streaming con OpenAI modelo: ${model}`);
      const client = new CustomOpenAIProvider({ baseUrl: OPENAI_BASE_URL, apiKey: settings.openaiApiKey, model });
      const fullResponse = await client.sendMessageStreaming(prompt, onChunk, systemPrompt, signal);
      return { text: fullResponse || 'Sin respuesta', provider: 'openai', model, streaming: true };
    }

    case 'deepseek': {
      console.log('[callProviderStreaming] Iniciando streaming con DeepSeek');
      const fullResponse = await sendToDeepseekStreaming(prompt, onChunk, options.model || null, signal);
      return { text: fullResponse || 'Sin respuesta', provider: 'deepseek', streaming: true };
    }

    case 'kimi': {
      console.log('[callProviderStreaming] Iniciando streaming con Kimi');
      const fullResponse = await sendToKimiStreaming(prompt, onChunk, options.model || null, null, signal);
      return { text: fullResponse || 'Sin respuesta', provider: 'kimi', streaming: true };
    }

    case 'lmstudio': {
      const model = options.model || options.ragModel || settings.lmStudioModel;
      if (!model) throw new Error('No se ha seleccionado un modelo en LM Studio.');
      console.log(`[callProviderStreaming] Iniciando streaming con LM Studio modelo: ${model}`);
      const fullResponse = await sendToLMStudioStreaming(prompt, onChunk, model, signal);
      return { text: fullResponse || 'Sin respuesta', provider: 'lmstudio', model, streaming: true };
    }

    case 'ollama': {
      const model = options.model || options.ragModel || settings.ollamaModel;
      if (!model) throw new Error('No se ha seleccionado un modelo de Ollama en los ajustes.');

      const useStreaming = settings.ollamaModelSupportsStreaming && !options.ragModel;

      if (useStreaming) {
        console.log(`[callProviderStreaming] Iniciando streaming con Ollama modelo: ${model}`);
        const fullResponse = await ollamaGenerateStreaming(model, prompt, onChunk, options.images || [], signal);
        return { text: fullResponse || 'Sin respuesta', provider: 'ollama', model, streaming: true };
      }

      // Fallback no-streaming
      console.log(`🔄 Usando modo no-streaming para Ollama${options.ragModel ? ` (RAG model: ${model})` : ''}`);
      const result = await _runCallProvider(prompt, options, signal);
      if (onChunk && result.text) onChunk(result.text);
      return { ...result, streaming: false };
    }

    default: {
      if (isCustom(provider)) {
        const connection = resolveCustomConnection(settings, provider);
        if (!connection) throw new Error('Conexión personalizada no encontrada');
        const model = options.model || settings.customGeneralModel;
        if (!model) throw new Error('No se ha seleccionado un modelo para la conexión personalizada.');
        const client = new CustomOpenAIProvider({
          baseUrl: connection.baseUrl,
          apiKey: connection.apiKey,
          model,
        });
        const fullResponse = await client.sendMessageStreaming(prompt, onChunk, systemPrompt, signal);
        return { text: fullResponse || 'Sin respuesta', provider, model, streaming: true };
      }

      console.log(`🔄 Usando modo no-streaming para ${provider}`);
      const result = await _runCallProvider(prompt, options, signal);
      if (onChunk && result.text) onChunk(result.text);
      return { ...result, streaming: false };
    }
  }
}

// ---------------------------------------------------------------------------
// API pública — pasan por la cola
// ---------------------------------------------------------------------------

/**
 * Envía un prompt al proveedor de IA configurado.
 * La llamada se encola y se ejecuta en orden FIFO.
 *
 * @param {string} prompt - Contenido del mensaje de usuario
 * @param {Object} options - Opciones adicionales.
 *   options.systemPrompt?: string — Instrucciones de sistema (se envía como campo separado en cada proveedor).
 *   options.queueMeta?: { name?: string, type?: string, engine?: string }
 *   para personalizar cómo aparece en la cola de la UI.
 * @returns {Promise<{text: string, provider: string}>}
 */
export async function callProvider(prompt, options = {}) {
  // Leer settings para resolver nombre del motor (display inmediato en la cola)
  let engine = 'IA';
  try {
    const settings = await getSettings();
    const provider = options.providerOverride || settings.aiProvider || 'gemini';
    engine = _resolveEngineName(settings, provider, options);
  } catch {
    // Si falla la lectura, usamos el fallback
  }

  const meta = {
    ...(options.queueMeta || {}),
    name: options.queueMeta?.name || 'Llamada a IA',
    type: options.queueMeta?.type || AI_TASK_TYPES.GENERAL,
    engine: options.queueMeta?.engine || engine,
    prompt,
  };

  return aiQueueService.enqueue((signal) => _runCallProvider(prompt, options, signal), meta);
}

/**
 * Envía un prompt al proveedor de IA configurado con soporte para streaming.
 * La llamada se encola; onChunk se invoca en tiempo real mientras la tarea está activa.
 *
 * @param {string} prompt - Prompt completo
 * @param {Function} onChunk - Callback que recibe cada chunk de la respuesta
 * @param {Object} options - Opciones adicionales (igual que callProvider)
 * @returns {Promise<{text: string, provider: string, streaming: boolean}>}
 */
export async function callProviderStreaming(prompt, onChunk, options = {}) {
  let engine = 'IA';
  try {
    const settings = await getSettings();
    const provider = options.providerOverride || settings.aiProvider || 'gemini';
    engine = _resolveEngineName(settings, provider, options);
  } catch {
    // fallback
  }

  const meta = {
    ...(options.queueMeta || {}),
    name: options.queueMeta?.name || 'Chat con IA',
    type: options.queueMeta?.type || AI_TASK_TYPES.CHAT,
    engine: options.queueMeta?.engine || engine,
    prompt,
  };

  return aiQueueService.enqueue(
    (signal) => _runCallProviderStreaming(prompt, onChunk, options, signal),
    meta
  );
}

/**
 * Valida la configuración del proveedor de IA actual.
 * @returns {Promise<{valid: boolean, error: string|null}>}
 */
export async function validateProviderConfig() {
  try {
    const settings = await getSettings();
    const provider = settings.aiProvider || 'gemini';

    switch (provider) {
      case 'gemini':
        if (!settings.geminiApiKey)
          return { valid: false, error: 'Falta configurar la Gemini API Key' };
        break;
      case 'deepseek':
        if (!settings.deepseekApiKey)
          return { valid: false, error: 'Falta configurar la DeepSeek API Key' };
        break;
      case 'kimi':
        if (!settings.kimiApiKey)
          return { valid: false, error: 'Falta configurar la Kimi API Key' };
        break;
      case 'codex': {
        const status = await window.electronAPI?.getCodexStatus?.();
        if (!status?.available) return { valid: false, error: status?.error || 'Codex CLI no está disponible' };
        if (!status.connected) return { valid: false, error: 'Iniciá sesión con ChatGPT/Codex en Ajustes' };
        break;
      }
      case 'openai':
        if (!settings.openaiApiKey)
          return { valid: false, error: 'Falta configurar la OpenAI API Key' };
        break;
      case 'ollama':
        if (!settings.ollamaModel)
          return { valid: false, error: 'Falta seleccionar un modelo de Ollama' };
        break;
    case 'lmstudio':
      if (!settings.lmStudioModel)
        return { valid: false, error: 'Falta seleccionar un modelo en LM Studio' };
      break;
  }

  if (isCustom(settings.aiProvider)) {
    const connection = resolveCustomConnection(settings, settings.aiProvider);
    if (!connection) return { valid: false, error: 'Conexión personalizada no encontrada' };
    if (!settings.customGeneralModel) return { valid: false, error: 'Falta seleccionar un modelo para la conexión personalizada' };
  }

  return { valid: true, error: null };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

/**
 * Obtiene el número de tokens de contexto del proveedor/modelo activo.
 * Para proveedores cloud (Gemini, DeepSeek, Kimi) retorna null porque tienen
 * contextos ≥128k y no necesitan chunking.
 *
 * Prioridad:
 * 1. Valor cacheado en settings (ollamaContextLength / lmStudioContextLength) → sin llamada a API
 * 2. Fallback: consulta a la API del proveedor (solo si no hay caché)
 *
 * @param {Object} settings - Objeto de settings ya leído
 * @returns {Promise<number|null>} numCtx o null si no aplica/no disponible
 */
export async function getActiveProviderContextWindow(settings) {
  const provider = settings.aiProvider || 'gemini';

  // Proveedores cloud: contexto ≥128k → sin chunking
  if (CLOUD_PROVIDERS.includes(provider)) {
    return null;
  }

  // Conexiones personalizadas: sin detección automática, se asume un contexto amplio estándar
  if (isCustom(provider)) {
    return 250000;
  }

  if (provider === 'ollama') {
    // 1. Usar valor cacheado si está configurado
    if (settings.ollamaContextLength) return settings.ollamaContextLength;
    // 2. Fallback: consultar API
    if (settings.ollamaModel) {
      const info = await getOllamaModelInfo(settings.ollamaModel, settings.ollamaHost || 'http://localhost:11434');
      return info?.numCtx || null;
    }
  }

  if (provider === 'lmstudio') {
    // 1. Usar valor cacheado si está configurado
    if (settings.lmStudioContextLength) return settings.lmStudioContextLength;
    // 2. Fallback: consultar API
    if (settings.lmStudioModel) {
      const info = await getLMStudioModelInfo(settings.lmStudioModel, settings.lmStudioHost || 'http://localhost:1234/v1');
      return info?.numCtx || null;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Chat con historial nativo (Message Array) — EXCLUSIVO para el chat de la UI
// No usar para resúmenes, tareas u otras llamadas de análisis.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Function-calling nativo (tools) durante la conversación NORMAL del chat —
// ver src/services/ai/tools/index.js (catálogo agregado + dispatcher) y
// tools/taskTools.js (ejecución + guardas de seguridad). Documentado en detalle
// en README.md.
//
// Diseño (evita parsear tool_calls incrementales en streaming): cuando
// `options.tools` viene presente, en vez de una única llamada streaming se hace
// una RONDA DE DETECCIÓN no-streaming — 1 o más llamadas "de una pasada" al
// proveedor activo, ejecutando cada tool call localmente y realimentando el
// resultado, hasta que la respuesta ya no traiga más tool_calls (o se alcance
// el límite duro de iteraciones). Solo el texto final se manda a `onChunk`, de
// una sola vez — no se reimplementa streaming real para el turno con tools.
//
// `codex` queda EXPLÍCITAMENTE FUERA de ESTE mecanismo (arquitectura de proceso
// Main vía SDK propio, protocolo JSONL — no soporta `tools`/function-calling
// nativo, no puede pasar por `_runToolCallingLoop`/`_callChatCompletionOnce`).
// En su lugar tiene su PROPIO camino separado dentro de su propio `case 'codex':`
// (`_runCodexTaskAwareChat`, ver codexTaskBridge.js): una única llamada con
// `outputSchema` forzando JSON `{reply, taskProposal}`, en vez de la ronda de
// detección no-streaming de arriba — reusa `executeTool` para la propuesta,
// pero pierde el streaming en vivo (tradeoff aceptado, ver README §6).
// ---------------------------------------------------------------------------

const MAX_TOOL_ITERATIONS = 4;

/**
 * Resuelve el modelo activo por proveedor con la MISMA cadena de prioridad que
 * ya usa `_runCallChatProviderStreaming` en modo streaming, y hace una única
 * llamada "de una pasada" (no streaming) con `tools` adjuntos.
 *
 * @returns {Promise<{text: string, toolCalls: Array|null, model?: string}>}
 */
async function _callChatCompletionOnce(messages, options, signal, settings, provider) {
  const tools = options.tools;

  switch (provider) {
    case 'gemini': {
      const result = await sendToGeminiChatOnce(messages, { tools, images: options.images || [] }, signal);
      return { ...result, model: undefined };
    }

    case 'openai': {
      if (!settings.openaiApiKey) throw new Error('No se ha configurado la OpenAI API Key en los ajustes.');
      const model = options.model || options.ragModel || settings.openaiModel;
      if (!model) throw new Error('No se ha seleccionado un modelo de OpenAI.');
      const client = new CustomOpenAIProvider({ baseUrl: OPENAI_BASE_URL, apiKey: settings.openaiApiKey, model });
      const result = await client.chatCompletionOnce(messages, { tools }, signal);
      return { ...result, model };
    }

    case 'deepseek': {
      if (!settings.deepseekApiKey) throw new Error('No se ha configurado la DeepSeek API Key en los ajustes.');
      return deepseekChatOnce(messages, { tools, model: options.model }, signal);
    }

    case 'kimi': {
      if (!settings.kimiApiKey) throw new Error('No se ha configurado la Kimi API Key en los ajustes.');
      return kimiChatOnce(messages, { tools, model: options.model }, signal);
    }

    case 'lmstudio': {
      const model = options.model || options.ragModel || settings.lmStudioRagModel || settings.lmStudioModel;
      if (!model) throw new Error('No se ha seleccionado un modelo en LM Studio.');
      const result = await lmStudioChatOnce(messages, { tools, model }, signal);
      return { ...result, model };
    }

    case 'ollama': {
      const model = options.model || options.ragModel || settings.ollamaRagModel || settings.ollamaModel;
      if (!model) throw new Error('No se ha seleccionado un modelo de Ollama en los ajustes.');
      const result = await ollamaChatOnce(model, messages, { tools }, signal);
      return { ...result, model };
    }

    default: {
      if (isCustom(provider)) {
        const connection = resolveCustomConnection(settings, provider);
        if (!connection) throw new Error('Conexión personalizada no encontrada');
        const model = options.model || options.ragModel || settings.customGeneralModel;
        if (!model) throw new Error('No se ha seleccionado un modelo para la conexión personalizada.');
        const client = new CustomOpenAIProvider({ baseUrl: connection.baseUrl, apiKey: connection.apiKey, model });
        const result = await client.chatCompletionOnce(messages, { tools }, signal);
        return { ...result, model };
      }

      throw new Error(`Proveedor de chat no soportado: ${provider}`);
    }
  }
}

/**
 * Loop de tool-calling: alterna llamadas no-streaming con ejecución local de
 * funciones (`executeTool`) hasta que la respuesta ya no traiga
 * tool_calls o se alcance `MAX_TOOL_ITERATIONS`. Nunca cuelga la conversación —
 * al llegar al límite, corta y devuelve el último texto disponible con un aviso
 * defensivo en consola.
 *
 * Corte temprano genérico ("pending UI action"): si el resultado de CUALQUIER
 * función ejecutada trae `question` (string no vacío) + `options` (array no
 * vacío) — la forma que devuelven `create_task`/`update_task`/`delete_task`
 * (`status:'confirmation_required'`, SIEMPRE, ver `taskTools.js` — el schema
 * ya no expone `confirm`, así que la IA nunca puede evitar este paso) y
 * `ask_user` (`status:'ask_user'`, ver `tools/interactionTools.js`) — el loop
 * corta AHÍ MISMO: no sigue ejecutando el resto de `toolCalls` de esa tanda ni
 * vuelve a llamar al proveedor. La condición mira solo la FORMA del resultado
 * (`question`+`options`), nunca el nombre de la función ni su `status`
 * concreto, así que cualquier tool futura que devuelva esa forma dispara el
 * mismo mecanismo sin tocar este archivo de nuevo. El resultado se marca con
 * `pendingAction: {toolName, toolArgs, question, options}` para que la UI
 * (`ChatInterface.jsx`) renderice botones reales en vez de que la IA dependa
 * de que el usuario reconozca y re-escriba una confirmación en texto libre.
 *
 * `pendingAction.toolArgs` viene de `execResult.proposed`/`execResult.task`
 * (el dato YA RESUELTO que devolvió la función de propuesta —
 * `create_task`/`update_task` devuelven `proposed`, `delete_task` devuelve
 * `task`), NUNCA de `call.arguments` crudo (lo que mandó la IA). Motivo: para
 * `update_task` en particular, `call.arguments` puede traer solo un subconjunto
 * de campos (merge parcial de la IA), mientras que `execResult.proposed` ya
 * tiene el merge completo (`{id,title,content,layer,status}`) calculado por
 * `handleUpdateTask`. Si `pendingAction.toolArgs` fuera `call.arguments` sin
 * mergear, el click de confirmación en la UI (`executeConfirmedAction` →
 * `updateTaskConfirmed`) recibiría datos incompletos y pisaría campos que el
 * usuario nunca pidió cambiar. El fallback a `call.arguments` cubre tools
 * futuras que no sigan exactamente este contrato (ninguna `proposed`/`task`).
 *
 * @returns {Promise<{text: string, provider: string, model?: string, streaming: boolean, toolCallsExecuted: Array, pendingAction?: {toolName: string, toolArgs: Object, question: string, options: string[]}}>}
 */
async function _runToolCallingLoop(messages, onChunk, options, signal, settings, provider) {
  let workingMessages = [...messages];
  const toolCallsExecuted = [];
  let lastModel;

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    const result = await _callChatCompletionOnce(workingMessages, options, signal, settings, provider);
    lastModel = result?.model ?? lastModel;
    const toolCalls = result?.toolCalls;

    if (!toolCalls || toolCalls.length === 0) {
      const text = result?.text || 'Sin respuesta';
      if (onChunk) onChunk(text);
      return { text, provider, model: lastModel, streaming: true, toolCallsExecuted };
    }

    // Turno assistant con sus tool_calls — cada adapter de proveedor sabe cómo
    // traducir esta forma genérica a su formato nativo (ver openAIToolChat.js /
    // geminiProvider.js#toGeminiContents).
    workingMessages = [...workingMessages, { role: 'assistant', content: result?.text || '', toolCalls }];

    for (const call of toolCalls) {
      const execResult = await executeTool(call.name, call.arguments || {}, options.toolContext);
      toolCallsExecuted.push({ name: call.name, args: call.arguments || {}, result: execResult });

      const isPendingUiAction =
        execResult &&
        typeof execResult.question === 'string' && execResult.question.trim() &&
        Array.isArray(execResult.options) && execResult.options.length > 0;

      if (isPendingUiAction) {
        const text = result?.text || '';
        if (text && onChunk) onChunk(text);
        return {
          text,
          provider,
          model: lastModel,
          streaming: true,
          toolCallsExecuted,
          pendingAction: {
            // `id` propio y ESTABLE (el id de tool_call que ya asigna el proveedor,
            // ej. "call_x0arttfe") — necesario porque la UI debe poder encontrar este
            // `pendingAction` de nuevo tras un click, sin importar si en ese momento
            // `qaHistory` lo tiene como mensaje individual o como par pregunta/respuesta
            // recargado desde disco (formatos con ids de MENSAJE distintos/inexistentes
            // — ver bug real corregido en ChatInterface.jsx/páginas). El `id` del
            // `pendingAction` en cambio viaja idéntico en ambos formatos.
            id: call.id,
            toolName: call.name,
            // Dato YA RESUELTO por la función de propuesta, no los argumentos
            // crudos de la IA (ver comentario arriba de `_runToolCallingLoop`).
            toolArgs: execResult.proposed || execResult.task || call.arguments || {},
            question: execResult.question,
            options: execResult.options,
          },
        };
      }

      workingMessages = [
        ...workingMessages,
        { role: 'tool', toolCallId: call.id, name: call.name, content: JSON.stringify(execResult) },
      ];
    }
  }

  console.warn('[callChatProviderStreaming] Límite de iteraciones de tool-calling alcanzado sin respuesta final — se corta el turno.');
  const fallbackText = 'No he podido completar la acción en el número de intentos permitido.';
  if (onChunk) onChunk(fallbackText);
  return { text: fallbackText, provider, model: lastModel, streaming: true, toolCallsExecuted };
}

/**
 * Camino de tools EXCLUSIVO de Codex (ver banner arriba de `_runToolCallingLoop`
 * y codexTaskBridge.js) — Codex no soporta tool-calling nativo, solo forzar la
 * respuesta final a JSON válido contra un `outputSchema` (SDK oficial). En vez
 * de la ronda de detección no-streaming genérica de los otros 6 providers, hace
 * UNA sola llamada:
 *
 * 1. Fetchea las tareas existentes (`executeTool('find_tasks', ...)`, mismo
 *    dispatcher que el resto) para inyectarlas en el prompt — Codex no puede
 *    pedirlas en vivo a mitad de turno.
 * 2. Llama a Codex con `CODEX_TASK_OUTPUT_SCHEMA`, forzando `{reply, taskProposal}`.
 * 3. Si `taskProposal` viene con `action`, la propone vía `executeTool` (MISMO
 *    dispatcher/guarda de seguridad que los otros 6 providers) y, si el
 *    resultado trae `{question, options}` (mismo chequeo genérico que usa
 *    `_runToolCallingLoop` más arriba), arma `pendingAction` con el MISMO shape
 *    — reusa el mecanismo de botones/`executeConfirmedAction` ya existente sin
 *    tocar `ChatInterface.jsx`.
 *
 * Tradeoff ACEPTADO explícitamente (ver README §6): sin streaming en vivo para
 * este modo — la respuesta aparece completa de una vez al terminar el turno.
 * Si Codex no respeta el schema (JSON inválido), degrada con gracia: se muestra
 * el texto tal cual como respuesta normal, sin proponer ninguna acción.
 *
 * @returns {Promise<{text: string, provider: 'codex', model?: string, streaming: boolean, pendingAction?: Object}>}
 */
async function _runCodexTaskAwareChat(messages, onChunk, options, signal, settings) {
  const model = options.model || options.ragModel || settings.codexModel || '';
  const reasoningEffort = options.codexReasoningEffort ?? settings.codexReasoningEffort;

  const existingResult = await executeTool('find_tasks', {}, options.toolContext);
  const instructions = buildCodexTaskInstructions(formatExistingTasksForCodex(existingResult?.tasks || []));
  const prompt = [instructions, formatCodexChat(messages)].filter(Boolean).join('\n\n');

  // `onChunk: null` — sin streaming en vivo en este modo (tradeoff aceptado).
  const result = await runCodexInMain(prompt, model, reasoningEffort, null, signal, CODEX_TASK_OUTPUT_SCHEMA);

  let parsed;
  try {
    parsed = JSON.parse(result.text);
  } catch (err) {
    console.error('[callChatProviderStreaming] Codex no devolvió JSON válido para la propuesta de tareas — se degrada a texto plano:', err);
    const fallbackText = result.text || 'Sin respuesta';
    onChunk?.(fallbackText);
    return { text: fallbackText, provider: 'codex', model, streaming: true };
  }

  const reply = parsed.reply || '';
  onChunk?.(reply);

  if (parsed.taskProposal?.action) {
    const { action, ...rawArgs } = parsed.taskProposal;
    // El schema de Codex (modo estricto de OpenAI Structured Outputs, ver
    // codexTaskBridge.js) obliga a que TODOS los campos estén presentes — Codex
    // manda `null` para "no aplica/sin cambio" en vez de omitir la clave.
    // `taskTools.js` (compartido con los otros 6 providers) espera la convención
    // estándar de JS: clave AUSENTE = sin cambio (ver `handleUpdateTask`'s
    // `args?.content !== undefined`) — un `null` explícito NO es lo mismo ahí.
    // Sin esta conversión, un `content: null` de Codex borraría contenido
    // existente de una tarea en vez de preservarlo. Se convierte ACÁ (único lugar
    // específico de Codex) para no meter lógica por-provider en taskTools.js.
    const args = Object.fromEntries(Object.entries(rawArgs).filter(([, v]) => v !== null));
    const execResult = await executeTool(action, args, options.toolContext);

    const isPendingUiAction =
      execResult &&
      typeof execResult.question === 'string' && execResult.question.trim() &&
      Array.isArray(execResult.options) && execResult.options.length > 0;

    if (isPendingUiAction) {
      return {
        text: reply,
        provider: 'codex',
        model,
        streaming: true,
        pendingAction: {
          // `result.requestId` ya es único por request de Codex — no hace falta
          // generar otro id (ver `call.id` equivalente en `_runToolCallingLoop`).
          id: result.requestId,
          toolName: action,
          toolArgs: execResult.proposed || execResult.task || args,
          question: execResult.question,
          options: execResult.options,
        },
      };
    }
  }

  return { text: reply || 'Sin respuesta', provider: 'codex', model, streaming: true };
}

/**
 * Lógica interna de chat con array de mensajes. Se ejecuta dentro de la tarea encolada.
 * @param {Array<{role:'system'|'user'|'assistant', content: string}>} messages
 * @param {Function} onChunk
 * @param {Object} options
 */
async function _runCallChatProviderStreaming(messages, onChunk, options, signal) {
  const settings = await getSettings();
  const provider = options.providerOverride || settings.aiProvider || 'gemini';
  const images = options.images || [];

  console.log(`[callChatProviderStreaming] Provider: ${provider}`);

  // Function-calling nativo: SOLO se activa si el caller adjuntó `options.tools`
  // (los 2 call sites reales de conversación normal — ver README). `codex` queda
  // fuera de ESTA ronda genérica (ver banner arriba de `_runToolCallingLoop`):
  // tiene su PROPIO camino separado dentro de su propio `case 'codex':` más abajo
  // (`_runCodexTaskAwareChat`), no `_runToolCallingLoop`.
  if (options.tools && options.tools.length > 0 && provider !== 'codex') {
    return _runToolCallingLoop(messages, onChunk, options, signal, settings, provider);
  }

  switch (provider) {
    case 'gemini': {
      const fullResponse = await sendToGeminiChatStreaming(messages, onChunk, images, signal);
      return { text: fullResponse || 'Sin respuesta', provider: 'gemini', streaming: true };
    }

    case 'codex': {
      const model = options.model || options.ragModel || settings.codexModel || '';
      // Con `options.tools` presente, Codex usa su propio camino de propuesta
      // única vía JSON estructurado (ver banner de `_runCodexTaskAwareChat`) en
      // vez del streaming normal — sin esto, cero cambios respecto a hoy.
      if (options.tools && options.tools.length > 0) {
        return _runCodexTaskAwareChat(messages, onChunk, options, signal, settings);
      }
      const reasoningEffort = options.codexReasoningEffort ?? settings.codexReasoningEffort;
      const result = await runCodexInMain(formatCodexChat(messages), model, reasoningEffort, onChunk, signal);
      return { text: result.text || 'Sin respuesta', provider: 'codex', model, streaming: true };
    }

    case 'openai': {
      if (!settings.openaiApiKey) throw new Error('No se ha configurado la OpenAI API Key en los ajustes.');
      const model = options.model || options.ragModel || settings.openaiModel;
      if (!model) throw new Error('No se ha seleccionado un modelo de OpenAI.');
      const client = new CustomOpenAIProvider({ baseUrl: OPENAI_BASE_URL, apiKey: settings.openaiApiKey, model });
      const fullResponse = await client.chatCompletionStreaming(messages, onChunk, signal);
      return { text: fullResponse || 'Sin respuesta', provider: 'openai', model, streaming: true };
    }

    case 'deepseek': {
      if (!settings.deepseekApiKey) throw new Error('No se ha configurado la DeepSeek API Key en los ajustes.');
      const fullResponse = await deepseekChatStreaming(messages, onChunk, options.model || null, signal);
      return { text: fullResponse || 'Sin respuesta', provider: 'deepseek', streaming: true };
    }

    case 'kimi': {
      if (!settings.kimiApiKey) throw new Error('No se ha configurado la Kimi API Key en los ajustes.');
      const fullResponse = await kimiChatStreaming(messages, onChunk, options.model || null, signal);
      return { text: fullResponse || 'Sin respuesta', provider: 'kimi', streaming: true };
    }

    case 'lmstudio': {
      // Prioridad: override explícito > ragModel de contexto > modelo de chat configurado > modelo general
      const model = options.model || options.ragModel || settings.lmStudioRagModel || settings.lmStudioModel;
      if (!model) throw new Error('No se ha seleccionado un modelo en LM Studio.');
      const fullResponse = await lmStudioChatStreaming(messages, onChunk, model, signal);
      return { text: fullResponse || 'Sin respuesta', provider: 'lmstudio', model, streaming: true };
    }

    case 'ollama': {
      // Prioridad: override explícito > ragModel de contexto > modelo de chat configurado > modelo general
      const model = options.model || options.ragModel || settings.ollamaRagModel || settings.ollamaModel;
      if (!model) throw new Error('No se ha seleccionado un modelo de Ollama en los ajustes.');
      console.log(`[callChatProviderStreaming] Ollama /api/chat modelo: ${model}`);
      const fullResponse = await ollamaChatStreaming(model, messages, onChunk, images, signal);
      return { text: fullResponse || 'Sin respuesta', provider: 'ollama', model, streaming: true };
    }

    default: {
      if (isCustom(provider)) {
        const connection = resolveCustomConnection(settings, provider);
        if (!connection) throw new Error('Conexión personalizada no encontrada');
        const model = options.model || options.ragModel || settings.customGeneralModel;
        if (!model) throw new Error('No se ha seleccionado un modelo para la conexión personalizada.');
        const client = new CustomOpenAIProvider({
          baseUrl: connection.baseUrl,
          apiKey: connection.apiKey,
          model,
        });
        const fullResponse = await client.chatCompletionStreaming(messages, onChunk, signal);
        return { text: fullResponse || 'Sin respuesta', provider, model, streaming: true };
      }

      throw new Error(`Proveedor de chat no soportado: ${provider}`);
    }
  }
}

/**
 * Envía un array de mensajes (historial completo) al proveedor de IA configurado,
 * usando el protocolo nativo de cada proveedor (Multi-turn chat).
 *
 * EXCLUSIVO para el chat interactivo. Para resúmenes y análisis usa callProvider.
 *
 * @param {Array<{role:'system'|'user'|'assistant', content: string}>} messages
 * @param {Function} onChunk - Callback que recibe cada chunk de la respuesta
 * @param {Object} options - { model, ragModel, images, providerOverride, queueMeta }
 * @returns {Promise<{text: string, provider: string, streaming: boolean}>}
 */
export async function callChatProviderStreaming(messages, onChunk, options = {}) {
  let engine = 'IA';
  try {
    const settings = await getSettings();
    const provider = options.providerOverride || settings.aiProvider || 'gemini';
    engine = _resolveEngineName(settings, provider, options);
  } catch {
    // fallback
  }

  const meta = {
    ...(options.queueMeta || {}),
    name: options.queueMeta?.name || 'Chat con IA',
    type: options.queueMeta?.type || AI_TASK_TYPES.CHAT,
    engine: options.queueMeta?.engine || engine,
  };

  return aiQueueService.enqueue(
    (signal) => _runCallChatProviderStreaming(messages, onChunk, options, signal),
    meta
  );
}

// Re-exportar funciones útiles de proveedores
export { getDeepseekAvailableModels, getKimiAvailableModels, getLMStudioModels };
