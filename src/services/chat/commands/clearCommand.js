/**
 * Comando `/clear`: vacía el historial del chat actual. Sin IA, sin guardas de
 * `minHistoryMessages` — si el historial ya está vacío, es un no-op (evita una
 * escritura innecesaria a disco/SQLite).
 */

/**
 * @param {Object} ctx - Ver JSDoc de `useChatCommands.js`
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function runClear(ctx) {
  const { getHistory, replaceHistory, t } = ctx;

  try {
    const current = getHistory();
    if (!current || current.length === 0) {
      return { success: true };
    }

    await replaceHistory([]);
    return { success: true };
  } catch (err) {
    console.error('[clearCommand] Error en /clear:', err);
    return { success: false, error: t('chatCommands.clear.error') };
  }
}
