const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  // Aquí expondremos funciones seguras para el frontend
});

contextBridge.exposeInMainWorld('electronAPI', {
  // ... existing exposed functions ...

  // Verificar permisos
  getMicrophonePermission: () => ipcRenderer.invoke('get-microphone-permission'),

  // Seleccionar directorio
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  getDefaultRecordingPath: () => ipcRenderer.invoke('get-default-recording-path'),

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
  saveSeparateAudio: (audioData, folderName, fileName, duration = 0) => ipcRenderer.invoke('save-separate-audio', audioData, folderName, fileName, duration),

  // NUEVAS FUNCIONES para gestión de grabaciones
  // Obtener todas las carpetas de grabación
  getRecordingFolders: () => ipcRenderer.invoke('get-recording-folders'),
  getRecording: (relativePath) => ipcRenderer.invoke('get-recording', relativePath),
  getRecordingById: (id) => ipcRenderer.invoke('get-recording-by-id', id),
  deleteRecording: (recordingId) => ipcRenderer.invoke('delete-recording', recordingId),
  
  // Renombrar una grabación
  renameRecording: (recordingId, newName) => ipcRenderer.invoke('rename-recording', recordingId, newName),
  
  // Descargar/exportar una grabación
  downloadRecording: (recordingId) => ipcRenderer.invoke('download-recording', recordingId),

  // Lanzar transcripción de una grabación
  transcribeRecording: (recordingId, model) => ipcRenderer.invoke('transcribe-recording', recordingId, model),

  // Cola de transcripción
  getTranscriptionQueue: () => ipcRenderer.invoke('get-transcription-queue'),
  cancelTranscriptionTask: (recordingId) => ipcRenderer.invoke('cancel-transcription-task', recordingId),
  getRecordingQueueStatus: (recordingId) => ipcRenderer.invoke('get-recording-queue-status', recordingId),

  // Obtener transcripción de una grabación específica (JSON)
  getTranscription: (recordingId) => ipcRenderer.invoke('get-transcription', recordingId),

  // Obtener transcripción en texto plano de una grabación específica
  getTranscriptionTxt: (recordingId) => ipcRenderer.invoke('get-transcription-txt', recordingId),

  // Guardar y leer resumen de Gemini
  saveAiSummary: (recordingId, summaryJson) => ipcRenderer.invoke('save-ai-summary', recordingId, summaryJson),
  getAiSummary: (recordingId) => ipcRenderer.invoke('get-ai-summary', recordingId),
  // Guardar y leer histórico de preguntas
  saveQuestionHistory: (recordingId, qa) => ipcRenderer.invoke('save-question-history', recordingId, qa),
  getQuestionHistory: (recordingId) => ipcRenderer.invoke('get-question-history', recordingId),
  clearQuestionHistory: (recordingId) => ipcRenderer.invoke('clear-question-history', recordingId),
  // Guardar y leer participantes
  saveParticipants: (recordingId, participants) => ipcRenderer.invoke('save-participants', recordingId, participants),
  getParticipants: (recordingId) => ipcRenderer.invoke('get-participants', recordingId),
  getTaskSuggestions: (recordingId) => ipcRenderer.invoke('get-task-suggestions', recordingId),
  addTaskSuggestion: (recordingId, title, content, layer, createdByAi) => ipcRenderer.invoke('add-task-suggestion', recordingId, title, content, layer, createdByAi),
  updateTaskSuggestion: (id, title, content, layer) => ipcRenderer.invoke('update-task-suggestion', id, title, content, layer),
  deleteTaskSuggestion: (id) => ipcRenderer.invoke('delete-task-suggestion', id),

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

  // CHATS DE PROYECTO
  getProjectChats: (projectId) => ipcRenderer.invoke('get-project-chats', projectId),
  createProjectChat: (projectId, name, contextRecordings) => ipcRenderer.invoke('create-project-chat', projectId, name, contextRecordings),
  deleteProjectChat: (chatId) => ipcRenderer.invoke('delete-project-chat', chatId),
  getProjectChatHistory: (chatId) => ipcRenderer.invoke('get-project-chat-history', chatId),
  saveProjectChatMessage: (chatId, message) => ipcRenderer.invoke('save-project-chat-message', chatId, message),

  // Obtener duración total del proyecto
  getProjectTotalDuration: (projectId) => ipcRenderer.invoke('get-project-total-duration', projectId),

  // Guardar y leer análisis de proyecto
  saveProjectAnalysis: (projectId, analysis) => ipcRenderer.invoke('save-project-analysis', projectId, analysis),
  getProjectAnalysis: (projectId) => ipcRenderer.invoke('get-project-analysis', projectId),

  // Gestión de estado de generación de IA
  saveGeneratingState: (recordingId, state) => ipcRenderer.invoke('save-generating-state', recordingId, state),
  getGeneratingState: (recordingId) => ipcRenderer.invoke('get-generating-state', recordingId),
  clearGeneratingState: (recordingId) => ipcRenderer.invoke('clear-generating-state', recordingId),
  
  // Eventos de progreso
  onTranscriptionProgress: (callback) => ipcRenderer.on('transcription-progress', (_event, value) => callback(value)),
  offTranscriptionProgress: () => ipcRenderer.removeAllListeners('transcription-progress'),
  
  onQueueUpdate: (callback) => ipcRenderer.on('queue-update', (_event, value) => callback(value)),
  offQueueUpdate: () => ipcRenderer.removeAllListeners('queue-update'),

  // Notificaciones
  onNotificationClick: (callback) => ipcRenderer.on('notification-click', (_event, value) => callback(value)),
  offNotificationClick: () => ipcRenderer.removeAllListeners('notification-click'),

  // Dashboard
  getDashboardStats: () => ipcRenderer.invoke('get-dashboard-stats'),
}); 