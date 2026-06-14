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
  `You are an expert meeting analyst. Your job is to turn a meeting transcript into a structured, insightful mind-map that captures WHAT was discussed, decided, and agreed — not just generic categories.

⚠️ MANDATORY LANGUAGE RULE: ALL "title" and "label" values MUST be written in ${langName(lang)}.

YOUR TASK: Read the full transcript carefully. Identify the real topics that emerged in this specific meeting, then build a mind-map with thematic branches that reflect those topics accurately.

MANDATORY OUTPUT FORMAT — respond ONLY with valid JSON, no markdown fences, no extra text:
{
  "branches": [
    {
      "title": "Specific topic title in ${langName(lang)}",
      "items": [
        { "label": "Concrete point, decision or fact", "start": 192.4 }
      ]
    }
  ]
}

BRANCH RULES:
1. Generate between 3 and 7 branches based on the ACTUAL content of the meeting.
   - Each branch title must name a concrete topic discussed (e.g. "Arquitectura de autenticación", "Presupuesto Q3", "Problema de rendimiento en producción") — NOT generic labels like "Notas" or "Temas".
   - If the meeting covered action items or commitments, include ONE branch titled "Próximos pasos" (or equivalent in ${langName(lang)}) with concrete tasks and owners if mentioned.
   - If the meeting covered risks, blockers or open questions, include a branch for those.
   - Do NOT include a branch if there is no real content for it.

2. Items per branch: between 3 and 8. Each item must be:
   - A specific, standalone fact, decision, agreement, risk, or action — not a vague summary.
   - Written as a complete short statement (max 20 words), factual and direct.
   - Anchored with "start" set to the closest segment timestamp (float, seconds) where that point was mentioned, or null only when truly no timestamp applies.

3. Prioritize decisions, commitments, technical conclusions, numbers, names, and deadlines over generic observations.

4. Do NOT hallucinate content not present in the transcript. Do NOT add preamble, commentary, or closing text. Respond ONLY with the JSON object.

TRANSCRIPT WITH TIMESTAMPS:
`;

export const esquemaPromptSuffix = `
----------------------------------------------------------------------------------
FINAL REMINDER: Output ONLY the JSON object. "branches" is an array of { "title": string, "items": [{ "label": string, "start": number|null }] }. Branches must reflect the real topics of THIS meeting. Titles and labels MUST be in the language specified above.
`;
