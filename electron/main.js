/* global require, process, __dirname */
const { app, BrowserWindow, ipcMain, systemPreferences, desktopCapturer, session, dialog, protocol, shell } = require('electron');
const path = require('path');

// Establecer nombre de la aplicación inmediatamente (Ayuda en el menú y Dock en algunos casos)
app.setName('AIRecorder');

const fs = require('fs');
const AudioRecorder = require('./audioRecorder');
const { spawn } = require('child_process');
const dbService = require('./database/dbService');
const migrationService = require('./database/migrationService');
const transcriptionManager = require('./transcriptionManager');
const notificationService = require('./notificationService');

// Constantes de rutas base (Defaults)
const DEFAULT_BASE_RECORDER_PATH = path.join(app.getPath('desktop'), 'recorder');
// PROJECTS_PATH se mantiene en el default por ahora para no romper la BD de proyectos
const PROJECTS_PATH = path.join(DEFAULT_BASE_RECORDER_PATH, 'projects');

// Configuración de ID de aplicación para notificaciones
// En macOS, esto puede no tener efecto en modo desarrollo debido a cómo se firman las notificaciones,
// pero es buena práctica mantenerlo para producción y otras plataformas.
app.setAppUserModelId('com.airecorder.app');

// Ruta del archivo de configuración
const settingsPath = path.join(app.getPath('userData'), 'settings.json');

// Helper para obtener la ruta de grabaciones dinámica
async function getRecordingsPath() {
  let recordingPath = path.join(DEFAULT_BASE_RECORDER_PATH, 'grabaciones'); // Default

  try {
    console.log('[DEBUG] Checking settings for path:', settingsPath);
    if (fs.existsSync(settingsPath)) {
      const data = await fs.promises.readFile(settingsPath, 'utf8');
      const settings = JSON.parse(data);
      
      if (settings.outputDirectory) {
        recordingPath = settings.outputDirectory;
        console.log('[DEBUG] Path from settings:', recordingPath);
      }
    }
  } catch (error) {
    console.error('Error leyendo configuración para ruta:', error);
  }

  // COMPATIBILIDAD
  const subGrabaciones = path.join(recordingPath, 'grabaciones');
  if (fs.existsSync(subGrabaciones)) {
      console.log('[DEBUG] Found subfolder "grabaciones", using:', subGrabaciones);
      return subGrabaciones;
  }

  console.log('[DEBUG] Using path:', recordingPath);
  return recordingPath;
}

// Estado global para evitar transcripciones simultáneas
// let isTranscribing = false; // DEPRECATED: Managed by TranscriptionManager
// let currentTranscribingId = null; // DEPRECATED

