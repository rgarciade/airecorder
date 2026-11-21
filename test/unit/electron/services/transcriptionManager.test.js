import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * `transcriptionManager.js` es CJS puro (`require`/`module.exports`) y hace
 * `require('electron')`, `require('../utils/paths')`, `require('../database/dbService')`,
 * `require('./notificationService')` y `require('./resourceManager')` a nivel
 * de módulo. Ninguno se puede interceptar con `vi.mock()` desde este archivo:
 * `vi.mock` solo reescribe resoluciones dentro del grafo instrumentado de
 * Vite, y los `require()` que ocurren DENTRO de un módulo CJS puro (sin
 * sintaxis import/export) se resuelven por el cache NATIVO de Node en su
 * lugar (mismo gotcha documentado en `test/unit/electron/utils/paths.test.js`
 * y `test/unit/electron/services/updateChecker.test.js`).
 * `../utils/paths` en particular llama `app.getPath('desktop')` en su propio
 * nivel de módulo, así que sin este workaround explota al cargarse fuera de
 * un proceso Electron real ("Cannot read properties of undefined").
 * Workaround: inyectar directamente en `require.cache` de Node antes de
 * importar `transcriptionManager.js`.
 */
const nodeRequire = createRequire(import.meta.url);

const electronPath = nodeRequire.resolve('electron');
const pathsPath = nodeRequire.resolve('../../../../electron/utils/paths.js');
const dbServicePath = nodeRequire.resolve('../../../../electron/database/dbService.js');
const notificationServicePath = nodeRequire.resolve('../../../../electron/services/notificationService.js');
const resourceManagerPath = nodeRequire.resolve('../../../../electron/services/resourceManager.js');
// #174: the module does not exist before implementation, so its cache key is
// built by hand instead of `nodeRequire.resolve` (which would throw).
const micEchoServicePath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../electron/services/micEcho/micEchoService.js'
);

const getSettingMock = vi.fn((key, defaultValue) => defaultValue);
const dbServiceMock = {
  getRecording: vi.fn(),
  getRecordingById: vi.fn(),
  getRecordingTaskStatus: vi.fn(),
  setSkipDiarization: vi.fn(),
  enqueueTask: vi.fn(() => 1),
  getNextTask: vi.fn(),
  getActiveQueue: vi.fn(() => []),
  getQueueHistory: vi.fn(() => []),
  updateTask: vi.fn(),
};
const resourceManagerMock = {
  isInstalled: vi.fn(),
  getSnapshot: vi.fn(() => ({ cacheDir: '/fake/hf-cache' })),
  resolveCacheDir: vi.fn(() => '/fake/hf-cache'),
};
const micEchoServiceMock = {
  waitFor: vi.fn(() => Promise.resolve()),
  cancelMicEcho: vi.fn(),
};

let originalElectronEntry;
let originalPathsEntry;
let originalDbServiceEntry;
let originalNotificationServiceEntry;
let originalResourceManagerEntry;
let originalMicEchoServiceEntry;

beforeAll(() => {
  originalElectronEntry = nodeRequire.cache[electronPath];
  nodeRequire.cache[electronPath] = {
    id: electronPath, filename: electronPath, loaded: true,
    exports: { app: { isPackaged: false } },
  };

  originalPathsEntry = nodeRequire.cache[pathsPath];
  nodeRequire.cache[pathsPath] = {
    id: pathsPath, filename: pathsPath, loaded: true,
    exports: { getSetting: getSettingMock, settingsPath: '/fake/userData/settings.json' },
  };

  originalDbServiceEntry = nodeRequire.cache[dbServicePath];
  nodeRequire.cache[dbServicePath] = {
    id: dbServicePath, filename: dbServicePath, loaded: true,
    exports: dbServiceMock,
  };

  originalNotificationServiceEntry = nodeRequire.cache[notificationServicePath];
  nodeRequire.cache[notificationServicePath] = {
    id: notificationServicePath, filename: notificationServicePath, loaded: true,
    exports: {},
  };

  originalResourceManagerEntry = nodeRequire.cache[resourceManagerPath];
  nodeRequire.cache[resourceManagerPath] = {
    id: resourceManagerPath, filename: resourceManagerPath, loaded: true,
    exports: resourceManagerMock,
  };

  originalMicEchoServiceEntry = nodeRequire.cache[micEchoServicePath];
  nodeRequire.cache[micEchoServicePath] = {
    id: micEchoServicePath, filename: micEchoServicePath, loaded: true,
    exports: { micEchoService: micEchoServiceMock, createMicEchoService: vi.fn() },
  };
});

