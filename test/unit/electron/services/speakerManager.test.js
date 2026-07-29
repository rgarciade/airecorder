/**
 * speakerManager.test.js
 *
 * Tests unitarios para electron/services/speakerManager.js — la lógica de
 * re-identificación de hablantes (matching por similitud coseno, filtrado de
 * embeddings duplicados/compresión, asignación de alias, fusión de perfiles
 * y confirmación de sugerencias).
 *
 * speakerManager.js hace, a nivel de módulo:
 *   const speakerRepository = require('../database/speakerRepository');
 *   const dbService = require('../database/dbService');
 * Ambos son CJS puro (este proyecto no tiene "type":"module" en package.json),
 * así que `vi.mock()` NO intercepta esos requires internos — confirmado
 * repetidamente en pases anteriores de esta sesión (ver el header-comment de
 * speakerRepository.dbLookup.test.js y updateChecker.test.js). La solución
 * establecida es inyectar objetos mock directamente en `require.cache` de
 * Node vía `createRequire(import.meta.url)` ANTES de que speakerManager.js
 * sea importado por primera vez, y usar `import()` dinámico dentro de
 * `beforeEach` (nunca un `import` estático arriba del archivo) para no
 * resolver el módulo antes de que el mock esté instalado.
 *
 * A diferencia de dbLookup.test.js (que sólo mockea dbService), este archivo
 * necesita mockear DOS módulos simultáneamente — speakerRepository Y
 * dbService — porque speakerManager.js los requiere a ambos. El patrón de
 * "dos entradas de require.cache a la vez" ya se usó en updateChecker.test.js
 * (electron + paths), así que se replica aquí igual.
 */
import { describe, test, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { createRequire } from 'node:module';

const nodeRequire = createRequire(import.meta.url);
const speakerRepoPath = nodeRequire.resolve('../../../../electron/database/speakerRepository.js');
const dbServicePath = nodeRequire.resolve('../../../../electron/database/dbService.js');

let originalSpeakerRepoEntry;
let originalDbServiceEntry;

const speakerRepoMock = {
  getEmbeddingsBySpeakerId: vi.fn(),
  cosineSimilarity: vi.fn(),
  findMostSimilarPair: vi.fn(),
  averageEmbeddingPair: vi.fn(),
  findMatchingSpeaker: vi.fn(),
  findCandidateSpeakers: vi.fn(),
};

const dbServiceMock = {
  createSpeaker: vi.fn(),
  saveSpeakerEmbedding: vi.fn(),
  deleteSpeakerEmbedding: vi.fn(),
  getSpeakerByAlias: vi.fn(),
  deleteSpeaker: vi.fn(),
  reassignSpeakerEmbeddings: vi.fn(),
  reassignRecordingSpeakerResolutions: vi.fn(),
  upsertRecordingSpeakerResolution: vi.fn(),
  getRecordingSpeakerResolutions: vi.fn(),
  db: null,
};

beforeAll(() => {
  originalSpeakerRepoEntry = nodeRequire.cache[speakerRepoPath];
  nodeRequire.cache[speakerRepoPath] = {
    id: speakerRepoPath,
    filename: speakerRepoPath,
    loaded: true,
    exports: speakerRepoMock,
  };

  originalDbServiceEntry = nodeRequire.cache[dbServicePath];
  nodeRequire.cache[dbServicePath] = {
    id: dbServicePath,
    filename: dbServicePath,
    loaded: true,
    exports: dbServiceMock,
  };
});

afterAll(() => {
  if (originalSpeakerRepoEntry) nodeRequire.cache[speakerRepoPath] = originalSpeakerRepoEntry;
  else delete nodeRequire.cache[speakerRepoPath];

  if (originalDbServiceEntry) nodeRequire.cache[dbServicePath] = originalDbServiceEntry;
  else delete nodeRequire.cache[dbServicePath];
});

// ── Helpers ──────────────────────────────────────────────────────────────

/** Fila cruda tal como la devolvería speakerRepository.getEmbeddingsBySpeakerId(). */
function embRow(id, overrides = {}) {
  return {
    id,
    speaker_id: 'sp-whoever',
    embedding: [id],
    recording_id: null,
    created_at: null,
    ...overrides,
  };
}

/**
 * Fake de `dbService.db` (instancia better-sqlite3) suficiente para los
 * call-sites exactos que usa speakerManager.js: sólo dos SELECT distintos
 * ("SELECT * FROM speakers WHERE id = ?" y los dos "SELECT 1 FROM ... LIMIT 1"),
 * un UPDATE de display_name, y `.transaction(fn)`. Un router por
 * string-matching sobre el SQL es suficiente — no hace falta un intérprete
 * SQL real.
 */
function createFakeDb({ speakers = {}, recordingIds = new Set() } = {}) {
  const prepare = vi.fn((sql) => ({
    get: vi.fn((...args) => {
      const [id] = args;
      if (sql.startsWith('SELECT * FROM speakers WHERE id = ?')) {
        return speakers[id];
      }
      if (sql.includes('SELECT 1 FROM recordings WHERE id = ?')) {
        return recordingIds.has(id) ? { 1: 1 } : undefined;
      }
      if (sql.includes('SELECT 1 FROM speakers WHERE id = ?')) {
        return speakers[id] ? { 1: 1 } : undefined;
      }
      return undefined;
    }),
    run: vi.fn((...args) => {
      // Único UPDATE emitido por el código bajo test: refleja el nuevo
      // display_name en el mapa para que un re-SELECT posterior (patrón
      // usado por assignAlias) vea el cambio, igual que SQLite real.
      if (sql.startsWith('UPDATE speakers SET display_name = ?')) {
        const [displayName, id] = args;
        if (speakers[id]) speakers[id] = { ...speakers[id], display_name: displayName };
      }
    }),
  }));
  // dbService.db.transaction(fn) en better-sqlite3 devuelve una función
  // invocable; el código bajo test hace `const tx = db.transaction(cb); tx();`
  // así que basta con devolver el propio callback.
  const transaction = vi.fn((fn) => fn);
  return { prepare, transaction, __speakers: speakers, __recordingIds: recordingIds };
}

let speakerManager;

beforeEach(async () => {
  Object.values(speakerRepoMock).forEach((fn) => fn.mockReset());
  Object.values(dbServiceMock).forEach((val) => {
    if (typeof val === 'function' && typeof val.mockReset === 'function') val.mockReset();
  });
  dbServiceMock.db = null;

  vi.restoreAllMocks();
  // Silenciamos el logging (muy verboso en este módulo) para no ensuciar
  // la salida de la suite; cada test puede re-espiar console.warn/error
  // puntualmente si necesita hacer una aserción sobre ellos.
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});

  speakerManager = await import('../../../../electron/services/speakerManager.js');
});

