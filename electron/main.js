/* global require, process, __dirname */
const { app, BrowserWindow, ipcMain, systemPreferences, desktopCapturer, session } = require('electron');
const path = require('path');
const fs = require('fs');
const AudioRecorder = require('./audioRecorder');
const { spawn } = require('child_process');
const ProjectsDatabase = require('./projectsDatabase');

// Constantes de rutas base
const BASE_RECORDER_PATH = '/Users/raul.garciad/Desktop/recorder';
const RECORDINGS_PATH = path.join(BASE_RECORDER_PATH, 'grabaciones');
const PROJECTS_PATH = path.join(BASE_RECORDER_PATH, 'projects');

// Estado global para evitar transcripciones simultáneas
let isTranscribing = false;
let currentTranscribingId = null;

// Verificar permisos de micrófono al inicio
function checkMicrophonePermission() {
  if (process.platform === 'darwin') {
    const micStatus = systemPreferences.getMediaAccessStatus('microphone');
    console.log('Estado de permisos del micrófono:', micStatus);
    
    const screenStatus = systemPreferences.getMediaAccessStatus('screen');
    console.log('Estado de permisos de grabación de pantalla:', screenStatus);
    
    if (micStatus !== 'granted') {
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
    const outputDir = RECORDINGS_PATH;
    
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
    const baseOutputDir = RECORDINGS_PATH;
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
    const baseOutputDir = RECORDINGS_PATH;
    
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
      RECORDINGS_PATH,
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

// Obtener transcripción de una grabación específica (texto plano)
ipcMain.handle('get-transcription-txt', async (event, recordingId) => {
  try {
    const txtPath = path.join(
      RECORDINGS_PATH,
      recordingId,
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
    const recordingPath = path.join(RECORDINGS_PATH, recordingId);
    
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

// Renombrar una grabación (carpeta y sus archivos)
ipcMain.handle('rename-recording', async (event, recordingId, newName) => {
  try {
    const oldPath = path.join(RECORDINGS_PATH, recordingId);
    // Sanitize new name to be safe for filesystem
    const safeNewName = newName.replace(/[^a-z0-9áéíóúñü \-_]/gi, '_').trim();
    const newPath = path.join(RECORDINGS_PATH, safeNewName);

    if (!fs.existsSync(oldPath)) {
      return { success: false, error: 'Grabación no encontrada' };
    }
    if (fs.existsSync(newPath) && oldPath !== newPath) {
      return { success: false, error: 'Ya existe una grabación con ese nombre' };
    }

    // 1. Leer archivos antes de renombrar la carpeta
    const files = await fs.promises.readdir(oldPath);

    // 2. Renombrar la carpeta
    await fs.promises.rename(oldPath, newPath);
    console.log(`Grabación renombrada (carpeta): ${oldPath} -> ${newPath}`);

    // 3. Renombrar archivos internos que coincidan con el patrón {id}-*
    for (const file of files) {
      if (file.startsWith(recordingId)) {
        // Reemplaza solo la primera ocurrencia (el prefijo)
        const newFileName = file.replace(recordingId, safeNewName);
        const oldFilePath = path.join(newPath, file);
        const newFilePath = path.join(newPath, newFileName);
        
        try {
          if (fs.existsSync(oldFilePath)) {
            await fs.promises.rename(oldFilePath, newFilePath);
            console.log(`Archivo renombrado: ${file} -> ${newFileName}`);
          }
        } catch (err) {
          console.error(`Error renombrando archivo interno ${file}:`, err);
        }
      }
    }

    return { success: true, newId: safeNewName };
  } catch (error) {
    console.error('Error renaming recording:', error);
    return { success: false, error: error.message };
  }
});

// Descargar/exportar una grabación (abrir en Finder)
ipcMain.handle('download-recording', async (event, recordingId) => {
  try {
    const recordingPath = path.join(RECORDINGS_PATH, recordingId);
    
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
  debugger;
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
        const message = data.toString().trim();
        console.log(`[Transcripción][stdout]: ${message}`);
        // Enviar progreso al frontend
        event.sender.send('transcription-progress', { recordingId, message });
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

// Guardar resumen de Gemini
ipcMain.handle('save-ai-summary', async (event, recordingId, summaryJson) => {
  try {
    const summaryPath = path.join(
      RECORDINGS_PATH,
      recordingId,
      'analysis',
      'ai_summary.json'
    );
    
    // Crear la carpeta analysis si no existe
    const analysisDir = path.dirname(summaryPath);
    if (!fs.existsSync(analysisDir)) {
      fs.mkdirSync(analysisDir, { recursive: true });
    }
    await fs.promises.writeFile(summaryPath, JSON.stringify(summaryJson, null, 2), 'utf8');
    console.log(`[Gemini] Resumen guardado en: ${summaryPath}`);
    return { success: true };
  } catch (error) {
    console.error('Error guardando resumen Gemini:', error);
    return { success: false, error: error.message };
  }
});
// Leer resumen de Gemini
ipcMain.handle('get-ai-summary', async (event, recordingId) => {
  try {
    const summaryPath = path.join(
      RECORDINGS_PATH,
      recordingId,
      'analysis',
      'gemini_summary.json'
    );
    if (!fs.existsSync(summaryPath)) {
      // para preserva los antiguos archivos gemini_summary.json
      const altSummaryPath = path.join(
        RECORDINGS_PATH,
        recordingId,
        'analysis',
        'ai_summary.json'
      );
      if (!fs.existsSync(altSummaryPath)) {
        return { success: false, error: 'No existe resumen' };
      }
      const data = await fs.promises.readFile(altSummaryPath, 'utf8');
      return { success: true, summary: JSON.parse(data) };
    }
    const data = await fs.promises.readFile(summaryPath, 'utf8');
    return { success: true, summary: JSON.parse(data) };
  } catch (error) {
    console.error('Error leyendo resumen Gemini:', error);
    return { success: false, error: error.message };
  }
});

// Guardar estado de generación
ipcMain.handle('save-generating-state', async (event, recordingId, state) => {
  try {
    const statePath = path.join(
      RECORDINGS_PATH,
      recordingId,
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
    const statePath = path.join(
      RECORDINGS_PATH,
      recordingId,
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
    const statePath = path.join(
      RECORDINGS_PATH,
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

// Guardar pregunta/respuesta en el histórico
ipcMain.handle('save-question-history', async (event, recordingId, qa) => {
  try {
    const historyPath = path.join(
      RECORDINGS_PATH,
      recordingId,
      'analysis',
      'questions_history.json'
    );
    // Crear la carpeta analysis si no existe
    const analysisDir = path.dirname(historyPath);
    if (!fs.existsSync(analysisDir)) {
      fs.mkdirSync(analysisDir, { recursive: true });
    }
    let history = [];
    if (fs.existsSync(historyPath)) {
      const data = await fs.promises.readFile(historyPath, 'utf8');
      history = JSON.parse(data);
    }
    history.push(qa);
    await fs.promises.writeFile(historyPath, JSON.stringify(history, null, 2), 'utf8');
    console.log(`[Gemini] Pregunta/Respuesta guardada en: ${historyPath}`);
    return { success: true };
  } catch (error) {
    console.error('Error guardando histórico de preguntas:', error);
    return { success: false, error: error.message };
  }
});
// Leer histórico de preguntas
ipcMain.handle('get-question-history', async (event, recordingId) => {
  try {
    const historyPath = path.join(
      RECORDINGS_PATH,
      recordingId,
      'analysis',
      'questions_history.json'
    );
    if (!fs.existsSync(historyPath)) {
      return { success: true, history: [] };
    }
    const data = await fs.promises.readFile(historyPath, 'utf8');
    return { success: true, history: JSON.parse(data) };
  } catch (error) {
    console.error('Error leyendo histórico de preguntas:', error);
    return { success: false, error: error.message };
  }
});

// Guardar participantes
ipcMain.handle('save-participants', async (event, recordingId, participants) => {
  try {
    const participantsPath = path.join(
      RECORDINGS_PATH,
      recordingId,
      'analysis',
      'participants.json'
    );
    // Crear la carpeta analysis si no existe
    const analysisDir = path.dirname(participantsPath);
    if (!fs.existsSync(analysisDir)) {
      fs.mkdirSync(analysisDir, { recursive: true });
    }
    await fs.promises.writeFile(participantsPath, JSON.stringify(participants, null, 2), 'utf8');
    console.log(`[Meeting] Participantes guardados en: ${participantsPath}`);
    return { success: true };
  } catch (error) {
    console.error('Error guardando participantes:', error);
    return { success: false, error: error.message };
  }
});
// Leer participantes
ipcMain.handle('get-participants', async (event, recordingId) => {
  try {
    const participantsPath = path.join(
      RECORDINGS_PATH,
      recordingId,
      'analysis',
      'participants.json'
    );
    if (!fs.existsSync(participantsPath)) {
      return { success: true, participants: [] };
    }
    const data = await fs.promises.readFile(participantsPath, 'utf8');
    return { success: true, participants: JSON.parse(data) };
  } catch (error) {
    console.error('Error leyendo participantes:', error);
    return { success: false, error: error.message };
  }
});

// ========================================
// MANEJADORES DE PROYECTOS
// ========================================

// Obtener todos los proyectos
ipcMain.handle('get-projects', async () => {
  try {
    const projects = await ProjectsDatabase.projects.getAll();
    return { success: true, projects };
  } catch (error) {
    console.error('Error obteniendo proyectos:', error);
    return { success: false, error: error.message };
  }
});

// Crear un nuevo proyecto
ipcMain.handle('create-project', async (event, projectData) => {
  try {
    const project = await ProjectsDatabase.projects.create(projectData);
    console.log(`Proyecto creado: ${project.name} (${project.id})`);
    return { success: true, project };
  } catch (error) {
    console.error('Error creando proyecto:', error);
    return { success: false, error: error.message };
  }
});

// Actualizar un proyecto existente
ipcMain.handle('update-project', async (event, projectId, projectData) => {
  try {
    const project = await ProjectsDatabase.projects.update(projectId, projectData);
    console.log(`Proyecto actualizado: ${project.name} (${projectId})`);
    return { success: true, project };
  } catch (error) {
    console.error('Error actualizando proyecto:', error);
    return { success: false, error: error.message };
  }
});

// Eliminar un proyecto
ipcMain.handle('delete-project', async (event, projectId) => {
  try {
    await ProjectsDatabase.deleteProjectWithRelations(projectId);
    console.log(`Proyecto eliminado: ${projectId}`);
    return { success: true };
  } catch (error) {
    console.error('Error eliminando proyecto:', error);
    return { success: false, error: error.message };
  }
});

// Agregar una grabación a un proyecto
ipcMain.handle('add-recording-to-project', async (event, projectId, recordingId) => {
  try {
    const { wasReassigned, previousProject } = await ProjectsDatabase.relations.upsert(
      projectId,
      recordingId
    );
    
    console.log(`Grabación ${recordingId} agregada al proyecto ${projectId}`);
    return { success: true, wasReassigned, previousProject };
  } catch (error) {
    console.error('Error agregando grabación al proyecto:', error);
    return { success: false, error: error.message };
  }
});

// Eliminar una grabación de un proyecto
ipcMain.handle('remove-recording-from-project', async (event, projectId, recordingId) => {
  try {
    await ProjectsDatabase.relations.delete(recordingId);
    console.log(`Grabación ${recordingId} eliminada del proyecto ${projectId}`);
    return { success: true };
  } catch (error) {
    console.error('Error eliminando grabación del proyecto:', error);
    return { success: false, error: error.message };
  }
});

// Obtener todas las grabaciones de un proyecto
ipcMain.handle('get-project-recordings', async (event, projectId) => {
  try {
    const recordings = await ProjectsDatabase.relations.getRecordingIds(projectId);
    return { success: true, recordings };
  } catch (error) {
    console.error('Error obteniendo grabaciones del proyecto:', error);
    return { success: false, error: error.message };
  }
});

// Obtener el proyecto de una grabación
ipcMain.handle('get-recording-project', async (event, recordingId) => {
  try {
    const project = await ProjectsDatabase.getRecordingProject(recordingId);
    
    if (!project) {
      return { success: false, error: 'Grabación no pertenece a ningún proyecto' };
    }
    
    return { success: true, project };
  } catch (error) {
    console.error('Error obteniendo proyecto de la grabación:', error);
    return { success: false, error: error.message };
  }
});

// Guardar análisis de proyecto
ipcMain.handle('save-project-analysis', async (event, projectId, analysis) => {
  try {
    const analysisDir = path.join(PROJECTS_PATH, 'projects_analysis');
    
    if (!fs.existsSync(analysisDir)) {
      fs.mkdirSync(analysisDir, { recursive: true });
    }
    
    const filePath = path.join(analysisDir, `${projectId}.json`);
    await fs.promises.writeFile(filePath, JSON.stringify(analysis, null, 2), 'utf8');
    
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