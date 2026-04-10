import { useState, useEffect, useCallback, useRef } from 'react';
import { getSettings, updateSettings } from '../services/settingsService';
import i18n from '../i18n/index.js';

/**
 * Hook para gestionar la sesión de la aplicación: configuración, tracking e idiomas.
 * @param {Function} onFinishLoading Callback invocado cuando la sesión se ha inicializado.
 */
export const useSession = (onFinishLoading) => {
  const [appSettings, setAppSettings] = useState(null);
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  const hasLoadedRef = useRef(false);

  // Usamos un ref para el callback para evitar recrear loadAppSettings si la función cambia
  const onFinishLoadingRef = useRef(onFinishLoading);
  useEffect(() => {
    onFinishLoadingRef.current = onFinishLoading;
  }, [onFinishLoading]);

  const loadAppSettings = useCallback(async (forceShowWhatsNew = false) => {
    try {
      const settings = await getSettings();
      setAppSettings(settings);

      // Tracking: Primer inicio del día
      if (import.meta.env.VITE_SENTRY_DSN) {
        const today = new Date().toISOString().split('T')[0];
        if (settings.lastLoginDate !== today) {
          if (window.electronAPI?.sentryLogInfo) {
            window.electronAPI.sentryLogInfo('Usuario ha entrado en la app (Daily Login)');
          }
          updateSettings({ lastLoginDate: today }).catch(err => console.error(err));
        }
      }
      
      // Tracking: Actualización de versión
      if (window.electronAPI?.getAppVersion) {
        const r = await window.electronAPI.getAppVersion();
        if (r?.success) {
          const currentVersion = r.version;
          const isVersionChange = settings.lastVersion && settings.lastVersion !== currentVersion;

          if (isVersionChange && import.meta.env.VITE_SENTRY_DSN) {
            window.electronAPI.sentryLogInfo?.(`App actualizada: de v${settings.lastVersion} a v${currentVersion}`);
          }
          if (settings.lastVersion !== currentVersion) {
            await updateSettings({ lastVersion: currentVersion });
          }

          // Mostrar "Novedades" (Solo si es la primera carga o se fuerza)
          if (!hasLoadedRef.current || forceShowWhatsNew) {
            if (!settings.isFirstRun && (import.meta.env.DEV || isVersionChange)) {
              setShowWhatsNew(true);
            }
          }
        }
      }

      // Aplicar idioma
      if (settings.uiLanguage) {
        i18n.changeLanguage(settings.uiLanguage);
      } else if (settings.isFirstRun && window.electronAPI?.getSystemLanguage) {
        const systemLang = await window.electronAPI.getSystemLanguage();
        i18n.changeLanguage(systemLang);
        updateSettings({ uiLanguage: systemLang }).catch(err => console.error(err));
      }

      if (typeof onFinishLoadingRef.current === 'function') {
        onFinishLoadingRef.current(settings);
      }

      hasLoadedRef.current = true;
    } catch (error) {
      console.error('[useSession] Error loading app settings:', error);
      if (typeof onFinishLoadingRef.current === 'function') {
        onFinishLoadingRef.current(null);
      }
    }
  }, []); // Sin dependencias, solo se crea una vez

  useEffect(() => {
    if (!hasLoadedRef.current) {
      loadAppSettings();
    }
  }, [loadAppSettings]);

  return {
    appSettings,
    setAppSettings,
    showWhatsNew,
    setShowWhatsNew,
    loadAppSettings
  };
};

export default useSession;