// ── filterAndCompressEmbeddings (no exportada — vía _createNewSpeaker) ────
// Se ejerce llamando a processEmbeddings con recordingId=null y forzando el
// flujo "sin match / sin candidatos" para llegar siempre a _createNewSpeaker,
// que SIEMPRE aplica el filtro de calidad tras crear el perfil.

describe('filterAndCompressEmbeddings (vía processEmbeddings → _createNewSpeaker)', () => {
  beforeEach(() => {
    speakerRepoMock.findMatchingSpeaker.mockReturnValue(null);
    speakerRepoMock.findCandidateSpeakers.mockReturnValue([]);
    dbServiceMock.createSpeaker.mockReturnValue({ id: 'sp-new-1', display_name: 'Speaker_01' });
    dbServiceMock.saveSpeakerEmbedding.mockReturnValue({ success: true });
    dbServiceMock.deleteSpeakerEmbedding.mockReturnValue({ success: true });
  });

  test('duplicado descartado cuando sim > 0.99 (no se guarda el embedding)', () => {
    speakerRepoMock.getEmbeddingsBySpeakerId.mockReturnValue([embRow(1)]);
    speakerRepoMock.cosineSimilarity.mockReturnValue(0.995);

    const result = speakerManager.processEmbeddings({ SPEAKER_00: [1, 2, 3] }, null);

    expect(result.resolutionMap.SPEAKER_00.isNew).toBe(true);
    expect(dbServiceMock.saveSpeakerEmbedding).not.toHaveBeenCalled();
  });

  test('sim exactamente 0.99 NO se considera duplicado (la comparación es > no >=)', () => {
    speakerRepoMock.getEmbeddingsBySpeakerId.mockReturnValue([embRow(1)]);
    speakerRepoMock.cosineSimilarity.mockReturnValue(0.99);

    speakerManager.processEmbeddings({ SPEAKER_00: [1, 2, 3] }, null);

    expect(dbServiceMock.saveSpeakerEmbedding).toHaveBeenCalledTimes(1);
    expect(dbServiceMock.saveSpeakerEmbedding).toHaveBeenCalledWith('sp-new-1', expect.any(Buffer), null);
  });

  test('39 embeddings existentes (< 40) → NO dispara compresión', () => {
    const existing = Array.from({ length: 39 }, (_, i) => embRow(i));
    speakerRepoMock.getEmbeddingsBySpeakerId.mockReturnValue(existing);
    speakerRepoMock.cosineSimilarity.mockReturnValue(0.5);

    speakerManager.processEmbeddings({ SPEAKER_00: [1, 2, 3] }, null);

    expect(speakerRepoMock.findMostSimilarPair).not.toHaveBeenCalled();
    expect(dbServiceMock.deleteSpeakerEmbedding).not.toHaveBeenCalled();
    expect(dbServiceMock.saveSpeakerEmbedding).toHaveBeenCalledTimes(1);
  });

  test('40 embeddings existentes (>= 40) → dispara compresión del par más similar', () => {
    const existing = Array.from({ length: 40 }, (_, i) => embRow(i, { recording_id: 100 + i }));
    speakerRepoMock.getEmbeddingsBySpeakerId.mockReturnValue(existing);
    speakerRepoMock.cosineSimilarity.mockReturnValue(0.5);
    speakerRepoMock.findMostSimilarPair.mockReturnValue({ idxA: 2, idxB: 5, similarity: 0.95 });
    speakerRepoMock.averageEmbeddingPair.mockReturnValue([9, 9, 9]);

    speakerManager.processEmbeddings({ SPEAKER_00: [1, 2, 3] }, null);

    expect(speakerRepoMock.findMostSimilarPair).toHaveBeenCalledWith(existing);
    expect(speakerRepoMock.averageEmbeddingPair).toHaveBeenCalledWith(existing[2].embedding, existing[5].embedding);
    // El "más antiguo" (id menor) es el que se elimina; el promedio se guarda
    // asociado al recording_id del embedding "más nuevo" (id mayor).
    expect(dbServiceMock.deleteSpeakerEmbedding).toHaveBeenCalledWith(2);
    expect(dbServiceMock.saveSpeakerEmbedding).toHaveBeenCalledTimes(2);
    expect(dbServiceMock.saveSpeakerEmbedding.mock.calls[0]).toEqual(['sp-new-1', expect.any(Buffer), 105]);
    expect(dbServiceMock.saveSpeakerEmbedding.mock.calls[1]).toEqual(['sp-new-1', expect.any(Buffer), null]);
  });

  test('findMostSimilarPair() → null: sólo avisa por consola, no rompe ni comprime', () => {
    const existing = Array.from({ length: 40 }, (_, i) => embRow(i));
    speakerRepoMock.getEmbeddingsBySpeakerId.mockReturnValue(existing);
    speakerRepoMock.cosineSimilarity.mockReturnValue(0.5);
    speakerRepoMock.findMostSimilarPair.mockReturnValue(null);

    const result = speakerManager.processEmbeddings({ SPEAKER_00: [1, 2, 3] }, null);

    expect(result.resolutionMap.SPEAKER_00.isNew).toBe(true);
    expect(dbServiceMock.deleteSpeakerEmbedding).not.toHaveBeenCalled();
    // El embedding "crudo" nuevo se sigue guardando (accepted:true de todos modos).
    expect(dbServiceMock.saveSpeakerEmbedding).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalled();
  });

  test('fallos de borrado/guardado durante la compresión no interrumpen el flujo (resiliencia)', () => {
    const existing = Array.from({ length: 40 }, (_, i) => embRow(i));
    speakerRepoMock.getEmbeddingsBySpeakerId.mockReturnValue(existing);
    speakerRepoMock.cosineSimilarity.mockReturnValue(0.5);
    speakerRepoMock.findMostSimilarPair.mockReturnValue({ idxA: 0, idxB: 1, similarity: 0.95 });
    speakerRepoMock.averageEmbeddingPair.mockReturnValue([9, 9, 9]);
    dbServiceMock.deleteSpeakerEmbedding.mockReturnValue({ success: false, error: 'boom-delete' });
    dbServiceMock.saveSpeakerEmbedding
      .mockReturnValueOnce({ success: false, error: 'boom-save-compressed' })
      .mockReturnValueOnce({ success: true });

    const result = speakerManager.processEmbeddings({ SPEAKER_00: [1, 2, 3] }, null);

    expect(result.resolutionMap.SPEAKER_00).toEqual({
      speakerId: 'sp-new-1',
      displayName: 'Speaker_01',
      isNew: true,
    });
    expect(console.error).toHaveBeenCalled();
  });
});

// ── processEmbeddings() ─────────────────────────────────────────────────

