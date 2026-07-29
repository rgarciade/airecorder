/**
 * ragService.test.js
 *
 * Tests unitarios para electron/services/ragService.js — indexación y
 * búsqueda vectorial (RAG) sobre transcripciones, vía LanceDB.
 *
 * ragService.js hace, a nivel de módulo:
 *   const embeddingService = require("./embeddingService");
 *   const { resolveSpeakersInText } = require("./speakerResolver");
 *   const dbService = require("../database/dbService");
 * Los tres son CJS puro (este proyecto no tiene "type":"module" en
 * package.json), así que `vi.mock()` no intercepta esos requires internos —
 * mismo problema documentado en speakerManager.test.js y
 * speakerRepository.dbLookup.test.js. Se usa la misma solución: inyectar
 * objetos mock en `require.cache` de Node vía `createRequire(import.meta.url)`
 * ANTES de que ragService.js se importe por primera vez, y usar `import()`
 * dinámico dentro de `beforeEach` (nunca un `import` estático arriba del
 * archivo).
 *
 * A diferencia de esos dos precedentes, ragService.js también requiere
 * "@lancedb/lancedb" — pero de forma LAZY (dentro de getConnection() y de
 * nuevo dentro de indexRecording()/searchRecording(), nunca a nivel de
 * módulo). Como ese require sólo se ejecuta cuando la función corre (mucho
 * después de cualquier beforeAll), en teoría no haría falta el truco de
 * require.cache para él — pero para mantener consistencia con el resto del
 * archivo (y no mezclar dos estrategias de mock distintas) se le aplica EL
 * MISMO patrón: se inyecta también en require.cache dentro del mismo
 * beforeAll.
 *
 * Nota importante sobre estado de módulo (verificado empíricamente con un
 * test-sonda antes de escribir este archivo): `import()` dinámico repetido
 * sobre el MISMO path de módulo CJS devuelve la MISMA instancia de módulo
 * dentro de un mismo archivo de test (Node cachea por require.cache real, y
 * Vitest no resetea automáticamente entre tests salvo que se llame
 * `vi.resetModules()`, lo cual aquí se evita porque también invalidaría los
 * mocks inyectados a mano en require.cache). Esto significa que
 * `connectionCache` (el `Map` a nivel de módulo en ragService.js, línea 20)
 * PERSISTE entre tests de este archivo. La estrategia elegida es la más
 * simple: cada test usa un `recordingPath`/`vectordbPath` distinto (derivado
 * de un contador), salvo los tests dedicados a la caché de conexión, que
 * deliberadamente reutilizan el mismo path para verificar ese comportamiento.
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
  Object.values(speakerResolverMock).forEach((v) => {
    if (typeof v?.mockReset === 'function') v.mockReset();
  });
  Object.values(dbServiceMock).forEach((v) => {
    if (typeof v?.mockReset === 'function') v.mockReset();
  });
  lancedbMock.connect.mockReset();
  lancedbMock.Index.fts.mockClear();

  vi.restoreAllMocks();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});

  ragService = await import('../../../../electron/services/ragService.js');
});

// ── parseTranscriptionTxt() ──────────────────────────────────────────────

describe('parseTranscriptionTxt()', () => {
  test('string vacío → []', () => {
    expect(ragService.parseTranscriptionTxt('')).toEqual([]);
  });

  test('una entrada bien formada con texto en una sola línea', () => {
    const txt = `${headerLine(0, 0, 0, 0, 0, 5, 'Ana')}\n   Hola a todos`;
    const result = ragService.parseTranscriptionTxt(txt);

    expect(result).toEqual([
      {
        startTime: 0,
        endTime: 5,
        speaker: 'Ana',
        text: 'Hola a todos',
        rawLine: `${headerLine(0, 0, 0, 0, 0, 5, 'Ana')}\n   Hola a todos`,
      },
    ]);
  });

  test('mensaje multilínea: el texto se une con espacios, rawLine conserva los saltos de línea reales', () => {
    const header = headerLine(0, 0, 0, 0, 0, 10, 'Ana');
    const txt = `${header}\n   Primera línea\n   segunda línea`;

    const result = ragService.parseTranscriptionTxt(txt);

    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('Primera línea segunda línea');
    expect(result[0].rawLine).toBe(`${header}\n   Primera línea\n   segunda línea`);
  });

  test('entrada cuyo texto es sólo espacios en blanco se descarta (header seguido de otro header sin texto real)', () => {
    const h1 = headerLine(0, 0, 0, 0, 0, 5, 'Ana');
    const h2 = headerLine(0, 0, 5, 0, 0, 10, 'Beto');
    // h1 no tiene ninguna línea de texto real antes de h2 → se descarta
    // silenciosamente al no cumplir `currentEntry.text.trim()`.
    const txt = `${h1}\n${h2}\n   Hola`;

    const result = ragService.parseTranscriptionTxt(txt);

    expect(result).toHaveLength(1);
    expect(result[0].speaker).toBe('Beto');
    expect(result[0].text).toBe('Hola');
  });

  test('línea de header seguida SÓLO de líneas en blanco (sin texto real) se descarta también al final del archivo', () => {
    const h1 = headerLine(0, 0, 0, 0, 0, 5, 'Ana');
    const txt = `${h1}\n   \n`;

    const result = ragService.parseTranscriptionTxt(txt);

    expect(result).toEqual([]);
  });

  test('líneas que no matchean el regex de header, antes de cualquier entrada, se ignoran completamente', () => {
    const stray = 'esto no es un header ni pertenece a ninguna entrada';
    const header = headerLine(0, 0, 0, 0, 0, 5, 'Ana');
    const txt = `${stray}\n${header}\n   Hola`;

    const result = ragService.parseTranscriptionTxt(txt);

    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('Hola');
  });

  test('líneas mal formadas DESPUÉS de una entrada activa se agregan como texto adicional a esa entrada', () => {
    const header = headerLine(0, 0, 0, 0, 0, 5, 'Ana');
    // No matchea el regex de header, así que se trata como texto adicional
    // y se concatena a la entrada en curso.
    const strayLikeText = 'esto casi parece un header pero no matchea';
    const txt = `${header}\n   Hola\n${strayLikeText}`;

    const result = ragService.parseTranscriptionTxt(txt);

    expect(result).toHaveLength(1);
    expect(result[0].text).toBe(`Hola ${strayLikeText}`);
  });

  test('hora de 1 dígito y hora de 2 dígitos son ambas soportadas por el regex', () => {
    const txt = `[1:00:00 - 1:00:05] 🎤 Ana:\n   uno\n\n[01:00:05 - 01:00:10] 🎤 Ana:\n   dos`;

    const result = ragService.parseTranscriptionTxt(txt);

    expect(result).toHaveLength(2);
    expect(result[0].startTime).toBe(3600);
    expect(result[1].startTime).toBe(3605);
  });

  test('la última entrada no se pierde: archivo termina justo después del texto, sin línea en blanco final', () => {
    const header = headerLine(0, 0, 0, 0, 0, 5, 'Ana');
    const txt = `${header}\n   Última línea sin salto final`;

    const result = ragService.parseTranscriptionTxt(txt);

    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('Última línea sin salto final');
  });

  test('múltiples entradas consecutivas de distintos speakers se parsean todas correctamente', () => {
    const h1 = headerLine(0, 0, 0, 0, 0, 5, 'Ana');
    const h2 = headerLine(0, 0, 5, 0, 0, 10, 'Beto');
    const txt = `${h1}\n   Hola\n\n${h2}\n   Qué tal`;

    const result = ragService.parseTranscriptionTxt(txt);

    expect(result).toEqual([
      { startTime: 0, endTime: 5, speaker: 'Ana', text: 'Hola', rawLine: `${h1}\n   Hola` },
      { startTime: 5, endTime: 10, speaker: 'Beto', text: 'Qué tal', rawLine: `${h2}\n   Qué tal` },
    ]);
  });
});

// ── createChunks() ────────────────────────────────────────────────────────

describe('createChunks()', () => {
  test('parsedLines vacío → []', () => {
    expect(ragService.createChunks([])).toEqual([]);
  });

  test('una sola línea que cabe en una ventana → un único chunk', () => {
    const lines = [{ startTime: 0, endTime: 5, speaker: 'Ana', text: 'Hola', rawLine: 'raw' }];

    const chunks = ragService.createChunks(lines);

    // windowStart=0 < endTime=5 → una iteración; tras avanzar windowStart a
    // 10 (15-5), el while (10 < 5) es falso → se detiene.
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({
      chunkId: 0,
      text: 'Ana: Hola',
      textDisplay: 'raw',
      startTime: 0,
      endTime: 5,
      speakers: 'Ana',
    });
  });

  test('overlap math por defecto (window=15s, overlap=5s, stride=10s): construye exactamente los chunks esperados', () => {
    const lines = [
      { startTime: 0, endTime: 8, speaker: 'A', text: 'l0', rawLine: 'r0' },
      { startTime: 12, endTime: 18, speaker: 'B', text: 'l1', rawLine: 'r1' },
      { startTime: 22, endTime: 28, speaker: 'A', text: 'l2', rawLine: 'r2' },
    ];

    const chunks = ragService.createChunks(lines);

    // windowStart progression: 0, 10, 20, (30 >= 28 → detiene, último endTime=28)
    // - windowStart=0,  windowEnd=15 → line0(0-8) entra (8>0 && 0<15); line1(12-18) entra (18>0 && 12<15); line2 no (22<15 false)
    // - windowStart=10, windowEnd=25 → line0 no (8>10 false); line1 entra (18>10 && 12<25); line2 entra (28>10 && 22<25)
    // - windowStart=20, windowEnd=35 → line0 no; line1 no (18>20 false); line2 entra (28>20 && 22<35)
    // - windowStart=30 → while(30 < 28) false → detiene el bucle
    expect(chunks).toHaveLength(3);

    expect(chunks[0].speakers).toBe('A,B');
    expect(chunks[0].startTime).toBe(0);
    expect(chunks[0].endTime).toBe(18);

    expect(chunks[1].speakers).toBe('B,A');
    expect(chunks[1].startTime).toBe(12);
    expect(chunks[1].endTime).toBe(28);

    expect(chunks[2].speakers).toBe('A');
    expect(chunks[2].startTime).toBe(22);
    expect(chunks[2].endTime).toBe(28);
  });

  test('condición del while exactamente en el límite: windowStart === endTime de la última línea detiene el bucle', () => {
    // Una sola línea 0-10. window=15/overlap=5 → stride=10.
    // windowStart=0 (0<10 → itera, produce chunk), luego windowStart=10.
    // while(10 < 10) es falso → NO produce un segundo chunk vacío.
    const lines = [{ startTime: 0, endTime: 10, speaker: 'A', text: 'x', rawLine: 'r' }];

    const chunks = ragService.createChunks(lines);

    expect(chunks).toHaveLength(1);
  });

  test('trunca `text` por encima de MAX_EMBEDDING_CHARS (1500) añadiendo "...", pero NO trunca `textDisplay`', () => {
    const longText = 'x'.repeat(2000);
    const lines = [{ startTime: 0, endTime: 5, speaker: 'Ana', text: longText, rawLine: `raw-${longText}` }];

    const chunks = ragService.createChunks(lines);

    expect(chunks).toHaveLength(1);
    const fullText = `Ana: ${longText}`;
    expect(chunks[0].text).toBe(fullText.substring(0, 1500) + '...');
    expect(chunks[0].text.length).toBe(1503);
    expect(chunks[0].textDisplay).toBe(`raw-${longText}`);
    expect(chunks[0].textDisplay.length).toBeGreaterThan(1500);
  });

  test('texto exactamente en 1500 chars NO se trunca (comparación es estrictamente >)', () => {
    // "Ana: " son 5 chars, así que el texto base debe medir exactamente 1495
    // para que `fullText` mida 1500.
    const text = 'x'.repeat(1495);
    const lines = [{ startTime: 0, endTime: 5, speaker: 'Ana', text, rawLine: 'raw' }];

    const chunks = ragService.createChunks(lines);

    expect(chunks[0].text.length).toBe(1500);
    expect(chunks[0].text.endsWith('...')).toBe(false);
  });

  test('options.windowSeconds/overlapSeconds personalizados sobreescriben los defaults', () => {
    const lines = [
      { startTime: 0, endTime: 5, speaker: 'A', text: 'l0', rawLine: 'r0' },
      { startTime: 8, endTime: 12, speaker: 'A', text: 'l1', rawLine: 'r1' },
    ];

    // window=6, overlap=2 → stride=4.
    const chunks = ragService.createChunks(lines, { windowSeconds: 6, overlapSeconds: 2 });

    expect(chunks.length).toBeGreaterThanOrEqual(1);
    expect(chunks[0].startTime).toBe(0);
  });

  test('speakers duplicados dentro de una misma ventana se deduplican (Set) y mantienen orden de aparición', () => {
    const lines = [
      { startTime: 0, endTime: 3, speaker: 'Ana', text: 'a', rawLine: 'ra' },
      { startTime: 3, endTime: 6, speaker: 'Beto', text: 'b', rawLine: 'rb' },
      { startTime: 6, endTime: 9, speaker: 'Ana', text: 'c', rawLine: 'rc' },
    ];

    const chunks = ragService.createChunks(lines, { windowSeconds: 15, overlapSeconds: 0 });

    // Una sola ventana [0,15) captura las 3 líneas.
    expect(chunks).toHaveLength(1);
    expect(chunks[0].speakers).toBe('Ana,Beto');
  });

  test('chunkId es incremental empezando en 0 y sólo cuenta ventanas con líneas', () => {
    const lines = [
      { startTime: 0, endTime: 2, speaker: 'A', text: 'x', rawLine: 'r' },
      { startTime: 100, endTime: 102, speaker: 'A', text: 'y', rawLine: 'r2' },
    ];

    const chunks = ragService.createChunks(lines);

    expect(chunks[0].chunkId).toBe(0);
    expect(chunks[chunks.length - 1].chunkId).toBe(chunks.length - 1);
  });
});

// ── getEmbeddingModelId() ─────────────────────────────────────────────────

describe('getEmbeddingModelId()', () => {
  test('provider por defecto → formato "provider:model"', () => {
    const id = ragService.getEmbeddingModelId({ provider: 'ollama', model: 'nomic-embed-text' });
    expect(id).toBe('ollama:nomic-embed-text');
  });

  test("provider 'custom-openai' CON connectionId → formato \"custom:{connectionId}:{model}\"", () => {
    const id = ragService.getEmbeddingModelId({
      provider: 'custom-openai',
      connectionId: 'conn-123',
      model: 'text-embedding-3-small',
    });
    expect(id).toBe('custom:conn-123:text-embedding-3-small');
  });

  test("provider 'custom-openai' SIN connectionId → cae al formato por defecto (rama real, no asumida)", () => {
    const id = ragService.getEmbeddingModelId({ provider: 'custom-openai', model: 'text-embedding-3-small' });
    expect(id).toBe('custom-openai:text-embedding-3-small');
  });

  test('sin `model` en providerInfo → usa embeddingService.getEmbeddingModel() como fallback', () => {
    embeddingServiceMock.getEmbeddingModel.mockReturnValue('fallback-model');

    const id = ragService.getEmbeddingModelId({ provider: 'ollama' });

    expect(id).toBe('ollama:fallback-model');
    expect(embeddingServiceMock.getEmbeddingModel).toHaveBeenCalledTimes(1);
  });
});

// ── formatTime() — no está exportada. Se prueba indirectamente vía el log
// de resultados de searchRecording() (mismo criterio que _createNewSpeaker
// en speakerManager.test.js: se ejerce a través de la API pública en vez de
// exportarla sólo para tests). ────────────────────────────────────────────

describe('formatTime() (privada, vía log de searchRecording)', () => {
  async function searchAndCaptureLogsForRow(row) {
    const recordingPath = uniqueRecordingPath('fmt');
    const vectordbPath = `${recordingPath}/analysis/vectordb`;

    vi.spyOn(fs, 'existsSync').mockImplementation((p) => p === vectordbPath);

    embeddingServiceMock.detectEmbeddingProvider.mockResolvedValue({ provider: 'ollama' });
    embeddingServiceMock.embed.mockResolvedValue([0.1, 0.2]);

    const table = makeFakeTable({ vectorRows: [row], ftsRows: [] });
    lancedbMock.connect.mockResolvedValue(makeFakeConnection({ table }));

    await ragService.searchRecording(recordingPath, 'query', 5);

    return console.log.mock.calls.map((call) => call.join(' '));
  }

  function baseRow(overrides = {}) {
    return {
      chunk_id: 0,
      text: 'hola',
      text_display: 'hola',
      start_time: 0,
      end_time: 0,
      speakers: 'Ana',
      _distance: 0.1,
      ...overrides,
    };
  }

  test('0 segundos → "0:00" (sin horas)', async () => {
    const logs = await searchAndCaptureLogsForRow(baseRow({ start_time: 0, end_time: 0 }));
    expect(logs.some((l) => l.includes('(0:00-0:00)'))).toBe(true);
  });

  test('exactamente 3600s (1 hora) → "1:00:00" (rama h>0)', async () => {
    const logs = await searchAndCaptureLogsForRow(baseRow({ start_time: 3600, end_time: 3600 }));
    expect(logs.some((l) => l.includes('1:00:00'))).toBe(true);
  });

  test('3599s (justo debajo de 1 hora) → "59:59" (sin horas)', async () => {
    const logs = await searchAndCaptureLogsForRow(baseRow({ start_time: 3599, end_time: 3599 }));
    expect(logs.some((l) => l.includes('59:59'))).toBe(true);
  });

  test('valor fraccionario (65.7s) trunca a 1:05 (Math.floor, sin redondear)', async () => {
    const logs = await searchAndCaptureLogsForRow(baseRow({ start_time: 65.7, end_time: 65.7 }));
    expect(logs.some((l) => l.includes('1:05'))).toBe(true);
  });
});

/**
 * BUG/inconsistencia detectada (no corregida, sólo documentada):
 *
 * ragService.js#formatTime (línea 545) omite las horas cuando h === 0:
 *   formatTime(65)   → "1:05"       (sin "0:" de horas)
 *   formatTime(3600) → "1:00:00"
 *
 * electron/integrations/chatSyncUtils.js#formatTime SIEMPRE incluye las
 * horas, incluso en 0 (ver su propio test en chatSyncUtils.test.js:
 * `formatTime(65) → '0:01:05'`):
 *   formatTime(65)   → "0:01:05"
 *   formatTime(3600) → "1:00:00"
 *
 * Son dos funciones con el mismo nombre y el mismo propósito conceptual
 * (formatear segundos a un timestamp legible) que producen salidas
 * DISTINTAS para el mismo input cuando la duración es menor a una hora.
 * Sólo coinciden cuando h > 0. Es un riesgo real de mantenimiento (logs de
 * RAG y de sync de chats muestran formatos distintos para la misma
 * duración), pero no se corrige aquí porque está fuera del alcance de este
 * issue (#67, sólo tests) y el comportamiento actual de ambas funciones
 * queda caracterizado por tests.
 */
