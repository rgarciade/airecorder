const { ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const dbService = require('../database/dbService');
const { PROJECTS_PATH } = require('../utils/paths');

module.exports.registerProjectsHandlers = () => {

  // Obtener todos los proyectos
  ipcMain.handle('get-projects', async () => {
    try {
      const projects = dbService.getAllProjects();
      return { success: true, projects };
    } catch (error) {
      console.error('Error obteniendo proyectos:', error);
      return { success: false, error: error.message };
    }
  });

  // Crear un nuevo proyecto
  ipcMain.handle('create-project', async (event, projectData) => {
    try {
      const project = dbService.createProject(
        projectData.name, 
        projectData.description, 
        projectData.members || []
      );
      return { success: true, project };
    } catch (error) {
      console.error('Error creando proyecto:', error);
      return { success: false, error: error.message };
    }
  });

  // Actualizar un proyecto existente
  ipcMain.handle('update-project', async (event, projectId, projectData) => {
    try {
      const project = dbService.updateProject(
        projectId,
        projectData.name,
        projectData.description,
        projectData.members
      );
      return { success: true, project };
    } catch (error) {
      console.error('Error actualizando proyecto:', error);
      return { success: false, error: error.message };
    }
  });

  // Eliminar un proyecto
  ipcMain.handle('delete-project', async (event, projectId) => {
    try {
      dbService.deleteProject(projectId);
      return { success: true };
    } catch (error) {
      console.error('Error eliminando proyecto:', error);
      return { success: false, error: error.message };
    }
  });

  // Agregar una grabación a un proyecto
  ipcMain.handle('add-recording-to-project', async (event, projectId, recordingId) => {
    try {
      dbService.addRecordingToProject(projectId, recordingId);
      return { success: true };
    } catch (error) {
      console.error('Error agregando grabación al proyecto:', error);
      return { success: false, error: error.message };
    }
  });

  // Eliminar una grabación de un proyecto
  ipcMain.handle('remove-recording-from-project', async (event, projectId, recordingId) => {
    try {
      dbService.removeRecordingFromProject(projectId, recordingId);
      return { success: true };
    } catch (error) {
      console.error('Error eliminando grabación del proyecto:', error);
      return { success: false, error: error.message };
    }
  });

  // Obtener todas las grabaciones (IDs) de un proyecto
  ipcMain.handle('get-project-recordings', async (event, projectId) => {
    try {
      const recordings = dbService.getProjectRecordingIds(projectId);
      return { success: true, recordings };
    } catch (error) {
      console.error('Error obteniendo grabaciones del proyecto:', error);
      return { success: false, error: error.message };
    }
  });

  // Obtener el proyecto de una grabación
  ipcMain.handle('get-recording-project', async (event, recordingId) => {
    try {
      const project = dbService.getRecordingProject(recordingId);
      if (!project) {
        return { success: false, error: 'Sin proyecto' };
      }
      return { success: true, project };
    } catch (error) {
      console.error('Error obteniendo proyecto de la grabación:', error);
      return { success: false, error: error.message };
    }
  });

  // Obtener duración total de un proyecto
  ipcMain.handle('get-project-total-duration', async (event, projectId) => {
    try {
      const duration = dbService.getProjectTotalDuration(projectId);
      return { success: true, duration };
    } catch (error) {
      console.error('Error obteniendo duración del proyecto:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-project-chats', async (event, projectId) => {
    try {
      const chats = dbService.getProjectChats(projectId);
      return { success: true, chats };
    } catch (error) {
      console.error('Error obteniendo chats del proyecto:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('create-project-chat', async (event, projectId, name, contextRecordings) => {
    try {
      const id = `chat_${Date.now()}`;
      const chat = dbService.createProjectChat(id, projectId, name, contextRecordings);
      return { success: true, chat };
    } catch (error) {
      console.error('Error creando chat del proyecto:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('delete-project-chat', async (event, chatId) => {
    try {
      dbService.deleteProjectChat(chatId);
      return { success: true };
    } catch (error) {
      console.error('Error eliminando chat del proyecto:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-project-chat-history', async (event, chatId) => {
    try {
      const history = dbService.getChatMessages(chatId);
      return { success: true, history };
    } catch (error) {
      console.error('Error obteniendo historial del chat:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('clear-project-chat-messages', async (event, chatId) => {
    try {
      dbService.clearChatMessages(chatId);
      return { success: true };
    } catch (error) {
      console.error('Error borrando mensajes del chat:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('save-project-chat-message', async (event, chatId, message) => {
    try {
      const savedMessage = dbService.saveProjectChatMessage(chatId, message.tipo, message.contenido);
      return { success: true, message: savedMessage };
    } catch (error) {
      console.error('Error guardando mensaje del chat:', error);
      return { success: false, error: error.message };
    }
  });

  // Guardar análisis de proyecto (mantiene ruta actual)
  ipcMain.handle('save-project-analysis', async (event, projectId, analysis) => {
    try {
      const analysisDir = path.join(PROJECTS_PATH, 'projects_analysis');
      
      if (!fs.existsSync(analysisDir)) {
        fs.mkdirSync(analysisDir, { recursive: true });
      }
      
      const filePath = path.join(analysisDir, `${projectId}.json`);
      await fs.promises.writeFile(filePath, JSON.stringify(analysis, null, 2), 'utf8');
      
      // Marcar proyecto como actualizado en DB
      dbService.updateProjectSyncStatus(projectId, 1);
      
      console.log(`Análisis de proyecto guardado en: ${filePath}`);
      return { success: true };
    } catch (error) {
      console.error('Error guardando análisis de proyecto:', error);
      return { success: false, error: error.message };
    }
  });

  // Obtener análisis de proyecto
  ipcMain.handle('get-project-analysis', async (event, projectId) => {
    try {
      const filePath = path.join(PROJECTS_PATH, 'projects_analysis', `${projectId}.json`);

      if (!fs.existsSync(filePath)) {
        return { success: false, error: 'Análisis no encontrado' };
      }

      const data = await fs.promises.readFile(filePath, 'utf8');
      return { success: true, analysis: JSON.parse(data) };
    } catch (error) {
      console.error('Error leyendo análisis de proyecto:', error);
      return { success: false, error: error.message };
    }
  });

};