import { useCallback, useEffect, useRef, useState } from 'react';
import { noteGenerationStore } from '../services/noteGenerationStore';

/**
 * Estado y acciones de la generación de nota desde plantilla de UNA grabación.
 * El estado vive en `noteGenerationStore`, así que sobrevive al desmontaje del componente.
 *
 * @param {number|null} recordingId - ID numérico (SQLite) de la grabación
 * @param {{ onCompleted?: () => void, lang?: string }} [options]
 *   - `lang`: idioma en que se genera la nota (el de la UI; por defecto 'es')
 *   - `onCompleted`: se invoca cuando termina una nota de esta grabación mientras el componente
 *     está montado (no al cambiar de grabación)
 * @returns {{ isGenerating: boolean, error: string|null, completedCount: number,
 *   start: (templateSlug: string) => Promise<void>, cancel: () => void, dismissError: () => void }}
 */
export function useNoteGeneration(recordingId, { onCompleted, lang } = {}) {
  const [state, setState] = useState(() => noteGenerationStore.getRecordingState(recordingId));

  useEffect(() => noteGenerationStore.subscribe(() => {
    setState(noteGenerationStore.getRecordingState(recordingId));
  }), [recordingId]);

  const seenRef = useRef({ recordingId, count: state.completedCount });
  const onCompletedRef = useRef(onCompleted);
  useEffect(() => { onCompletedRef.current = onCompleted; });
  useEffect(() => {
    const seen = seenRef.current;
    const count = noteGenerationStore.getRecordingState(recordingId).completedCount;
    const prevCount = seen.recordingId === recordingId ? seen.count : count; // cambio de grabación: rebase
    seenRef.current = { recordingId, count };
    if (count !== prevCount) onCompletedRef.current?.();
  }, [recordingId, state.completedCount]);

  const start = useCallback((templateSlug) => noteGenerationStore.start({ recordingId, templateSlug, lang }), [recordingId, lang]);
  const cancel = useCallback(() => noteGenerationStore.cancel(recordingId), [recordingId]);
  const dismissError = useCallback(() => noteGenerationStore.dismissError(recordingId), [recordingId]);

  return {
    isGenerating: state.status === 'generating',
    error: state.status === 'error' ? state.error : null,
    completedCount: state.completedCount,
    start,
    cancel,
    dismissError,
  };
}
