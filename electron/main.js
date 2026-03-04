/* global require, process, __dirname */

// ========================================
// 1. IMPORTACIONES GLOBALES
// ========================================
const { app, BrowserWindow, ipcMain, systemPreferences, session, protocol } = require('electron');
const { initMain } = require('electron-audio-loopback');
const path = require('path');
const fs = require('fs');

// Servicios de arranque
const dbService = require('./database/dbService');
const migrationService = require('./database/migrationService');
const transcriptionManager = require('./services/transcriptionManager');
const notificationService = require('./services/notificationService');

// Utilitarios
const { getRecordingsPath, settingsPath } = require('./utils/paths');

// Módulos IPC (Handlers)
const { registerSettingsHandlers } = require('./ipc-handlers/settings');
const { registerAudioHandlers } = require('./ipc-handlers/audio');
const { registerTranscriptionHandlers } = require('./ipc-handlers/transcription');
const { registerRecordingsHandlers } = require('./ipc-handlers/recordings');
const { registerAnalysisHandlers } = require('./ipc-handlers/analysis');
const { registerProjectsHandlers } = require('./ipc-handlers/projects');
const { registerRagHandlers } = require('./ipc-handlers/rag');
const { registerIntegrationsHandlers } = require('./ipc-handlers/integrations');
const { registerDashboardHandlers } = require('./ipc-handlers/dashboard');
const { registerExportHandlers } = require('./ipc-handlers/export');


// ========================================
// 1.5 REDIRIGIR LOGS DEL MAIN AL RENDERER (DevTools)
// ========================================
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

function sendLogToRenderer(...args) {
  try {
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0 && windows[0].webContents) {
      const message = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
      windows[0].webContents.executeJavaScript(
        `console.log('%c[Main]', 'color: #8b5cf6; font-weight: bold;', ${JSON.stringify(message)})`
      ).catch(() => {});
    }
  } catch (_) { /* ignore */ }
}

console.log = (...args) => {
  originalLog(...args);
  sendLogToRenderer(...args);
};
console.error = (...args) => {
  originalError(...args);
  try {
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0 && windows[0].webContents) {
      const message = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
      windows[0].webContents.executeJavaScript(
        `console.error('%c[Main]', 'color: #ef4444; font-weight: bold;', ${JSON.stringify(message)})`
      ).catch(() => {});
    }
  } catch (_) { /* ignore */ }
};
console.warn = (...args) => {
  originalWarn(...args);
  try {
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0 && windows[0].webContents) {
      const message = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
      windows[0].webContents.executeJavaScript(
        `console.warn('%c[Main]', 'color: #f59e0b; font-weight: bold;', ${JSON.stringify(message)})`
      ).catch(() => {});
    }
  } catch (_) { /* ignore */ }
};

// ========================================
// 2. FUNCIONES DE CONFIGURACIÓN DE APP
// ========================================
function registerIpcHandlers() {
  console.log('[Main] Registrando módulos de IPC Handlers...');
  registerSettingsHandlers();
  registerAudioHandlers();
  registerTranscriptionHandlers();
  registerRecordingsHandlers();
  registerAnalysisHandlers();
  registerProjectsHandlers();
  registerRagHandlers();
  registerIntegrationsHandlers();
  registerDashboardHandlers();
  registerExportHandlers();
}

async function checkMicrophonePermission() {
  if (process.platform === 'darwin') {
    const status = systemPreferences.getMediaAccessStatus('microphone');
    console.log('[Main] Estado de permisos del micrófono:', status);
    if (status === 'not-determined') {
      await systemPreferences.askForMediaAccess('microphone');
    }
  }
}

function createWindow() {
  const iconPath = process.env.NODE_ENV === 'development'
    ? path.join(__dirname, '../public/icon.png')
    : path.join(__dirname, '../dist/icon.png');

  if (process.platform === 'darwin') {
    app.dock.setIcon(iconPath);
  }

  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 950,
    minWidth: 1090,
    minHeight: 950,
    icon: iconPath,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      allowRunningInsecureContent: true,
      experimentalFeatures: true,
      webSecurity: false
    }
  });

  notificationService.setMainWindow(mainWindow);

  // Handler IPC para abrir/cerrar DevTools desde Settings
  ipcMain.removeHandler('toggle-devtools');
  ipcMain.handle('toggle-devtools', () => {
    if (mainWindow.webContents.isDevToolsOpened()) {
      mainWindow.webContents.closeDevTools();
    } else {
      mainWindow.webContents.openDevTools();
    }
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}


// ========================================
// 3. INICIALIZACIÓN ORQUESTADA (Init)
// ========================================
async function initApp() {
  console.log('[Main] Iniciando secuencia de arranque...');

  // 0. Permisos de micrófono al inicio de la app
  await checkMicrophonePermission();

  // 1. Inicializar Base de Datos
  const userDataPath = app.getPath('userData');
  const dbPath = path.join(userDataPath, 'recordings.db');
  dbService.init(dbPath);

  // 2. Registrar manejadores de comunicación IPC
  registerIpcHandlers();

  // 3. Configurar callbacks del sistema
  transcriptionManager.setUpdateCallback((queueState) => {
    BrowserWindow.getAllWindows().forEach(win => {
      win.webContents.send('queue-update', queueState);
    });
  });

  // 4. Cargar configuraciones guardadas
  if (fs.existsSync(settingsPath)) {
    try {
      const data = await fs.promises.readFile(settingsPath, 'utf8');
      notificationService.updateSettings(JSON.parse(data));
    } catch (error) {
      console.error('[Main] Error cargando settings iniciales:', error);
    }
  }

  // 5. Reanudar colas pendientes
  transcriptionManager.checkQueue();

  // 6. Registrar protocolos personalizados
  protocol.registerFileProtocol('media', (request, callback) => {
    const url = request.url.replace('media://', '');
    try {
      return callback(decodeURIComponent(url));
    } catch (error) {
      return callback(404);
    }
  });

  // 7. Sincronizar sistema de archivos con base de datos
  const recordingsPath = await getRecordingsPath();
  transcriptionManager.setBasePath(recordingsPath);
  migrationService.syncRecordings(recordingsPath).catch(err => 
    console.error('[Main] Error en migración de archivos:', err)
  );

  // 8. Crear la interfaz gráfica
  createWindow();
}


// ========================================
// 4. CICLO DE VIDA (Ejecución real)
// ========================================

// Establecer nombre de la aplicación inmediatamente (Ayuda en menú/Dock)
app.setName('AIRecorder');
app.setAppUserModelId('com.airecorder.app');

// Inicializar audio loopback (debe ser ANTES de app.whenReady)
initMain();

// Arranque de la aplicación
app.whenReady().then(initApp);

// Manejo de eventos de ventanas (Específico de macOS)
app.on('activate', function () {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// Cierre de la aplicación
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
