// Servicio para interactuar con la API de Gemini de Google

import { getSettings } from '../settingsService';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

// Prompt fijo en español para resumen e ideas
const defaultPrompt = `A continuación tienes una transcripción. Quiero que me des dos resúmenes y una lista de ideas principales o temas destacados que se mencionan.\n\nResponde en formato JSON con la siguiente estructura:\n\n{\n  "resumen_breve": "Resumen muy breve (1-2 frases)",\n  "resumen_extenso": "Resumen más detallado (varios párrafos si es necesario)",\n  "ideas": [\n    "Idea o tema 1",\n    "Idea o tema 2",\n    "Idea o tema 3"\n  ]\n}\n\nSi la transcripción está vacía, responde con un JSON vacío.`;

/**
 * Envía el texto a Gemini con manejo de reintentos para errores 429
 * @param {string} textContent - El contenido a enviar (prompt + contexto o solo contexto)
 * @param {boolean} isRaw - Si es true, envía textContent tal cual. Si es false, le añade el defaultPrompt.
 * @returns {Promise<Object>} - Respuesta de Gemini
 */
export async function sendToGemini(textContent, isRaw = false) {
  const MAX_RETRIES = 3;
  const BASE_DELAY = 2000; // 2 segundos

  const settings = await getSettings();
  const GEMINI_API_KEY = settings.geminiApiKey;
  if (!GEMINI_API_KEY) {
    throw new Error('No se ha configurado la Gemini API Key en los ajustes.');
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
      const response = await fetch(GEMINI_API_URL, {
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

