import { useEffect } from 'react';
import { applyTheme } from '../services/themeService';

/**
 * Hook para gestionar la apariencia de la aplicación (tema y tamaño de fuente).
 * @param {Object} appSettings Configuración de la aplicación que incluye theme y fontSize.
 */
export const useAppearance = (appSettings) => {
  // Efecto para el tamaño de la fuente
  useEffect(() => {
    if (appSettings?.fontSize) {
      document.documentElement.setAttribute('data-font-size', appSettings.fontSize);
    } else {
      document.documentElement.setAttribute('data-font-size', 'medium');
    }
  }, [appSettings?.fontSize]);

  // Efecto para el tema (claro/oscuro/sistema)
  useEffect(() => {
    applyTheme(appSettings?.theme || 'system');
  }, [appSettings?.theme]);
};

export default useAppearance;
