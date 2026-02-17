/**
 * Utilidades para parsear respuestas de IA (Gemini/Ollama)
 * Centraliza la limpieza de tags, markdown code blocks y extracción de JSON
 */

/**
 * Limpia texto de respuesta de IA: quita <think> tags y markdown code blocks
 * @param {string} text - Texto crudo de la IA
 * @returns {string} Texto limpio
 */
export function cleanAiResponse(text) {
  if (!text) return '';
  let clean = text.trim();
  clean = clean.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  clean = clean.replace(/```json\s*/g, '').replace(/```\s*/g, '');
  return clean.trim();
}

/**
 * Extrae y parsea un array JSON de una respuesta de IA
 * Soporta respuestas envueltas en objetos con claves comunes (tasks, participants, items, etc.)
 * @param {string} text - Respuesta cruda de la IA
 * @param {string[]} wrapperKeys - Claves posibles si el array viene envuelto en un objeto
 * @returns {Array} Array parseado, o [] si falla
 */
export function parseJsonArray(text, wrapperKeys = []) {
  try {
    const clean = cleanAiResponse(text);

    const firstBracket = clean.indexOf('[');
    const lastBracket = clean.lastIndexOf(']');

    let parsed;
    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
      parsed = JSON.parse(clean.substring(firstBracket, lastBracket + 1));
    } else {
      parsed = JSON.parse(clean);
    }

    // Si ya es un array, retornarlo
    if (Array.isArray(parsed)) return parsed;

    // Si es un objeto, buscar el array en las claves conocidas
    if (parsed && typeof parsed === 'object') {
      for (const key of wrapperKeys) {
        if (Array.isArray(parsed[key])) return parsed[key];
      }
    }

    return [];
  } catch {
    return [];
  }
}

/**
 * Extrae y parsea un objeto JSON de una respuesta de IA
 * @param {string} text - Respuesta cruda de la IA
 * @returns {Object|null} Objeto parseado, o null si falla
 */
export function parseJsonObject(text) {
  try {
    const clean = cleanAiResponse(text);

    const firstBrace = clean.indexOf('{');
    const lastBrace = clean.lastIndexOf('}');

    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      return JSON.parse(clean.substring(firstBrace, lastBrace + 1));
    }

    return JSON.parse(clean);
  } catch {
    return null;
  }
}
