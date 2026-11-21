/**
 * ragService.searchProject.test.js
 *
 * Tests unitarios para `searchProject()` y la marca `keywordOnly` de
 * `searchRecording()` en electron/services/ragService.js.
 *
 * Reutiliza el patrón de mocks vía `require.cache` documentado en la cabecera
 * de ragService.test.js (embeddingService, speakerResolver, dbService y
 * @lancedb/lancedb inyectados antes de importar ragService de forma dinámica).
 */
import { describe, test, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'fs';

const nodeRequire = createRequire(import.meta.url);
const embeddingServicePath = nodeRequire.resolve('../../../../electron/services/embeddingService.js');
const speakerResolverPath = nodeRequire.resolve('../../../../electron/services/speakerResolver.js');
const dbServicePath = nodeRequire.resolve('../../../../electron/database/dbService.js');
const lancedbPath = nodeRequire.resolve('@lancedb/lancedb');

let originalEmbeddingServiceEntry;
let originalSpeakerResolverEntry;
let originalDbServiceEntry;
let originalLancedbEntry;

const embeddingServiceMock = {
  detectEmbeddingProvider: vi.fn(),
  ensureModel: vi.fn(),
  embed: vi.fn(),
  embedBatch: vi.fn(),
  getEmbeddingModel: vi.fn(),
  DEFAULT_EMBEDDING_MODEL: 'nomic-embed-text',
};

const speakerResolverMock = {
  resolveSpeakersInText: vi.fn(),
};

const dbServiceMock = {
  getRecording: vi.fn(),
  getAllRecordings: vi.fn(),
};

// `lancedb.connect` es sustituido por cada test según lo que necesite; el
// resto de la superficie (Index.fts) es estable y se comparte.
const lancedbMock = {
  connect: vi.fn(),
  Index: { fts: vi.fn(() => ({ type: 'fts' })) },
};

beforeAll(() => {
  originalEmbeddingServiceEntry = nodeRequire.cache[embeddingServicePath];
  nodeRequire.cache[embeddingServicePath] = {
    id: embeddingServicePath,
    filename: embeddingServicePath,
    loaded: true,
    exports: embeddingServiceMock,
  };

  originalSpeakerResolverEntry = nodeRequire.cache[speakerResolverPath];
  nodeRequire.cache[speakerResolverPath] = {
    id: speakerResolverPath,
    filename: speakerResolverPath,
    loaded: true,
    exports: speakerResolverMock,
  };

  originalDbServiceEntry = nodeRequire.cache[dbServicePath];
  nodeRequire.cache[dbServicePath] = {
    id: dbServicePath,
    filename: dbServicePath,
    loaded: true,
    exports: dbServiceMock,
  };

  originalLancedbEntry = nodeRequire.cache[lancedbPath];
  nodeRequire.cache[lancedbPath] = {
    id: lancedbPath,
    filename: lancedbPath,
    loaded: true,
    exports: lancedbMock,
  };
});

afterAll(() => {
  if (originalEmbeddingServiceEntry) nodeRequire.cache[embeddingServicePath] = originalEmbeddingServiceEntry;
  else delete nodeRequire.cache[embeddingServicePath];

  if (originalSpeakerResolverEntry) nodeRequire.cache[speakerResolverPath] = originalSpeakerResolverEntry;
  else delete nodeRequire.cache[speakerResolverPath];

  if (originalDbServiceEntry) nodeRequire.cache[dbServicePath] = originalDbServiceEntry;
  else delete nodeRequire.cache[dbServicePath];

  if (originalLancedbEntry) nodeRequire.cache[lancedbPath] = originalLancedbEntry;
  else delete nodeRequire.cache[lancedbPath];
});

// ── Helpers ──────────────────────────────────────────────────────────────

let pathCounter = 0;
/** Genera un recordingPath único por test para no chocar con connectionCache. */
function uniqueRecordingPath(label = 'rec') {
  pathCounter += 1;
  return `/fake/recordings/${label}-${pathCounter}`;
}

/** Construye una línea [HH:MM:SS - HH:MM:SS] emoji SPEAKER: */
function headerLine(startH, startM, startS, endH, endM, endS, speaker, emoji = '🎤') {
  const pad = (n) => String(n).padStart(2, '0');
  return `[${startH}:${pad(startM)}:${pad(startS)} - ${endH}:${pad(endM)}:${pad(endS)}] ${emoji} ${speaker}:`;
}

/** Fake de tabla LanceDB: .search(query, mode?).limit(n).toArray() + createIndex/countRows */
function makeFakeTable({ vectorRows = [], ftsRows = [], ftsThrows = false, searchThrows = null } = {}) {
  return {
    search: vi.fn((_queryOrVector, mode) => ({
      limit: () => ({
        toArray: async () => {
          if (mode === 'fts') {
            if (ftsThrows) throw new Error('no fts index');
            return ftsRows;
          }
          if (searchThrows) throw searchThrows;
          return vectorRows;
        },
      }),
    })),
    countRows: vi.fn(async () => vectorRows.length),
    createIndex: vi.fn(async () => {}),
  };
}

/** Fake de conexión LanceDB: .createTable() / .openTable() */
function makeFakeConnection({ table, openTableImpl } = {}) {
  return {
    createTable: vi.fn(async () => table),
    openTable: openTableImpl || vi.fn(async () => {
      if (!table) throw new Error('no such table: chunks');
      return table;
    }),
  };
}

let ragService;

beforeEach(async () => {
  Object.values(embeddingServiceMock).forEach((v) => {
    if (typeof v?.mockReset === 'function') v.mockReset();
  });
  Object.values(speakerResolverMock).forEach((v) => v.mockReset());
  Object.values(dbServiceMock).forEach((v) => v.mockReset());
  lancedbMock.connect.mockReset();

  vi.restoreAllMocks();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});

  ragService = await import('../../../../electron/services/ragService.js');
});

