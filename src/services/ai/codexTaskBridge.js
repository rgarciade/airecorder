/**
 * Puente entre Codex (sin tool-calling nativo, solo `outputSchema` estructurado
 * — ver node_modules/@openai/codex-sdk) y el mismo sistema de tools/pendingAction
 * que ya usan los 6 providers REST (Gemini/OpenAI/DeepSeek/Kimi/LM Studio/Ollama).
 *
 * A diferencia de esos 6, Codex NO puede llamar `find_tasks` en vivo a mitad de
 * turno — por eso este módulo inyecta la lista de tareas existentes de antemano
 * en el prompt, y le pide una ÚNICA respuesta JSON estructurada (`outputSchema`)
 * describiendo, si corresponde, UNA acción propuesta sobre tareas. Esa propuesta
 * se ejecuta después vía `executeTool` (mismo dispatcher que los otros providers,
 * misma guarda de seguridad, cero lógica duplicada) — ver providerRouter.js.
 */

// BUG REAL reportado en producción: "Codex devolvió eventos JSONL inválidos" al usar
// este schema. Diagnóstico más probable (no verificado en vivo, ver README §6.7):
// Codex usa por debajo el modo estricto de OpenAI Structured Outputs, que exige que
// TODOS los campos listados en "properties" figuren en "required" — un campo
// "opcional" se expresa con un tipo nullable (`type: [tipo, "null"]`), NUNCA
// omitiéndolo de "required". La versión anterior de este schema solo listaba
// "action" en el `required` de `taskProposal` (con 6 properties) — eso viola esa
// restricción y probablemente hacía que la llamada subyacente fallara al validar el
// schema, resultando en un evento JSONL malformado en vez de una respuesta válida.
export const CODEX_TASK_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    reply: {
      type: 'string',
      description: 'Your natural-language reply to show the user in the chat.',
    },
    taskProposal: {
      type: ['object', 'null'],
      description: 'Set this ONLY if the user is asking to create, update, or delete a task. Otherwise use null.',
      properties: {
        action: { type: 'string', enum: ['create_task', 'update_task', 'delete_task'] },
        title: { type: ['string', 'null'], description: 'Required for create_task. Null otherwise.' },
        content: { type: ['string', 'null'] },
        layer: { type: ['string', 'null'], enum: ['frontend', 'backend', 'fullstack', null] },
        id: { type: ['number', 'null'], description: 'Required for update_task/delete_task. Null otherwise.' },
        status: { type: ['string', 'null'], enum: ['backlog', 'in_progress', 'blocked', 'done', null] },
      },
      // TODAS las properties deben estar acá (modo estricto) — la "opcionalidad" real
      // la da el tipo nullable de cada campo, no la ausencia en este array.
      required: ['action', 'title', 'content', 'layer', 'id', 'status'],
      additionalProperties: false,
    },
  },
  required: ['reply', 'taskProposal'],
  additionalProperties: false,
};

/**
 * Serializa la lista compacta de tareas existentes (mismo shape que devuelve
 * `find_tasks`) para inyectar como contexto en el prompt de Codex. Mismo
 * formato que ya usa `taskActionsPrompt` (`chatCommandPrompts.js`), para no
 * inventar una convención nueva.
 */
export function formatExistingTasksForCodex(tasks) {
  if (!tasks || tasks.length === 0) return '(no existing tasks)';
  return tasks.map((t) => `- [id:${t.id}] "${t.title}" (layer: ${t.layer || 'general'}, status: ${t.status || 'backlog'})`).join('\n');
}

/**
 * Construye las instrucciones que se anteponen a la conversación real, explicando
 * el contrato de salida JSON y las 3 acciones disponibles. Igual de estricto que
 * `taskTools.js`'s descriptions, adaptado a un contrato de una sola respuesta en
 * vez de tool-calling interactivo.
 */
export function buildCodexTaskInstructions(existingTasksBlock) {
  return `You are a technical assistant participating in a chat conversation. You MUST respond with a SINGLE JSON object that strictly matches the required output schema — no prose outside the JSON, no markdown code fences, no extra keys.

OUTPUT CONTRACT:
- "reply": your natural-language reply to show the user in the chat. This is the only thing the user actually reads.
- "taskProposal": set this ONLY if the user's last message explicitly asks to create, update, or delete a task. Otherwise it MUST be null.

EXISTING TASKS (already saved — reference only; do NOT propose "create_task" for one of these unless it truly needs to change):
${existingTasksBlock}

AVAILABLE ACTIONS for "taskProposal.action":
1. "create_task" — requires "title". Optional: "content", "layer" (one of "frontend"|"backend"|"fullstack").
2. "update_task" — requires "id", which MUST be one of the ids listed above in EXISTING TASKS. NEVER invent an id. Only include the fields that actually change (partial update): "title", "content", "layer", "status" (one of "backlog"|"in_progress"|"blocked"|"done").
3. "delete_task" — requires "id", which MUST be one of the ids listed above in EXISTING TASKS. NEVER invent an id.

⚠️ CRITICAL — THIS IS ONLY A PROPOSAL, NEVER A DIRECT EXECUTION: setting "taskProposal" does NOT create/update/delete anything by itself — it only proposes. The user will see a real confirmation UI with buttons and must click to confirm; you have no way to force execution. Do NOT ask "should I do this?" inside "reply" as if you needed a text answer back — setting "taskProposal" IS how you ask, the UI takes care of the actual confirmation. Never restate or describe the proposed change inside "reply" instead of setting "taskProposal".
⚠️ CRITICAL — do NOT use "update_task" or "delete_task" unless the user's message explicitly and unambiguously asks to change or remove that specific existing task. If there is no such explicit instruction, leave "taskProposal" as null and only use "create_task" when a new task is being requested.

Respond with ONLY the JSON object described above.`;
}
