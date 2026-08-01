/**
 * Comando `/nota`: genera una nota Markdown a partir de la conversación del
 * chat y la persiste como `recording_notes` (mismo storage que "Generar desde
 * plantilla" en NotesTab). No destructivo — añade un mensaje asistente de
 * confirmación al final del historial.
 *
 * VERIFICADO (hallazgo, ver README): `recording_notes.template_slug` es una
 * columna TEXT sin FOREIGN KEY hacia `note_templates.slug` (a diferencia de
 * `recording_id`, que sí tiene FK real hacia `recordings`). El handler IPC
 * `templates:saveNote` tampoco valida que el slug exista. Por eso este comando
 * usa un slug sintético dedicado (`CHAT_NOTE_TEMPLATE_SLUG`) en vez de reutilizar
 * un slug de plantilla built-in real (ej. "daily-journal") — usar uno existente
 * atribuiría la nota a una plantilla con la que no tiene relación. Efecto
 * colateral aceptado (bug preexistente, no introducido aquí): `NotesTab.jsx`
 * lee `note.template_icon`/`note.template_name` de un JOIN que la query
 * `GET_NOTES_FOR_RECORDING` nunca hace (es un `SELECT * FROM recording_notes`
 * plano) — esos dos campos ya son `undefined` para CUALQUIER nota, con o sin
 * este comando; el icono cae a su fallback "📝" y el nombre queda en blanco.
 *
 * Scope 'project': NO soportado — `recording_notes` solo tiene FK a
 * `recording_id` (no existe columna de proyecto), y no hay ningún NotesTab de
 * proyecto en la UI. Se devuelve error inmediato sin intentar nada.
 */

import { chatNotePrompt } from '../../../prompts/common/chatCommandPrompts';
import { AI_TASK_TYPES } from '../../ai/aiQueueService';
import { callAiAnalysis, serializeChatForPrompt, makeAssistantEntry } from './_shared';

// Slug sintético dedicado a notas generadas por comandos de chat — no corresponde
// a ninguna fila real de `note_templates` (no hace falta: no hay FK que lo exija).
const CHAT_NOTE_TEMPLATE_SLUG = 'chat-command-note';

/**
 * @param {Object} ctx - Ver JSDoc de `useChatCommands.js`. Requiere `recordingId`
 *   en scope 'recording'. En scope 'project' devuelve error sin usar `ctx.projectId`.
 * @param {string} [args] - Foco opcional del usuario (`/nota céntrate en...`)
 * @returns {Promise<{success: boolean, error?: string, cancelled?: boolean}>}
 */
export async function runNote(ctx, args) {
  const { getHistory, replaceHistory, lang, model, t, scope, recordingId } = ctx;

  try {
    if (scope === 'project') {
      return { success: false, error: t('chatCommands.nota.projectUnsupported') };
    }
    if (!recordingId) {
      return { success: false, error: t('chatCommands.nota.noTarget') };
    }
    if (!window.electronAPI?.templates?.saveNote) {
      return { success: false, error: t('chatCommands.nota.error') };
    }

    const history = getHistory();
    const serialized = serializeChatForPrompt(history);
    if (!serialized.trim()) {
      return { success: false, error: t('chatCommands.nota.tooShort') };
    }

    const systemPrompt = chatNotePrompt(lang, { instructions: args || '' });
    const response = await callAiAnalysis(systemPrompt, serialized, {
      model,
      queueMeta: { name: 'Nota desde el chat', type: AI_TASK_TYPES.GENERAL },
    });

    const contentMd = response.text?.trim();
    if (!contentMd) {
      return { success: false, error: t('chatCommands.nota.empty') };
    }

    const saveResult = await window.electronAPI.templates.saveNote({
      recordingId,
      templateSlug: CHAT_NOTE_TEMPLATE_SLUG,
      contentMd,
    });

    if (!saveResult || !saveResult.success) {
      console.error('[noteCommand] saveNote falló:', saveResult?.error);
      return { success: false, error: t('chatCommands.nota.error') };
    }

    const header = `📝 **${t('chatCommands.nota.summaryHeader')}**\n\n${contentMd}`;
    const entry = makeAssistantEntry(header, 'nota');

    await replaceHistory([...history, entry]);
    return { success: true };
  } catch (err) {
    if (err.cancelled) {
      return { success: true, cancelled: true };
    }
    console.error('[noteCommand] Error en /nota:', err);
    return { success: false, error: t('chatCommands.nota.error') };
  }
}
