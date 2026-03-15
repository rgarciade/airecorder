/**
 * Prompts específicos para chat con RAG sobre transcripciones
 */

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

// ---------------------------------------------------------------------------
// System Prompts para Chat V2 (array de mensajes nativo — Multi-turn Chat)
// ---------------------------------------------------------------------------

/**
 * Genera el contenido del mensaje { role: 'system' } para el chat RAG sobre una grabación.
 * El historial y la pregunta del usuario se envían aparte en el array de mensajes.
 *
 * @param {Array<{ textDisplay: string, startTime: number, endTime: number }>} chunks
 * @param {string} [docContext] - Texto de documentos/PDFs adjuntos
 * @returns {string} Contenido del system prompt
 */
export const ragSystemPrompt = (chunks, docContext = '') => {
  let system = `Eres un asistente experto que responde preguntas sobre una grabación de audio basándote en fragmentos relevantes de la transcripción y en los documentos adjuntos (si los hay).

REGLAS:
1. Basa tu respuesta en los fragmentos de la transcripción Y en los DOCUMENTOS ADJUNTOS proporcionados.
2. Si el usuario pregunta por un archivo, documento o excel, DA PRIORIDAD ABSOLUTA a la información de la sección "DOCUMENTOS ADJUNTOS".
3. Si la información no está ni en los fragmentos ni en los documentos, indícalo claramente.
4. Al citar información de la transcripción, usa SIEMPRE el minuto exacto (ej: "A las 24:05...") o reproduce una frase literal entre comillas.
5. NUNCA uses expresiones como "Fragmento N". El usuario no ve los fragmentos.
6. Responde en español usando formato Markdown (negritas, listas, tablas cuando sea apropiado).
7. Sé conciso y directo.`;

  system += '\n\n--- FRAGMENTOS RELEVANTES DE LA TRANSCRIPCIÓN ---\n';
  chunks.forEach((chunk) => {
    const startMin = chunk.startTime != null ? formatTime(chunk.startTime) : '';
    const endMin = chunk.endTime != null ? formatTime(chunk.endTime) : '';
    const timeLabel = startMin ? `[${startMin} - ${endMin}]` : '';
    system += `\n${timeLabel}\n`;
    system += chunk.textDisplay + '\n';
  });
  system += '\n--- FIN FRAGMENTOS ---\n';

  if (docContext) {
    system += `\n--- DOCUMENTOS ADJUNTOS ---${docContext}\n--- FIN DOCUMENTOS ADJUNTOS ---\n`;
  }

  return system;
};

/**
 * Genera el contenido del mensaje { role: 'system' } para el chat RAG multi-grabación (proyectos).
 *
 * @param {Array<{ textDisplay: string, startTime: number, endTime: number, recordingTitle: string }>} chunks
 * @returns {string} Contenido del system prompt
 */
export const projectRagSystemPrompt = (chunks, docContext = '') => {
  let system = `Eres un asistente experto que responde preguntas sobre un proyecto basándote en fragmentos relevantes de las transcripciones de sus reuniones y en los documentos adjuntos si los hay.

REGLAS:
1. Basa tu respuesta SOLO en los fragmentos proporcionados y documentos adjuntos
2. Si los fragmentos no contienen información suficiente, indícalo claramente
3. Al citar información, usa SIEMPRE el nombre de la reunión y el minuto exacto (ej: "En 'Reunión de kick-off', a las 24:05...")
4. NUNCA uses expresiones como "Fragmento N" u otras referencias numéricas
5. Responde en español usando formato Markdown
6. Sé conciso y directo`;

  system += '\n\n--- FRAGMENTOS RELEVANTES DE LAS REUNIONES ---\n';
  chunks.forEach((chunk) => {
    const startMin = chunk.startTime != null ? formatTime(chunk.startTime) : '';
    const endMin = chunk.endTime != null ? formatTime(chunk.endTime) : '';
    const timeLabel = startMin ? `${startMin} - ${endMin}` : '';
    const reunionLabel = chunk.recordingTitle
      ? `[Reunión: "${chunk.recordingTitle}"${timeLabel ? ` · ${timeLabel}` : ''}]`
      : `[${timeLabel}]`;
    system += `\n${reunionLabel}\n`;
    system += chunk.textDisplay + '\n';
  });
  system += '\n--- FIN FRAGMENTOS ---\n';

  if (docContext) {
    system += `\n--- DOCUMENTOS ADJUNTOS ---${docContext}\n--- FIN DOCUMENTOS ADJUNTOS ---\n`;
  }

  return system;
};

/**
 * Mapea el historial interno de AIRecorder al formato estándar de mensajes.
 * Soporta dos formatos de entrada:
 *   - Mensaje individual (memoria): { tipo, contenido }
 *   - Par pregunta/respuesta (JSON persistido): { tipo, pregunta, respuesta } o { pregunta, respuesta }
 *
 * @param {Array} history - Historial en cualquier formato interno de AIRecorder
 * @returns {Array<{role: 'user'|'assistant', content: string}>}
 */