const QUERY = 'consulta de prueba';
const VECTOR = [0.1, 0.2, 0.3];

/** Cuenta las llamadas a embed() cuyo texto es exactamente la query */
function queryEmbedCount() {
  return embeddingServiceMock.embed.mock.calls.filter(([text]) => text === QUERY).length;
}

/** Crea N grabaciones con su vectordb marcado como existente y una tabla fake por path */
function setupRecordings(count, { tableFor = () => makeFakeTable({ vectorRows: [], ftsRows: [] }), missingVectordb = [], extraExisting = [] } = {}) {
  const recordings = [];
  const tables = new Map();
  const existing = new Set(extraExisting);
  for (let i = 0; i < count; i += 1) {
    const recordingPath = uniqueRecordingPath(`project-${i}`);
    const recordingId = `rec-${i}`;
    recordings.push({ recordingId, recordingPath });
    const vectordbPath = `${recordingPath}/analysis/vectordb`;
    if (!missingVectordb.includes(i)) existing.add(vectordbPath);
    tables.set(vectordbPath, tableFor(i));
  }
  vi.spyOn(fs, 'existsSync').mockImplementation((p) => existing.has(p));
  lancedbMock.connect.mockImplementation(async (vectordbPath) => makeFakeConnection({ table: tables.get(vectordbPath) }));
  return { recordings, tables, existing };
}

const rowFor = (id, distance = 0.1) => ({
  chunk_id: id, text: `t${id}`, text_display: `d${id}`, start_time: id * 100, end_time: id * 100 + 10, speakers: 'Ana', _distance: distance,
});

