import { beforeEach, describe, expect, it, vi } from 'vitest';

const generateFromTemplate = vi.fn();
vi.mock('../../services/noteTemplateService', () => ({ generateFromTemplate: (...a) => generateFromTemplate(...a) }));

const { aiQueueService, AI_TASK_TYPES } = await import('../../services/ai/aiQueueService');
const { noteGenerationStore, noteGenerationRef } = await import('../../services/noteGenerationStore');

// Sustituto de generateFromTemplate: encola una tarea real (como hace callProvider) con el
// queueMeta recibido, para comprobar que la cancelación llega a la cola de IA.
function queuedGeneration(deferred) {
  generateFromTemplate.mockImplementation(({ queueMeta }) =>
    aiQueueService.enqueue((signal) => new Promise((res, rej) => {
      signal.addEventListener('abort', () => rej(signal.reason));
      deferred.promise.then(res);
    }), queueMeta).then(() => ({ noteId: 7, contentMd: 'x' })));
}

function defer() {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

describe('noteGenerationStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    noteGenerationStore.reset();
  });

  it('marks a recording as generating while the job runs and bumps completed on success', async () => {
    const d = defer();
    queuedGeneration(d);
    const p = noteGenerationStore.start({ recordingId: 1, templateSlug: 'daily' });
    expect(noteGenerationStore.getRecordingState(1).status).toBe('generating');
    expect(noteGenerationStore.getRecordingState(2).status).toBe('idle');

    d.resolve({ text: 'ok' });
    await p;
    const s = noteGenerationStore.getRecordingState(1);
    expect(s.status).toBe('idle');
    expect(s.completedCount).toBe(1);
  });

  it('tags the queue task with type NOTE and a per-recording ref', async () => {
    const d = defer();
    queuedGeneration(d);
    const p = noteGenerationStore.start({ recordingId: 5, templateSlug: 'daily' });
    expect(generateFromTemplate.mock.calls[0][0].queueMeta).toMatchObject({
      type: AI_TASK_TYPES.NOTE,
      ref: noteGenerationRef(5),
    });
    d.resolve({ text: 'ok' });
    await p;
  });

  it('ignores a second start for the same recording while one is running', async () => {
    const d = defer();
    queuedGeneration(d);
    const p = noteGenerationStore.start({ recordingId: 1, templateSlug: 'a' });
    await noteGenerationStore.start({ recordingId: 1, templateSlug: 'b' });
    expect(generateFromTemplate).toHaveBeenCalledTimes(1);
    d.resolve({ text: 'ok' });
    await p;
  });

  it('keeps a non-blocking error state and lets the user dismiss it', async () => {
    generateFromTemplate.mockRejectedValue(new Error('boom'));
    await noteGenerationStore.start({ recordingId: 1, templateSlug: 'a' });
    const s = noteGenerationStore.getRecordingState(1);
    expect(s.status).toBe('error');
    expect(s.error).toBe('boom');

    noteGenerationStore.dismissError(1);
    expect(noteGenerationStore.getRecordingState(1).status).toBe('idle');
  });

  it('cancel aborts the queued AI task and ends without error', async () => {
    const d = defer();
    queuedGeneration(d);
    const p = noteGenerationStore.start({ recordingId: 1, templateSlug: 'a' });
    expect(noteGenerationStore.cancel(1)).toBe(true);
    d.resolve({ text: 'late' });
    await p;
    const s = noteGenerationStore.getRecordingState(1);
    expect(s.status).toBe('idle');
    expect(s.completedCount).toBe(0);
  });

  it('notifies subscribers on every change and stops after unsubscribe', async () => {
    const cb = vi.fn();
    const off = noteGenerationStore.subscribe(cb);
    cb.mockClear();
    generateFromTemplate.mockResolvedValue({ noteId: 1 });
    await noteGenerationStore.start({ recordingId: 1, templateSlug: 'a' });
    expect(cb).toHaveBeenCalled();
    off();
    cb.mockClear();
    noteGenerationStore.dismissError(1);
    expect(cb).not.toHaveBeenCalled();
  });
});
