const { ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const dbService = require('../database/dbService');
const notificationService = require('../services/notificationService');
const { getRecordingsPath, getFolderPathFromId } = require('../utils/paths');

module.exports.registerAnalysisHandlers = () => {

  // Guardar resumen IA
  ipcMain.handle('save-ai-summary', async (event, recordingId, summary) => {
    try {
      const folderName = await getFolderPathFromId(recordingId);
      const baseOutputDir = await getRecordingsPath();
      const analysisDir = path.join(baseOutputDir, folderName, 'analysis');
      
      if (!fs.existsSync(analysisDir)) {
        fs.mkdirSync(analysisDir, { recursive: true });
      }
      
      const filePath = path.join(analysisDir, 'ai_summary.json');
      await fs.promises.writeFile(filePath, JSON.stringify(summary, null, 2), 'utf8');
      
      // Actualizar estado en DB a 'analyzed'
      dbService.updateStatus(folderName, 'analyzed');
      
      // Notificar al usuario
      notificationService.show(
        'Análisis IA Completado',
        `El análisis para "${folderName}" ha finalizado.`,
        { type: 'analysis-complete', recordingId: folderName }
      );

      return { success: true };
    } catch (error) {
      console.error('Error saving AI summary:', error);
      return { success: false, error: error.message };
    }
  });

  // Obtener resumen IA
  ipcMain.handle('get-ai-summary', async (event, recordingId) => {
    try {
      const folderName = await getFolderPathFromId(recordingId);
      const baseOutputDir = await getRecordingsPath();
      
      // Intentar leer ai_summary.json o gemini_summary.json (retrocompatibilidad)
      let filePath = path.join(baseOutputDir, folderName, 'analysis', 'ai_summary.json');
      if (!fs.existsSync(filePath)) {
        filePath = path.join(baseOutputDir, folderName, 'analysis', 'gemini_summary.json');
      }
      
      if (!fs.existsSync(filePath)) {
        return { success: false, error: 'Resumen no encontrado' };
      }
      
      const data = await fs.promises.readFile(filePath, 'utf8');
      return { success: true, summary: JSON.parse(data) };
    } catch (error) {
      console.error('Error getting AI summary:', error);
      return { success: false, error: error.message };
    }
  });

  // Guardar histórico de preguntas
  ipcMain.handle('save-question-history', async (event, recordingId, qa) => {
    try {
      // recordingId es el nombre de la carpeta física (folderName)
      const folderName = recordingId;
      const baseOutputDir = await getRecordingsPath();
      const analysisDir = path.join(baseOutputDir, folderName, 'analysis');
      
      if (!fs.existsSync(analysisDir)) {
        fs.mkdirSync(analysisDir, { recursive: true });
      }
      
      const filePath = path.join(analysisDir, 'questions_history.json');
      let history = [];
      
      if (fs.existsSync(filePath)) {
        const data = await fs.promises.readFile(filePath, 'utf8');
        history = JSON.parse(data);
      }
      
      history.push({
        ...qa,
        timestamp: new Date().toISOString()
      });
      
      await fs.promises.writeFile(filePath, JSON.stringify(history, null, 2), 'utf8');
      return { success: true };
    } catch (error) {
      console.error('Error saving question history:', error);
      return { success: false, error: error.message };
    }
  });

  // Obtener histórico de preguntas
  ipcMain.handle('get-question-history', async (event, recordingId) => {
    try {
      // recordingId es el nombre de la carpeta física (folderName)
      const folderName = recordingId;
      const baseOutputDir = await getRecordingsPath();
      const filePath = path.join(baseOutputDir, folderName, 'analysis', 'questions_history.json');
      
      console.log(`[Main] get-question-history: Leyendo de ${filePath} (ID: ${recordingId})`);

      if (!fs.existsSync(filePath)) {
        console.log(`[Main] get-question-history: Archivo no existe.`);
        return { success: true, history: [] };
      }
      
      const data = await fs.promises.readFile(filePath, 'utf8');
      const history = JSON.parse(data);
      console.log(`[Main] get-question-history: Leídos ${history.length} mensajes.`);
      return { success: true, history };
    } catch (error) {
      console.error('Error getting question history:', error);
      return { success: false, error: error.message };
    }
  });

  // Limpiar histórico de preguntas (Reset Chat)
  ipcMain.handle('clear-question-history', async (event, recordingId) => {
    console.log(`[Main] clear-question-history: Solicitud recibida. ID: ${recordingId}`);
    try {
      // recordingId es el nombre de la carpeta física (folderName)
      const folderName = recordingId;
      const baseOutputDir = await getRecordingsPath();
      const analysisDir = path.join(baseOutputDir, folderName, 'analysis');
      const filePath = path.join(analysisDir, 'questions_history.json');
      
      console.log(`[Main] clear-question-history: Intentando limpiar ${filePath}`);
      
      // Asegurar que el directorio existe
      if (!fs.existsSync(analysisDir)) {
        console.log('[Main] clear-question-history: Directorio analysis no existe, creando...');
        fs.mkdirSync(analysisDir, { recursive: true });
      }

      // Sobreescribir con array vacío explícitamente
      await fs.promises.writeFile(filePath, '[]', 'utf8');
      
      // Verificar que se escribió bien
      const checkData = await fs.promises.readFile(filePath, 'utf8');
      console.log(`[Main] clear-question-history: Verificación post-escritura: contenido='${checkData}'`);
      
      return { success: true };
    } catch (error) {
      console.error('[Main] Error clearing question history:', error);
      return { success: false, error: error.message };
    }
  });

  // Guardar participantes
  ipcMain.handle('save-participants', async (event, recordingId, participants) => {
    try {
      const folderName = await getFolderPathFromId(recordingId);
      const baseOutputDir = await getRecordingsPath();
      const analysisDir = path.join(baseOutputDir, folderName, 'analysis');
      
      if (!fs.existsSync(analysisDir)) {
        fs.mkdirSync(analysisDir, { recursive: true });
      }
      
      const filePath = path.join(analysisDir, 'participants.json');
      await fs.promises.writeFile(filePath, JSON.stringify(participants, null, 2), 'utf8');
      return { success: true };
    } catch (error) {
      console.error('Error saving participants:', error);
      return { success: false, error: error.message };
    }
  });

  // Obtener participantes
  ipcMain.handle('get-participants', async (event, recordingId) => {
    try {
      const folderName = await getFolderPathFromId(recordingId);
      const baseOutputDir = await getRecordingsPath();
      const filePath = path.join(baseOutputDir, folderName, 'analysis', 'participants.json');
      
      if (!fs.existsSync(filePath)) {
        return { success: true, participants: [] };
      }
      
      const data = await fs.promises.readFile(filePath, 'utf8');
      return { success: true, participants: JSON.parse(data) };
    } catch (error) {
      console.error('Error getting participants:', error);
      return { success: false, error: error.message };
    }
  });

  // Obtener sugerencias de tareas
  ipcMain.handle('get-task-suggestions', async (event, recordingId) => {
    try {
      const numericId = parseInt(recordingId, 10);
      if (isNaN(numericId)) return { success: false, error: 'ID inválido' };
      const tasks = dbService.getTaskSuggestions(numericId);
      return { success: true, tasks };
    } catch (error) {
      console.error('Error obteniendo sugerencias de tareas:', error);
      return { success: false, error: error.message };
    }
  });

  // Añadir sugerencia de tarea
  ipcMain.handle('add-task-suggestion', async (event, recordingId, title, content, layer, createdByAi) => {
    try {
      const numericId = parseInt(recordingId, 10);
      if (isNaN(numericId)) return { success: false, error: 'ID inválido' };
      const task = dbService.addTaskSuggestion(numericId, title, content, layer || 'general', createdByAi !== false ? 1 : 0);
      return { success: true, task };
    } catch (error) {
      console.error('Error añadiendo sugerencia de tarea:', error);
      return { success: false, error: error.message };
    }
  });

  // Actualizar sugerencia de tarea
  ipcMain.handle('update-task-suggestion', async (event, id, title, content, layer) => {
    try {
      const task = dbService.updateTaskSuggestion(id, title, content, layer || 'general');
      return { success: true, task };
    } catch (error) {
      console.error('Error actualizando sugerencia de tarea:', error);
      return { success: false, error: error.message };
    }
  });

  // Eliminar sugerencia de tarea
  ipcMain.handle('delete-task-suggestion', async (event, id) => {
    try {
      dbService.deleteTaskSuggestion(id);
      return { success: true };
    } catch (error) {
      console.error('Error eliminando sugerencia de tarea:', error);
      return { success: false, error: error.message };
    }
  });

  // Guardar estado de generación
  ipcMain.handle('save-generating-state', async (event, recordingId, state) => {
    try {
      const folderName = await getFolderPathFromId(recordingId);
      const baseOutputDir = await getRecordingsPath();
      const statePath = path.join(
        baseOutputDir,
        folderName,
        'analysis',
        '.generating.json'
      );
      
      // Crear la carpeta analysis si no existe
      const analysisDir = path.dirname(statePath);
      if (!fs.existsSync(analysisDir)) {
        fs.mkdirSync(analysisDir, { recursive: true });
      }
      
      await fs.promises.writeFile(statePath, JSON.stringify(state, null, 2), 'utf8');
      console.log(`[AI] Estado de generación guardado: ${statePath}`);
      return { success: true };
    } catch (error) {
      console.error('Error guardando estado de generación:', error);
      return { success: false, error: error.message };
    }
  });

  // Obtener estado de generación
  ipcMain.handle('get-generating-state', async (event, recordingId) => {
    try {
      const folderName = await getFolderPathFromId(recordingId);
      const baseOutputDir = await getRecordingsPath();
      const statePath = path.join(
        baseOutputDir,
        folderName,
        'analysis',
        '.generating.json'
      );
      
      if (!fs.existsSync(statePath)) {
        return { success: false, error: 'No existe estado de generación' };
      }
      
      const data = await fs.promises.readFile(statePath, 'utf8');
      return { success: true, state: JSON.parse(data) };
    } catch (error) {
      console.error('Error leyendo estado de generación:', error);
      return { success: false, error: error.message };
    }
  });

  // Limpiar estado de generación
  ipcMain.handle('clear-generating-state', async (event, recordingId) => {
    try {
      const baseOutputDir = await getRecordingsPath();
      const statePath = path.join(
        baseOutputDir,
        recordingId,
        'analysis',
        '.generating.json'
      );
      
      if (fs.existsSync(statePath)) {
        await fs.promises.unlink(statePath);
        console.log(`[AI] Estado de generación eliminado: ${statePath}`);
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error eliminando estado de generación:', error);
      return { success: false, error: error.message };
    }
  });

};