/**
 * Servicio para análisis IA del proyecto
 * Genera análisis reales basados en las grabaciones del proyecto
 */

import { callProvider } from './ai/providerRouter';
import { parseJsonObject } from '../utils/aiResponseParser';
import { projectAnalysisPrompt } from '../prompts/aiPrompts';

class ProjectAiService {
  constructor() {
    this.analysisCache = new Map(); // Cache por projectId
    this.analysisPromises = new Map(); // Promesas en vuelo para evitar llamadas simultáneas
  }

  /**
   * Método privado para asegurar que tenemos el análisis del proyecto
   * @param {string} projectId - ID del proyecto
   * @returns {Promise<Object>} Análisis completo del proyecto
   */
  async _ensureAnalysis(projectId) {
    // 1. Si ya tenemos datos en caché, devolverlos
    if (this.analysisCache.has(projectId)) {
      return this.analysisCache.get(projectId);
    }

    // 2. Si ya hay una petición en curso, devolver la promesa existente
    if (this.analysisPromises.has(projectId)) {
      return this.analysisPromises.get(projectId);
    }

    // 3. Iniciar nueva petición
    const analysisPromise = (async () => {
      try {
        console.log(`Iniciando análisis inteligente para proyecto ${projectId}...`);
        
        // Obtener grabaciones del proyecto
        const result = await window.electronAPI.getProjectRecordings(projectId);
        if (!result.success) throw new Error(result.error);
        
        const recordingIds = result.recordings;
        
        if (recordingIds.length === 0) {
          return this._getEmptyProjectData();
        }

        // Verificar si necesitamos re-analizar
        // Intentar cargar desde disco primero
        let cachedAnalysis = null;
        try {
          const diskResult = await window.electronAPI.getProjectAnalysis(projectId);
          if (diskResult.success && diskResult.analysis) {
            cachedAnalysis = diskResult.analysis;
          }
        } catch (e) {
          console.warn('No se pudo cargar análisis desde disco', e);
        }

        // Comprobar si las grabaciones han cambiado
        const currentRecordingIdsSet = new Set(recordingIds);
        const cachedRecordingIdsSet = new Set(cachedAnalysis?.analyzedRecordingIds || []);
        
        const areSetsEqual = (a, b) => a.size === b.size && [...a].every(value => b.has(value));
        const needsUpdate = !cachedAnalysis || !areSetsEqual(currentRecordingIdsSet, cachedRecordingIdsSet);

        if (!needsUpdate) {
          console.log(`Análisis de proyecto ${projectId} actualizado. Usando caché.`);
          this.analysisCache.set(projectId, cachedAnalysis);
          return cachedAnalysis;
        }

        console.log(`Detectados cambios en grabaciones. Regenerando análisis de proyecto...`);

        const summaries = [];
        const recordingsWithDates = [];

        // Importación dinámica para evitar ciclos de dependencia
        const { default: recordingsService } = await import('./recordingsService');

        const successfulRecordingIds = [];

        for (const recId of recordingIds) {
          try {
            // 1. Obtener resumen
            let summaryResult = await window.electronAPI.getAiSummary(recId);
            
            // 2. Si no existe, generarlo recursivamente
            if (!summaryResult.success || !summaryResult.summary) {
              console.log(`Generando resumen faltante para grabación ${recId} durante análisis de proyecto...`);
              try {
                // Generar análisis completo
                const newSummary = await recordingsService.generateFullAnalysis(recId);
                summaryResult = { success: true, summary: newSummary };
              } catch (genError) {
                console.error(`Error generando resumen para ${recId}:`, genError);
                // No agregamos a successfulRecordingIds, por lo que el análisis del proyecto
                // quedará "incompleto" respecto al total, forzando un reintento la próxima vez.
                continue; 
              }
            }

            if (summaryResult.success && summaryResult.summary) {
              recordingsWithDates.push({
                id: recId,
                summary: summaryResult.summary,
                date: recId 
              });
              successfulRecordingIds.push(recId);
            }
          } catch (err) {
            console.warn(`Error procesando grabación ${recId}`, err);
          }
        }

        if (recordingsWithDates.length === 0) {
          return this._getEmptyProjectData();
        }

        // Construir contexto con orden explícito
        const contextText = recordingsWithDates.map((rec, index) => 
          `Reunión #${index + 1} (ID: ${rec.id}):\n${JSON.stringify(rec.summary)}`
        ).join('\n\n-------------------\n\n');

        // Llamar a la IA (Gemini u Ollama)
        const analysis = await this._generateProjectAnalysis(contextText);
        
        // Añadir metadatos de control
        // IMPORTANTE: Guardamos solo los IDs que realmente entraron en el análisis.
        // Si hubo fallos, successfulRecordingIds será diferente de recordingIds (total),
        // por lo que la próxima vez areSetsEqual devolverá false y se reintentará.
        analysis.analyzedRecordingIds = successfulRecordingIds;
        analysis.lastAnalysisDate = new Date().toISOString();

        // Guardar en caché y en disco
        this.analysisCache.set(projectId, analysis);
        
        // Guardar en disco en segundo plano
        window.electronAPI.saveProjectAnalysis(projectId, analysis)
          .catch(err => console.error('Error guardando análisis en disco:', err));

        return analysis;

      } catch (error) {
        console.error('Error en _ensureAnalysis:', error);
        throw error;
      } finally {
        this.analysisPromises.delete(projectId);
      }
    })();

    this.analysisPromises.set(projectId, analysisPromise);
    return analysisPromise;
  }

