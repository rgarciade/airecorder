import { langName } from './aiPrompts.js';

/**
 * Prompt para generar el esquema/mind-map de una grabación con timestamps.
 *
 * La IA recibe la transcripción con segmentos y devuelve un JSON con ramas
 * y puntos clave anclados al segundo más cercano del audio.
 *
 * @param {string} lang - Código de idioma ('es', 'en', ...)
 */
export const esquemaPrompt = (lang = 'es') =>
  `You are an AI assistant expert at structuring meeting content into navigable outlines.

⚠️ MANDATORY LANGUAGE RULE: ALL "title", "label", and "description" VALUES MUST be written in ${langName(lang)}. DO NOT USE ANY OTHER LANGUAGE FOR THOSE FIELDS.

YOUR TASK: Analyze the meeting transcript below (which includes timestamps per segment) and generate a structured outline (esquema/mind-map) with key points anchored to their audio timestamp.

MANDATORY OUTPUT FORMAT — respond ONLY with a valid JSON object, no markdown fences, no extra text:
{
  "branches": [
    {
      "title": "Branch title in ${langName(lang)}",
      "items": [
        { "label": "Key point text", "start": 192.4 }
      ]
    }
  ]
}

BRANCH STRUCTURE RULES:
1. Always include exactly these four branches (in this order):
   - "Información de la reunión" (or equivalent in ${langName(lang)}): date, participants, context — items with start: null when no timestamp applies.
   - "Notas" (or equivalent): main discussion points, decisions made — use segment timestamps.
   - "Próximos pasos" (or equivalent): agreed actions, tasks, follow-ups — use segment timestamps.
   - "Sugerencias de IA" (or equivalent): AI-generated insights, risks, recommendations — use segment timestamps when possible, null otherwise.
2. Each branch must have between 2 and 6 items. No empty branches.
3. The "start" field MUST be a float (seconds) matching the closest segment start time from the transcript, or null if no timestamp is relevant.
4. Labels must be concise (max 15 words), factual, and in ${langName(lang)}.
5. Do NOT add personal commentary, preamble, or closing phrases.
6. Respond ONLY with the JSON object — nothing before or after.

BELOW IS THE TRANSCRIPT WITH TIMESTAMPS:
`;

export const esquemaPromptSuffix = `
----------------------------------------------------------------------------------
FINAL REMINDER: Return ONLY the JSON object with a "branches" array. Each branch has "title" (string) and "items" (array of {"label": string, "start": number|null}). Use segment timestamps from the transcript for "start" values. Titles and labels MUST be in the language specified above.
`;
