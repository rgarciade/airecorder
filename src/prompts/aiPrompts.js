// Archivo centralizado de prompts para IA
// Todos los prompts utilizados en la aplicación

/**
 * Devuelve el nombre del idioma en mayúsculas para incluir en los prompts.
 * @param {string} lang - Código de idioma (ej: 'es', 'en')
 * @returns {string}
 */
const langName = (lang = 'es') => {
  const map = {
    es: 'ESPAÑOL',
    en: 'ENGLISH',
    fr: 'FRANÇAIS',
    de: 'DEUTSCH',
    pt: 'PORTUGUÊS',
    it: 'ITALIANO',
    zh: 'CHINESE',
    ja: 'JAPANESE',
  };
  return map[lang] || 'ESPAÑOL';
};

// Definición del formato de puntos clave (estructura fija, no depende del idioma)
const pointDefinition = `extract the key points and return them as a list using EXACTLY this delimited format:
--|-- 1 --|-- text of key point 1
--|-- 2 --|-- text of key point 2
--|-- 3 --|-- text of key point 3`;

/**
 * Prompt para resumen corto.
 * @param {string} lang - Código de idioma ('es', 'en', ...)
 */
export const shortSummaryPrompt = (lang = 'es') =>
  `You are an AI assistant expert at writing short, clear summaries.

⚠️ MANDATORY LANGUAGE RULE: YOUR ENTIRE RESPONSE MUST BE WRITTEN IN ${langName(lang)}. DO NOT USE ANY OTHER LANGUAGE.

You have been given a detailed summary. Write a short, clear summary of what is discussed.

RULES:
- Do NOT add any personal commentary, preamble or closing phrases like "Here is a brief summary:".
- Return ONLY the summary text, nothing else.
- The summary MUST be in ${langName(lang)}.
`;

/**
 * Prompt para puntos clave.
 * @param {string} lang - Código de idioma ('es', 'en', ...)
 */
export const keyPointsPrompt = (lang = 'es') =>
  `You are an AI assistant expert at analyzing texts and extracting the most important points.

⚠️ MANDATORY LANGUAGE RULE: YOUR ENTIRE RESPONSE MUST BE WRITTEN IN ${langName(lang)}. DO NOT USE ANY OTHER LANGUAGE.

You have been given a detailed summary. Your task is to ${pointDefinition}

IMPORTANT: In each point, highlight the most important KEY WORDS using markdown bold format (**keyword**).
Key words are technical terms, important concepts, proper names, key actions, or any term essential for understanding the point.

Example format:
--|-- 1 --|-- The **product launch** and **marketing strategies** for the next quarter were discussed
--|-- 2 --|-- It was agreed to implement a **tracking system** to improve **team productivity**

RULES:
- Limit the response to BETWEEN 3 AND 5 main, general points.
- Do NOT go into excessive detail — only the general ideas.
- Do NOT add anything other than the points and their text.
- Do NOT add any personal commentary or preamble.
- ALL point texts MUST be in ${langName(lang)}.
`;

/**
 * Prompt para resumen detallado con contexto conversacional.
 * @param {string} lang - Código de idioma ('es', 'en', ...)
 */
export const detailedSummaryPrompt = (lang = 'es') =>
  `You are an AI assistant expert at generating detailed summaries of conversations for future reference.

⚠️ MANDATORY LANGUAGE RULE: YOUR ENTIRE RESPONSE MUST BE WRITTEN IN ${langName(lang)}. DO NOT USE ANY OTHER LANGUAGE.

Focus only on the relevant dialogue to generate your response.

RETURN A DETAILED SUMMARY WITHOUT OMITTING ANY DETAILS, so it can be used effectively in future queries about this conversation. MAKE IT CLEAR WHO SAYS WHAT.

Include:
- Who participates in the conversation ("USUARIO" refers to the app user, i.e. the person who made the recording)
- The main points each person mentions
- Decisions made
- Agreed actions
- Important context for future queries

The summary must be detailed enough that someone can ask specific questions about the conversation and get precise answers.
The summary MUST be written in ${langName(lang)}.
`;