describe('processEmbeddings()', () => {
  test('entrada null → resultado vacío sin tocar dbService', () => {
    const result = speakerManager.processEmbeddings(null);
    expect(result).toEqual({ resolutionMap: {}, pendingSuggestions: [] });
    expect(dbServiceMock.getRecordingSpeakerResolutions).not.toHaveBeenCalled();
    expect(speakerRepoMock.findMatchingSpeaker).not.toHaveBeenCalled();
  });

  test('entrada no-objeto (string) → resultado vacío sin tocar dbService', () => {
    const result = speakerManager.processEmbeddings('not-an-object');
    expect(result).toEqual({ resolutionMap: {}, pendingSuggestions: [] });
    expect(dbServiceMock.getRecordingSpeakerResolutions).not.toHaveBeenCalled();
  });

  test('objeto vacío {} → resultado vacío sin tocar dbService', () => {
    const result = speakerManager.processEmbeddings({}, 42);
    expect(result).toEqual({ resolutionMap: {}, pendingSuggestions: [] });
    expect(dbServiceMock.getRecordingSpeakerResolutions).not.toHaveBeenCalled();
  });

  test('embedding vacío para un ephemeralId → se omite con warning, sin romper el resto', () => {
    speakerRepoMock.findMatchingSpeaker.mockReturnValue(null);
    speakerRepoMock.findCandidateSpeakers.mockReturnValue([]);
    dbServiceMock.createSpeaker.mockReturnValue({ id: 'sp-valid', display_name: 'Speaker_01' });
    speakerRepoMock.getEmbeddingsBySpeakerId.mockReturnValue([]);
    dbServiceMock.saveSpeakerEmbedding.mockReturnValue({ success: true });

    const result = speakerManager.processEmbeddings(
      { SPEAKER_00: [], SPEAKER_01: [1, 2, 3] },
      null
    );

    expect(Object.keys(result.resolutionMap)).toEqual(['SPEAKER_01']);
    expect(console.warn).toHaveBeenCalled();
  });

  test('idempotencia: cache con el mismo nº de keys que entries → corto-circuito, sin llamar a findMatchingSpeaker', () => {
    const cached = {
      SPEAKER_00: { speakerId: 'sp-A', displayName: 'Ana', isNew: false },
      SPEAKER_01: { speakerId: 'sp-B', displayName: 'Bea', isNew: false },
    };
    dbServiceMock.getRecordingSpeakerResolutions.mockReturnValue(cached);

    const result = speakerManager.processEmbeddings(
      { SPEAKER_00: [1, 2, 3], SPEAKER_01: [4, 5, 6] },
      777
    );

    expect(result).toEqual({ resolutionMap: cached, pendingSuggestions: [] });
    expect(dbServiceMock.getRecordingSpeakerResolutions).toHaveBeenCalledWith(777);
    expect(speakerRepoMock.findMatchingSpeaker).not.toHaveBeenCalled();
  });

  test('cache parcial: sólo el ephemeralId NO cacheado pasa por la lógica de match', () => {
    dbServiceMock.getRecordingSpeakerResolutions.mockReturnValue({
      SPEAKER_00: { speakerId: 'sp-A', displayName: 'Ana', isNew: false },
    });
    speakerRepoMock.findMatchingSpeaker.mockReturnValue(null);
    speakerRepoMock.findCandidateSpeakers.mockReturnValue([]);
    dbServiceMock.createSpeaker.mockReturnValue({ id: 'sp-new', display_name: 'Speaker_01' });
    speakerRepoMock.getEmbeddingsBySpeakerId.mockReturnValue([]);
    dbServiceMock.saveSpeakerEmbedding.mockReturnValue({ success: true });
    dbServiceMock.upsertRecordingSpeakerResolution.mockReturnValue({ success: true });

    const result = speakerManager.processEmbeddings(
      { SPEAKER_00: [1, 2, 3], SPEAKER_01: [4, 5, 6] },
      777
    );

    expect(result.resolutionMap.SPEAKER_00).toEqual({ speakerId: 'sp-A', displayName: 'Ana', isNew: false });
    expect(result.resolutionMap.SPEAKER_01.isNew).toBe(true);
    expect(speakerRepoMock.findMatchingSpeaker).toHaveBeenCalledTimes(1);
  });

  test('error dentro del try (findMatchingSpeaker lanza) → se captura, el ephemeralId se omite sin romper el resto', () => {
    speakerRepoMock.findMatchingSpeaker.mockImplementation(() => {
      throw new Error('boom');
    });

    const result = speakerManager.processEmbeddings({ SPEAKER_00: [1, 2, 3] }, null);

    expect(result.resolutionMap).toEqual({});
    expect(console.error).toHaveBeenCalled();
  });

  test('match encontrado pero sin fila en `speakers` (inconsistencia) → crea perfil nuevo con warning', () => {
    speakerRepoMock.findMatchingSpeaker.mockReturnValue({ speakerId: 'sp-ghost', similarity: 0.9 });
    dbServiceMock.db = createFakeDb({ speakers: {} }); // sp-ghost no existe
    dbServiceMock.createSpeaker.mockReturnValue({ id: 'sp-created', display_name: 'Speaker_01' });
    speakerRepoMock.getEmbeddingsBySpeakerId.mockReturnValue([]);
    dbServiceMock.saveSpeakerEmbedding.mockReturnValue({ success: true });

    const result = speakerManager.processEmbeddings({ SPEAKER_00: [1, 2, 3] }, null);

    expect(result.resolutionMap.SPEAKER_00).toEqual({
      speakerId: 'sp-created',
      displayName: 'Speaker_01',
      isNew: true,
    });
    expect(console.warn).toHaveBeenCalled();
  });

  test('match encontrado pero sin fila en `speakers`, con recordingId → también persiste la resolución del perfil nuevo', () => {
    speakerRepoMock.findMatchingSpeaker.mockReturnValue({ speakerId: 'sp-ghost', similarity: 0.9 });
    dbServiceMock.db = createFakeDb({ speakers: {} });
    dbServiceMock.createSpeaker.mockReturnValue({ id: 'sp-created', display_name: 'Speaker_01' });
    speakerRepoMock.getEmbeddingsBySpeakerId.mockReturnValue([]);
    dbServiceMock.saveSpeakerEmbedding.mockReturnValue({ success: true });
    dbServiceMock.upsertRecordingSpeakerResolution.mockReturnValue({ success: true });

    speakerManager.processEmbeddings({ SPEAKER_00: [1, 2, 3] }, 555);

    expect(dbServiceMock.upsertRecordingSpeakerResolution).toHaveBeenCalledWith(555, 'SPEAKER_00', 'sp-created');
  });

  test('dbService.db null con match encontrado → misma rama de inconsistencia (perfil nuevo)', () => {
    speakerRepoMock.findMatchingSpeaker.mockReturnValue({ speakerId: 'sp-ghost', similarity: 0.9 });
    dbServiceMock.db = null;
    dbServiceMock.createSpeaker.mockReturnValue({ id: 'sp-created', display_name: 'Speaker_01' });
    speakerRepoMock.getEmbeddingsBySpeakerId.mockReturnValue([]);
    dbServiceMock.saveSpeakerEmbedding.mockReturnValue({ success: true });

    const result = speakerManager.processEmbeddings({ SPEAKER_00: [1, 2, 3] }, null);

    expect(result.resolutionMap.SPEAKER_00.isNew).toBe(true);
  });

  test('flujo completo con match: resolutionMap correcto + upsert + embedding enriquecido', () => {
    speakerRepoMock.findMatchingSpeaker.mockReturnValue({ speakerId: 'sp-A', similarity: 0.91 });
    dbServiceMock.db = createFakeDb({ speakers: { 'sp-A': { id: 'sp-A', display_name: 'Ana' } } });
    dbServiceMock.upsertRecordingSpeakerResolution.mockReturnValue({ success: true });
    speakerRepoMock.getEmbeddingsBySpeakerId.mockReturnValue([]);
    speakerRepoMock.cosineSimilarity.mockReturnValue(0.1);
    dbServiceMock.saveSpeakerEmbedding.mockReturnValue({ success: true });

    const result = speakerManager.processEmbeddings({ SPEAKER_00: [1, 2, 3] }, 555);

    expect(result.resolutionMap.SPEAKER_00).toEqual({ speakerId: 'sp-A', displayName: 'Ana', isNew: false });
    expect(dbServiceMock.upsertRecordingSpeakerResolution).toHaveBeenCalledWith(555, 'SPEAKER_00', 'sp-A');
    expect(dbServiceMock.saveSpeakerEmbedding).toHaveBeenCalledWith('sp-A', expect.any(Buffer), 555);
  });

  test('flujo con match: embedding duplicado durante el enriquecimiento se descarta sin romper el flujo', () => {
    speakerRepoMock.findMatchingSpeaker.mockReturnValue({ speakerId: 'sp-A', similarity: 0.91 });
    dbServiceMock.db = createFakeDb({ speakers: { 'sp-A': { id: 'sp-A', display_name: 'Ana' } } });
    dbServiceMock.upsertRecordingSpeakerResolution.mockReturnValue({ success: true });
    speakerRepoMock.getEmbeddingsBySpeakerId.mockReturnValue([embRow(1)]);
    speakerRepoMock.cosineSimilarity.mockReturnValue(0.995); // duplicado

    const result = speakerManager.processEmbeddings({ SPEAKER_00: [1, 2, 3] }, 555);

    expect(result.resolutionMap.SPEAKER_00).toEqual({ speakerId: 'sp-A', displayName: 'Ana', isNew: false });
    expect(dbServiceMock.saveSpeakerEmbedding).not.toHaveBeenCalled();
  });

  test('flujo con match: fallo al guardar el embedding de enriquecimiento sólo genera warning (no rompe)', () => {
    speakerRepoMock.findMatchingSpeaker.mockReturnValue({ speakerId: 'sp-A', similarity: 0.91 });
    dbServiceMock.db = createFakeDb({ speakers: { 'sp-A': { id: 'sp-A', display_name: 'Ana' } } });
    dbServiceMock.upsertRecordingSpeakerResolution.mockReturnValue({ success: true });
    speakerRepoMock.getEmbeddingsBySpeakerId.mockReturnValue([]);
    dbServiceMock.saveSpeakerEmbedding.mockReturnValue({ success: false, error: 'boom' });

    const result = speakerManager.processEmbeddings({ SPEAKER_00: [1, 2, 3] }, 555);

    expect(result.resolutionMap.SPEAKER_00).toEqual({ speakerId: 'sp-A', displayName: 'Ana', isNew: false });
    expect(console.warn).toHaveBeenCalled();
  });

  test('flujo completo sin match pero con candidato → pendingSuggestions + perfil nuevo creado igualmente', () => {
    speakerRepoMock.findMatchingSpeaker.mockReturnValue(null);
    speakerRepoMock.findCandidateSpeakers.mockReturnValue([{ speakerId: 'sp-cand', similarity: 0.77 }]);
    dbServiceMock.db = createFakeDb({ speakers: { 'sp-cand': { id: 'sp-cand', display_name: 'Candidata' } } });
    dbServiceMock.createSpeaker.mockReturnValue({ id: 'sp-new', display_name: 'Speaker_01' });
    speakerRepoMock.getEmbeddingsBySpeakerId.mockReturnValue([]);
    dbServiceMock.saveSpeakerEmbedding.mockReturnValue({ success: true });
    dbServiceMock.upsertRecordingSpeakerResolution.mockReturnValue({ success: true });

    const result = speakerManager.processEmbeddings({ SPEAKER_00: [1, 2, 3] }, 555);

    expect(result.pendingSuggestions).toEqual([
      {
        ephemeralId: 'SPEAKER_00',
        candidateSpeakerId: 'sp-cand',
        candidateDisplayName: 'Candidata',
        similarity: 0.77,
        firstSegmentStart: null,
      },
    ]);
    expect(result.resolutionMap.SPEAKER_00).toEqual({ speakerId: 'sp-new', displayName: 'Speaker_01', isNew: true });
  });

  test('flujo completo sin match ni candidatos → crea perfil nuevo (isNew: true)', () => {
    speakerRepoMock.findMatchingSpeaker.mockReturnValue(null);
    speakerRepoMock.findCandidateSpeakers.mockReturnValue([]);
    dbServiceMock.createSpeaker.mockReturnValue({ id: 'sp-new', display_name: 'Speaker_01' });
    speakerRepoMock.getEmbeddingsBySpeakerId.mockReturnValue([]);
    dbServiceMock.saveSpeakerEmbedding.mockReturnValue({ success: true });

    const result = speakerManager.processEmbeddings({ SPEAKER_00: [1, 2, 3] }, null);

    expect(result.resolutionMap.SPEAKER_00).toEqual({ speakerId: 'sp-new', displayName: 'Speaker_01', isNew: true });
    expect(result.pendingSuggestions).toEqual([]);
  });

  test('_createNewSpeaker: dbService.createSpeaker() devuelve null → no crea entrada en resolutionMap, sólo loguea error', () => {
    speakerRepoMock.findMatchingSpeaker.mockReturnValue(null);
    speakerRepoMock.findCandidateSpeakers.mockReturnValue([]);
    dbServiceMock.createSpeaker.mockReturnValue(null);

    const result = speakerManager.processEmbeddings({ SPEAKER_00: [1, 2, 3] }, null);

    expect(result.resolutionMap).toEqual({});
    expect(console.error).toHaveBeenCalled();
  });

  test('_createNewSpeaker: fallo al guardar el embedding "crudo" del perfil nuevo no impide crear el perfil (resiliencia)', () => {
    speakerRepoMock.findMatchingSpeaker.mockReturnValue(null);
    speakerRepoMock.findCandidateSpeakers.mockReturnValue([]);
    dbServiceMock.createSpeaker.mockReturnValue({ id: 'sp-new', display_name: 'Speaker_01' });
    speakerRepoMock.getEmbeddingsBySpeakerId.mockReturnValue([]);
    dbServiceMock.saveSpeakerEmbedding.mockReturnValue({ success: false, error: 'disco lleno' });

    const result = speakerManager.processEmbeddings({ SPEAKER_00: [1, 2, 3] }, null);

    expect(result.resolutionMap.SPEAKER_00).toEqual({ speakerId: 'sp-new', displayName: 'Speaker_01', isNew: true });
    expect(console.error).toHaveBeenCalled();
  });
});

