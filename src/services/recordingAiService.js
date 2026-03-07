/**
 * Servicio centralizado para gestión de IA de grabaciones
 * Punto de entrada único para verificar, generar y guardar resúmenes de IA
 */

import appSessionService from './appSessionService';
import recordingsService from './recordingsService';
import { callProvider } from './ai/providerRouter';
import { AI_TASK_TYPES } from './ai/aiQueueService';
import { cleanAiResponse, parseJsonArray, parseJsonObject } from '../utils/aiResponseParser';
import { detailedSummaryPrompt, shortSummaryPrompt, keyPointsPrompt, participantsPrompt, participantsPromptSuffix, taskSuggestionsPrompt, taskSuggestionsPromptSuffix, taskImprovementPrompt } from '../prompts/aiPrompts';

class RecordingAiService {
  constructor() {
    this.summaryCache = new Map(); // Cache de resúmenes en memoria
    this.generatingPromises = new Map(); // Promesas de generación en curso
  }

  /**
   * Verifica si existe un archivo de estado de generación
   * @param {string} recordingId 
   * @returns {Promise<Object|null>} Estado de generación o null
   */
  async _getGeneratingState(recordingId) {
    try {
      if (!window.electronAPI?.getGeneratingState) {
        return null;
      }
      const result = await window.electronAPI.getGeneratingState(recordingId);
      return result.success ? result.state : null;
    } catch (error) {
      console.error('Error obteniendo estado de generación:', error);
      return null;
    }
  }

  /**
   * Guarda el estado de generación
   * @param {string} recordingId 
   * @param {Object} state 
   */
  async _saveGeneratingState(recordingId, state) {
    try {
      if (!window.electronAPI?.saveGeneratingState) {
        return false;
      }
      const result = await window.electronAPI.saveGeneratingState(recordingId, state);
      return result.success;
    } catch (error) {
      console.error('Error guardando estado de generación:', error);
      return false;
    }
  }

  /**
   * Elimina el archivo de estado de generación
   * @param {string} recordingId 
   */
  async _clearGeneratingState(recordingId) {
    try {
      if (!window.electronAPI?.clearGeneratingState) {
        return false;
      }
      const result = await window.electronAPI.clearGeneratingState(recordingId);
      return result.success;
    } catch (error) {
      console.error('Error limpiando estado de generación:', error);
      return false;
    }
  }

  /**
   * Verifica si se está generando un resumen para esta grabación
   * @param {string} recordingId 
   * @returns {Promise<boolean>} true si está en proceso de generación
   */
  async isGenerating(recordingId) {
    // 1. Verificar si hay promesa en memoria
    if (this.generatingPromises.has(recordingId)) {
      return true;
    }

    // 2. Verificar archivo de estado
    const state = await this._getGeneratingState(recordingId);
    if (!state) {
      return false;
    }

    // 3. Verificar si el appSessionId coincide
    const currentSessionId = appSessionService.getSessionId();
    if (state.appSessionId !== currentSessionId) {
      // La app se reinició, limpiar estado obsoleto
      console.log(`🔄 Limpiando estado de generación obsoleto para ${recordingId}`);
      await this._clearGeneratingState(recordingId);
      return false;
    }

    return true;
  }

  /**
   * Cancela la generación en progreso (para reintentos)
   * @param {string} recordingId 
   */
  async cancelGeneration(recordingId) {
    console.log(`🔄 Cancelando generación para ${recordingId}`);
    
    // Limpiar promesa en memoria
    this.generatingPromises.delete(recordingId);
    
    // Limpiar archivo de estado
    await this._clearGeneratingState(recordingId);
    
    return true;
  }

