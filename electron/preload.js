const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  // Aquí expondremos funciones seguras para el frontend
});

contextBridge.exposeInMainWorld('electronAPI', {
  // ... existing exposed functions ...

  // Funciones para la configuración
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  loadSettings: () => ipcRenderer.invoke('load-settings'),
  
  // Funciones para grabación de audio
  getAudioDevices: () => ipcRenderer.invoke('get-audio-devices'),
  startTestRecording: (microphoneId, duration) => ipcRenderer.invoke('start-test-recording', microphoneId, duration),
  stopRecording: () => ipcRenderer.invoke('stop-recording'),
  getRecordingFiles: () => ipcRenderer.invoke('get-recording-files'),
  
  // Función para obtener fuentes de escritorio (audio del sistema)
  getDesktopSources: () => ipcRenderer.invoke('get-desktop-sources'),
  
  // Nueva función para guardar audio del sistema
  saveSystemAudio: (audioData, fileName) => ipcRenderer.invoke('save-system-audio', audioData, fileName),
  
  // Nueva función para guardar audios por separado en carpetas
  saveSeparateAudio: (audioData, folderName, fileName) => ipcRenderer.invoke('save-separate-audio', audioData, folderName, fileName),

  // NUEVAS FUNCIONES para gestión de grabaciones
  // Obtener todas las carpetas de grabación
  getRecordingFolders: () => ipcRenderer.invoke('get-recording-folders'),
  
  // Obtener transcripción de una grabación específica
  getTranscription: (recordingId) => ipcRenderer.invoke('get-transcription', recordingId),
  
  // Eliminar una grabación completa
  deleteRecording: (recordingId) => ipcRenderer.invoke('delete-recording', recordingId),
  
  // Descargar/exportar una grabación
  downloadRecording: (recordingId) => ipcRenderer.invoke('download-recording', recordingId),

  // Lanzar transcripción de una grabación
  transcribeRecording: (recordingId) => ipcRenderer.invoke('transcribe-recording', recordingId),
}); 