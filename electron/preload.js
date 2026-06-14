const { contextBridge, ipcRenderer, shell } = require('electron');

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
  getDirectorySize: (dirPath) => ipcRenderer.invoke('get-directory-size', dirPath),

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
  // Guardar y leer esquema/mind-map de grabación
  saveRecordingSchema: (recordingId, schema) => ipcRenderer.invoke('save-recording-schema', recordingId, schema),
  getRecordingSchema: (recordingId) => ipcRenderer.invoke('get-recording-schema', recordingId),
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

  // Wiki de proyecto
  wiki: {
    listPages: (projectId) => ipcRenderer.invoke('wiki:list-pages', projectId),
    createPage: (data) => ipcRenderer.invoke('wiki:create-page', data),
    updatePage: (id, data) => ipcRenderer.invoke('wiki:update-page', id, data),
    deletePage: (id) => ipcRenderer.invoke('wiki:delete-page', id),
    generateStarterPage: (projectId, options) => ipcRenderer.invoke('wiki:generate-starter-page', projectId, options),
  },

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

  // Monitor de micrófono del sistema
  setAppRecordingState: (isRecording) => ipcRenderer.invoke('set-app-recording-state', isRecording),

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

  // Importar conversación externa
  selectConversationFile: () => ipcRenderer.invoke('select-conversation-file'),
  saveConversationImport: (data) => ipcRenderer.invoke('save-conversation-import', data),

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

  // Integraciones OAuth (Google Chat, Teams)
  startOAuthFlow: (params) => ipcRenderer.invoke('start-oauth-flow', params),
  getPlatformConnections: () => ipcRenderer.invoke('get-platform-connections'),
  disconnectPlatform: (connectionId) => ipcRenderer.invoke('disconnect-platform', connectionId),
  getAvailableChannels: (params) => ipcRenderer.invoke('get-available-channels', params),
  getProjectIntegrations: (projectId) => ipcRenderer.invoke('get-project-integrations', projectId),
  linkChannelToProject: (params) => ipcRenderer.invoke('link-channel-to-project', params),
  unlinkChannelFromProject: (integrationId) => ipcRenderer.invoke('unlink-channel-from-project', integrationId),
  syncProjectIntegrations: (params) => ipcRenderer.invoke('sync-project-integrations', params),
  getChatIntegrations: (chatId) => ipcRenderer.invoke('get-chat-integrations', chatId),
  linkChannelToChat: (params) => ipcRenderer.invoke('link-channel-to-chat', params),
  unlinkChannelFromChat: (integrationId) => ipcRenderer.invoke('unlink-channel-from-chat', integrationId),
  syncChatIntegrations: (params) => ipcRenderer.invoke('sync-chat-integrations', params),

  // Base de datos — ruta configurable
  changeDbPath: (newPath, migrate) => ipcRenderer.invoke('change-db-path', { newPath, migrate }),
  getDbStatus: () => ipcRenderer.invoke('get-db-status'),

  // Adjuntos de grabaciones
  getAttachments: (recordingId) => ipcRenderer.invoke('get-attachments', recordingId),
  pickAndAddAttachment: (recordingId, options) => ipcRenderer.invoke('pick-and-add-attachment', recordingId, options),
  deleteAttachment: (recordingId, filename) => ipcRenderer.invoke('delete-attachment', recordingId, filename),
  readAttachmentContent: (recordingId, filename) => ipcRenderer.invoke('read-attachment-content', recordingId, filename),
  getAttachmentThumbnail: (recordingId, filename) => ipcRenderer.invoke('get-attachment-thumbnail', recordingId, filename),
  savePastedText: (recordingId, text, filename) => ipcRenderer.invoke('save-pasted-text', recordingId, text, filename),

  // Abrir URLs en el navegador predeterminado del sistema
  openExternal: (url) => shell.openExternal(url),

  // Expertos — Modos de Especialidad
  getExpertCustomizations: (expertId) => ipcRenderer.invoke('get-expert-customizations', expertId),
  saveExpertCustomization: (data) => ipcRenderer.invoke('save-expert-customization', data),
  resetExpertCustomization: (data) => ipcRenderer.invoke('reset-expert-customization', data),

  // Instrucciones extra por grabación
  saveExtraInstructions: (recordingId, text) => ipcRenderer.invoke('save-extra-instructions', recordingId, text),
  getExtraInstructions: (recordingId) => ipcRenderer.invoke('get-extra-instructions', recordingId),

  // Auto-análisis IA (evento desde main process tras transcripción)
  onAutoAnalyze: (callback) => {
    const handler = (_event, recordingId) => callback(recordingId);
    ipcRenderer.on('auto-analyze-recording', handler);
    return () => ipcRenderer.removeListener('auto-analyze-recording', handler);
  },

  // ── Identificación de Hablantes ──────────────────────────────────────────────

  /**
   * Resuelve el mapa `speaker_embeddings` de una sesión de diarización.
   * Para cada ID efímero ("SPEAKER_00") devuelve el UUID persistente y su alias.
   *
   * @param {{ speakerEmbeddings: Object, recordingId?: number, threshold?: number }} params
   * @returns {Promise<{ success: boolean, data?: Object, error?: string }>}
   */
  resolveSpeakers: (params) => ipcRenderer.invoke('resolve-speaker', params),

  /**
   * Persiste un alias personalizado para un hablante identificado por UUID.
   * Opcionalmente guarda un embedding actualizado.
   *
   * @param {{ speakerId: string, alias: string, embedding?: number[], recordingId?: number }} params
   * @returns {Promise<{ success: boolean, error?: string }>}
   */
  assignSpeakerAlias: (params) => ipcRenderer.invoke('assign-alias', params),

  /**
   * Devuelve todos los hablantes registrados en la BD.
   * Se usa para poblar el autocompletado de alias en el frontend.
   *
   * @returns {Promise<{ success: boolean, data: Array, error?: string }>}
   */
  getAllSpeakers: () => ipcRenderer.invoke('get-all-speakers'),

  /**
   * Fusiona múltiples hablantes en un único perfil persistente.
   * Reasigna embeddings y elimina perfiles redundantes en BD.
   * @param {{ sourceEphemeralIds: string[], speakersMap: Object, targetAlias: string }} params
   * @returns {Promise<{ success: boolean, targetSpeakerId?: string, displayName?: string, error?: string }>}
   */
  mergeSpeakers: (params) => ipcRenderer.invoke('merge-speakers', params),

  /**
   * Confirma una sugerencia de match de hablante.
   * Vincula el ephemeralId al hablante confirmado y consolida los embeddings.
   * @param {{ recordingId: number, ephemeralId: string, confirmedSpeakerId: string, currentSpeakerId: string }} params
   * @returns {Promise<{ success: boolean, displayName?: string, error?: string }>}
   */
  confirmSpeakerSuggestion: (params) => ipcRenderer.invoke('confirm-speaker-suggestion', params),

  // ── Estadísticas y Directorio de Hablantes ──────────────────────────────────

  /**
   * Devuelve métricas agregadas del sistema de reconocimiento de hablantes.
   * @returns {Promise<{ success: boolean, data: Object, error?: string }>}
   */
  getSpeakerStats: () => ipcRenderer.invoke('get-speaker-stats'),

  /**
   * Devuelve todos los hablantes ordenados por nº de grabaciones DESC.
   * @returns {Promise<{ success: boolean, data: Array, error?: string }>}
   */
  getSpeakersWithRecordings: () => ipcRenderer.invoke('get-speakers-with-recordings'),

  /**
   * Devuelve las grabaciones donde aparece un hablante específico.
   * @param {{ speakerId: string }} params
   * @returns {Promise<{ success: boolean, data: Object, error?: string }>}
   */
  getSpeakerRecordings: (params) => ipcRenderer.invoke('get-speaker-recordings', params),
  getSimilarSpeakers: (params) => ipcRenderer.invoke('get-similar-speakers', params),
  mergeSimilarSpeaker: (params) => ipcRenderer.invoke('merge-similar-speaker', params),

  /**
    * Previsualiza un merge entre dos hablantes.
    * Devuelve origen/destino finales (con auto-swap), recuentos de embeddings y advertencias.
    *
    * @param {{ sourceSpeakerId: string, targetSpeakerId: string }} params
    * @returns {Promise<{ success: boolean, data?: { finalSourceId: string, finalTargetId: string, swapped: boolean, sourceEmbeddings: number, targetEmbeddings: number, warnings: string[] }, error?: string }>}
    */
  previewMergeSpeakers: (params) => ipcRenderer.invoke('preview-merge-speakers', params),

  // ── Floating Widget ─────────────────────────────────────────────────────────
  showFloatingWindow: (opts) => ipcRenderer.invoke('show-floating-window', opts),
  hideFloatingWindow: () => ipcRenderer.invoke('hide-floating-window'),
  notifyMuteState: (muted) => ipcRenderer.send('main-mute-state-changed', muted),
  floatingToggleMute: () => ipcRenderer.send('floating-toggle-mute'),
  floatingStopRecording: () => ipcRenderer.send('floating-stop-recording'),
  floatingDiscardRecording: () => ipcRenderer.send('floating-discard-recording'),
  onFloatingWindowHidden: (cb) => {
    const listener = () => cb();
    ipcRenderer.on('floating-window-hidden', listener);
    return () => ipcRenderer.removeListener('floating-window-hidden', listener);
  },
  onRelayToggleMute: (cb) => {
    const listener = () => cb();
    ipcRenderer.on('relay-toggle-mute', listener);
    return () => ipcRenderer.removeListener('relay-toggle-mute', listener);
  },
  onRelayStopRecording: (cb) => {
    const listener = () => cb();
    ipcRenderer.on('relay-stop-recording', listener);
    return () => ipcRenderer.removeListener('relay-stop-recording', listener);
  },
  onRelayDiscardRecording: (cb) => {
    const listener = () => cb();
    ipcRenderer.on('relay-discard-recording', listener);
    return () => ipcRenderer.removeListener('relay-discard-recording', listener);
  },
  onMuteStateChanged: (cb) => {
    const listener = (_e, muted) => cb(muted);
    ipcRenderer.on('mute-state-changed', listener);
    return () => ipcRenderer.removeListener('mute-state-changed', listener);
  },

  /**
   * Devuelve el timestamp del primer segmento de un hablante en una grabación.
   * Se usa para hacer seek al punto exacto donde ese hablante empieza a hablar.
   *
   * @param {{ speakerId: string, recordingId: number }} params
   * @returns {Promise<{ success: boolean, data?: { startTime: number, ephemeralId: string }, error?: string }>}
   */
  getSpeakerFirstSegmentTime: (params) => ipcRenderer.invoke('get-speaker-first-segment-time', params),

  /**
   * Elimina la relación entre un hablante y una grabación específica.
   * Esto elimina tanto la resolución como el embedding para esa grabación.
   *
   * @param {{ speakerId: string, recordingId: number }} params
   * @returns {Promise<{ success: boolean, deletedCount?: number, error?: string }>}
   */
  deleteSpeakerRecordingResolution: (params) => ipcRenderer.invoke('delete-speaker-recording-resolution', params),

  // ── Note Templates ─────────────────────────────────────────────────────────
  templates: {
    // Template CRUD
    list: () => ipcRenderer.invoke('templates:list'), // All templates (for settings)
    listEnabled: () => ipcRenderer.invoke('templates:listEnabled'), // Only enabled (for note creation)
    getBySlug: (slug) => ipcRenderer.invoke('templates:getBySlug', slug),
    create: (data) => ipcRenderer.invoke('templates:create', data),
    update: (slug, data) => ipcRenderer.invoke('templates:update', slug, data),
    delete: (slug) => ipcRenderer.invoke('templates:delete', slug),
    toggleEnabled: (slug, enabled) => ipcRenderer.invoke('templates:toggleEnabled', slug, enabled),

    // Recording Notes
    getNotesForRecording: (id) => ipcRenderer.invoke('templates:getNotesForRecording', id),
    saveNote: (data) => ipcRenderer.invoke('templates:saveNote', data),
    updateNote: (id, content) => ipcRenderer.invoke('templates:updateNote', id, content),
    deleteNote: (id) => ipcRenderer.invoke('templates:deleteNote', id)
  }
});
