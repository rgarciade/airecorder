// Servicio para interactuar con la API de Gemini de Google

import { getSettings } from './settingsService';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

// Prompt fijo en español para resumen e ideas
const defaultPrompt = `A continuación tienes una transcripción. Quiero que me des dos resúmenes y una lista de ideas principales o temas destacados que se mencionan.\n\nResponde en formato JSON con la siguiente estructura:\n\n{\n  "resumen_breve": "Resumen muy breve (1-2 frases)",\n  "resumen_extenso": "Resumen más detallado (varios párrafos si es necesario)",\n  "ideas": [\n    "Idea o tema 1",\n    "Idea o tema 2",\n    "Idea o tema 3"\n  ]\n}\n\nSi la transcripción está vacía, responde con un JSON vacío.`;

/**
 * Envía el texto de la transcripción a Gemini y obtiene resumen e ideas
 * @param {string} transcriptionText - El texto plano de la transcripción
 * @returns {Promise<Object>} - Respuesta de Gemini (resumen e ideas)
 */
export async function sendToGemini(transcriptionText) {
  try {
    const settings = await getSettings();
    const GEMINI_API_KEY = settings.geminiApiKey;
    if (!GEMINI_API_KEY) {
      throw new Error('No se ha configurado la Gemini API Key en los ajustes.');
    }

    const body = {
      contents: [
        { parts: [
            { text: `${defaultPrompt}\n\nTranscripción:\n${transcriptionText}` }
          ]
        }
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
    // La respuesta suele estar en data.candidates[0].content.parts[0].text
    return data;
  } catch (error) {
    console.error('Error enviando a Gemini:', error);
    throw error;
  }
} 