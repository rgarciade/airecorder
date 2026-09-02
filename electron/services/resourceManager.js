/**
 * Fuente única de verdad en runtime del inventario de modelos Whisper, la
 * cola de descargas y el chequeo de espacio (design.md — Technical Approach).
 * Node orquesta, Python ejecuta: este módulo nunca descarga ni transcribe
 * directamente, solo spawnea `audio_sync_analyzer resources <subcomando>`
 * (dispatch temprano, D5) y parsea su protocolo de stdout
 * `PROGRESS:`/`DONE:`/`ERROR:` (extiende el patrón ya usado en
 * `transcriptionManager.js`).
 *
 * El inventario NO se persiste (D1): se deriva del filesystem en cada
 * `rescan()`. Solo `settings.whisperModel` (fuera de este módulo) es
 * persistente.
 *
 * Testabilidad: `spawnProcess`, `executableResolver` y `getDefaultModel` son
 * inyectables vía `__setSpawn`/`__setExecutableResolver`/
 * `__setGetDefaultModel` (mismo patrón que `codexService.js`). Los resolvers
 * reales solo hacen `require('electron')` / `require('../utils/paths')` de
 * forma PEREZOSA (dentro de la función, nunca a nivel de módulo), así que
 * importar este archivo fuera de un proceso Electron real no explota — solo
 * explotaría si se INVOCA el resolver real sin haber inyectado un mock antes,
 * cosa que los tests nunca hacen.
 */
