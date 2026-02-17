// Servicio unificado para gestionar llamadas a IA (Gemini u Ollama)
// Wrapper sobre providerRouter para mantener compatibilidad con consumidores existentes

import { callProvider, validateProviderConfig } from './ai/providerRouter';

/**
 * Procesa el texto de respuesta para extraer puntos clave en formato --|-- punto --|-- texto
 * @param {string} text - Texto de respuesta de la IA
 * @returns {Object} { processedText, keyPoints }
 */
function processResponseWithKeyPoints(text) {
  if (!text) {
    return { processedText: text, keyPoints: {} };
  }

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

  if (Object.keys(keyPoints).length > 0) {
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
  const response = await callProvider(prompt);

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
 * Valida la configuración del proveedor de IA actual
 * @returns {Promise<Object>} {valid: boolean, error: string}
 */
export async function validateAiConfig() {
  return await validateProviderConfig();
}
