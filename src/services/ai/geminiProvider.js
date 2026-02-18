// Servicio para interactuar con la API de Gemini de Google

import { getSettings } from '../settingsService';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

const getGeminiUrl = (model, streaming = false) => {
  const endpoint = streaming ? 'streamGenerateContent' : 'generateContent';
  return `${GEMINI_API_BASE}/models/${model}:${endpoint}`;
};

/**
 * Obtiene la lista de modelos Gemini disponibles para la API Key configurada
 * Filtra solo modelos de texto que soportan generateContent
 * @param {string} apiKey - API Key de Gemini
 * @returns {Promise<Array>} Lista de modelos disponibles
 */
export async function getGeminiAvailableModels(apiKey) {
  if (!apiKey) {
    throw new Error('Se requiere una API Key para obtener los modelos');
  }

  try {
    const response = await fetch(`${GEMINI_API_BASE}/models?key=${apiKey}&pageSize=100`);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Error al obtener modelos: ${response.status} ${errorData.error?.message || ''}`);
    }

    const data = await response.json();
    
    // Filtrar solo modelos de TEXTO que soportan generateContent
    const models = (data.models || [])
      .filter(model => {
        const name = model.name || '';
        // Solo modelos Gemini
        if (!name.startsWith('models/gemini')) return false;
        
        // Debe soportar generateContent
        if (!model.supportedGenerationMethods?.includes('generateContent')) return false;
        
        // EXCLUIR modelos de embedding, vision-only, o especializados
        const modelId = name.replace('models/', '').toLowerCase();
        
        // Excluir modelos de embedding
        if (modelId.includes('embedding')) return false;
        
        // Excluir modelos que son solo para visión/imagen (si terminan en -vision sin soporte de texto)
        // Nota: gemini-pro-vision SÍ soporta texto + imagen, así que lo incluimos
        
        // Excluir modelos avery (específicos de tuning)
        if (modelId.includes('avery')) return false;
        
        // Excluir modelos experimentales o deprecated
        if (modelId.includes('deprecated') || modelId.includes('experimental')) return false;
        
        return true;
      })
      .map(model => {
        const name = model.name.replace('models/', '');
        
        // Crear etiqueta amigable
        let label = model.displayName || name;
        
        // Simplificar nombres largos
        if (label.includes('Gemini 1.0 Pro')) label = 'Gemini 1.0 Pro';
        else if (label.includes('Gemini 1.5 Pro')) label = 'Gemini 1.5 Pro';
        else if (label.includes('Gemini 1.5 Flash')) label = 'Gemini 1.5 Flash';
        else if (label.includes('Gemini 2.0 Flash')) {
          if (label.includes('Lite')) label = 'Gemini 2.0 Flash Lite';
          else label = 'Gemini 2.0 Flash';
        }
        
        // Determinar si es modelo de visión
        const isVision = name.toLowerCase().includes('vision') || 
                        model.supportedGenerationMethods?.includes('generateImages');
        
        return {
          name: name,
          label: label + (isVision ? ' (Multimodal)' : ''),
          description: model.description || `Modelo Gemini para generación de texto${isVision ? ' e imágenes' : ''}`,
          version: model.version,
          supportedMethods: model.supportedGenerationMethods,
          inputTokenLimit: model.inputTokenLimit,
          outputTokenLimit: model.outputTokenLimit
        };
      })
      .sort((a, b) => {
        // Ordenar: modelos más nuevos primero (2.0 > 1.5 > 1.0)
        const getVersion = (name) => {
          if (name.includes('2.0')) return 3;
          if (name.includes('1.5')) return 2;
          if (name.includes('1.0')) return 1;
          return 0;
        };
        
        const versionA = getVersion(a.name);
        const versionB = getVersion(b.name);
        
        if (versionA !== versionB) return versionB - versionA;
        
        // Dentro de la misma versión: Flash antes que Pro
        if (a.name.includes('Flash') && !b.name.includes('Flash')) return -1;
        if (!a.name.includes('Flash') && b.name.includes('Flash')) return 1;
        
        return 0;
      });

    console.log(`[Gemini] ${models.length} modelos de texto disponibles encontrados`);
    models.forEach(m => console.log(`  - ${m.name}: ${m.label}`));
    
    return models;
  } catch (error) {
    console.error('Error obteniendo modelos de Gemini:', error);
    throw error;
  }
}

// Prompt fijo en español para resumen e ideas
const defaultPrompt = `A continuación tienes una transcripción. Quiero que me des dos resúmenes y una lista de ideas principales o temas destacados que se mencionan.\n\nResponde en formato JSON con la siguiente estructura:\n\n{\n  "resumen_breve": "Resumen muy breve (1-2 frases)",\n  "resumen_extenso": "Resumen más detallado (varios párrafos si es necesario)",\n  "ideas": [\n    "Idea o tema 1",\n    "Idea o tema 2",\n    "Idea o tema 3"\n  ]\n}\n\nSi la transcripción está vacía, responde con un JSON vacío.`;

/**
 * Envía el texto a Gemini con manejo de reintentos para errores 429
 * @param {string} textContent - El contenido a enviar (prompt + contexto o solo contexto)
 * @param {boolean} isRaw - Si es true, envía textContent tal cual. Si es false, le añade el defaultPrompt.
 * @param {boolean} useFreeTier - Si es true, usa geminiFreeApiKey en lugar de geminiApiKey
 * @returns {Promise<Object>} - Respuesta de Gemini
 */
export async function sendToGemini(textContent, isRaw = false, useFreeTier = false) {
  const MAX_RETRIES = 3;
  const BASE_DELAY = 2000; // 2 segundos

  const settings = await getSettings();
  // Usar geminiFreeApiKey si está configurado y se solicita el tier gratuito
  const GEMINI_API_KEY = useFreeTier && settings.geminiFreeApiKey 
    ? settings.geminiFreeApiKey 
    : settings.geminiApiKey;
  
  // Usar geminiFreeModel si se solicita el tier gratuito
  const geminiModel = useFreeTier && settings.geminiFreeModel
    ? settings.geminiFreeModel
    : (settings.geminiModel || 'gemini-2.0-flash');
  
  if (!GEMINI_API_KEY) {
    const keyType = useFreeTier ? 'Gemini Free' : 'Gemini';
    throw new Error(`No se ha configurado la ${keyType} API Key en los ajustes.`);
  }

  // Construir el cuerpo de la petición
  const finalPrompt = isRaw ? textContent : `${defaultPrompt}\n\nTranscripción:\n${textContent}`;
  
  const body = {
    contents: [
      { parts: [
          { text: finalPrompt }
        ]
      }
    ]
  };

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const apiUrl = getGeminiUrl(geminiModel, false);
      console.log(`[Gemini] Usando modelo: ${geminiModel} (${useFreeTier ? 'Free tier' : 'Pro'})`);
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-goog-api-key': GEMINI_API_KEY,
        },
        body: JSON.stringify(body),
      });

      if (response.status === 429) {
        throw new Error('429 Too Many Requests');
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Error en la API de Gemini: ${response.status} ${errorData.error?.message || ''}`);
      }

      const data = await response.json();
      return data;

    } catch (error) {
      const isLastAttempt = attempt === MAX_RETRIES - 1;
      
      if (error.message.includes('429') && !isLastAttempt) {
        const delay = BASE_DELAY * Math.pow(2, attempt); // Backoff exponencial: 2s, 4s, 8s
        console.warn(`⚠️ Gemini 429 (Límite excedido). Reintentando en ${delay/1000}s... (Intento ${attempt + 1}/${MAX_RETRIES})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      console.error('Error enviando a Gemini:', error);
      throw error;
    }
  }
}

/**
 * Envía el texto a Gemini en modo streaming
 * @param {string} textContent - El contenido a enviar (prompt + contexto)
 * @param {Function} onChunk - Callback que recibe cada chunk de texto
 * @param {boolean} useFreeTier - Si es true, usa geminiFreeApiKey en lugar de geminiApiKey
 * @returns {Promise<string>} - Texto completo de la respuesta
 */
export async function sendToGeminiStreaming(textContent, onChunk, useFreeTier = false) {
  const MAX_RETRIES = 3;
  const BASE_DELAY = 2000;

  const settings = await getSettings();
  // Usar geminiFreeApiKey si está configurado y se solicita el tier gratuito
  const GEMINI_API_KEY = useFreeTier && settings.geminiFreeApiKey 
    ? settings.geminiFreeApiKey 
    : settings.geminiApiKey;
  
  // Usar geminiFreeModel si se solicita el tier gratuito
  const geminiModel = useFreeTier && settings.geminiFreeModel
    ? settings.geminiFreeModel
    : (settings.geminiModel || 'gemini-2.0-flash');
  
  if (!GEMINI_API_KEY) {
    const keyType = useFreeTier ? 'Gemini Free' : 'Gemini';
    throw new Error(`No se ha configurado la ${keyType} API Key en los ajustes.`);
  }

  const body = {
    contents: [
      { parts: [{ text: textContent }] }
    ]
  };

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const streamingUrl = getGeminiUrl(geminiModel, true);
      console.log(`[Gemini Streaming] Usando modelo: ${geminiModel} (${useFreeTier ? 'Free tier' : 'Pro'})`);
      
      const response = await fetch(streamingUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-goog-api-key': GEMINI_API_KEY,
        },
        body: JSON.stringify(body),
      });

      if (response.status === 429) {
        throw new Error('429 Too Many Requests');
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Error en la API de Gemini: ${response.status} ${errorData.error?.message || ''}`);
      }

      // Procesar el stream SSE (Server-Sent Events)
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // Guardar la última línea incompleta

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            const dataStr = trimmed.slice(6);
            if (dataStr === '[DONE]') continue;
            
            try {
              const data = JSON.parse(dataStr);
              const chunk = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
              if (chunk) {
                fullResponse += chunk;
                if (onChunk) onChunk(chunk);
              }
            } catch (e) {
              // Ignorar líneas que no son JSON válido
            }
          }
        }
      }

      return fullResponse;

    } catch (error) {
      const isLastAttempt = attempt === MAX_RETRIES - 1;
      
      if (error.message.includes('429') && !isLastAttempt) {
        const delay = BASE_DELAY * Math.pow(2, attempt);
        console.warn(`⚠️ Gemini 429 (Límite excedido). Reintentando en ${delay/1000}s... (Intento ${attempt + 1}/${MAX_RETRIES})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      console.error('Error en streaming de Gemini:', error);
      throw error;
    }
  }
}