/**
 * Prompt para preguntas del chat con contexto de transcripción.
 * @param {string} question - Pregunta del usuario
 * @param {string} lang - Código de idioma ('es', 'en', ...)
 */
export const chatQuestionPrompt = (question, lang = 'es') =>
  `${question}

⚠️ MANDATORY LANGUAGE RULE: YOUR ENTIRE RESPONSE MUST BE WRITTEN IN ${langName(lang)}. DO NOT USE ANY OTHER LANGUAGE.

Respond concisely using Markdown format to improve readability (use bold, lists, headings, etc. when appropriate).

If the question requires specific information from the conversation, use the provided context to give a precise and detailed answer.`;

/**
 * Prompt para extraer participantes de la transcripción.
 * @param {string} lang - Código de idioma ('es', 'en', ...)
 */
export const participantsPrompt = (lang = 'es') =>
  `YOUR TASK: Extract names and roles from the following transcript.

⚠️ MANDATORY LANGUAGE RULE: The "role" values MUST be written in ${langName(lang)}.

STRICT JSON FORMAT INSTRUCTIONS:
1. Respond ONLY with a valid JSON code block.
2. Do NOT include any text before or after.
3. Format: [{"name": "X", "role": "Y"}]

Example:
\`\`\`json
[{"name": "Ana", "role": "PM"}]
\`\`\`

BELOW IS THE TRANSCRIPT:
`;

export const participantsPromptSuffix = `
----------------------------------------------------------------------------------
FINAL REMINDER:
Based on the transcript above, generate ONLY the JSON array with the participants found. If none, return [].
`;

/**
 * Prompt para sugerencias de tareas de desarrollo.
 * @param {string} lang - Código de idioma ('es', 'en', ...)
 */
export const taskSuggestionsPrompt = (lang = 'es') =>
  `You are a technical assistant. Analyze the following transcript and generate a list of software development tasks.

⚠️ MANDATORY LANGUAGE RULE: The "title" and "content" VALUES in your JSON response MUST be written in ${langName(lang)}. DO NOT USE ANY OTHER LANGUAGE FOR THOSE FIELDS.

MANDATORY RULES:
1. Generate between 3 and 5 DISTINCT tasks. Each task must cover a different topic. FORBIDDEN to repeat the same topic.
2. Group related changes into ONE single task instead of creating several small ones.
3. The "layer" field can ONLY have one of these three exact values: "frontend", "backend" or "fullstack". DO NOT use any other value.
   - "backend" = server logic, database, APIs, services
   - "frontend" = user interface, visual components, forms
   - "fullstack" = requires changes in both server and interface
4. If a feature needs changes in both front AND back, create TWO tasks with the same prefix: "GroupName: backend task" and "GroupName: frontend task".
5. The "content" field must include: a context sentence + a list of bullet points with "- ".
6. RESPOND ONLY with the JSON, without additional text.

EXACT FORMAT:
[{"title": "Actionable title", "content": "Context.\\n\\n- Point 1\\n- Point 2", "layer": "backend"}]

BELOW IS THE TRANSCRIPT:
`;

export const taskSuggestionsPromptSuffix = `
----------------------------------------------------------------------------------
FINAL REMINDER: Return ONLY the JSON array. The "layer" field can ONLY be "frontend", "backend" or "fullstack". Minimum 3, maximum 5 well-differentiated tasks. Titles and content MUST be in the language specified above.
`;

/**
 * Prompt para mejorar una tarea individual.
 * @param {string} userInstructions - Instrucciones del usuario
 * @param {string} lang - Código de idioma ('es', 'en', ...)
 */
export const taskImprovementPrompt = (userInstructions, lang = 'es') =>
  `YOUR TASK: Improve the following task according to the user's instructions.

⚠️ MANDATORY LANGUAGE RULE: The "title" and "content" VALUES MUST be written in ${langName(lang)}. DO NOT USE ANY OTHER LANGUAGE.

STRICT JSON FORMAT INSTRUCTIONS:
1. Respond ONLY with a valid JSON code block.
2. Do NOT include any text before or after.
3. Format: {"title": "X", "content": "Y"}
4. The title must be short, actionable and in the imperative form.
5. The content must be a detailed, clear and actionable description.

USER INSTRUCTIONS:
${userInstructions}

TASK TO IMPROVE:
`;

