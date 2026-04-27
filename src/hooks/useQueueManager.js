import { useState, useEffect, useCallback } from 'react';

/**
 * Hook para gestionar el estado y sincronización de la cola de transcripción/IA.
 */
export const useQueueManager = () => {
  const [queueCount, setQueueCount] = useState(0);
  const [queueState, setQueueState] = useState({ active: [], history: [] });

  const updateQueueState = useCallback((data) => {
    setQueueState(data || { active: [], history: [] });
    if (data?.active) {
      setQueueCount(data.active.length);
    }
  }, []);

  const loadQueueData = useCallback(async () => {
    try {
      if (window.electronAPI?.getTranscriptionQueue) {
        const result = await window.electronAPI.getTranscriptionQueue();
        if (result?.success) {
          updateQueueState(result);
        }
      }
    } catch (error) {
      console.error('[useQueueManager] Error loading queue data:', error);
    }
  }, [updateQueueState]);

  useEffect(() => {
    loadQueueData();

    let cleanup;
    if (window.electronAPI?.onQueueUpdate) {
      cleanup = window.electronAPI.onQueueUpdate((data) => {
        if (data) {
          updateQueueState(data);
        } else {
          loadQueueData();
        }
      });
    }

    return () => {
      if (typeof cleanup === 'function') cleanup();
    };
  }, [loadQueueData, updateQueueState]);

  return {
    queueCount,
    queueState,
    loadQueueData
  };
};

export default useQueueManager;
