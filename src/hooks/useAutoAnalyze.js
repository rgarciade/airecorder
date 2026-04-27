import { useEffect } from 'react';
import recordingAiService from '../services/recordingAiService';

/**
 * Hook para manejar el auto-análisis de IA cuando finaliza una transcripción.
 * Escucha el evento 'onAutoAnalyze' desde Electron y dispara las tareas de IA.
 */
export const useAutoAnalyze = () => {
  useEffect(() => {
    if (!window.electronAPI?.onAutoAnalyze) {
      console.warn('[useAutoAnalyze] electronAPI.onAutoAnalyze no disponible');
      return;
    }

    const cleanup = window.electronAPI.onAutoAnalyze(async (recordingId) => {
      console.log('[useAutoAnalyze] Iniciando tareas de IA automáticas para:', recordingId);
      
      try {
        // Ejecutamos ambas tareas. Usamos Promise.all para que corran en paralelo
        // si el servicio lo permite, o secuencialmente si prefieres control total.
        await Promise.all([
          recordingAiService.generateRecordingSummary(recordingId),
          recordingAiService.extractParticipants(recordingId)
        ]);
        
        console.log('[useAutoAnalyze] Auto-análisis completado con éxito:', recordingId);
      } catch (err) {
        console.error('[useAutoAnalyze] Error durante el auto-análisis:', err);
      }
    });

    return () => {
      if (typeof cleanup === 'function') {
        cleanup();
      }
    };
  }, []);
};

export default useAutoAnalyze;