describe('formatTime(): confirmación explícita de la discrepancia con chatSyncUtils.formatTime', () => {
  test('para duraciones < 1h, ragService.formatTime omite las horas mientras chatSyncUtils.formatTime las incluye siempre', async () => {
    const { formatTime: chatSyncFormatTime } = await import('../../../../electron/integrations/chatSyncUtils.js');
    expect(chatSyncFormatTime(65)).toBe('0:01:05');

    const recordingPath = uniqueRecordingPath('fmt-cmp');
    const vectordbPath = `${recordingPath}/analysis/vectordb`;
    vi.spyOn(fs, 'existsSync').mockImplementation((p) => p === vectordbPath);
    embeddingServiceMock.detectEmbeddingProvider.mockResolvedValue({ provider: 'ollama' });
    embeddingServiceMock.embed.mockResolvedValue([0.1, 0.2]);
    const table = makeFakeTable({
      vectorRows: [
        {
          chunk_id: 0,
          text: 'hola',
          text_display: 'hola',
          start_time: 65,
          end_time: 65,
          speakers: 'Ana',
          _distance: 0.1,
        },
      ],
      ftsRows: [],
    });
    lancedbMock.connect.mockResolvedValue(makeFakeConnection({ table }));
    await ragService.searchRecording(recordingPath, 'query', 5);
    const logs = console.log.mock.calls.map((call) => call.join(' '));

    expect(logs.some((l) => l.includes('(1:05-1:05)'))).toBe(true);
    expect(logs.some((l) => l.includes('(0:01:05-0:01:05)'))).toBe(false);
  });
});

