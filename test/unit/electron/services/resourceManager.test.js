import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { EventEmitter } from 'events';
import dbService from '../../../../electron/database/dbService.js';
import { repoDirName } from '../../../../electron/services/resources/hfCacheScanner.js';

/**
 * `resourceManager` es un singleton CJS (mismo patrón que `transcriptionManager.js`).
 * Se importa una única vez y se resetea entre tests vía `__resetForTests()` +
 * los setters de inyección (`__setSpawn`/`__setExecutableResolver`/
 * `__setGetDefaultModel`) — mismo patrón que `codexService.js`
 * (`__setSpawn`/`__setExecutableResolver`), que evita tener que mockear
 * `electron`/`../utils/paths` a nivel de módulo (esos requires solo ocurren
 * de forma perezosa DENTRO de los resolvers reales, nunca en los de test).
 */
let resourceManager;

function fakeChild() {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = vi.fn();
  return child;
}

function emitLine(child, line) {
  child.stdout.emit('data', Buffer.from(`${line}\n`));
}

/** Crea el layout real de una caché HF instalada y válida para un repo (mismo
 * helper que hfCacheScanner.test.js, duplicado aquí porque ese archivo no
 * exporta sus fixtures de test). */
function createInstalledRepo(cacheDir, repoId) {
  const dirName = repoDirName(repoId);
  const repoDir = path.join(cacheDir, dirName);
  const blobsDir = path.join(repoDir, 'blobs');
  const sha = 'abc123fakerevision';
  const snapshotDir = path.join(repoDir, 'snapshots', sha);

  fs.mkdirSync(blobsDir, { recursive: true });
  fs.mkdirSync(path.join(repoDir, 'refs'), { recursive: true });
  fs.mkdirSync(snapshotDir, { recursive: true });

  const files = {
    'config.json': 'blob-config',
    'model.bin': 'blob-model-content-bytes',
    'tokenizer.json': 'blob-tokenizer',
    'vocabulary.txt': 'blob-vocab',
  };
  for (const [fileName, content] of Object.entries(files)) {
    const blobName = `blob-${fileName.replace(/[^a-z0-9]/gi, '')}`;
    const blobPath = path.join(blobsDir, blobName);
    fs.writeFileSync(blobPath, content);
    fs.symlinkSync(path.join('..', '..', 'blobs', blobName), path.join(snapshotDir, fileName));
  }
  fs.writeFileSync(path.join(repoDir, 'refs', 'main'), sha);
  return { repoDir, blobsDir, snapshotDir, sha };
}

