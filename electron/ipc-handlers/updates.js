const { ipcMain, shell } = require('electron');
const updateChecker = require('../services/updateChecker');

module.exports.registerUpdateHandlers = () => {

  // Verificar actualizaciones manualmente (desde Settings o UI)
  ipcMain.handle('check-for-updates', async () => {
    try {
      const updateInfo = await updateChecker.checkForUpdates(false, true);
      if (updateInfo) {
        return { success: true, updateAvailable: true, ...updateInfo };
      }
      return { success: true, updateAvailable: false };
    } catch (error) {
      console.error('[Updates] Error:', error.message);
      return { success: false, error: error.message };
    }
  });

  // Obtener versión actual de la app
  ipcMain.handle('get-app-version', () => {
    return { success: true, version: updateChecker.getCurrentVersion() };
  });

  // Abrir URL de descarga
  ipcMain.handle('open-download-url', async (_event, url) => {
    try {
      await shell.openExternal(url);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Probar el dialogo de update (solo dev)
  ipcMain.handle('test-update-dialog', async () => {
    try {
      await updateChecker._showUpdateDialog({
        latestVersion: '9.9.9-beta',
        currentVersion: updateChecker.getCurrentVersion(),
        releaseNotes: 'Esta es una versión simulada para probar el diálogo de actualización.\n\n- Nueva funcionalidad X\n- Corrección Y',
        downloadUrl: 'https://github.com/rgarciade/airecorder/releases/latest'
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
};