// ── saveIndexMetadata() / readIndexMetadata() — privadas, probadas vía fs
// spies a través de indexRecording() (llama saveIndexMetadata) y
// getStatus() (llama readIndexMetadata). ──────────────────────────────────

describe('saveIndexMetadata() (privada, vía indexRecording)', () => {
  test('escribe metadata con embeddingModel, indexedAt (ISO) y totalChunks tras indexar con éxito', async () => {
    const recordingPath = uniqueRecordingPath('save-meta');
    const analysisPath = `${recordingPath}/analysis`;
    const txtPath = `${analysisPath}/transcripcion_combinada.txt`;
    const vectordbPath = `${analysisPath}/vectordb`;
    const header = headerLine(0, 0, 0, 0, 0, 5, 'Ana');
    const longText = 'palabra '.repeat(1200); // fuerza > MIN_TEXT_LENGTH_FOR_RAG (8000)
    const txtContent = `${header}\n   ${longText}`;
    expect(txtContent.length).toBeGreaterThan(8000);

    vi.spyOn(fs, 'existsSync').mockImplementation((p) => p === txtPath);
    vi.spyOn(fs.promises, 'readFile').mockResolvedValue(txtContent);
    vi.spyOn(fs.promises, 'mkdir').mockResolvedValue(undefined);
    const writeFileSyncSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});

    dbServiceMock.getRecording.mockReturnValue(null);
    embeddingServiceMock.detectEmbeddingProvider.mockResolvedValue({ provider: 'ollama', model: 'nomic-embed-text' });
    embeddingServiceMock.ensureModel.mockResolvedValue(true);
    embeddingServiceMock.embedBatch.mockResolvedValue([[0.1, 0.2]]);

    const table = makeFakeTable({});
    lancedbMock.connect.mockResolvedValue(makeFakeConnection({ table }));

    const result = await ragService.indexRecording(recordingPath);

    expect(result.indexed).toBe(true);
    const metadataCall = writeFileSyncSpy.mock.calls.find(([p]) => p === `${vectordbPath}/rag_metadata.json`);
    expect(metadataCall).toBeTruthy();
    const written = JSON.parse(metadataCall[1]);
    expect(written.embeddingModel).toBe('ollama:nomic-embed-text');
    expect(written.totalChunks).toBe(1);
    expect(new Date(written.indexedAt).toISOString()).toBe(written.indexedAt);
  });
});

