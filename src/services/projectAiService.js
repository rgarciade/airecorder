/**
 * Servicio para análisis IA del proyecto
 * Por ahora con métodos tontos que devuelven datos de prueba
 * Estructura preparada para futuras llamadas reales usando aiService (Gemini u Ollama)
 */

class ProjectAiService {
  /**
   * Obtiene un resumen del proyecto basado en todas las grabaciones
   * @param {string} projectId - ID del proyecto
   * @returns {Promise<Object>} Resumen del proyecto
   */
  async getProjectSummary(projectId) {
    // Simular delay de procesamiento de IA
    await new Promise(resolve => setTimeout(resolve, 800));
    
    return {
      resumen_breve: "Este proyecto se centra en el desarrollo y la ejecución de una campaña de marketing integral para aumentar el conocimiento de la marca y la participación del cliente.",
      resumen_extenso: "La campaña de marketing está diseñada para maximizar el alcance y la efectividad de nuestros esfuerzos de promoción. El proyecto incluye el desarrollo de estrategias para múltiples canales digitales, incluyendo redes sociales, email marketing y creación de contenido. Los objetivos principales son la generación de leads cualificados, el aumento del tráfico web y la mejora de las conversiones de ventas. El cronograma se extiende por tres meses con revisiones periódicas y ajustes basados en el rendimiento de las métricas clave.",
      estado: "En Progreso",
      progreso: 25 // Porcentaje de completitud
    };
  }

  /**
   * Extrae los miembros del equipo de todas las grabaciones del proyecto
   * @param {string} projectId - ID del proyecto
   * @returns {Promise<Array>} Lista de miembros del equipo
   */
  async getProjectMembers(projectId) {
    // Simular delay de análisis de grabaciones
    await new Promise(resolve => setTimeout(resolve, 600));
    
    return [
      {
        id: 1,
        name: "Ana García",
        initials: "AG",
        role: "Project Manager",
        participaciones: 8,
        ultima_participacion: "2024-07-05T16:30:00Z",
        avatar_color: "#e92932"
      },
      {
        id: 2,
        name: "Carlos Ruiz",
        initials: "CR",
        role: "Diseñador",
        participaciones: 6,
        ultima_participacion: "2024-07-04T14:20:00Z",
        avatar_color: "#8b5cf6"
      },
      {
        id: 3,
        name: "María López",
        initials: "ML",
        role: "Desarrolladora",
        participaciones: 5,
        ultima_participacion: "2024-07-03T11:15:00Z",
        avatar_color: "#10b981"
      },
      {
        id: 4,
        name: "David Torres",
        initials: "DT",
        role: "Analista",
        participaciones: 4,
        ultima_participacion: "2024-07-02T16:45:00Z",
        avatar_color: "#f59e0b"
      }
    ];
  }

  /**
   * Obtiene los aspectos destacados y timeline del proyecto
   * @param {string} projectId - ID del proyecto
   * @returns {Promise<Array>} Lista de hitos y aspectos destacados
   */
  async getProjectHighlights(projectId) {
    // Simular delay de análisis temporal
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return [
      {
        id: 1,
        semana: "Semana 1",
        titulo: "Inicio del Proyecto",
        descripcion: "Lanzamiento de la Campaña",
        fecha: "2024-07-01",
        estado: "completado",
        icono: "🚀"
      },
      {
        id: 2,
        semana: "Semana 2-4",
        titulo: "Desarrollo de Contenido",
        descripcion: "Creación de Contenido",
        fecha: "2024-07-08",
        estado: "en_progreso",
        icono: "📝"
      },
      {
        id: 3,
        semana: "Semana 5-8",
        titulo: "Activación del Canal",
        descripcion: "Participación en Redes Sociales",
        fecha: "2024-07-29",
        estado: "pendiente",
        icono: "📱"
      },
      {
        id: 4,
        semana: "Semana 9-12",
        titulo: "Monitoreo de la Campaña",
        descripcion: "Análisis de Rendimiento",
        fecha: "2024-08-26",
        estado: "pendiente",
        icono: "📊"
      }
    ];
  }

  /**
   * Obtiene los detalles clave del proyecto
   * @param {string} projectId - ID del proyecto
   * @returns {Promise<Object>} Detalles del proyecto
   */
  async getProjectDetails(projectId) {
    // Simular delay de recopilación de datos
    await new Promise(resolve => setTimeout(resolve, 400));
    
    return {
      nombre_proyecto: "Campaña de Marketing",
      estado: "En Progreso",
      fecha_inicio: "2024-07-01",
      fecha_finalizacion: "2024-09-30",
      presupuesto: "$50,000",
      presupuesto_utilizado: "$15,000",
      presupuesto_restante: "$35,000",
      duracion_prevista: "12 semanas",
      duracion_actual: "2 semanas",
      grabaciones_totales: 8,
      grabaciones_analizadas: 6,
      miembros_activos: 4,
      ultima_actividad: "2024-07-05T16:30:00Z",
      proximo_hito: "Desarrollo de Contenido",
      fecha_proximo_hito: "2024-07-15"
    };
  }

