const { ipcMain, dialog, app } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const notificationService = require('../services/notificationService');
const { settingsPath, DEFAULT_BASE_RECORDER_PATH } = require('../utils/paths');
const dbService = require('../database/dbService');

module.exports.registerSettingsHandlers = () => {
  
  // Detectar idioma del sistema operativo
  ipcMain.handle('get-system-language', () => {
    const locale = app.getLocale(); // e.g. 'es-ES', 'en-US'
    const lang = locale.split('-')[0]; // 'es', 'en', etc.
    return ['es', 'en'].includes(lang) ? lang : 'es'; // Sólo soportamos es/en, fallback 'es'
  });

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
      
      // Actualizar la ruta base del transcriptionManager al vuelo
      const { getRecordingsPath } = require('../utils/paths');
      const transcriptionManager = require('../services/transcriptionManager');
      const newPath = await getRecordingsPath();
      transcriptionManager.setBasePath(newPath);
      
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

  // Cambiar la ruta de la base de datos (con opción de migrar/copiar el archivo existente)
  ipcMain.handle('change-db-path', async (event, { newPath, migrate }) => {
    try {
      const currentPath = dbService.getCurrentPath();

      // Asegurarse de que el directorio de destino existe
      const newDir = path.dirname(newPath);
      if (!fs.existsSync(newDir)) {
        return { success: false, error: `El directorio "${newDir}" no existe.` };
      }

      // Copiar/migrar BD si se solicita
      if (migrate && currentPath && fs.existsSync(currentPath)) {
        fs.copyFileSync(currentPath, newPath);
        console.log(`[Settings] BD migrada de ${currentPath} a ${newPath}`);
      }

      // Cerrar BD actual y reiniciar con la nueva ruta
      dbService.close();
      dbService.init(newPath);
      console.log(`[Settings] BD reiniciada en: ${newPath}`);

      // Persistir la nueva ruta en settings.json
      let settings = {};
      if (fs.existsSync(settingsPath)) {
        try {
          settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        } catch (_) {}
      }
      settings.databasePath = newPath;
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));

      // Actualizar flag de fallback — ya no usamos fallback
      global.usingFallbackDb = false;

      return { success: true };
    } catch (err) {
      console.error('[Settings] Error cambiando ruta de BD:', err);
      return { success: false, error: err.message };
    }
  });

  // Verificar si el modelo pyannote ya está descargado en cache local
  ipcMain.handle('check-pyannote-cache', () => {
    try {
      const homeDir = os.homedir();
      const possiblePaths = [
        path.join(homeDir, '.cache', 'huggingface', 'hub', 'models--pyannote--speaker-diarization-3.1'),
        path.join(homeDir, '.cache', 'torch', 'pyannote', 'speaker-diarization-3.1'),
      ];
      const cached = possiblePaths.some(p => fs.existsSync(p));
      return { success: true, cached };
    } catch (err) {
      return { success: false, cached: false, error: err.message };
    }
  });

  // Calcular tamaño de una carpeta (recursivo)
  ipcMain.handle('get-directory-size', async (event, dirPath) => {
    try {
      if (!dirPath || !fs.existsSync(dirPath)) return { success: true, gb: 0 };

      const getSize = async (p) => {
        const stat = await fs.promises.stat(p);
        if (stat.isFile()) return stat.size;
        const entries = await fs.promises.readdir(p);
        const sizes = await Promise.all(
          entries.map(e => getSize(path.join(p, e)).catch(() => 0))
        );
        return sizes.reduce((a, b) => a + b, 0);
      };

      const bytes = await getSize(dirPath);
      const gb = bytes / (1000 * 1000 * 1000); // GB decimales (igual que macOS Finder)
      return { success: true, gb };
    } catch (err) {
      return { success: false, error: err.message, bytes: 0 };
    }
  });

};