/**
 * Servicio centralizado para gestión de IA de grabaciones
 * Punto de entrada único para verificar, generar y guardar resúmenes de IA
 */

import appSessionService from './appSessionService';
import recordingsService from './recordingsService';
import { getSettings } from './settingsService';
import { callProvider, getActiveProviderContextWindow } from './ai/providerRouter';
import { AI_TASK_TYPES } from './ai/aiQueueService';
import { cleanAiResponse, parseJsonArray, parseJsonObject } from '../utils/aiResponseParser';
import { detailedSummaryPrompt, shortSummaryPrompt, keyPointsPrompt, participantsPrompt, participantsPromptSuffix, taskSuggestionsPrompt, taskSuggestionsPromptSuffix, taskImprovementPrompt, consolidateSummaryPrompt } from '../prompts/aiPrompts';

class RecordingAiService {
  constructor() {
    this.summaryCache = new Map(); // Cache de resúmenes en memoria
    this.generatingPromises = new Map(); // Promesas de generación en curso
    this.participantsPromises = new Map(); // Promesas de extracción de participantes
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
   * @param {Object} providerOverrides - Proveedor temporal para esta llamada sin modificar settings.
   *   Ejemplo: { providerOverride: 'ollama', model: 'llama3' }
   * @returns {Promise<Object>} Resumen generado
   */
  async generateRecordingSummary(recordingId, transcriptionTxt = null, force = false, options = { summaries: true, keyTopics: true, detailedSummary: true }, providerOverrides = {}) {
    // 0. Verificación síncrona de promesa en memoria (evita condiciones de carrera)
    if (!force && this.generatingPromises.has(recordingId)) {
      console.log(`⏳ Ya hay una generación en curso para ${recordingId}, reutilizando promesa.`);
      return this.generatingPromises.get(recordingId);
    }

    // Verificar si ya se está generando (a menos que sea force)
    if (!force) {
      const isGenerating = await this.isGenerating(recordingId);
      if (isGenerating) {
        throw new Error('Ya se está generando un resumen para esta grabación');
      }
    }

    // Crear promesa de generación
    const generationPromise = this._performGeneration(recordingId, transcriptionTxt, options, providerOverrides);
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
   * Calcula el límite de caracteres según la ventana de contexto del proveedor
   * @param {Object} settings - Configuración actual
   * @param {number} promptOverheadTokens - Margen de seguridad para el prompt (por defecto 800)
   * @returns {Promise<number>} Número máximo de caracteres permitidos
   */
  async _calculateMaxContextChars(settings, promptOverheadTokens = 800) {
    const isCloudProvider = ['gemini', 'geminifree', 'deepseek', 'kimi'].includes(settings.aiProvider);
    if (isCloudProvider) {
      return Number.MAX_SAFE_INTEGER; // Los proveedores cloud no necesitan chunking/truncado
    }
    
    const detectedCtx = await getActiveProviderContextWindow(settings);
    const numCtx = detectedCtx || 4096; // Fallback: mínimo habitual en modelos locales
    const responseReserve = Math.max(512, Math.floor(numCtx * 0.25)); // Espacio para la respuesta del modelo
    const maxChars = Math.max(4000, (numCtx - promptOverheadTokens - responseReserve) * 4);
    
    return maxChars;
  }

  /**
   * Realiza la generación del resumen (método privado)
   * @private
   * @param {Object} options - Opciones de qué generar: { summaries, keyTopics, detailedSummary }
   * @param {Object} providerOverrides - Override temporal de proveedor/modelo { providerOverride, model }
   */
  async _performGeneration(recordingId, transcriptionTxt, options = { summaries: true, keyTopics: true, detailedSummary: true }, providerOverrides = {}) {
    try {
      // 1. Guardar estado de generación
      const currentSessionId = appSessionService.getSessionId();
      await this._saveGeneratingState(recordingId, {
        recordingId,
        appSessionId: currentSessionId,
        startedAt: new Date().toISOString(),
        status: 'generating'
      });

      // Leer idioma de respuesta desde los ajustes del usuario
      const settings = await getSettings();
      const lang = settings.uiLanguage || 'es';

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
      const recName = await this._getRecordingName(recordingId);
      console.log(`🤖 Generando resumen para ${recordingId} (${recName}) en idioma: ${lang}...`, options);

      let detailedText = existing.resumen_detallado || '';
      let shortSummaryText = existing.resumen_breve || '';
      let keyPointText = existing.key_points || '';
      let ideas = existing.ideas || [];

      // Generar resumen detallado primero (si está solicitado) - contexto para los demás
      if (options.detailedSummary) {
        console.log('📋 Generando resumen detallado...');

        // Optimización para transcripciones muy largas (Map-Reduce básico).
        const CHUNK_SIZE = await this._calculateMaxContextChars(settings, 800);
        console.log(`📐 Límite de contexto calculado: ${CHUNK_SIZE} caracteres`);

        if (txt && txt.length > CHUNK_SIZE) {
          console.log(`⚠️ Transcripción muy larga (${txt.length} chars). Dividiendo en fragmentos para procesar...`);
          
          const chunks = this._chunkText(txt, CHUNK_SIZE);
          let combinedPartialSummaries = '';
          const globalStartTime = new Date(); // Capturar tiempo de inicio global
          const groupId = `summary_${recordingId}_${Date.now()}`; // ID de grupo para enlazar llamadas
          
          // Procesar fragmentos secuencialmente para no saturar la RAM/VRAM local
          for (let i = 0; i < chunks.length; i++) {
            console.log(`  🧩 Procesando fragmento ${i + 1}/${chunks.length}...`);
            const chunkPrompt = `A continuación se presenta un fragmento de una transcripción de reunión (Parte ${i + 1}/${chunks.length}). Por favor, genera un resumen detallado y puntos clave de esta sección específica.\n\nTranscripción:\n${chunks[i]}`;
            
            const partialResult = await this._callAiProvider(chunkPrompt, null, {
              ...providerOverrides,
              queueMeta: { 
                name: `Resumen detallado (Parte ${i + 1}/${chunks.length}): ${recName}`, 
                type: AI_TASK_TYPES.DETAILED_SUMMARY,
                groupId: groupId,
                groupIndex: i,
                groupTotal: chunks.length,
                startTime: globalStartTime
              }
            });
            combinedPartialSummaries += partialResult.text + '\n\n';
          }

          // Si hay MUCHOS fragmentos, combinedPartialSummaries también podría superar el contexto.
          // En ese caso, lo truncamos o hacemos una segunda pasada de reducción.
          if (combinedPartialSummaries.length > CHUNK_SIZE) {
            console.log('🔄 Consolidando resúmenes parciales...');
            const consolidatePrompt = consolidateSummaryPrompt(lang);
            const finalDetailedResult = await this._callAiProvider(consolidatePrompt, combinedPartialSummaries.substring(0, CHUNK_SIZE * 1.5), {
              ...providerOverrides,
              queueMeta: { name: `Consolidación final: ${recName}`, type: AI_TASK_TYPES.DETAILED_SUMMARY }
            });
            detailedText = finalDetailedResult.text;
          } else {
            detailedText = combinedPartialSummaries;
          }
        } else {
          // Caso normal: transcripción cabe en el contexto
          const detailedResult = await this._callAiProvider(detailedSummaryPrompt(lang), txt, {
            ...providerOverrides,
            queueMeta: { name: `Resumen detallado: ${recName}`, type: AI_TASK_TYPES.DETAILED_SUMMARY }
          });
          detailedText = detailedResult.text;
        }
      }

      // Generar resumen breve e ideas (si está solicitado)
      if (options.summaries || options.keyTopics) {
        console.log('📝 Generando resumen breve y puntos clave...');
        
        // Ahora pasamos los resúmenes combinados (ya reducidos a un tamaño seguro) como contexto para el final
        // para que la respuesta sea más coherente y rápida.
        const maxCharsForShort = await this._calculateMaxContextChars(settings, 1200);
        
        const shortTasks = [];
        
        if (options.summaries) {
          let contextForShort = detailedText || txt;
          if (contextForShort.length > maxCharsForShort) {
            console.warn(`⚠️ Texto demasiado largo para resumen breve/puntos clave (${contextForShort.length} > ${maxCharsForShort}). Truncando...`);
            contextForShort = contextForShort.substring(0, maxCharsForShort);
          }

          shortTasks.push(
            this._callAiProvider(shortSummaryPrompt(lang), contextForShort, {
              ...providerOverrides,
              queueMeta: { name: `Resumen breve: ${recName}`, type: AI_TASK_TYPES.SUMMARY }
            }).then(res => shortSummaryText = res.text)
          );
        }

        if (options.keyTopics) {
          let contextForShort = detailedText || txt;
          if (contextForShort.length > maxCharsForShort) {
            contextForShort = contextForShort.substring(0, maxCharsForShort);
          }

          shortTasks.push(
            this._callAiProvider(keyPointsPrompt(lang), contextForShort, {
              ...providerOverrides,
              queueMeta: { name: `Puntos clave: ${recName}`, type: AI_TASK_TYPES.KEY_POINTS }
            }).then(res => {
              keyPointText = res.text;
              ideas = parseJsonArray(res.text, ['keyPoints', 'puntos_clave', 'ideas']);
            })
          );
        }

        await Promise.all(shortTasks);
      }

      // 5. Consolidar y guardar
      const finalSummary = {
        resumen_breve: shortSummaryText,
        resumen_detallado: detailedText,
        key_points: keyPointText,
        ideas: ideas,
        lastUpdated: new Date().toISOString()
      };

      // Guardar en disco
      await recordingsService.saveAiSummary(recordingId, finalSummary);
      
      // Actualizar caché
      this.summaryCache.set(recordingId, finalSummary);

      // 6. Limpiar estado de generación
      await this._clearGeneratingState(recordingId);

      return finalSummary;

    } catch (error) {
      console.error('Error en _performGeneration:', error);
      await this._clearGeneratingState(recordingId);
      throw error;
    }
  }

  /**
   * Extrae participantes de una transcripción usando IA
   * @param {string} recordingId
   * @param {Object} providerOverrides - Override temporal de proveedor/modelo { providerOverride, model }
   * @returns {Promise<Array>} Lista de participantes extraídos
   */
  async extractParticipants(recordingId, providerOverrides = {}) {
    // 0. Verificación síncrona para evitar doble extracción simultánea
    if (this.participantsPromises.has(recordingId)) {
      console.log(`⏳ Ya hay una extracción de participantes en curso para ${recordingId}, reutilizando promesa.`);
      return this.participantsPromises.get(recordingId);
    }

    const extractionPromise = (async () => {
      try {
        const recName = await this._getRecordingName(recordingId);
        // Obtener transcripción
        const txt = await recordingsService.getTranscriptionTxt(recordingId);

        if (!txt) {
          throw new Error('No se pudo obtener el texto de la transcripción');
        }

        // Intentar obtener el resumen detallado para usarlo como contexto (es más corto y preciso)
        let contextText = txt;
        try {
          const existingSummary = await this.getRecordingSummary(recordingId);
          if (existingSummary && existingSummary.resumen_detallado && existingSummary.resumen_detallado.length > 50) {
            console.log(`👥 Usando resumen detallado como contexto para extraer participantes en vez de transcripción completa.`);
            contextText = existingSummary.resumen_detallado;
          }
        } catch (e) {
          console.warn('No se pudo cargar el resumen para los participantes, usando transcripción original.');
        }

        // Leer idioma de ajustes
        const settings = await getSettings();
        const lang = settings.uiLanguage || 'es';

        // Asegurar que el contexto no exceda la ventana máxima del modelo
        const maxChars = await this._calculateMaxContextChars(settings, 500);
        if (contextText.length > maxChars) {
          console.warn(`⚠️ Texto demasiado largo para extraer participantes (${contextText.length} > ${maxChars}). Truncando...`);
          contextText = contextText.substring(0, maxChars);
        }

        // Construir prompt sándwich
        const combinedPrompt = `${participantsPrompt(lang)}\n${contextText}\n${participantsPromptSuffix}`;

        // Llamar a la IA con contexto null y forzando formato JSON para Ollama
        const participantsResponse = await this._callAiProvider(combinedPrompt, null, {
          ...providerOverrides,
          format: 'json',
          queueMeta: { name: `Participantes: ${recName}`, type: AI_TASK_TYPES.PARTICIPANTS },
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

            if (!name || name.toLowerCase() === 'sin nombre') {
                return null;
            }

            return {
              id: Date.now() + idx,
              name: name,
              role: role,
              createdByAi: true
            };
          })
          .filter(p => p !== null);
        
        return participantsWithIds;
      } catch (error) {
        console.error('Error extrayendo participantes:', error);
        return [];
      } finally {
        this.participantsPromises.delete(recordingId);
      }
    })();

    this.participantsPromises.set(recordingId, extractionPromise);
    return extractionPromise;
  }

  /**
   * Genera sugerencias de tareas a partir de la transcripción
   * @param {string} recordingId
   * @returns {Promise<Array>} Lista de tareas generadas [{title, content, createdByAi}]
   */
  async generateTaskSuggestions(recordingId) {
    try {
      const recName = await this._getRecordingName(recordingId);
      const txt = await recordingsService.getTranscriptionTxt(recordingId);
      if (!txt) {
        throw new Error('No se pudo obtener el texto de la transcripción');
      }

      // Intentar obtener el resumen detallado para usarlo como contexto (es más corto y preciso para sugerir tareas)
      let contextText = txt;
      try {
        const existingSummary = await this.getRecordingSummary(recordingId);
        if (existingSummary && existingSummary.resumen_detallado && existingSummary.resumen_detallado.length > 50) {
          console.log(`📋 Usando resumen detallado como contexto para generar tareas en vez de transcripción completa.`);
          contextText = existingSummary.resumen_detallado;
        }
      } catch (e) {
        console.warn('No se pudo cargar el resumen para las tareas, usando transcripción original.');
      }

      // Leer idioma de ajustes
      const settings = await getSettings();
      const lang = settings.uiLanguage || 'es';

      // Asegurar que el contexto no exceda la ventana máxima del modelo
      const maxChars = await this._calculateMaxContextChars(settings, 800);
      if (contextText.length > maxChars) {
        console.warn(`⚠️ Texto demasiado largo para sugerir tareas (${contextText.length} > ${maxChars}). Truncando...`);
        contextText = contextText.substring(0, maxChars);
      }

      const combinedPrompt = `${taskSuggestionsPrompt(lang)}\n${contextText}\n${taskSuggestionsPromptSuffix}`;
      const response = await this._callAiProvider(combinedPrompt, null, {
        format: 'json',
        queueMeta: { name: `Tareas: ${recName}`, type: AI_TASK_TYPES.TASK_SUGGESTIONS },
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

      if (rawTasks.length === 0) {
        return [];
      }

      // Normalizar tareas
      const tasksWithIds = rawTasks.map((t, idx) => {
        const layer = t.layer || t.capa || t._layerFromKey || 'frontend';
        return {
          id: `ai_task_${Date.now()}_${idx}`,
          title: t.title || t.titulo || `Tarea ${idx + 1}`,
          content: t.content || t.contenido || t.description || t.descripcion || '',
          layer: validLayers.includes(layer.toLowerCase()) ? layer.toLowerCase() : 'frontend',
          status: 'pending',
          createdByAi: true
        };
      }).filter(t => t.title && t.title.length > 2);

      return tasksWithIds;

    } catch (error) {
      console.error('Error sugiriendo tareas:', error);
      return [];
    }
  }

  /**
   * Mejora una tarea específica usando IA
   * @param {string} recordingId 
   * @param {Object} task 
   * @returns {Promise<Object>} Tarea mejorada
   */
  async improveTask(recordingId, task) {
    try {
      const recName = await this._getRecordingName(recordingId);
      // Obtener contexto (preferiblemente resumen detallado)
      let contextText = await recordingsService.getTranscriptionTxt(recordingId);
      try {
        const summary = await this.getRecordingSummary(recordingId);
        if (summary && summary.resumen_detallado) {
          contextText = summary.resumen_detallado;
        }
      } catch (e) { /* ignore */ }

      // Leer idioma de ajustes
      const settings = await getSettings();
      const lang = settings.uiLanguage || 'es';
      
      const maxChars = await this._calculateMaxContextChars(settings, 1000);
      if (contextText.length > maxChars) {
        contextText = contextText.substring(0, maxChars);
      }

      const prompt = taskImprovementPrompt(task.title, task.content, contextText, lang);
      const response = await this._callAiProvider(prompt, null, {
        format: 'json',
        queueMeta: { name: `Mejorar tarea: ${task.title}`, type: AI_TASK_TYPES.TASK_IMPROVEMENT },
      });

      const improved = parseJsonObject(response.text);
      if (!improved) throw new Error('No se pudo parsear la mejora de la tarea');

      return {
        ...task,
        title: improved.title || improved.titulo || task.title,
        content: improved.content || improved.contenido || improved.description || improved.descripcion || task.content,
        layer: (improved.layer || improved.capa || task.layer).toLowerCase()
      };
    } catch (error) {
      console.error('Error mejorando tarea:', error);
      return task;
    }
  }

  /**
   * Método de utilidad para llamar al proveedor de IA configurado
   * @private
   */
  async _callAiProvider(prompt, context, options = {}) {
    let fullPrompt = prompt;
    if (context) {
      fullPrompt = `${prompt}\n\nTranscripción:\n${context}`;
    }

    return await callProvider(fullPrompt, options);
  }

  /**
   * Obtiene el nombre de la grabación
   * @private
   */
  async _getRecordingName(recordingId) {
    try {
      const rec = await recordingsService.getRecordingById(recordingId);
      return rec?.name || recordingId;
    } catch {
      return recordingId;
    }
  }

  /**
   * Divide un texto en fragmentos (chunks)
   * @private
   */
  _chunkText(text, size) {
    const chunks = [];
    let start = 0;
    while (start < text.length) {
      chunks.push(text.substring(start, start + size));
      start += size;
    }
    return chunks;
  }
}

// Instancia singleton
const recordingAiService = new RecordingAiService();
export default recordingAiService;
