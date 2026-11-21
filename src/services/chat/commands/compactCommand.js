/**
 * Wrapper fino del comando `/compact`. Toda la lógica IA vive en
 * `chatCompactService.compactChatHistory` (NO se toca su interior) — este
 * archivo solo adapta esa lógica al contrato `runFn(ctx, args)` común a todos
 * los comandos (ver `commands/index.js`).
 *
 * El guard de re-entrancy (isBusy/setBusy) ahora vive centralizado en el router
 * (`useChatCommands.js`), así que cubre por igual el input de texto (`/compact`)
 * y el botón "Compactar" de `ContextBar` (ambos pasan por `runCommand`).
 */

import { compactChatHistory } from '../chatCompactService';

/**
 * @param {Object} ctx - Ver JSDoc de `useChatCommands.js`
 * @param {string} [args] - Foco opcional del usuario (`/compact céntrate en...`)
 * @returns {Promise<{success: boolean, error?: string, cancelled?: boolean}>}
 */
export async function runCompact(ctx, args) {
  const { getHistory, replaceHistory, lang, scope, model, onCompacted, t } = ctx;

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
    console.error('[compactCommand] Error en /compact:', err);
    return { success: false, error: t('chatCommands.compact.error') };
  }
}
