import { useCallback } from 'react';
import { CHAT_COMMAND_HANDLERS } from '../services/chat/commands';

/**
 * Router de comandos de chat + persistencia inyectada por el padre.
 * Agnóstico del storage: ChatInterface no conoce ningún comando concreto —
 * cada padre (grabación vía JSON, proyecto vía SQLite) inyecta su propio
 * `getHistory` / `replaceHistory`. Mantiene delgados los dos componentes
 * de página que lo usan.
 *
 * Toda la lógica de ejecución vive en `services/chat/commands/*Command.js`
 * (mapeada por nombre en `CHAT_COMMAND_HANDLERS`) — este hook solo arma el
 * `ctx` común una vez y centraliza el guard de re-entrancy (isBusy/setBusy),
 * que cubre por igual el input de texto (`/compact`, `/resumen`, ...) y
 * puntos de entrada directos como el botón "Compactar" de `ContextBar`
 * (que llama a `runCommand('compact')` sin pasar por la validación de
 * `ChatInterface`).
 *
 * @param {Object} params
 * @param {'recording'|'project'} params.scope
 * @param {string} params.lang - Idioma de la UI, para los prompts de IA
 * @param {string} [params.model] - Override de modelo (sessionModel)
 * @param {() => Array} params.getHistory - Devuelve el historial actual (formato interno)
 * @param {(entries: Array) => Promise<void>} params.replaceHistory - Persiste (atómico) + actualiza estado local
 * @param {boolean} params.isBusy - true si ya hay una petición de chat/comando en curso
 * @param {(busy: boolean) => void} params.setBusy
 * @param {(result: Object, entries: Array) => void} [params.onCompacted] - Para recalcular contextInfo al instante (usado por /compact)
 * @param {Function} params.t - i18next t()
 * @param {number|string} [params.recordingId] - Scope 'recording': ID numérico en SQLite
 *   (dbId) — usado por /tareas y /nota para persistir en `task_suggestions`/`recording_notes`.
 * @param {string} [params.ragRecordingId] - Scope 'recording': ID basado en carpeta
 *   (`recording.id`) — usado por /buscar para `ragService` (RAG opera sobre el
 *   archivo de transcripción, no sobre la fila de la base de datos).
 * @param {string} [params.projectId] - Scope 'project': usado por /tareas y /buscar.
 * @param {string} [params.chatId] - Scope 'project': chat activo, usado por /buscar
 *   (`projectChatService.generateAiResponse`).
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
  recordingId,
  ragRecordingId,
  projectId,
  chatId,
}) {
  const runCommand = useCallback(async (name, args) => {
    // Guardia de re-entrancy centralizada: cubre tanto el input de texto (que ya
    // valida antes de llamar) como puntos de entrada directos (botón "Compactar"
    // de ContextBar) que llaman a runCommand sin pasar por esa validación previa.
    if (isBusy) {
      return { success: false, error: t('chatCommands.busy') };
    }

    const handler = CHAT_COMMAND_HANDLERS[name];
    if (!handler) {
      return { success: false, error: t('chatCommands.unknown') };
    }

    setBusy(true);
    try {
      const ctx = {
        scope,
        lang,
        model,
        getHistory,
        replaceHistory,
        t,
        onCompacted,
        recordingId,
        ragRecordingId,
        projectId,
        chatId,
      };
      return await handler(ctx, args);
    } catch (err) {
      // Red de seguridad: el contrato de runFn es "nunca rechaza", pero si algún
      // comando futuro olvida su propio try/catch, esto evita que runCommand
      // rechace la promesa hacia ChatInterface/ContextBar.
      if (err?.cancelled) return { success: true, cancelled: true };
      console.error(`[useChatCommands] Error inesperado ejecutando /${name}:`, err);
      return { success: false, error: t('chatCommands.unknown') };
    } finally {
      setBusy(false);
    }
  }, [
    isBusy, setBusy, scope, lang, model, getHistory, replaceHistory, t,
    onCompacted, recordingId, ragRecordingId, projectId, chatId,
  ]);

  return { runCommand };
}