  /**
   * Obtiene el resumen guardado de una grabación
   * @param {string} recordingId 
   * @returns {Promise<Object|null>} Resumen o null si no existe
   */
  async getRecordingSummary(recordingId) {
    // 1. Verificar caché
    if (this.summaryCache.has(recordingId)) {
      return this.summaryCache.get(recordingId);
    }

    // 2. Leer del archivo
    const summary = await recordingsService.getAiSummary(recordingId);
    
    // 3. Limpiar ideas si tienen el formato --|--
    if (summary && summary.ideas && Array.isArray(summary.ideas)) {
      summary.ideas = summary.ideas.map(idea => {
        if (typeof idea === 'string') {
          // Limpiar formato --|-- número --|-- texto
          let cleaned = idea.replace(/^--\|--\s*\d+\s*--\|--\s*/, '');
          // Limpiar otros formatos comunes
          cleaned = cleaned.replace(/^[•-]\s*|^\d+\.\s*/, '');
          return cleaned.trim();
        }
        return idea;
      }).filter(idea => idea && idea.length > 0);
    }
    
    // 4. Guardar en caché si existe
    if (summary) {
      this.summaryCache.set(recordingId, summary);
    }

    return summary;
  }

  /**
   * Asegura que existe un resumen para la grabación, generándolo si es necesario
   * @param {string} recordingId 
   * @returns {Promise<Object>} Resumen de la grabación
   */
  async ensureRecordingSummary(recordingId) {
    // 0. Verificación síncrona de promesa en memoria (evita condiciones de carrera)
    if (this.generatingPromises.has(recordingId)) {
      console.log(`⏳ Ya se está generando resumen (memoria) para ${recordingId}`);
      return this.generatingPromises.get(recordingId);
    }

    // 1. Verificar si ya existe
    const existing = await this.getRecordingSummary(recordingId);
    if (existing && existing.resumen_breve && Array.isArray(existing.ideas)) {
      return existing;
    }

    // 2. Verificar si ya se está generando
    const isGenerating = await this.isGenerating(recordingId);
    if (isGenerating) {
      console.log(`⏳ Ya se está generando resumen para ${recordingId}`);
      // Esperar a que termine la generación en curso
      if (this.generatingPromises.has(recordingId)) {
        return await this.generatingPromises.get(recordingId);
      }
      // Si no hay promesa en memoria pero hay estado, retornar null
      // (la UI mostrará el estado de "generando")
      return null;
    }

    // 3. Generar nuevo resumen
    return await this.generateRecordingSummary(recordingId);
  }

  /**
   * Genera un nuevo resumen para la grabación
   * @param {string} recordingId 
   * @param {string} transcriptionTxt - Texto opcional para evitar doble lectura
   * @param {boolean} force - Forzar regeneración aunque exista
   * @param {Object} options - Opciones de qué generar: { summaries, keyTopics, detailedSummary }
   * @returns {Promise<Object>} Resumen generado
   */
  async generateRecordingSummary(recordingId, transcriptionTxt = null, force = false, options = { summaries: true, keyTopics: true, detailedSummary: true }) {
    // Verificar si ya se está generando (a menos que sea force)
    if (!force) {
      const isGenerating = await this.isGenerating(recordingId);
      if (isGenerating) {
        throw new Error('Ya se está generando un resumen para esta grabación');
      }
    }

    // Crear promesa de generación
    const generationPromise = this._performGeneration(recordingId, transcriptionTxt, options);
    this.generatingPromises.set(recordingId, generationPromise);

    try {
      const result = await generationPromise;
      return result;
    } finally {
      // Limpiar promesa al terminar (éxito o error)
      this.generatingPromises.delete(recordingId);
    }
  }

