import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Patrón `wiki.test.js`: `registerResourcesHandlers(ipcMain)` recibe
 * `ipcMain` inyectado y el `resourceManager` real se sustituye vía
 * `__setResourceManager` (mismo criterio que `__setWikiQueries`), sin
 * necesidad de mockear `electron` a nivel de módulo.
 */
const resourceManagerMock = vi.hoisted(() => ({
  getSnapshot: vi.fn(),
  refresh: vi.fn(),
  checkSpace: vi.fn(),
  download: vi.fn(),
  cancel: vi.fn(),
  retry: vi.fn(),
  delete: vi.fn(),
}));

describe('resources handlers', () => {
  let registerResourcesHandlers;
  let handlers;
  let ipcMain;

  beforeEach(async () => {
    handlers = new Map();
    ipcMain = {
      handle: vi.fn((channel, handler) => {
        handlers.set(channel, handler);
      }),
    };

    Object.values(resourceManagerMock).forEach((mockFn) => mockFn.mockReset());

    ({ registerResourcesHandlers } = await import('../../../../electron/ipc-handlers/resources.js'));
    const { __setResourceManager } = await import('../../../../electron/ipc-handlers/resources.js');
    __setResourceManager(resourceManagerMock);
    registerResourcesHandlers(ipcMain);
  });

  it('registra resources:list y devuelve el snapshot', async () => {
    const snapshot = { ok: true, cacheDir: '/x', items: [] };
    resourceManagerMock.getSnapshot.mockReturnValue(snapshot);

    const result = await handlers.get('resources:list')(null);

    expect(result).toEqual(snapshot);
  });

  it('registra resources:refresh y fuerza un rescan', async () => {
    const snapshot = { ok: true, cacheDir: '/x', items: [] };
    resourceManagerMock.refresh.mockReturnValue(snapshot);

    const result = await handlers.get('resources:refresh')(null);

    expect(resourceManagerMock.refresh).toHaveBeenCalled();
    expect(result).toEqual(snapshot);
  });

  it('registra resources:check-space y delega el id recibido', async () => {
    resourceManagerMock.checkSpace.mockReturnValue({ ok: true, sufficient: true });

    const result = await handlers.get('resources:check-space')(null, 'small');

    expect(resourceManagerMock.checkSpace).toHaveBeenCalledWith('small');
    expect(result).toEqual({ ok: true, sufficient: true });
  });

  it('registra resources:download y delega el id recibido', async () => {
    resourceManagerMock.download.mockReturnValue({ ok: true });

    const result = await handlers.get('resources:download')(null, 'medium');

    expect(resourceManagerMock.download).toHaveBeenCalledWith('medium');
    expect(result).toEqual({ ok: true });
  });

  it('registra resources:cancel y delega el id recibido', async () => {
    resourceManagerMock.cancel.mockReturnValue({ ok: true });

    const result = await handlers.get('resources:cancel')(null, 'medium');

    expect(resourceManagerMock.cancel).toHaveBeenCalledWith('medium');
    expect(result).toEqual({ ok: true });
  });

  it('registra resources:retry y delega el id recibido', async () => {
    resourceManagerMock.retry.mockReturnValue({ ok: true });

    const result = await handlers.get('resources:retry')(null, 'small');

    expect(resourceManagerMock.retry).toHaveBeenCalledWith('small');
    expect(result).toEqual({ ok: true });
  });

  it('registra resources:delete y espera la promesa del resourceManager', async () => {
    resourceManagerMock.delete.mockResolvedValue({ ok: true, freedBytes: 123 });

    const result = await handlers.get('resources:delete')(null, 'tiny');

    expect(resourceManagerMock.delete).toHaveBeenCalledWith('tiny');
    expect(result).toEqual({ ok: true, freedBytes: 123 });
  });

  it('registra resources:get-queue y devuelve el snapshot', async () => {
    const snapshot = { ok: true, queue: [], active: null };
    resourceManagerMock.getSnapshot.mockReturnValue(snapshot);

    const result = await handlers.get('resources:get-queue')(null);

    expect(result).toEqual(snapshot);
  });

  it('cada handler devuelve {ok:false, error} sin lanzar si el resourceManager tira una excepción', async () => {
    resourceManagerMock.checkSpace.mockImplementation(() => {
      throw new Error('boom');
    });

    const result = await handlers.get('resources:check-space')(null, 'small');

    expect(result).toEqual({ ok: false, error: 'boom' });
  });

  it('resources:delete también captura rechazos de la promesa sin lanzar', async () => {
    resourceManagerMock.delete.mockRejectedValue(new Error('delete boom'));

    const result = await handlers.get('resources:delete')(null, 'small');

    expect(result).toEqual({ ok: false, error: 'delete boom' });
  });
});
