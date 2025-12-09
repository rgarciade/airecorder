/**
 * Servicio centralizado para gestión de IA de grabaciones
 * Punto de entrada único para verificar, generar y guardar resúmenes de IA
 */

import appSessionService from './appSessionService';
import recordingsService from './recordingsService';
import { getSettings } from './settingsService';
import { sendToGemini } from './ai/geminiProvider';
import { generateContent as ollamaGenerate } from './ai/ollamaProvider';
import { detailedSummaryPrompt, shortSummaryPrompt, keyPointsPrompt } from '../prompts/aiPrompts';

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
        const detailedResponse = await this._callAiProvider(detailedSummaryPrompt, txt);
        detailedText = detailedResponse.text || '';
      }

      // Generar resumen corto y puntos clave en paralelo (si están solicitados)
      const generationPromises = [];
      
      if (options.summaries) {
        console.log('📝 Generando resumen breve...');
        generationPromises.push(
          this._callAiProvider(shortSummaryPrompt, detailedText || txt).then(r => ({ type: 'summary', text: r.text || '' }))
        );
      }
      
      if (options.keyTopics) {
        console.log('🔑 Generando key topics...');
        generationPromises.push(
          this._callAiProvider(keyPointsPrompt, detailedText || txt).then(r => ({ type: 'keyPoints', text: r.text || '' }))
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
   * Llama al proveedor de IA configurado (Gemini u Ollama)
   * @private
   * @param {string} prompt 
   * @param {string} context 
   * @returns {Promise<Object>} Respuesta de la IA
   */
  async _callAiProvider(prompt, context) {
    const settings = await getSettings();
    const provider = settings.aiProvider || 'gemini';

    const fullPrompt = `${prompt}\n\nTranscripción:\n${context}`;

    if (provider === 'ollama') {
      const model = settings.ollamaModel;
      if (!model) {
        throw new Error('No se ha seleccionado un modelo de Ollama en los ajustes.');
      }
      const response = await ollamaGenerate(model, fullPrompt);
      return {
        text: response || 'Sin respuesta',
        provider: 'ollama'
      };
    } else {
      // Gemini - usar fullPrompt para que incluya las instrucciones
      const response = await sendToGemini(fullPrompt);
      const text = response?.candidates?.[0]?.content?.parts?.[0]?.text || 'Sin respuesta';
      return {
        text: text,
        provider: 'gemini'
      };
    }
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

      // Importar prompt de participantes
      const { participantsPrompt } = await import('../prompts/aiPrompts');
      
      // Llamar a la IA para extraer participantes
      const participantsResponse = await this._callAiProvider(participantsPrompt, txt);
      
      // Parsear respuesta JSON
      let extractedParticipants = [];
      try {
        let cleanText = participantsResponse.text.trim();
        
        // Limpiar markdown si existe
        cleanText = cleanText.replace(/```json\s*/g, '').replace(/```\s*/g, '');
        
        // Intentar encontrar el array JSON en la respuesta
        // Buscar el primer [ y el último ]
        const firstBracket = cleanText.indexOf('[');
        const lastBracket = cleanText.lastIndexOf(']');
        
        if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
          cleanText = cleanText.substring(firstBracket, lastBracket + 1);
        }
        
        // Intentar parsear
        extractedParticipants = JSON.parse(cleanText);
        
        // Validar que sea un array
        if (!Array.isArray(extractedParticipants)) {
          console.warn('La respuesta no es un array, usando array vacío');
          extractedParticipants = [];
        }
      } catch (e) {
        console.error('Error parseando participantes:', e);
        console.log('Respuesta completa recibida:', participantsResponse.text);
        
        // Intentar extraer manualmente si el JSON está malformado
        try {
          const text = participantsResponse.text;
          const nameMatches = text.match(/"name"\s*:\s*"([^"]+)"/g);
          const roleMatches = text.match(/"role"\s*:\s*"([^"]+)"/g);
          
          if (nameMatches && roleMatches && nameMatches.length === roleMatches.length) {
            extractedParticipants = nameMatches.map((nameMatch, idx) => {
              const name = nameMatch.match(/"name"\s*:\s*"([^"]+)"/)[1];
              const role = roleMatches[idx].match(/"role"\s*:\s*"([^"]+)"/)[1];
              return { name, role };
            });
            console.log('✅ Participantes extraídos manualmente:', extractedParticipants);
          }
        } catch (manualError) {
          console.error('Error en extracción manual:', manualError);
        }
        
        return [];
      }
      
      // Agregar IDs a los participantes y marcar como creados por IA
      const participantsWithIds = extractedParticipants.map((p, idx) => ({
        id: Date.now() + idx,
        name: p.name || 'Sin nombre',
        role: p.role || 'Participante',
        createdByAi: true
      }));
      
      return participantsWithIds;
    } catch (error) {
      console.error('Error extrayendo participantes:', error);
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