  /**
   * Realiza la generación del resumen (método privado)
   * @private
   * @param {Object} options - Opciones de qué generar: { summaries, keyTopics, detailedSummary }
   */
  async _performGeneration(recordingId, transcriptionTxt, options = { summaries: true, keyTopics: true, detailedSummary: true }) {
    try {
      // 1. Guardar estado de generación
      const currentSessionId = appSessionService.getSessionId();
      await this._saveGeneratingState(recordingId, {
        recordingId,
        appSessionId: currentSessionId,
        startedAt: new Date().toISOString(),
        status: 'generating'
      });

      // 2. Obtener texto de transcripción
      let txt = transcriptionTxt;
      if (!txt) {
        txt = await recordingsService.getTranscriptionTxt(recordingId);
      }
      
      if (!txt) {
        throw new Error('No se pudo obtener el texto de la transcripción');
      }

      // 3. Cargar resumen existente para preservar datos no regenerados
      const existing = await this.getRecordingSummary(recordingId) || {};
      
      // 4. Generar resúmenes usando el proveedor de IA configurado
      console.log(`🤖 Generando resumen para ${recordingId}...`, options);
      
      let detailedText = existing.resumen_detallado || '';
      let shortSummaryText = existing.resumen_breve || '';
      let keyPointText = existing.key_points || '';
      let ideas = existing.ideas || [];

      // Generar resumen detallado primero (si está solicitado) - contexto para los demás
      if (options.detailedSummary) {
        console.log('📋 Generando resumen detallado...');
        const detailedResponse = await this._callAiProvider(detailedSummaryPrompt, txt, {
          queueMeta: { name: 'Resumen detallado', type: AI_TASK_TYPES.DETAILED_SUMMARY },
        });
        detailedText = detailedResponse.text || '';
      }

      // Generar resumen corto y puntos clave en paralelo (si están solicitados)
      const generationPromises = [];

      if (options.summaries) {
        console.log('📝 Generando resumen breve...');
        generationPromises.push(
          this._callAiProvider(shortSummaryPrompt, detailedText || txt, {
            queueMeta: { name: 'Resumen breve', type: AI_TASK_TYPES.SUMMARY },
          }).then(r => ({ type: 'summary', text: r.text || '' }))
        );
      }

      if (options.keyTopics) {
        console.log('🔑 Generando key topics...');
        generationPromises.push(
          this._callAiProvider(keyPointsPrompt, detailedText || txt, {
            queueMeta: { name: 'Key Topics', type: AI_TASK_TYPES.KEY_TOPICS },
          }).then(r => ({ type: 'keyPoints', text: r.text || '' }))
        );
      }

      // Esperar todas las generaciones en paralelo
      const results = await Promise.all(generationPromises);
      
      // Procesar resultados
      results.forEach(result => {
        if (result.type === 'summary') {
          shortSummaryText = result.text;
        } else if (result.type === 'keyPoints') {
          keyPointText = result.text;
        }
      });

      // 5. Procesar ideas solo si se generaron key topics
      if (options.keyTopics && keyPointText) {
        ideas = keyPointText.split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0)
          .map(line => {
            // Limpiar formato --|-- número --|-- texto
            let cleaned = line.replace(/^--\|--\s*\d+\s*--\|--\s*/, '');
            // Limpiar otros formatos comunes
            cleaned = cleaned.replace(/^[•-]\s*|^\d+\.\s*/, '');
            return cleaned;
          })
          .filter(line => line.length > 0); // Filtrar líneas vacías después de limpiar
      }

      // 6. Crear objeto de resumen (preservar datos no regenerados)
      const dataToSave = {
        resumen_breve: shortSummaryText,
        ideas: ideas,
        resumen_detallado: detailedText,
        key_points: keyPointText,
        resumen_corto: shortSummaryText
      };

      // 7. Guardar en archivo
      await recordingsService.saveAiSummary(recordingId, dataToSave);
      
      // 8. Guardar en caché
      this.summaryCache.set(recordingId, dataToSave);

      // 9. Limpiar estado de generación
      await this._clearGeneratingState(recordingId);

      // 10. Indexar para RAG en background (no bloquea)
      this._indexForRAG(recordingId);

      console.log(`✅ Resumen generado exitosamente para ${recordingId}`);
      return dataToSave;

    } catch (error) {
      console.error(`❌ Error generando resumen para ${recordingId}:`, error);
      
      // Limpiar estado de generación en caso de error
      await this._clearGeneratingState(recordingId);
      
      throw error;
    }
  }

  /**
   * Indexa la transcripción para RAG en background
   * @private
   * @param {string} recordingId
   */
  _indexForRAG(recordingId) {
    if (!window.electronAPI?.indexRecording) return;

    window.electronAPI.indexRecording(recordingId)
      .then(result => {
        if (result.success && result.indexed) {
          console.log(`🔍 [RAG] Indexado ${recordingId}: ${result.totalChunks} chunks`);
        } else if (result.skippedRag) {
          console.log(`🔍 [RAG] Skip para ${recordingId}: transcripción corta`);
        } else if (result.error) {
          console.warn(`🔍 [RAG] No se pudo indexar ${recordingId}: ${result.error}`);
        }
      })
      .catch(err => {
        console.warn(`🔍 [RAG] Error indexando ${recordingId}:`, err.message);
      });
  }

  /**
   * Llama al proveedor de IA configurado (Gemini u Ollama)
   * @private
   * @param {string} prompt
   * @param {string|null} context - Contexto opcional. Si es null, se asume que prompt ya tiene todo.
   * @param {Object} options - Opciones adicionales (ej: { format: 'json' })
   * @returns {Promise<Object>} Respuesta de la IA {text, provider}
   */
  async _callAiProvider(prompt, context, options = {}) {
    let fullPrompt = prompt;
    if (context) {
      fullPrompt = `${prompt}\n\nTranscripción:\n${context}`;
    }
    return await callProvider(fullPrompt, options);
  }

  /**
   * Extrae participantes de una transcripción usando IA
   * @param {string} recordingId 
   * @returns {Promise<Array>} Lista de participantes extraídos
   */
  async extractParticipants(recordingId) {
    try {
      // Obtener transcripción
      const txt = await recordingsService.getTranscriptionTxt(recordingId);
      
      if (!txt) {
        throw new Error('No se pudo obtener el texto de la transcripción');
      }

      // Construir prompt sándwich
      const combinedPrompt = `${participantsPrompt}\n${txt}\n${participantsPromptSuffix}`;
      
      // Llamar a la IA con contexto null y forzando formato JSON para Ollama
      const participantsResponse = await this._callAiProvider(combinedPrompt, null, {
        format: 'json',
        queueMeta: { name: 'Extracción de participantes', type: AI_TASK_TYPES.PARTICIPANTS },
      });
      
      // Parsear respuesta JSON con utilidad centralizada
      let extractedParticipants = parseJsonArray(
        participantsResponse.text,
        ['participants', 'participantes']
      );

      // Fallback: si parseJsonArray retorna vacío, intentar extracción por regex
      if (extractedParticipants.length === 0) {
        console.warn('Parsing JSON de participantes falló, intentando fallback regex...');
        const cleanResponseForFallback = cleanAiResponse(participantsResponse.text);
        const lines = cleanResponseForFallback.split('\n');
        const listRegex = /^[\*\-\+]\s+([^\(:\n]+)(?:[\(:\s]+([^\)\n]+)\)?)?/;

        const fallbackParticipants = [];

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (trimmedLine.match(/^[\*\-]?\s*(Personajes|Participantes|Speakers|Nombres):/i)) continue;

          const match = trimmedLine.match(listRegex);
          if (match) {
            const name = match[1].trim();
            let role = match[2] ? match[2].trim() : 'Participante';
            role = role.replace(/[\)\:]$/, '');

            if (name.length > 1 && !name.toLowerCase().includes("ninguno")) {
              fallbackParticipants.push({ name, role });
            }
          }
        }

        if (fallbackParticipants.length > 0) {
          console.log('✅ Participantes extraídos vía Fallback (Regex):', fallbackParticipants);
          extractedParticipants = fallbackParticipants;
        } else {
          // Último intento: búsqueda manual de pares "name":"value"
          try {
            const nameMatches = cleanResponseForFallback.match(/"name"\s*:\s*"([^"]+)"/g);
            const roleMatches = cleanResponseForFallback.match(/"role"\s*:\s*"([^"]+)"/g);

            if (nameMatches && roleMatches && nameMatches.length === roleMatches.length) {
              extractedParticipants = nameMatches.map((nameMatch, idx) => {
                const name = nameMatch.match(/"name"\s*:\s*"([^"]+)"/)[1];
                const role = roleMatches[idx].match(/"role"\s*:\s*"([^"]+)"/)[1];
                return { name, role };
              });
            }
          } catch (manualError) { /* Ignorar error final */ }
        }
      }
      
      // Agregar IDs a los participantes y marcar como creados por IA
      // Normalizar estructura (puede venir como string simple o objeto)
      const participantsWithIds = extractedParticipants
        .map((p, idx) => {
          let name = null;
          let role = '';

          if (typeof p === 'string' && p.trim().length > 0) {
              name = p.trim();
          } else if (typeof p === 'object' && p !== null) {
              if (p.name && typeof p.name === 'string' && p.name.trim().length > 0) {
                  name = p.name.trim();
              }
              if (p.role && typeof p.role === 'string') {
                  role = p.role.trim();
              }
          }

          // Si no hay nombre válido, descartar
          if (!name || name.toLowerCase() === 'sin nombre') {
              return null;
          }

          return {
            id: Date.now() + idx,
            name: name,
            role: role, // Dejar vacío si no hay rol, no poner "Participante" por defecto
            createdByAi: true
          };
        })
        .filter(p => p !== null);
      
      return participantsWithIds;
    } catch (error) {
      console.error('Error extrayendo participantes:', error);
      throw error;
    }
  }

  /**
   * Genera sugerencias de tareas a partir de la transcripción
   * @param {string} recordingId
   * @returns {Promise<Array>} Lista de tareas generadas [{title, content, createdByAi}]
   */
  async generateTaskSuggestions(recordingId) {
    try {
      const txt = await recordingsService.getTranscriptionTxt(recordingId);
      if (!txt) {
        throw new Error('No se pudo obtener el texto de la transcripción');
      }

      const combinedPrompt = `${taskSuggestionsPrompt}\n${txt}\n${taskSuggestionsPromptSuffix}`;
      const response = await this._callAiProvider(combinedPrompt, null, {
        format: 'json',
        queueMeta: { name: 'Sugerencias de tareas', type: AI_TASK_TYPES.TASK_SUGGESTIONS },
      });

      const validLayers = ['frontend', 'backend', 'fullstack'];

      let rawTasks = parseJsonArray(response.text, ['tasks', 'tareas', 'items', 'data']);

      // Fallback: la IA a veces devuelve un objeto agrupado por capa {"frontend": [...], "backend": [...]}
      if (rawTasks.length === 0) {
        const grouped = parseJsonObject(response.text);
        if (grouped && typeof grouped === 'object' && !Array.isArray(grouped)) {
          for (const layerKey of validLayers) {
            if (Array.isArray(grouped[layerKey])) {
              rawTasks = rawTasks.concat(
                grouped[layerKey].map(t => ({ ...t, _layerFromKey: layerKey }))
              );
            }
          }
        }
      }

      return rawTasks
        .filter(t => t && typeof t === 'object' && (t.title || t.titulo || t.nombre || t.name))
        .map(t => {
          const title = (t.title || t.titulo || t.nombre || t.name || '').trim();
          const desc = (t.content || t.description || t.descripcion || t.detalles || t.detail || '').trim();
          const extra = (t.detalles && t.descripcion && t.detalles !== t.descripcion)
            ? `\n\n${t.detalles.trim()}`
            : '';
          const content = desc + extra;
          const rawLayer = (t._layerFromKey || t.layer || t.capa || t.tipo || 'general').toLowerCase().trim();
          const layer = validLayers.includes(rawLayer) ? rawLayer : 'general';
          return { title, content, layer, createdByAi: true };
        });
    } catch (error) {
      console.error('Error generando sugerencias de tareas:', error);
      throw error;
    }
  }

  /**
   * Mejora una tarea individual usando IA con instrucciones del usuario
   * @param {Object} task - Tarea a mejorar {id, title, content}
   * @param {string} userInstructions - Instrucciones del usuario
   * @returns {Promise<Object>} Tarea mejorada con id preservado
   */
  async improveTaskSuggestion(task, userInstructions) {
    try {
      const prompt = taskImprovementPrompt(userInstructions);
      const fullPrompt = `${prompt}\n${JSON.stringify({ title: task.title, content: task.content }, null, 2)}`;

      const response = await this._callAiProvider(fullPrompt, null, {
        format: 'json',
        queueMeta: { name: `Mejora de tarea: ${task.title}`, type: AI_TASK_TYPES.TASK_IMPROVEMENT },
      });

      const improved = parseJsonObject(response.text);
      if (!improved) {
        throw new Error('No se pudo parsear la respuesta de IA');
      }

      return {
        ...task,
        title: (improved.title || task.title).trim(),
        content: (improved.content || task.content).trim()
      };
    } catch (error) {
      console.error('Error mejorando tarea:', error);
      throw error;
    }
  }

  /**
   * Limpia la caché de resúmenes
   */
  clearCache() {
    this.summaryCache.clear();
  }
}

// Instancia singleton del servicio
const recordingAiService = new RecordingAiService();

export default recordingAiService;
