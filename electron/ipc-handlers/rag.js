const { ipcMain } = require('electron');
const path = require('path');
const dbService = require('../database/dbService');
const ragService = require('../services/ragService');
const { getRecordingsPath, getFolderPathFromId } = require('../utils/paths');

module.exports.registerRagHandlers = () => {

  ipcMain.handle('index-recording', async (event, recordingId) => {
    try {
      const folderName = await getFolderPathFromId(recordingId);
      const baseOutputDir = await getRecordingsPath();
      const recordingPath = path.join(baseOutputDir, folderName);

      const result = await ragService.indexRecording(recordingPath);

      if (result.indexed) {
        dbService.updateRagStatus(folderName, 'indexed');
      } else if (result.error) {
        dbService.updateRagStatus(folderName, 'error');
      }

      return { success: true, ...result };
    } catch (error) {
      console.error('[RAG] Error indexando:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('search-recording', async (event, recordingId, query, topK) => {
    try {
      const folderName = await getFolderPathFromId(recordingId);
      const baseOutputDir = await getRecordingsPath();
      const recordingPath = path.join(baseOutputDir, folderName);

      const chunks = await ragService.searchRecording(recordingPath, query, topK || 5);
      return { success: true, chunks };
    } catch (error) {
      console.error('[RAG] Error buscando:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-rag-status', async (event, recordingId) => {
    try {
      const folderName = await getFolderPathFromId(recordingId);
      const baseOutputDir = await getRecordingsPath();
      const recordingPath = path.join(baseOutputDir, folderName);

      const status = await ragService.getStatus(recordingPath);
      const dbStatus = dbService.getRagStatus(folderName);

      return { success: true, ...status, dbStatus };
    } catch (error) {
      console.error('[RAG] Error obteniendo estado:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('delete-rag-index', async (event, recordingId) => {
    try {
      const folderName = await getFolderPathFromId(recordingId);
      const baseOutputDir = await getRecordingsPath();
      const recordingPath = path.join(baseOutputDir, folderName);

      await ragService.deleteIndex(recordingPath);
      dbService.updateRagStatus(folderName, null);

      return { success: true };
    } catch (error) {
      console.error('[RAG] Error eliminando índice:', error);
      return { success: false, error: error.message };
    }
  });

};