export const mapHistoryToMessages = (history) => {
  if (!history || history.length === 0) return [];

  const messages = [];

  for (const item of history) {
    // Formato 1: mensaje individual en memoria (tiene contenido explícito)
    if (item.contenido !== undefined) {
      const text = item.contenido;
      if (!text || text.startsWith('⚠️')) continue; // ignorar errores
      messages.push({
        role: item.tipo === 'usuario' ? 'user' : 'assistant',
        content: text,
      });
      continue;
    }

    // Formato 2: par pregunta/respuesta del JSON persistido (tiene pregunta)
    if (item.pregunta !== undefined) {
      const pregunta = item.pregunta;
      if (pregunta) {
        messages.push({ role: 'user', content: pregunta });
      }
      const respuesta = item.respuesta;
      if (respuesta && !respuesta.startsWith('⚠️')) {
        messages.push({ role: 'assistant', content: respuesta });
      }
    }
  }

  return messages;
};

// ---------------------------------------------------------------------------
// Funciones legacy (Prompt Stuffing) — mantenidas para compatibilidad con
// otros módulos que aún las importen pero ya no se usan en el chat principal.
// ---------------------------------------------------------------------------

/**
 * @deprecated Usar ragSystemPrompt + mapHistoryToMessages + callChatProviderStreaming.
 * Construye el prompt completo para una pregunta de chat con RAG (formato antiguo).
 */
export const ragChatPrompt = (question, chunks, chatHistory = '', docContext = '') => {
  let prompt = `Eres un asistente experto que responde preguntas sobre una grabación de audio basándote en fragmentos relevantes de la transcripción y en los documentos adjuntos (si los hay).

REGLAS:
1. Basa tu respuesta en los fragmentos de la transcripción Y en los DOCUMENTOS ADJUNTOS proporcionados.
2. Si el usuario pregunta por un archivo, documento o excel, DA PRIORIDAD ABSOLUTA a la información de la sección "DOCUMENTOS ADJUNTOS".
3. Si la información no está ni en los fragmentos ni en los documentos, indícalo claramente.
4. Al citar información de la transcripción, usa SIEMPRE el minuto exacto (ej: "A las 24:05...") o reproduce una frase literal entre comillas.
5. NUNCA uses expresiones como "Fragmento N". El usuario no ve los fragmentos.
6. Responde en español usando formato Markdown (negritas, listas, tablas cuando sea apropiado).
7. Sé conciso y directo`;

  prompt += '\n\n--- FRAGMENTOS RELEVANTES DE LA TRANSCRIPCIÓN ---\n';
  chunks.forEach((chunk) => {
    const startMin = chunk.startTime != null ? formatTime(chunk.startTime) : '';
    const endMin = chunk.endTime != null ? formatTime(chunk.endTime) : '';
    const timeLabel = startMin ? `[${startMin} - ${endMin}]` : '';
    prompt += `\n${timeLabel}\n`;
    prompt += chunk.textDisplay + '\n';
  });
  prompt += '\n--- FIN FRAGMENTOS ---\n';

  if (docContext) {
    prompt += `\n--- DOCUMENTOS ADJUNTOS ---${docContext}\n--- FIN DOCUMENTOS ADJUNTOS ---\n`;
  }

  if (chatHistory) {
    prompt += `\n--- HISTORIAL RECIENTE ---\n${chatHistory}\n--- FIN HISTORIAL ---\n`;
  }

  prompt += `\n--- PREGUNTA ---\n${question}\n`;
  prompt += `\nResponde de forma concisa usando formato Markdown.`;

  return prompt;
};

/**
 * @deprecated Usar projectRagSystemPrompt + mapHistoryToMessages + callChatProviderStreaming.
 * Construye el prompt para chat de proyecto con RAG multi-grabación (formato antiguo).
 */
export const projectRagChatPrompt = (question, chunks, chatHistory = '') => {
  let prompt = `Eres un asistente experto que responde preguntas sobre un proyecto basándote en fragmentos relevantes de las transcripciones de sus reuniones.

REGLAS:
1. Basa tu respuesta SOLO en los fragmentos proporcionados
2. Si los fragmentos no contienen información suficiente, indícalo claramente
3. Al citar información, usa SIEMPRE el nombre de la reunión y el minuto exacto (ej: "En 'Reunión de kick-off', a las 24:05...")
4. NUNCA uses expresiones como "Fragmento N" u otras referencias numéricas
5. Responde en español usando formato Markdown
6. Sé conciso y directo`;

  prompt += '\n\n--- FRAGMENTOS RELEVANTES DE LAS REUNIONES ---\n';
  chunks.forEach((chunk) => {
    const startMin = chunk.startTime != null ? formatTime(chunk.startTime) : '';
    const endMin = chunk.endTime != null ? formatTime(chunk.endTime) : '';
    const timeLabel = startMin ? `${startMin} - ${endMin}` : '';
    const reunionLabel = chunk.recordingTitle
      ? `[Reunión: "${chunk.recordingTitle}"${timeLabel ? ` · ${timeLabel}` : ''}]`
      : `[${timeLabel}]`;
    prompt += `\n${reunionLabel}\n`;
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
 * @deprecated Usar mapHistoryToMessages en su lugar.
 * Comprime el historial de chat reciente para incluirlo en el prompt RAG (formato antiguo).
 */
export const compressChatHistory = (messages, maxMessages = 3) => {
  if (!messages || messages.length === 0) return '';

  const recent = messages.slice(-(maxMessages * 2));

  return recent
    .map(m => {
      const role = m.tipo === 'usuario' ? 'Usuario' : 'Asistente';
      const text = m.contenido || '';
      const content = text.length > 300 ? text.substring(0, 300) + '...' : text;
      return `${role}: ${content}`;
    })
    .join('\n');
};