  _getEmptyProjectData() {
    return {
      resumen_breve: "No hay suficiente información de grabaciones para generar un resumen.",
      resumen_extenso: "Este proyecto aún no tiene grabaciones analizadas con IA.",
      miembros: [],
      hitos: [],
      detalles: {
        fecha_inicio: new Date().toISOString().split('T')[0],
        grabaciones_analizadas: 0
      }
    };
  }

  /**
   * Obtiene un resumen del proyecto basado en todas las grabaciones
   * @param {string} projectId - ID del proyecto
   * @returns {Promise<Object>} Resumen del proyecto
   */
  async getProjectSummary(projectId) {
    const analysis = await this._ensureAnalysis(projectId);
    return {
      resumen_breve: analysis.resumen_breve,
      resumen_extenso: analysis.resumen_extenso,
      progreso: this._calculateProgress(analysis)
    };
  }

  _calculateProgress(analysis) {
    // Estimación simple basada en hitos completados
    if (!analysis.hitos || analysis.hitos.length === 0) return 0;
    const completed = analysis.hitos.filter(h => h.estado === 'completado').length;
    return Math.round((completed / analysis.hitos.length) * 100);
  }

  /**
   * Extrae los miembros del equipo, fusionando datos guardados y sugerencias de IA
   * @param {string} projectId - ID del proyecto
   * @returns {Promise<Array>} Lista de miembros del equipo
   */
  async getProjectMembers(projectId) {
    try {
      const { default: projectsService } = await import('./projectsService');
      const projects = await projectsService.getProjects();
      const project = projects.find(p => p.id === projectId || p.id == projectId);
      const savedMembers = project?.members || [];

      // 2. Obtener análisis de IA
      const analysis = await this._ensureAnalysis(projectId);
      const aiMembers = analysis.miembros || [];

      // 3. Fusionar: Mantener guardados, añadir nuevos de IA como sugerencias
      // Si un miembro de IA ya existe en guardados (por nombre), usamos el guardado.
      // Si no existe, lo añadimos y lo guardamos automáticamente (según requerimiento usuario)
      
      let hasChanges = false;
      const finalMembers = [...savedMembers];

      for (const aiMember of aiMembers) {
        const exists = finalMembers.find(m => m.name.toLowerCase() === aiMember.name.toLowerCase());
        if (!exists) {
          // Nuevo miembro detectado por IA
          finalMembers.push({
            id: Date.now() + Math.random(), // ID temporal único
            name: aiMember.name,
            role: aiMember.role,
            initials: aiMember.initials || aiMember.name.substring(0, 2).toUpperCase(),
            isAiSuggestion: true, // Flag para indicar origen
            participaciones: aiMember.participaciones,
            avatar_color: this._getRandomColor(finalMembers.length)
          });
          hasChanges = true;
        }
      }

      // 4. Si hubo nuevos miembros de IA, guardar en DB automáticamente
      if (hasChanges) {
        console.log('Guardando nuevos miembros detectados por IA en el proyecto...');
        await projectsService.updateProject(projectId, { 
          name: project.name,
          description: project.description,
          members: finalMembers 
        });
      }

      return finalMembers;
    } catch (error) {
      console.error('Error gestionando miembros:', error);
      return [];
    }
  }

  /**
   * Actualiza la lista de miembros del proyecto
   * @param {string} projectId 
   * @param {Array} members 
   */
  async updateProjectMembers(projectId, members) {
    const { default: projectsService } = await import('./projectsService');
    const projects = await projectsService.getProjects();
    const project = projects.find(p => p.id === projectId || p.id == projectId);
    await projectsService.updateProject(projectId, { 
      name: project.name,
      description: project.description,
      members 
    });
    return members;
  }

  _getRandomColor(index) {
    const colors = ["#e92932", "#8b5cf6", "#10b981", "#f59e0b", "#3b82f6", "#ec4899"];
    return colors[index % colors.length];
  }

  /**
   * Obtiene los aspectos destacados y timeline del proyecto
   * @param {string} projectId - ID del proyecto
   * @returns {Promise<Array>} Lista de hitos y aspectos destacados
   */
  async getProjectHighlights(projectId) {
    const analysis = await this._ensureAnalysis(projectId);
    return (analysis.hitos || []).map((h, index) => ({
      id: h.id || index + 1,
      semana: h.semana,
      titulo: h.titulo,
      descripcion: h.descripcion,
      fecha: h.fecha,
      estado: h.estado,
      icono: h.icono || "📅"
    }));
  }

