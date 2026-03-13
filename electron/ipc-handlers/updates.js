const { ipcMain, shell } = require('electron');
const updateChecker = require('../services/updateChecker');
const fs = require('fs');
const path = require('path');

const getWhatsNewContent = () => {
  try {
    const whatsNewPath = path.join(__dirname, '../../src/data/whatsNew.json');
    if (fs.existsSync(whatsNewPath)) {
      const data = JSON.parse(fs.readFileSync(whatsNewPath, 'utf8'));
      const changes = data.changes.map(c => `- ${c.icon} ${c.es.title}: ${c.es.desc}`).join('\n');
      return `📢 ${data.i18n.es.releaseTitle}\n\n${changes}`;
    }
  } catch (e) {
    console.error('[Updates] Error leyendo whatsNew:', e.message);
  }
  return null;
};

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
      const releaseNotes = getWhatsNewContent();
      await updateChecker._showUpdateDialog({
        latestVersion: '0.2.2',
        currentVersion: updateChecker.getCurrentVersion(),
        releaseNotes: releaseNotes || 'Versión de prueba sin notas',
        downloadUrl: 'https://github.com/rgarciade/airecorder/releases/latest'
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
};