// Manejador para añadir a la cola
ipcMain.handle('transcribe-recording', async (event, recordingId, model = null) => {
  try {
    const result = transcriptionManager.addTask(recordingId, { name: recordingId, model: model });
    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-transcription-queue', () => {
  return { success: true, ...transcriptionManager.getState() };
});

ipcMain.handle('cancel-transcription-task', (event, recordingId) => {
  return transcriptionManager.cancelTask(recordingId);
});

ipcMain.handle('get-recording-queue-status', async (event, recordingId) => {
  try {
    const status = dbService.getRecordingTaskStatus(recordingId);
    return { success: true, status };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Función para verificar y solicitar permisos de micrófono (macOS)
async function checkMicrophonePermission() {
  if (process.platform === 'darwin') {
    const status = systemPreferences.getMediaAccessStatus('microphone');
    console.log('Estado de permisos del micrófono:', status);
    if (status === 'not-determined') {
      await systemPreferences.askForMediaAccess('microphone');
    }
  }
}

function createWindow() {
  // Verificar permisos antes de crear la ventana
  checkMicrophonePermission();

  const iconPath = process.env.NODE_ENV === 'development'
    ? path.join(__dirname, '../public/icon.png')
    : path.join(__dirname, '../dist/icon.png');

  // Establecer icono del Dock en macOS (ayuda en desarrollo)
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

  // Inicializar servicio de notificaciones con la ventana principal
  notificationService.setMainWindow(mainWindow);

  // Configurar el handler para captura de pantalla/audio según la documentación oficial
  session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    desktopCapturer.getSources({ types: ['screen'] }).then((sources) => {
      // Solo buscamos pantallas completas para captura de audio de sistema ('loopback')
      const screenSource = sources.find(source => source.id.includes('screen:'));
      
      if (screenSource) {
        console.log('Concediendo acceso a pantalla:', screenSource.name, '(ID:', screenSource.id, ')');
        callback({ 
          video: screenSource, 
          audio: 'loopback' 
        });
      } else {
        console.log('No se encontraron pantallas disponibles para captura de audio.');
        // Intentar obtener ventanas como fallback, pero advirtiendo
        desktopCapturer.getSources({ types: ['window'] }).then((windowSources) => {
           if (windowSources.length > 0) {
             console.log('Intentando fallback a ventana:', windowSources[0].name);
             // Para ventanas, 'loopback' podría no funcionar, pero intentamos
             callback({
               video: windowSources[0],
               audio: 'loopback'
             });
           } else {
             console.error('No hay fuentes disponibles (ni pantalla ni ventanas). Verifique permisos.');
             callback({});
           }
        }).catch(err => {
          console.error('Error fallback ventana:', err);
          callback({});
        });
      }
    }).catch(error => {
      console.error('Error obteniendo fuentes:', error);
      callback({});
    });
  }, { 
    useSystemPicker: false 
  });

  // En desarrollo, carga la URL de desarrollo de Vite
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    // En producción, carga el archivo HTML construido
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
  
  // Abre las DevTools automáticamente (siempre, para debugging)
  mainWindow.webContents.openDevTools();
}

app.whenReady().then(async () => {
  // Inicializar DB
  const userDataPath = app.getPath('userData');
  const dbPath = path.join(userDataPath, 'recordings.db');
  dbService.init(dbPath);

  // Configurar callback de actualizaciones de cola
  transcriptionManager.setUpdateCallback((queueState) => {
    BrowserWindow.getAllWindows().forEach(win => {
      win.webContents.send('queue-update', queueState);
    });
  });

  // Cargar configuración inicial de notificaciones
  if (fs.existsSync(settingsPath)) {
    try {
      const data = await fs.promises.readFile(settingsPath, 'utf8');
      const settings = JSON.parse(data);
      notificationService.updateSettings(settings);
    } catch (error) {
      console.error('Error loading initial settings for notifications:', error);
    }
  }

  // Reanudar cola de transcripción si hay pendientes
  transcriptionManager.checkQueue();

  // Registrar protocolo personalizado 'media://' para archivos locales
  protocol.registerFileProtocol('media', (request, callback) => {
    const url = request.url.replace('media://', '');
    try {
      // Decodificar la URL para manejar espacios y caracteres especiales
      return callback(decodeURIComponent(url));
    } catch (error) {
      console.error('Error handling media protocol:', error);
      return callback(404);
    }
  });

  // Ejecutar migración en background
  const recordingsPath = await getRecordingsPath();
  transcriptionManager.setBasePath(recordingsPath);
  migrationService.syncRecordings(recordingsPath).catch(err => 
    console.error('Error en migración:', err)
  );

  createWindow();

  // Configurar callback de actualizaciones de cola
  transcriptionManager.setUpdateCallback((queueState) => {
    BrowserWindow.getAllWindows().forEach(win => {
      win.webContents.send('queue-update', queueState);
    });
  });

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
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

// Manejador para verificar permisos de micrófono
ipcMain.handle('get-microphone-permission', () => {
  if (process.platform === 'darwin') {
    return systemPreferences.getMediaAccessStatus('microphone');
  }
  return 'granted';
});

// Manejador para solicitar permisos de micrófono explícitamente
ipcMain.handle('request-microphone-permission', async () => {
  if (process.platform === 'darwin') {
    const status = systemPreferences.getMediaAccessStatus('microphone');
    if (status === 'not-determined') {
      const granted = await systemPreferences.askForMediaAccess('microphone');
      return granted ? 'granted' : 'denied';
    }
    return status;
  }
  return 'granted';
});

// Inicializar AudioRecorder
const audioRecorder = new AudioRecorder();

// Manejador para obtener dispositivos de audio
ipcMain.handle('get-audio-devices', async () => {
  try {
    const devices = await audioRecorder.getAudioDevices();
    return { success: true, devices };
  } catch (error) {
    console.error('Error getting audio devices:', error);
    return { success: false, error: error.message };
  }
});

// Manejador para iniciar grabación de prueba
ipcMain.handle('start-test-recording', async (event, microphoneId, duration = 4) => {
  try {
    const result = await audioRecorder.startTestRecording(microphoneId, duration);
    return { success: true, result };
  } catch (error) {
    console.error('Error starting test recording:', error);
    return { success: false, error: error.message };
  }
});

// Manejador para detener grabación
ipcMain.handle('stop-recording', async () => {
  try {
    const result = await audioRecorder.stopRecording();
    return { success: true };
  } catch (error) {
    console.error('Error stopping recording:', error);
    return { success: false, error: error.message };
  }
});

// Manejador para obtener archivos de grabación
ipcMain.handle('get-recording-files', async () => {
  try {
    const files = await audioRecorder.getRecordingFiles();
    return { success: true, files };
  } catch (error) {
    console.error('Error getting recording files:', error);
    return { success: false, error: error.message };
  }
});

// Manejador para obtener fuentes de escritorio (audio del sistema)
ipcMain.handle('get-desktop-sources', async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      fetchWindowIcons: false
    });
    
    // Mapear fuentes con más información
    const audioSources = sources.map(source => ({
      id: source.id,
      name: source.name,
      type: source.id.includes('screen') ? 'screen' : 'window',
      display_id: source.display_id || null
    }));
    
    console.log(`Encontradas ${audioSources.length} fuentes de escritorio:`, audioSources.map(s => s.name));
    
    return { success: true, sources: audioSources };
  } catch (error) {
    console.error('Error getting desktop sources:', error);
    return { success: false, error: error.message };
  }
});

