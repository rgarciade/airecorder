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
      console.error('[RAG] Error buscando:', { code: error.code, message: error.message, recordingId, query: query?.substring(0, 50) });
      return { success: false, error: error.message || error.code || 'Error desconocido en búsqueda RAG' };
    }
  });

  // Búsqueda unificada en varias grabaciones: un solo provider y un solo embedding de la query
  ipcMain.handle('search-project', async (event, recordingIds, query, topKPerRecording) => {
    try {
      const baseOutputDir = await getRecordingsPath();
      const recordings = [];
      const failedById = new Map();
      for (const recordingId of recordingIds || []) {
        try {
          const folderName = await getFolderPathFromId(recordingId);
          recordings.push({ recordingId, recordingPath: path.join(baseOutputDir, folderName) });
        } catch (error) {
          failedById.set(recordingId, { recordingId, success: false, chunks: [], error: error.message || 'No se pudo resolver la ruta de la grabación' });
        }
      }

      const searched = recordings.length > 0
        ? await ragService.searchProject(recordings, query, topKPerRecording || 5)
        : [];
      const searchedById = new Map(searched.map((r) => [r.recordingId, r]));

      // Resultados en el orden de entrada
      const results = (recordingIds || []).map((id) => failedById.get(id) || searchedById.get(id));
      return { success: true, results };
    } catch (error) {
      console.error('[RAG] Error en búsqueda de proyecto:', error);
      return { success: false, error: error.message || 'Error desconocido en búsqueda RAG de proyecto' };
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

  ipcMain.handle('rag:reindex-all', async () => {
    try {
      const baseOutputDir = await getRecordingsPath();
      const result = await ragService.reindexAllRecordings({ baseOutputDir });

      if (result.error) {
        return { success: false, error: result.error };
      }

      return { success: true, ...result };
    } catch (error) {
      console.error('[RAG] Error reindexando todo:', error);
      return { success: false, error: error.message || String(error) };
    }
  });

};