// ── resolveFromSegments() ───────────────────────────────────────────────

describe('resolveFromSegments()', () => {
  test('segments no-array → mapa vacío', () => {
    expect(speakerManager.resolveFromSegments('not-array')).toEqual({ resolutionMap: {}, pendingSuggestions: [] });
    expect(speakerManager.resolveFromSegments(null)).toEqual({ resolutionMap: {}, pendingSuggestions: [] });
    expect(speakerManager.resolveFromSegments(undefined)).toEqual({ resolutionMap: {}, pendingSuggestions: [] });
  });

  test('segments array vacío → mapa vacío', () => {
    expect(speakerManager.resolveFromSegments([])).toEqual({ resolutionMap: {}, pendingSuggestions: [] });
  });

  test('filtra los 4 placeholders exactos (SISTEMA/sistema/SYSTEM/system) pero conserva USUARIO y un look-alike de distinta capitalización', () => {
    dbServiceMock.getSpeakerByAlias.mockReturnValue(null);
    dbServiceMock.createSpeaker.mockImplementation((alias) => ({ id: `sp-${alias}`, display_name: alias }));

    const segments = [
      { speaker: 'SISTEMA' },
      { speaker: 'sistema' },
      { speaker: 'SYSTEM' },
      { speaker: 'system' },
      { speaker: 'USUARIO' },
      { speaker: 'Sistema' }, // mixed-case: el Set literal es exacto, NO debería filtrarse
    ];

    const result = speakerManager.resolveFromSegments(segments, null);

    expect(Object.keys(result.resolutionMap)).toEqual(['USUARIO', 'Sistema']);
  });

  test('segments donde TODOS los speakers son placeholders → mapa vacío sin tocar dbService', () => {
    const result = speakerManager.resolveFromSegments(
      [{ speaker: 'SISTEMA' }, { speaker: 'system' }],
      null
    );

    expect(result).toEqual({ resolutionMap: {}, pendingSuggestions: [] });
    expect(dbServiceMock.getSpeakerByAlias).not.toHaveBeenCalled();
    expect(dbServiceMock.createSpeaker).not.toHaveBeenCalled();
  });

  test('recordingId con resoluciones cacheadas no vacías → devuelve la cache sin procesar segments', () => {
    const cached = { SPEAKER_00: { speakerId: 'sp-A', displayName: 'Ana', isNew: false } };
    dbServiceMock.getRecordingSpeakerResolutions.mockReturnValue(cached);

    const result = speakerManager.resolveFromSegments([{ speaker: 'USUARIO' }], 42);

    expect(result).toEqual({ resolutionMap: cached, pendingSuggestions: [] });
    expect(dbServiceMock.getSpeakerByAlias).not.toHaveBeenCalled();
    expect(dbServiceMock.createSpeaker).not.toHaveBeenCalled();
  });

  test('perfil existente por alias exacto → isNew:false, persiste resolución si hay recordingId', () => {
    dbServiceMock.getRecordingSpeakerResolutions.mockReturnValue(null);
    dbServiceMock.getSpeakerByAlias.mockReturnValue({ id: 'sp-existing', display_name: 'USUARIO' });
    dbServiceMock.upsertRecordingSpeakerResolution.mockReturnValue({ success: true });

    const result = speakerManager.resolveFromSegments([{ speaker: 'USUARIO' }], 42);

    expect(result.resolutionMap.USUARIO).toEqual({ speakerId: 'sp-existing', displayName: 'USUARIO', isNew: false });
    expect(dbServiceMock.upsertRecordingSpeakerResolution).toHaveBeenCalledWith(42, 'USUARIO', 'sp-existing');
  });

  test('sin perfil existente → crea uno nuevo usando el propio ID como alias', () => {
    dbServiceMock.getRecordingSpeakerResolutions.mockReturnValue(null);
    dbServiceMock.getSpeakerByAlias.mockReturnValue(null);
    dbServiceMock.createSpeaker.mockReturnValue({ id: 'sp-new', display_name: 'SPEAKER_02' });

    const result = speakerManager.resolveFromSegments([{ speaker: 'SPEAKER_02' }], null);

    expect(result.resolutionMap.SPEAKER_02).toEqual({ speakerId: 'sp-new', displayName: 'SPEAKER_02', isNew: true });
    expect(dbServiceMock.createSpeaker).toHaveBeenCalledWith('SPEAKER_02');
  });

  test('perfil nuevo con recordingId → persiste también la relación recording↔speaker', () => {
    dbServiceMock.getRecordingSpeakerResolutions.mockReturnValue(null);
    dbServiceMock.getSpeakerByAlias.mockReturnValue(null);
    dbServiceMock.createSpeaker.mockReturnValue({ id: 'sp-new', display_name: 'SPEAKER_02' });
    dbServiceMock.upsertRecordingSpeakerResolution.mockReturnValue({ success: true });

    speakerManager.resolveFromSegments([{ speaker: 'SPEAKER_02' }], 42);

    expect(dbServiceMock.upsertRecordingSpeakerResolution).toHaveBeenCalledWith(42, 'SPEAKER_02', 'sp-new');
  });

  test('dbService.createSpeaker() devuelve null → omite ese hablante (continue) sin romper el resto', () => {
    dbServiceMock.getRecordingSpeakerResolutions.mockReturnValue(null);
    dbServiceMock.getSpeakerByAlias.mockReturnValue(null);
    dbServiceMock.createSpeaker.mockReturnValue(null);

    const result = speakerManager.resolveFromSegments([{ speaker: 'SPEAKER_02' }], null);

    expect(result.resolutionMap).toEqual({});
    expect(console.error).toHaveBeenCalled();
  });

  test('error al resolver un hablante (getSpeakerByAlias lanza) → se captura, ese hablante se omite sin romper el resto', () => {
    dbServiceMock.getRecordingSpeakerResolutions.mockReturnValue(null);
    dbServiceMock.getSpeakerByAlias.mockImplementation(() => {
      throw new Error('boom');
    });

    const result = speakerManager.resolveFromSegments([{ speaker: 'SPEAKER_02' }], null);

    expect(result.resolutionMap).toEqual({});
    expect(console.error).toHaveBeenCalled();
  });
});