// Manejador para guardar audio del sistema
ipcMain.handle('save-system-audio', async (event, audioData, fileName) => {
  try {
    const outputDir = await getRecordingsPath();
    
    // Crear el directorio si no existe
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const filePath = path.join(outputDir, fileName);
    
    // Convertir Uint8Array a Buffer y guardar
    const buffer = Buffer.from(audioData);
    await fs.promises.writeFile(filePath, buffer);
    
    console.log(`Audio del sistema guardado en: ${filePath}`);
    
    // Guardar en DB (status: recorded)
    // Asumimos que fileName es el ID o carpeta, pero aquí fileName parece ser un archivo dentro de una carpeta?
    // Revisemos `save-separate-audio` que es el que usa la estructura de carpetas correcta.
    return { success: true, filePath, message: `Archivo guardado en ${filePath}` };
  } catch (error) {
    console.error('Error saving system audio:', error);
    return { success: false, error: error.message };
  }
});

// Manejador para guardar audios por separado en carpetas
ipcMain.handle('save-separate-audio', async (event, audioData, folderName, fileName, duration = 0) => {
  try {
    const baseOutputDir = await getRecordingsPath();
    const recordingDir = path.join(baseOutputDir, folderName);
    
    // Crear el directorio base si no existe
    if (!fs.existsSync(baseOutputDir)) {
      fs.mkdirSync(baseOutputDir, { recursive: true });
    }
    
    // Crear el directorio de la grabación específica si no existe
    if (!fs.existsSync(recordingDir)) {
      fs.mkdirSync(recordingDir, { recursive: true });
    }
    
    const filePath = path.join(recordingDir, fileName);
    
    // Convertir Uint8Array a Buffer y guardar
    const buffer = Buffer.from(audioData);
    await fs.promises.writeFile(filePath, buffer);
    
    console.log(`Audio separado guardado en: ${filePath} (Duration: ${duration})`);

    // Registrar en DB
    const dbResult = dbService.saveRecording(folderName, duration, 'recorded');

    return { 
      success: true, 
      filePath, 
      folderPath: recordingDir, 
      recordingId: dbResult.id,
      message: `Archivo guardado en ${filePath}` 
    };
  } catch (error) {
    console.error('Error saving separate audio:', error);
    return { success: false, error: error.message };
  }
});

// NUEVOS HANDLERS para gestión de grabaciones

// Manejador para obtener grabaciones mezclando FS y DB
ipcMain.handle('get-recording-folders', async () => {
  try {
    const baseOutputDir = await getRecordingsPath();
    const dbRecordings = dbService.getAllRecordings(); // Array de DB
    const dbMap = new Map(dbRecordings.map(r => [r.relative_path, r]));

    if (!fs.existsSync(baseOutputDir)) {
      return { success: true, folders: [] };
    }
    
    const items = await fs.promises.readdir(baseOutputDir);
    const folders = [];
    
    for (const item of items) {
      const itemPath = path.join(baseOutputDir, item);
      try {
        const stats = await fs.promises.stat(itemPath);
        if (stats.isDirectory()) {
          const folderContents = await fs.promises.readdir(itemPath);
          const audioFiles = folderContents.filter(file => 
            file.endsWith('.webm') || file.endsWith('.wav') || file.endsWith('.mp3')
          );
          
          if (audioFiles.length > 0) {
            // Datos de DB
            const dbEntry = dbMap.get(item);
            
            // Datos calculados/reales
            const hasAnalysis = fs.existsSync(path.join(itemPath, 'analysis', 'transcripcion_combinada.json'));
            
            // Priorizamos DB status, fallback a lógica antigua
            let status = dbEntry ? dbEntry.status : (hasAnalysis ? 'transcribed' : 'recorded');
            
            // Check manual extra por si acaso DB está desfasada en status 'analyzed'
            if (fs.existsSync(path.join(itemPath, 'analysis', 'ai_summary.json'))) {
              status = 'analyzed';
            }

            // Leer nombre personalizado de metadata.json si existe
            let displayName = item;
            const metadataPath = path.join(itemPath, 'metadata.json');
            if (fs.existsSync(metadataPath)) {
              try {
                const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
                if (metadata.customName) {
                  displayName = metadata.customName;
                }
              } catch (e) {
                console.warn(`Error leyendo metadata para ${item}:`, e);
              }
            }

            // Obtener proyecto asociado
            const project = dbService.getRecordingProject(item);

            // Obtener estado en cola si existe
            const queueStatus = dbService.getRecordingTaskStatus(dbEntry ? dbEntry.id : -1);

            folders.push({
              id: dbEntry ? dbEntry.id : null,
              name: displayName,
              folderName: item,
              path: itemPath,
              createdAt: dbEntry ? dbEntry.created_at : stats.birthtime.toISOString(),
              modifiedAt: stats.mtime.toISOString(),
              files: audioFiles,
              hasAnalysis: status === 'transcribed' || status === 'analyzed',
              status: status,
              duration: dbEntry ? dbEntry.duration : 0,
              transcriptionModel: dbEntry ? dbEntry.transcription_model : null,
              project: project ? { id: project.id, name: project.name } : null,
              queueStatus: queueStatus
            });
          }
        }
      } catch (err) {
        console.warn(`Error leyendo carpeta ${item}:`, err);
      }
    }
    
    // Ordenar por fecha
    folders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    return { success: true, folders };
  } catch (error) {
    console.error('Error getting recording folders:', error);
    return { success: false, error: error.message };
  }
});

