/**
 * rag.searchProject.test.js
 *
 * Tests unitarios para el handler IPC `search-project` de
 * electron/ipc-handlers/rag.js.
 *
 * rag.js requiere a nivel de módulo electron, dbService, ragService y
 * ../utils/paths (todo CJS puro) → mismo patrón que projects.test.js: mocks
 * inyectados en `require.cache` vía `createRequire(import.meta.url)` en
 * beforeAll/afterAll, import dinámico en beforeEach e `ipcMain.handle`
 * capturando cada callback en `handlers`.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { createRequire } from 'node:module';

const nodeRequire = createRequire(import.meta.url);
const electronPath = nodeRequire.resolve('electron');
const dbServicePath = nodeRequire.resolve('../../../../electron/database/dbService.js');
const ragServicePath = nodeRequire.resolve('../../../../electron/services/ragService.js');
const pathsPath = nodeRequire.resolve('../../../../electron/utils/paths.js');

const originals = {};

const handlers = {};
const ipcMainMock = {
  handle: vi.fn((channel, cb) => {
    handlers[channel] = cb;
  }),
};
const dbServiceMock = { updateRagStatus: vi.fn(), getRagStatus: vi.fn() };
const ragServiceMock = {
  indexRecording: vi.fn(),
  searchRecording: vi.fn(),
  searchProject: vi.fn(),
  getStatus: vi.fn(),
  deleteIndex: vi.fn(),
  reindexAllRecordings: vi.fn(),
};
const pathsMock = { getRecordingsPath: vi.fn(), getFolderPathFromId: vi.fn() };

function inject(modulePath, exports) {
  originals[modulePath] = nodeRequire.cache[modulePath];
  nodeRequire.cache[modulePath] = { id: modulePath, filename: modulePath, loaded: true, exports };
}

beforeAll(() => {
  inject(electronPath, { ipcMain: ipcMainMock });
  inject(dbServicePath, dbServiceMock);
  inject(ragServicePath, ragServiceMock);
  inject(pathsPath, pathsMock);
});

afterAll(() => {
  for (const modulePath of [electronPath, dbServicePath, ragServicePath, pathsPath]) {
    if (originals[modulePath]) nodeRequire.cache[modulePath] = originals[modulePath];
    else delete nodeRequire.cache[modulePath];
  }
});

beforeEach(async () => {
  Object.keys(handlers).forEach((k) => delete handlers[k]);
  [ipcMainMock.handle, ...Object.values(dbServiceMock), ...Object.values(ragServiceMock), ...Object.values(pathsMock)]
    .forEach((fn) => fn.mockReset());
  ipcMainMock.handle.mockImplementation((channel, cb) => {
    handlers[channel] = cb;
  });

  vi.restoreAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});

  pathsMock.getRecordingsPath.mockResolvedValue('/fake/recordings');

  const ragHandlers = await import('../../../../electron/ipc-handlers/rag.js');
  ragHandlers.registerRagHandlers();
});

describe('search-project', () => {
  it('B1: resuelve las rutas, llama a ragService.searchProject una sola vez y devuelve { success:true, results }', async () => {
    pathsMock.getFolderPathFromId.mockImplementation(async (id) => `folder-${id}`);
    const results = [
      { recordingId: 'a', success: true, chunks: [{ chunkId: 1 }] },
      { recordingId: 'b', success: true, chunks: [] },
    ];
    ragServiceMock.searchProject.mockResolvedValue(results);

    const response = await handlers['search-project']({}, ['a', 'b'], 'consulta', 5);

    expect(ragServiceMock.searchProject).toHaveBeenCalledTimes(1);
    expect(ragServiceMock.searchProject).toHaveBeenCalledWith(
      [
        { recordingId: 'a', recordingPath: '/fake/recordings/folder-a' },
        { recordingId: 'b', recordingPath: '/fake/recordings/folder-b' },
      ],
      'consulta',
      5,
    );
    expect(response).toEqual({ success: true, results });
  });

  it('B2: si falla resolver la ruta de un id, ese id sale como success:false y el resto se busca igualmente', async () => {
    pathsMock.getFolderPathFromId.mockImplementation(async (id) => {
      if (id === 'b') throw new Error('grabación no encontrada');
      return `folder-${id}`;
    });
    ragServiceMock.searchProject.mockResolvedValue([
      { recordingId: 'a', success: true, chunks: [{ chunkId: 1 }] },
      { recordingId: 'c', success: true, chunks: [] },
    ]);

    const response = await handlers['search-project']({}, ['a', 'b', 'c'], 'consulta', 5);

    expect(ragServiceMock.searchProject).toHaveBeenCalledTimes(1);
    expect(ragServiceMock.searchProject.mock.calls[0][0].map((r) => r.recordingId)).toEqual(['a', 'c']);
    expect(response.success).toBe(true);
    const failed = response.results.find((r) => r.recordingId === 'b');
    expect(failed).toMatchObject({ recordingId: 'b', success: false, chunks: [] });
    expect(failed.error).toContain('grabación no encontrada');
    expect(response.results.map((r) => r.recordingId).sort()).toEqual(['a', 'b', 'c']);
  });
});
