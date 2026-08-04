/**
 * Normalización de formatos de historial + serialización para prompts.
 * Agnóstico del storage (JSON de grabación o SQLite de proyecto): ambos
 * comparten los mismos 3 formatos de entrada.
 */

/**
 * Normaliza el historial de chat a un array plano de mensajes
 * `{ id, tipo, contenido, fecha, adjuntos }`, manejando los 3 formatos posibles:
 *
 * 1. Mensaje individual en memoria: tiene `tipo` y `contenido` — se devuelve tal cual.
 * 2. Par pregunta/respuesta V2 en JSON: tiene `tipo` y `pregunta` (sin `contenido`) — se expande en dos.
 * 3. Par pregunta/respuesta V1 en JSON (legacy): solo tiene `pregunta`, sin `tipo` — se expande en dos.
 *
 * NO añade ningún mensaje de streaming en curso (a diferencia de
 * `convertChatHistory` en RecordingDetailWithTranscription.jsx, que sigue
 * siendo responsable de eso porque depende de estado local de React).
 *
 * @param {Array} history
 * @returns {Array<{id: string, tipo: 'usuario'|'asistente', contenido: string, fecha?: string, adjuntos?: Array}>}
 */
export function normalizeChatHistory(history) {
  if (!history || history.length === 0) return [];

  return history.flatMap((item, i) => {
    // Caso 1: mensaje individual en memoria (tiene contenido explícito). Mismo criterio
    // que la función canónica `mapHistoryToMessages` (src/prompts/common/ragPrompts.js):
    // solo exige `contenido !== undefined` — un `tipo` falsy/ausente cae a 'asistente',
    // NO se descarta el mensaje. Divergir aquí es peligroso: este historial alimenta un
    // reemplazo IRREVERSIBLE (/compact).
    if (item.contenido !== undefined) {
      return [{
        id: item.id ?? `n_${i}`,
        tipo: item.tipo === 'usuario' ? 'usuario' : 'asistente',
        contenido: item.contenido,
        fecha: item.fecha,
        adjuntos: item.adjuntos || [],
        // Reenviamos `pendingAction` tal cual si el mensaje lo trae (ver
        // providerRouter.js#_runToolCallingLoop) — sin este passthrough, este
        // mismo objeto literal lo descartaría silenciosamente antes de llegar a
        // ChatInterface.jsx, que es quien lo lee para renderizar los botones de
        // confirmación. No aplica a los casos 2/3 (pares pregunta/respuesta
        // legacy): un `pendingAction` solo existe en mensajes individuales V2.
        ...(item.pendingAction !== undefined ? { pendingAction: item.pendingAction } : {}),
      }];
    }

    // Casos 2 y 3: par pregunta/respuesta guardado en JSON — expandir en mensajes separados
    const msgs = [{
      id: `u_${i}`,
      tipo: 'usuario',
      contenido: item.pregunta,
      fecha: item.fecha,
      adjuntos: item.adjuntos || [],
    }];
    if (item.respuesta) {
      msgs.push({
        id: `a_${i}`,
        tipo: 'asistente',
        contenido: item.respuesta,
        fecha: item.fecha,
        // Mismo passthrough que el Caso 1 (ver comentario de arriba) — sin esto, un
        // `pendingAction` persistido junto a un par pregunta/respuesta (ver
        // RecordingDetailWithTranscription.jsx#handleAskQuestion) se perdería al
        // recargar el historial desde disco, y los botones de confirmación
        // desaparecerían tras cualquier recarga (bug real: la suscripción a
        // chatPendingService recarga el historial justo después de crear el
        // mensaje, y sin este fix pisaba la versión con pendingAction).
        ...(item.pendingAction !== undefined ? { pendingAction: item.pendingAction } : {}),
      });
    }
    return msgs;
  });
}

/**
 * Serializa un array de mensajes `{role, content}` (formato `mapHistoryToMessages`)
 * a texto plano legible, para incluir como user content en el prompt de compactado.
 * @param {Array<{role: 'user'|'assistant', content: string}>} messages
 * @returns {string}
 */
export function serializeHistoryForPrompt(messages) {
  if (!messages || messages.length === 0) return '';
  return messages
    .map((m) => `[${m.role === 'user' ? 'USUARIO' : 'ASISTENTE'}]: ${m.content}`)
    .join('\n\n');
}
