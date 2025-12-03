// Servicio unificado para gestionar llamadas a IA (Gemini u Ollama)

import { getSettings } from './settingsService';
import { generateContent as ollamaGenerate } from './ollamaService';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

/**
 * Procesa el texto de respuesta para extraer puntos clave en formato --|-- punto --|-- texto
 * @param {string} text - Texto de respuesta de la IA
 * @returns {Object} { processedText, keyPoints }
 */
function processResponseWithKeyPoints(text) {
  if (!text) {
    return { processedText: text, keyPoints: {} };
  }

  // Buscar patrones de puntos clave: --|-- punto --|-- texto
  const keyPointPattern = /--\|--\s*([^|]+?)\s*--\|--\s*([^|]+?)(?=\s*--\|--|$)/g;
  const keyPoints = {};
  let processedText = text;

  let match;
  while ((match = keyPointPattern.exec(text)) !== null) {
    const point = match[1].trim();
    const description = match[2].trim();
    
    if (point && description) {
      keyPoints[point] = description;
    }
  }

  // Si se encontraron puntos clave, limpiar el texto original
  if (Object.keys(keyPoints).length > 0) {
    // Remover las líneas que contienen los puntos clave del texto principal
    processedText = text.replace(keyPointPattern, '').trim();
  }

  return { processedText, keyPoints };
}

/**
 * Genera contenido usando el proveedor de IA configurado
 * @param {string} prompt - Prompt para la IA
 * @returns {Promise<Object>} Respuesta de la IA en formato normalizado
 */
export async function generateContent(prompt) {
  const settings = await getSettings();
  const provider = settings.aiProvider || 'gemini';
debugger
  let response;
  if (provider === 'ollama') {
    response = await generateWithOllama(prompt, settings);
  } else if (provider === 'gemini'){
    response = await generateWithGemini(prompt, settings);
  }
  debugger;

  // Procesar la respuesta para extraer puntos clave
  const { processedText, keyPoints } = processResponseWithKeyPoints(response.text);
  
  return {
    ...response,
    text: processedText,
    keyPoints: keyPoints
  };
}

/**
 * Genera contenido con contexto de transcripción
 * @param {string} prompt - Prompt base
 * @param {string} transcriptionText - Texto de la transcripción
 * @returns {Promise<Object>} Respuesta de la IA
 */
export async function generateWithContext(prompt, transcriptionText) {
  const fullPrompt = `${prompt}\n\nTranscripción:\n${transcriptionText}`;
  return await generateContent(fullPrompt);
}

/**
 * Genera contenido usando Gemini
 * @private
 */
async function generateWithGemini(prompt, settings) {
  const GEMINI_API_KEY = settings.geminiApiKey;
  
  if (!GEMINI_API_KEY) {
    throw new Error('No se ha configurado la Gemini API Key en los ajustes.');
  }

  const body = {
    contents: [
      { parts: [{ text: prompt }] }
    ]
  };

  const response = await fetch(GEMINI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-goog-api-key': GEMINI_API_KEY,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Error en la API de Gemini: ${response.status}`);
  }

  const data = await response.json();
  
  // Normalizar respuesta de Gemini
  return {
    text: data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Sin respuesta',
    provider: 'gemini',
    rawData: data
  };
}

/**
 * Genera contenido usando Ollama
 * @private
 */
async function generateWithOllama(prompt, settings) {
  const model = settings.ollamaModel;
  
  if (!model) {
    throw new Error('No se ha seleccionado un modelo de Ollama en los ajustes.');
  }
console.log('Generating with Ollama', model, prompt);
  const response = await ollamaGenerate(model, prompt);
  
  // Normalizar respuesta de Ollama
  return {
    text: response || 'Sin respuesta',
    provider: 'ollama',
    rawData: { response }
  };
}

/**
 * Valida la configuración del proveedor de IA actual
 * @returns {Promise<Object>} {valid: boolean, error: string}
 */
export async function validateAiConfig() {
  try {
    const settings = await getSettings();
    const provider = settings.aiProvider || 'gemini';

    if (provider === 'gemini') {
      if (!settings.geminiApiKey) {
        return { valid: false, error: 'Falta configurar la Gemini API Key' };
      }
    } else if (provider === 'ollama') {
      if (!settings.ollamaModel) {
        return { valid: false, error: 'Falta seleccionar un modelo de Ollama' };
      }
    }

    return { valid: true, error: null };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

