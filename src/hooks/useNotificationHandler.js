import { useEffect } from 'react';

/**
 * Hook para manejar eventos de notificaciones del sistema (ej. clic en notificación).
 * @param {Function} onRecordingClick Callback invocado cuando se hace clic en una notificación de grabación.
 */
export const useNotificationHandler = (onRecordingClick) => {
  useEffect(() => {
    if (!window.electronAPI?.onNotificationClick) return;

    const cleanup = window.electronAPI.onNotificationClick((payload) => {
      console.log('[useNotificationHandler] Clic en notificación:', payload);
      if (payload?.recordingId && typeof onRecordingClick === 'function') {
        onRecordingClick(payload.recordingId);
      }
    });

    return () => {
      if (typeof cleanup === 'function') cleanup();
    };
  }, [onRecordingClick]);
};

export default useNotificationHandler;
