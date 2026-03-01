const { ipcMain } = require('electron');
const dbService = require('../database/dbService');
const transcriptionManager = require('../services/transcriptionManager');

module.exports.registerTranscriptionHandlers = () => {

  // Manejador para añadir a la cola
  ipcMain.handle('transcribe-recording', async (event, recordingId, model = null) => {
    try {
      const result = transcriptionManager.addTask(recordingId, { name: recordingId, model: model });
      return result;
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-transcription-queue', () => {
    return { success: true, ...transcriptionManager.getState() };
  });

  ipcMain.handle('cancel-transcription-task', (event, recordingId) => {
    return transcriptionManager.cancelTask(recordingId);
  });

  ipcMain.handle('get-recording-queue-status', async (event, recordingId) => {
    try {
      const status = dbService.getRecordingTaskStatus(recordingId);
      return { success: true, status };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

};