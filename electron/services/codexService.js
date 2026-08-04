/* global require, module, process */
const { spawn: nodeSpawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const activeRequests = new Map();
const activeLogins = new Map();
const REASONING_EFFORTS = new Set(['minimal', 'low', 'medium', 'high', 'xhigh']);
const DEFAULT_CLI_LIMITS = {
  maxStdoutBytes: 1024 * 1024,
  maxStderrBytes: 256 * 1024,
  maxOutputBytes: 1280 * 1024,
};
let sdkLoader = () => import('@openai/codex-sdk');
let spawnProcess = nodeSpawn;
let executableResolver = codexExecutable;

function createError(message, code) { const error = new Error(message); error.code = code; return error; }

function codexExecutable() {
  const target = process.platform === 'darwin'
    ? (process.arch === 'arm64' ? 'aarch64-apple-darwin' : 'x86_64-apple-darwin')
    : process.platform === 'win32'
      ? (process.arch === 'arm64' ? 'aarch64-pc-windows-msvc' : 'x86_64-pc-windows-msvc')
      : (process.arch === 'arm64' ? 'aarch64-unknown-linux-musl' : 'x86_64-unknown-linux-musl');
  const packageName = process.platform === 'darwin' ? `@openai/codex-darwin-${process.arch}` : process.platform === 'win32' ? `@openai/codex-win32-${process.arch}` : `@openai/codex-linux-${process.arch}`;
  const binary = process.platform === 'win32' ? 'codex.exe' : 'codex';
  const candidates = [
    path.resolve(__dirname, `../../node_modules/${packageName}/vendor/${target}/bin/${binary}`),
    path.join(process.resourcesPath || '', `app.asar.unpacked/node_modules/${packageName}/vendor/${target}/bin/${binary}`),
  ];
  const executable = candidates.find(fs.existsSync);
  if (!executable) throw createError('Codex CLI no está disponible. Reinstalá AIRecorder o Codex.', 'CODEX_CLI_MISSING');
  return executable;
}

function neutralWorkingDirectory() { const dir = path.join(os.tmpdir(), 'airecorder-codex'); fs.mkdirSync(dir, { recursive: true }); return dir; }
function normalizeError(error) {
  const message = error?.message || String(error);
  if (/not logged in|login|authentication|unauthorized|401/i.test(message)) return createError('La sesión de ChatGPT/Codex no está iniciada o expiró. Conectá tu suscripción desde Ajustes.', 'CODEX_LOGIN_REQUIRED');
  if (/json|parse|event/i.test(message)) return createError('Codex devolvió eventos JSONL inválidos. Actualizá Codex e intentá nuevamente.', 'CODEX_JSONL_INVALID');
  return createError(`Codex no pudo completar la solicitud: ${message}`, 'CODEX_REQUEST_FAILED');
}
function approvedDeviceAuthUrl(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && url.hostname === 'auth.openai.com' && !url.username && !url.password && !url.port ? url.toString() : null; } catch { return null; }
}
function stripAnsi(value) {
  return String(value || '')
    .replace(/[\u001B\u009B](?:\[[0-?]*[ -/]*[@-~]|[0-?]*[ -/]*[@-~])/g, '')
    .replace(/\\(?:x1[bB]|u001[bB])\[[0-?]*[ -/]*[@-~]/g, '')
    .replace(/\[(?:\d{1,3}(?:;\d{1,3})*)m/g, '');
}
function extractDeviceCode(text) {
  const normalized = stripAnsi(text).replace(/\s+/g, ' ');
  const match = normalized.match(/\b(?:(?:enter\s+(?:this|the)\s+)|your\s+)?(?:one[- ]time|device)\s+code\b(?:\s*\(\s*expires?\s+in\s+\d+\s+minutes?\s*\))?\s*(?:(?:is|:)\s*)?([A-Z0-9]{4}(?:-[A-Z0-9]{5}|[A-Z0-9]{5}))(?![A-Z0-9-])/i);
  if (!match) return null;
  if (!match[1].includes('-') && !/\d/.test(match[1])) return null;
  const compact = match[1].replace('-', '').toUpperCase();
  return `${compact.slice(0, 4)}-${compact.slice(4)}`;
}
function publicProgress(text, requestId) {
  const sanitized = stripAnsi(text)
    .replace(/(?:token|access[_ -]?token|refresh[_ -]?token|authorization|password)[:=\s]+\S+/ig, '[redacted]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(-8192);
  const urlCandidate = sanitized.match(/https?:\/\/[^\s)\]}]+/i)?.[0]?.replace(/[.,;]+$/, '') || '';
  const url = approvedDeviceAuthUrl(urlCandidate);
  const code = extractDeviceCode(sanitized);
  return { requestId, phase: 'device-auth', url, code };
}

function emitDelta(item, textByItem, onChunk) {
  const text = item?.text || '';
  const previous = textByItem.get(item?.id) || '';
  const delta = text.startsWith(previous) ? text.slice(previous.length) : (text === previous ? '' : text);
  textByItem.set(item?.id, text);
  if (delta) onChunk?.(delta);
}

function normalizeReasoningEffort(value) {
  if (value == null || value === '') return undefined;
  if (typeof value !== 'string' || !REASONING_EFFORTS.has(value)) {
    throw createError('El nivel de razonamiento de Codex no es válido.', 'CODEX_REASONING_EFFORT_INVALID');
  }
  return value;
}

async function run({ requestId, prompt, model, reasoningEffort, onChunk, signal, outputSchema }) {
  if (!requestId || typeof prompt !== 'string') throw createError('Solicitud Codex inválida.', 'CODEX_REQUEST_INVALID');
  if (activeRequests.has(requestId)) throw createError('El identificador de solicitud ya está en uso.', 'CODEX_REQUEST_DUPLICATE');
  const modelReasoningEffort = normalizeReasoningEffort(reasoningEffort);
  const controller = new AbortController(); const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) controller.abort();
  activeRequests.set(requestId, controller);
  try {
    const { Codex } = await sdkLoader();
    const threadOptions = { model: model || undefined, workingDirectory: neutralWorkingDirectory(), skipGitRepoCheck: true, sandboxMode: 'read-only', approvalPolicy: 'never', webSearchMode: 'disabled', networkAccessEnabled: false };
    if (modelReasoningEffort) threadOptions.modelReasoningEffort = modelReasoningEffort;
    const thread = new Codex().startThread(threadOptions);
    const { events } = await thread.runStreamed(prompt, { signal: controller.signal, ...(outputSchema ? { outputSchema } : {}) });
    const textByItem = new Map(); let finalResponse = '';
    for await (const event of events) {
      if ((event.type === 'item.updated' || event.type === 'item.completed') && event.item?.type === 'agent_message') {
        // Con `outputSchema` la respuesta final es JSON estructurado — emitir los
        // deltas incrementales mostraría fragmentos de JSON a medio construir, así
        // que se saltea `emitDelta` (sin streaming en vivo para este modo, ver
        // codexTaskBridge.js). `finalResponse` se sigue actualizando igual.
        if (!outputSchema) emitDelta(event.item, textByItem, onChunk);
        finalResponse = event.item.text || finalResponse;
      }
      if (event.type === 'turn.failed' || event.type === 'error') throw createError(event.error?.message || event.message || 'Error de Codex.', 'CODEX_REQUEST_FAILED');
    }
    if (!finalResponse) throw createError('Codex no devolvió una respuesta de texto.', 'CODEX_JSONL_INVALID');
    return { text: finalResponse, requestId, threadId: thread.id };
  } catch (error) {
    if (controller.signal.aborted) { const cancelled = createError('Solicitud Codex cancelada.', 'CODEX_CANCELLED'); cancelled.name = 'AbortError'; throw cancelled; }
    // `normalizeError` mapea a un mensaje genérico para el usuario — sin este log el
    // mensaje ORIGINAL del SDK/CLI se perdía por completo, haciendo imposible
    // diagnosticar el motivo real (ej. un `outputSchema` rechazado por validación
    // estricta) a partir de lo único que veía el usuario ("Codex devolvió eventos
    // JSONL inválidos").
    console.error('[codexService] Error crudo en run():', error);
    throw normalizeError(error);
  } finally { signal?.removeEventListener('abort', abort); activeRequests.delete(requestId); }
}
function cancel(requestId) { return activeRequests.get(requestId)?.abort() || false; }
function runCli(args, { timeout = 15000, onOutput, signal, ...limits } = {}) {
  return new Promise((resolve, reject) => {
    let child; try { child = spawnProcess(executableResolver(), args, { shell: false, stdio: ['ignore', 'pipe', 'pipe'] }); } catch (error) { reject(normalizeError(error)); return; }
    const { maxStdoutBytes, maxStderrBytes, maxOutputBytes } = { ...DEFAULT_CLI_LIMITS, ...limits };
    let stdout = ''; let stderr = ''; let output = ''; let stdoutBytes = 0; let stderrBytes = 0;
    let settled = false;
    let timer;
    const cleanup = () => { clearTimeout(timer); signal?.removeEventListener('abort', abort); child.stdout?.removeListener('data', receiveStdout); child.stderr?.removeListener('data', receiveStderr); };
    const fail = error => {
      if (settled) return;
      settled = true;
      cleanup();
      try { child.kill(); } catch {}
      reject(error);
    };
    const receive = (chunk, stream) => {
      if (settled) return;
      const text = String(chunk);
      const bytes = Buffer.byteLength(text);
      if (stream === 'stdout') { stdoutBytes += bytes; stdout += text; } else { stderrBytes += bytes; stderr += text; }
      output += text;
      if (stdoutBytes > maxStdoutBytes || stderrBytes > maxStderrBytes || stdoutBytes + stderrBytes > maxOutputBytes) {
        fail(createError('La salida del comando de Codex superó el límite permitido.', 'CODEX_CLI_OUTPUT_LIMIT'));
        return;
      }
      onOutput?.(text);
    };
    const receiveStdout = chunk => receive(chunk, 'stdout');
    const receiveStderr = chunk => receive(chunk, 'stderr');
    const abort = () => fail(createError('Comprobación de sesión Codex cancelada.', 'CODEX_CANCELLED'));
    child.stdout?.on('data', receiveStdout); child.stderr?.on('data', receiveStderr);
    timer = setTimeout(() => fail(createError('El comando de Codex agotó el tiempo de espera.', 'CODEX_CLI_TIMEOUT')), timeout);
    child.once('error', error => fail(normalizeError(error)));
    child.once('close', code => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve({ ok: code === 0, stdout, stderr, output });
    });
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
  });
}
function catalogArray(value) {
  if (Array.isArray(value)) return { models: value, defaultModel: null };
  if (!value || typeof value !== 'object') return null;
  const models = Array.isArray(value.models) ? value.models : Array.isArray(value.data) ? value.data : null;
  if (!models) return null;
  return { models, defaultModel: value.defaultModel || value.default_model || null };
}
function normalizeEfforts(value, modelId) {
  if (value == null) return [];
  if (!Array.isArray(value)) throw createError(`El catálogo de Codex tiene reasoning efforts inválidos para ${modelId}.`, 'CODEX_MODELS_SHAPE_INVALID');
  const efforts = value.map(item => typeof item === 'string' ? item : item?.reasoningEffort || item?.reasoning_effort || item?.effort || item?.value || item?.name);
  if (efforts.some(effort => typeof effort !== 'string')) throw createError(`El catálogo de Codex anuncia un reasoning effort inválido para ${modelId}.`, 'CODEX_MODELS_SHAPE_INVALID');
  return [...new Set(efforts.filter(effort => REASONING_EFFORTS.has(effort)))];
}
function normalizeCatalog(payload) {
  const catalog = catalogArray(payload);
  if (!catalog) throw createError('Codex devolvió un catálogo de modelos con formato inválido.', 'CODEX_MODELS_SHAPE_INVALID');
  return catalog.models.filter(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw createError('Codex devolvió una entrada de modelo inválida.', 'CODEX_MODELS_SHAPE_INVALID');
    return item.hidden !== true && item.isHidden !== true && item.is_hidden !== true && item.visible !== false && item.isVisible !== false && item.is_visible !== false && !['hidden', 'hide', 'none'].includes(item.visibility);
  }).map(item => {
    const id = item.id || item.model || item.slug;
    if (typeof id !== 'string' || !id.trim()) throw createError('Codex devolvió un modelo sin identificador válido.', 'CODEX_MODELS_SHAPE_INVALID');
    const model = item.model || id;
    if (typeof model !== 'string' || !model.trim()) throw createError(`Codex devolvió un nombre de modelo inválido para ${id}.`, 'CODEX_MODELS_SHAPE_INVALID');
    const supportedReasoningEfforts = normalizeEfforts(item.supportedReasoningEfforts ?? item.supported_reasoning_efforts ?? item.supportedReasoningLevels ?? item.supported_reasoning_levels ?? item.reasoningEfforts ?? item.reasoning_efforts, id);
    const advertisedDefaultReasoningEffort = item.defaultReasoningEffort ?? item.default_reasoning_effort ?? item.defaultReasoningLevel ?? item.default_reasoning_level ?? null;
    const defaultReasoningEffort = supportedReasoningEfforts.includes(advertisedDefaultReasoningEffort) ? advertisedDefaultReasoningEffort : null;
    const displayName = item.displayName ?? item.display_name ?? item.name ?? id;
    const description = item.description ?? '';
    if (typeof displayName !== 'string' || typeof description !== 'string') throw createError(`Codex devolvió metadatos inválidos para ${id}.`, 'CODEX_MODELS_SHAPE_INVALID');
    return {
      id,
      model,
      displayName,
      description,
      supportedReasoningEfforts,
      defaultReasoningEffort,
      isDefault: item.isDefault === true || item.is_default === true || item.default === true || catalog.defaultModel === id || catalog.defaultModel === model,
    };
  });
}
async function listModels({ signal, timeout = 15000, ...limits } = {}) {
  const result = await runCli(['debug', 'models'], { signal, timeout, ...limits });
  if (!result.ok) throw createError(`Codex no pudo listar modelos${result.stderr.trim() ? `: ${result.stderr.trim()}` : '.'}`, 'CODEX_MODELS_COMMAND_FAILED');
  let payload;
  try { payload = JSON.parse(result.stdout.trim()); } catch { throw createError('Codex devolvió JSON inválido al listar modelos.', 'CODEX_MODELS_JSON_INVALID'); }
  return normalizeCatalog(payload);
}
async function getStatus({ signal } = {}) { try { const result = await runCli(['login', 'status'], { signal }); return { available: true, connected: result.ok, message: result.output.trim() }; } catch (error) { return { available: false, connected: false, error: normalizeError(error).message }; } }
async function startLogin({ requestId, onProgress, timeoutMs = 120000, statusPollIntervalMs = 1500 } = {}) {
  if (!requestId) return { success: false, available: true, connected: false, error: 'Falta el identificador del inicio de sesión Codex.' };
  if (activeLogins.has(requestId)) return { success: false, available: true, connected: false, error: 'El inicio de sesión Codex ya está activo.' };
  let publicOutput = '';
  let publishedUrl = null;
  let publishedCode = null;
  const emit = text => {
    publicOutput = `${publicOutput}${text}`.slice(-8192);
    const progress = publicProgress(publicOutput, requestId);
    const update = { requestId, phase: progress.phase };
    if (progress.url && progress.url !== publishedUrl) { publishedUrl = progress.url; update.url = progress.url; }
    if (progress.code && progress.code !== publishedCode) { publishedCode = progress.code; update.code = progress.code; }
    if (update.url || update.code) {
      onProgress?.(update);
    }
  };
  return new Promise((resolve) => {
    let child;
    try { child = spawnProcess(executableResolver(), ['login', '--device-auth'], { shell: false, stdio: ['ignore', 'pipe', 'pipe'] }); }
    catch (error) { resolve({ success: false, available: true, connected: false, error: normalizeError(error).message }); return; }

    let settled = false;
    let pollTimer = null;
    let timeoutTimer = null;
    let statusPromise = null;
    const statusController = new AbortController();
    const receive = chunk => emit(String(chunk));
    const pollInterval = Number.isFinite(statusPollIntervalMs) && statusPollIntervalMs > 0 ? statusPollIntervalMs : 1500;

    const detach = () => {
      clearTimeout(pollTimer);
      clearTimeout(timeoutTimer);
      child.stdout?.removeListener('data', receive);
      child.stderr?.removeListener('data', receive);
      child.removeListener?.('error', onError);
      child.removeListener?.('close', onClose);
      activeLogins.delete(requestId);
    };
    const finish = (result, { kill = false } = {}) => {
      if (settled) return false;
      settled = true;
      statusController.abort();
      detach();
      if (kill && !child.killed) { try { child.kill(); } catch {} }
      resolve(result);
      return true;
    };
    const checkStatus = () => {
      if (!statusPromise) statusPromise = getStatus({ signal: statusController.signal }).finally(() => { statusPromise = null; });
      return statusPromise;
    };
    const pollStatus = async () => {
      const status = await checkStatus();
      if (settled) return;
      if (status.connected) {
        finish({ success: true, ...status, message: status.message }, { kill: true });
        return;
      }
      pollTimer = setTimeout(pollStatus, pollInterval);
    };
    const onError = error => finish({ success: false, available: true, connected: false, error: normalizeError(error).message });
    const onClose = async code => {
      if (settled) return;
      clearTimeout(pollTimer);
      const status = await checkStatus();
      if (settled) return;
      finish({ success: code === 0 && status.connected, ...status, message: status.message });
    };

    child.stdout?.on('data', receive);
    child.stderr?.on('data', receive);
    child.once('error', onError);
    child.once('close', onClose);
    activeLogins.set(requestId, {
      cancel: () => finish({ success: false, available: true, connected: false, error: 'Inicio de sesión Codex cancelado.' }, { kill: true }),
    });
    timeoutTimer = setTimeout(() => finish({ success: false, available: true, connected: false, error: 'El inicio de sesión de Codex agotó el tiempo de espera. Cancelá e intentá nuevamente.' }, { kill: true }), timeoutMs);
    pollTimer = setTimeout(pollStatus, pollInterval);
  });
}
function cancelLogin(requestId) { return activeLogins.get(requestId)?.cancel() || false; }
module.exports = { run, cancel, getStatus, listModels, startLogin, cancelLogin, __setSdkLoader: loader => { sdkLoader = loader; }, __setSpawn: spawn => { spawnProcess = spawn; }, __setExecutableResolver: resolver => { executableResolver = resolver; }, __resetForTests: () => { activeRequests.clear(); for (const login of activeLogins.values()) login.cancel(); activeLogins.clear(); sdkLoader = () => import('@openai/codex-sdk'); spawnProcess = nodeSpawn; executableResolver = codexExecutable; }, __emitDelta: emitDelta, __approvedDeviceAuthUrl: approvedDeviceAuthUrl, __extractDeviceCode: extractDeviceCode, __publicProgress: publicProgress, __normalizeCatalog: normalizeCatalog, __normalizeReasoningEffort: normalizeReasoningEffort };
