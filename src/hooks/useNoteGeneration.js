import { useCallback, useEffect, useState } from 'react';
import { noteGenerationStore } from '../services/noteGenerationStore';

/**
 * Estado y acciones de la generación de nota desde plantilla de UNA grabación.
 * El estado vive en `noteGenerationStore`, así que sobrevive al desmontaje del componente.
 *
 * @param {number|null} recordingId - ID numérico (SQLite) de la grabación
 * @returns {{ isGenerating: boolean, error: string|null, completedCount: number,
 *   start: (templateSlug: string) => Promise<void>, cancel: () => void, dismissError: () => void }}
 */
export function useNoteGeneration(recordingId) {
  const [state, setState] = useState(() => noteGenerationStore.getRecordingState(recordingId));

  useEffect(() => noteGenerationStore.subscribe(() => {
    setState(noteGenerationStore.getRecordingState(recordingId));
  }), [recordingId]);

  const start = useCallback((templateSlug) => noteGenerationStore.start({ recordingId, templateSlug }), [recordingId]);
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
