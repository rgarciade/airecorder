/**
 * Prompts específicos para chat con RAG sobre transcripciones
 */

const ragSystemInstructions = `Eres un asistente experto que responde preguntas sobre una grabación de audio basándote en fragmentos relevantes de la transcripción.

REGLAS:
1. Basa tu respuesta SOLO en los fragmentos proporcionados
2. Si los fragmentos no contienen información suficiente para responder, indícalo claramente
3. Al citar información, usa SIEMPRE el minuto exacto del fragmento (ej: "A las 24:05...") o reproduce una frase literal entre comillas
4. NUNCA uses expresiones como "Fragmento N", "el fragmento X" u otras referencias numéricas a los fragmentos. El usuario no ve los fragmentos, solo tu respuesta
5. Responde en español usando formato Markdown (negritas, listas, encabezados cuando sea apropiado)
6. Sé conciso y directo`;

/**
 * Formatea segundos a MM:SS o H:MM:SS
 */
function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Construye el prompt completo para una pregunta de chat con RAG
 * @param {string} question - Pregunta del usuario
 * @param {Array<{ textDisplay: string, score: number, startTime: number, endTime: number, speakers: string }>} chunks - Fragmentos relevantes
 * @param {string} [chatHistory] - Historial reciente del chat (comprimido)
 * @returns {string}
 */
export const ragChatPrompt = (question, chunks, chatHistory = '') => {
  let prompt = ragSystemInstructions;

  prompt += '\n\n--- FRAGMENTOS RELEVANTES DE LA TRANSCRIPCIÓN ---\n';
  chunks.forEach((chunk) => {
    const startMin = chunk.startTime != null ? formatTime(chunk.startTime) : '';
    const endMin = chunk.endTime != null ? formatTime(chunk.endTime) : '';
    const timeLabel = startMin ? `[${startMin} - ${endMin}]` : '';
    prompt += `\n${timeLabel}\n`;
    prompt += chunk.textDisplay + '\n';
  });
  prompt += '\n--- FIN FRAGMENTOS ---\n';

  if (chatHistory) {
    prompt += `\n--- HISTORIAL RECIENTE ---\n${chatHistory}\n--- FIN HISTORIAL ---\n`;
  }

  prompt += `\n--- PREGUNTA ---\n${question}\n`;
  prompt += `\nResponde de forma concisa usando formato Markdown.`;

  return prompt;
};

/**
 * Comprime el historial de chat reciente para incluirlo en el prompt RAG
 * @param {Array<{ tipo: string, contenido: string }>} messages - Mensajes del chat
 * @param {number} maxMessages - Máximo de mensajes a incluir (pares pregunta/respuesta)
 * @returns {string}
 */
export const compressChatHistory = (messages, maxMessages = 3) => {
  if (!messages || messages.length === 0) return '';

  // Tomar los últimos N*2 mensajes (pares pregunta/respuesta)
  const recent = messages.slice(-(maxMessages * 2));

  return recent
    .map(m => {
      const role = m.tipo === 'usuario' ? 'Usuario' : 'Asistente';
      const text = m.contenido || ''; // Asegurar que sea string
      // Truncar respuestas largas del asistente
      const content = text.length > 300
        ? text.substring(0, 300) + '...'
        : text;
      return `${role}: ${content}`;
    })
    .join('\n');
};
