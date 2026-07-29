/**
 * recordings.test.js
 *
 * Tests unitarios para electron/ipc-handlers/recordings.js — 8 canales IPC
 * que gestionan el ciclo de vida de una grabación: listado combinando
 * filesystem + BD, lectura/ensamblado de la transcripción (con resolución de
 * hablantes vía diarización), borrado, descarga, renombrado, lookup por ID y
 * confirmación de sugerencias de hablante.
 *
 * recordings.js hace, a nivel de módulo:
 *   const { ipcMain, shell } = require('electron');
 *   const dbService = require('../database/dbService');
 *   const speakerManager = require('../services/speakerManager');
 *   const diarizationService = require('../services/diarizationService');
 *   const { resolveSpeakersInText } = require('../services/speakerResolver');
 *   const { getRecordingsPath, getFolderPathFromId, settingsPath } = require('../utils/paths');
 * Todos CJS puro → mismo patrón de esta sesión (ver cabecera de
 * export.test.js / integrations-oauth.test.js / analysis.test.js): mocks
 * inyectados en `require.cache` vía `createRequire(import.meta.url)` en
 * beforeAll/afterAll, import dinámico del módulo bajo test en beforeEach, e
 * `ipcMain.handle` capturando cada callback en `handlers`.
 *
 * `speakerManager` YA está completamente testeado en pases anteriores de
 * esta sesión — aquí sólo se mockea su export `confirmSpeakerSuggestion`
 * como `vi.fn()`, sin re-derivar su lógica interna.
 *
 * `diarizationService` es un singleton (`module.exports = new
 * DiarizationService()`), se mockea el objeto completo con
 * `resolveRecording: vi.fn()`.
 *
 * `fs` es un módulo core de Node — se espía con `vi.spyOn` (no se inyecta en
 * require.cache), compartiendo el mismo objeto de módulo cacheado que
 * recordings.js usa. IMPORTANTE: este archivo mezcla lecturas SÍNCRONAS
 * (`fs.existsSync`, `fs.readFileSync` — usadas para metadata.json,
 * settings.json y diarization.json) con lecturas ASÍNCRONAS
 * (`fs.promises.readdir`, `fs.promises.stat`, `fs.promises.readFile` — para
 * el listado de carpetas y transcripcion_combinada.json). Ambas familias se
 * mockean por separado.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'fs';
import path from 'path';

const nodeRequire = createRequire(import.meta.url);
const electronPath = nodeRequire.resolve('electron');
const dbServicePath = nodeRequire.resolve('../../../../electron/database/dbService.js');
const speakerManagerPath = nodeRequire.resolve('../../../../electron/services/speakerManager.js');
const diarizationServicePath = nodeRequire.resolve('../../../../electron/services/diarizationService.js');
const speakerResolverPath = nodeRequire.resolve('../../../../electron/services/speakerResolver.js');
const pathsPath = nodeRequire.resolve('../../../../electron/utils/paths.js');

let originalElectronEntry;
let originalDbServiceEntry;
let originalSpeakerManagerEntry;
let originalDiarizationServiceEntry;
let originalSpeakerResolverEntry;
let originalPathsEntry;

// ── Mocks de electron ───────────────────────────────────────────────────
const handlers = {};
const ipcMainMock = {
  handle: vi.fn((channel, cb) => {
    handlers[channel] = cb;
  }),
};
const shellMock = { openPath: vi.fn() };

// ── Mock de dbService ────────────────────────────────────────────────────
const dbRunMock = vi.fn();
const dbPrepareMock = vi.fn(() => ({ run: dbRunMock }));
const dbServiceMock = {
  getAllRecordings: vi.fn(),
  getRecordingProject: vi.fn(),
  getRecordingTaskStatus: vi.fn(),
  getRecording: vi.fn(),
  getRecordingById: vi.fn(),
  deleteRecording: vi.fn(),
  db: { prepare: dbPrepareMock },
};

// ── Mock de speakerManager (ya testeado a fondo en otro archivo) ────────
const speakerManagerMock = { confirmSpeakerSuggestion: vi.fn() };

// ── Mock de diarizationService (singleton) ──────────────────────────────
const diarizationServiceMock = { resolveRecording: vi.fn() };

// ── Mock de speakerResolver ──────────────────────────────────────────────
const speakerResolverMock = { resolveSpeakersInText: vi.fn() };

// ── Mock de paths.js — settingsPath es una constante de string, no un fn ──
const FAKE_SETTINGS_PATH = '/fake/userData/settings.json';
const pathsMock = {
  getRecordingsPath: vi.fn(),
  getFolderPathFromId: vi.fn(),
  settingsPath: FAKE_SETTINGS_PATH,
};

beforeAll(() => {
  originalElectronEntry = nodeRequire.cache[electronPath];
  nodeRequire.cache[electronPath] = {
    id: electronPath,
    filename: electronPath,
    loaded: true,
    exports: { ipcMain: ipcMainMock, shell: shellMock },
  };

  originalDbServiceEntry = nodeRequire.cache[dbServicePath];
  nodeRequire.cache[dbServicePath] = {
    id: dbServicePath,
    filename: dbServicePath,
    loaded: true,
    exports: dbServiceMock,
  };

  originalSpeakerManagerEntry = nodeRequire.cache[speakerManagerPath];
  nodeRequire.cache[speakerManagerPath] = {
    id: speakerManagerPath,
    filename: speakerManagerPath,
    loaded: true,
    exports: speakerManagerMock,
  };

  originalDiarizationServiceEntry = nodeRequire.cache[diarizationServicePath];
  nodeRequire.cache[diarizationServicePath] = {
    id: diarizationServicePath,
    filename: diarizationServicePath,
    loaded: true,
    exports: diarizationServiceMock,
  };

  originalSpeakerResolverEntry = nodeRequire.cache[speakerResolverPath];
  nodeRequire.cache[speakerResolverPath] = {
    id: speakerResolverPath,
    filename: speakerResolverPath,
    loaded: true,
    exports: speakerResolverMock,
  };

  originalPathsEntry = nodeRequire.cache[pathsPath];
  nodeRequire.cache[pathsPath] = {
    id: pathsPath,
    filename: pathsPath,
    loaded: true,
    exports: pathsMock,
  };
});

afterAll(() => {
  if (originalElectronEntry) nodeRequire.cache[electronPath] = originalElectronEntry;
  else delete nodeRequire.cache[electronPath];
  if (originalDbServiceEntry) nodeRequire.cache[dbServicePath] = originalDbServiceEntry;
  else delete nodeRequire.cache[dbServicePath];
  if (originalSpeakerManagerEntry) nodeRequire.cache[speakerManagerPath] = originalSpeakerManagerEntry;
  else delete nodeRequire.cache[speakerManagerPath];
  if (originalDiarizationServiceEntry) nodeRequire.cache[diarizationServicePath] = originalDiarizationServiceEntry;
  else delete nodeRequire.cache[diarizationServicePath];
  if (originalSpeakerResolverEntry) nodeRequire.cache[speakerResolverPath] = originalSpeakerResolverEntry;
  else delete nodeRequire.cache[speakerResolverPath];
  if (originalPathsEntry) nodeRequire.cache[pathsPath] = originalPathsEntry;
  else delete nodeRequire.cache[pathsPath];
});

let recordingsHandlers;

function resetAllMocks() {
  [
    ipcMainMock.handle,
    shellMock.openPath,
    dbRunMock,
    dbPrepareMock,
    ...Object.values(dbServiceMock).filter((v) => typeof v === 'function'),
    speakerManagerMock.confirmSpeakerSuggestion,
    diarizationServiceMock.resolveRecording,
    speakerResolverMock.resolveSpeakersInText,
    pathsMock.getRecordingsPath,
    pathsMock.getFolderPathFromId,
  ].forEach((fn) => fn.mockReset());

  ipcMainMock.handle.mockImplementation((channel, cb) => {
    handlers[channel] = cb;
  });
  dbPrepareMock.mockImplementation(() => ({ run: dbRunMock }));
}

beforeEach(async () => {
  Object.keys(handlers).forEach((k) => delete handlers[k]);
  resetAllMocks();

  vi.restoreAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});

  vi.spyOn(fs, 'existsSync').mockReturnValue(false);
  vi.spyOn(fs, 'readFileSync').mockImplementation(() => {
    throw new Error('ENOENT (readFileSync no configurado en este test)');
  });
  vi.spyOn(fs.promises, 'readdir').mockResolvedValue([]);
  vi.spyOn(fs.promises, 'stat').mockRejectedValue(new Error('ENOENT (stat no configurado)'));
  vi.spyOn(fs.promises, 'readFile').mockRejectedValue(new Error('ENOENT (readFile no configurado)'));
  vi.spyOn(fs.promises, 'rm').mockResolvedValue(undefined);
  vi.spyOn(fs.promises, 'rename').mockResolvedValue(undefined);
  vi.spyOn(fs.promises, 'writeFile').mockResolvedValue(undefined);

  pathsMock.getRecordingsPath.mockResolvedValue('/fake/recordings');
  pathsMock.getFolderPathFromId.mockImplementation(async (id) => `folder-${id}`);
  dbServiceMock.getAllRecordings.mockReturnValue([]);
  dbServiceMock.getRecordingProject.mockReturnValue(null);
  dbServiceMock.getRecordingTaskStatus.mockReturnValue(null);

  recordingsHandlers = await import('../../../../electron/ipc-handlers/recordings.js');
  recordingsHandlers.registerRecordingsHandlers();
});

// ─────────────────────────────────────────────────────────────────────────
// get-recording-folders — el handler más grande del archivo (~95 líneas):
// mezcla filesystem + BD para producir el listado.
// ─────────────────────────────────────────────────────────────────────────

describe('get-recording-folders', () => {
  const baseDir = '/fake/recordings';

  function stat({ isDir = true, birthtime = new Date('2024-01-01T00:00:00Z'), mtime = new Date('2024-01-02T00:00:00Z') } = {}) {
    return { isDirectory: () => isDir, birthtime, mtime };
  }

  it('el directorio base no existe → {success:true, folders: []}', async () => {
    fs.existsSync.mockReturnValue(false);

    const result = await handlers['get-recording-folders']();

    expect(result).toEqual({ success: true, folders: [] });
  });

  it('directorio vacío (readdir sin items) → folders: []', async () => {
    fs.existsSync.mockImplementation((p) => p === baseDir);
    fs.promises.readdir.mockResolvedValue([]);

    const result = await handlers['get-recording-folders']();

    expect(result).toEqual({ success: true, folders: [] });
  });

  it('item que es un archivo (no directorio) se excluye', async () => {
    fs.existsSync.mockImplementation((p) => p === baseDir);
    fs.promises.readdir.mockImplementation(async (p) => (p === baseDir ? ['nota.txt'] : []));
    fs.promises.stat.mockResolvedValue(stat({ isDir: false }));

    const result = await handlers['get-recording-folders']();

    expect(result.folders).toEqual([]);
  });

  it('carpeta sin audio ni transcripción se excluye', async () => {
    fs.existsSync.mockImplementation((p) => p === baseDir);
    fs.promises.readdir.mockImplementation(async (p) => (p === baseDir ? ['vacia'] : []));
    fs.promises.stat.mockResolvedValue(stat());

    const result = await handlers['get-recording-folders']();

    expect(result.folders).toEqual([]);
  });

  it('huérfana en disco (sin fila en BD): incluida con id:null y status derivado del filesystem', async () => {
    fs.existsSync.mockImplementation((p) => p === baseDir);
    fs.promises.readdir.mockImplementation(async (p) => {
      if (p === baseDir) return ['grabacion-suelta'];
      if (p === path.join(baseDir, 'grabacion-suelta')) return ['audio.wav'];
      return [];
    });
    fs.promises.stat.mockResolvedValue(stat());
    dbServiceMock.getAllRecordings.mockReturnValue([]); // sin filas en BD

    const result = await handlers['get-recording-folders']();

    expect(result.folders).toHaveLength(1);
    expect(result.folders[0]).toMatchObject({ id: null, folderName: 'grabacion-suelta', status: 'recorded' });
    expect(dbServiceMock.getRecordingTaskStatus).toHaveBeenCalledWith(-1);
  });

  it('con fila en BD: el status prioriza el de BD sobre el inferido del filesystem', async () => {
    fs.existsSync.mockImplementation((p) => p === baseDir);
    fs.promises.readdir.mockImplementation(async (p) => {
      if (p === baseDir) return ['reunion-1'];
      if (p === path.join(baseDir, 'reunion-1')) return ['audio.wav'];
      return [];
    });
    fs.promises.stat.mockResolvedValue(stat());
    dbServiceMock.getAllRecordings.mockReturnValue([
      { id: 7, relative_path: 'reunion-1', status: 'recorded', created_at: 't1', duration: 42, transcription_model: 'whisper', source: 'app' },
    ]);

    const result = await handlers['get-recording-folders']();

    expect(result.folders[0]).toMatchObject({ id: 7, status: 'recorded', duration: 42, source: 'app' });
    expect(dbServiceMock.getRecordingTaskStatus).toHaveBeenCalledWith(7);
  });

  it('BOUNDARY: ai_summary.json presente fuerza status "analyzed" incluso si el status de BD es otro', async () => {
    fs.existsSync.mockImplementation((p) => {
      if (p === baseDir) return true;
      if (p === path.join(baseDir, 'reunion-1', 'analysis', 'ai_summary.json')) return true;
      return false;
    });
    fs.promises.readdir.mockImplementation(async (p) => {
      if (p === baseDir) return ['reunion-1'];
      if (p === path.join(baseDir, 'reunion-1')) return ['audio.wav'];
      return [];
    });
    fs.promises.stat.mockResolvedValue(stat());
    dbServiceMock.getAllRecordings.mockReturnValue([
      { id: 7, relative_path: 'reunion-1', status: 'recorded', created_at: 't1' },
    ]);

    const result = await handlers['get-recording-folders']();

    expect(result.folders[0].status).toBe('analyzed');
    expect(result.folders[0].hasAnalysis).toBe(true);
  });

  it('metadata.json con customName sobreescribe el nombre mostrado', async () => {
    fs.existsSync.mockImplementation((p) => {
      if (p === baseDir) return true;
      if (p === path.join(baseDir, 'reunion-1', 'metadata.json')) return true;
      return false;
    });
    fs.promises.readdir.mockImplementation(async (p) => {
      if (p === baseDir) return ['reunion-1'];
      if (p === path.join(baseDir, 'reunion-1')) return ['audio.wav'];
      return [];
    });
    fs.promises.stat.mockResolvedValue(stat());
    fs.readFileSync.mockImplementation((p) => {
      if (p === path.join(baseDir, 'reunion-1', 'metadata.json')) return JSON.stringify({ customName: 'Reunión Importante' });
      throw new Error('ENOENT');
    });

    const result = await handlers['get-recording-folders']();

    expect(result.folders[0].name).toBe('Reunión Importante');
  });

  it('metadata.json corrupto → no revienta, cae al nombre de carpeta y loguea warning', async () => {
    fs.existsSync.mockImplementation((p) => {
      if (p === baseDir) return true;
      if (p === path.join(baseDir, 'reunion-1', 'metadata.json')) return true;
      return false;
    });
    fs.promises.readdir.mockImplementation(async (p) => {
      if (p === baseDir) return ['reunion-1'];
      if (p === path.join(baseDir, 'reunion-1')) return ['audio.wav'];
      return [];
    });
    fs.promises.stat.mockResolvedValue(stat());
    fs.readFileSync.mockImplementation((p) => {
      if (p === path.join(baseDir, 'reunion-1', 'metadata.json')) return '{ json invalido';
      throw new Error('ENOENT');
    });

    const result = await handlers['get-recording-folders']();

    expect(result.folders[0].name).toBe('reunion-1');
    expect(console.warn).toHaveBeenCalled();
  });

  it('resiliencia: un error en fs.promises.stat de UN item no interrumpe el resto (se loguea y se salta)', async () => {
    fs.existsSync.mockImplementation((p) => p === baseDir);
    fs.promises.readdir.mockImplementation(async (p) => {
      if (p === baseDir) return ['rota', 'sana'];
      if (p === path.join(baseDir, 'sana')) return ['audio.wav'];
      return [];
    });
    fs.promises.stat.mockImplementation(async (p) => {
      if (p === path.join(baseDir, 'rota')) throw new Error('EACCES permiso denegado');
      return stat();
    });

    const result = await handlers['get-recording-folders']();

    expect(result.success).toBe(true);
    expect(result.folders).toHaveLength(1);
    expect(result.folders[0].folderName).toBe('sana');
    expect(console.warn).toHaveBeenCalled();
  });

  it('ordena por fecha de creación descendente', async () => {
    fs.existsSync.mockImplementation((p) => p === baseDir);
    fs.promises.readdir.mockImplementation(async (p) => {
      if (p === baseDir) return ['vieja', 'nueva'];
      return ['audio.wav'];
    });
    fs.promises.stat.mockResolvedValue(stat());
    dbServiceMock.getAllRecordings.mockReturnValue([
      { id: 1, relative_path: 'vieja', status: 'recorded', created_at: '2020-01-01T00:00:00Z' },
      { id: 2, relative_path: 'nueva', status: 'recorded', created_at: '2024-06-01T00:00:00Z' },
    ]);

    const result = await handlers['get-recording-folders']();

    expect(result.folders.map((f) => f.folderName)).toEqual(['nueva', 'vieja']);
  });

  it('DOCUMENTADO (no bug): una fila de BD sin carpeta correspondiente en disco es completamente invisible en el resultado', async () => {
    // El bucle itera sobre `items` (resultado de fs.promises.readdir del
    // directorio base), no sobre las filas de la BD. Si una grabación existe
    // en la BD pero su carpeta fue borrada/movida manualmente del disco,
    // simplemente no aparece en absoluto en `folders` — sin error, sin aviso,
    // sin ninguna señal de que existe un registro huérfano en la BD. No es un
    // crash, pero sí una laguna de diagnóstico: el usuario no tiene forma de
    // detectar grabaciones "fantasma" en BD desde este handler.
    fs.existsSync.mockImplementation((p) => p === baseDir);
    fs.promises.readdir.mockResolvedValue([]); // ninguna carpeta en disco
    dbServiceMock.getAllRecordings.mockReturnValue([
      { id: 99, relative_path: 'grabacion-borrada-del-disco', status: 'analyzed', created_at: 't1' },
    ]);

    const result = await handlers['get-recording-folders']();

    expect(result.folders).toEqual([]);
  });

  it('error de nivel superior (readdir del directorio base falla) → capturado, success:false', async () => {
    fs.existsSync.mockImplementation((p) => p === baseDir);
    fs.promises.readdir.mockRejectedValue(new Error('EACCES en directorio base'));

    const result = await handlers['get-recording-folders']();

    expect(result).toEqual({ success: false, error: 'EACCES en directorio base' });
  });
});

// ─────────────────────────────────────────────────────────────────────────
// get-transcription — el handler más denso en lógica de negocio: ensambla
// la transcripción, resuelve hablantes vía diarización, y remapea segmentos
// legacy "SISTEMA" (Phase 5b).
// ─────────────────────────────────────────────────────────────────────────

describe('get-transcription', () => {
  const baseDir = '/fake/recordings';
  const folderName = 'folder-1';
  const transcriptionPath = path.join(baseDir, folderName, 'analysis', 'transcripcion_combinada.json');
  const diarizationPath = path.join(baseDir, folderName, 'analysis', 'diarization.json');

  function baseFsSetup({ transcriptionContent, settingsContent, diarizationContent, existsOverrides = {} } = {}) {
    fs.existsSync.mockImplementation((p) => {
      if (p in existsOverrides) return existsOverrides[p];
      if (p === transcriptionPath) return transcriptionContent !== undefined;
      if (p === FAKE_SETTINGS_PATH) return settingsContent !== undefined;
      if (p === diarizationPath) return diarizationContent !== undefined;
      return false;
    });
    fs.promises.readFile.mockImplementation(async (p) => {
      if (p === transcriptionPath) return transcriptionContent;
      throw new Error(`ENOENT: ${p}`);
    });
    fs.readFileSync.mockImplementation((p) => {
      if (p === FAKE_SETTINGS_PATH) return settingsContent;
      if (p === diarizationPath) return diarizationContent;
      throw new Error(`ENOENT: ${p}`);
    });
  }

  it('grabación sin archivo de transcripción → "Transcripción no encontrada"', async () => {
    baseFsSetup({});

    const result = await handlers['get-transcription']({}, 1);

    expect(result).toEqual({ success: false, error: 'Transcripción no encontrada' });
  });

  it('JSON de transcripción corrupto → capturado por el catch externo (sin try/catch dedicado, a diferencia de recording-schema)', async () => {
    baseFsSetup({ transcriptionContent: '{ json invalido' });
    diarizationServiceMock.resolveRecording.mockReturnValue({ resolutionMap: {}, pendingSuggestions: [], _source: 'none' });

    const result = await handlers['get-transcription']({}, 1);

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('formato legacy (array plano) se envuelve en { segments: [...] }', async () => {
    const segments = [{ speaker: 'Ana', text: 'hola', start: 0, end: 1 }];
    baseFsSetup({ transcriptionContent: JSON.stringify(segments) });
    diarizationServiceMock.resolveRecording.mockReturnValue({ resolutionMap: {}, pendingSuggestions: [], _source: 'none' });

    const result = await handlers['get-transcription']({}, 1);

    expect(result.transcription.segments).toEqual(segments);
  });

  it('formato ya-objeto se conserva tal cual (no se re-envuelve)', async () => {
    const content = { segments: [{ speaker: 'Ana', text: 'hola' }], meta: { lang: 'es' } };
    baseFsSetup({ transcriptionContent: JSON.stringify(content) });
    diarizationServiceMock.resolveRecording.mockReturnValue({ resolutionMap: {}, pendingSuggestions: [], _source: 'none' });

    const result = await handlers['get-transcription']({}, 1);

    expect(result.transcription.meta).toEqual({ lang: 'es' });
  });

  it('sin settings.json → usa threshold default 0.85', async () => {
    baseFsSetup({ transcriptionContent: '{"segments":[]}' });
    diarizationServiceMock.resolveRecording.mockReturnValue({ resolutionMap: {}, pendingSuggestions: [], _source: 'none' });

    await handlers['get-transcription']({}, 1);

    expect(diarizationServiceMock.resolveRecording).toHaveBeenCalledWith(
      expect.objectContaining({ threshold: 0.85 })
    );
  });

  it('con settings.json y speakerSimilarityThreshold custom → se usa ese valor', async () => {
    baseFsSetup({
      transcriptionContent: '{"segments":[]}',
      settingsContent: JSON.stringify({ speakerSimilarityThreshold: 0.6 }),
    });
    diarizationServiceMock.resolveRecording.mockReturnValue({ resolutionMap: {}, pendingSuggestions: [], _source: 'none' });

    await handlers['get-transcription']({}, 1);

    expect(diarizationServiceMock.resolveRecording).toHaveBeenCalledWith(
      expect.objectContaining({ threshold: 0.6 })
    );
  });

  it('settings.json corrupto → no revienta, cae al threshold default 0.85 (catch silencioso)', async () => {
    baseFsSetup({ transcriptionContent: '{"segments":[]}', settingsContent: '{ corrupto' });
    diarizationServiceMock.resolveRecording.mockReturnValue({ resolutionMap: {}, pendingSuggestions: [], _source: 'none' });

    const result = await handlers['get-transcription']({}, 1);

    expect(result.success).toBe(true);
    expect(diarizationServiceMock.resolveRecording).toHaveBeenCalledWith(
      expect.objectContaining({ threshold: 0.85 })
    );
  });

  it('dbService.getRecording sin match → numericRecordingId null, pasado tal cual a resolveRecording', async () => {
    baseFsSetup({ transcriptionContent: '{"segments":[]}' });
    dbServiceMock.getRecording.mockReturnValue(null);
    diarizationServiceMock.resolveRecording.mockReturnValue({ resolutionMap: {}, pendingSuggestions: [], _source: 'none' });

    await handlers['get-transcription']({}, 1);

    expect(diarizationServiceMock.resolveRecording).toHaveBeenCalledWith(
      expect.objectContaining({ recordingId: null, folderName, baseOutputDir: baseDir })
    );
  });

  it('speakerResolution se mezcla en la respuesta final', async () => {
    baseFsSetup({ transcriptionContent: '{"segments":[]}' });
    diarizationServiceMock.resolveRecording.mockReturnValue({
      resolutionMap: { EPH_1: { displayName: 'Ana' } },
      pendingSuggestions: [],
      _source: 'diarization',
    });

    const result = await handlers['get-transcription']({}, 1);

    expect(result.transcription.speakerResolution).toMatchObject({
      EPH_1: { displayName: 'Ana' },
      _source: 'diarization',
    });
  });

  it('pendingSuggestions con elementos → se añade _pendingSuggestions; vacío → la clave NO aparece', async () => {
    baseFsSetup({ transcriptionContent: '{"segments":[]}' });
    diarizationServiceMock.resolveRecording.mockReturnValueOnce({
      resolutionMap: {},
      pendingSuggestions: [{ ephemeralId: 'E1' }],
      _source: 'diarization',
    });

    const withSuggestions = await handlers['get-transcription']({}, 1);
    expect(withSuggestions.transcription.speakerResolution._pendingSuggestions).toEqual([{ ephemeralId: 'E1' }]);

    diarizationServiceMock.resolveRecording.mockReturnValueOnce({
      resolutionMap: {},
      pendingSuggestions: [],
      _source: 'diarization',
    });
    const withoutSuggestions = await handlers['get-transcription']({}, 1);
    expect(withoutSuggestions.transcription.speakerResolution).not.toHaveProperty('_pendingSuggestions');
  });

  it('resiliencia: si diarizationService.resolveRecording lanza, la transcripción se devuelve igual con speakerResolution:{}', async () => {
    baseFsSetup({ transcriptionContent: '{"segments":[{"speaker":"Ana","text":"hola"}]}' });
    diarizationServiceMock.resolveRecording.mockImplementation(() => {
      throw new Error('embeddings corruptos');
    });

    const result = await handlers['get-transcription']({}, 1);

    expect(result.success).toBe(true);
    expect(result.transcription.speakerResolution).toEqual({});
    expect(console.warn).toHaveBeenCalled();
  });

  it('Phase 5b: remapea segmentos "SISTEMA"/"SYSTEM" al hablante de diarización más cercano por midpoint', async () => {
    const transcriptionContent = JSON.stringify({
      segments: [
        { speaker: 'SISTEMA', text: 'legacy', start: 0, end: 5 }, // mid=2.5, más cerca de SPEAKER_A (mid=5)
        { speaker: 'system', text: 'legacy2', start: 100, end: 100 }, // mid=100, más cerca de SPEAKER_B (mid=95)
        { speaker: 'Ana', text: 'no toca', start: 22, end: 24 }, // no es SISTEMA/SYSTEM, no se toca
      ],
    });
    const diarizationContent = JSON.stringify({
      segments: [
        { start: 0, end: 10, speaker: 'SPEAKER_A' },
        { start: 90, end: 100, speaker: 'SPEAKER_B' },
      ],
    });
    baseFsSetup({ transcriptionContent, diarizationContent });
    diarizationServiceMock.resolveRecording.mockReturnValue({ resolutionMap: {}, pendingSuggestions: [], _source: 'diarization' });

    const result = await handlers['get-transcription']({}, 1);

    expect(result.transcription.segments[0].speaker).toBe('SPEAKER_A');
    expect(result.transcription.segments[1].speaker).toBe('SPEAKER_B');
    expect(result.transcription.segments[2].speaker).toBe('Ana'); // sin tocar
  });

  it('Phase 5b: segmento sin campo speaker no revienta ni se remapea', async () => {
    const transcriptionContent = JSON.stringify({ segments: [{ text: 'sin hablante', start: 0, end: 1 }] });
    const diarizationContent = JSON.stringify({ segments: [{ start: 0, end: 10, speaker: 'SPEAKER_A' }] });
    baseFsSetup({ transcriptionContent, diarizationContent });
    diarizationServiceMock.resolveRecording.mockReturnValue({ resolutionMap: {}, pendingSuggestions: [], _source: 'diarization' });

    const result = await handlers['get-transcription']({}, 1);

    expect(result.transcription.segments[0].speaker).toBeUndefined();
  });

  it('Phase 5b: si el segmento de diarización más cercano no tiene speaker, el segmento original se conserva sin tocar', async () => {
    const transcriptionContent = JSON.stringify({ segments: [{ speaker: 'SISTEMA', text: 'x', start: 0, end: 1 }] });
    const diarizationContent = JSON.stringify({ segments: [{ start: 0, end: 10 }] }); // sin `speaker`
    baseFsSetup({ transcriptionContent, diarizationContent });
    diarizationServiceMock.resolveRecording.mockReturnValue({ resolutionMap: {}, pendingSuggestions: [], _source: 'diarization' });

    const result = await handlers['get-transcription']({}, 1);

    expect(result.transcription.segments[0].speaker).toBe('SISTEMA');
  });

  it('Phase 5b: diarization.json corrupto → remapeo se salta silenciosamente, no revienta el handler', async () => {
    const transcriptionContent = JSON.stringify({ segments: [{ speaker: 'SISTEMA', text: 'x', start: 0, end: 1 }] });
    baseFsSetup({ transcriptionContent, diarizationContent: '{ corrupto' });
    diarizationServiceMock.resolveRecording.mockReturnValue({ resolutionMap: {}, pendingSuggestions: [], _source: 'diarization' });

    const result = await handlers['get-transcription']({}, 1);

    expect(result.success).toBe(true);
    expect(result.transcription.segments[0].speaker).toBe('SISTEMA'); // sin remapear
  });

  it('Phase 5b: si _source no es "diarization", el remapeo se salta por completo aunque diarization.json exista y tenga segmentos válidos', async () => {
    const transcriptionContent = JSON.stringify({ segments: [{ speaker: 'SISTEMA', text: 'x', start: 0, end: 1 }] });
    const diarizationContent = JSON.stringify({ segments: [{ start: 0, end: 10, speaker: 'SPEAKER_A' }] });
    baseFsSetup({ transcriptionContent, diarizationContent });
    diarizationServiceMock.resolveRecording.mockReturnValue({ resolutionMap: {}, pendingSuggestions: [], _source: 'manual' });

    const result = await handlers['get-transcription']({}, 1);

    expect(result.transcription.segments[0].speaker).toBe('SISTEMA'); // guard evita tocar nada
  });
});

// ─────────────────────────────────────────────────────────────────────────
// get-transcription-txt, delete-recording, download-recording,
// get-recording-by-id — profundidad moderada (happy path + not-found + 1
// edge case real).
// ─────────────────────────────────────────────────────────────────────────

describe('get-transcription-txt', () => {
  it('archivo TXT no encontrado → error', async () => {
    fs.existsSync.mockReturnValue(false);

    const result = await handlers['get-transcription-txt']({}, 1);

    expect(result).toEqual({ success: false, error: 'Archivo TXT no encontrado' });
    expect(speakerResolverMock.resolveSpeakersInText).not.toHaveBeenCalled();
  });

  it('camino feliz: resuelve hablantes en el texto y devuelve el resultado resuelto', async () => {
    fs.existsSync.mockReturnValue(true);
    fs.promises.readFile.mockResolvedValue('Ana: hola\nBruno: qué tal');
    dbServiceMock.getRecording.mockReturnValue({ id: 55 });
    speakerResolverMock.resolveSpeakersInText.mockReturnValue('Ana Resuelta: hola\nBruno Resuelto: qué tal');

    const result = await handlers['get-transcription-txt']({}, 1);

    expect(speakerResolverMock.resolveSpeakersInText).toHaveBeenCalledWith(55, 'Ana: hola\nBruno: qué tal', dbServiceMock);
    expect(result).toEqual({ success: true, text: 'Ana Resuelta: hola\nBruno Resuelto: qué tal' });
  });

  it('BOUNDARY: sin fila en BD (getRecording null) → numericId undefined se pasa igual a resolveSpeakersInText', async () => {
    fs.existsSync.mockReturnValue(true);
    fs.promises.readFile.mockResolvedValue('texto');
    dbServiceMock.getRecording.mockReturnValue(null);
    speakerResolverMock.resolveSpeakersInText.mockReturnValue('texto');

    await handlers['get-transcription-txt']({}, 1);

    expect(speakerResolverMock.resolveSpeakersInText).toHaveBeenCalledWith(undefined, 'texto', dbServiceMock);
  });

  it('resolveSpeakersInText lanza → capturado por el catch del handler, success:false', async () => {
    fs.existsSync.mockReturnValue(true);
    fs.promises.readFile.mockResolvedValue('texto');
    dbServiceMock.getRecording.mockReturnValue({ id: 1 });
    speakerResolverMock.resolveSpeakersInText.mockImplementation(() => {
      throw new Error('fallo resolviendo hablantes');
    });

    const result = await handlers['get-transcription-txt']({}, 1);

    expect(result).toEqual({ success: false, error: 'fallo resolviendo hablantes' });
  });
});

describe('delete-recording', () => {
  it('grabación no encontrada → error, sin llamar a rm ni a dbService.deleteRecording', async () => {
    fs.existsSync.mockReturnValue(false);

    const result = await handlers['delete-recording']({}, 1);

    expect(result).toEqual({ success: false, error: 'Grabación no encontrada' });
    expect(fs.promises.rm).not.toHaveBeenCalled();
    expect(dbServiceMock.deleteRecording).not.toHaveBeenCalled();
  });

  it('camino feliz: borra recursivamente y limpia el registro en BD', async () => {
    fs.existsSync.mockReturnValue(true);

    const result = await handlers['delete-recording']({}, 1);

    expect(fs.promises.rm).toHaveBeenCalledWith(expect.stringContaining('folder-1'), { recursive: true, force: true });
    expect(dbServiceMock.deleteRecording).toHaveBeenCalledWith('folder-1');
    expect(result).toEqual({ success: true, message: 'Grabación eliminada correctamente' });
  });

  it('fs.promises.rm falla → capturado, success:false, dbService.deleteRecording NO se llega a invocar', async () => {
    fs.existsSync.mockReturnValue(true);
    fs.promises.rm.mockRejectedValue(new Error('EBUSY'));

    const result = await handlers['delete-recording']({}, 1);

    expect(result).toEqual({ success: false, error: 'EBUSY' });
    expect(dbServiceMock.deleteRecording).not.toHaveBeenCalled();
  });
});

describe('download-recording', () => {
  it('grabación no encontrada → error, sin abrir el explorador', async () => {
    fs.existsSync.mockReturnValue(false);

    const result = await handlers['download-recording']({}, 1);

    expect(result).toEqual({ success: false, error: 'Grabación no encontrada' });
    expect(shellMock.openPath).not.toHaveBeenCalled();
  });

  it('camino feliz: abre la carpeta en el explorador nativo', async () => {
    fs.existsSync.mockReturnValue(true);

    const result = await handlers['download-recording']({}, 1);

    expect(shellMock.openPath).toHaveBeenCalledWith(expect.stringContaining('folder-1'));
    expect(result).toEqual({ success: true });
  });

  it('shell.openPath lanza → capturado, success:false con el mensaje', async () => {
    fs.existsSync.mockReturnValue(true);
    shellMock.openPath.mockImplementation(() => {
      throw new Error('no se pudo abrir el explorador');
    });

    const result = await handlers['download-recording']({}, 1);

    expect(result).toEqual({ success: false, error: 'no se pudo abrir el explorador' });
  });
});

describe('get-recording-by-id', () => {
  it('no encontrada → error', async () => {
    dbServiceMock.getRecordingById.mockReturnValue(null);

    const result = await handlers['get-recording-by-id']({}, 1);

    expect(result).toEqual({ success: false, error: 'Grabación no encontrada' });
  });

  it('camino feliz: devuelve la grabación', async () => {
    dbServiceMock.getRecordingById.mockReturnValue({ id: 1, relative_path: 'x' });

    const result = await handlers['get-recording-by-id']({}, 1);

    expect(result).toEqual({ success: true, recording: { id: 1, relative_path: 'x' } });
  });

  it('dbService.getRecordingById lanza → capturado, success:false', async () => {
    dbServiceMock.getRecordingById.mockImplementation(() => {
      throw new Error('BD no disponible');
    });

    const result = await handlers['get-recording-by-id']({}, 1);

    expect(result).toEqual({ success: false, error: 'BD no disponible' });
  });
});

// ─────────────────────────────────────────────────────────────────────────
// rename-recording — el handler con más pasos secuenciales: sanitiza,
// detecta colisión, renombra carpeta + archivos internos + BD + metadata.
// ─────────────────────────────────────────────────────────────────────────

describe('rename-recording', () => {
  const baseDir = '/fake/recordings';
  const oldFolder = 'folder-1';
  const oldPath = path.join(baseDir, oldFolder);

  function setup({ existsOverrides = {}, dbEntry = null, internalFiles = [], metadataContent } = {}) {
    fs.existsSync.mockImplementation((p) => {
      if (p in existsOverrides) return existsOverrides[p];
      return false;
    });
    fs.promises.readdir.mockResolvedValue(internalFiles);
    dbServiceMock.getRecording.mockReturnValue(dbEntry);
    if (metadataContent !== undefined) {
      fs.promises.readFile.mockImplementation(async (p) => {
        if (p.endsWith('metadata.json')) return metadataContent;
        throw new Error('ENOENT');
      });
    }
  }

  it('grabación no encontrada (carpeta origen no existe) → error, sin intentar renombrar', async () => {
    setup({ existsOverrides: { [oldPath]: false } });

    const result = await handlers['rename-recording']({}, 1, 'Nuevo Nombre');

    expect(result).toEqual({ success: false, error: 'Grabación no encontrada' });
    expect(fs.promises.rename).not.toHaveBeenCalled();
  });

  it('colisión: ya existe una carpeta con el nuevo nombre (distinta de la actual) → error, sin renombrar', async () => {
    const newPath = path.join(baseDir, 'Nombre Ocupado');
    setup({ existsOverrides: { [oldPath]: true, [newPath]: true } });

    const result = await handlers['rename-recording']({}, 1, 'Nombre Ocupado');

    expect(result).toEqual({ success: false, error: 'Ya existe una carpeta con ese nombre' });
    expect(fs.promises.rename).not.toHaveBeenCalled();
  });

  it('BOUNDARY: renombrar a un nombre que sanitiza al MISMO nombre actual no se trata como colisión', async () => {
    // oldPath === newPath tras sanitizar, así que aunque fs.existsSync(newPath)
    // sea true (es la propia carpeta), el guard `oldPath !== newPath` evita el
    // falso positivo de colisión.
    setup({ existsOverrides: { [oldPath]: true }, dbEntry: null });

    const result = await handlers['rename-recording']({}, 1, oldFolder);

    expect(result.success).toBe(true);
    expect(fs.promises.rename).toHaveBeenCalledWith(oldPath, oldPath);
  });

  it('sanitiza caracteres inválidos de filesystem reemplazándolos por "_"', async () => {
    const dirtyName = 'Reunión: Q1/Q2!';
    const expectedSafeName = dirtyName.replace(/[^a-z0-9áéíóúñü \-_]/gi, '_').trim();
    const newPath = path.join(baseDir, expectedSafeName);
    setup({ existsOverrides: { [oldPath]: true, [newPath]: false } });

    const result = await handlers['rename-recording']({}, 1, dirtyName);

    expect(result).toEqual({ success: true, folderName: expectedSafeName });
    expect(fs.promises.rename).toHaveBeenCalledWith(oldPath, newPath);
  });

  it('renombra los archivos internos que tienen el prefijo antiguo, deja intactos los que no', async () => {
    const newPath = path.join(baseDir, 'Nuevo Nombre');
    setup({
      existsOverrides: { [oldPath]: true, [newPath]: false },
      internalFiles: [`${oldFolder}_audio.wav`, 'otro_archivo.txt'],
    });

    await handlers['rename-recording']({}, 1, 'Nuevo Nombre');

    expect(fs.promises.rename).toHaveBeenCalledWith(
      path.join(newPath, `${oldFolder}_audio.wav`),
      path.join(newPath, 'Nuevo Nombre_audio.wav')
    );
    expect(fs.promises.rename).not.toHaveBeenCalledWith(
      path.join(newPath, 'otro_archivo.txt'),
      expect.anything()
    );
  });

  it('con fila en BD: actualiza relative_path vía dbService.db.prepare(...).run', async () => {
    const newPath = path.join(baseDir, 'Nuevo Nombre');
    setup({
      existsOverrides: { [oldPath]: true, [newPath]: false },
      dbEntry: { id: 9, relative_path: oldFolder },
    });

    await handlers['rename-recording']({}, 1, 'Nuevo Nombre');

    expect(dbPrepareMock).toHaveBeenCalledWith(expect.stringContaining('UPDATE recordings'));
    expect(dbRunMock).toHaveBeenCalledWith('Nuevo Nombre', 9);
  });

  it('sin fila en BD: NO se toca la base de datos (skip completo del bloque de actualización)', async () => {
    const newPath = path.join(baseDir, 'Nuevo Nombre');
    setup({ existsOverrides: { [oldPath]: true, [newPath]: false }, dbEntry: null });

    await handlers['rename-recording']({}, 1, 'Nuevo Nombre');

    expect(dbPrepareMock).not.toHaveBeenCalled();
  });

  it('metadata.json corrupto → no revienta, arranca de {} y persiste el customName igualmente', async () => {
    const newPath = path.join(baseDir, 'Nuevo Nombre');
    setup({
      existsOverrides: { [oldPath]: true, [newPath]: false, [path.join(newPath, 'metadata.json')]: true },
      metadataContent: '{ corrupto',
    });

    const result = await handlers['rename-recording']({}, 1, 'Nuevo Nombre');

    expect(result.success).toBe(true);
    const written = JSON.parse(fs.promises.writeFile.mock.calls.find((c) => c[0].endsWith('metadata.json'))[1]);
    expect(written).toEqual({ customName: 'Nuevo Nombre' });
  });

  it('metadata.json ausente → se crea desde cero con el customName', async () => {
    const newPath = path.join(baseDir, 'Nuevo Nombre');
    setup({ existsOverrides: { [oldPath]: true, [newPath]: false } }); // metadata.json no existe

    await handlers['rename-recording']({}, 1, 'Nuevo Nombre');

    const written = JSON.parse(fs.promises.writeFile.mock.calls.find((c) => c[0].endsWith('metadata.json'))[1]);
    expect(written).toEqual({ customName: 'Nuevo Nombre' });
  });

  it('fs.promises.rename falla → capturado, success:false', async () => {
    const newPath = path.join(baseDir, 'Nuevo Nombre');
    setup({ existsOverrides: { [oldPath]: true, [newPath]: false } });
    fs.promises.rename.mockRejectedValue(new Error('EPERM'));

    const result = await handlers['rename-recording']({}, 1, 'Nuevo Nombre');

    expect(result).toEqual({ success: false, error: 'EPERM' });
  });
});

// ─────────────────────────────────────────────────────────────────────────
// confirm-speaker-suggestion — wrapper delgado sobre
// speakerManager.confirmSpeakerSuggestion (ya testeado a fondo en otro
// archivo de esta sesión): sólo se valida la delegación y el guard de
// parámetros requeridos.
// ─────────────────────────────────────────────────────────────────────────

describe('confirm-speaker-suggestion', () => {
  it('faltan parámetros requeridos → error de validación sin llamar a speakerManager', async () => {
    const result = await handlers['confirm-speaker-suggestion']({}, { recordingId: 1, ephemeralId: 'E1' }); // sin confirmedSpeakerId

    expect(result).toEqual({
      success: false,
      error: 'Faltan parámetros: recordingId, ephemeralId, confirmedSpeakerId.',
    });
    expect(speakerManagerMock.confirmSpeakerSuggestion).not.toHaveBeenCalled();
  });

  it('payload completamente ausente (undefined) → no revienta, mismo error de validación', async () => {
    const result = await handlers['confirm-speaker-suggestion']({}, undefined);

    expect(result.success).toBe(false);
    expect(speakerManagerMock.confirmSpeakerSuggestion).not.toHaveBeenCalled();
  });

  it('camino feliz: delega con los 4 argumentos en orden y devuelve el resultado tal cual', async () => {
    speakerManagerMock.confirmSpeakerSuggestion.mockReturnValue({ success: true, displayName: 'Ana' });

    const result = await handlers['confirm-speaker-suggestion'](
      {},
      { recordingId: 1, ephemeralId: 'E1', confirmedSpeakerId: 'S1', currentSpeakerId: 'S0' }
    );

    expect(speakerManagerMock.confirmSpeakerSuggestion).toHaveBeenCalledWith(1, 'E1', 'S1', 'S0');
    expect(result).toEqual({ success: true, displayName: 'Ana' });
  });

  it('speakerManager lanza → capturado por el catch del handler, success:false con el mensaje', async () => {
    speakerManagerMock.confirmSpeakerSuggestion.mockImplementation(() => {
      throw new Error('embedding no encontrado');
    });

    const result = await handlers['confirm-speaker-suggestion'](
      {},
      { recordingId: 1, ephemeralId: 'E1', confirmedSpeakerId: 'S1' }
    );

    expect(result).toEqual({ success: false, error: 'embedding no encontrado' });
  });
});
