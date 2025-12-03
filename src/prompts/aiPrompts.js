// Archivo centralizado de prompts para IA
// Todos los prompts utilizados en la aplicación

const pointDefinition = `saca los puntos clave y devuelveme una lista dividida por --|-- ejemplo:
--|-- 1 --|-- texto del punto 1
--|-- 2 --|-- texto del punto 2
--|-- 3 --|-- texto del punto 3`

export const shortSummaryPrompt = `Eres un asistente de IA experto en hacer resumenes cortos y claros EN ESPAÑOL. A continuación tienes un resumen detallado,
 haz un resumen corto y claro de lo que se habla
 RECUERDA RETORNAR LA RESPUESTA SIN NINGUNA APORTACION TUYA EN LA CONVERSACION
 no agregues cosas como Here is a brief and clear summary of the conversation :

 SOLO DEVUELVE EL Resumen
 `;

export const keyPointsPrompt = `Eres un asistente de IA experto en analizar textos y sacar los puntos mas importantes. 
A continuación tienes un resumen detallado,
${pointDefinition}

NO AGREGUES NADA MAS QUE LOS PUNTOS Y EL TEXTO DEL PUNTO
RECUERDA RETORNAR LA RESPUESTA SIN NINGUNA APORTACION TUYA EN LA CONVERSACION
RESPONDE EN ESPAÑOL

`;

// Prompt para resumen detallado con contexto conversacional
export const detailedSummaryPrompt = `Eres un asistente de IA experto en generar resúmenes detallados de conversaciones para futuros usos.

Concéntrate solo en el diálogo relevante para generar tu respuesta.

DEVUELVE UN RESUMEN DETALLADO SIN FALTA DE DETALLES Y EN español para un mejor uso en futuras llamadas a este asistente. QUE QUEDE CLARO QUIÉN DICE CADA COSA

Incluye:
- Quién participa en la conversación "USUARIO es el usuario de la app osea yo"
- Los puntos principales que cada persona menciona
- Decisiones tomadas
- Acciones acordadas
- Contexto importante para futuras consultas

El resumen debe ser lo suficientemente detallado para que alguien pueda hacer preguntas específicas sobre la conversación y obtener respuestas precisas.`;

// Prompt para preguntas del chat
export const chatQuestionPrompt = (question) => 
  `${question}

Responde de forma concisa usando formato Markdown para mejorar la legibilidad (usa negritas, listas, encabezados, etc. cuando sea apropiado).

Si la pregunta requiere información específica de la conversación, usa el contexto proporcionado para dar una respuesta precisa y detallada.`;

// Prompts para proyectos (futuro)
export const projectPrompts = {
  summary: `Analiza todas las grabaciones del proyecto y genera un resumen ejecutivo que incluya:
- Estado actual del proyecto
- Progreso realizado
- Próximos pasos identificados
- Riesgos o problemas mencionados
- Decisiones importantes tomadas`,

  insights: `Identifica los insights clave del proyecto basándote en todas las grabaciones:
- Patrones en las discusiones
- Temas recurrentes
- Evolución del proyecto
- Participación del equipo
- Metas y objetivos`,

  timeline: `Crea una línea de tiempo del proyecto basada en las grabaciones:
- Hitos importantes
- Fechas clave mencionadas
- Evolución de decisiones
- Cambios de dirección`,

  team: `Analiza la participación del equipo en el proyecto:
- Roles y responsabilidades
- Nivel de participación
- Contribuciones clave
- Dinámicas de equipo`
};

// Prompt para análisis de sentimientos (futuro)
export const sentimentPrompt = `Analiza el tono y sentimientos expresados en la conversación:
- Nivel de satisfacción general
- Preocupaciones o frustraciones
- Entusiasmo o motivación
- Tensiones o conflictos
- Acuerdos y consensos`;

// Prompt para extracción de tareas (futuro)
export const tasksPrompt = `Extrae todas las tareas, acciones y compromisos mencionados en la conversación:
- Tareas asignadas a personas específicas
- Fechas límite mencionadas
- Acciones a seguir
- Decisiones pendientes
- Compromisos adquiridos`;
