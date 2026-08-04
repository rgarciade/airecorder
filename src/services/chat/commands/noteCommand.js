/**
 * Comando `/nota`: genera una nota Markdown a partir del contexto disponible y la
 * persiste como `recording_notes` (mismo storage que "Generar desde plantilla" en
 * NotesTab). No destructivo — añade un mensaje asistente de confirmación al final del
 * historial.
 *
 * Fuente del contexto (ver `gatherTaskContext` en `commands/_shared.js`): prioriza LA
 * CONVERSACIÓN del chat cuando ya tiene contenido suficiente (comportamiento original).
 * Si el chat es nuevo/corto, cae a un fallback RAG sobre la transcripción de la
 * grabación — mismo mecanismo que `/buscar`. Marcado `runsInBackground: true` en el
 * registro (`chatCommands.js`): no bloquea el chat mientras corre. Cualquier error real
 * (no cancelación) se postea como mensaje visible en el historial vía
 * `postCommandError` — el caller (`useChatCommands`) ya no espera esta promesa ni mira
 * su retorno para mostrar un banner.
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
import { callAiAnalysis, makeAssistantEntry, gatherTaskContext, postCommandError } from './_shared';

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
      const message = t('chatCommands.nota.projectUnsupported');
      await postCommandError(ctx, message, 'nota_error');
      return { success: false, error: message };
    }
    if (!recordingId) {
      const message = t('chatCommands.nota.noTarget');
      await postCommandError(ctx, message, 'nota_error');
      return { success: false, error: message };
    }
    if (!window.electronAPI?.templates?.saveNote) {
      const message = t('chatCommands.nota.error');
      await postCommandError(ctx, message, 'nota_error');
      return { success: false, error: message };
    }

    // gatherTaskContext usa la conversación del chat si YA tiene contenido suficiente
    // (comportamiento histórico sin cambios) o cae a un fallback RAG sobre la
    // transcripción cuando el chat es nuevo/corto — ver commands/_shared.js.
    const context = await gatherTaskContext(ctx, args);
    if (context.source === 'none') {
      const message = t('chatCommands.nota.tooShort');
      await postCommandError(ctx, message, 'nota_error');
      return { success: false, error: message };
    }

    // Si el fallback RAG ya consumió `args` como query de búsqueda, no lo repetimos como
    // "instructions" — evitaría instruir dos veces lo mismo en el prompt final. Cuando la
    // fuente es 'chat' (chat rico), `args` sigue viajando como foco, igual que siempre,
    // con la misma mitigación de prompt-injection ya presente en `chatNotePrompt`.
    const argsUsedAsRagQuery = context.source !== 'chat' && Boolean(args && args.trim());
    const instructions = argsUsedAsRagQuery ? '' : (args || '');

    const systemPrompt = chatNotePrompt(lang, { instructions });
    const response = await callAiAnalysis(systemPrompt, context.text, {
      model,
      queueMeta: { name: 'Nota desde el chat', type: AI_TASK_TYPES.GENERAL },
    });

    const contentMd = response.text?.trim();
    if (!contentMd) {
      const message = t('chatCommands.nota.empty');
      await postCommandError(ctx, message, 'nota_error');
      return { success: false, error: message };
    }

    const saveResult = await window.electronAPI.templates.saveNote({
      recordingId,
      templateSlug: CHAT_NOTE_TEMPLATE_SLUG,
      contentMd,
    });

    if (!saveResult || !saveResult.success) {
      console.error('[noteCommand] saveNote falló:', saveResult?.error);
      const message = t('chatCommands.nota.error');
      await postCommandError(ctx, message, 'nota_error');
      return { success: false, error: message };
    }

    const header = `📝 **${t('chatCommands.nota.summaryHeader')}**\n\n${contentMd}`;
    const entry = makeAssistantEntry(header, 'nota');

    await replaceHistory([...getHistory(), entry]);
    return { success: true };
  } catch (err) {
    if (err.cancelled) {
      return { success: true, cancelled: true };
    }
    console.error('[noteCommand] Error en /nota:', err);
    const message = t('chatCommands.nota.error');
    await postCommandError(ctx, message, 'nota_error');
    return { success: false, error: message };
  }
}