// Helper para asegurar que tenemos la ruta de la carpeta (string) a partir de un ID (number o string)
async function getFolderPathFromId(recordingId) {
  if (typeof recordingId === 'number' || !isNaN(Number(recordingId))) {
    const dbEntry = dbService.db.prepare("SELECT relative_path FROM recordings WHERE id = ?").get(recordingId);
    return dbEntry ? dbEntry.relative_path : recordingId.toString();
  }
  return recordingId;
}

// Obtener transcripción de una grabación específica
ipcMain.handle('get-transcription', async (event, recordingId) => {
  try {
    const folderName = await getFolderPathFromId(recordingId);
    const baseOutputDir = await getRecordingsPath();
    
    const transcriptionPath = path.join(
      baseOutputDir,
      folderName,
      'analysis',
      'transcripcion_combinada.json'
    );
    
    if (!fs.existsSync(transcriptionPath)) {
      return { success: false, error: 'Transcripción no encontrada' };
    }
    
    const transcriptionData = await fs.promises.readFile(transcriptionPath, 'utf8');
    const transcription = JSON.parse(transcriptionData);
    
    return { success: true, transcription };
  } catch (error) {
    console.error('Error getting transcription:', error);
    return { success: false, error: error.message };
  }
});

// Obtener transcripción de una grabación específica (texto plano)
ipcMain.handle('get-transcription-txt', async (event, recordingId) => {
  try {
    const folderName = await getFolderPathFromId(recordingId);
    const baseOutputDir = await getRecordingsPath();
    const txtPath = path.join(
      baseOutputDir,
      folderName,
      'analysis',
      'transcripcion_combinada.txt'
    );
    if (!fs.existsSync(txtPath)) {
      return { success: false, error: 'Archivo TXT no encontrado' };
    }
    const txtData = await fs.promises.readFile(txtPath, 'utf8');
    return { success: true, text: txtData };
  } catch (error) {
    console.error('Error leyendo TXT de transcripción:', error);
    return { success: false, error: error.message };
  }
});

// Eliminar una grabación completa (carpeta y contenido)
ipcMain.handle('delete-recording', async (event, recordingId) => {
  try {
    const folderName = await getFolderPathFromId(recordingId);
    const baseOutputDir = await getRecordingsPath();
    const recordingPath = path.join(baseOutputDir, folderName);
    
    if (!fs.existsSync(recordingPath)) {
      return { success: false, error: 'Grabación no encontrada' };
    }
    
    // Eliminar recursivamente toda la carpeta
    await fs.promises.rm(recordingPath, { recursive: true, force: true });
    
    // También eliminar de la base de datos si es necesario (migrationService se encargará en el próximo sync, pero mejor hacerlo ahora)
    dbService.deleteRecording(folderName);
    
    console.log(`Grabación eliminada: ${recordingPath}`);
    return { success: true, message: 'Grabación eliminada correctamente' };
  } catch (error) {
    console.error('Error deleting recording:', error);
    return { success: false, error: error.message };
  }
});

// Descargar grabación (abrir en finder/explorador)
ipcMain.handle('download-recording', async (event, recordingId) => {
  try {
    const folderName = await getFolderPathFromId(recordingId);
    const baseOutputDir = await getRecordingsPath();
    const recordingPath = path.join(baseOutputDir, folderName);
    
    if (!fs.existsSync(recordingPath)) {
      return { success: false, error: 'Grabación no encontrada' };
    }
    
    shell.openPath(recordingPath);
    return { success: true };
  } catch (error) {
    console.error('Error downloading recording:', error);
    return { success: false, error: error.message };
  }
});

// Guardar resumen IA
ipcMain.handle('save-ai-summary', async (event, recordingId, summary) => {
  try {
    const folderName = await getFolderPathFromId(recordingId);
    const baseOutputDir = await getRecordingsPath();
    const analysisDir = path.join(baseOutputDir, folderName, 'analysis');
    
    if (!fs.existsSync(analysisDir)) {
      fs.mkdirSync(analysisDir, { recursive: true });
    }
    
    const filePath = path.join(analysisDir, 'ai_summary.json');
    await fs.promises.writeFile(filePath, JSON.stringify(summary, null, 2), 'utf8');
    
    // Actualizar estado en DB a 'analyzed'
    dbService.updateStatus(folderName, 'analyzed');
    
    // Notificar al usuario
    notificationService.show(
      'Análisis IA Completado',
      `El análisis para "${folderName}" ha finalizado.`,
      { type: 'analysis-complete', recordingId: folderName }
    );

    return { success: true };
  } catch (error) {
    console.error('Error saving AI summary:', error);
    return { success: false, error: error.message };
  }
});

