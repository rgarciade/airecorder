const { ipcMain, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const notificationService = require('../services/notificationService');
const { settingsPath, DEFAULT_BASE_RECORDER_PATH } = require('../utils/paths');

module.exports.registerSettingsHandlers = () => {
  
  // Obtener info del sistema (CPU)
  ipcMain.handle('get-system-info', () => {
    return {
      cpuCores: os.cpus().length,
      platform: os.platform()
    };
  });

  // Manejador para guardar configuración
  ipcMain.handle('save-settings', async (event, settings) => {
    try {
      await fs.promises.writeFile(settingsPath, JSON.stringify(settings, null, 2));
      notificationService.updateSettings(settings); // Actualizar servicio en vivo
      return { success: true };
    } catch (error) {
      console.error('Error saving settings:', error);
      return { success: false, error: error.message };
    }
  });

  // Manejador para cargar configuración
  ipcMain.handle('load-settings', async () => {
    try {
      if (fs.existsSync(settingsPath)) {
        const data = await fs.promises.readFile(settingsPath, 'utf8');
        return { success: true, settings: JSON.parse(data) };
      }
      return { success: true, settings: null };
    } catch (error) {
      console.error('Error loading settings:', error);
      return { success: false, error: error.message };
    }
  });

  // Manejador para seleccionar directorio
  ipcMain.handle('select-directory', async () => {
    console.log('Abriendo selector de directorios...');
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory']
    });
    if (result.canceled) {
      return null;
    }
    return result.filePaths[0];
  });

  // Obtener ruta por defecto
  ipcMain.handle('get-default-recording-path', () => {
    return path.join(DEFAULT_BASE_RECORDER_PATH, 'grabaciones');
  });

};