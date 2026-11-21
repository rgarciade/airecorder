/**
 * Topic de tools "interacción": una única función genérica, `ask_user`, que
 * cualquier tool futura (no solo tareas) puede usar para pedirle al usuario
 * que elija entre opciones antes de continuar.
 *
 * A diferencia de `taskTools.js`, este topic NO muta nada — no toca IPC ni
 * persistencia, es puro. Su único propósito es devolver `{question, options}`
 * en un resultado, que es la forma GENÉRICA que `providerRouter.js` reconoce
 * para cortar el loop de tool-calling y delegarle la decisión al usuario vía
 * botones en la UI (ver `_runToolCallingLoop` en `../providerRouter.js`) — el
 * mismo mecanismo que ya usan `create_task`/`update_task`/`delete_task` cuando
 * devuelven `confirmation_required` sin `confirm:true`. `ask_user` no agrega
 * ningún caso especial a ese mecanismo: simplemente produce la misma forma de
 * resultado desde un topic distinto.
 */

export const INTERACTION_TOOLS = [
  {
    name: 'ask_user',
    description:
      "Ask the user to choose between options, when you need their input before continuing (e.g. missing information, or letting them pick between alternatives). Ends your turn — the chosen option comes back as the user's next message.",
    parameters: {
      type: 'object',
      properties: {
        question: { type: 'string', description: 'The question to show the user.' },
        options: {
          type: 'array',
          items: { type: 'string' },
          description:
            'List of choices to show as buttons (at least 2). Required — for an open-ended question expecting free text, just ask in your normal reply instead of calling this function.',
        },
      },
      required: ['question', 'options'],
    },
  },
];

async function handleAskUser(args) {
  const question = (args?.question || '').trim();
  if (!question) {
    return { error: 'invalid_arguments', message: 'question is required.' };
  }
  const options = Array.isArray(args?.options)
    ? args.options.map((o) => (typeof o === 'string' ? o.trim() : '')).filter(Boolean)
    : [];
  if (options.length < 2) {
    return { error: 'invalid_arguments', message: 'options must contain at least 2 choices.' };
  }
  return { status: 'ask_user', question, options };
}

/**
 * Mapa de dispatch de este topic — mismo patrón que `TASK_TOOL_HANDLERS`.
 * Lo agrega `./index.js` en `TOOL_HANDLERS`.
 */
export const INTERACTION_TOOL_HANDLERS = { ask_user: handleAskUser };
