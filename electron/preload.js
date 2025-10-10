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

  // Obtener transcripción en texto plano de una grabación específica
  getTranscriptionTxt: (recordingId) => ipcRenderer.invoke('get-transcription-txt', recordingId),

  // Guardar y leer resumen de Gemini
  saveGeminiSummary: (recordingId, summaryJson) => ipcRenderer.invoke('save-gemini-summary', recordingId, summaryJson),
  getGeminiSummary: (recordingId) => ipcRenderer.invoke('get-gemini-summary', recordingId),
  // Guardar y leer histórico de preguntas
  saveQuestionHistory: (recordingId, qa) => ipcRenderer.invoke('save-question-history', recordingId, qa),
  getQuestionHistory: (recordingId) => ipcRenderer.invoke('get-question-history', recordingId),
  // Guardar y leer participantes
  saveParticipants: (recordingId, participants) => ipcRenderer.invoke('save-participants', recordingId, participants),
  getParticipants: (recordingId) => ipcRenderer.invoke('get-participants', recordingId),

  // FUNCIONES DE PROYECTOS
  // Obtener todos los proyectos
  getProjects: () => ipcRenderer.invoke('get-projects'),
  
  // Crear un nuevo proyecto
  createProject: (projectData) => ipcRenderer.invoke('create-project', projectData),
  
  // Actualizar un proyecto existente
  updateProject: (projectId, projectData) => ipcRenderer.invoke('update-project', projectId, projectData),
  
  // Eliminar un proyecto
  deleteProject: (projectId) => ipcRenderer.invoke('delete-project', projectId),
  
  // Agregar una grabación a un proyecto
  addRecordingToProject: (projectId, recordingId) => ipcRenderer.invoke('add-recording-to-project', projectId, recordingId),
  
  // Eliminar una grabación de un proyecto
  removeRecordingFromProject: (projectId, recordingId) => ipcRenderer.invoke('remove-recording-from-project', projectId, recordingId),
  
  // Obtener todas las grabaciones de un proyecto
  getProjectRecordings: (projectId) => ipcRenderer.invoke('get-project-recordings', projectId),
  
  // Obtener el proyecto de una grabación
  getRecordingProject: (recordingId) => ipcRenderer.invoke('get-recording-project', recordingId),
}); 