// Obtener resumen IA
ipcMain.handle('get-ai-summary', async (event, recordingId) => {
  try {
    const folderName = await getFolderPathFromId(recordingId);
    const baseOutputDir = await getRecordingsPath();
    
    // Intentar leer ai_summary.json o gemini_summary.json (retrocompatibilidad)
    let filePath = path.join(baseOutputDir, folderName, 'analysis', 'ai_summary.json');
    if (!fs.existsSync(filePath)) {
      filePath = path.join(baseOutputDir, folderName, 'analysis', 'gemini_summary.json');
    }
    
    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'Resumen no encontrado' };
    }
    
    const data = await fs.promises.readFile(filePath, 'utf8');
    return { success: true, summary: JSON.parse(data) };
  } catch (error) {
    console.error('Error getting AI summary:', error);
    return { success: false, error: error.message };
  }
});

// Guardar histórico de preguntas
ipcMain.handle('save-question-history', async (event, recordingId, qa) => {
  try {
    // recordingId es el nombre de la carpeta física (folderName)
    const folderName = recordingId;
    const baseOutputDir = await getRecordingsPath();
    const analysisDir = path.join(baseOutputDir, folderName, 'analysis');
    
    if (!fs.existsSync(analysisDir)) {
      fs.mkdirSync(analysisDir, { recursive: true });
    }
    
    const filePath = path.join(analysisDir, 'questions_history.json');
    let history = [];
    
    if (fs.existsSync(filePath)) {
      const data = await fs.promises.readFile(filePath, 'utf8');
      history = JSON.parse(data);
    }
    
    history.push({
      ...qa,
      timestamp: new Date().toISOString()
    });
    
    await fs.promises.writeFile(filePath, JSON.stringify(history, null, 2), 'utf8');
    return { success: true };
  } catch (error) {
    console.error('Error saving question history:', error);
    return { success: false, error: error.message };
  }
});

// Obtener histórico de preguntas
ipcMain.handle('get-question-history', async (event, recordingId) => {
  try {
    // recordingId es el nombre de la carpeta física (folderName)
    const folderName = recordingId;
    const baseOutputDir = await getRecordingsPath();
    const filePath = path.join(baseOutputDir, folderName, 'analysis', 'questions_history.json');
    
    console.log(`[Main] get-question-history: Leyendo de ${filePath} (ID: ${recordingId})`);

    if (!fs.existsSync(filePath)) {
      console.log(`[Main] get-question-history: Archivo no existe.`);
      return { success: true, history: [] };
    }
    
    const data = await fs.promises.readFile(filePath, 'utf8');
    const history = JSON.parse(data);
    console.log(`[Main] get-question-history: Leídos ${history.length} mensajes.`);
    return { success: true, history };
  } catch (error) {
    console.error('Error getting question history:', error);
    return { success: false, error: error.message };
  }
});

// Limpiar histórico de preguntas (Reset Chat)
ipcMain.handle('clear-question-history', async (event, recordingId) => {
  console.log(`[Main] clear-question-history: Solicitud recibida. ID: ${recordingId}`);
  try {
    // recordingId es el nombre de la carpeta física (folderName)
    const folderName = recordingId;
    const baseOutputDir = await getRecordingsPath();
    const analysisDir = path.join(baseOutputDir, folderName, 'analysis');
    const filePath = path.join(analysisDir, 'questions_history.json');
    
    console.log(`[Main] clear-question-history: Intentando limpiar ${filePath}`);
    
    // Asegurar que el directorio existe
    if (!fs.existsSync(analysisDir)) {
      console.log('[Main] clear-question-history: Directorio analysis no existe, creando...');
      fs.mkdirSync(analysisDir, { recursive: true });
    }

    // Sobreescribir con array vacío explícitamente
    await fs.promises.writeFile(filePath, '[]', 'utf8');
    
    // Verificar que se escribió bien
    const checkData = await fs.promises.readFile(filePath, 'utf8');
    console.log(`[Main] clear-question-history: Verificación post-escritura: contenido='${checkData}'`);
    
    return { success: true };
  } catch (error) {
    console.error('[Main] Error clearing question history:', error);
    return { success: false, error: error.message };
  }
});

// Guardar participantes
ipcMain.handle('save-participants', async (event, recordingId, participants) => {
  try {
    const folderName = await getFolderPathFromId(recordingId);
    const baseOutputDir = await getRecordingsPath();
    const analysisDir = path.join(baseOutputDir, folderName, 'analysis');
    
    if (!fs.existsSync(analysisDir)) {
      fs.mkdirSync(analysisDir, { recursive: true });
    }
    
    const filePath = path.join(analysisDir, 'participants.json');
    await fs.promises.writeFile(filePath, JSON.stringify(participants, null, 2), 'utf8');
    return { success: true };
  } catch (error) {
    console.error('Error saving participants:', error);
    return { success: false, error: error.message };
  }
});

