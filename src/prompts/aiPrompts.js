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

IMPORTANTE: En cada punto, resalta las PALABRAS CLAVE más importantes usando formato markdown con negritas (**palabra clave**). 
Las palabras clave son términos técnicos, conceptos importantes, nombres propios, acciones clave, o cualquier término que sea esencial para entender el punto.

Ejemplo de formato:
--|-- 1 --|-- Se discutió el **lanzamiento del producto** y las **estrategias de marketing** para el próximo trimestre
--|-- 2 --|-- Se acordó implementar un **sistema de seguimiento** para mejorar la **productividad del equipo**

LIMITA LA RESPUESTA A ENTRE 3 Y 5 PUNTOS PRINCIPALES Y GENERALES.
NO ENTRES EN DETALLES EXCESIVOS, SOLO LAS IDEAS GENERALES.

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

// Prompt para extraer participantes de la transcripción
export const participantsPrompt = `TU TAREA: Extraer nombres y roles de la siguiente transcripción.

INSTRUCCIONES DE FORMATO JSON ESTRICTO:
1. Responde SOLAMENTE con un bloque de código JSON válido.
2. NO incluyas texto antes ni después.
3. Formato: [{"name": "X", "role": "Y"}]

Ejemplo:
\`\`\`json
[{"name": "Ana", "role": "PM"}]
\`\`\`

A CONTINUACIÓN, LA TRANSCRIPCIÓN:
`;

export const participantsPromptSuffix = `
----------------------------------------------------------------------------------
RECORDATORIO FINAL:
Basado en la transcripción anterior, genera ÚNICAMENTE el array JSON con los participantes encontrados. Si no hay, devuelve [].
`;

// Prompts para sugerencias de tareas
export const taskSuggestionsPrompt = `Eres un asistente técnico. Analiza la siguiente transcripción y genera una lista de tareas de desarrollo de software.

REGLAS OBLIGATORIAS:
1. Genera entre 3 y 5 tareas DISTINTAS. Cada tarea debe hablar de un tema diferente. PROHIBIDO repetir el mismo tema.
2. Agrupa cambios relacionados en UNA sola tarea en lugar de crear varias pequeñas.
3. El campo "layer" SOLO puede tener uno de estos tres valores exactos: "frontend", "backend" o "fullstack". NO uses ningún otro valor.
   - "backend" = lógica de servidor, base de datos, APIs, servicios
   - "frontend" = interfaz de usuario, componentes visuales, formularios
   - "fullstack" = requiere cambios tanto en servidor como en interfaz
4. Si una funcionalidad necesita cambios en front Y en back, crea DOS tareas con el mismo prefijo: "NombreGrupo: tarea backend" y "NombreGrupo: tarea frontend".
5. El campo "content" debe incluir: una frase de contexto + lista de puntos con "- ".
6. RESPONDE SOLO con el JSON, sin texto adicional.
7. RESPONDE EN ESPAÑOL.

FORMATO EXACTO:
[{"title": "Título accionable", "content": "Contexto.\\n\\n- Punto 1\\n- Punto 2", "layer": "backend"}]

EJEMPLO CORRECTO:
[
  {"title": "Tipos de IP: Actualizar lógica del servidor", "content": "Modificar el backend para soportar los tres tipos de IP (Report IT, Population IT, EUC).\\n\\n- Añadir los nuevos tipos al modelo de datos\\n- Restringir el generador de IP solo a Report IT\\n- Actualizar validaciones y tests", "layer": "backend"},
  {"title": "Tipos de IP: Actualizar tabla en interfaz", "content": "Adaptar la vista para mostrar y diferenciar los tres tipos de IP.\\n\\n- Mostrar los tres tipos en la tabla con columna de tipo\\n- Ocultar botón 'Generar IP' para Population IT y EUC\\n- Añadir filtro por tipo", "layer": "frontend"},
  {"title": "Configurar entorno de staging", "content": "Preparar un entorno de pruebas aislado previo a producción.\\n\\n- Crear rama de staging en el repositorio\\n- Configurar variables de entorno específicas\\n- Conectar con pipeline de CI", "layer": "fullstack"}
]

A CONTINUACIÓN, LA TRANSCRIPCIÓN:
`;

export const taskSuggestionsPromptSuffix = `
----------------------------------------------------------------------------------
RECORDATORIO FINAL: Devuelve ÚNICAMENTE el array JSON. El campo "layer" SOLO puede ser "frontend", "backend" o "fullstack". Mínimo 3, máximo 5 tareas bien diferenciadas.
`;

export const taskImprovementPrompt = (userInstructions) => `TU TAREA: Mejorar la siguiente tarea siguiendo las instrucciones del usuario.

INSTRUCCIONES DE FORMATO JSON ESTRICTO:
1. Responde SOLAMENTE con un bloque de código JSON válido.
2. NO incluyas texto antes ni después.
3. Formato: {"title": "X", "content": "Y"}
4. El title debe ser corto, accionable y en imperativo.
5. El content debe ser una descripción detallada, clara y accionable.
6. RESPONDE EN ESPAÑOL.

INSTRUCCIONES DEL USUARIO:
${userInstructions}

TAREA A MEJORAR:
`;

// Prompt para análisis completo de proyecto basado en grabaciones
export const projectAnalysisPrompt = (contextText) => `Actúa como un Project Manager experto. A continuación te proporciono los resúmenes de varias reuniones/grabaciones asociadas a un proyecto.
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
      "participaciones": 0,
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
