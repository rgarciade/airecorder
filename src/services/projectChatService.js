/**
 * Servicio para gestionar múltiples chats del proyecto
 * Por ahora con métodos tontos que devuelven datos de prueba
 */

class ProjectChatService {
  /**
   * Obtiene todos los chats de un proyecto
   * @param {string} projectId - ID del proyecto
   * @returns {Promise<Array>} Lista de chats del proyecto
   */
  async getProjectChats(projectId) {
    // Simular delay de API
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Datos de prueba
    return [
      {
        id: 'chat1',
        nombre: 'Chat del Proyecto',
        fecha_creacion: '2024-07-01T10:00:00Z',
        ultimo_mensaje: '2024-07-05T16:30:00Z',
        activo: true
      },
      {
        id: 'chat2',
        nombre: 'Reunión de inicio de campaña',
        fecha_creacion: '2024-07-02T14:00:00Z',
        ultimo_mensaje: '2024-07-03T11:15:00Z',
        activo: false
      },
      {
        id: 'chat3',
        nombre: 'Estrategia de contenido',
        fecha_creacion: '2024-07-03T09:00:00Z',
        ultimo_mensaje: '2024-07-04T15:45:00Z',
        activo: false
      },
      {
        id: 'chat4',
        nombre: 'Revisión de presupuesto',
        fecha_creacion: '2024-07-04T16:00:00Z',
        ultimo_mensaje: '2024-07-05T10:20:00Z',
        activo: false
      }
    ];
  }

  /**
   * Crea un nuevo chat para el proyecto
   * @param {string} projectId - ID del proyecto
   * @param {string} chatName - Nombre del nuevo chat
   * @returns {Promise<Object>} Chat creado
   */
  async createProjectChat(projectId, chatName) {
    // Simular delay de API
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const newChat = {
      id: `chat_${Date.now()}`,
      nombre: chatName,
      fecha_creacion: new Date().toISOString(),
      ultimo_mensaje: new Date().toISOString(),
      activo: false
    };
    
    console.log(`Chat creado para proyecto ${projectId}:`, newChat);
    return newChat;
  }

  /**
   * Elimina un chat del proyecto
   * @param {string} projectId - ID del proyecto
   * @param {string} chatId - ID del chat a eliminar
   * @returns {Promise<boolean>} True si se eliminó correctamente
   */
  async deleteProjectChat(projectId, chatId) {
    // Simular delay de API
    await new Promise(resolve => setTimeout(resolve, 300));
    
    console.log(`Chat ${chatId} eliminado del proyecto ${projectId}`);
    return true;
  }

  /**
   * Obtiene el historial de mensajes de un chat específico
   * @param {string} projectId - ID del proyecto
   * @param {string} chatId - ID del chat
   * @returns {Promise<Array>} Historial de mensajes
   */
  async getProjectChatHistory(projectId, chatId) {
    // Simular delay de API
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Datos de prueba según el chat
    if (chatId === 'chat1') {
      return [
        {
          id: 'msg1',
          tipo: 'asistente',
          contenido: '¡Bienvenido al chat del proyecto! ¿Cómo puedo ayudarte con tu campaña de marketing hoy?',
          fecha: '2024-07-01T10:00:00Z',
          avatar: '🤖'
        },
        {
          id: 'msg2',
          tipo: 'usuario',
          contenido: '¿Cuál es el estado actual del proyecto?',
          fecha: '2024-07-01T10:05:00Z',
          avatar: '👤'
        },
        {
          id: 'msg3',
          tipo: 'asistente',
          contenido: 'Según las grabaciones analizadas, el proyecto está en progreso. Se han completado las fases de planificación y se está trabajando en el desarrollo de contenido. El próximo hito es la activación de canales digitales.',
          fecha: '2024-07-01T10:06:00Z',
          avatar: '🤖'
        }
      ];
    }
    
    // Para otros chats, devolver mensajes de ejemplo
    return [
      {
        id: 'msg1',
        tipo: 'asistente',
        contenido: `¡Hola! Este es el chat "${chatId}". ¿En qué puedo ayudarte?`,
        fecha: new Date(Date.now() - 86400000).toISOString(), // Ayer
        avatar: '🤖'
      }
    ];
  }

