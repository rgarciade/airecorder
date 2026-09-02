/**
 * Servicio de cola para todas las llamadas a la IA.
 * Serializa las llamadas para ejecutarlas de una en una y mantiene
 * un estado observable: tarea actual, cola pendiente e historial.
 * Cada tarea del historial conserva el prompt enviado y la respuesta recibida.
 *
 * La duración media por tipo se calcula dinámicamente desde el historial
 * de tareas completadas, sin persistencia externa.
 */

const MAX_HISTORY = 20;
const STORAGE_KEY = 'aiqueue_history';

function _loadPersistedHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const items = JSON.parse(raw).map(t => ({
      ...t,
      startedAt:   t.startedAt   ? new Date(t.startedAt)   : null,
      completedAt: t.completedAt ? new Date(t.completedAt) : null,
    }));
    // Deduplicar por ID (puede ocurrir con datos corruptos de sesiones anteriores)
    const seen = new Set();
    return items.filter(t => {
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });
  } catch {
    return [];
  }
}

function _persistHistory(history) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch {
    // cuota excedida u otro error — ignorar
  }
}

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
  ESQUEMA: 'esquema',
};

class AiQueueService {
  constructor() {
    this._queue = [];       // tareas pendientes (incluye _resolve, _reject, _fn internos)
    this._current = null;   // tarea en proceso (solo campos públicos)
    this._history = _loadPersistedHistory();
    this._listeners = new Set();
    this._processing = false;
    this._currentAbortController = null;
    // Inicializar desde el máximo ID persistido para evitar colisiones tras recarga
    const maxId = this._history.reduce((max, t) => (t.id > max ? t.id : max), 0);
    this._nextId = maxId + 1;
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
   *   Recibe un AbortSignal como único argumento para poder cancelar la tarea en curso.
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
        hidden: meta.hidden || false,
        groupId: meta.groupId || null,
        groupName: meta.groupName || null,
        overrideStartedAt: meta.overrideStartedAt || null,
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

    const startedAt = pubTask.overrideStartedAt || new Date();
    this._current = { ...pubTask, status: 'processing', startedAt };
    this._notify();

    const abortController = new AbortController();
    this._currentAbortController = abortController;

    try {
      const result = await _fn(abortController.signal);

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
      const isCancelled = error?.cancelled === true || error?.name === 'AbortError';
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
      if (isCancelled) error.cancelled = true;
      _reject(error);
    } finally {
      this._currentAbortController = null;
      this._processing = false;
      setTimeout(() => this._processNext(), 0);
    }
  }

  /**
   * Cancela una tarea por su ID: si está pendiente en la cola, la quita sin ejecutarla;
   * si es la tarea en proceso, aborta su llamada HTTP en curso (AbortController).
   * @param {number} taskId
   * @returns {boolean} true si se encontró y canceló la tarea
   */
  cancel(taskId) {
    const idx = this._queue.findIndex(t => t.id === taskId);
    if (idx !== -1) {
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

    if (this._current?.id === taskId && this._currentAbortController) {
      const err = new Error('Cancelado por el usuario');
      err.cancelled = true;
      this._currentAbortController.abort(err);
      return true;
    }

    return false;
  }

  /** Borra el historial de tareas completadas/fallidas/canceladas */
  clearHistory() {
    this._history = [];
    _persistHistory(this._history);
    this._notify();
  }

  _addToHistory(task) {
    this._history.unshift(task);
    if (this._history.length > MAX_HISTORY) {
      this._history.pop();
    }
    _persistHistory(this._history);
  }
}

// Singleton exportado — una única instancia para toda la app
export const aiQueueService = new AiQueueService();