/**
 * Prompt para análisis completo de proyecto basado en grabaciones.
 * @param {string} contextText - Texto de contexto con resúmenes de grabaciones
 * @param {string} lang - Código de idioma ('es', 'en', ...)
 */
export const projectAnalysisPrompt = (contextText, lang = 'es') =>
  `Act as an expert Project Manager. Below I provide you with summaries of several meetings/recordings associated with a project.
They are presented in CHRONOLOGICAL ORDER (from oldest to most recent).
Your task is to analyze this information as a whole and generate an updated project status report.

⚠️ MANDATORY LANGUAGE RULE: ALL free-text fields (resumen_breve, resumen_extenso, titulo, descripcion, nombre_proyecto, proximo_hito, presupuesto, duracion_prevista, and the "role" field in miembros) MUST be written in ${langName(lang)}. DO NOT USE ANY OTHER LANGUAGE FOR THOSE FIELDS.
The JSON KEYS and ENUM VALUES (estado, fecha, semana, initials, "completado", "en_progreso", "pendiente", "En Progreso", "Completado", "Pausado", "En Riesgo") remain EXACTLY as defined below — do NOT translate them.

Recording information:
${contextText}

Respond EXCLUSIVELY with a JSON object (no markdown, no code blocks) with the following exact structure:
{
  "resumen_breve": "A 2-3 sentence executive summary of the overall project status.",
  "resumen_extenso": "A detailed analysis of progress, recent achievements and current status.",
  "miembros": [
    {
      "name": "Detected name",
      "role": "Inferred role in ${langName(lang)} (e.g.: PM, Dev, Design, Client)",
      "participaciones": 0,
      "initials": "XX"
    }
  ],
  "hitos": [
    {
      "semana": "Week X",
      "titulo": "Milestone title in ${langName(lang)}",
      "descripcion": "Brief description in ${langName(lang)}",
      "fecha": "YYYY-MM-DD (estimated or mentioned)",
      "estado": "completado" | "en_progreso" | "pendiente",
      "icono": "emoji"
    }
  ],
  "detalles": {
    "nombre_proyecto": "Inferred name or from context, in ${langName(lang)}",
    "estado": "En Progreso" | "Completado" | "Pausado" | "En Riesgo",
    "fecha_inicio": "YYYY-MM-DD",
    "fecha_finalizacion": "YYYY-MM-DD",
    "presupuesto": "Mentioned figure or 'Not specified' in ${langName(lang)}",
    "duracion_prevista": "Estimated time in ${langName(lang)}",
    "proximo_hito": "Next important step in ${langName(lang)}",
    "fecha_proximo_hito": "YYYY-MM-DD"
  }
}

If information is missing for any field, make a reasonable estimate based on context or use a 'Not specified' equivalent in ${langName(lang)}.`;

// Prompts para proyectos (futuro)
export const projectPrompts = {
  summary: `Analyze all project recordings and generate an executive summary that includes:
- Current project status
- Progress made
- Identified next steps
- Risks or problems mentioned
- Important decisions made`,

  insights: `Identify the key insights from the project based on all recordings:
- Patterns in the discussions
- Recurring topics
- Project evolution
- Team participation
- Goals and objectives`,

  timeline: `Create a project timeline based on the recordings:
- Important milestones
- Key dates mentioned
- Evolution of decisions
- Changes in direction`,

  team: `Analyze team participation in the project:
- Roles and responsibilities
- Level of participation
- Key contributions
- Team dynamics`
};

// Prompt para análisis de sentimientos (futuro)
export const sentimentPrompt = `Analyze the tone and feelings expressed in the conversation:
- Overall satisfaction level
- Concerns or frustrations
- Enthusiasm or motivation
- Tensions or conflicts
- Agreements and consensus`;

// Prompt para extracción de tareas (futuro)
export const tasksPrompt = `Extract all tasks, actions and commitments mentioned in the conversation:
- Tasks assigned to specific people
- Mentioned deadlines
- Follow-up actions
- Pending decisions
- Acquired commitments`;