afterAll(() => {
  if (originalElectronEntry) nodeRequire.cache[electronPath] = originalElectronEntry; else delete nodeRequire.cache[electronPath];
  if (originalPathsEntry) nodeRequire.cache[pathsPath] = originalPathsEntry; else delete nodeRequire.cache[pathsPath];
  if (originalDbServiceEntry) nodeRequire.cache[dbServicePath] = originalDbServiceEntry; else delete nodeRequire.cache[dbServicePath];
  if (originalNotificationServiceEntry) nodeRequire.cache[notificationServicePath] = originalNotificationServiceEntry; else delete nodeRequire.cache[notificationServicePath];
  if (originalResourceManagerEntry) nodeRequire.cache[resourceManagerPath] = originalResourceManagerEntry; else delete nodeRequire.cache[resourceManagerPath];
  if (originalMicEchoServiceEntry) nodeRequire.cache[micEchoServicePath] = originalMicEchoServiceEntry; else delete nodeRequire.cache[micEchoServicePath];
});

describe('transcriptionManager — bloqueo pre-spawn si el modelo no está instalado (D8, INV6, DL1)', () => {
  let transcriptionManager;

  beforeEach(async () => {
    transcriptionManager = (await import('../../../../electron/services/transcriptionManager.js')).default;
    transcriptionManager.activeTask = null;
    transcriptionManager.process = null;

    getSettingMock.mockClear().mockImplementation((key, defaultValue) => defaultValue);
    Object.values(dbServiceMock).forEach((fn) => fn.mockClear && fn.mockClear());
    dbServiceMock.enqueueTask.mockReturnValue(1);
    dbServiceMock.getRecordingTaskStatus.mockReturnValue(null);
    dbServiceMock.getRecordingById.mockReturnValue({ id: 7, relative_path: 'rec/uno' });
    resourceManagerMock.isInstalled.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('bloquea el encolado si el modelo solicitado no está instalado, con error accionable', () => {
    resourceManagerMock.isInstalled.mockReturnValue(false);

    const result = transcriptionManager.addTask(7, { model: 'large-v3' });

    expect(resourceManagerMock.isInstalled).toHaveBeenCalledWith('large-v3');
    expect(result).toEqual({ success: false, error: 'MODEL_NOT_INSTALLED', model: 'large-v3' });
    expect(dbServiceMock.enqueueTask).not.toHaveBeenCalled();
  });

  it('resuelve el modelo por defecto de settings cuando no se especifica uno explícito, y también lo bloquea si no está instalado', () => {
    getSettingMock.mockImplementation((key) => (key === 'whisperModel' ? 'small' : undefined));
    resourceManagerMock.isInstalled.mockReturnValue(false);

    const result = transcriptionManager.addTask(7, {});

    expect(resourceManagerMock.isInstalled).toHaveBeenCalledWith('small');
    expect(result).toEqual({ success: false, error: 'MODEL_NOT_INSTALLED', model: 'small' });
    expect(dbServiceMock.enqueueTask).not.toHaveBeenCalled();
  });

  it('permite el encolado normalmente si el modelo resuelto SÍ está instalado', () => {
    resourceManagerMock.isInstalled.mockReturnValue(true);

    const result = transcriptionManager.addTask(7, { model: 'small' });

    expect(result).toEqual({ success: true, taskId: 1 });
    expect(dbServiceMock.enqueueTask).toHaveBeenCalledWith(7, 'small');
  });
});

describe('transcriptionManager — runTranscriptionProcess: regresión de filas legacy con model=NULL (fix post-review)', () => {
  let transcriptionManager;

  beforeEach(async () => {
    transcriptionManager = (await import('../../../../electron/services/transcriptionManager.js')).default;
    transcriptionManager.activeTask = null;
    transcriptionManager.process = null;
    transcriptionManager.basePath = null;

    getSettingMock.mockClear().mockImplementation((key, defaultValue) => defaultValue);
    resourceManagerMock.isInstalled.mockReset();
    resourceManagerMock.getSnapshot.mockReturnValue({ cacheDir: '/fake/hf-cache' });
    dbServiceMock.getRecordingById.mockReset().mockReturnValue({ id: 7, relative_path: 'rec/legacy' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Antes de este fix, `args.push('--model', task.model)` solo se ejecutaba
   * dentro de `if (task.model)`, así que una fila legacy con
   * `model = NULL` (instalaciones previas a este cambio) nunca recibía
   * `--model` — y como el parser de `audio_sync_analyzer.py` ahora tiene
   * `--model required=True` (sin default), Python reventaba con un crash de
   * argparse en vez de fallar con un error accionable. Estos tests verifican
   * que ahora se resuelve el mismo fallback que usa el gate de `addTask`
   * (`getSetting('whisperModel', 'small')`) ANTES de spawnear, y que si ese
   * default tampoco está instalado, se rechaza con un error MODEL_NOT_INSTALLED
   * controlado (nunca llega a spawnear el proceso Python).
   */
  it('fila legacy con model=null: resuelve el modelo por defecto de settings y rechaza con MODEL_NOT_INSTALLED (no un crash de argparse) si no está instalado', async () => {
    getSettingMock.mockImplementation((key, defaultValue) => (key === 'whisperModel' ? 'medium' : defaultValue));
    resourceManagerMock.isInstalled.mockReturnValue(false);

    const legacyTask = { id: 99, recording_id: 7, model: null };

    await expect(
      transcriptionManager.runTranscriptionProcess(legacyTask, null, () => {})
    ).rejects.toThrow('MODEL_NOT_INSTALLED::medium');

    expect(resourceManagerMock.isInstalled).toHaveBeenCalledWith('medium');
  });

  it('fila legacy con model=undefined (campo ausente): mismo fallback resuelto que con null', async () => {
    getSettingMock.mockImplementation((key, defaultValue) => (key === 'whisperModel' ? 'small' : defaultValue));
    resourceManagerMock.isInstalled.mockReturnValue(false);

    const legacyTask = { id: 100, recording_id: 7 }; // sin campo `model`

    await expect(
      transcriptionManager.runTranscriptionProcess(legacyTask, null, () => {})
    ).rejects.toThrow('MODEL_NOT_INSTALLED::small');

    expect(resourceManagerMock.isInstalled).toHaveBeenCalledWith('small');
  });

  it('tarea normal con model explícito: usa el modelo de la tarea directamente, sin caer al default de settings', async () => {
    resourceManagerMock.isInstalled.mockReturnValue(false);

    const normalTask = { id: 101, recording_id: 7, model: 'large-v3' };

    await expect(
      transcriptionManager.runTranscriptionProcess(normalTask, null, () => {})
    ).rejects.toThrow('MODEL_NOT_INSTALLED::large-v3');

    expect(resourceManagerMock.isInstalled).toHaveBeenCalledWith('large-v3');
    expect(resourceManagerMock.isInstalled).not.toHaveBeenCalledWith('small');
  });
});

describe('transcriptionManager.processQueue — waits for the mic echo job of the recording (#174, S2)', () => {
  let transcriptionManager;
  const task = { id: 55, recording_id: 7, model: 'small' };

  function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
  }

  beforeEach(async () => {
    transcriptionManager = (await import('../../../../electron/services/transcriptionManager.js')).default;
    transcriptionManager.activeTask = null;
    transcriptionManager.process = null;
    transcriptionManager.basePath = '/fake/recordings';

    getSettingMock.mockClear().mockImplementation((key, defaultValue) => defaultValue);
    Object.values(dbServiceMock).forEach((fn) => fn.mockClear && fn.mockClear());
    dbServiceMock.getNextTask.mockReset().mockReturnValueOnce(task).mockReturnValue(null);
    dbServiceMock.getRecordingById.mockReset().mockReturnValue({ id: 7, relative_path: 'rec/uno' });
    micEchoServiceMock.waitFor.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('S2a: does not start the transcription while the echo job of that recording is pending', async () => {
    const echoJob = deferred();
    micEchoServiceMock.waitFor.mockReturnValue(echoJob.promise);
    const runSpy = vi.spyOn(transcriptionManager, 'runTranscriptionProcess').mockResolvedValue();

    const processing = transcriptionManager.processQueue();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(micEchoServiceMock.waitFor).toHaveBeenCalledWith('rec/uno');
    expect(runSpy).not.toHaveBeenCalled();

    echoJob.resolve();
    await processing;

    expect(runSpy).toHaveBeenCalledTimes(1);
    expect(dbServiceMock.updateTask).toHaveBeenCalledWith(55, 'completed', 'completed', 100);
  });

  it('S2b: still transcribes when waiting for the echo job fails', async () => {
    micEchoServiceMock.waitFor.mockRejectedValue(new Error('echo job exploded'));
    const runSpy = vi.spyOn(transcriptionManager, 'runTranscriptionProcess').mockResolvedValue();

    await transcriptionManager.processQueue();

    expect(micEchoServiceMock.waitFor).toHaveBeenCalledWith('rec/uno');
    expect(runSpy).toHaveBeenCalledTimes(1);
    expect(dbServiceMock.updateTask).toHaveBeenCalledWith(55, 'completed', 'completed', 100);
  });

  it('S2c: transcribes without delay when there is no echo job for the recording', async () => {
    const runSpy = vi.spyOn(transcriptionManager, 'runTranscriptionProcess').mockResolvedValue();

    await transcriptionManager.processQueue();

    expect(runSpy).toHaveBeenCalledTimes(1);
    expect(dbServiceMock.updateTask).toHaveBeenCalledWith(55, 'completed', 'completed', 100);
  });
});
