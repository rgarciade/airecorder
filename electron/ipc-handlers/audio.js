const { ipcMain, systemPreferences, desktopCapturer } = require('electron');
const fs = require('fs');
const path = require('path');
const dbService = require('../database/dbService');
const { getRecordingsPath } = require('../utils/paths');
const AudioRecorder = require('../services/audioRecorder');

const audioRecorder = new AudioRecorder();

module.exports.registerAudioHandlers = () => {
  
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

};