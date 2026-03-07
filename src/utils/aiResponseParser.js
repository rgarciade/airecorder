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
 * Extrae y parsea un array JSON de una respuesta de IA.
 * Usa tracking de profundidad de corchetes para encontrar el primer array JSON
 * válido y no-vacío, ignorando corchetes que formen parte del texto (ej: timestamps
 * [00:01:30] o referencias [1] que podrían confundir al parser anterior).
 *
 * @param {string} text - Respuesta cruda de la IA
 * @param {string[]} wrapperKeys - Claves posibles si el array viene envuelto en un objeto
 * @returns {Array} Array parseado, o [] si falla
 */
export function parseJsonArray(text, wrapperKeys = []) {
  if (!text) return [];

  const clean = cleanAiResponse(text);
  if (!clean) return [];

  // Recorre el texto buscando cada `[` como posible inicio de un array JSON.
  // Para cada candidato, hace matching real de corchetes respetando strings,
  // y luego intenta parsear. Devuelve el primer array no-vacío encontrado.
  let searchFrom = 0;
  while (searchFrom < clean.length) {
    const start = clean.indexOf('[', searchFrom);
    if (start === -1) break;

    let depth = 0;
    let inString = false;
    let escaped = false;
    let end = -1;

    for (let i = start; i < clean.length; i++) {
      const ch = clean[i];
      if (escaped) { escaped = false; continue; }
      if (ch === '\\' && inString) { escaped = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === '[') depth++;
      else if (ch === ']') {
        depth--;
        if (depth === 0) { end = i; break; }
      }
    }

    if (end !== -1) {
      try {
        const candidate = clean.substring(start, end + 1);
        const parsed = JSON.parse(candidate);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        // Array vacío [] → seguir buscando
      } catch {
        // No era JSON válido → seguir buscando desde el siguiente `[`
      }
    }

    searchFrom = start + 1;
  }

  // Fallback 1: intentar parsear el texto completo como JSON
  try {
    const parsed = JSON.parse(clean);
    if (Array.isArray(parsed)) return parsed;

    // Si es un objeto envolvente, buscar en las claves conocidas
    if (parsed && typeof parsed === 'object') {
      for (const key of wrapperKeys) {
        if (Array.isArray(parsed[key])) return parsed[key];
      }
    }
  } catch {
    // Sin resultado
  }

  // Fallback 2: recopilar objetos JSON individuales del texto.
  // Algunos modelos (Ollama en modo JSON, modelos pequeños) devuelven uno o varios
  // objetos sueltos  { ... }{ ... }  en lugar de un array [ {...}, {...} ].
  {
    const objects = [];
    let si = 0;
    while (si < clean.length) {
      const s = clean.indexOf('{', si);
      if (s === -1) break;

      let d = 0, inStr = false, esc = false, e = -1;
      for (let i = s; i < clean.length; i++) {
        const c = clean[i];
        if (esc) { esc = false; continue; }
        if (c === '\\' && inStr) { esc = true; continue; }
        if (c === '"') { inStr = !inStr; continue; }
        if (inStr) continue;
        if (c === '{') d++;
        else if (c === '}') { d--; if (d === 0) { e = i; break; } }
      }

      if (e !== -1) {
        try {
          const obj = JSON.parse(clean.substring(s, e + 1));
          if (obj && typeof obj === 'object' && !Array.isArray(obj) && Object.keys(obj).length > 0) {
            objects.push(obj);
          }
        } catch { /* bloque no parseable, continuar */ }
        si = e + 1;
      } else {
        // No se encontró cierre → no hay más objetos válidos
        break;
      }
    }
    if (objects.length > 0) return objects;
  }

  return [];
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