// ── assignAlias() ────────────────────────────────────────────────────────

describe('assignAlias()', () => {
  test('alias vacío → error, sin tocar dbService en absoluto', () => {
    const result = speakerManager.assignAlias('sp-A', '');
    expect(result).toEqual({ success: false, error: 'El alias es obligatorio.' });
    expect(dbServiceMock.getSpeakerByAlias).not.toHaveBeenCalled();
    expect(dbServiceMock.createSpeaker).not.toHaveBeenCalled();
  });

  test('alias sólo espacios en blanco → error, sin tocar dbService', () => {
    const result = speakerManager.assignAlias('sp-A', '   ');
    expect(result).toEqual({ success: false, error: 'El alias es obligatorio.' });
    expect(dbServiceMock.getSpeakerByAlias).not.toHaveBeenCalled();
  });

  test('dbService.db null → error "Base de datos no inicializada."', () => {
    dbServiceMock.db = null;
    const result = speakerManager.assignAlias('sp-A', 'Juan');
    expect(result).toEqual({ success: false, error: 'Base de datos no inicializada.' });
  });

  test('recordingId no existe en BD → error específico con el id', () => {
    dbServiceMock.db = createFakeDb({ speakers: {}, recordingIds: new Set() });
    dbServiceMock.getSpeakerByAlias.mockReturnValue(null);
    dbServiceMock.createSpeaker.mockReturnValue({ id: 'sp-new', display_name: 'Juan' });

    const result = speakerManager.assignAlias(null, 'Juan', null, 999);

    expect(result).toEqual({ success: false, error: 'La grabación 999 no existe en BD.' });
  });

  test('speaker destino no existe tras resolverlo (inconsistencia) → error específico', () => {
    // createSpeaker devuelve un id que NO está en el mapa `speakers` del fake db.
    dbServiceMock.db = createFakeDb({ speakers: {} });
    dbServiceMock.getSpeakerByAlias.mockReturnValue(null);
    dbServiceMock.createSpeaker.mockReturnValue({ id: 'sp-ghost', display_name: 'Juan' });

    const result = speakerManager.assignAlias(null, 'Juan');

    expect(result).toEqual({ success: false, error: 'El speaker destino sp-ghost no existe en BD.' });
  });

  test('sin alias existente, sin currentSpeaker y createSpeaker() devuelve null → error de resolución', () => {
    dbServiceMock.db = createFakeDb({ speakers: {} });
    dbServiceMock.getSpeakerByAlias.mockReturnValue(null);
    dbServiceMock.createSpeaker.mockReturnValue(null);

    const result = speakerManager.assignAlias(null, 'Juan');

    expect(result).toEqual({ success: false, error: 'No se pudo resolver el hablante destino.' });
  });

  test('flujo completo: alias coincide con un speaker EXISTENTE distinto del actual → reasigna y borra el perfil viejo', () => {
    dbServiceMock.db = createFakeDb({
      speakers: {
        'sp-ephemeral-A': { id: 'sp-ephemeral-A', display_name: 'SPEAKER_00' },
        'sp-Juan': { id: 'sp-Juan', display_name: 'Juan' },
      },
    });
    dbServiceMock.getSpeakerByAlias.mockReturnValue({ id: 'sp-Juan', display_name: 'Juan' });
    dbServiceMock.upsertRecordingSpeakerResolution.mockReturnValue({ success: true });
    dbServiceMock.reassignSpeakerEmbeddings.mockReturnValue({ success: true });
    dbServiceMock.reassignRecordingSpeakerResolutions.mockReturnValue({ success: true });
    dbServiceMock.deleteSpeaker.mockReturnValue({ success: true });

    const result = speakerManager.assignAlias('sp-ephemeral-A', 'Juan');

    expect(result).toEqual({ success: true, speakerId: 'sp-Juan', displayName: 'Juan' });
    expect(dbServiceMock.reassignSpeakerEmbeddings).toHaveBeenCalledWith('sp-ephemeral-A', 'sp-Juan');
    expect(dbServiceMock.reassignRecordingSpeakerResolutions).toHaveBeenCalledWith('sp-ephemeral-A', 'sp-Juan');
    expect(dbServiceMock.deleteSpeaker).toHaveBeenCalledWith('sp-ephemeral-A');
  });

  test('flujo completo: speakerId ya es el destino (renombrar el mismo perfil) → NO reasigna ni borra', () => {
    dbServiceMock.db = createFakeDb({
      speakers: { 'sp-old': { id: 'sp-old', display_name: 'SPEAKER_00' } },
    });
    dbServiceMock.getSpeakerByAlias.mockReturnValue(null); // el alias nuevo no existe todavía

    const result = speakerManager.assignAlias('sp-old', 'RenamedName');

    expect(result).toEqual({ success: true, speakerId: 'sp-old', displayName: 'RenamedName' });
    expect(dbServiceMock.reassignSpeakerEmbeddings).not.toHaveBeenCalled();
    expect(dbServiceMock.reassignRecordingSpeakerResolutions).not.toHaveBeenCalled();
    expect(dbServiceMock.deleteSpeaker).not.toHaveBeenCalled();
  });

  test('fallo dentro de la transacción (p.ej. upsert falla) → catch externo devuelve success:false con el mensaje', () => {
    dbServiceMock.db = createFakeDb({
      speakers: { 'sp-old': { id: 'sp-old', display_name: 'SPEAKER_00' } },
      recordingIds: new Set([42]),
    });
    dbServiceMock.getSpeakerByAlias.mockReturnValue(null);
    dbServiceMock.upsertRecordingSpeakerResolution.mockReturnValue({ success: false, error: 'upsert falló' });

    const result = speakerManager.assignAlias('sp-old', 'RenamedName', null, 42, 'SPEAKER_00');

    expect(result).toEqual({ success: false, error: 'upsert falló' });
  });

  test('reassignSpeakerEmbeddings falla sin `error` propio → usa el mensaje de fallback por defecto', () => {
    dbServiceMock.db = createFakeDb({
      speakers: {
        'sp-ephemeral-A': { id: 'sp-ephemeral-A', display_name: 'SPEAKER_00' },
        'sp-Juan': { id: 'sp-Juan', display_name: 'Juan' },
      },
    });
    dbServiceMock.getSpeakerByAlias.mockReturnValue({ id: 'sp-Juan', display_name: 'Juan' });
    dbServiceMock.reassignSpeakerEmbeddings.mockReturnValue({ success: false }); // sin `error`

    const result = speakerManager.assignAlias('sp-ephemeral-A', 'Juan');

    expect(result).toEqual({ success: false, error: 'No se pudieron reasignar embeddings.' });
  });

  test('reassignRecordingSpeakerResolutions falla sin `error` propio → usa el mensaje de fallback por defecto', () => {
    dbServiceMock.db = createFakeDb({
      speakers: {
        'sp-ephemeral-A': { id: 'sp-ephemeral-A', display_name: 'SPEAKER_00' },
        'sp-Juan': { id: 'sp-Juan', display_name: 'Juan' },
      },
    });
    dbServiceMock.getSpeakerByAlias.mockReturnValue({ id: 'sp-Juan', display_name: 'Juan' });
    dbServiceMock.reassignSpeakerEmbeddings.mockReturnValue({ success: true });
    dbServiceMock.reassignRecordingSpeakerResolutions.mockReturnValue({ success: false }); // sin `error`

    const result = speakerManager.assignAlias('sp-ephemeral-A', 'Juan');

    expect(result).toEqual({ success: false, error: 'No se pudieron reasignar resoluciones.' });
  });

  test('deleteSpeaker (perfil anterior) falla sin `error` propio → usa el mensaje de fallback por defecto', () => {
    dbServiceMock.db = createFakeDb({
      speakers: {
        'sp-ephemeral-A': { id: 'sp-ephemeral-A', display_name: 'SPEAKER_00' },
        'sp-Juan': { id: 'sp-Juan', display_name: 'Juan' },
      },
    });
    dbServiceMock.getSpeakerByAlias.mockReturnValue({ id: 'sp-Juan', display_name: 'Juan' });
    dbServiceMock.reassignSpeakerEmbeddings.mockReturnValue({ success: true });
    dbServiceMock.reassignRecordingSpeakerResolutions.mockReturnValue({ success: true });
    dbServiceMock.deleteSpeaker.mockReturnValue({ success: false }); // sin `error`

    const result = speakerManager.assignAlias('sp-ephemeral-A', 'Juan');

    expect(result).toEqual({ success: false, error: 'No se pudo eliminar el perfil anterior.' });
  });

  test('con embedding provisto → se serializa y se guarda contra el speaker destino', () => {
    dbServiceMock.db = createFakeDb({
      speakers: { 'sp-old': { id: 'sp-old', display_name: 'SPEAKER_00' } },
    });
    dbServiceMock.getSpeakerByAlias.mockReturnValue(null);
    dbServiceMock.saveSpeakerEmbedding.mockReturnValue({ success: true });

    const result = speakerManager.assignAlias('sp-old', 'RenamedName', [1, 2, 3], null, null);

    expect(result.success).toBe(true);
    expect(dbServiceMock.saveSpeakerEmbedding).toHaveBeenCalledWith('sp-old', expect.any(Buffer), null);
  });

  test('con embedding provisto pero el guardado falla → sólo warning, la operación sigue siendo success', () => {
    dbServiceMock.db = createFakeDb({
      speakers: { 'sp-old': { id: 'sp-old', display_name: 'SPEAKER_00' } },
    });
    dbServiceMock.getSpeakerByAlias.mockReturnValue(null);
    dbServiceMock.saveSpeakerEmbedding.mockReturnValue({ success: false, error: 'boom' });

    const result = speakerManager.assignAlias('sp-old', 'RenamedName', [1, 2, 3]);

    expect(result.success).toBe(true);
    expect(console.warn).toHaveBeenCalled();
  });
});

