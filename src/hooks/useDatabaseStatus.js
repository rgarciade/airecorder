import { useState, useEffect, useCallback } from 'react';

/**
 * Hook para monitorizar el estado de la base de datos y manejar banners de fallback.
 */
export const useDatabaseStatus = () => {
  const [dbFallbackBanner, setDbFallbackBanner] = useState(false);

  const checkDbStatus = useCallback(async () => {
    try {
      if (window.electronAPI?.getDbStatus) {
        const status = await window.electronAPI.getDbStatus();
        if (status?.usingFallback) {
          setDbFallbackBanner(true);
        }
      }
    } catch (err) {
      console.error('[useDatabaseStatus] Error consultando estado de BD:', err);
    }
  }, []);

  useEffect(() => {
    checkDbStatus();
  }, [checkDbStatus]);

  return {
    dbFallbackBanner,
    setDbFallbackBanner,
    checkDbStatus
  };
};

export default useDatabaseStatus;
