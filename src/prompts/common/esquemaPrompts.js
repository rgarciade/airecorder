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
  `You are an expert meeting analyst. Your job is to turn a meeting transcript into a rich, multi-level mind-map that captures WHAT was discussed, decided, and agreed — not just generic categories.

⚠️ MANDATORY LANGUAGE RULE: ALL "title" and "label" values MUST be written in ${langName(lang)}.

YOUR TASK: Read the full transcript carefully. Identify the real topics that emerged in this specific meeting, then build a multi-level mind-map with thematic branches and nested sub-points that reflect those topics accurately.

MANDATORY OUTPUT FORMAT — respond ONLY with valid JSON, no markdown fences, no extra text:
{
  "branches": [
    {
      "title": "Specific topic title in ${langName(lang)}",
      "start": null,
      "children": [
        {
          "label": "High-level point or decision",
          "start": 192.4,
          "children": [
            {
              "label": "Specific detail, sub-decision, name, number or deadline",
              "start": 194.0,
              "children": []
            }
          ]
        }
      ]
    }
  ]
}

RULES:
1. Generate between 3 and 7 branches based on the ACTUAL topics discussed in this meeting.
   - Each branch title must name a concrete topic (e.g. "Arquitectura de autenticación", "Presupuesto Q3") — NOT generic labels like "Notas" or "Temas".
   - Include a "Próximos pasos" branch (or equivalent in ${langName(lang)}) ONLY if there are concrete action items or commitments.
   - Include a "Riesgos y bloqueos" branch (or equivalent) ONLY if risks or blockers were explicitly discussed.
   - Do NOT include a branch if there is no real content for it.

2. NESTING — use as many levels as the content warrants, with no artificial limit:
   - Branch level: the main topic area
   - Level 2 (children of branch): key points, decisions, or sub-themes within that topic
   - Level 3+ (children of children): specific details, sub-decisions, examples, names, numbers, owners, deadlines
   - Only add a deeper level when the content genuinely has structure. Do NOT force nesting on simple atomic facts.

3. Each node must have:
   - "label": specific, standalone statement (max 20 words) — factual, direct, no vague summaries
   - "start": float (seconds) matching the closest segment timestamp where that point was mentioned, or null only when truly no timestamp applies
   - "children": array — empty [] if no sub-points, otherwise an array of child nodes with the same structure

4. Prioritize decisions, commitments, technical conclusions, numbers, names, owners, and deadlines over generic observations.

5. Do NOT hallucinate content not present in the transcript. Do NOT add preamble, commentary, or closing text. Return ONLY the JSON object.

TRANSCRIPT WITH TIMESTAMPS:
`;

export const esquemaPromptSuffix = `
----------------------------------------------------------------------------------
FINAL REMINDER: Output ONLY the JSON object. "branches" is an array of { "title", "start", "children" }. Each child node is { "label", "start", "children" }. Nest as deep as the content warrants — no artificial depth limit. Titles and labels MUST be in the language specified above.
`;
