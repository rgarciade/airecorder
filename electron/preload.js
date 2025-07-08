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
}); 