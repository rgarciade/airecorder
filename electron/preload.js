const { contextBridge, ipcRenderer } = require('electron');

// Para Sentry en el preload script no se llama a init(), solo se importa
require('@sentry/electron/preload');

contextBridge.exposeInMainWorld('electronAPI', {
  // ... existing exposed functions ...

  // Verificar permisos
  getMicrophonePermission: () => ipcRenderer.invoke('get-microphone-permission'),
  openMicrophonePreferences: () => ipcRenderer.invoke('open-microphone-preferences'),

  // Seleccionar directorio
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  getDefaultRecordingPath: () => ipcRenderer.invoke('get-default-recording-path'),

  // Funciones para la configuración
  getSystemInfo: () => ipcRenderer.invoke('get-system-info'),
  getSystemLanguage: () => ipcRenderer.invoke('get-system-language'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  loadSettings: () => ipcRenderer.invoke('load-settings'),
  
  // Funciones para grabación de audio
  getAudioDevices: () => ipcRenderer.invoke('get-audio-devices'),
  startTestRecording: (microphoneId, duration) => ipcRenderer.invoke('start-test-recording', microphoneId, duration),
  stopRecording: () => ipcRenderer.invoke('stop-recording'),
  getRecordingFiles: () => ipcRenderer.invoke('get-recording-files'),
  
  // Función para obtener fuentes de escritorio (audio del sistema)
  getDesktopSources: () => ipcRenderer.invoke('get-desktop-sources'),

  // Audio loopback (electron-audio-loopback) - captura audio del sistema sin permiso de Screen Recording
  enableLoopbackAudio: () => ipcRenderer.invoke('enable-loopback-audio'),
  disableLoopbackAudio: () => ipcRenderer.invoke('disable-loopback-audio'),

  // DevTools (abrir/cerrar desde Settings)
  toggleDevTools: () => ipcRenderer.invoke('toggle-devtools'),
  
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
  updateLastQuestionHistory: (recordingId, qa) => ipcRenderer.invoke('update-last-question-history', recordingId, qa),
  getQuestionHistory: (recordingId) => ipcRenderer.invoke('get-question-history', recordingId),
  clearQuestionHistory: (recordingId) => ipcRenderer.invoke('clear-question-history', recordingId),
  // Guardar y leer participantes
  saveParticipants: (recordingId, participants) => ipcRenderer.invoke('save-participants', recordingId, participants),
  getParticipants: (recordingId) => ipcRenderer.invoke('get-participants', recordingId),
  getTaskSuggestions: (recordingId) => ipcRenderer.invoke('get-task-suggestions', recordingId),
  getProjectTaskSuggestions: (projectId) => ipcRenderer.invoke('get-project-task-suggestions', projectId),
  addTaskSuggestion: (recordingId, title, content, layer, createdByAi) => ipcRenderer.invoke('add-task-suggestion', recordingId, title, content, layer, createdByAi),
  updateTaskSuggestion: (id, title, content, layer, status) => ipcRenderer.invoke('update-task-suggestion', id, title, content, layer, status),
  deleteTaskSuggestion: (id) => ipcRenderer.invoke('delete-task-suggestion', id),
  getTaskComments: (taskId) => ipcRenderer.invoke('get-task-comments', taskId),
  addTaskComment: (taskId, content) => ipcRenderer.invoke('add-task-comment', taskId, content),
  deleteTaskComment: (id) => ipcRenderer.invoke('delete-task-comment', id),
  createProjectTask: (projectId, title, content, layer, status) => ipcRenderer.invoke('create-project-task', projectId, title, content, layer, status),
  addTaskToProject: (taskId, projectId) => ipcRenderer.invoke('add-task-to-project', taskId, projectId),
  removeTaskFromProject: (taskId) => ipcRenderer.invoke('remove-task-from-project', taskId),
  updateTasksSortOrder: (updates) => ipcRenderer.invoke('update-tasks-sort-order', updates),

  // Exportar documento
  exportDocument: (data, format) => ipcRenderer.invoke('export-document', { data, format }),

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
  clearProjectChatMessages: (chatId) => ipcRenderer.invoke('clear-project-chat-messages', chatId),

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

  // RAG
  indexRecording: (recordingId) => ipcRenderer.invoke('index-recording', recordingId),
  searchRecording: (recordingId, query, topK) => ipcRenderer.invoke('search-recording', recordingId, query, topK),
  getRagStatus: (recordingId) => ipcRenderer.invoke('get-rag-status', recordingId),
  deleteRagIndex: (recordingId) => ipcRenderer.invoke('delete-rag-index', recordingId),

  // Importar transcripción de Teams (.docx)
  importTeamsTranscript: () => ipcRenderer.invoke('import-teams-transcript'),

  // Importar archivo de audio externo
  importAudioFile: () => ipcRenderer.invoke('import-audio-file'),

  // Actualizaciones
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  openDownloadUrl: (url) => ipcRenderer.invoke('open-download-url', url),
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', (_event, value) => callback(value)),
  offUpdateAvailable: () => ipcRenderer.removeAllListeners('update-available'),
  testUpdateDialog: () => ipcRenderer.invoke('test-update-dialog'),

  // Sentry (Telemetría)
  sentryLogInfo: (message, context) => ipcRenderer.invoke('sentry-log-info', message, context),
  sentryLogError: (errorInfo, context) => ipcRenderer.invoke('sentry-log-error', errorInfo, context),

  // Base de datos — ruta configurable
  changeDbPath: (newPath, migrate) => ipcRenderer.invoke('change-db-path', { newPath, migrate }),
  getDbStatus: () => ipcRenderer.invoke('get-db-status'),

  // Adjuntos de grabaciones
  getAttachments: (recordingId) => ipcRenderer.invoke('get-attachments', recordingId),
  pickAndAddAttachment: (recordingId) => ipcRenderer.invoke('pick-and-add-attachment', recordingId),
  deleteAttachment: (recordingId, filename) => ipcRenderer.invoke('delete-attachment', recordingId, filename),
  readAttachmentContent: (recordingId, filename) => ipcRenderer.invoke('read-attachment-content', recordingId, filename),
  getAttachmentThumbnail: (recordingId, filename) => ipcRenderer.invoke('get-attachment-thumbnail', recordingId, filename),
}); 