  /**
   * Pregunta a la IA sobre el proyecto (método tonto)
   * @param {string} projectId - ID del proyecto
   * @param {string} question - Pregunta del usuario
   * @param {string} chatId - ID del chat (opcional)
   * @returns {Promise<string>} Respuesta de la IA
   */
  async askProjectQuestion(projectId, question, chatId = null) {
    // Simular delay de procesamiento de IA
    await new Promise(resolve => setTimeout(resolve, 1200));
    
    // Respuestas contextuales basadas en el tipo de pregunta
    const questionLower = question.toLowerCase();
    
    if (questionLower.includes('estado') || questionLower.includes('progreso')) {
      return `El proyecto está actualmente en progreso con un 25% de completitud.

Fases completadas:
- Planificación inicial y definición de objetivos
- Estructura del proyecto y asignación de recursos

Trabajo actual:
- Desarrollo de contenido para la campaña
- Diseño de materiales promocionales

Próximos hitos:
- Activación de canales digitales (Semana 5)
- Lanzamiento de la campaña (Semana 8)

El equipo está cumpliendo con los hitos programados.`;
    }
    
    if (questionLower.includes('presupuesto') || questionLower.includes('dinero') || questionLower.includes('costo')) {
      return `El presupuesto total del proyecto es de $50,000.

Distribución actual:
- Presupuesto utilizado: $15,000 (30%)
- Presupuesto restante: $35,000 (70%)

Gastos principales:
- Recursos de diseño: $8,000
- Desarrollo de contenido: $5,000
- Herramientas y software: $2,000

El presupuesto está dentro del rango esperado para esta fase.`;
    }
    
    if (questionLower.includes('fecha') || questionLower.includes('tiempo') || questionLower.includes('cronograma')) {
      return `Cronograma del proyecto:

Fechas clave:
- Inicio: 1 de julio de 2024
- Finalización: 30 de septiembre de 2024
- Duración: 12 semanas

Estado actual:
- Semana actual: Semana 2
- Progreso: 25% completado
- Próximo hito: Desarrollo de contenido (15 de julio)

El proyecto avanza según lo programado.`;
    }
    
    if (questionLower.includes('miembro') || questionLower.includes('equipo') || questionLower.includes('persona')) {
      return `El equipo del proyecto está compuesto por 4 miembros principales:

- Ana García (Project Manager)
  - Participaciones: 8 reuniones
  - Responsabilidades: Coordinación general

- Carlos Ruiz (Diseñador)
  - Participaciones: 6 reuniones
  - Responsabilidades: Diseño visual

- María López (Desarrolladora)
  - Participaciones: 5 reuniones
  - Responsabilidades: Desarrollo técnico

- David Torres (Analista)
  - Participaciones: 4 reuniones
  - Responsabilidades: Análisis de datos

Todos han estado activos en las reuniones registradas.`;
    }
    
    if (questionLower.includes('grabacion') || questionLower.includes('reunion')) {
      return `Resumen de grabaciones del proyecto:

Estadísticas:
- Total de grabaciones: 8
- Grabaciones analizadas: 6
- Última actividad: 5 de julio

Temas principales de las reuniones:
- Planificación de contenido
- Estrategias de redes sociales
- Revisión de presupuestos
- Definición de objetivos

Las reuniones han sido productivas y bien estructuradas.`;
    }
    
    if (questionLower.includes('riesgo') || questionLower.includes('problema') || questionLower.includes('retraso')) {
      return `Análisis de riesgos del proyecto:

Estado actual:
- No se han identificado riesgos significativos
- El proyecto avanza según lo programado
- El equipo está cumpliendo con los plazos

Recomendaciones:
- Mantener seguimiento cercano del desarrollo de contenido
- Revisar semanalmente el progreso de hitos
- Comunicar cualquier desviación inmediatamente

El proyecto se encuentra en buen estado general.`;
    }
    
    // Respuesta por defecto
    return "Basándome en el análisis de todas las grabaciones del proyecto, puedo proporcionarte información detallada sobre el estado actual, cronograma, presupuesto, miembros del equipo y próximos hitos. El proyecto está progresando bien y el equipo está trabajando de manera colaborativa. ¿Hay algún aspecto específico que te gustaría conocer con más detalle?";
  }

  /**
   * Genera un análisis completo del proyecto (método futuro)
   * @param {string} projectId - ID del proyecto
   * @returns {Promise<Object>} Análisis completo
   */
  async generateProjectAnalysis(projectId) {
    // Este método estará preparado para futuras implementaciones
    // con llamadas reales a Gemini usando contexto de múltiples grabaciones
    
    console.log(`Generando análisis completo para proyecto ${projectId}`);
    
    return {
      resumen_ejecutivo: "Análisis completo del proyecto...",
      metricas_clave: {},
      recomendaciones: [],
      riesgos_identificados: [],
      oportunidades: []
    };
  }
}

// Instancia singleton del servicio
const projectAiService = new ProjectAiService();

export default projectAiService;
