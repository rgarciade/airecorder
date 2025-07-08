/* global require, process, __dirname */
const { app, BrowserWindow, ipcMain, systemPreferences, desktopCapturer, session } = require('electron');
const path = require('path');
const fs = require('fs');
const AudioRecorder = require('./audioRecorder');

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