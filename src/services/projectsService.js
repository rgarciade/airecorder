/**
 * Servicio para gestionar proyectos y sus relaciones con grabaciones
 */

class ProjectsService {
  /**
   * Obtiene todos los proyectos
   * @returns {Promise<Array>} Lista de proyectos
   */
  async getProjects() {
    try {
      if (!window.electronAPI?.getProjects) {
        throw new Error('API de Electron no disponible');
      }

      const result = await window.electronAPI.getProjects();
      
      if (!result.success) {
        throw new Error(result.error || 'Error obteniendo proyectos');
      }

      return result.projects || [];

    } catch (error) {
      console.error('Error obteniendo proyectos:', error);
      return [];
    }
  }

  /**
   * Crea un nuevo proyecto
   * @param {Object} projectData - Datos del proyecto (name, description)
   * @returns {Promise<Object>} Proyecto creado
   */
  async createProject(projectData) {
    try {
      if (!window.electronAPI?.createProject) {
        throw new Error('API de Electron no disponible');
      }

      const result = await window.electronAPI.createProject(projectData);
      
      if (!result.success) {
        throw new Error(result.error || 'Error creando proyecto');
      }

      return result.project;

    } catch (error) {
      console.error('Error creando proyecto:', error);
      throw error;
    }
  }

  /**
   * Actualiza un proyecto existente
   * @param {string} projectId - ID del proyecto
   * @param {Object} projectData - Datos del proyecto a actualizar
   * @returns {Promise<Object>} Proyecto actualizado
   */
  async updateProject(projectId, projectData) {
    try {
      if (!window.electronAPI?.updateProject) {
        throw new Error('API de Electron no disponible');
      }

      const result = await window.electronAPI.updateProject(projectId, projectData);
      
      if (!result.success) {
        throw new Error(result.error || 'Error actualizando proyecto');
      }

      return result.project;

    } catch (error) {
      console.error('Error actualizando proyecto:', error);
      throw error;
    }
  }

  /**
   * Elimina un proyecto
   * @param {string} projectId - ID del proyecto a eliminar
   * @returns {Promise<boolean>} True si se eliminó correctamente
   */
  async deleteProject(projectId) {
    try {
      if (!window.electronAPI?.deleteProject) {
        throw new Error('API de Electron no disponible');
      }

      const result = await window.electronAPI.deleteProject(projectId);
      
      if (!result.success) {
        throw new Error(result.error || 'Error eliminando proyecto');
      }

      return true;

    } catch (error) {
      console.error('Error eliminando proyecto:', error);
      throw error;
    }
  }

  /**
   * Agrega una grabación a un proyecto
   * @param {string} projectId - ID del proyecto
   * @param {string} recordingId - ID de la grabación
   * @returns {Promise<Object>} Objeto con success, wasReassigned, previousProject
   */
  async addRecordingToProject(projectId, recordingId) {
    try {
      if (!window.electronAPI?.addRecordingToProject) {
        throw new Error('API de Electron no disponible');
      }

      const result = await window.electronAPI.addRecordingToProject(projectId, recordingId);
      
      if (!result.success) {
        throw new Error(result.error || 'Error agregando grabación al proyecto');
      }

      return {
        success: true,
        wasReassigned: result.wasReassigned || false,
        previousProject: result.previousProject || null
      };

    } catch (error) {
      console.error('Error agregando grabación al proyecto:', error);
      throw error;
    }
  }

  /**
   * Elimina una grabación de un proyecto
   * @param {string} projectId - ID del proyecto
   * @param {string} recordingId - ID de la grabación
   * @returns {Promise<boolean>} True si se eliminó correctamente
   */
  async removeRecordingFromProject(projectId, recordingId) {
    try {
      if (!window.electronAPI?.removeRecordingFromProject) {
        throw new Error('API de Electron no disponible');
      }

      const result = await window.electronAPI.removeRecordingFromProject(projectId, recordingId);
      
      if (!result.success) {
        throw new Error(result.error || 'Error eliminando grabación del proyecto');
      }

      return true;

    } catch (error) {
      console.error('Error eliminando grabación del proyecto:', error);
      throw error;
    }
  }

  /**
   * Obtiene todas las grabaciones de un proyecto específico
   * @param {string} projectId - ID del proyecto
   * @returns {Promise<Array>} Lista de IDs de grabaciones
   */
  async getProjectRecordings(projectId) {
    try {
      if (!window.electronAPI?.getProjectRecordings) {
        throw new Error('API de Electron no disponible');
      }

      const result = await window.electronAPI.getProjectRecordings(projectId);
      
      if (!result.success) {
        throw new Error(result.error || 'Error obteniendo grabaciones del proyecto');
      }

      return result.recordings || [];

    } catch (error) {
      console.error('Error obteniendo grabaciones del proyecto:', error);
      return [];
    }
  }

  /**
   * Obtiene el proyecto al que pertenece una grabación
   * @param {string} recordingId - ID de la grabación
   * @returns {Promise<Object|null>} Proyecto o null si no pertenece a ninguno
   */
  async getRecordingProject(recordingId) {
    try {
      if (!window.electronAPI?.getRecordingProject) {
        throw new Error('API de Electron no disponible');
      }

      const result = await window.electronAPI.getRecordingProject(recordingId);
      
      if (!result.success) {
        return null;
      }

      return result.project;

    } catch (error) {
      console.error('Error obteniendo proyecto de la grabación:', error);
      return null;
    }
  }
}

// Instancia singleton del servicio
const projectsService = new ProjectsService();

export default projectsService;

