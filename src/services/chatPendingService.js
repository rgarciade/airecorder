/**
 * chatPendingService.js
 *
 * Servicio singleton que rastrea peticiones de chat activas (pendientes de respuesta IA).
 * Permite que los componentes detecten si hay una petición en curso al montar/remontar,
 * restaurando el indicador de carga tras navegación.
 *
 * Patrón observer: los componentes se suscriben por clave y reciben notificaciones
 * cuando el estado cambia (nueva petición, completada, error).
 */

class ChatPendingService {
  constructor() {
    /** @type {Map<string, {key: string, question: string, startedAt: string, status: 'pending'|'error', error: string|null}>} */
    this._pending = new Map();
    /** @type {Set<{key: string, fn: Function}>} */
    this._listeners = new Set();
  }

  /**
   * Registra una petición de chat como pendiente.
   * @param {string} key - "recording_{id}" o "chat_{chatId}"
   * @param {string} question - Texto de la pregunta del usuario
   */
  setPending(key, question) {
    this._pending.set(key, {
      key,
      question,
      startedAt: new Date().toISOString(),
      status: 'pending',
      error: null
    });
    this._notifyKey(key);
  }

  /**
   * Marca la petición como completada y la elimina.
   * @param {string} key
   */
  clearPending(key) {
    if (this._pending.has(key)) {
      this._pending.delete(key);
      this._notifyKey(key);
    }
  }

  /**
   * Marca la petición como fallida (mantiene el registro para que
   * el componente pueda mostrar el error al remontar).
   * @param {string} key
   * @param {string} errorMessage
   */
  setError(key, errorMessage) {
    const entry = this._pending.get(key);
    if (entry) {
      entry.status = 'error';
      entry.error = errorMessage;
      this._notifyKey(key);
    }
  }

  /**
   * Obtiene el estado pendiente para una clave, o null.
   * @param {string} key
   * @returns {Object|null}
   */
  getPending(key) {
    return this._pending.get(key) || null;
  }

  /**
   * Suscribirse a cambios de una clave específica.
   * El callback se invoca inmediatamente con el estado actual.
   * @param {string} key - Clave a observar
   * @param {Function} callback - (pending: Object|null) => void
   * @returns {Function} unsubscribe
   */
  subscribe(key, callback) {
    const entry = { key, fn: callback };
    this._listeners.add(entry);
    // Emitir estado inicial
    callback(this.getPending(key));
    return () => {
      this._listeners.delete(entry);
    };
  }

  /**
   * Notifica solo a los listeners suscritos a una clave específica.
   * @param {string} key
   */
  _notifyKey(key) {
    const pending = this.getPending(key);
    this._listeners.forEach(entry => {
      if (entry.key === key) {
        entry.fn(pending);
      }
    });
  }
}

const chatPendingService = new ChatPendingService();
export default chatPendingService;
