const { ipcMain, BrowserWindow } = require('electron');
const diarizationInstaller = require('../services/diarizationInstaller');

function sendProgress(event) {
  return (data) => {
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
      windows[0].webContents.send('diarization-install-progress', data);
    }
  };
}

module.exports.registerDiarizationHandlers = () => {

  // Estado del entorno y modelo
  ipcMain.handle('get-diarization-env-status', () => {
    try {
      return { success: true, ...diarizationInstaller.getStatus() };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // Iniciar instalación
  ipcMain.handle('install-diarization-env', async (event) => {
    try {
      const result = await diarizationInstaller.installEnv(sendProgress(event));
      // Notificar finalización
      const windows = BrowserWindow.getAllWindows();
      if (windows.length > 0) {
        windows[0].webContents.send('diarization-install-progress', {
          phase: result.success ? 'done' : 'error',
          percent: result.success ? 100 : 0,
          detail: result.error || 'Instalación completada',
        });
      }
      return result;
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // Cancelar instalación
  ipcMain.handle('cancel-diarization-install', () => {
    diarizationInstaller.cancelInstall();
    return { success: true };
  });

  // Desinstalar entorno
  ipcMain.handle('uninstall-diarization-env', async () => {
    try {
      return await diarizationInstaller.uninstallEnv();
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // Eliminar caché del modelo pyannote
  ipcMain.handle('delete-pyannote-model-cache', async () => {
    try {
      return await diarizationInstaller.deletePyannoteModelCache();
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // Descargar modelo pyannote (sin diarizar — precacheo desde Settings)
  ipcMain.handle('download-pyannote-model', async (event, hfToken) => {
    try {
      const send = sendProgress(event);
      send({ phase: 'downloading_model', percent: 0, detail: 'Descargando modelo (~200 MB)...' });
      const result = await diarizationInstaller.downloadModel(hfToken || null, (phase) => {
        if (phase.startsWith('done')) {
          send({ phase: 'done', percent: 100, detail: 'Modelo descargado' });
        } else {
          send({ phase, percent: 50, detail: phase });
        }
      });
      if (!result.success) {
        send({ phase: 'error', percent: 0, detail: result.error });
      }
      return result;
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
};
