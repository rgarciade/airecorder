/**
 * speakers.test.js
 *
 * Tests unitarios para electron/ipc-handlers/speakers.js — 12 canales IPC
 * para re-identificación y gestión de hablantes: resolución de embeddings,
 * asignación de alias, fusión de hablantes (directa, "similar" y preview),
 * estadísticas, directorio con nº de grabaciones, grabaciones de un hablante,
 * hablantes similares, timestamp del primer segmento, y borrado de la
 * relación hablante↔grabación.
 *
 * speakers.js hace, a nivel de módulo:
 *   const { ipcMain } = require('electron');
 *   const speakerManager = require('../services/speakerManager');
 *   const dbService = require('../database/dbService');
 * Todos CJS puro → mismo patrón de esta sesión (ver cabecera de
 * recordings.test.js / analysis.test.js): mocks inyectados en
 * `require.cache` vía `createRequire(import.meta.url)` en beforeAll/afterAll,
 * import dinámico del módulo bajo test en beforeEach, e `ipcMain.handle`
 * capturando cada callback en `handlers`.
 *
 * `speakerManager` YA está completamente testeado en otro archivo de esta
 * sesión (speakerManager.test.js) — aquí sólo se mockean sus 3 exports usados
 * (`processEmbeddings`, `assignAlias`, `mergeSpeakers`) como `vi.fn()`, sin
 * re-derivar su lógica interna. Los handlers que sólo delegan en él
 * (resolve-speaker, assign-alias, merge-speakers) reciben 2-3 tests cada uno.
 *
 * ALCANCE: varios handlers de este archivo SÍ contienen lógica real (no sólo
 * delegación) y reciben profundidad completa:
 *   - get-similar-speakers: boundary de `limit` (default 5, 0, negativo).
 *   - preview-merge-speakers: el handler más grande (~70 líneas), calcula un
 *     dry-run de merge con auto-swap y detección de advertencias — las 4
 *     combinaciones posibles de (sourceEmbeddings, targetEmbeddings) se
 *     testean una por una.
 *   - merge-similar-speaker: valida sólo la existencia del target, NO la del
 *     source, y NO bloquea el auto-merge (source === target) a diferencia de
 *     su hermano preview-merge-speakers que sí lo hace explícitamente — ver
 *     tests marcados GENUINE BUG.
 *   - get-speaker-first-segment-time, get-speaker-stats,
 *     get-speakers-with-recordings, get-speaker-recordings,
 *     delete-speaker-recording-resolution: profundidad moderada.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { createRequire } from 'node:module';

const nodeRequire = createRequire(import.meta.url);
const electronPath = nodeRequire.resolve('electron');
const speakerManagerPath = nodeRequire.resolve('../../../../electron/services/speakerManager.js');
const dbServicePath = nodeRequire.resolve('../../../../electron/database/dbService.js');

let originalElectronEntry;
let originalSpeakerManagerEntry;
let originalDbServiceEntry;

// ── Mocks de electron ───────────────────────────────────────────────────
const handlers = {};
const ipcMainMock = {
  handle: vi.fn((channel, cb) => {
    handlers[channel] = cb;
  }),
};

// ── Mock de speakerManager (ya testeado a fondo en otro archivo) ────────
const speakerManagerMock = {
  processEmbeddings: vi.fn(),
  assignAlias: vi.fn(),
  mergeSpeakers: vi.fn(),
};

// ── Mock de dbService ────────────────────────────────────────────────────
const dbServiceMock = {
  getAllSpeakers: vi.fn(),
  getSpeakerStats: vi.fn(),
  getSpeakersWithRecordingCount: vi.fn(),
  getSpeakerRecordings: vi.fn(),
  getSimilarSpeakers: vi.fn(),
  reassignRecordingSpeakerResolutions: vi.fn(),
  reassignSpeakerEmbeddings: vi.fn(),
  deleteSpeaker: vi.fn(),
  getSpeakerFirstSegmentTime: vi.fn(),
  getSpeakerEmbeddingCount: vi.fn(),
  deleteSpeakerRecordingRelationAtomically: vi.fn(),
};

beforeAll(() => {
  originalElectronEntry = nodeRequire.cache[electronPath];
  nodeRequire.cache[electronPath] = {
    id: electronPath,
    filename: electronPath,
    loaded: true,
    exports: { ipcMain: ipcMainMock },
  };

  originalSpeakerManagerEntry = nodeRequire.cache[speakerManagerPath];
  nodeRequire.cache[speakerManagerPath] = {
    id: speakerManagerPath,
    filename: speakerManagerPath,
    loaded: true,
    exports: speakerManagerMock,
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
  if (originalElectronEntry) nodeRequire.cache[electronPath] = originalElectronEntry;
  else delete nodeRequire.cache[electronPath];
  if (originalSpeakerManagerEntry) nodeRequire.cache[speakerManagerPath] = originalSpeakerManagerEntry;
  else delete nodeRequire.cache[speakerManagerPath];
  if (originalDbServiceEntry) nodeRequire.cache[dbServicePath] = originalDbServiceEntry;
  else delete nodeRequire.cache[dbServicePath];
});

let speakersHandlers;

function resetAllMocks() {
  [
    ipcMainMock.handle,
    ...Object.values(speakerManagerMock),
    ...Object.values(dbServiceMock),
  ].forEach((fn) => fn.mockReset());

  ipcMainMock.handle.mockImplementation((channel, cb) => {
    handlers[channel] = cb;
  });
}

beforeEach(async () => {
  Object.keys(handlers).forEach((k) => delete handlers[k]);
  resetAllMocks();

  vi.restoreAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});

  speakersHandlers = await import('../../../../electron/ipc-handlers/speakers.js');
  speakersHandlers.registerSpeakersHandlers();
});

// ─────────────────────────────────────────────────────────────────────────
// resolve-speaker — delegación en speakerManager.processEmbeddings.
// ─────────────────────────────────────────────────────────────────────────

describe('resolve-speaker', () => {
  it('sin recordingId ni threshold → defaults a null y 0.85', async () => {
    speakerManagerMock.processEmbeddings.mockReturnValue({ SPEAKER_00: { speakerId: 'uuid-1' } });

    const result = await handlers['resolve-speaker']({}, { speakerEmbeddings: { SPEAKER_00: [1, 2] } });

    expect(speakerManagerMock.processEmbeddings).toHaveBeenCalledWith({ SPEAKER_00: [1, 2] }, null, 0.85);
    expect(result).toEqual({ success: true, data: { SPEAKER_00: { speakerId: 'uuid-1' } } });
  });

  it('con recordingId y threshold provistos → se respetan tal cual', async () => {
    speakerManagerMock.processEmbeddings.mockReturnValue({});

    await handlers['resolve-speaker']({}, { speakerEmbeddings: {}, recordingId: 7, threshold: 0.6 });

    expect(speakerManagerMock.processEmbeddings).toHaveBeenCalledWith({}, 7, 0.6);
  });

  it('payload ausente (undefined) → no revienta, destructuring cae al default {}', async () => {
    speakerManagerMock.processEmbeddings.mockReturnValue({});

    const result = await handlers['resolve-speaker']({}, undefined);

    expect(speakerManagerMock.processEmbeddings).toHaveBeenCalledWith(undefined, null, 0.85);
    expect(result.success).toBe(true);
  });

  it('speakerManager lanza → capturado, success:false con el mensaje', async () => {
    speakerManagerMock.processEmbeddings.mockImplementation(() => {
      throw new Error('embeddings inválidos');
    });

    const result = await handlers['resolve-speaker']({}, { speakerEmbeddings: {} });

    expect(result).toEqual({ success: false, error: 'embeddings inválidos' });
  });
});

// ─────────────────────────────────────────────────────────────────────────
// assign-alias — delegación en speakerManager.assignAlias.
// ─────────────────────────────────────────────────────────────────────────

describe('assign-alias', () => {
  it('sin embedding/recordingId/ephemeralId → defaults a null', async () => {
    speakerManagerMock.assignAlias.mockReturnValue({ success: true, speakerId: 's1', displayName: 'Ana' });

    const result = await handlers['assign-alias']({}, { speakerId: 's1', alias: 'Ana' });

    expect(speakerManagerMock.assignAlias).toHaveBeenCalledWith('s1', 'Ana', null, null, null);
    expect(result).toEqual({ success: true, speakerId: 's1', displayName: 'Ana' });
  });

  it('con todos los campos opcionales provistos → se pasan tal cual', async () => {
    speakerManagerMock.assignAlias.mockReturnValue({ success: true });

    await handlers['assign-alias'](
      {},
      { speakerId: 's1', alias: 'Ana', embedding: [0.1, 0.2], recordingId: 3, ephemeralId: 'E1' }
    );

    expect(speakerManagerMock.assignAlias).toHaveBeenCalledWith('s1', 'Ana', [0.1, 0.2], 3, 'E1');
  });

  it('speakerManager lanza → capturado, success:false', async () => {
    speakerManagerMock.assignAlias.mockImplementation(() => {
      throw new Error('alias duplicado');
    });

    const result = await handlers['assign-alias']({}, { alias: 'Ana' });

    expect(result).toEqual({ success: false, error: 'alias duplicado' });
  });
});

// ─────────────────────────────────────────────────────────────────────────
// get-all-speakers — delegación en dbService.getAllSpeakers.
// ─────────────────────────────────────────────────────────────────────────

describe('get-all-speakers', () => {
  it('camino feliz: devuelve la lista tal cual', async () => {
    const speakers = [{ id: 's1', display_name: 'Ana' }];
    dbServiceMock.getAllSpeakers.mockReturnValue(speakers);

    const result = await handlers['get-all-speakers']({});

    expect(result).toEqual({ success: true, data: speakers });
  });

  it('dbService lanza → capturado, success:false con data: [] (a diferencia de otros catches que omiten data)', async () => {
    dbServiceMock.getAllSpeakers.mockImplementation(() => {
      throw new Error('BD no disponible');
    });

    const result = await handlers['get-all-speakers']({});

    expect(result).toEqual({ success: false, error: 'BD no disponible', data: [] });
  });
});

// ─────────────────────────────────────────────────────────────────────────
// merge-speakers — delegación en speakerManager.mergeSpeakers.
// ─────────────────────────────────────────────────────────────────────────

describe('merge-speakers', () => {
  it('camino feliz: delega con los 3 argumentos y devuelve el resultado tal cual', async () => {
    speakerManagerMock.mergeSpeakers.mockReturnValue({ success: true, targetSpeakerId: 's1', displayName: 'Ana' });

    const result = await handlers['merge-speakers'](
      {},
      { sourceEphemeralIds: ['E1', 'E2'], speakersMap: { E1: { speakerId: 's1' } }, targetAlias: 'Ana' }
    );

    expect(speakerManagerMock.mergeSpeakers).toHaveBeenCalledWith(['E1', 'E2'], { E1: { speakerId: 's1' } }, 'Ana');
    expect(result).toEqual({ success: true, targetSpeakerId: 's1', displayName: 'Ana' });
  });

  it('speakerManager lanza → capturado, success:false', async () => {
    speakerManagerMock.mergeSpeakers.mockImplementation(() => {
      throw new Error('fusión inválida');
    });

    const result = await handlers['merge-speakers']({}, { sourceEphemeralIds: [] });

    expect(result).toEqual({ success: false, error: 'fusión inválida' });
  });
});

// ─────────────────────────────────────────────────────────────────────────
// get-speaker-stats — delegación en dbService.getSpeakerStats.
// ─────────────────────────────────────────────────────────────────────────

describe('get-speaker-stats', () => {
  it('camino feliz: devuelve las métricas agregadas tal cual', async () => {
    const stats = { totalSpeakers: 4, totalEmbeddings: 12, lowQualitySpeakers: [], recentSpeakers: [] };
    dbServiceMock.getSpeakerStats.mockReturnValue(stats);

    const result = await handlers['get-speaker-stats']({});

    expect(result).toEqual({ success: true, data: stats });
  });

  it('dbService lanza → capturado, success:false', async () => {
    dbServiceMock.getSpeakerStats.mockImplementation(() => {
      throw new Error('error de agregación');
    });

    const result = await handlers['get-speaker-stats']({});

    expect(result).toEqual({ success: false, error: 'error de agregación' });
  });
});

// ─────────────────────────────────────────────────────────────────────────
// get-speakers-with-recordings — normaliza snake_case → camelCase.
// ─────────────────────────────────────────────────────────────────────────

describe('get-speakers-with-recordings', () => {
  it('normaliza cada fila de snake_case a camelCase', async () => {
    dbServiceMock.getSpeakersWithRecordingCount.mockReturnValue([
      { id: 's1', display_name: 'Ana', created_at: 't1', recordingsCount: 3, embeddingsCount: 5 },
    ]);

    const result = await handlers['get-speakers-with-recordings']({});

    expect(result).toEqual({
      success: true,
      data: [{ id: 's1', displayName: 'Ana', createdAt: 't1', recordingsCount: 3, embeddingsCount: 5 }],
    });
  });

  it('lista vacía → data: []', async () => {
    dbServiceMock.getSpeakersWithRecordingCount.mockReturnValue([]);

    const result = await handlers['get-speakers-with-recordings']({});

    expect(result).toEqual({ success: true, data: [] });
  });

  it('dbService lanza → capturado, success:false con data: []', async () => {
    dbServiceMock.getSpeakersWithRecordingCount.mockImplementation(() => {
      throw new Error('error de lectura');
    });

    const result = await handlers['get-speakers-with-recordings']({});

    expect(result).toEqual({ success: false, error: 'error de lectura', data: [] });
  });
});

// ─────────────────────────────────────────────────────────────────────────
// get-speaker-recordings — valida speakerId requerido y "no encontrado".
// ─────────────────────────────────────────────────────────────────────────

describe('get-speaker-recordings', () => {
  it('sin speakerId → error de validación sin llamar a dbService', async () => {
    const result = await handlers['get-speaker-recordings']({}, {});

    expect(result).toEqual({ success: false, error: 'speakerId es requerido' });
    expect(dbServiceMock.getSpeakerRecordings).not.toHaveBeenCalled();
  });

  it('payload ausente (undefined) → mismo error de validación', async () => {
    const result = await handlers['get-speaker-recordings']({}, undefined);

    expect(result.success).toBe(false);
  });

  it('dbService devuelve null (hablante no encontrado) → error específico', async () => {
    dbServiceMock.getSpeakerRecordings.mockReturnValue(null);

    const result = await handlers['get-speaker-recordings']({}, { speakerId: 's1' });

    expect(result).toEqual({ success: false, error: 'Hablante no encontrado' });
  });

  it('camino feliz: devuelve speaker + recordings', async () => {
    const data = { speaker: { id: 's1', displayName: 'Ana' }, recordings: [{ id: 1 }] };
    dbServiceMock.getSpeakerRecordings.mockReturnValue(data);

    const result = await handlers['get-speaker-recordings']({}, { speakerId: 's1' });

    expect(result).toEqual({ success: true, data });
  });

  it('dbService lanza → capturado, success:false', async () => {
    dbServiceMock.getSpeakerRecordings.mockImplementation(() => {
      throw new Error('fallo de consulta');
    });

    const result = await handlers['get-speaker-recordings']({}, { speakerId: 's1' });

    expect(result).toEqual({ success: false, error: 'fallo de consulta' });
  });
});

// ─────────────────────────────────────────────────────────────────────────
// get-similar-speakers — boundary de `limit` (default 5, 0, negativo). El
// guard es `limit ?? 5`: sólo null/undefined activan el default; 0 y
// negativos se pasan tal cual a dbService sin clamping.
// ─────────────────────────────────────────────────────────────────────────

describe('get-similar-speakers', () => {
  it('sin speakerId → error de validación sin llamar a dbService', async () => {
    const result = await handlers['get-similar-speakers']({}, {});

    expect(result).toEqual({ success: false, error: 'speakerId es requerido' });
    expect(dbServiceMock.getSimilarSpeakers).not.toHaveBeenCalled();
  });

  it('sin limit → default 5', async () => {
    dbServiceMock.getSimilarSpeakers.mockReturnValue([]);

    await handlers['get-similar-speakers']({}, { speakerId: 's1' });

    expect(dbServiceMock.getSimilarSpeakers).toHaveBeenCalledWith('s1', 5);
  });

  it('con limit explícito → se respeta tal cual', async () => {
    dbServiceMock.getSimilarSpeakers.mockReturnValue([]);

    await handlers['get-similar-speakers']({}, { speakerId: 's1', limit: 10 });

    expect(dbServiceMock.getSimilarSpeakers).toHaveBeenCalledWith('s1', 10);
  });

  it('BOUNDARY: limit:0 es "falsy" pero no null/undefined → `??` NO lo reemplaza, se pasa 0 literal a dbService', async () => {
    dbServiceMock.getSimilarSpeakers.mockReturnValue([]);

    await handlers['get-similar-speakers']({}, { speakerId: 's1', limit: 0 });

    expect(dbServiceMock.getSimilarSpeakers).toHaveBeenCalledWith('s1', 0);
  });

  it('BOUNDARY: limit negativo se pasa tal cual, sin validación ni clamping a un mínimo en este handler', async () => {
    dbServiceMock.getSimilarSpeakers.mockReturnValue([]);

    await handlers['get-similar-speakers']({}, { speakerId: 's1', limit: -3 });

    expect(dbServiceMock.getSimilarSpeakers).toHaveBeenCalledWith('s1', -3);
  });

  it('camino feliz: devuelve la lista de similares tal cual', async () => {
    const similar = [{ id: 's2', displayName: 'Bruno', similarity: 0.92 }];
    dbServiceMock.getSimilarSpeakers.mockReturnValue(similar);

    const result = await handlers['get-similar-speakers']({}, { speakerId: 's1' });

    expect(result).toEqual({ success: true, data: similar });
  });

  it('dbService lanza → capturado, success:false con data: []', async () => {
    dbServiceMock.getSimilarSpeakers.mockImplementation(() => {
      throw new Error('fallo de similitud');
    });

    const result = await handlers['get-similar-speakers']({}, { speakerId: 's1' });

    expect(result).toEqual({ success: false, error: 'fallo de similitud', data: [] });
  });
});

// ─────────────────────────────────────────────────────────────────────────
// merge-similar-speaker — valida SÓLO la existencia del target (no la del
// source) y NO bloquea el auto-merge (source === target), a diferencia de
// su hermano preview-merge-speakers.
// ─────────────────────────────────────────────────────────────────────────

describe('merge-similar-speaker', () => {
  it('sin targetSpeakerId o sourceSpeakerId → error de validación sin tocar dbService', async () => {
    const result = await handlers['merge-similar-speaker']({}, { targetSpeakerId: 's1' });

    expect(result).toEqual({ success: false, error: 'targetSpeakerId y sourceSpeakerId son requeridos' });
    expect(dbServiceMock.getAllSpeakers).not.toHaveBeenCalled();
  });

  it('el target no existe en getAllSpeakers() → error específico, sin reasignar ni borrar', async () => {
    dbServiceMock.getAllSpeakers.mockReturnValue([{ id: 's2', display_name: 'Bruno' }]);

    const result = await handlers['merge-similar-speaker']({}, { targetSpeakerId: 's1', sourceSpeakerId: 's2' });

    expect(result).toEqual({ success: false, error: 'El hablante target no existe' });
    expect(dbServiceMock.deleteSpeaker).not.toHaveBeenCalled();
  });

  it('camino feliz: reasigna resoluciones + embeddings y borra el perfil origen', async () => {
    dbServiceMock.getAllSpeakers.mockReturnValue([{ id: 's1', display_name: 'Ana' }]);

    const result = await handlers['merge-similar-speaker']({}, { targetSpeakerId: 's1', sourceSpeakerId: 's2' });

    expect(dbServiceMock.reassignRecordingSpeakerResolutions).toHaveBeenCalledWith('s2', 's1');
    expect(dbServiceMock.reassignSpeakerEmbeddings).toHaveBeenCalledWith('s2', 's1');
    expect(dbServiceMock.deleteSpeaker).toHaveBeenCalledWith('s2');
    expect(result).toEqual({ success: true, mergedName: 'Ana' });
  });

  it('GENUINE BUG (documentado, no arreglado): el source NO se valida contra getAllSpeakers() — si no existe, el handler igual reasigna/borra sin avisar (asimétrico respecto a preview-merge-speakers, que sí revisa "uno o ambos hablantes no existen")', async () => {
    // getAllSpeakers() sólo contiene el target; el source ("s-fantasma") no
    // aparece en absoluto. A diferencia de preview-merge-speakers (que busca
    // AMBOS ids con .find() y falla si cualquiera de los dos falta), este
    // handler sólo hace `.find()` para el target. El resultado: se llaman
    // igualmente reassignRecordingSpeakerResolutions/reassignSpeakerEmbeddings/
    // deleteSpeaker con un sourceSpeakerId que no existe, y el handler reporta
    // éxito igualmente.
    dbServiceMock.getAllSpeakers.mockReturnValue([{ id: 's1', display_name: 'Ana' }]);

    const result = await handlers['merge-similar-speaker'](
      {},
      { targetSpeakerId: 's1', sourceSpeakerId: 's-fantasma' }
    );

    expect(dbServiceMock.deleteSpeaker).toHaveBeenCalledWith('s-fantasma');
    expect(result).toEqual({ success: true, mergedName: 'Ana' });
  });

  it('GENUINE BUG (documentado, no arreglado): source === target (auto-merge) NO se bloquea aquí, a diferencia de preview-merge-speakers que sí lo hace explícitamente — el handler reasigna un hablante a sí mismo y LUEGO LO BORRA', async () => {
    // preview-merge-speakers tiene el guard explícito:
    //   if (sourceSpeakerId === targetSpeakerId) return { success:false, error:'No se puede fusionar un hablante consigo mismo' };
    // merge-similar-speaker NO tiene ese guard. Si el caller (por un bug de UI,
    // doble-click, o id repetido en la lista de "similares") invoca este canal
    // con el mismo id en ambos campos, el handler:
    //   1) encuentra el "target" (mismo id) vía getAllSpeakers().find(),
    //   2) reasigna resoluciones/embeddings de sí mismo a sí mismo (no-op),
    //   3) y ACTO SEGUIDO llama a dbService.deleteSpeaker(id) — BORRANDO el
    //      único perfil que existía para ese hablante.
    // Esto es potencialmente una pérdida de datos real, no sólo un caso raro
    // sin efecto — el perfil desaparece de la BD tras un "merge" que en teoría
    // no debería cambiar nada.
    dbServiceMock.getAllSpeakers.mockReturnValue([{ id: 's1', display_name: 'Ana' }]);

    const result = await handlers['merge-similar-speaker']({}, { targetSpeakerId: 's1', sourceSpeakerId: 's1' });

    expect(dbServiceMock.reassignRecordingSpeakerResolutions).toHaveBeenCalledWith('s1', 's1');
    expect(dbServiceMock.deleteSpeaker).toHaveBeenCalledWith('s1'); // el perfil se borra igual
    expect(result).toEqual({ success: true, mergedName: 'Ana' });
  });

  it('dbService lanza en cualquier paso → capturado, success:false', async () => {
    dbServiceMock.getAllSpeakers.mockReturnValue([{ id: 's1', display_name: 'Ana' }]);
    dbServiceMock.reassignRecordingSpeakerResolutions.mockImplementation(() => {
      throw new Error('transacción fallida');
    });

    const result = await handlers['merge-similar-speaker']({}, { targetSpeakerId: 's1', sourceSpeakerId: 's2' });

    expect(result).toEqual({ success: false, error: 'transacción fallida' });
  });
});

// ─────────────────────────────────────────────────────────────────────────
// get-speaker-first-segment-time — busca el primer timestamp de un hablante
// en una grabación. La lógica de "primero"/orden vive en dbService (ya
// testeado en su propio archivo); aquí sólo se testea la delegación async,
// la validación de parámetros y el "no encontrado".
// ─────────────────────────────────────────────────────────────────────────

describe('get-speaker-first-segment-time', () => {
  it('sin speakerId o recordingId → error de validación sin llamar a dbService', async () => {
    const result = await handlers['get-speaker-first-segment-time']({}, { speakerId: 's1' });

    expect(result).toEqual({ success: false, error: 'speakerId y recordingId son requeridos' });
    expect(dbServiceMock.getSpeakerFirstSegmentTime).not.toHaveBeenCalled();
  });

  it('dbService devuelve null/falsy (no encontrado) → error específico', async () => {
    dbServiceMock.getSpeakerFirstSegmentTime.mockResolvedValue(null);

    const result = await handlers['get-speaker-first-segment-time']({}, { speakerId: 's1', recordingId: 1 });

    expect(result).toEqual({ success: false, error: 'No se encontró el timestamp del hablante en esta grabación' });
  });

  it('camino feliz: devuelve startTime + ephemeralId', async () => {
    dbServiceMock.getSpeakerFirstSegmentTime.mockResolvedValue({ startTime: 12.5, ephemeralId: 'E1' });

    const result = await handlers['get-speaker-first-segment-time']({}, { speakerId: 's1', recordingId: 1 });

    expect(dbServiceMock.getSpeakerFirstSegmentTime).toHaveBeenCalledWith('s1', 1);
    expect(result).toEqual({ success: true, data: { startTime: 12.5, ephemeralId: 'E1' } });
  });

  it('dbService (promesa) rechaza → capturado, success:false', async () => {
    dbServiceMock.getSpeakerFirstSegmentTime.mockRejectedValue(new Error('archivo de transcripción no encontrado'));

    const result = await handlers['get-speaker-first-segment-time']({}, { speakerId: 's1', recordingId: 1 });

    expect(result).toEqual({ success: false, error: 'archivo de transcripción no encontrado' });
  });
});

// ─────────────────────────────────────────────────────────────────────────
// preview-merge-speakers — el handler más grande del archivo: dry-run de un
// merge con auto-swap y detección de advertencias. Se testean las 4
// combinaciones posibles de (sourceEmbeddings, targetEmbeddings).
// ─────────────────────────────────────────────────────────────────────────

describe('preview-merge-speakers', () => {
  function setupSpeakers({ sourceCount = 0, targetCount = 0 } = {}) {
    dbServiceMock.getSpeakerEmbeddingCount.mockImplementation((id) => {
      if (id === 'source-id') return sourceCount;
      if (id === 'target-id') return targetCount;
      return 0;
    });
    dbServiceMock.getAllSpeakers.mockReturnValue([
      { id: 'source-id', display_name: 'Origen' },
      { id: 'target-id', display_name: 'Destino' },
    ]);
  }

  it('sin sourceSpeakerId o targetSpeakerId → error de validación', async () => {
    const result = await handlers['preview-merge-speakers']({}, { sourceSpeakerId: 'source-id' });

    expect(result).toEqual({ success: false, error: 'sourceSpeakerId y targetSpeakerId son requeridos' });
  });

  it('source === target → error explícito, no permite auto-merge (a diferencia de merge-similar-speaker)', async () => {
    const result = await handlers['preview-merge-speakers'](
      {},
      { sourceSpeakerId: 'same-id', targetSpeakerId: 'same-id' }
    );

    expect(result).toEqual({ success: false, error: 'No se puede fusionar un hablante consigo mismo' });
    expect(dbServiceMock.getSpeakerEmbeddingCount).not.toHaveBeenCalled();
  });

  it('el source no existe en getAllSpeakers() → error "Uno o ambos hablantes no existen"', async () => {
    dbServiceMock.getSpeakerEmbeddingCount.mockReturnValue(0);
    dbServiceMock.getAllSpeakers.mockReturnValue([{ id: 'target-id', display_name: 'Destino' }]);

    const result = await handlers['preview-merge-speakers'](
      {},
      { sourceSpeakerId: 'source-id', targetSpeakerId: 'target-id' }
    );

    expect(result).toEqual({ success: false, error: 'Uno o ambos hablantes no existen' });
  });

  it('el target no existe en getAllSpeakers() → mismo error', async () => {
    dbServiceMock.getSpeakerEmbeddingCount.mockReturnValue(0);
    dbServiceMock.getAllSpeakers.mockReturnValue([{ id: 'source-id', display_name: 'Origen' }]);

    const result = await handlers['preview-merge-speakers'](
      {},
      { sourceSpeakerId: 'source-id', targetSpeakerId: 'target-id' }
    );

    expect(result).toEqual({ success: false, error: 'Uno o ambos hablantes no existen' });
  });

  it('CASO 1 — source con embeddings, target sin ninguno → AUTO-SWAP para preservarlos', async () => {
    setupSpeakers({ sourceCount: 8, targetCount: 0 });

    const result = await handlers['preview-merge-speakers'](
      {},
      { sourceSpeakerId: 'source-id', targetSpeakerId: 'target-id' }
    );

    expect(result.success).toBe(true);
    expect(result.data.swapped).toBe(true);
    expect(result.data.finalSourceId).toBe('target-id');
    expect(result.data.finalTargetId).toBe('source-id');
    expect(result.data.sourceEmbeddings).toBe(0); // final source = target original (sin embeddings)
    expect(result.data.targetEmbeddings).toBe(8); // final target = source original (los preserva)
    expect(result.data.warnings).toEqual([
      'Los 8 embeddings del hablante "Origen" se reasignarán a "Destino"',
    ]);
  });

  it('CASO 2 — ambos con embeddings → advertencia de fusión sin swap', async () => {
    setupSpeakers({ sourceCount: 3, targetCount: 5 });

    const result = await handlers['preview-merge-speakers'](
      {},
      { sourceSpeakerId: 'source-id', targetSpeakerId: 'target-id' }
    );

    expect(result.data.swapped).toBe(false);
    expect(result.data.finalSourceId).toBe('source-id');
    expect(result.data.finalTargetId).toBe('target-id');
    expect(result.data.sourceEmbeddings).toBe(3);
    expect(result.data.targetEmbeddings).toBe(5);
    expect(result.data.warnings).toEqual([
      'Ambos hablantes tienen embeddings (3 y 5). Los embeddings del hablante de origen se reasignarán al de destino.',
    ]);
  });

  it('CASO 3 — ninguno tiene embeddings → advertencia informativa de "fusión segura"', async () => {
    setupSpeakers({ sourceCount: 0, targetCount: 0 });

    const result = await handlers['preview-merge-speakers'](
      {},
      { sourceSpeakerId: 'source-id', targetSpeakerId: 'target-id' }
    );

    expect(result.data.swapped).toBe(false);
    expect(result.data.warnings).toEqual(['Ninguno de los dos hablantes tiene embeddings. La fusión es segura.']);
  });

  it('GENUINE BUG (documentado, no arreglado): CASO 4 — source SIN embeddings, target CON embeddings → ninguna de las 3 ramas `if/else if` cubre esta combinación; warnings queda vacío, sin ningún mensaje (ni siquiera el de "fusión segura" que sí recibe el caso simétrico 0/0)', async () => {
      // Cadena de branches del handler real:
      //   if (source>0 && target===0)      { ...swap... }
      //   else if (source>0 && target>0)   { ...ambos... }
      //   else if (source===0 && target===0){ ...seguro... }
      //   // FALTA: source===0 && target>0 — el caso más "seguro" de los 4
      //   //        (el target ya tiene sus propios embeddings, no se pierde
      //   //        nada), pero es el ÚNICO que no genera NINGÚN mensaje.
      // Esto es inconsistente con el caso simétrico (0,0) que sí confirma
      // explícitamente "La fusión es segura." — aquí el frontend recibiría
      // `warnings: []` sin ninguna pista de que se evaluó el caso, indistinguible
      // de un fallo silencioso en la detección de advertencias.
    setupSpeakers({ sourceCount: 0, targetCount: 6 });

    const result = await handlers['preview-merge-speakers'](
      {},
      { sourceSpeakerId: 'source-id', targetSpeakerId: 'target-id' }
    );

    expect(result.success).toBe(true);
    expect(result.data.swapped).toBe(false);
    expect(result.data.sourceEmbeddings).toBe(0);
    expect(result.data.targetEmbeddings).toBe(6);
    expect(result.data.warnings).toEqual([]); // ningún mensaje, a diferencia del caso (0,0)
  });

  it('dbService lanza en cualquier paso → capturado, success:false', async () => {
    dbServiceMock.getSpeakerEmbeddingCount.mockImplementation(() => {
      throw new Error('error de conteo');
    });

    const result = await handlers['preview-merge-speakers'](
      {},
      { sourceSpeakerId: 'source-id', targetSpeakerId: 'target-id' }
    );

    expect(result).toEqual({ success: false, error: 'error de conteo' });
  });
});

// ─────────────────────────────────────────────────────────────────────────
// delete-speaker-recording-resolution — operación atómica (embedding +
// resolución) delegada a dbService, con defaults de conteo a 0.
// ─────────────────────────────────────────────────────────────────────────

describe('delete-speaker-recording-resolution', () => {
  it('sin speakerId o recordingId → error de validación sin llamar a dbService', async () => {
    const result = await handlers['delete-speaker-recording-resolution']({}, { speakerId: 's1' });

    expect(result).toEqual({ success: false, error: 'speakerId y recordingId son requeridos' });
    expect(dbServiceMock.deleteSpeakerRecordingRelationAtomically).not.toHaveBeenCalled();
  });

  it('txResult.success false con error propio → se propaga ese mensaje', async () => {
    dbServiceMock.deleteSpeakerRecordingRelationAtomically.mockReturnValue({ success: false, error: 'FK violation' });

    const result = await handlers['delete-speaker-recording-resolution']({}, { speakerId: 's1', recordingId: 1 });

    expect(result).toEqual({ success: false, error: 'FK violation' });
  });

  it('BOUNDARY: txResult undefined (uso de `?.`) → cae al mensaje de fallback genérico', async () => {
    dbServiceMock.deleteSpeakerRecordingRelationAtomically.mockReturnValue(undefined);

    const result = await handlers['delete-speaker-recording-resolution']({}, { speakerId: 's1', recordingId: 1 });

    expect(result).toEqual({ success: false, error: 'No se pudo eliminar la relación del hablante' });
  });

  it('camino feliz: devuelve los 3 contadores tal cual', async () => {
    dbServiceMock.deleteSpeakerRecordingRelationAtomically.mockReturnValue({
      success: true,
      deletedCount: 2,
      deletedEmbeddings: 1,
      deletedResolutions: 1,
    });

    const result = await handlers['delete-speaker-recording-resolution']({}, { speakerId: 's1', recordingId: 1 });

    expect(result).toEqual({ success: true, deletedCount: 2, deletedEmbeddings: 1, deletedResolutions: 1 });
  });

  it('BOUNDARY: txResult.success true sin contadores → cada uno cae a su default 0', async () => {
    dbServiceMock.deleteSpeakerRecordingRelationAtomically.mockReturnValue({ success: true });

    const result = await handlers['delete-speaker-recording-resolution']({}, { speakerId: 's1', recordingId: 1 });

    expect(result).toEqual({ success: true, deletedCount: 0, deletedEmbeddings: 0, deletedResolutions: 0 });
  });

  it('dbService lanza → capturado, success:false', async () => {
    dbServiceMock.deleteSpeakerRecordingRelationAtomically.mockImplementation(() => {
      throw new Error('deadlock');
    });

    const result = await handlers['delete-speaker-recording-resolution']({}, { speakerId: 's1', recordingId: 1 });

    expect(result).toEqual({ success: false, error: 'deadlock' });
  });
});
