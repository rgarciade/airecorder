/**
 * Prompt builders para Note Templates
 *
 * Genera prompts estructurados que guían al LLM para preencher cada sección
 * de una plantilla de notas según su tipo (summary, bullets, qa, etc.).
 */

import { langName } from './aiPrompts.js';

/**
 * Instrucciones de formato por tipo de sección.
 * @readonly
 * @enum {string}
 */
const sectionTypeInstructions = {
  summary: 'Write 2-3 paragraphs of plain prose. No bullets.',
  bullets: 'Use "-" markdown bullets. One idea per bullet.',
  qa: 'Format as "**Q:** question\\n**A:** answer" pairs separated by blank lines.',
  table: 'Use a markdown table with headers. Keep rows concise.',
  timeline: 'Use bullets prefixed with timestamp like "**[MM:SS]** event".',
  actions: 'Use "- [ ] action — owner" format.',
  quote_highlights: 'Use "> quote" markdown blockquotes. After each quote, attribute on a new line: "— Speaker name".',
  freeform: 'Use the most natural format for the content.'
};

/**
 * Traduce el tipo de sección a una instrucción de formato legible.
 * @param {string} type - Tipo de sección (summary, bullets, qa, etc.)
 * @returns {string}
 */
function getFormatHint(type) {
  return sectionTypeInstructions[type] || sectionTypeInstructions.freeform;
}

/**
 * Construye el system prompt que guía al LLM para completar las secciones del template.
 *
 * @param {Object} template - Objeto template con propiedad sections (array)
 * @param {string} [lang='es'] - Código de idioma
 * @param {string} [specialtyPrompt=''] - Prompt de especialidad del experto (opcional)
 * @returns {string} System prompt completo
 */
export function buildTemplateSystemPrompt(template, lang = 'es', specialtyPrompt = '') {
  const sections = template.sections || [];

  const sectionInstructions = sections.map((section, index) => {
    const typeHint = getFormatHint(section.type);
    const requiredMark = section.required
      ? '⚠️ REQUIRED — must always be present.'
      : '✓ Optional — omit entirely if no relevant content.';

    return `### Section ${index + 1}: "${section.title}" (type: ${section.type})
Format guidance: ${typeHint}
Content guidance: ${section.instructions}
${requiredMark}`;
  }).join('\n\n');

  const langUpper = langName(lang);

  return `${specialtyPrompt}

You are filling a structured note template named "${template.name}".

⚠️ MANDATORY LANGUAGE RULE: YOUR ENTIRE RESPONSE MUST BE WRITTEN IN ${langUpper}. DO NOT USE ANY OTHER LANGUAGE.

OUTPUT FORMAT — strict markdown with these sections in this exact order:

${sectionInstructions}

GLOBAL RULES:
1. Use H2 headings (##) for each section title — translate the title to ${langUpper}.
2. Do NOT invent content. Only extract from the transcription/summary provided.
3. Do NOT add preamble, closing remarks, or commentary outside sections.
4. If a section has no content from the transcript:
   - If REQUIRED → write the heading and below it a single line "_No relevant content captured._" (translated to ${langUpper}).
   - If OPTIONAL → omit the section entirely.
5. NEVER use generic "INTERLOCUTOR-1" / "Speaker 1" labels — use real names from the transcription, or "Usuarios sin definir" / "Unidentified users" collectively.
6. Plain markdown only — no LaTeX, no \\rightarrow, no math notation.
7. Do NOT wrap the entire output in a code block.
8. Maintain consistent terminology across sections.
`;
}

/**
 * Construye el contenido del mensaje de usuario con el contexto necesario.
 *
 * @param {string} transcript - Transcripción completa de la grabación
 * @param {string} [existingSummary=''] - Resumen AI existente (opcional)
 * @returns {string} Contenido para el user message
 */
export function buildTemplateUserContent(transcript, existingSummary = '') {
  const summaryBlock = existingSummary
    ? `## Existing analysis (use as primary context)\n\n${existingSummary}\n\n`
    : '';

  return `${summaryBlock}## Full transcription\n\n${transcript}`;
}