// ── mergeSpeakers() ──────────────────────────────────────────────────────

describe('mergeSpeakers()', () => {
  test('menos de 2 sourceEphemeralIds → error, sin tocar dbService', () => {
    expect(speakerManager.mergeSpeakers([], {}, 'Nuevo')).toEqual({
      success: false,
      error: 'Se necesitan al menos 2 hablantes para fusionar.',
    });
    expect(speakerManager.mergeSpeakers(['solo-uno'], {}, 'Nuevo')).toEqual({
      success: false,
      error: 'Se necesitan al menos 2 hablantes para fusionar.',
    });
    expect(dbServiceMock.reassignSpeakerEmbeddings).not.toHaveBeenCalled();
  });

  test('targetAlias vacío/ausente → error', () => {
    expect(speakerManager.mergeSpeakers(['E1', 'E2'], {}, '')).toEqual({
      success: false,
      error: 'El alias destino es obligatorio.',
    });
    expect(speakerManager.mergeSpeakers(['E1', 'E2'], {}, undefined)).toEqual({
      success: false,
      error: 'El alias destino es obligatorio.',
    });
  });

  test('ningún speakerId resoluble desde speakersMap → error', () => {
    const result = speakerManager.mergeSpeakers(['E1', 'E2'], {}, 'Nuevo');
    expect(result).toEqual({
      success: false,
      error: 'No se encontraron perfiles persistentes para los hablantes seleccionados.',
    });
  });

  test('dbService.db null con inputs válidos → error "Base de datos no inicializada."', () => {
    dbServiceMock.db = null;
    const result = speakerManager.mergeSpeakers(
      ['E1', 'E2'],
      { E1: { speakerId: 'sp-A' }, E2: { speakerId: 'sp-B' } },
      'Nuevo'
    );
    expect(result).toEqual({ success: false, error: 'Base de datos no inicializada.' });
  });

  test('el ganador es el PRIMER speakerId válido en el orden del array (no el primero alfabético)', () => {
    dbServiceMock.db = createFakeDb({
      speakers: { 'sp-A': { id: 'sp-A', display_name: 'A' }, 'sp-B': { id: 'sp-B', display_name: 'B' } },
    });
    dbServiceMock.reassignSpeakerEmbeddings.mockReturnValue({ success: true, changes: 1 });
    dbServiceMock.deleteSpeaker.mockReturnValue({ success: true });

    // sourceEphemeralIds trae primero E2 (→ sp-B) y luego E1 (→ sp-A):
    // el ganador debe ser sp-B, NO sp-A.
    const result = speakerManager.mergeSpeakers(
      ['E2', 'E1'],
      { E1: { speakerId: 'sp-A' }, E2: { speakerId: 'sp-B' } },
      'Ganador'
    );

    expect(result.targetSpeakerId).toBe('sp-B');
    expect(dbServiceMock.reassignSpeakerEmbeddings).toHaveBeenCalledWith('sp-A', 'sp-B');
    expect(dbServiceMock.deleteSpeaker).toHaveBeenCalledWith('sp-A');
  });

  test('flujo completo: 3 ephemeralIds → 2 speakerIds únicos (dedup), perdedor reasignado+borrado, ganador renombrado', () => {
    const speakers = {
      'sp-A': { id: 'sp-A', display_name: 'A' },
      'sp-B': { id: 'sp-B', display_name: 'B' },
    };
    dbServiceMock.db = createFakeDb({ speakers });
    dbServiceMock.reassignSpeakerEmbeddings.mockReturnValue({ success: true, changes: 3 });
    dbServiceMock.deleteSpeaker.mockReturnValue({ success: true });

    // E1 y E3 resuelven al MISMO speakerId (sp-A) → debe deduplicarse a un solo "perdedor".
    const result = speakerManager.mergeSpeakers(
      ['E1', 'E2', 'E3'],
      { E1: { speakerId: 'sp-A' }, E2: { speakerId: 'sp-B' }, E3: { speakerId: 'sp-A' } },
      'Fusionado'
    );

    expect(result).toEqual({ success: true, targetSpeakerId: 'sp-A', displayName: 'Fusionado' });
    expect(dbServiceMock.reassignSpeakerEmbeddings).toHaveBeenCalledTimes(1);
    expect(dbServiceMock.reassignSpeakerEmbeddings).toHaveBeenCalledWith('sp-B', 'sp-A');
    expect(dbServiceMock.deleteSpeaker).toHaveBeenCalledTimes(1);
    expect(dbServiceMock.deleteSpeaker).toHaveBeenCalledWith('sp-B');
    // El nombre del ganador se actualizó de verdad en la "BD" fake.
    expect(speakers['sp-A'].display_name).toBe('Fusionado');
  });

  test('fallo al reasignar/borrar un perdedor no interrumpe la fusión (sólo warning, sigue siendo success)', () => {
    dbServiceMock.db = createFakeDb({
      speakers: { 'sp-A': { id: 'sp-A', display_name: 'A' }, 'sp-B': { id: 'sp-B', display_name: 'B' } },
    });
    dbServiceMock.reassignSpeakerEmbeddings.mockReturnValue({ success: false, error: 'boom' });
    dbServiceMock.deleteSpeaker.mockReturnValue({ success: false, error: 'boom2' });

    const result = speakerManager.mergeSpeakers(
      ['E1', 'E2'],
      { E1: { speakerId: 'sp-A' }, E2: { speakerId: 'sp-B' } },
      'Fusionado'
    );

    expect(result).toEqual({ success: true, targetSpeakerId: 'sp-A', displayName: 'Fusionado' });
    expect(console.warn).toHaveBeenCalled();
  });

  test('excepción inesperada durante la fusión → catch externo devuelve success:false con el mensaje', () => {
    dbServiceMock.db = createFakeDb({
      speakers: { 'sp-A': { id: 'sp-A', display_name: 'A' }, 'sp-B': { id: 'sp-B', display_name: 'B' } },
    });
    dbServiceMock.reassignSpeakerEmbeddings.mockImplementation(() => {
      throw new Error('fallo inesperado de BD');
    });

    const result = speakerManager.mergeSpeakers(
      ['E1', 'E2'],
      { E1: { speakerId: 'sp-A' }, E2: { speakerId: 'sp-B' } },
      'Fusionado'
    );

    expect(result).toEqual({ success: false, error: 'fallo inesperado de BD' });
  });
});

