/* global require, process, __dirname */
const { app, BrowserWindow, ipcMain, systemPreferences, desktopCapturer, session } = require('electron');
const path = require('path');
const fs = require('fs');
const AudioRecorder = require('./audioRecorder');
const { spawn } = require('child_process');

// Estado global para evitar transcripciones simultáneas
let isTranscribing = false;
let currentTranscribingId = null;

// Verificar permisos de micrófono al inicio
function checkMicrophonePermission() {
  if (process.platform === 'darwin') {
    const status = systemPreferences.getMediaAccessStatus('microphone');
    console.log('Estado de permisos del micrófono:', status);
    
    if (status !== 'granted') {
      systemPreferences.askForMediaAccess('microphone')
        .then(granted => {
          console.log('Permiso de micrófono concedido:', granted);
          if (!granted) {
            console.error('El usuario denegó el acceso al micrófono');
          }
        })
        .catch(error => {
          console.error('Error al solicitar permisos de micrófono:', error);
        });
    }
  }
}

function createWindow() {
  // Verificar permisos antes de crear la ventana
  checkMicrophonePermission();

  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      allowRunningInsecureContent: true,
      experimentalFeatures: true
    }
  });

  // Configurar el handler para captura de pantalla/audio según la documentación oficial
  session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    desktopCapturer.getSources({ types: ['screen', 'window'] }).then((sources) => {
      // Priorizar pantalla completa para mejor captura de audio
      const screenSource = sources.find(source => source.id.includes('screen:'));
      const selectedSource = screenSource || sources[0];
      
      if (selectedSource) {
        console.log('Concediendo acceso a fuente:', selectedSource.name);
        // Según la documentación: conceder acceso a video y audio con 'loopback'
        callback({ 
          video: selectedSource, 
          audio: 'loopback' // Esto habilita la captura de audio del sistema
        });
      } else {
        console.log('No se encontraron fuentes disponibles');
        callback({});
      }
    }).catch(error => {
      console.error('Error obteniendo fuentes:', error);
      callback({});
    });
  }, { 
    useSystemPicker: false // Usar nuestro selector automático
  });

  // En desarrollo, carga la URL de desarrollo de Vite
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    // Abre las DevTools automáticamente
    mainWindow.webContents.openDevTools();
  } else {
    // En producción, carga el archivo HTML construido
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// Ruta del archivo de configuración
const settingsPath = path.join(app.getPath('userData'), 'settings.json');

// Manejador para guardar configuración
ipcMain.handle('save-settings', async (event, settings) => {
  try {
    await fs.promises.writeFile(settingsPath, JSON.stringify(settings, null, 2));
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
    audioRecorder.stopRecording();
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
    const outputDir = '/Users/raul.garciad/Desktop/recorder';
    
    // Crear el directorio si no existe
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const filePath = path.join(outputDir, fileName);
    
    // Convertir Uint8Array a Buffer y guardar
    const buffer = Buffer.from(audioData);
    await fs.promises.writeFile(filePath, buffer);
    
    console.log(`Audio del sistema guardado en: ${filePath}`);
    return { success: true, filePath, message: `Archivo guardado en ${filePath}` };
  } catch (error) {
    console.error('Error saving system audio:', error);
    return { success: false, error: error.message };
  }
});

// Manejador para guardar audios por separado en carpetas
ipcMain.handle('save-separate-audio', async (event, audioData, folderName, fileName) => {
  try {
    const baseOutputDir = '/Users/raul.garciad/Desktop/recorder';
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
    
    console.log(`Audio separado guardado en: ${filePath}`);
    return { success: true, filePath, folderPath: recordingDir, message: `Archivo guardado en ${filePath}` };
  } catch (error) {
    console.error('Error saving separate audio:', error);
    return { success: false, error: error.message };
  }
});

// NUEVOS HANDLERS para gestión de grabaciones

// Obtener todas las carpetas de grabación con metadata
ipcMain.handle('get-recording-folders', async () => {
  try {
    const baseOutputDir = '/Users/raul.garciad/Desktop/recorder';
    
    if (!fs.existsSync(baseOutputDir)) {
      return { success: true, folders: [] };
    }
    
    const items = await fs.promises.readdir(baseOutputDir);
    const folders = [];
    
    for (const item of items) {
      const itemPath = path.join(baseOutputDir, item);
      const stats = await fs.promises.stat(itemPath);
      
      if (stats.isDirectory()) {
        // Verificar si tiene archivos de audio
        const folderContents = await fs.promises.readdir(itemPath);
        const audioFiles = folderContents.filter(file => 
          file.endsWith('.webm') || file.endsWith('.wav') || file.endsWith('.mp3')
        );
        
        // Verificar si tiene análisis (carpeta analysis con transcripción)
        const analysisPath = path.join(itemPath, 'analysis');
        const hasAnalysis = fs.existsSync(analysisPath) && 
          fs.existsSync(path.join(analysisPath, 'transcripcion_combinada.json'));
        
        if (audioFiles.length > 0) {
          folders.push({
            name: item,
            path: itemPath,
            createdAt: stats.birthtime.toISOString(),
            modifiedAt: stats.mtime.toISOString(),
            files: audioFiles,
            hasAnalysis: hasAnalysis
          });
        }
      }
    }
    
    // Ordenar por fecha de creación (más recientes primero)
    folders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    return { success: true, folders };
  } catch (error) {
    console.error('Error getting recording folders:', error);
    return { success: false, error: error.message };
  }
});

// Obtener transcripción de una grabación específica
ipcMain.handle('get-transcription', async (event, recordingId) => {
  try {
    const transcriptionPath = path.join(
      '/Users/raul.garciad/Desktop/recorder',
      recordingId,
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

// Eliminar una grabación completa (carpeta y contenido)
ipcMain.handle('delete-recording', async (event, recordingId) => {
  try {
    const recordingPath = path.join('/Users/raul.garciad/Desktop/recorder', recordingId);
    
    if (!fs.existsSync(recordingPath)) {
      return { success: false, error: 'Grabación no encontrada' };
    }
    
    // Eliminar recursivamente toda la carpeta
    await fs.promises.rm(recordingPath, { recursive: true, force: true });
    
    console.log(`Grabación eliminada: ${recordingPath}`);
    return { success: true, message: 'Grabación eliminada correctamente' };
  } catch (error) {
    console.error('Error deleting recording:', error);
    return { success: false, error: error.message };
  }
});

// Descargar/exportar una grabación (abrir en Finder)
ipcMain.handle('download-recording', async (event, recordingId) => {
  try {
    const recordingPath = path.join('/Users/raul.garciad/Desktop/recorder', recordingId);
    
    if (!fs.existsSync(recordingPath)) {
      return { success: false, error: 'Grabación no encontrada' };
    }
    
    // En macOS, abrir la carpeta en Finder
    const { shell } = require('electron');
    await shell.openPath(recordingPath);
    
    console.log(`Abriendo carpeta en Finder: ${recordingPath}`);
    return { success: true, message: 'Carpeta abierta en Finder' };
  } catch (error) {
    console.error('Error opening recording folder:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('transcribe-recording', async (event, recordingId) => {
  if (isTranscribing) {
    return { success: false, error: 'Ya hay una transcripción en curso', inProgress: true, currentTranscribingId };
  }
  isTranscribing = true;
  currentTranscribingId = recordingId;
  try {
    const scriptPath = path.join(__dirname, '../audio_sync_analyzer.py');
    // Usa el Python del entorno virtual
    const pythonPath = '/Users/raul.garciad/Proyectos/personal/airecorder/venv/bin/python';

    await new Promise((resolve, reject) => {
      const py = spawn(
        pythonPath,
        [
          scriptPath,
          '--basename', recordingId
        ]
      );
      py.stdout.on('data', (data) => {
        console.log(`[Transcripción][stdout]: ${data}`);
      });
      py.stderr.on('data', (data) => {
        console.error(`[Transcripción][stderr]: ${data}`);
      });
      py.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error('El script terminó con código ' + code));
      });
    });
    isTranscribing = false;
    currentTranscribingId = null;
    return { success: true };
  } catch (error) {
    isTranscribing = false;
    currentTranscribingId = null;
    return { success: false, error: error.message };
  }
});