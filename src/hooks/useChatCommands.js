import { useCallback } from 'react';
import { compactChatHistory } from '../services/chat/chatCompactService';

/**
 * Router de comandos de chat + persistencia inyectada por el padre.
 * Agnóstico del storage: ChatInterface no conoce ningún comando concreto —
 * cada padre (grabación vía JSON, proyecto vía SQLite) inyecta su propio
 * `getHistory` / `replaceHistory`. Mantiene delgados los dos componentes
 * de página que lo usan.
 *
 * @param {Object} params
 * @param {'recording'|'project'} params.scope
 * @param {string} params.lang - Idioma de la UI, para el prompt de compactado
 * @param {string} [params.model] - Override de modelo (sessionModel)
 * @param {() => Array} params.getHistory - Devuelve el historial actual (formato interno)
 * @param {(entries: Array) => Promise<void>} params.replaceHistory - Persiste (atómico) + actualiza estado local
 * @param {boolean} params.isBusy - true si ya hay una petición de chat/comando en curso
 * @param {(busy: boolean) => void} params.setBusy
 * @param {(result: Object, entries: Array) => void} [params.onCompacted] - Para recalcular contextInfo al instante
 * @param {Function} params.t - i18next t()
 * @returns {{ runCommand: (name: string, args?: string) => Promise<{success: boolean, error?: string, cancelled?: boolean}> }}
 */
export function useChatCommands({
  scope,
  lang,
  model,
  getHistory,
  replaceHistory,
  isBusy,
  setBusy,
  onCompacted,
  t,
}) {
  const runCompact = useCallback(async (args) => {
    // Guardia de re-entrancy: el botón "Compactar" de ContextBar llama a runCommand
    // directamente, sin pasar por la validación de ChatInterface — hay que
    // comprobar isBusy aquí también.
    if (isBusy) {
      return { success: false, error: t('chatCommands.busy') };
    }

    setBusy(true);
    try {
      const history = getHistory();
      const result = await compactChatHistory({
        history,
        instructions: args || '',
        lang,
        scope,
        model,
      });

      const header = `📋 **${t('chatCommands.compact.summaryHeader', { count: result.compactedCount })}**\n\n`;
      const entries = [
        {
          id: `compact_${Date.now()}`,
          tipo: 'asistente',
          contenido: header + result.summary,
          fecha: new Date().toISOString(),
          chatVersion: 2,
        },
        ...result.keptHistory,
      ];

      // Solo tocamos disco/SQLite una vez que tenemos un resumen validado.
      await replaceHistory(entries);
      onCompacted?.(result, entries);
      return { success: true };
    } catch (err) {
      if (err.cancelled) {
        // Cancelado desde el Monitor de Procesos: sin error visible y SIN tocar el historial
        // (compactChatHistory no llegó a resolver, así que replaceHistory nunca se llamó).
        return { success: true, cancelled: true };
      }
      if (err.code === 'HISTORY_TOO_SHORT') {
        return { success: false, error: t('chatCommands.compact.tooShort') };
      }
      if (err.code === 'EMPTY_SUMMARY') {
        return { success: false, error: t('chatCommands.compact.empty') };
      }
      console.error('[useChatCommands] Error en /compact:', err);
      return { success: false, error: t('chatCommands.compact.error') };
    } finally {
      setBusy(false);
    }
  }, [isBusy, setBusy, getHistory, replaceHistory, lang, scope, model, onCompacted, t]);

  const runCommand = useCallback(async (name, args) => {
    switch (name) {
      case 'compact':
        return runCompact(args);
      default:
        return { success: false, error: t('chatCommands.unknown') };
    }
  }, [runCompact, t]);

  return { runCommand };
}