describe('readIndexMetadata() (privada, vía getStatus)', () => {
  test('archivo de metadata inexistente → embeddingModel null en el status (readIndexMetadata devuelve null)', async () => {
    const recordingPath = uniqueRecordingPath('read-meta-missing');
    const vectordbPath = `${recordingPath}/analysis/vectordb`;

    vi.spyOn(fs, 'existsSync').mockImplementation((p) => p === vectordbPath);
    const table = makeFakeTable({ vectorRows: [] });
    lancedbMock.connect.mockResolvedValue(makeFakeConnection({ table }));

    const status = await ragService.getStatus(recordingPath);

    expect(status.indexed).toBe(true);
    expect(status.embeddingModel).toBeNull();
  });

  test('archivo de metadata con JSON inválido → readIndexMetadata devuelve null y avisa por console.warn (no console.error)', async () => {
    const recordingPath = uniqueRecordingPath('read-meta-corrupt');
    const vectordbPath = `${recordingPath}/analysis/vectordb`;

    vi.spyOn(fs, 'existsSync').mockImplementation((p) => p === vectordbPath || p === `${vectordbPath}/rag_metadata.json`);
    vi.spyOn(fs, 'readFileSync').mockReturnValue('{ esto no es json valido');

    const table = makeFakeTable({ vectorRows: [] });
    lancedbMock.connect.mockResolvedValue(makeFakeConnection({ table }));

    const status = await ragService.getStatus(recordingPath);

    expect(status.indexed).toBe(true);
    expect(status.embeddingModel).toBeNull();
    expect(console.warn).toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  test('archivo de metadata válido → embeddingModel se refleja en el status', async () => {
    const recordingPath = uniqueRecordingPath('read-meta-valid');
    const vectordbPath = `${recordingPath}/analysis/vectordb`;

    vi.spyOn(fs, 'existsSync').mockImplementation((p) => p === vectordbPath || p === `${vectordbPath}/rag_metadata.json`);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(
      JSON.stringify({ embeddingModel: 'ollama:nomic-embed-text', indexedAt: '2024-01-01T00:00:00.000Z', totalChunks: 3 }),
    );

    const table = makeFakeTable({ vectorRows: [1, 2, 3] });
    lancedbMock.connect.mockResolvedValue(makeFakeConnection({ table }));

    const status = await ragService.getStatus(recordingPath);

    expect(status).toEqual({ indexed: true, totalChunks: 3, embeddingModel: 'ollama:nomic-embed-text' });
  });
});

// ── Tier 2: orquestación async (LanceDB / embeddingService / dbService) ──

describe('getConnection() (privada, vía llamadas repetidas a getStatus)', () => {
  test('mismo vectordbPath llamado dos veces → lancedb.connect sólo se invoca una vez (cache hit)', async () => {
    const recordingPath = uniqueRecordingPath('conn-cache');
    const vectordbPath = `${recordingPath}/analysis/vectordb`;

    vi.spyOn(fs, 'existsSync').mockImplementation((p) => p === vectordbPath);
    const table = makeFakeTable({ vectorRows: [] });
    lancedbMock.connect.mockResolvedValue(makeFakeConnection({ table }));

    await ragService.getStatus(recordingPath);
    await ragService.getStatus(recordingPath);

    expect(lancedbMock.connect).toHaveBeenCalledTimes(1);
  });

  test('dos vectordbPath distintos → lancedb.connect se invoca una vez por cada path (cache miss)', async () => {
    const pathA = uniqueRecordingPath('conn-miss-a');
    const pathB = uniqueRecordingPath('conn-miss-b');

    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    const table = makeFakeTable({ vectorRows: [] });
    lancedbMock.connect.mockResolvedValue(makeFakeConnection({ table }));

    await ragService.getStatus(pathA);
    await ragService.getStatus(pathB);

    expect(lancedbMock.connect).toHaveBeenCalledTimes(2);
  });
});

describe('indexRecording()', () => {
  test('no existe transcripcion_combinada.txt → indexed:false con error específico, sin llamar a ningún servicio', async () => {
    const recordingPath = uniqueRecordingPath('idx-no-txt');
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);

    const result = await ragService.indexRecording(recordingPath);

    expect(result).toEqual({
      indexed: false,
      skippedRag: false,
      totalChunks: 0,
      error: 'No existe transcripcion_combinada.txt',
    });
    expect(embeddingServiceMock.detectEmbeddingProvider).not.toHaveBeenCalled();
  });

  test('boundary MIN_TEXT_LENGTH_FOR_RAG: 7999 chars → skippedRag:true (por debajo del umbral)', async () => {
    const recordingPath = uniqueRecordingPath('idx-short');
    const txtPath = `${recordingPath}/analysis/transcripcion_combinada.txt`;
    const shortText = 'x'.repeat(7999);

    vi.spyOn(fs, 'existsSync').mockImplementation((p) => p === txtPath);
    vi.spyOn(fs.promises, 'readFile').mockResolvedValue(shortText);

    const result = await ragService.indexRecording(recordingPath);

    expect(result).toEqual({ indexed: false, skippedRag: true, totalChunks: 0 });
    expect(embeddingServiceMock.detectEmbeddingProvider).not.toHaveBeenCalled();
  });

  test('boundary MIN_TEXT_LENGTH_FOR_RAG: exactamente 8000 chars → NO se salta (comparación es estrictamente <)', async () => {
    const recordingPath = uniqueRecordingPath('idx-exact-8000');
    const txtPath = `${recordingPath}/analysis/transcripcion_combinada.txt`;
    // 8000 chars exactos, pero sin ningún header parseable → sigue el flujo
    // hasta "no se pudieron parsear segmentos" en vez de skippedRag.
    const exactText = 'x'.repeat(8000);

    vi.spyOn(fs, 'existsSync').mockImplementation((p) => p === txtPath);
    vi.spyOn(fs.promises, 'readFile').mockResolvedValue(exactText);
    dbServiceMock.getRecording.mockReturnValue(null);
    embeddingServiceMock.detectEmbeddingProvider.mockResolvedValue({ provider: 'ollama' });
    embeddingServiceMock.ensureModel.mockResolvedValue(true);

    const result = await ragService.indexRecording(recordingPath);

    expect(result.skippedRag).toBe(false);
    expect(embeddingServiceMock.detectEmbeddingProvider).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      indexed: false,
      skippedRag: false,
      totalChunks: 0,
      error: 'No se pudieron parsear segmentos de la transcripción',
    });
  });

  test('sin provider de embeddings disponible → indexed:false con error específico', async () => {
    const recordingPath = uniqueRecordingPath('idx-no-provider');
    const txtPath = `${recordingPath}/analysis/transcripcion_combinada.txt`;
    const header = headerLine(0, 0, 0, 0, 0, 5, 'Ana');
    const longText = 'palabra '.repeat(1200);

    vi.spyOn(fs, 'existsSync').mockImplementation((p) => p === txtPath);
    vi.spyOn(fs.promises, 'readFile').mockResolvedValue(`${header}\n   ${longText}`);
    dbServiceMock.getRecording.mockReturnValue(null);
    embeddingServiceMock.detectEmbeddingProvider.mockResolvedValue(null);

    const result = await ragService.indexRecording(recordingPath);

    expect(result).toEqual({
      indexed: false,
      skippedRag: false,
      totalChunks: 0,
      error: 'No hay provider de embeddings disponible',
    });
  });

  test('modelo no disponible (ensureModel devuelve false) → indexed:false con error específico', async () => {
    const recordingPath = uniqueRecordingPath('idx-model-not-ready');
    const txtPath = `${recordingPath}/analysis/transcripcion_combinada.txt`;
    const header = headerLine(0, 0, 0, 0, 0, 5, 'Ana');
    const longText = 'palabra '.repeat(1200);

    vi.spyOn(fs, 'existsSync').mockImplementation((p) => p === txtPath);
    vi.spyOn(fs.promises, 'readFile').mockResolvedValue(`${header}\n   ${longText}`);
    dbServiceMock.getRecording.mockReturnValue(null);
    embeddingServiceMock.detectEmbeddingProvider.mockResolvedValue({ provider: 'ollama' });
    embeddingServiceMock.ensureModel.mockResolvedValue(false);

    const result = await ragService.indexRecording(recordingPath);

    expect(result).toEqual({
      indexed: false,
      skippedRag: false,
      totalChunks: 0,
      error: 'No se pudo preparar el modelo nomic-embed-text',
    });
  });

  test('flujo feliz completo: resuelve speakers, crea tabla, crea índice FTS y guarda metadata', async () => {
    const recordingPath = uniqueRecordingPath('idx-happy');
    const txtPath = `${recordingPath}/analysis/transcripcion_combinada.txt`;
    const header = headerLine(0, 0, 0, 0, 0, 5, 'SPEAKER_00');
    const longText = 'palabra '.repeat(1200);
    const rawTxt = `${header}\n   ${longText}`;

    vi.spyOn(fs, 'existsSync').mockImplementation((p) => p === txtPath);
    vi.spyOn(fs.promises, 'readFile').mockResolvedValue(rawTxt);
    vi.spyOn(fs.promises, 'mkdir').mockResolvedValue(undefined);
    vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});

    dbServiceMock.getRecording.mockReturnValue({ id: 42 });
    speakerResolverMock.resolveSpeakersInText.mockReturnValue(rawTxt.replace('SPEAKER_00', 'Ana'));
    embeddingServiceMock.detectEmbeddingProvider.mockResolvedValue({ provider: 'ollama', model: 'nomic-embed-text' });
    embeddingServiceMock.ensureModel.mockResolvedValue(true);
    embeddingServiceMock.embedBatch.mockResolvedValue([[0.1, 0.2, 0.3]]);

    const table = makeFakeTable({});
    lancedbMock.connect.mockResolvedValue(makeFakeConnection({ table }));

    const result = await ragService.indexRecording(recordingPath);

    expect(result).toEqual({ indexed: true, skippedRag: false, totalChunks: 1 });
    expect(speakerResolverMock.resolveSpeakersInText).toHaveBeenCalledWith(42, rawTxt, dbServiceMock);
    expect(table.createIndex).toHaveBeenCalledWith('text', { config: { type: 'fts' } });
  });

  test('createTable falla las 3 veces → indexed:false con el mensaje del último error', async () => {
    const recordingPath = uniqueRecordingPath('idx-fail-retries');
    const txtPath = `${recordingPath}/analysis/transcripcion_combinada.txt`;
    const header = headerLine(0, 0, 0, 0, 0, 5, 'Ana');
    const longText = 'palabra '.repeat(1200);

    vi.spyOn(fs, 'existsSync').mockImplementation((p) => p === txtPath);
    vi.spyOn(fs.promises, 'readFile').mockResolvedValue(`${header}\n   ${longText}`);
    vi.spyOn(fs.promises, 'mkdir').mockResolvedValue(undefined);

    dbServiceMock.getRecording.mockReturnValue(null);
    embeddingServiceMock.detectEmbeddingProvider.mockResolvedValue({ provider: 'ollama' });
    embeddingServiceMock.ensureModel.mockResolvedValue(true);
    embeddingServiceMock.embedBatch.mockResolvedValue([[0.1]]);

    const failingConnection = {
      createTable: vi.fn(async () => {
        throw new Error('disco lleno');
      }),
      openTable: vi.fn(),
    };
    lancedbMock.connect.mockResolvedValue(failingConnection);

    const result = await ragService.indexRecording(recordingPath);

    expect(result).toEqual({ indexed: false, skippedRag: false, totalChunks: 0, error: 'disco lleno' });
    expect(failingConnection.createTable).toHaveBeenCalledTimes(3);
  }, 10000);
});

