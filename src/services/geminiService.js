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

/**
 * Envía un mensaje al chat del proyecto con contexto
 * @param {Array} history - Historial de mensajes
 * @param {string} context - Contexto del proyecto (resúmenes)
 * @param {string} question - Pregunta actual
 * @returns {Promise<string>} Respuesta de la IA
 */
export const sendProjectChatPrompt = async (history, context, question) => {
  try {
    const settings = await getSettings();
    const GEMINI_API_KEY = settings.geminiApiKey;
    if (!GEMINI_API_KEY) {
      throw new Error('No se ha configurado la Gemini API Key en los ajustes.');
    }

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
    Eres un asistente inteligente para la gestión de proyectos. Tienes acceso a los resúmenes de las reuniones del proyecto.
    
    CONTEXTO DEL PROYECTO (Resúmenes de reuniones):
    ${context}

    HISTORIAL DE CHAT:
    ${history.map(msg => `${msg.role}: ${msg.content}`).join('\n')}

    PREGUNTA DEL USUARIO:
    ${question}

    INSTRUCCIONES:
    1. Responde a la pregunta basándote PRINCIPALMENTE en el contexto proporcionado.
    2. Si la respuesta se encuentra en una reunión específica, DEBES citarla usando EXACTAMENTE este formato:
       [Ref: ID_GRABACION | "Título/Fecha" | Timestamp_aprox]
       Ejemplo: [Ref: rec_123 | "Reunión Inicial" | 10:05]
       Si no tienes timestamp, usa solo ID y Título: [Ref: rec_123 | "Reunión Inicial"]
    3. Si la información no está en el contexto, dilo claramente.
    4. Sé conciso y profesional.
    5. Responde siempre en Español.
  `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Error en sendProjectChatPrompt:", error);
    return "Lo siento, hubo un error al procesar tu pregunta.";
  }
};

/**
 * Genera un análisis completo del proyecto basado en el contexto de múltiples grabaciones
 * @param {string} contextText - Texto con los resúmenes de todas las grabaciones
 * @returns {Promise<Object>} - Análisis estructurado del proyecto
 */
export async function sendProjectAnalysisPrompt(contextText) {
  try {
    const settings = await getSettings();
    const GEMINI_API_KEY = settings.geminiApiKey;
    if (!GEMINI_API_KEY) {
      throw new Error('No se ha configurado la Gemini API Key en los ajustes.');
    }

    const prompt = `Actúa como un Project Manager experto. A continuación te proporciono los resúmenes de varias reuniones/grabaciones asociadas a un proyecto.
Están presentadas en ORDEN CRONOLÓGICO (de la más antigua a la más reciente).
Tu tarea es analizar esta información en conjunto y generar un reporte de estado del proyecto actualizado.

Información de las grabaciones:
${contextText}

Responde EXCLUSIVAMENTE en Español.

Responde EXCLUSIVAMENTE con un objeto JSON (sin markdown, sin bloques de código) con la siguiente estructura exacta:
{
  "resumen_breve": "Un resumen ejecutivo de 2-3 frases sobre el estado general del proyecto.",
  "resumen_extenso": "Un análisis detallado del progreso, logros recientes y estado actual.",
  "miembros": [
    {
      "name": "Nombre detectado",
      "role": "Rol inferido (ej: PM, Dev, Diseño, Cliente)",
      "participaciones": 0, // Número aproximado de menciones o apariciones inferidas
      "initials": "XX"
    }
  ],
  "hitos": [
    {
      "semana": "Semana X",
      "titulo": "Título del hito",
      "descripcion": "Descripción breve",
      "fecha": "YYYY-MM-DD (estimada o mencionada)",
      "estado": "completado" | "en_progreso" | "pendiente",
      "icono": "emoji"
    }
  ],
  "detalles": {
    "nombre_proyecto": "Nombre inferido o del contexto",
    "estado": "En Progreso" | "Completado" | "Pausado" | "En Riesgo",
    "fecha_inicio": "YYYY-MM-DD",
    "fecha_finalizacion": "YYYY-MM-DD",
    "presupuesto": "Cifra mencionada o 'No especificado'",
    "duracion_prevista": "Tiempo estimado",
    "proximo_hito": "Siguiente paso importante",
    "fecha_proximo_hito": "YYYY-MM-DD"
  }
}

Si falta información para algún campo, haz una estimación razonable basada en el contexto o usa "No especificado".`;

    const body = {
      contents: [
        { parts: [
            { text: prompt }
          ]
        }
      ],
      generationConfig: {
        response_mime_type: "application/json"
      }
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
    const textResponse = data.candidates[0].content.parts[0].text;
    
    // Intentar parsear el JSON por si acaso viene con texto extra
    try {
      return JSON.parse(textResponse);
    } catch (e) {
      // Si falla, intentar limpiar bloques de código markdown
      const cleanText = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleanText);
    }
  } catch (error) {
    console.error('Error generando análisis de proyecto:', error);
    throw error;
  }
}