// ── confirmSpeakerSuggestion() ───────────────────────────────────────────

describe('confirmSpeakerSuggestion()', () => {
  test('dbService.db null → error "DB no inicializada."', () => {
    dbServiceMock.db = null;
    const result = speakerManager.confirmSpeakerSuggestion(1, 'SPEAKER_00', 'sp-confirmed', 'sp-temp');
    expect(result).toEqual({ success: false, error: 'DB no inicializada.' });
  });

  test('hablante confirmado no existe en BD → error específico', () => {
    dbServiceMock.db = createFakeDb({ speakers: {} });
    const result = speakerManager.confirmSpeakerSuggestion(1, 'SPEAKER_00', 'sp-ghost', 'sp-temp');
    expect(result).toEqual({ success: false, error: 'No existe el hablante confirmado: sp-ghost' });
  });

  test('currentSpeakerId === confirmedSpeakerId → NO reasigna ni borra, pero sí persiste la resolución', () => {
    dbServiceMock.db = createFakeDb({
      speakers: { 'sp-same': { id: 'sp-same', display_name: 'Ana' } },
    });
    dbServiceMock.upsertRecordingSpeakerResolution.mockReturnValue({ success: true });

    const result = speakerManager.confirmSpeakerSuggestion(1, 'SPEAKER_00', 'sp-same', 'sp-same');

    expect(result).toEqual({ success: true, displayName: 'Ana' });
    expect(dbServiceMock.reassignSpeakerEmbeddings).not.toHaveBeenCalled();
    expect(dbServiceMock.reassignRecordingSpeakerResolutions).not.toHaveBeenCalled();
    expect(dbServiceMock.deleteSpeaker).not.toHaveBeenCalled();
    expect(dbServiceMock.upsertRecordingSpeakerResolution).toHaveBeenCalledWith(1, 'SPEAKER_00', 'sp-same');
  });

  test('currentSpeakerId distinto de confirmedSpeakerId → reasigna embeddings/resoluciones y borra el temporal', () => {
    dbServiceMock.db = createFakeDb({
      speakers: { 'sp-confirmed': { id: 'sp-confirmed', display_name: 'Ana' } },
    });
    dbServiceMock.reassignSpeakerEmbeddings.mockReturnValue({ success: true });
    dbServiceMock.reassignRecordingSpeakerResolutions.mockReturnValue({ success: true });
    dbServiceMock.deleteSpeaker.mockReturnValue({ success: true });
    dbServiceMock.upsertRecordingSpeakerResolution.mockReturnValue({ success: true });

    const result = speakerManager.confirmSpeakerSuggestion(1, 'SPEAKER_00', 'sp-confirmed', 'sp-temp');

    expect(result).toEqual({ success: true, displayName: 'Ana' });
    expect(dbServiceMock.reassignSpeakerEmbeddings).toHaveBeenCalledWith('sp-temp', 'sp-confirmed');
    expect(dbServiceMock.reassignRecordingSpeakerResolutions).toHaveBeenCalledWith('sp-temp', 'sp-confirmed');
    expect(dbServiceMock.deleteSpeaker).toHaveBeenCalledWith('sp-temp');
    expect(dbServiceMock.upsertRecordingSpeakerResolution).toHaveBeenCalledWith(1, 'SPEAKER_00', 'sp-confirmed');
  });

  test('excepción inesperada durante la confirmación → catch externo devuelve success:false con el mensaje', () => {
    dbServiceMock.db = createFakeDb({
      speakers: { 'sp-confirmed': { id: 'sp-confirmed', display_name: 'Ana' } },
    });
    dbServiceMock.reassignSpeakerEmbeddings.mockImplementation(() => {
      throw new Error('fallo inesperado de BD');
    });

    const result = speakerManager.confirmSpeakerSuggestion(1, 'SPEAKER_00', 'sp-confirmed', 'sp-temp');

    expect(result).toEqual({ success: false, error: 'fallo inesperado de BD' });
  });
});