// Obtener participantes
ipcMain.handle('get-participants', async (event, recordingId) => {
  try {
    const folderName = await getFolderPathFromId(recordingId);
    const baseOutputDir = await getRecordingsPath();
    const filePath = path.join(baseOutputDir, folderName, 'analysis', 'participants.json');
    
    if (!fs.existsSync(filePath)) {
      return { success: true, participants: [] };
    }
    
    const data = await fs.promises.readFile(filePath, 'utf8');
    return { success: true, participants: JSON.parse(data) };
  } catch (error) {
    console.error('Error getting participants:', error);
    return { success: false, error: error.message };
  }
});

// Obtener sugerencias de tareas
ipcMain.handle('get-task-suggestions', async (event, recordingId) => {
  try {
    const numericId = parseInt(recordingId, 10);
    if (isNaN(numericId)) return { success: false, error: 'ID inválido' };
    const tasks = dbService.getTaskSuggestions(numericId);
    return { success: true, tasks };
  } catch (error) {
    console.error('Error obteniendo sugerencias de tareas:', error);
    return { success: false, error: error.message };
  }
});

// Añadir sugerencia de tarea
ipcMain.handle('add-task-suggestion', async (event, recordingId, title, content, layer, createdByAi) => {
  try {
    const numericId = parseInt(recordingId, 10);
    if (isNaN(numericId)) return { success: false, error: 'ID inválido' };
    const task = dbService.addTaskSuggestion(numericId, title, content, layer || 'general', createdByAi !== false ? 1 : 0);
    return { success: true, task };
  } catch (error) {
    console.error('Error añadiendo sugerencia de tarea:', error);
    return { success: false, error: error.message };
  }
});

// Actualizar sugerencia de tarea
ipcMain.handle('update-task-suggestion', async (event, id, title, content, layer) => {
  try {
    const task = dbService.updateTaskSuggestion(id, title, content, layer || 'general');
    return { success: true, task };
  } catch (error) {
    console.error('Error actualizando sugerencia de tarea:', error);
    return { success: false, error: error.message };
  }
});

// Eliminar sugerencia de tarea
ipcMain.handle('delete-task-suggestion', async (event, id) => {
  try {
    dbService.deleteTaskSuggestion(id);
    return { success: true };
  } catch (error) {
    console.error('Error eliminando sugerencia de tarea:', error);
    return { success: false, error: error.message };
  }
});

// Renombrar grabación
ipcMain.handle('rename-recording', async (event, recordingId, newName) => {
  try {
    const folderName = await getFolderPathFromId(recordingId);
    const baseOutputDir = await getRecordingsPath();
    const oldPath = path.join(baseOutputDir, folderName);
    
    // Sanitizar el nuevo nombre para que sea válido como carpeta
    const safeNewName = newName.replace(/[^a-z0-9áéíóúñü \-_]/gi, '_').trim();
    const newPath = path.join(baseOutputDir, safeNewName);

    if (!fs.existsSync(oldPath)) {
      return { success: false, error: 'Grabación no encontrada' };
    }

    if (fs.existsSync(newPath) && oldPath !== newPath) {
      return { success: false, error: 'Ya existe una carpeta con ese nombre' };
    }

    // 1. Renombrar la carpeta física
    await fs.promises.rename(oldPath, newPath);
    console.log(`Carpeta renombrada: ${oldPath} -> ${newPath}`);

    // 2. Renombrar los archivos internos que usan el prefijo antiguo
    const files = await fs.promises.readdir(newPath);
    for (const file of files) {
      if (file.startsWith(folderName)) {
        const newFileName = file.replace(folderName, safeNewName);
        await fs.promises.rename(
          path.join(newPath, file),
          path.join(newPath, newFileName)
        );
      }
    }

    // 3. Actualizar la base de datos (relative_path)
    const dbEntry = dbService.getRecording(folderName);
    if (dbEntry) {
      dbService.db.prepare("UPDATE recordings SET relative_path = ? WHERE id = ?").run(safeNewName, dbEntry.id);
    }

    // 4. Guardar el customName en metadata.json por si acaso (aunque la carpeta ya tenga el nombre)
    const metadataPath = path.join(newPath, 'metadata.json');
    let metadata = {};
    if (fs.existsSync(metadataPath)) {
      try {
        metadata = JSON.parse(await fs.promises.readFile(metadataPath, 'utf8'));
      } catch (e) {}
    }
    metadata.customName = newName;
    await fs.promises.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');
    
    return { success: true, folderName: safeNewName };
  } catch (error) {
    console.error('Error renaming recording:', error);
    return { success: false, error: error.message };
  }
});

// Guardar estado de generación
ipcMain.handle('save-generating-state', async (event, recordingId, state) => {
  try {
    const folderName = await getFolderPathFromId(recordingId);
    const baseOutputDir = await getRecordingsPath();
    const statePath = path.join(
      baseOutputDir,
      folderName,
      'analysis',
      '.generating.json'
    );
    
    // Crear la carpeta analysis si no existe
    const analysisDir = path.dirname(statePath);
    if (!fs.existsSync(analysisDir)) {
      fs.mkdirSync(analysisDir, { recursive: true });
    }
    
    await fs.promises.writeFile(statePath, JSON.stringify(state, null, 2), 'utf8');
    console.log(`[AI] Estado de generación guardado: ${statePath}`);
    return { success: true };
  } catch (error) {
    console.error('Error guardando estado de generación:', error);
    return { success: false, error: error.message };
  }
});

