/**
 * Servicio para gestionar múltiples chats del proyecto persistidos en SQLite
 */

import projectAiService from './projectAiService';

class ProjectChatService {
  /**
   * Obtiene todos los chats de un proyecto
   * @param {string} projectId - ID del proyecto
   * @returns {Promise<Array>} Lista de chats del proyecto
   */
  async getProjectChats(projectId) {
    try {
      if (!window.electronAPI?.getProjectChats) return [];
      const result = await window.electronAPI.getProjectChats(projectId);
      return result.success ? result.chats : [];
    } catch (error) {
      console.error('Error obteniendo chats del proyecto:', error);
      return [];
    }
  }

  /**
   * Crea un nuevo chat para el proyecto
   * @param {string} projectId - ID del proyecto
   * @param {string} chatName - Nombre del nuevo chat
   * @param {Array} recordingIds - IDs de grabaciones para el contexto
   * @returns {Promise<Object>} Chat creado
   */
  async createProjectChat(projectId, chatName, recordingIds = []) {
    try {
      if (!window.electronAPI?.createProjectChat) throw new Error('API no disponible');
      const result = await window.electronAPI.createProjectChat(projectId, chatName, recordingIds);
      if (!result.success) throw new Error(result.error);
      return result.chat;
    } catch (error) {
      console.error('Error creando chat del proyecto:', error);
      throw error;
    }
  }

  /**
   * Elimina un chat del proyecto
   * @param {string} projectId - ID del proyecto (no usado en SQLite pero mantenido por compatibilidad)
   * @param {string} chatId - ID del chat a eliminar
   * @returns {Promise<boolean>} True si se eliminó correctamente
   */
  async deleteProjectChat(projectId, chatId) {
    try {
      if (!window.electronAPI?.deleteProjectChat) return false;
      const result = await window.electronAPI.deleteProjectChat(chatId);
      return result.success;
    } catch (error) {
      console.error('Error eliminando chat del proyecto:', error);
      return false;
    }
  }

  /**
   * Obtiene el historial de mensajes de un chat específico
   * @param {string} projectId - ID del proyecto (no usado en SQLite)
   * @param {string} chatId - ID del chat
   * @returns {Promise<Array>} Historial de mensajes
   */
  async getProjectChatHistory(projectId, chatId) {
    try {
      if (!window.electronAPI?.getProjectChatHistory) return [];
      const result = await window.electronAPI.getProjectChatHistory(chatId);
      return result.success ? result.history : [];
    } catch (error) {
      console.error('Error obteniendo historial del chat:', error);
      return [];
    }
  }

  /**
   * Guarda un nuevo mensaje en un chat del proyecto
   * @param {string} projectId - ID del proyecto (no usado en SQLite)
   * @param {string} chatId - ID del chat
   * @param {Object} message - Mensaje a guardar {tipo, contenido}
   * @returns {Promise<Object>} Mensaje guardado
   */
  async saveProjectChatMessage(projectId, chatId, message) {
    try {
      if (!window.electronAPI?.saveProjectChatMessage) throw new Error('API no disponible');
      const result = await window.electronAPI.saveProjectChatMessage(chatId, message);
      if (!result.success) throw new Error(result.error);
      return result.message;
    } catch (error) {
      console.error('Error guardando mensaje del chat:', error);
      throw error;
    }
  }

  /**
   * Genera una respuesta de la IA real basada en el contexto del chat y del proyecto
   * @param {string} projectId - ID del proyecto
   * @param {string} question - Pregunta del usuario
   * @param {string} chatId - ID del chat para obtener el contexto
   * @returns {Promise<string>} Respuesta de la IA
   */
  async generateAiResponse(projectId, question, chatId) {
    try {
      // Obtener el chat para ver su contexto
      const chats = await this.getProjectChats(projectId);
      const chat = chats.find(c => c.id === chatId);
      const recordingIds = chat?.contexto || [];
      
      // Llamar al servicio de IA con el contexto específico
      return await projectAiService.askProjectQuestion(projectId, question, recordingIds);
    } catch (error) {
      console.error('Error generando respuesta IA:', error);
      return "Lo siento, ha ocurrido un error al procesar tu pregunta.";
    }
  }
}

// Instancia singleton del servicio
const projectChatService = new ProjectChatService();

export default projectChatService;