const { spawn: nodeSpawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const dbService = require('../database/dbService');
const { getModelCatalog, getCatalogEntry } = require('./resources/modelCatalog');
const { scanCache, repoDirName } = require('./resources/hfCacheScanner');

const SPACE_MARGIN_BYTES = 500 * 1024 * 1024; // 500MB de margen (D4)
const CANCEL_GRACE_MS = 3000; // SIGTERM -> SIGKILL (D6)
const QUEUE_GUARD_QUERY = "SELECT 1 FROM transcription_queue WHERE model = ? AND status IN ('pending','processing') LIMIT 1";

function defaultExecutableResolver() {
  // Reutiliza el mismo binario/script que `transcriptionManager.js`
  // (runTranscriptionProcess): el dispatch de "resources" vive DENTRO de
  // audio_sync_analyzer.py (D5), no hay binario separado.
  const { app } = require('electron');
  const isDev = !app.isPackaged;
  if (isDev) {
    const pythonPath = '/Users/raul.garciad/Proyectos/personal/airecorder/venv/bin/python';
    const systemPython = process.platform === 'win32' ? 'python' : 'python3';
    const executablePath = fs.existsSync(pythonPath) ? pythonPath : systemPython;
    const scriptPath = path.join(__dirname, '../../python/audio_sync_analyzer.py');
    return { executablePath, baseArgs: [scriptPath] };
  }
  const resourcesPath = process.resourcesPath;
  const executablePath = path.join(resourcesPath, 'python-bin', 'audio_sync_analyzer');
  return { executablePath, baseArgs: [] };
}

function defaultGetDefaultModel() {
  const { getSetting } = require('../utils/paths');
  return getSetting('whisperModel');
}

/**
 * Inyectable por el mismo motivo que `getDefaultModel`/`executableResolver`:
 * este archivo es CJS puro (`require`/`module.exports`, sin sintaxis
 * import/export), así que cuando se carga vía `import()` dinámico desde un
 * test ESM, sus `require()` internos resuelven por el cache NATIVO de Node
 * en lugar del grafo instrumentado de Vite — un `import dbService from ...`
 * en el test y este `require('../database/dbService')` pueden terminar
 * siendo DOS instancias distintas del singleton (mismo gotcha documentado en
 * `test/unit/electron/utils/paths.test.js`). Inyectar la dependencia evita
 * depender de esa identidad de módulo compartida.
 */
function defaultHasQueuedTaskForModel(modelId) {
  return Boolean(dbService.db?.prepare(QUEUE_GUARD_QUERY).get(modelId));
}

let spawnProcess = nodeSpawn;
let executableResolver = defaultExecutableResolver;
let getDefaultModel = defaultGetDefaultModel;
let hasQueuedTaskForModel = defaultHasQueuedTaskForModel;

class ResourceManager {
  constructor() {
    this.catalog = getModelCatalog();
    this.cacheDir = null;
    this.downloadQueue = []; // ids en espera (no incluye la activa)
    this.active = null; // id de la descarga activa, o null
    this.activeProcess = null;
    this.activeProgress = { receivedBytes: 0, totalBytes: null };
    this.cancellingId = null;
    this.cancelKillTimer = null;
    this.errors = new Map(); // id -> { code, detail } (efímero, D1)
    this.deletingIds = new Set(); // ids con borrado en curso (evita isInstalled() stale mientras corre el proceso async)
    this.items = [];
    this.freeBytes = 0;
    this.totalBytes = 0;
    this.onUpdateCallback = null;
  }

  setUpdateCallback(callback) {
    this.onUpdateCallback = callback;
  }

  emitUpdate() {
    if (this.onUpdateCallback) this.onUpdateCallback(this.getSnapshot());
  }

  // ── Arranque / escaneo ───────────────────────────────────────────────────

  /**
   * Resuelve el directorio de caché HF (D2): fija la ruta pero al valor por
   * defecto de `huggingface_hub`, para no reubicar la caché del usuario.
   */
  resolveCacheDir() {
    if (process.env.HF_HUB_CACHE) return process.env.HF_HUB_CACHE;
    if (process.env.HF_HOME) return path.join(process.env.HF_HOME, 'hub');
    return path.join(os.homedir(), '.cache', 'huggingface', 'hub');
  }

  /**
   * Snapshot inicial al arrancar la app (INV3): detecta modelos ya
   * presentes en la caché del SO y los marca `installed` sin descargar nada.
   * @param {string} [cacheDirOverride] - solo para tests
   */
  init(cacheDirOverride) {
    this.cacheDir = cacheDirOverride || this.resolveCacheDir();
    return this.rescan();
  }

  /** Fuerza un re-escaneo de disco + espacio y devuelve el snapshot resultante. */
  refresh() {
    return this.rescan();
  }

  rescan() {
    this.items = this.computeItems();
    const { freeBytes, totalBytes } = this.statfsCacheDirAncestor();
    this.freeBytes = freeBytes;
    this.totalBytes = totalBytes;
    return this.getSnapshot();
  }

  computeItems() {
    const scanResults = scanCache(this.cacheDir, this.catalog);
    return this.catalog.map((entry) => {
      const scan = scanResults.find((result) => result.id === entry.id);
      const error = this.errors.get(entry.id) || null;
      let state = 'not-installed';
      if (this.active === entry.id) state = 'downloading';
      else if (this.downloadQueue.includes(entry.id)) state = 'queued';
      else if (this.deletingIds.has(entry.id)) state = 'deleting';
      else if (scan?.installed) state = 'installed';
      else if (error) state = 'error';

      return {
        id: entry.id,
        repoId: entry.repoId,
        estimatedBytes: entry.estimatedBytes,
        state,
        installedBytes: scan?.installed ? scan.installedBytes : null,
        path: scan?.installed ? scan.path : null,
        recommended: entry.recommended,
        error,
      };
    });
  }

  isInstalled(id) {
    const item = this.items.find((entry) => entry.id === id);
    return item?.state === 'installed';
  }

  // ── Snapshot / contrato IPC ──────────────────────────────────────────────

  getSnapshot() {
    const queue = this.buildQueueEntries();
    return {
      ok: true,
      cacheDir: this.cacheDir,
      freeBytes: this.freeBytes,
      totalBytes: this.totalBytes,
      items: this.items,
      queue,
      active: this.active ? queue[0] : null,
    };
  }

  buildQueueEntries() {
    const entries = [];
    const total = (this.active ? 1 : 0) + this.downloadQueue.length;
    let position = 1;

    if (this.active) {
      entries.push({
        id: this.active,
        state: 'downloading',
        receivedBytes: this.activeProgress.receivedBytes,
        totalBytes: this.activeProgress.totalBytes,
        percent: this.computePercent(this.activeProgress),
        position,
        total,
      });
      position += 1;
    }

    for (const id of this.downloadQueue) {
      entries.push({ id, state: 'queued', receivedBytes: 0, totalBytes: null, percent: 0, position, total });
      position += 1;
    }

    return entries;
  }

  computePercent({ receivedBytes, totalBytes }) {
    if (!totalBytes) return 0;
    return Math.min(100, Math.round((receivedBytes / totalBytes) * 100));
  }

  // ── Espacio (D4) ─────────────────────────────────────────────────────────

  /**
   * `fs.statfsSync` puede lanzar (permisos, filesystem raro, `HF_HOME` roto
   * apuntando a un ancestro no accesible, etc.). Nunca debe propagar: degrada
   * con gracia a `{ freeBytes: null, totalBytes: null }` y logueá el error
   * (mismo criterio que los fallbacks de arranque en `main.js#initApp` —
   * `console.error` en vez de relanzar — que además queda capturado por
   * Sentry vía el override global de `console.error` en `main.js`).
   */
  statfsCacheDirAncestor() {
    let dir = this.cacheDir;
    while (dir && !fs.existsSync(dir)) {
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
    try {
      const stat = fs.statfsSync(dir);
      return { freeBytes: stat.bavail * stat.bsize, totalBytes: stat.blocks * stat.bsize };
    } catch (error) {
      console.error('[ResourceManager] Error calculando espacio en disco (statfsSync):', error?.message || error);
      return { freeBytes: null, totalBytes: null };
    }
  }

  checkSpace(id) {
    const entry = getCatalogEntry(id);
    if (!entry) return { ok: false, error: 'unknown-model' };

    const { freeBytes, totalBytes } = this.statfsCacheDirAncestor();
    const requiredBytes = entry.estimatedBytes + SPACE_MARGIN_BYTES;
    // `freeBytes` puede ser `null` cuando `statfsSync` falló (ver
    // `statfsCacheDirAncestor`): eso significa "no se pudo verificar el
    // espacio", NO "no hay espacio suficiente". Antes, `null >= requiredBytes`
    // coaccionaba a `0 >= requiredBytes` y siempre daba `false`, bloqueando el
    // flujo de descarga como si faltara espacio (CRITICAL, fix post-review
    // PR2). Se distingue explícitamente con `sufficient: null` para que el
    // consumidor (IPC renderer) pueda diferenciar ambos casos.
    const sufficient = freeBytes == null ? null : freeBytes >= requiredBytes;

    return {
      ok: true,
      sufficient,
      freeBytes,
      totalBytes,
      requiredBytes,
      estimatedBytes: entry.estimatedBytes,
      remainingAfterBytes: freeBytes == null ? null : freeBytes - entry.estimatedBytes,
    };
  }

  // ── Cola de descargas (DL2) ──────────────────────────────────────────────

  download(id) {
    const entry = getCatalogEntry(id);
    if (!entry) return { ok: false, error: 'unknown-model' };
    if (this.active === id || this.downloadQueue.includes(id)) return { ok: false, error: 'already-queued' };

    const currentItem = this.items.find((item) => item.id === id);
    if (currentItem?.state === 'installed') return { ok: false, error: 'already-installed' };

    const space = this.checkSpace(id);
    if (space.ok && space.sufficient === false) {
      return { ok: false, error: 'insufficient-space' };
    }

    this.errors.delete(id);
    this.downloadQueue.push(id);
    this.items = this.computeItems();
    this.emitUpdate();
    this.processQueue();
    return { ok: true };
  }

  processQueue() {
    if (this.active) return;
    const nextId = this.downloadQueue.shift();
    if (!nextId) return;

    // Re-chequeo de espacio antes de arrancar CADA descarga individual (D4):
    // si dejó de alcanzar, esa entrada pasa a error y la cola continúa.
    const space = this.checkSpace(nextId);
    if (space.ok && space.sufficient === false) {
      this.errors.set(nextId, { code: 'insufficient-space', detail: null });
      this.items = this.computeItems();
      this.emitUpdate();
      this.processQueue();
      return;
    }

    this.active = nextId;
    this.activeProgress = { receivedBytes: 0, totalBytes: null };
    this.items = this.computeItems();
    this.emitUpdate();
    this.spawnDownload(nextId);
  }

  buildInvocation(subArgs) {
    const { executablePath, baseArgs } = executableResolver();
    return { executablePath, args: [...baseArgs, ...subArgs] };
  }

  spawnDownload(id) {
    const { executablePath, args } = this.buildInvocation(['resources', 'download', '--model', id, '--cache-dir', this.cacheDir]);

    let child;
    try {
      child = spawnProcess(executablePath, args, { env: { ...process.env, PYTHONUNBUFFERED: '1' } });
    } catch (error) {
      this.errors.set(id, { code: 'unknown', detail: error.message });
      this.active = null;
      this.items = this.computeItems();
      this.emitUpdate();
      this.processQueue();
      return;
    }

    this.activeProcess = child;
    let buffer = '';

    child.stdout?.on('data', (data) => {
      buffer += data.toString();
      let idx;
      while ((idx = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (line) this.handleDownloadLine(id, line);
      }
    });

    child.on('error', (error) => {
      this.errors.set(id, { code: 'unknown', detail: error.message });
    });

    child.on('close', (code) => {
      this.onDownloadClose(id, code);
    });
  }

  handleDownloadLine(id, line) {
    const match = line.match(/^(PROGRESS|DONE|ERROR):(.*)$/);
    if (!match) return;
    const [, prefix, jsonStr] = match;

    let payload;
    try {
      payload = JSON.parse(jsonStr);
    } catch {
      return;
    }

    if (prefix === 'PROGRESS') {
      this.activeProgress = { receivedBytes: payload.received ?? 0, totalBytes: payload.total ?? null };
      this.emitUpdate();
    } else if (prefix === 'ERROR') {
      this.errors.set(id, { code: payload.code || 'unknown', detail: payload.detail || null });
    }
    // DONE: sin acción — el estado `installed` se recalcula desde disco al
    // cerrar el proceso (`onDownloadClose` -> `computeItems`), que es la capa
    // autoritativa real (D3, capa 3).
  }

  onDownloadClose(id, code) {
    const wasCancelling = this.cancellingId === id;
    this.activeProcess = null;
    this.active = null;

    if (wasCancelling) {
      this.cancellingId = null;
      clearTimeout(this.cancelKillTimer);
      this.cancelKillTimer = null;
      this.sweepIncompleteBlobs(id);
      this.errors.delete(id);
    } else if (code !== 0 && !this.errors.has(id)) {
      this.errors.set(id, { code: 'unknown', detail: `exit code ${code}` });
    }

    this.items = this.computeItems();
    const { freeBytes, totalBytes } = this.statfsCacheDirAncestor();
    this.freeBytes = freeBytes;
    this.totalBytes = totalBytes;
    this.emitUpdate();
    this.processQueue();
  }

  sweepIncompleteBlobs(id) {
    const entry = getCatalogEntry(id);
    if (!entry) return;
    const blobsDir = path.join(this.cacheDir, repoDirName(entry.repoId), 'blobs');
    let names;
    try {
      names = fs.readdirSync(blobsDir);
    } catch {
      return;
    }
    for (const name of names) {
      if (name.endsWith('.incomplete')) {
        try {
          fs.unlinkSync(path.join(blobsDir, name));
        } catch {
          // ignorar — best-effort
        }
      }
    }
  }

  // ── Cancelación (D6) ─────────────────────────────────────────────────────

  cancel(id) {
    if (this.active === id && this.activeProcess) {
      this.cancellingId = id;
      const proc = this.activeProcess;
      try {
        proc.kill('SIGTERM');
      } catch {
        // proceso ya muerto — el close handler igual limpia el estado
      }
      this.cancelKillTimer = setTimeout(() => {
        if (this.activeProcess === proc) {
          try {
            proc.kill('SIGKILL');
          } catch {
            // ya murió entre el SIGTERM y el timeout
          }
        }
      }, CANCEL_GRACE_MS);
      return { ok: true };
    }

    const idx = this.downloadQueue.indexOf(id);
    if (idx >= 0) {
      this.downloadQueue.splice(idx, 1);
      this.items = this.computeItems();
      this.emitUpdate();
      return { ok: true };
    }

    return { ok: false, error: 'not-found' };
  }

  // ── Reintento (D4) ───────────────────────────────────────────────────────

  retry(id) {
    const item = this.items.find((entry) => entry.id === id);
    if (!item || item.state !== 'error') {
      return { ok: false, error: 'not-in-error-state' };
    }
    this.sweepIncompleteBlobs(id);
    this.errors.delete(id);
    return this.download(id);
  }

  // ── Borrado con guardia (DL5) ────────────────────────────────────────────

  delete(id) {
    const entry = getCatalogEntry(id);
    if (!entry) return Promise.resolve({ ok: false, error: 'unknown-model' });

    const defaultModel = getDefaultModel();
    if (id === defaultModel) return Promise.resolve({ ok: false, reason: 'default-model' });

    if (hasQueuedTaskForModel(id)) return Promise.resolve({ ok: false, reason: 'in-queue' });

    // Marca el item como `deleting` de forma SÍNCRONA, antes de spawnear el
    // proceso Python (async), para cerrar la ventana de carrera donde
    // `isInstalled(id)` seguía devolviendo `true` mientras el borrado real
    // estaba en curso (`transcriptionManager.addTask()` podía encolar contra
    // un modelo a punto de desaparecer).
    this.deletingIds.add(id);
    this.items = this.computeItems();
    this.emitUpdate();

    return this.runDeleteProcess(id);
  }

  /** Revierte el estado transitorio `deleting` y recalcula el snapshot — se
   * llama en TODAS las salidas de `runDeleteProcess` (spawn fallido, evento
   * `error` y cierre normal) para no dejar un item colgado en `deleting`. */
  finishDeleting(id) {
    this.deletingIds.delete(id);
    this.items = this.computeItems();
    this.emitUpdate();
  }

  runDeleteProcess(id) {
    return new Promise((resolve) => {
      const { executablePath, args } = this.buildInvocation(['resources', 'delete', '--model', id, '--cache-dir', this.cacheDir]);

      let child;
      try {
        child = spawnProcess(executablePath, args, { env: { ...process.env, PYTHONUNBUFFERED: '1' } });
      } catch (error) {
        this.finishDeleting(id);
        resolve({ ok: false, error: error.message });
        return;
      }

      let buffer = '';
      let result = { ok: false, error: 'unknown' };

      child.stdout?.on('data', (data) => {
        buffer += data.toString();
        let idx;
        while ((idx = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 1);
          const match = line.match(/^(DONE|ERROR):(.*)$/);
          if (!match) continue;
          try {
            const payload = JSON.parse(match[2]);
            result = match[1] === 'DONE'
              ? { ok: true, freedBytes: payload.bytes ?? 0 }
              : { ok: false, error: payload.code || 'unknown' };
          } catch {
            // línea malformada — se ignora, `result` conserva el último valor válido
          }
        }
      });

      child.on('error', (error) => {
        this.finishDeleting(id);
        resolve({ ok: false, error: error.message });
      });

      child.on('close', () => {
        this.finishDeleting(id);
        resolve(result);
      });
    });
  }

  // ── Solo para tests ──────────────────────────────────────────────────────

  __setSpawn(fn) {
    spawnProcess = fn || nodeSpawn;
  }

  __setExecutableResolver(fn) {
    executableResolver = fn || defaultExecutableResolver;
  }

  __setGetDefaultModel(fn) {
    getDefaultModel = fn || defaultGetDefaultModel;
  }

  __setHasQueuedTaskForModel(fn) {
    hasQueuedTaskForModel = fn || defaultHasQueuedTaskForModel;
  }

  __resetForTests() {
    this.catalog = getModelCatalog();
    this.cacheDir = null;
    this.downloadQueue = [];
    this.active = null;
    this.activeProcess = null;
    this.activeProgress = { receivedBytes: 0, totalBytes: null };
    this.cancellingId = null;
    clearTimeout(this.cancelKillTimer);
    this.cancelKillTimer = null;
    this.errors = new Map();
    this.deletingIds = new Set();
    this.items = [];
    this.freeBytes = 0;
    this.totalBytes = 0;
    this.onUpdateCallback = null;
    spawnProcess = nodeSpawn;
    executableResolver = defaultExecutableResolver;
    getDefaultModel = defaultGetDefaultModel;
    hasQueuedTaskForModel = defaultHasQueuedTaskForModel;
  }
}

module.exports = new ResourceManager();
