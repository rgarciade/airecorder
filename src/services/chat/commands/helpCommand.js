/**
 * Comando `/help`: lista los comandos disponibles (nombre + descripción corta,
 * vía i18n) y los añade como un único mensaje asistente al final del historial.
 * Sin IA — solo lee el registro `CHAT_COMMANDS` y compone Markdown.
 */

import { CHAT_COMMANDS } from '../chatCommands';
import { makeAssistantEntry } from './_shared';

/**
 * @param {Object} ctx - Ver JSDoc de `useChatCommands.js`
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function runHelp(ctx) {
  const { getHistory, replaceHistory, t } = ctx;

  try {
    const lines = CHAT_COMMANDS.map(
      (cmd) => `- **/${cmd.name}** — ${t(`${cmd.i18nKey}.description`)}`
    );
    const contenido = `${t('chatCommands.help.header')}\n\n${lines.join('\n')}`;

    const entry = makeAssistantEntry(contenido, 'help');
    await replaceHistory([...getHistory(), entry]);
    return { success: true };
  } catch (err) {
    console.error('[helpCommand] Error en /help:', err);
    return { success: false, error: t('chatCommands.help.error') };
  }
}
