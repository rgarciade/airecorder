/**
 * Comando `/buscar <query>`: fuerza modo RAG explícito con topK generoso para
 * una pregunta puntual, bypaseando el toggle Auto/Detallado del chat. Añade
 * AMBOS mensajes al historial (usuario: `/buscar <query>`, asistente: la
 * respuesta) — no destructivo.
 *
 * HALLAZGO IMPORTANTE (VERIFICADO): no existe un equivalente de
 * `projectAiService.askProjectQuestion` para una única grabación —
 * `recordingAiService.js` no tiene ninguna función `askQuestion`/similar. La
 * lógica RAG de la grabación vive INLINE en
 * `RecordingDetailWithTranscription.jsx` (handleAskQuestion, ~línea 673-786):
 * `ragService.getStatus` + `ragService.search` + `ragSystemPrompt` +
 * `callChatProviderStreaming`. Este comando replica ese mismo mecanismo
 * (sin adjuntos/esquema — ver limitación abajo) en vez de delegar a un
 * servicio que no existe.
 *
 * Para scope 'project' sí existe un servicio reutilizable:
 * `projectChatService.generateAiResponse(projectId, question, chatId, ...)`
 * ya resuelve `recordingIds`/`recordingTitles` del chat activo internamente,
 * así que aquí solo se fuerza `ragMode: 'detallado'` (topK generoso) en vez del
 * modo que tuviera activo el toggle del chat.
 *
 * LIMITACIÓN (simplificación deliberada, no del spec original): no se inyectan
 * adjuntos/documentos ni el esquema/mind-map de la grabación en el system
 * prompt (a diferencia de `handleAskQuestion`) — `/buscar` es una pregunta RAG
 * puntual y ligera, no un reemplazo completo del chat principal.
 */

import ragService from '../../ragService';
import projectChatService from '../../projectChatService';
import { callChatProviderStreaming } from '../../ai/providerRouter';
import { ragSystemPrompt, mapHistoryToMessages } from '../../../prompts/common/ragPrompts';
import { makeAssistantEntry, makeUserEntry } from './_shared';

// Mismo valor que `ragMode === 'detallado'` en RecordingDetailWithTranscription.jsx —
// "topK generoso" documentado en el spec del comando.
const FORCED_TOPK = 40;

async function _appendQaEntries(getHistory, replaceHistory, query, answer) {
  const history = getHistory();
  const entries = [
    ...history,
    makeUserEntry(`/buscar ${query}`, 'buscar_q'),
    makeAssistantEntry(answer, 'buscar_a'),
  ];
  await replaceHistory(entries);
}

async function _runRecordingSearch(ctx, query) {
  const { ragRecordingId, getHistory, replaceHistory, model, t } = ctx;

  if (!ragRecordingId) {
    return { success: false, error: t('chatCommands.buscar.noTarget') };
  }

  const status = await ragService.getStatus(ragRecordingId);
  if (!status?.success || !status.indexed) {
    return { success: false, error: t('chatCommands.buscar.notIndexed') };
  }

  const searchResult = await ragService.search(ragRecordingId, query, FORCED_TOPK);
  if (!searchResult?.success || !searchResult.chunks?.length) {
    return { success: false, error: t('chatCommands.buscar.noResults') };
  }

  const systemContent = ragSystemPrompt(searchResult.chunks);
  const historyMessages = mapHistoryToMessages(getHistory());
  const messages = [
    { role: 'system', content: systemContent },
    ...historyMessages,
    { role: 'user', content: query },
  ];

  const response = await callChatProviderStreaming(messages, () => {}, {
    model,
    queueMeta: { name: 'Buscar en el chat (RAG forzado)' },
  });
  const answer = response.text || '';

  await _appendQaEntries(getHistory, replaceHistory, query, answer);
  return { success: true };
}

async function _runProjectSearch(ctx, query) {
  const { projectId, chatId, getHistory, replaceHistory, model, t } = ctx;

  if (!projectId || !chatId) {
    return { success: false, error: t('chatCommands.buscar.noTarget') };
  }

  const history = getHistory();
  const result = await projectChatService.generateAiResponse(
    projectId,
    query,
    chatId,
    history,
    'detallado', // fuerza topK generoso — bypasea el toggle Auto/Detallado del chat
    { model },
    () => {}
  );
  const answer = result?.text || '';

  await _appendQaEntries(getHistory, replaceHistory, query, answer);
  return { success: true };
}

/**
 * @param {Object} ctx - Ver JSDoc de `useChatCommands.js`. Requiere `ragRecordingId`
 *   (scope 'recording') o `projectId` + `chatId` (scope 'project').
 * @param {string} args - Query obligatoria (`requiresArgs: true` en el registro)
 * @returns {Promise<{success: boolean, error?: string, cancelled?: boolean}>}
 */
export async function runSearch(ctx, args) {
  const { scope, t } = ctx;
  const query = (args || '').trim();

  if (!query) {
    return { success: false, error: t('chatCommands.buscar.emptyQuery') };
  }

  try {
    return scope === 'project'
      ? await _runProjectSearch(ctx, query)
      : await _runRecordingSearch(ctx, query);
  } catch (err) {
    if (err.cancelled) {
      return { success: true, cancelled: true };
    }
    console.error('[searchCommand] Error en /buscar:', err);
    return { success: false, error: t('chatCommands.buscar.error') };
  }
}
