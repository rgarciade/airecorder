import { useEffect, useCallback } from 'react';

const COOLDOWN_MS = 15 * 60 * 1000;
let lastShown = 0;

export default function useMicrophoneActivation({ onStartRecording, isRecording }) {
  // Sincroniza estado de grabación con el monitor en main process
  useEffect(() => {
    window.electronAPI?.setAppRecordingState?.(isRecording);
  }, [isRecording]);

  const handleStart = useCallback(() => {
    onStartRecording?.();
  }, [onStartRecording]);

  // "Grabar ahora" desde notificación nativa
  useEffect(() => {
    const handler = () => {
      const now = Date.now();
      if (now - lastShown < COOLDOWN_MS) return;
      lastShown = now;
      handleStart();
    };
    window.addEventListener('notification-start-recording', handler);
    return () => window.removeEventListener('notification-start-recording', handler);
  }, [handleStart]);
}