  /**
   * Actualiza los aspectos destacados del proyecto (edición manual)
   * @param {string} projectId 
   * @param {Array} highlights 
   */
  async updateProjectHighlights(projectId, highlights) {
    const analysis = await this._ensureAnalysis(projectId);
    analysis.hitos = highlights;
    
    // Guardar en caché y disco
    this.analysisCache.set(projectId, analysis);
    await window.electronAPI.saveProjectAnalysis(projectId, analysis);
    return highlights;
  }

  /**
   * Obtiene los detalles clave del proyecto
   * @param {string} projectId - ID del proyecto
   * @returns {Promise<Object>} Detalles del proyecto
   */
  async getProjectDetails(projectId) {
    const analysis = await this._ensureAnalysis(projectId);
    
    return {
      fecha_inicio: analysis.detalles?.fecha_inicio || analysis.lastAnalysisDate?.split('T')[0] || new Date().toISOString().split('T')[0],
      grabaciones_analizadas: (analysis.analyzedRecordingIds || []).length,
      ultima_actividad: analysis.lastAnalysisDate
    };
  }

  /**
   * Pregunta a la IA sobre el proyecto con contexto real
   * @param {string} projectId - ID del proyecto
   * @param {string} question - Pregunta del usuario
   * @param {Array} recordingIds - IDs de grabaciones para el contexto
   * @returns {Promise<string>} Respuesta de la IA
   */
  async askProjectQuestion(projectId, question, recordingIds = []) {
    try {
      const analysis = await this._ensureAnalysis(projectId);
      
      // 1. Recopilar transcripciones/resúmenes de las grabaciones seleccionadas
      let contextText = `Información General del Proyecto:\n${analysis.resumen_breve}\n\n`;
      
      if (recordingIds.length > 0) {
        contextText += "Contexto específico de grabaciones seleccionadas:\n";
        for (const recId of recordingIds) {
          const summaryResult = await window.electronAPI.getAiSummary(recId);
          if (summaryResult.success && summaryResult.summary) {
            contextText += `- Grabación ${recId}:\n${JSON.stringify(summaryResult.summary)}\n\n`;
          }
        }
      }

      const prompt = `Actúa como un asistente experto en el proyecto. Utiliza el siguiente contexto para responder a la pregunta del usuario.

Contexto del Proyecto:
${contextText}

Pregunta del usuario:
${question}

Instrucciones:
1. Responde de forma clara y profesional en Español.
2. Si la información no está en el contexto, indícalo educadamente.
3. Utiliza formato Markdown para mejorar la legibilidad.`;

      const result = await callProvider(prompt);
      return result.text || "No he podido generar una respuesta en este momento.";
    } catch (error) {
      console.error('Error en askProjectQuestion:', error);
      return "Error al procesar la consulta con la IA.";
    }
  }

  /**
   * Obtiene los resúmenes individuales de las grabaciones del proyecto
   * @param {string} projectId 
   * @returns {Promise<Array>} Lista de grabaciones con sus resúmenes
   */
  async getProjectRecordingSummaries(projectId) {
    try {
      const result = await window.electronAPI.getProjectRecordings(projectId);
      if (!result.success) return [];
      
      const recordingIds = result.recordings;
      const summaries = [];

      for (const recId of recordingIds) {
        try {
          // Intentar obtener info básica (nombre de carpeta/path)
          const recResult = await window.electronAPI.getRecordingById(recId);
          const title = recResult.success ? recResult.recording.relative_path : `Grabación ${recId}`;

          const summaryResult = await window.electronAPI.getAiSummary(recId);
          
          if (summaryResult.success && summaryResult.summary) {
            summaries.push({
              id: recId,
              title: title,
              date: null,
              summary: summaryResult.summary
            });
          }
        } catch (e) {
          console.warn(`Error cargando resumen para ${recId}`, e);
        }
      }
      
      return summaries;
    } catch (error) {
      console.error('Error obteniendo resúmenes de grabaciones:', error);
      return [];
    }
  }

  /**
   * Genera el análisis del proyecto usando el proveedor configurado
   * @param {string} contextText
   * @returns {Promise<Object>}
   */
  async _generateProjectAnalysis(contextText) {
    const prompt = projectAnalysisPrompt(contextText);
    const result = await callProvider(prompt);

    if (!result.text || result.text === 'Sin respuesta') {
      throw new Error('Respuesta vacía del proveedor de IA');
    }

    const parsed = parseJsonObject(result.text);
    if (!parsed) {
      console.error('Error parseando JSON de análisis de proyecto. Texto recibido:', result.text);
      throw new Error('La IA no devolvió un JSON válido');
    }

    return parsed;
  }

  /**
   * Fuerza la regeneración del análisis (útil si se añaden nuevas grabaciones)
   * @param {string} projectId 
   */
  clearCache(projectId) {
    this.analysisCache.delete(projectId);
  }
}

// Instancia singleton del servicio
const projectAiService = new ProjectAiService();

export default projectAiService;
