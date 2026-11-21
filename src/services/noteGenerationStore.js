/**
 * Estado global (fuera de React) de las generaciones de nota desde plantilla.
 *
 * La generación corre por la cola de IA (`aiQueueService`, tipo `AI_TASK_TYPES.NOTE`) y este
 * store guarda su estado por grabación para que sobreviva a la navegación: el componente de
 * la grabación puede desmontarse y, al volver, `useNoteGeneration` recupera "generando", el
 * error o el contador de notas terminadas (que dispara la recarga de la pestaña Notas).
 */

import { aiQueueService, AI_TASK_TYPES } from './ai/aiQueueService';
import { generateFromTemplate } from './noteTemplateService';

const IDLE = Object.freeze({ status: 'idle', error: null, templateSlug: null, completedCount: 0 });

/** Referencia con la que se etiqueta la tarea de la cola de una grabación. */
export const noteGenerationRef = (recordingId) => `note:${recordingId}`;

class NoteGenerationStore {
  constructor() {
    this._states = new Map();      // recordingId -> estado público
    this._controllers = new Map(); // recordingId -> AbortController de la generación activa
    this._listeners = new Set();
  }

  subscribe(callback) {
    this._listeners.add(callback);
    callback();
    return () => this._listeners.delete(callback);
  }

  _set(recordingId, patch) {
    this._states.set(recordingId, { ...this.getRecordingState(recordingId), ...patch });
    this._listeners.forEach((cb) => cb());
  }

  /** Estado de una grabación: { status: 'idle'|'generating'|'error', error, templateSlug, completedCount }. */
  getRecordingState(recordingId) {
    return this._states.get(recordingId) || IDLE;
  }

  /** Lanza la generación. Si ya hay una en curso para esa grabación no hace nada. */
  async start({ recordingId, templateSlug, lang = 'es' }) {
    if (!recordingId || this.getRecordingState(recordingId).status === 'generating') return;

    const controller = new AbortController();
    this._controllers.set(recordingId, controller);
    this._set(recordingId, { status: 'generating', error: null, templateSlug });

    try {
      await generateFromTemplate({
        recordingId,
        templateSlug,
        lang,
        signal: controller.signal,
        queueMeta: { type: AI_TASK_TYPES.NOTE, ref: noteGenerationRef(recordingId) },
      });
      this._set(recordingId, {
        status: 'idle',
        templateSlug: null,
        completedCount: this.getRecordingState(recordingId).completedCount + 1,
      });
    } catch (error) {
      if (error?.cancelled || controller.signal.aborted) {
        this._set(recordingId, { status: 'idle', templateSlug: null });
      } else {
        console.error('Error generating from template:', error);
        this._set(recordingId, { status: 'error', error: error?.message || String(error) });
      }
    } finally {
      this._controllers.delete(recordingId);
    }
  }

  /** Cancela la generación en curso (aborta la señal y cancela la tarea en la cola de IA). */
  cancel(recordingId) {
    const controller = this._controllers.get(recordingId);
    if (!controller) return false;
    controller.abort();
    const { current, queue } = aiQueueService.getState();
    const task = [current, ...queue].find((t) => t && t.ref === noteGenerationRef(recordingId));
    if (task) aiQueueService.cancel(task.id);
    return true;
  }

  dismissError(recordingId) {
    if (this.getRecordingState(recordingId).status !== 'error') return;
    this._set(recordingId, { status: 'idle', error: null, templateSlug: null });
  }

  /** Solo para tests. */
  reset() {
    this._controllers.forEach((c) => c.abort());
    this._controllers.clear();
    this._states.clear();
  }
}

export const noteGenerationStore = new NoteGenerationStore();
