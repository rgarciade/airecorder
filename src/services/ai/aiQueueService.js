/**
 * Servicio de cola para todas las llamadas a la IA.
 * Serializa las llamadas para ejecutarlas de una en una y mantiene
 * un estado observable: tarea actual, cola pendiente e historial.
 * Cada tarea del historial conserva el prompt enviado y la respuesta recibida.
 *
 * La duración media por tipo se calcula dinámicamente desde el historial
 * de tareas completadas, sin persistencia externa.
 */

const MAX_HISTORY = 50;

export const AI_TASK_TYPES = {
  SUMMARY: 'summary',
  DETAILED_SUMMARY: 'detailed-summary',
  KEY_TOPICS: 'key-topics',
  PARTICIPANTS: 'participants',
  TASK_SUGGESTIONS: 'task-suggestions',
  TASK_IMPROVEMENT: 'task-improvement',
  PROJECT_ANALYSIS: 'project-analysis',
  CHAT: 'chat',
  GENERAL: 'general',
};

class AiQueueService {
  constructor() {
    this._queue = [];       // tareas pendientes (incluye _resolve, _reject, _fn internos)
    this._current = null;   // tarea en proceso (solo campos públicos)
    this._history = [];     // tareas completadas/fallidas/canceladas
    this._listeners = new Set();
    this._processing = false;
    this._nextId = 1;
  }

  /**
   * Calcula duraciones medias por tipo a partir del historial de tareas completadas.
   * Devuelve { [type]: { count, totalMs } }
   */
  _computeAvgDurations() {
    const result = {};
    for (const task of this._history) {
      if (task.status !== 'completed' || !task.startedAt || !task.completedAt) continue;
      const ms = task.completedAt.getTime() - task.startedAt.getTime();
      if (ms <= 0) continue;
      if (!result[task.type]) result[task.type] = { count: 0, totalMs: 0 };
      result[task.type].count++;
      result[task.type].totalMs += ms;
    }
    return result;
  }

  /**
   * Suscribirse a cambios de estado de la cola.
   * El callback se invoca inmediatamente con el estado actual.
   * @param {Function} callback - (state: { current, queue, history }) => void
   * @returns {Function} Función para desuscribirse
   */
  subscribe(callback) {
    this._listeners.add(callback);
    callback(this.getState()); // estado inicial
    return () => this._listeners.delete(callback);
  }

  _notify() {
    const state = this.getState();
    this._listeners.forEach(cb => cb(state));
  }

  /**
   * Devuelve una copia del estado actual (sin funciones internas).
   */
  getState() {
    return {
      current: this._current ? { ...this._current } : null,
      queue: this._queue.map(({ _resolve, _reject, _fn, ...pub }) => ({ ...pub })),
      history: [...this._history],
      avgDurations: this._computeAvgDurations(),
    };
  }

  /**
   * Encola una llamada a la IA.
   * @param {Function} taskFn - Función async que realiza la llamada real al proveedor.
   * @param {Object} meta - Metadatos: { name, type, engine, prompt? }
   *   - prompt: texto del prompt enviado (se guarda en el historial para inspección)
   * @returns {Promise} Se resuelve/rechaza con el resultado cuando la tarea se ejecuta.
   */
  enqueue(taskFn, meta = {}) {
    return new Promise((resolve, reject) => {
      const task = {
        id: this._nextId++,
        name: meta.name || 'Tarea de IA',
        type: meta.type || AI_TASK_TYPES.GENERAL,
        engine: meta.engine || 'IA',
        // Prompt y respuesta — disponibles en el historial tras la ejecución
        prompt: meta.prompt || null,
        response: null,
        status: 'pending',
        createdAt: new Date(),
        startedAt: null,
        completedAt: null,
        error: null,
        _resolve: resolve,
        _reject: reject,
        _fn: taskFn,
      };
      this._queue.push(task);
      this._notify();
      this._processNext();
    });
  }

  async _processNext() {
    if (this._processing || this._queue.length === 0) return;

    this._processing = true;
    const task = this._queue.shift();
    const { _resolve, _reject, _fn, ...pubTask } = task;

    const startedAt = new Date();
    this._current = { ...pubTask, status: 'processing', startedAt };
    this._notify();

    try {
      const result = await _fn();

      // Capturar respuesta para el historial
      const responseText = typeof result?.text === 'string' ? result.text : null;
      const completedAt = new Date();

      this._addToHistory({
        ...pubTask,
        status: 'completed',
        startedAt,
        completedAt,
        response: responseText,
      });
      this._current = null;
      this._notify();
      _resolve(result);
    } catch (error) {
      const isCancelled = error?.cancelled === true;
      this._addToHistory({
        ...pubTask,
        status: isCancelled ? 'cancelled' : 'failed',
        startedAt,
        completedAt: new Date(),
        error: isCancelled ? null : (error?.message || 'Error desconocido'),
        response: null,
      });
      this._current = null;
      this._notify();
      _reject(error);
    } finally {
      this._processing = false;
      setTimeout(() => this._processNext(), 0);
    }
  }

  /**
   * Cancela una tarea pendiente en la cola por su ID.
   * No se puede cancelar la tarea que ya está en proceso.
   * @param {number} taskId
   * @returns {boolean} true si se encontró y canceló la tarea
   */
  cancel(taskId) {
    const idx = this._queue.findIndex(t => t.id === taskId);
    if (idx === -1) return false;

    const [task] = this._queue.splice(idx, 1);
    const { _resolve, _reject, _fn, ...pubTask } = task;

    this._addToHistory({
      ...pubTask,
      status: 'cancelled',
      completedAt: new Date(),
      response: null,
    });

    const err = new Error('Cancelado por el usuario');
    err.cancelled = true;
    _reject(err);
    this._notify();
    return true;
  }

  /** Borra el historial de tareas completadas/fallidas/canceladas */
  clearHistory() {
    this._history = [];
    this._notify();
  }

  _addToHistory(task) {
    this._history.unshift(task);
    if (this._history.length > MAX_HISTORY) {
      this._history.pop();
    }
  }
}

// Singleton exportado — una única instancia para toda la app
export const aiQueueService = new AiQueueService();