describe('searchRecording()', () => {
  test('no existe vectordb → devuelve [] sin llamar a ningún servicio', async () => {
    const recordingPath = uniqueRecordingPath('search-no-vectordb');
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);

    const result = await ragService.searchRecording(recordingPath, 'query');

    expect(result).toEqual([]);
    expect(embeddingServiceMock.detectEmbeddingProvider).not.toHaveBeenCalled();
  });

  test('sin provider de embeddings disponible → lanza error explícito', async () => {
    const recordingPath = uniqueRecordingPath('search-no-provider');
    const vectordbPath = `${recordingPath}/analysis/vectordb`;
    vi.spyOn(fs, 'existsSync').mockImplementation((p) => p === vectordbPath);
    embeddingServiceMock.detectEmbeddingProvider.mockResolvedValue(null);

    await expect(ragService.searchRecording(recordingPath, 'query')).rejects.toThrow(
      'No hay provider de embeddings disponible para búsqueda',
    );
  });

  test('flujo feliz: combina resultados vectoriales + keyword, boostea coincidencias en ambas y ordena por score', async () => {
    const recordingPath = uniqueRecordingPath('search-happy');
    const vectordbPath = `${recordingPath}/analysis/vectordb`;
    vi.spyOn(fs, 'existsSync').mockImplementation((p) => p === vectordbPath);
    embeddingServiceMock.detectEmbeddingProvider.mockResolvedValue({ provider: 'ollama' });
    embeddingServiceMock.embed.mockResolvedValue([0.1, 0.2]);

    const table = makeFakeTable({
      vectorRows: [
        { chunk_id: 0, text: 't0', text_display: 'd0', start_time: 0, end_time: 10, speakers: 'Ana', _distance: 0 },
        { chunk_id: 1, text: 't1', text_display: 'd1', start_time: 100, end_time: 110, speakers: 'Beto', _distance: 1 },
      ],
      ftsRows: [
        { chunk_id: 0, text: 't0', text_display: 'd0', start_time: 0, end_time: 10, speakers: 'Ana' },
      ],
    });
    lancedbMock.connect.mockResolvedValue(makeFakeConnection({ table }));

    const result = await ragService.searchRecording(recordingPath, 'query', 10);

    expect(result).toHaveLength(2);
    // chunk 0 aparece en ambas búsquedas → boosted score, debe ir primero.
    expect(result[0].chunkId).toBe(0);
    expect(result[0].score).toBeGreaterThan(result[1].score);
  });

  test('table.openTable falla en el primer intento y funciona en el retry tras invalidar caché', async () => {
    const recordingPath = uniqueRecordingPath('search-retry-opentable');
    const vectordbPath = `${recordingPath}/analysis/vectordb`;
    vi.spyOn(fs, 'existsSync').mockImplementation((p) => p === vectordbPath);
    embeddingServiceMock.detectEmbeddingProvider.mockResolvedValue({ provider: 'ollama' });
    embeddingServiceMock.embed.mockResolvedValue([0.1, 0.2]);

    const table = makeFakeTable({ vectorRows: [], ftsRows: [] });
    let callCount = 0;
    const openTableImpl = vi.fn(async () => {
      callCount += 1;
      if (callCount === 1) throw new Error('table not found');
      return table;
    });
    lancedbMock.connect.mockResolvedValue(makeFakeConnection({ table, openTableImpl }));

    const result = await ragService.searchRecording(recordingPath, 'query', 10);

    expect(result).toEqual([]);
    expect(openTableImpl).toHaveBeenCalledTimes(2);
  });

  test('table.openTable falla en ambos intentos → devuelve [] sin lanzar', async () => {
    const recordingPath = uniqueRecordingPath('search-opentable-both-fail');
    const vectordbPath = `${recordingPath}/analysis/vectordb`;
    vi.spyOn(fs, 'existsSync').mockImplementation((p) => p === vectordbPath);
    embeddingServiceMock.detectEmbeddingProvider.mockResolvedValue({ provider: 'ollama' });
    embeddingServiceMock.embed.mockResolvedValue([0.1, 0.2]);

    const openTableImpl = vi.fn(async () => {
      throw new Error('nunca existe');
    });
    lancedbMock.connect.mockResolvedValue(makeFakeConnection({ openTableImpl }));

    const result = await ragService.searchRecording(recordingPath, 'query', 10);

    expect(result).toEqual([]);
  });

  test('resultados con score < 0.01 se filtran (irrelevantes)', async () => {
    const recordingPath = uniqueRecordingPath('search-filter-low-score');
    const vectordbPath = `${recordingPath}/analysis/vectordb`;
    vi.spyOn(fs, 'existsSync').mockImplementation((p) => p === vectordbPath);
    embeddingServiceMock.detectEmbeddingProvider.mockResolvedValue({ provider: 'ollama' });
    embeddingServiceMock.embed.mockResolvedValue([0.1, 0.2]);

    // score = 1 / (1 + _distance); para que score < 0.01, _distance > 99.
    const table = makeFakeTable({
      vectorRows: [
        { chunk_id: 0, text: 't0', text_display: 'd0', start_time: 0, end_time: 10, speakers: 'Ana', _distance: 200 },
      ],
      ftsRows: [],
    });
    lancedbMock.connect.mockResolvedValue(makeFakeConnection({ table }));

    const result = await ragService.searchRecording(recordingPath, 'query', 10);

    expect(result).toEqual([]);
  });
});

