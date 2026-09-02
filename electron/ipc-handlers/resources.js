/**
 * Canal IPC `resources:*` — inventario, descargas y borrado de modelos
 * Whisper (design.md — Contrato IPC `resources:*`). Todos los handlers
 * devuelven `{ ok, ... }` y nunca lanzan al renderer.
 */
let resourceManager = require('../services/resourceManager');

function toErrorResult(error) {
  return { ok: false, error: error?.message || String(error) };
}

function registerResourcesHandlers(ipcMain) {
  ipcMain.handle('resources:list', async () => {
    try {
      return resourceManager.getSnapshot();
    } catch (error) {
      return toErrorResult(error);
    }
  });

  ipcMain.handle('resources:refresh', async () => {
    try {
      return resourceManager.refresh();
    } catch (error) {
      return toErrorResult(error);
    }
  });

  ipcMain.handle('resources:check-space', async (_event, id) => {
    try {
      return resourceManager.checkSpace(id);
    } catch (error) {
      return toErrorResult(error);
    }
  });

  ipcMain.handle('resources:download', async (_event, id) => {
    try {
      return resourceManager.download(id);
    } catch (error) {
      return toErrorResult(error);
    }
  });

  ipcMain.handle('resources:cancel', async (_event, id) => {
    try {
      return resourceManager.cancel(id);
    } catch (error) {
      return toErrorResult(error);
    }
  });

  ipcMain.handle('resources:retry', async (_event, id) => {
    try {
      return resourceManager.retry(id);
    } catch (error) {
      return toErrorResult(error);
    }
  });

  ipcMain.handle('resources:delete', async (_event, id) => {
    try {
      return await resourceManager.delete(id);
    } catch (error) {
      return toErrorResult(error);
    }
  });

  ipcMain.handle('resources:get-queue', async () => {
    try {
      return resourceManager.getSnapshot();
    } catch (error) {
      return toErrorResult(error);
    }
  });
}

function __setResourceManager(mockResourceManager) {
  resourceManager = mockResourceManager;
}

module.exports = { registerResourcesHandlers, __setResourceManager };
