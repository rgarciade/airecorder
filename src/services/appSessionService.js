// Servicio para gestionar el identificador único de sesión de la aplicación
// Permite detectar cuando la app se reinicia y limpiar estados obsoletos

class AppSessionService {
  constructor() {
    this.sessionId = this.generateSessionId();
    console.log(`🔑 Nueva sesión de app iniciada: ${this.sessionId}`);
  }

  /**
   * Genera un UUID único para la sesión actual
   * @returns {string} UUID único
   */
  generateSessionId() {
    // Generar UUID v4 simple
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Obtiene el ID de sesión actual
   * @returns {string} ID de sesión actual
   */
  getSessionId() {
    return this.sessionId;
  }

  /**
   * Verifica si un sessionId dado corresponde a la sesión actual
   * @param {string} sessionId - ID de sesión a verificar
   * @returns {boolean} true si es la sesión actual
   */
  isCurrentSession(sessionId) {
    return this.sessionId === sessionId;
  }
}

// Instancia singleton del servicio
const appSessionService = new AppSessionService();

export default appSessionService;