describe('resourceManager', () => {
  let cacheDir;
  let spawnMock;

  beforeEach(async () => {
    if (!resourceManager) {
      resourceManager = (await import('../../../../electron/services/resourceManager.js')).default;
    }
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hf-cache-rm-test-'));

    resourceManager.__resetForTests();
    resourceManager.cacheDir = cacheDir;
    resourceManager.rescan();

    spawnMock = vi.fn(() => fakeChild());
    resourceManager.__setSpawn(spawnMock);
    resourceManager.__setExecutableResolver(() => ({ executablePath: '/mock/audio_sync_analyzer', baseArgs: [] }));
    resourceManager.__setGetDefaultModel(() => null);

    dbService.init(':memory:');
    // `resourceManager.js` es CJS puro: su `require('../database/dbService')`
    // interno resuelve por el cache nativo de Node, NO por el grafo de Vite,
    // así que sería una instancia de `dbService` DISTINTA a este `import` del
    // test (mismo gotcha documentado en `utils/paths.test.js`). Se inyecta la
    // guardia explícitamente contra el `dbService` real que este test controla.
    resourceManager.__setHasQueuedTaskForModel((modelId) => {
      const row = dbService.db
        .prepare("SELECT 1 FROM transcription_queue WHERE model = ? AND status IN ('pending','processing') LIMIT 1")
        .get(modelId);
      return Boolean(row);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    dbService.close();
    fs.rmSync(cacheDir, { recursive: true, force: true });
  });

  describe('checkSpace — DL1', () => {
    it('espacio suficiente: freeBytes cubre estimatedBytes + margen 500MB', () => {
      vi.spyOn(fs, 'statfsSync').mockReturnValue({ bavail: 100_000, bsize: 100_000, blocks: 200_000 });
      // 100_000 * 100_000 = 10_000_000_000 bytes libres (~10GB) — sobra para 'small' (~486MB + 500MB margen)
      const result = resourceManager.checkSpace('small');
      expect(result.ok).toBe(true);
      expect(result.sufficient).toBe(true);
      expect(result.freeBytes).toBe(10_000_000_000);
    });

    it('espacio justo: exactamente en el límite (freeBytes === requiredBytes) cuenta como suficiente', () => {
      const requiredBytes = 486_212_372 + 500 * 1024 * 1024; // catálogo 'small' + margen
      vi.spyOn(fs, 'statfsSync').mockReturnValue({ bavail: requiredBytes, bsize: 1, blocks: requiredBytes });
      const result = resourceManager.checkSpace('small');
      expect(result.sufficient).toBe(true);
      expect(result.freeBytes).toBe(requiredBytes);
    });

    it('espacio insuficiente: freeBytes por debajo de estimatedBytes + margen bloquea', () => {
      vi.spyOn(fs, 'statfsSync').mockReturnValue({ bavail: 1, bsize: 1, blocks: 10 });
      const result = resourceManager.checkSpace('large-v3');
      expect(result.ok).toBe(true);
      expect(result.sufficient).toBe(false);
    });

    it('modelo desconocido devuelve error sin lanzar', () => {
      const result = resourceManager.checkSpace('does-not-exist');
      expect(result).toEqual({ ok: false, error: 'unknown-model' });
    });

    // CRITICAL (fix post-review PR2): `freeBytes: null` (statfsSync falló,
    // ver `statfsCacheDirAncestor`) se coaccionaba a `0 >= requiredBytes` y
    // siempre daba `sufficient: false`, indistinguible de "espacio
    // insuficiente" real para el consumidor IPC.
    it('freeBytes null (statfsSync falló): sufficient es null, no false — "no se pudo verificar" distinto de "insuficiente"', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(fs, 'statfsSync').mockImplementation(() => {
        throw new Error('EACCES: permission denied, statfs');
      });

      const result = resourceManager.checkSpace('small');

      expect(result.ok).toBe(true);
      expect(result.freeBytes).toBeNull();
      expect(result.sufficient).toBeNull();
      expect(result.sufficient).not.toBe(false);
      expect(result.remainingAfterBytes).toBeNull();
    });

    it('download() no bloquea con "insufficient-space" cuando el espacio no se pudo verificar (freeBytes null)', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(fs, 'statfsSync').mockImplementation(() => {
        throw new Error('EIO: error de disco');
      });

      const result = resourceManager.download('small');

      expect(result.ok).toBe(true);
      expect(spawnMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('cola serie con progreso individual y global — DL2', () => {
    beforeEach(() => {
      vi.spyOn(fs, 'statfsSync').mockReturnValue({ bavail: 100_000_000, bsize: 1000, blocks: 200_000_000 });
    });

    it('encola 2 descargas, solo 1 activa a la vez, con progreso individual y posición global', () => {
      const first = resourceManager.download('small');
      const second = resourceManager.download('medium');

      expect(first.ok).toBe(true);
      expect(second.ok).toBe(true);
      expect(spawnMock).toHaveBeenCalledTimes(1); // solo la primera arrancó el proceso

      let snapshot = resourceManager.getSnapshot();
      expect(snapshot.items.find((i) => i.id === 'small').state).toBe('downloading');
      expect(snapshot.items.find((i) => i.id === 'medium').state).toBe('queued');
      expect(snapshot.queue).toHaveLength(2);
      expect(snapshot.queue[0]).toMatchObject({ id: 'small', state: 'downloading', position: 1, total: 2 });
      expect(snapshot.queue[1]).toMatchObject({ id: 'medium', state: 'queued', position: 2, total: 2 });

      const activeChild = spawnMock.mock.results[0].value;
      emitLine(activeChild, 'PROGRESS:{"id":"small","received":200,"total":486212372}');

      snapshot = resourceManager.getSnapshot();
      expect(snapshot.active).toMatchObject({ id: 'small', receivedBytes: 200, totalBytes: 486212372 });

      // 'small' termina → la cola avanza automáticamente a 'medium'
      emitLine(activeChild, 'DONE:{"id":"small","path":"/x/snapshots/sha","bytes":486212372}');
      activeChild.emit('close', 0);

      expect(spawnMock).toHaveBeenCalledTimes(2); // arrancó 'medium' automáticamente
      snapshot = resourceManager.getSnapshot();
      expect(snapshot.items.find((i) => i.id === 'medium').state).toBe('downloading');
    });

    it('el progreso avanza hasta 100% y el estado pasa a instalado', () => {
      createInstalledRepo(cacheDir, 'Systran/faster-whisper-small'); // simula que al terminar la descarga el archivo ya existe en disco
      resourceManager.download('small');
      const child = spawnMock.mock.results[0].value;

      emitLine(child, 'PROGRESS:{"id":"small","received":486212372,"total":486212372}');
      let snapshot = resourceManager.getSnapshot();
      expect(snapshot.active.percent).toBe(100);

      emitLine(child, 'DONE:{"id":"small","path":"/x","bytes":486212372}');
      child.emit('close', 0);

      snapshot = resourceManager.getSnapshot();
      expect(snapshot.items.find((i) => i.id === 'small').state).toBe('installed');
    });
  });

  describe('cancelación — DL3', () => {
    beforeEach(() => {
      vi.spyOn(fs, 'statfsSync').mockReturnValue({ bavail: 100_000_000, bsize: 1000, blocks: 200_000_000 });
    });

    it('cancelar una descarga activa: SIGTERM y, si sigue viva a los 3s, SIGKILL + barrido de .incomplete', () => {
      vi.useFakeTimers();
      const { blobsDir } = createInstalledRepo(cacheDir, 'Systran/faster-whisper-medium');
      fs.writeFileSync(path.join(blobsDir, 'partial.incomplete'), 'half');
      // Simular estado "instalando" a medias: quitamos el snapshot para que no cuente como instalado
      fs.rmSync(path.join(cacheDir, repoDirName('Systran/faster-whisper-medium'), 'snapshots'), { recursive: true, force: true });

      resourceManager.download('medium');
      const child = spawnMock.mock.results[0].value;

      const result = resourceManager.cancel('medium');
      expect(result.ok).toBe(true);
      expect(child.kill).toHaveBeenCalledWith('SIGTERM');
      expect(child.kill).not.toHaveBeenCalledWith('SIGKILL');

      vi.advanceTimersByTime(3000);
      expect(child.kill).toHaveBeenCalledWith('SIGKILL');

      child.emit('close', null);

      expect(fs.existsSync(path.join(blobsDir, 'partial.incomplete'))).toBe(false);
      const snapshot = resourceManager.getSnapshot();
      expect(snapshot.items.find((i) => i.id === 'medium').state).toBe('not-installed');
    });

    it('cancelar un ítem en cola (no iniciado) lo retira sin spawnear nada', () => {
      resourceManager.download('small');
      resourceManager.download('large-v3');
      expect(spawnMock).toHaveBeenCalledTimes(1); // solo 'small' arrancó

      const result = resourceManager.cancel('large-v3');
      expect(result.ok).toBe(true);
      expect(spawnMock).toHaveBeenCalledTimes(1); // 'large-v3' nunca llegó a spawnear

      const snapshot = resourceManager.getSnapshot();
      expect(snapshot.items.find((i) => i.id === 'large-v3').state).toBe('not-installed');
      expect(snapshot.queue.find((q) => q.id === 'large-v3')).toBeUndefined();
    });
  });

  describe('reintento — DL4', () => {
    beforeEach(() => {
      vi.spyOn(fs, 'statfsSync').mockReturnValue({ bavail: 100_000_000, bsize: 1000, blocks: 200_000_000 });
    });

    it('una descarga fallida se puede reintentar: limpia parciales y relanza desde estado limpio', () => {
      const repoDirName_ = repoDirName('Systran/faster-whisper-small');
      const blobsDir = path.join(cacheDir, repoDirName_, 'blobs');
      fs.mkdirSync(blobsDir, { recursive: true });
      fs.writeFileSync(path.join(blobsDir, 'stale.incomplete'), 'corrupt');

      resourceManager.download('small');
      const firstChild = spawnMock.mock.results[0].value;
      emitLine(firstChild, 'ERROR:{"id":"small","code":"network","detail":"conexión perdida"}');
      firstChild.emit('close', 1);

      let snapshot = resourceManager.getSnapshot();
      expect(snapshot.items.find((i) => i.id === 'small').state).toBe('error');
      expect(snapshot.items.find((i) => i.id === 'small').error.code).toBe('network');

      const retryResult = resourceManager.retry('small');
      expect(retryResult.ok).toBe(true);
      expect(fs.existsSync(path.join(blobsDir, 'stale.incomplete'))).toBe(false); // parciales limpiados
      expect(spawnMock).toHaveBeenCalledTimes(2); // relanzada

      snapshot = resourceManager.getSnapshot();
      expect(snapshot.items.find((i) => i.id === 'small').state).toBe('downloading');
      expect(snapshot.items.find((i) => i.id === 'small').error).toBeNull();
    });

    it('no permite reintentar un modelo que no está en estado de error', () => {
      const result = resourceManager.retry('tiny');
      expect(result.ok).toBe(false);
    });
  });

  describe('guardia de borrado — DL5', () => {
    it('bloquea el borrado si el modelo es el whisperModel default configurado', async () => {
      resourceManager.__setGetDefaultModel(() => 'medium');
      const result = await resourceManager.delete('medium');
      expect(result).toEqual({ ok: false, reason: 'default-model' });
      expect(spawnMock).not.toHaveBeenCalled();
    });

    it('bloquea el borrado si el modelo tiene una tarea pending/processing en transcription_queue', async () => {
      dbService.recordings.saveRecording('rec/uno.wav', 30);
      const recording = dbService.recordings.getRecording('rec/uno.wav');
      dbService.enqueueTask(recording.id, 'small');
      dbService.updateTask(dbService.getNextTask().id, 'processing', 'transcribing', 10);

      const result = await resourceManager.delete('small');
      expect(result).toEqual({ ok: false, reason: 'in-queue' });
      expect(spawnMock).not.toHaveBeenCalled();
    });

    it('borra un modelo elegible (no default, sin tareas en cola) invocando el subcomando delete', async () => {
      const child = fakeChild();
      spawnMock.mockReturnValueOnce(child);

      const deletePromise = resourceManager.delete('tiny');
      emitLine(child, 'DONE:{"id":"tiny","path":"/x","bytes":78203619}');
      child.emit('close', 0);

      const result = await deletePromise;
      expect(result).toEqual({ ok: true, freedBytes: 78203619 });
      expect(spawnMock).toHaveBeenCalledWith(
        '/mock/audio_sync_analyzer',
        ['resources', 'delete', '--model', 'tiny', '--cache-dir', cacheDir],
        expect.any(Object),
      );
    });
  });

  describe('resolveCacheDir — INV4 (D2)', () => {
    const originalHfHubCache = process.env.HF_HUB_CACHE;
    const originalHfHome = process.env.HF_HOME;

    afterEach(() => {
      if (originalHfHubCache === undefined) delete process.env.HF_HUB_CACHE; else process.env.HF_HUB_CACHE = originalHfHubCache;
      if (originalHfHome === undefined) delete process.env.HF_HOME; else process.env.HF_HOME = originalHfHome;
    });

    it('prioriza HF_HUB_CACHE si está seteado', () => {
      process.env.HF_HUB_CACHE = '/custom/hub-cache';
      delete process.env.HF_HOME;
      expect(resourceManager.resolveCacheDir()).toBe('/custom/hub-cache');
    });

    it('usa HF_HOME/hub si HF_HUB_CACHE no está seteado', () => {
      delete process.env.HF_HUB_CACHE;
      process.env.HF_HOME = '/custom/hf-home';
      expect(resourceManager.resolveCacheDir()).toBe(path.join('/custom/hf-home', 'hub'));
    });

    it('cae al default del SO si ninguna env var está seteada', () => {
      delete process.env.HF_HUB_CACHE;
      delete process.env.HF_HOME;
      expect(resourceManager.resolveCacheDir()).toBe(path.join(os.homedir(), '.cache', 'huggingface', 'hub'));
    });
  });

  describe('snapshot inicial al arrancar — INV3', () => {
    it('detecta modelos válidos ya presentes en la caché y los marca instalados sin descargar', () => {
      createInstalledRepo(cacheDir, 'Systran/faster-whisper-medium');

      resourceManager.__resetForTests();
      resourceManager.__setSpawn(spawnMock);
      const snapshot = resourceManager.init(cacheDir);

      expect(snapshot.items.find((i) => i.id === 'medium').state).toBe('installed');
      expect(snapshot.items.find((i) => i.id === 'tiny').state).toBe('not-installed');
      expect(spawnMock).not.toHaveBeenCalled();
    });
  });

  describe('statfsCacheDirAncestor: degrada con gracia si fs.statfsSync lanza — BLOCKER (fix post-review)', () => {
    it('rescan() no propaga la excepción y el snapshot resultante tiene freeBytes/totalBytes en null', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(fs, 'statfsSync').mockImplementation(() => {
        throw new Error('EACCES: permission denied, statfs');
      });

      expect(() => resourceManager.rescan()).not.toThrow();

      const snapshot = resourceManager.getSnapshot();
      expect(snapshot.freeBytes).toBeNull();
      expect(snapshot.totalBytes).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('init() no propaga la excepción (HF_HOME roto / filesystem raro)', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(fs, 'statfsSync').mockImplementation(() => {
        throw new Error('ENOENT filesystem raro');
      });

      let snapshot;
      expect(() => {
        snapshot = resourceManager.init(cacheDir);
      }).not.toThrow();

      expect(snapshot.freeBytes).toBeNull();
      expect(snapshot.totalBytes).toBeNull();
    });

    it('onDownloadClose() (cierre de una descarga) tampoco propaga si statfsSync falla justo en ese punto', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const statfsSpy = vi.spyOn(fs, 'statfsSync');
      // Espacio suficiente para arrancar la descarga — `download()` hace su
      // propio checkSpace al encolar y `processQueue()` re-chequea antes de
      // arrancarla (D4) — pero falla al recalcular el snapshot al cerrar el
      // proceso (mismo call site que rescan()/init()).
      statfsSpy.mockReturnValueOnce({ bavail: 100_000_000, bsize: 1000, blocks: 200_000_000 });
      statfsSpy.mockReturnValueOnce({ bavail: 100_000_000, bsize: 1000, blocks: 200_000_000 });
      statfsSpy.mockImplementation(() => {
        throw new Error('EIO: error de disco');
      });

      resourceManager.download('small');
      const child = spawnMock.mock.results[0].value;

      expect(() => child.emit('close', 0)).not.toThrow();

      const snapshot = resourceManager.getSnapshot();
      expect(snapshot.freeBytes).toBeNull();
      expect(snapshot.totalBytes).toBeNull();
    });
  });

  describe('borrado: isInstalled() no debe quedar stale durante el borrado async — race condition (fix post-review)', () => {
    it('isInstalled(id) devuelve false inmediatamente después de llamar delete(id), antes de que el proceso hijo cierre', async () => {
      createInstalledRepo(cacheDir, 'Systran/faster-whisper-tiny');
      resourceManager.rescan();
      expect(resourceManager.isInstalled('tiny')).toBe(true);

      const child = fakeChild();
      spawnMock.mockReturnValueOnce(child);

      const deletePromise = resourceManager.delete('tiny');

      // Ventana de carrera del bug original: el proceso hijo todavía no cerró.
      expect(resourceManager.isInstalled('tiny')).toBe(false);
      expect(resourceManager.getSnapshot().items.find((i) => i.id === 'tiny').state).toBe('deleting');

      // Simula que Python realmente borró el repo del disco antes de cerrar
      // (el `fakeChild` no toca el filesystem por sí solo).
      fs.rmSync(path.join(cacheDir, repoDirName('Systran/faster-whisper-tiny')), { recursive: true, force: true });
      emitLine(child, 'DONE:{"id":"tiny","path":"/x","bytes":78203619}');
      child.emit('close', 0);

      const result = await deletePromise;
      expect(result).toEqual({ ok: true, freedBytes: 78203619 });
      expect(resourceManager.isInstalled('tiny')).toBe(false);
    });

    it('si el borrado falla, revierte el estado transitorio y el item vuelve a installed (el archivo nunca se borró)', async () => {
      createInstalledRepo(cacheDir, 'Systran/faster-whisper-tiny');
      resourceManager.rescan();

      const child = fakeChild();
      spawnMock.mockReturnValueOnce(child);

      const deletePromise = resourceManager.delete('tiny');
      expect(resourceManager.isInstalled('tiny')).toBe(false);

      emitLine(child, 'ERROR:{"id":"tiny","code":"unknown","detail":"boom"}');
      child.emit('close', 1);

      const result = await deletePromise;
      expect(result.ok).toBe(false);
      expect(resourceManager.isInstalled('tiny')).toBe(true);
    });
  });

  describe('processQueue: re-chequeo de espacio antes de CADA descarga individual — D4/DL1 (test de integración)', () => {
    it('la primera descarga se completa; la segunda se queda sin espacio (pasa a error) pero la cola continúa con la tercera', () => {
      // Encola manualmente evitando depender del conteo de llamadas a
      // statfsSync durante `download()` (que ya hace su propio checkSpace al
      // encolar) — el foco es exclusivamente el re-chequeo que hace
      // `processQueue()` justo antes de arrancar CADA ítem.
      resourceManager.downloadQueue = ['medium', 'small'];
      resourceManager.active = 'tiny';
      resourceManager.activeProcess = fakeChild();
      resourceManager.activeProgress = { receivedBytes: 78_203_619, totalBytes: 78_203_619 };
      resourceManager.items = resourceManager.computeItems();

      let call = 0;
      vi.spyOn(fs, 'statfsSync').mockImplementation(() => {
        call += 1;
        // 2da llamada tras cerrar 'tiny' = re-chequeo de 'medium': sin espacio.
        if (call === 2) return { bavail: 1, bsize: 1, blocks: 10 };
        // El resto (snapshot post-close + re-chequeo de 'small'): sobra espacio.
        return { bavail: 100_000_000, bsize: 1000, blocks: 200_000_000 };
      });

      // 'tiny' (primera de la cola, ya activa) termina exitosamente.
      resourceManager.onDownloadClose('tiny', 0);

      const snapshot = resourceManager.getSnapshot();
      // 'medium' (segunda) quedó bloqueada por espacio insuficiente...
      expect(snapshot.items.find((i) => i.id === 'medium')).toMatchObject({
        state: 'error',
        error: { code: 'insufficient-space', detail: null },
      });
      // ...pero la cola CONTINUÓ automáticamente con 'small' (tercera) en vez de trabarse.
      expect(snapshot.items.find((i) => i.id === 'small').state).toBe('downloading');
      expect(resourceManager.downloadQueue).toEqual([]);
      expect(spawnMock).toHaveBeenCalledTimes(1); // solo 'small' llegó a spawnear
    });
  });
});