// Obtener estado de generación
ipcMain.handle('get-generating-state', async (event, recordingId) => {
  try {
    const folderName = await getFolderPathFromId(recordingId);
    const baseOutputDir = await getRecordingsPath();
    const statePath = path.join(
      baseOutputDir,
      folderName,
      'analysis',
      '.generating.json'
    );
    
    if (!fs.existsSync(statePath)) {
      return { success: false, error: 'No existe estado de generación' };
    }
    
    const data = await fs.promises.readFile(statePath, 'utf8');
    return { success: true, state: JSON.parse(data) };
  } catch (error) {
    console.error('Error leyendo estado de generación:', error);
    return { success: false, error: error.message };
  }
});

// Limpiar estado de generación
ipcMain.handle('clear-generating-state', async (event, recordingId) => {
  try {
    const baseOutputDir = await getRecordingsPath();
    const statePath = path.join(
      baseOutputDir,
      recordingId,
      'analysis',
      '.generating.json'
    );
    
    if (fs.existsSync(statePath)) {
      await fs.promises.unlink(statePath);
      console.log(`[AI] Estado de generación eliminado: ${statePath}`);
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error eliminando estado de generación:', error);
    return { success: false, error: error.message };
  }
});

// Nuevos IPCs para Dashboard
ipcMain.handle('get-dashboard-stats', () => {
  const stats = dbService.getDashboardStats();
  console.log('[DEBUG] Stats requested:', stats);
  return stats;
});

// ========================================
// MANEJADORES DE PROYECTOS (SQLite)
// ========================================

// Obtener todos los proyectos
ipcMain.handle('get-projects', async () => {
  try {
    const projects = dbService.getAllProjects();
    return { success: true, projects };
  } catch (error) {
    console.error('Error obteniendo proyectos:', error);
    return { success: false, error: error.message };
  }
});

// Crear un nuevo proyecto
ipcMain.handle('create-project', async (event, projectData) => {
  try {
    const project = dbService.createProject(
      projectData.name, 
      projectData.description, 
      projectData.members || []
    );
    return { success: true, project };
  } catch (error) {
    console.error('Error creando proyecto:', error);
    return { success: false, error: error.message };
  }
});

// Actualizar un proyecto existente
ipcMain.handle('update-project', async (event, projectId, projectData) => {
  try {
    const project = dbService.updateProject(
      projectId,
      projectData.name,
      projectData.description,
      projectData.members
    );
    return { success: true, project };
  } catch (error) {
    console.error('Error actualizando proyecto:', error);
    return { success: false, error: error.message };
  }
});

// Eliminar un proyecto
ipcMain.handle('delete-project', async (event, projectId) => {
  try {
    dbService.deleteProject(projectId);
    return { success: true };
  } catch (error) {
    console.error('Error eliminando proyecto:', error);
    return { success: false, error: error.message };
  }
});

// Agregar una grabación a un proyecto
ipcMain.handle('add-recording-to-project', async (event, projectId, recordingId) => {
  try {
    dbService.addRecordingToProject(projectId, recordingId);
    return { success: true };
  } catch (error) {
    console.error('Error agregando grabación al proyecto:', error);
    return { success: false, error: error.message };
  }
});

// Eliminar una grabación de un proyecto
ipcMain.handle('remove-recording-from-project', async (event, projectId, recordingId) => {
  try {
    dbService.removeRecordingFromProject(projectId, recordingId);
    return { success: true };
  } catch (error) {
    console.error('Error eliminando grabación del proyecto:', error);
    return { success: false, error: error.message };
  }
});

// Obtener una grabación específica por ID
ipcMain.handle('get-recording-by-id', async (event, recordingId) => {
  try {
    const recording = dbService.getRecordingById(recordingId);
    if (!recording) {
      return { success: false, error: 'Grabación no encontrada' };
    }
    return { success: true, recording };
  } catch (error) {
    console.error('Error obteniendo grabación por ID:', error);
    return { success: false, error: error.message };
  }
});

// Obtener todas las grabaciones (IDs) de un proyecto
ipcMain.handle('get-project-recordings', async (event, projectId) => {
  try {
    const recordings = dbService.getProjectRecordingIds(projectId);
    return { success: true, recordings };
  } catch (error) {
    console.error('Error obteniendo grabaciones del proyecto:', error);
    return { success: false, error: error.message };
  }
});

// Obtener el proyecto de una grabación
ipcMain.handle('get-recording-project', async (event, recordingId) => {
  try {
    const project = dbService.getRecordingProject(recordingId);
    if (!project) {
      return { success: false, error: 'Sin proyecto' };
    }
    return { success: true, project };
  } catch (error) {
    console.error('Error obteniendo proyecto de la grabación:', error);
    return { success: false, error: error.message };
  }
});

// Obtener duración total de un proyecto
ipcMain.handle('get-project-total-duration', async (event, projectId) => {
  try {
    const duration = dbService.getProjectTotalDuration(projectId);
    return { success: true, duration };
  } catch (error) {
    console.error('Error obteniendo duración del proyecto:', error);
    return { success: false, error: error.message };
  }
});

// ========================================
// CHATS DE PROYECTO (SQLite)
// ========================================

ipcMain.handle('get-project-chats', async (event, projectId) => {
  try {
    const chats = dbService.getProjectChats(projectId);
    return { success: true, chats };
  } catch (error) {
    console.error('Error obteniendo chats del proyecto:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('create-project-chat', async (event, projectId, name, contextRecordings) => {
  try {
    const id = `chat_${Date.now()}`;
    const chat = dbService.createProjectChat(id, projectId, name, contextRecordings);
    return { success: true, chat };
  } catch (error) {
    console.error('Error creando chat del proyecto:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-project-chat', async (event, chatId) => {
  try {
    dbService.deleteProjectChat(chatId);
    return { success: true };
  } catch (error) {
    console.error('Error eliminando chat del proyecto:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-project-chat-history', async (event, chatId) => {
  try {
    const history = dbService.getChatMessages(chatId);
    return { success: true, history };
  } catch (error) {
    console.error('Error obteniendo historial del chat:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('save-project-chat-message', async (event, chatId, message) => {
  try {
    const savedMessage = dbService.saveProjectChatMessage(chatId, message.tipo, message.contenido);
    return { success: true, message: savedMessage };
  } catch (error) {
    console.error('Error guardando mensaje del chat:', error);
    return { success: false, error: error.message };
  }
});

// Guardar análisis de proyecto (mantiene ruta actual)
ipcMain.handle('save-project-analysis', async (event, projectId, analysis) => {
  try {
    const analysisDir = path.join(PROJECTS_PATH, 'projects_analysis');
    
    if (!fs.existsSync(analysisDir)) {
      fs.mkdirSync(analysisDir, { recursive: true });
    }
    
    const filePath = path.join(analysisDir, `${projectId}.json`);
    await fs.promises.writeFile(filePath, JSON.stringify(analysis, null, 2), 'utf8');
    
    // Marcar proyecto como actualizado en DB
    dbService.updateProjectSyncStatus(projectId, 1);
    
    console.log(`Análisis de proyecto guardado en: ${filePath}`);
    return { success: true };
  } catch (error) {
    console.error('Error guardando análisis de proyecto:', error);
    return { success: false, error: error.message };
  }
});

// Obtener análisis de proyecto
ipcMain.handle('get-project-analysis', async (event, projectId) => {
  try {
    const filePath = path.join(PROJECTS_PATH, 'projects_analysis', `${projectId}.json`);

    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'Análisis no encontrado' };
    }

    const data = await fs.promises.readFile(filePath, 'utf8');
    return { success: true, analysis: JSON.parse(data) };
  } catch (error) {
    console.error('Error leyendo análisis de proyecto:', error);
    return { success: false, error: error.message };
  }
});

// ===== RAG =====
const ragService = require('./ragService');

ipcMain.handle('index-recording', async (event, recordingId) => {
  try {
    const folderName = await getFolderPathFromId(recordingId);
    const baseOutputDir = await getRecordingsPath();
    const recordingPath = path.join(baseOutputDir, folderName);

    const result = await ragService.indexRecording(recordingPath);

    if (result.indexed) {
      dbService.updateRagStatus(folderName, 'indexed');
    } else if (result.error) {
      dbService.updateRagStatus(folderName, 'error');
    }

    return { success: true, ...result };
  } catch (error) {
    console.error('[RAG] Error indexando:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('search-recording', async (event, recordingId, query, topK) => {
  try {
    const folderName = await getFolderPathFromId(recordingId);
    const baseOutputDir = await getRecordingsPath();
    const recordingPath = path.join(baseOutputDir, folderName);

    const chunks = await ragService.searchRecording(recordingPath, query, topK || 5);
    return { success: true, chunks };
  } catch (error) {
    console.error('[RAG] Error buscando:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-rag-status', async (event, recordingId) => {
  try {
    const folderName = await getFolderPathFromId(recordingId);
    const baseOutputDir = await getRecordingsPath();
    const recordingPath = path.join(baseOutputDir, folderName);

    const status = await ragService.getStatus(recordingPath);
    const dbStatus = dbService.getRagStatus(folderName);

    return { success: true, ...status, dbStatus };
  } catch (error) {
    console.error('[RAG] Error obteniendo estado:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-rag-index', async (event, recordingId) => {
  try {
    const folderName = await getFolderPathFromId(recordingId);
    const baseOutputDir = await getRecordingsPath();
    const recordingPath = path.join(baseOutputDir, folderName);

    await ragService.deleteIndex(recordingPath);
    dbService.updateRagStatus(folderName, null);

    return { success: true };
  } catch (error) {
    console.error('[RAG] Error eliminando índice:', error);
    return { success: false, error: error.message };
  }
});
