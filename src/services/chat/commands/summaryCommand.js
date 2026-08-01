/**
 * Comando `/resumen`: genera un resumen de TODA la conversación, igual que
 * `/compact`, pero NO destructivo — se añade como un nuevo mensaje asistente al
 * final del historial en vez de reemplazar nada.
 *
 * Reutiliza `summarizeMessages` (extraída de `chatCompactService.js`, misma
 * lógica de chunking map-reduce que /compact) y `compactChatPrompt(..., { full:
 * true })` (mismo prompt, con el framing ajustado a "toda la conversación" en
 * vez de "la parte antigua").
 */

import { summarizeMessages } from '../chatCompactService';
import { compactChatPrompt } from '../../../prompts/common/chatCommandPrompts';
import { mapHistoryToMessages } from '../../../prompts/common/ragPrompts';
import { serializeHistoryForPrompt } from '../chatHistory';
import { makeAssistantEntry } from './_shared';
import { MIN_SUMMARY_HISTORY_MESSAGES } from '../chatTokens';

/**
 * @param {Object} ctx - Ver JSDoc de `useChatCommands.js`
 * @param {string} [args] - Foco opcional del usuario (`/resumen céntrate en...`)
 * @returns {Promise<{success: boolean, error?: string, cancelled?: boolean}>}
 */
export async function runSummary(ctx, args) {
  const { getHistory, replaceHistory, lang, scope, model, t } = ctx;

  try {
    const history = getHistory();
    const messages = mapHistoryToMessages(history);

    if (messages.length < MIN_SUMMARY_HISTORY_MESSAGES) {
      return { success: false, error: t('chatCommands.resumen.tooShort') };
    }

    const fullSerialized = serializeHistoryForPrompt(messages);
    const systemPrompt = compactChatPrompt(lang, { scope, instructions: args || '', full: true });

    const summary = await summarizeMessages({
      messages,
      fullSerialized,
      systemPrompt,
      lang,
      model,
      taskName: 'Resumen del chat',
    });

    const header = `📄 **${t('chatCommands.resumen.summaryHeader')}**\n\n`;
    const entry = makeAssistantEntry(header + summary, 'resumen');

    await replaceHistory([...history, entry]);
    return { success: true };
  } catch (err) {
    if (err.cancelled) {
      return { success: true, cancelled: true };
    }
    if (err.code === 'EMPTY_SUMMARY') {
      return { success: false, error: t('chatCommands.resumen.empty') };
    }
    console.error('[summaryCommand] Error en /resumen:', err);
    return { success: false, error: t('chatCommands.resumen.error') };
  }
}