describe('deleteIndex()', () => {
  test('vectordb existe → lo elimina recursivamente', async () => {
    const recordingPath = uniqueRecordingPath('delete-exists');
    const vectordbPath = `${recordingPath}/analysis/vectordb`;
    vi.spyOn(fs, 'existsSync').mockImplementation((p) => p === vectordbPath);
    const rmSpy = vi.spyOn(fs.promises, 'rm').mockResolvedValue(undefined);

    await ragService.deleteIndex(recordingPath);

    expect(rmSpy).toHaveBeenCalledWith(vectordbPath, { recursive: true, force: true });
  });

  test('vectordb no existe → no intenta borrar nada (no-op silencioso)', async () => {
    const recordingPath = uniqueRecordingPath('delete-missing');
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    const rmSpy = vi.spyOn(fs.promises, 'rm').mockResolvedValue(undefined);

    await ragService.deleteIndex(recordingPath);

    expect(rmSpy).not.toHaveBeenCalled();
  });
});

describe('reindexAllRecordings()', () => {
  test('sin provider de embeddings disponible → error específico, sin recorrer recordings', async () => {
    dbServiceMock.getAllRecordings.mockReturnValue([{ relative_path: 'rec1' }]);
    embeddingServiceMock.detectEmbeddingProvider.mockResolvedValue(null);

    const result = await ragService.reindexAllRecordings({ baseOutputDir: '/fake/base' });

    expect(result).toEqual({
      reindexed: 0,
      total: 0,
      lastEmbeddingModelId: null,
      results: [],
      error: 'No hay provider de embeddings disponible',
    });
  });

  test('flujo feliz: sólo re-indexa recordings con vectordb/ existente (filtra los que no y los relative_path nulos), escribe metadata global', async () => {
    const baseOutputDir = uniqueRecordingPath('reindex-base');
    const provider = { provider: 'custom-openai', connectionId: 'conn-1', model: 'embed-model' };
    dbServiceMock.getAllRecordings.mockReturnValue([
      { relative_path: 'has-index' },
      { relative_path: 'no-index' },
      { relative_path: null }, // se salta por `continue`
    ]);

    vi.spyOn(fs, 'existsSync').mockImplementation((p) => p === `${baseOutputDir}/has-index/analysis/vectordb`);
    const writeFileSyncSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
    const indexFn = vi.fn().mockResolvedValue({ indexed: true, skippedRag: false, totalChunks: 5 });

    const result = await ragService.reindexAllRecordings({ baseOutputDir, indexFn, provider });

    expect(indexFn).toHaveBeenCalledTimes(1);
    expect(indexFn).toHaveBeenCalledWith(`${baseOutputDir}/has-index`);
    expect(result.reindexed).toBe(1);
    expect(result.total).toBe(1);
    expect(result.lastEmbeddingModelId).toBe('custom:conn-1:embed-model');

    const globalMetaCall = writeFileSyncSpy.mock.calls.find(([p]) => p === `${baseOutputDir}/rag_metadata.json`);
    expect(globalMetaCall).toBeTruthy();
    const written = JSON.parse(globalMetaCall[1]);
    expect(written.lastEmbeddingModelId).toBe('custom:conn-1:embed-model');
  });

  test('ningún recording tiene vectordb/ → 0 reindexed, indexFn nunca llamado', async () => {
    const baseOutputDir = uniqueRecordingPath('reindex-none');
    dbServiceMock.getAllRecordings.mockReturnValue([{ relative_path: 'rec1' }]);
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
    const indexFn = vi.fn();

    const result = await ragService.reindexAllRecordings({
      baseOutputDir,
      indexFn,
      provider: { provider: 'ollama', model: 'nomic-embed-text' },
    });

    expect(indexFn).not.toHaveBeenCalled();
    expect(result.reindexed).toBe(0);
    expect(result.total).toBe(0);
  });

  /**
   * BUG genuino detectado (no corregido, sólo documentado y caracterizado):
   *
   * reindexAllRecordings() (línea 608) llama a `getRecordingsPath()` cuando
   * no se pasa `baseOutputDir` en options — pero esa función NUNCA se
   * importa/requiere en ragService.js. Está definida y exportada en
   * `electron/utils/paths.js`, pero ragService.js no tiene
   * `const { getRecordingsPath } = require('../utils/paths')` ni nada
   * equivalente (el archivo sólo requiere fs, path, embeddingService,
   * speakerResolver y dbService a nivel de módulo — ver cabecera de este
   * archivo de test). El resultado es un `ReferenceError: getRecordingsPath
   * is not defined` en tiempo de ejecución, sin ningún try/catch que lo
   * intercepte — la promesa devuelta por reindexAllRecordings() se rechaza
   * con ese error en vez de devolver el objeto de resultado estructurado
   * `{ reindexed, total, ... }` que el resto de la función promete.
   * Cualquier caller que invoque `reindexAllRecordings()` SIN
   * `baseOutputDir` (el uso "normal" en producción — `baseOutputDir` está
   * pensado como override para tests) rompe inmediatamente.
   */
  test('BUG: sin baseOutputDir, reindexAllRecordings() lanza ReferenceError porque getRecordingsPath no está importada en ragService.js', async () => {
    embeddingServiceMock.detectEmbeddingProvider.mockResolvedValue({ provider: 'ollama' });
    dbServiceMock.getAllRecordings.mockReturnValue([]);

    await expect(ragService.reindexAllRecordings({})).rejects.toThrow(/getRecordingsPath is not defined/);
  });
});