  /**
   * Guarda un nuevo mensaje en un chat del proyecto
   * @param {string} projectId - ID del proyecto
   * @param {string} chatId - ID del chat
   * @param {Object} message - Mensaje a guardar {tipo, contenido}
   * @returns {Promise<Object>} Mensaje guardado
   */
  async saveProjectChatMessage(projectId, chatId, message) {
    // Simular delay de API
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const savedMessage = {
      id: `msg_${Date.now()}`,
      tipo: message.tipo,
      contenido: message.contenido,
      fecha: new Date().toISOString(),
      avatar: message.tipo === 'usuario' ? '👤' : '🤖'
    };
    
    console.log(`Mensaje guardado en chat ${chatId} del proyecto ${projectId}:`, savedMessage);
    return savedMessage;
  }

  /**
   * Simula una respuesta de la IA para una pregunta del proyecto
   * TODO: Implementar con aiService.generateContent() usando el contexto del proyecto
   * Las respuestas deben estar en formato Markdown
   * @param {string} projectId - ID del proyecto
   * @param {string} question - Pregunta del usuario
   * @param {string} chatId - ID del chat
   * @returns {Promise<string>} Respuesta simulada de la IA en formato Markdown
   */
  async generateAiResponse(projectId, question, chatId) {
    // Simular delay de procesamiento de IA
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Respuestas de ejemplo basadas en la pregunta
    const responses = {
      'estado': `El proyecto está actualmente **en progreso** con un **25% de completitud**.

**Fases completadas:**
- Planificación inicial y definición de objetivos
- Estructura del proyecto y asignación de recursos

**En desarrollo:**
- Desarrollo de contenido para la campaña
- Diseño de materiales promocionales

*Próximo hito:* Activación de canales digitales, programado para la **semana 5**.`,

      'presupuesto': `El presupuesto asignado para este proyecto es de **$50,000**.

**Distribución actual:**
- Presupuesto utilizado: **$15,000** (30%)
- Presupuesto restante: **$35,000** (70%)

**Gastos principales:**
- Recursos de diseño: $8,000
- Desarrollo de contenido: $5,000
- Herramientas y software: $2,000

✅ El presupuesto está dentro del rango esperado para esta fase del proyecto.`,

      'fechas': `## Cronograma del Proyecto

**Fechas clave:**
- 📅 Inicio: **1 de julio de 2024**
- 🎯 Finalización prevista: **30 de septiembre de 2024**
- ⏱️ Duración total: **12 semanas**

**Estado actual:**
- Semana actual: **Semana 2**
- Progreso: **25% completado**
- Próximo hito: *Desarrollo de contenido* (15 de julio)

✅ El proyecto está avanzando según lo programado.`,

      'miembros': `## Equipo del Proyecto

El equipo está compuesto por **4 miembros principales**:

### 👤 Ana García (Project Manager)
- Participaciones: **8 reuniones**
- Responsabilidades: Coordinación general y seguimiento

### 🎨 Carlos Ruiz (Diseñador)
- Participaciones: **6 reuniones**
- Responsabilidades: Diseño visual y materiales

### 💻 María López (Desarrolladora)
- Participaciones: **5 reuniones**
- Responsabilidades: Desarrollo técnico y implementación

### 📊 David Torres (Analista)
- Participaciones: **4 reuniones**
- Responsabilidades: Análisis de datos y métricas

✅ Todos han participado activamente en las reuniones registradas.`,

      'default': `Basándome en el análisis de todas las grabaciones del proyecto, puedo proporcionarte información detallada sobre:

**Información disponible:**
- 📈 Estado actual y progreso del proyecto
- 📅 Cronograma y próximos hitos
- 💰 Presupuesto y distribución de recursos
- 👥 Miembros del equipo y sus responsabilidades
- 🎙️ Grabaciones y reuniones registradas

¿Hay algún aspecto específico que te interese conocer con más detalle?`
    };
    
    // Buscar respuesta basada en palabras clave
    const questionLower = question.toLowerCase();
    if (questionLower.includes('estado') || questionLower.includes('progreso')) {
      return responses.estado;
    } else if (questionLower.includes('presupuesto') || questionLower.includes('dinero') || questionLower.includes('costo')) {
      return responses.presupuesto;
    } else if (questionLower.includes('fecha') || questionLower.includes('tiempo') || questionLower.includes('cronograma')) {
      return responses.fechas;
    } else if (questionLower.includes('miembro') || questionLower.includes('equipo') || questionLower.includes('persona')) {
      return responses.miembros;
    }
    
    return responses.default;
  }
}

// Instancia singleton del servicio
const projectChatService = new ProjectChatService();

export default projectChatService;
