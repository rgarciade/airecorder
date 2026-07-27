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
