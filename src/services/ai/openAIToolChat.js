/**
 * Helpers compartidos para la variante "chat de una sola pasada con tools" de
 * los proveedores OpenAI-compatibles (`customOpenAIProvider.js` → OpenAI +
 * conexiones personalizadas, `deepseekProvider.js`, `kimiProvider.js`,
 * `lmStudioProvider.js`, `ollamaProvider.js`). Los 5 hablan el mismo dialecto de
 * `tools`/`tool_calls` sobre `/chat/completions` (o `/api/chat` en Ollama, que
 * documenta el mismo formato desde v0.3) — factorizar esto evita repetir la
 * misma conversión de mensajes y parseo de respuesta 5 veces.
 *
 * No hace ninguna llamada HTTP — cada proveedor sigue siendo dueño de su propio
 * `fetch` (URL base, headers, reintentos), solo delega en estas dos funciones
 * puras la traducción de mensajes de entrada y el parseo de la respuesta.
 */

/**
 * Traduce el array de mensajes "genérico" del loop de tool-calling
 * (`providerRouter.js`) al formato de mensajes OpenAI-compatible, reconociendo
 * además de los roles habituales (system/user/assistant):
 * - `{role:'assistant', content, toolCalls:[{id, name, arguments}]}` → mensaje
 *   assistant con `tool_calls`.
 * - `{role:'tool', toolCallId, name, content}` → mensaje `{role:'tool', tool_call_id, content}`.
 *
 * @param {Array} messages
 * @param {{stringifyArguments?: boolean}} [opts] - Por defecto `true`: serializa
 *   `function.arguments` a JSON string, que es lo que exige la especificación real
 *   de OpenAI (y por tanto DeepSeek/Kimi/LM Studio, que la siguen al pie de la letra).
 *   BUG REAL confirmado en producción (Ollama + gemma3): Ollama, a diferencia de esos
 *   proveedores, DEVUELVE `function.arguments` como objeto JSON nativo (no string) en
 *   su propia respuesta — y al reenviárselo re-serializado como string en el turno
 *   siguiente, su motor de templates rechaza el mensaje con
 *   `{"error":"Value looks like object, but can't find closing '}' symbol"}` (falla
 *   HTTP 400 en la segunda vuelta del loop de tool-calling, justo después de haber
 *   ejecutado la función correctamente). `ollamaProvider.js` pasa
 *   `stringifyArguments: false` para conservar el objeto tal cual — coherente con el
 *   dialecto real de Ollama, no con el spec de OpenAI que esta función asume por defecto.
 * @returns {Array<{role:string, content?:string, tool_calls?:Array, tool_call_id?:string}>}
 */
export function buildOpenAIToolMessages(messages, { stringifyArguments = true } = {}) {
  return messages.map((m) => {
    if (m.role === 'assistant' && Array.isArray(m.toolCalls) && m.toolCalls.length > 0) {
      return {
        role: 'assistant',
        content: m.content || null,
        tool_calls: m.toolCalls.map((call) => ({
          id: call.id,
          type: 'function',
          function: {
            name: call.name,
            arguments: stringifyArguments ? JSON.stringify(call.arguments || {}) : (call.arguments || {}),
          },
        })),
      };
    }
    if (m.role === 'tool') {
      return {
        role: 'tool',
        tool_call_id: m.toolCallId,
        content: m.content,
      };
    }
    return { role: m.role, content: m.content };
  });
}

/**
 * Parsea la respuesta `/chat/completions` (o `/api/chat` de Ollama) a la forma
 * normalizada `{text, toolCalls}` que espera el loop de `providerRouter.js`.
 *
 * `function.arguments` llega como JSON string en la API de OpenAI/DeepSeek/Kimi/
 * LM Studio, pero la documentación de Ollama (`/api/chat` con `tools`, ≥ 0.3)
 * muestra `arguments` ya como objeto JSON (no string) — no verificado en vivo
 * durante esta implementación. Por eso esta función acepta AMBAS formas: si ya
 * es un objeto lo usa tal cual, si es string intenta parsearlo.
 *
 * @param {{name?:string, content?:string, tool_calls?:Array}} message - `choices[0].message` (OpenAI) o `message` (Ollama)
 * @returns {{text: string, toolCalls: Array<{id?:string, name:string, arguments:Object}>|null}}
 */
export function parseOpenAIToolMessage(message) {
  const rawToolCalls = message?.tool_calls;
  if (!Array.isArray(rawToolCalls) || rawToolCalls.length === 0) {
    return { text: message?.content || '', toolCalls: null };
  }

  const toolCalls = rawToolCalls.map((call, idx) => {
    const rawArgs = call.function?.arguments;
    let args = {};
    if (rawArgs && typeof rawArgs === 'object') {
      args = rawArgs;
    } else if (typeof rawArgs === 'string' && rawArgs.trim()) {
      try {
        args = JSON.parse(rawArgs);
      } catch (err) {
        console.warn(`[openAIToolChat] No se pudo parsear arguments de "${call.function?.name}":`, err);
        args = {};
      }
    }
    return {
      id: call.id || `call-${idx}`,
      name: call.function?.name,
      arguments: args,
    };
  });

  return { text: message?.content || '', toolCalls };
}