describe('searchProject()', () => {
  test('A1: detecta provider una sola vez, embebe la query una sola vez y todas las búsquedas usan ese vector', async () => {
    embeddingServiceMock.detectEmbeddingProvider.mockResolvedValue({ provider: 'ollama', model: 'nomic' });
    embeddingServiceMock.embed.mockResolvedValue(VECTOR);
    const { recordings, tables } = setupRecordings(3, { tableFor: (i) => makeFakeTable({ vectorRows: [rowFor(i)] }) });

    const results = await ragService.searchProject(recordings, QUERY, 5);

    expect(embeddingServiceMock.detectEmbeddingProvider).toHaveBeenCalledTimes(1);
    expect(queryEmbedCount()).toBe(1);
    expect(results.map((r) => r.recordingId)).toEqual(['rec-0', 'rec-1', 'rec-2']);
    results.forEach((r) => expect(r.success).toBe(true));
    for (const table of tables.values()) {
      const vectorCalls = table.search.mock.calls.filter(([, mode]) => mode !== 'fts');
      expect(vectorCalls).toHaveLength(1);
      expect(vectorCalls[0][0]).toBe(VECTOR);
    }
  });

  test('A2: sin provider → todas las entradas success:false con el mensaje esperado, sin lanzar ni embeber', async () => {
    embeddingServiceMock.detectEmbeddingProvider.mockResolvedValue(null);
    const { recordings } = setupRecordings(2);

    const results = await ragService.searchProject(recordings, QUERY, 5);

    expect(results).toEqual(recordings.map((r) => ({
      recordingId: r.recordingId,
      success: false,
      chunks: [],
      error: 'No hay provider de embeddings disponible',
    })));
    expect(queryEmbedCount()).toBe(0);
  });

  test('A3: si falla el embedding de la query → todas success:false con ese mensaje, sin lanzar', async () => {
    embeddingServiceMock.detectEmbeddingProvider.mockResolvedValue({ provider: 'ollama', model: 'nomic' });
    embeddingServiceMock.embed.mockRejectedValue(new Error('embedding caído'));
    const { recordings } = setupRecordings(2);

    const results = await ragService.searchProject(recordings, QUERY, 5);

    expect(results).toHaveLength(2);
    results.forEach((r) => {
      expect(r.success).toBe(false);
      expect(r.chunks).toEqual([]);
      expect(r.error).toContain('embedding caído');
    });
  });

  test('A4: aislamiento — una búsqueda LanceDB que falla (tras el retry) no afecta a las demás', async () => {
    embeddingServiceMock.detectEmbeddingProvider.mockResolvedValue({ provider: 'ollama', model: 'nomic' });
    embeddingServiceMock.embed.mockResolvedValue(VECTOR);
    const { recordings } = setupRecordings(3, {
      tableFor: (i) => (i === 1
        ? makeFakeTable({ searchThrows: new Error('lancedb roto') })
        : makeFakeTable({ vectorRows: [rowFor(i)] })),
    });

    const results = await ragService.searchProject(recordings, QUERY, 5);

    expect(results[0].success).toBe(true);
    expect(results[0].chunks).toHaveLength(1);
    expect(results[1].success).toBe(false);
    expect(results[1].error).toContain('lancedb roto');
    expect(results[2].success).toBe(true);
    expect(results[2].chunks).toHaveLength(1);
  });

  test('A5: grabación sin directorio analysis/vectordb → success:true con chunks vacíos', async () => {
    embeddingServiceMock.detectEmbeddingProvider.mockResolvedValue({ provider: 'ollama', model: 'nomic' });
    embeddingServiceMock.embed.mockResolvedValue(VECTOR);
    const { recordings } = setupRecordings(2, {
      missingVectordb: [0],
      tableFor: (i) => makeFakeTable({ vectorRows: [rowFor(i)] }),
    });

    const results = await ragService.searchProject(recordings, QUERY, 5);

    expect(results[0]).toMatchObject({ recordingId: 'rec-0', success: true, chunks: [] });
    expect(results[1].success).toBe(true);
    expect(results[1].chunks).toHaveLength(1);
  });

  test('A6: reindexa la grabación con modelo de embeddings distinto antes de buscar y embebe la query una sola vez', async () => {
    embeddingServiceMock.detectEmbeddingProvider.mockResolvedValue({ provider: 'ollama', model: 'nuevo' });
    embeddingServiceMock.ensureModel.mockResolvedValue(true);
    embeddingServiceMock.embed.mockResolvedValue(VECTOR);
    embeddingServiceMock.embedBatch.mockResolvedValue([[0.1, 0.2]]);
    dbServiceMock.getRecording.mockReturnValue(null);

    const header = headerLine(0, 0, 0, 0, 0, 5, 'Ana');
    const txtContent = `${header}\n   ${'palabra '.repeat(1200)}`;

    // Se declara el path de la grabación 0 antes para poder registrar su txt y su metadata
    const firstPath = `/fake/recordings/project-0-${pathCounter + 1}`;
    const txtPath = `${firstPath}/analysis/transcripcion_combinada.txt`;
    const metadataPath = `${firstPath}/analysis/vectordb/rag_metadata.json`;
    const { recordings } = setupRecordings(2, {
      extraExisting: [txtPath, metadataPath],
      tableFor: (i) => makeFakeTable({ vectorRows: [rowFor(i)] }),
    });
    expect(recordings[0].recordingPath).toBe(firstPath);

    vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({ embeddingModel: 'ollama:viejo' }));
    const readFileSpy = vi.spyOn(fs.promises, 'readFile').mockResolvedValue(txtContent);
    vi.spyOn(fs.promises, 'rm').mockResolvedValue(undefined);
    vi.spyOn(fs.promises, 'mkdir').mockResolvedValue(undefined);
    vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});

    const results = await ragService.searchProject(recordings, QUERY, 5);

    expect(readFileSpy).toHaveBeenCalledWith(txtPath, 'utf8');
    expect(embeddingServiceMock.embedBatch).toHaveBeenCalled();
    expect(queryEmbedCount()).toBe(1);
    results.forEach((r) => expect(r.success).toBe(true));
  });
});

describe('searchRecording() — marca keywordOnly', () => {
  test('A7: los chunks que solo aparecen en la búsqueda FTS llevan keywordOnly:true; los vectoriales no', async () => {
    const recordingPath = uniqueRecordingPath('keyword-only');
    const vectordbPath = `${recordingPath}/analysis/vectordb`;
    vi.spyOn(fs, 'existsSync').mockImplementation((p) => p === vectordbPath);
    embeddingServiceMock.detectEmbeddingProvider.mockResolvedValue({ provider: 'ollama' });
    embeddingServiceMock.embed.mockResolvedValue(VECTOR);
    const table = makeFakeTable({
      vectorRows: [rowFor(0, 0), rowFor(1, 0.5)],
      ftsRows: [rowFor(1), rowFor(2)], // 1 aparece en ambas; 2 solo por keyword
    });
    lancedbMock.connect.mockResolvedValue(makeFakeConnection({ table }));

    const result = await ragService.searchRecording(recordingPath, QUERY, 10);

    const byId = Object.fromEntries(result.map((c) => [c.chunkId, c]));
    expect(byId[2].keywordOnly).toBe(true);
    expect(byId[0].keywordOnly).not.toBe(true);
    expect(byId[1].keywordOnly).not.toBe(true);
  });
});
