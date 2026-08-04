/**
 * Topic de tools "tareas": catálogo + ejecución + guarda de seguridad para las
 * 4 acciones sobre tareas (`find_tasks`, `create_task`, `update_task`,
 * `delete_task`), usado por la conversación NORMAL del chat (no por `/tareas`,
 * que sigue con su propio flujo de batch JSON en `chat/commands/tasksCommand.js`).
 *
 * Este módulo define el catálogo UNA sola vez en un formato JSON-Schema-ish (tipo
 * OpenAI: `{name, description, parameters}`) y expone sus handlers de ejecución.
 * Los traductores de formato genéricos (`toOpenAIToolsFormat`, `toGeminiToolsFormat`)
 * y el dispatcher (`executeTool`) viven en `./index.js` — este archivo es SOLO el
 * topic "tareas": schema + ejecución + guardas de seguridad, no conoce otros topics.
 *
 * ⚠️ SEPARACIÓN ESTRUCTURAL PROPOSE vs EXECUTE (bug real que la motivó):
 *
 * Hasta esta versión, `create_task`/`update_task`/`delete_task` tenían un
 * parámetro `confirm: boolean` en su schema — la garantía de seguridad dependía
 * de que la IA solo mandara `confirm:true` DESPUÉS de que el usuario confirmara
 * explícitamente mediante los botones de la UI. Esto FALLÓ en producción
 * (Ollama + gemma3, conversación real): el modelo nunca llamó a `create_task`
 * para proponer — negoció el `layer` faltante y pidió confirmación con TEXTO
 * LIBRE ("¿Creo la tarea "prueba" (fullstack)?", sin ningún tool call debajo).
 * Cuando el usuario respondió "si" (texto libre, no un click de botón), el
 * modelo llamó a `create_task` DIRECTO con `confirm:true` en esa única llamada
 * — sin haber pasado NUNCA por el paso `confirmation_required`/botones. El
 * sistema lo ejecutó porque `confirm:true` era válido según el schema. Los
 * botones nunca aparecieron.
 *
 * FIX: se sacó `confirm` del schema (`TASK_TOOLS`) que ve el modelo. La IA ya
 * NO TIENE la capacidad de ejecutar estas 3 funciones — solo puede PROPONER
 * (`TASK_TOOL_HANDLERS`, consumido por el loop de tool-calling en
 * `providerRouter.js`, SIEMPRE devuelve `confirmation_required`). La ejecución
 * real vive en funciones separadas (`TASK_TOOL_CONFIRMED_EXECUTORS`),
 * invocables ÚNICAMENTE por el código de la UI (`handleResolvePendingAction`
 * en `RecordingDetailWithTranscription.jsx`/`ProjectDetail.jsx`, vía
 * `executeConfirmedAction` en `tools/index.js`) — jamás alcanzables desde el
 * loop que consume la IA. Esto convierte la garantía de "confiamos en que el
 * modelo se comporte bien" (probabilística, ya demostrado que falla) en "el
 * modelo NO PUEDE ejecutar, punto" (estructural y determinística, independiente
 * del modelo/provider que esté conectado).
 *
 * Guarda de seguridad (mismo patrón que ya usa `chat/commands/tasksCommand.js` en
 * modo batch — misma idea, adaptada a ejecución función-por-función):
 *
 *   1. Antes de tocar cualquier tarea EXISTENTE (find/update/delete), se fetchean
 *      las tareas reales vía IPC (`recordingsService`). Esa lista es la ÚNICA
 *      allowlist válida de ids — un id que la IA invente y no esté en esa lista
 *      se rechaza SIEMPRE, nunca se ejecuta a ciegas. Esta validación ocurre en
 *      el paso de PROPONER (`handleUpdateTask`/`handleDeleteTask`) — el único
 *      que la IA puede disparar — así que los ejecutores confirmados
 *      (`updateTaskConfirmed`/`deleteTaskConfirmed`) no necesitan repetirla.
 *   2. `create_task`, `update_task` y `delete_task` SIEMPRE devuelven la
 *      propuesta/petición de confirmación cuando los llama la IA — nunca
 *      escriben en la base de datos por sí mismas, sin importar qué venga en
 *      `args` (no hay ningún `confirm` que chequear ni que alucinar). Esto
 *      obliga a que TODA mutación pase primero por la UI de botones reales,
 *      aunque el usuario no lo haya pedido explícitamente en su mensaje — a
 *      diferencia de `chat/commands/tasksCommand.js` (modo batch de
 *      `/tareas`), que en cambio exige instrucciones explícitas del usuario
 *      para permitir update/delete. Son dos guardas complementarias para dos
 *      superficies distintas.
 *   3. Ninguna función lanza excepción hacia arriba: cualquier fallo (IPC no
 *      disponible, función desconocida, argumentos inválidos) se traduce a un
 *      resultado `{error, message}` que la IA puede leer y explicarle al usuario
 *      — el loop de tool-calling en `providerRouter.js` NUNCA debe romperse por
 *      esto.
 *
 * `create_task` es la única acción que NO depende del fetch previo (no hay nada
 * que validar contra un id existente).
 */

import recordingsService from '../../recordingsService';

export const VALID_TASK_LAYERS = ['frontend', 'backend', 'fullstack'];
export const VALID_TASK_STATUSES = ['backlog', 'in_progress', 'blocked', 'done'];

/**
 * Catálogo agnóstico de funciones sobre tareas. Las descripciones van en inglés
 * (mismo criterio que el resto de prompts/nombres de funciones enviados a la IA
 * en este repo) — el modelo lee estas descripciones para decidir cuándo llamar
 * a cada función.
 */
export const TASK_TOOLS = [
  {
    name: 'find_tasks',
    description:
      'Search or list existing tasks, to find a task by title/topic before updating or deleting it.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'Optional substring to filter tasks by title (case-insensitive). Omit to list all existing tasks.',
        },
      },
      required: [],
    },
  },
  {
    name: 'create_task',
    description:
      'MANDATORY: as soon as you have a title (and optionally content/layer) for a new task, CALL THIS FUNCTION IMMEDIATELY. Do NOT ask the user "should I create this task?" in your own plain-text reply first — calling this function IS how you ask; it automatically shows the user a real confirmation UI with buttons. Never restate or describe the proposed task in plain text instead of calling this function. This function only proposes — you do NOT execute it yourself and there is no way to force execution: only the user\'s own confirmation click actually creates the task.',
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Short, clear title for the new task.',
        },
        content: {
          type: 'string',
          description: 'Optional longer description or details for the task.',
        },
        layer: {
          type: 'string',
          enum: VALID_TASK_LAYERS,
          description: 'Optional layer/area this task belongs to.',
        },
      },
      required: ['title'],
    },
  },
  {
    name: 'update_task',
    description:
      'MANDATORY: as soon as the user explicitly asks to change a specific existing task, CALL THIS FUNCTION IMMEDIATELY (use find_tasks first if you do not already know its id). Do NOT ask "should I apply this change?" in your own plain-text reply first — calling this function IS how you ask; it automatically shows the user a real confirmation UI with buttons. Never restate or describe the proposed change in plain text instead of calling this function. This function only proposes — you do NOT execute it yourself and there is no way to force execution: only the user\'s own confirmation click actually applies the update.',
    parameters: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          description:
            'The id of the existing task to update. Must come from a real task returned by find_tasks — never invent an id.',
        },
        title: {
          type: 'string',
          description: 'New title, only if it should change.',
        },
        content: {
          type: 'string',
          description: 'New content/description, only if it should change.',
        },
        layer: {
          type: 'string',
          enum: VALID_TASK_LAYERS,
          description: 'New layer, only if it should change.',
        },
        status: {
          type: 'string',
          enum: VALID_TASK_STATUSES,
          description: 'New status, only if it should change.',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_task',
    description:
      'MANDATORY: as soon as the user asks to delete a specific existing task, CALL THIS FUNCTION IMMEDIATELY. Do NOT ask "should I delete this?" in your own plain-text reply first — calling this function IS how you ask; it automatically shows the user a real confirmation UI with buttons. Never restate or describe the deletion in plain text instead of calling this function. This function only proposes — you do NOT execute it yourself and there is no way to force execution: only the user\'s own confirmation click actually deletes the task.',
    parameters: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          description:
            'The id of the existing task to delete. Must come from a real task returned by find_tasks — never invent an id.',
        },
      },
      required: ['id'],
    },
  },
];

/**
 * Resume una tarea al formato compacto que puede leer la IA (mismo criterio que
 * `tasksCommand.js#toCompactTask`): sin `content` completo, sin ids de
 * recording/project, sin timestamps — solo lo necesario para decidir sobre qué
 * tarea actuar.
 */
function toCompactTask(task) {
  return { id: task.id, title: task.title, layer: task.layer, status: task.status };
}

/**
 * Normaliza un `id` recibido de la IA a number (algunos modelos/providers pueden
 * mandarlo como string "12" en vez de 12, sobre todo vía JSON.parse de argumentos
 * de tool-calling). Devuelve `null` si no es un id válido.
 */
function normalizeId(rawId) {
  if (typeof rawId === 'number' && Number.isFinite(rawId)) return rawId;
  if (typeof rawId === 'string' && rawId.trim() !== '' && Number.isFinite(Number(rawId))) return Number(rawId);
  return null;
}

/**
 * Fetch defensivo de las tareas reales existentes, según el scope del turno de
 * chat actual. Un fallo de IPC NUNCA se propaga — se trata como "sin tareas
 * conocidas", lo que bloquea implícitamente cualquier update/delete (ningún id
 * podrá estar en un allowlist vacío) sin tumbar la conversación.
 *
 * @param {{scope:'recording'|'project', recordingId?:number, projectId?:string}} toolContext
 * @returns {Promise<Array>}
 */
async function fetchExistingTasks(toolContext) {
  const { scope, recordingId, projectId } = toolContext || {};
  try {
    const fetched = scope === 'project'
      ? await recordingsService.getProjectTaskSuggestions(projectId)
      : await recordingsService.getTaskSuggestions(recordingId);
    return Array.isArray(fetched) ? fetched : [];
  } catch (err) {
    console.error('[taskTools] Error obteniendo tareas existentes:', err);
    return [];
  }
}

async function handleFindTasks(args, toolContext) {
  const existingTasks = await fetchExistingTasks(toolContext);
  const query = (args?.query || '').trim().toLowerCase();
  const filtered = query
    ? existingTasks.filter((task) => (task.title || '').toLowerCase().includes(query))
    : existingTasks;
  return { tasks: filtered.map(toCompactTask) };
}

async function handleCreateTask(args, toolContext) {
  const title = (args?.title || '').trim();
  if (!title) {
    return { error: 'invalid_arguments', message: 'title is required to create a task.' };
  }
  const content = args?.content || '';
  const layer = VALID_TASK_LAYERS.includes(args?.layer) ? args.layer : 'general';

  // ⚠️ GARANTÍA ESTRUCTURAL (no una convención que dependa de que la IA se porte
  // bien): esta función SIEMPRE devuelve confirmation_required — el schema
  // (`TASK_TOOLS`) ya no expone ningún campo `confirm`, así que no hay nada que
  // chequear ni que un modelo pueda alucinar para forzar la ejecución. La
  // creación real vive en `createTaskConfirmed`, invocable SOLO desde el click
  // handler de la UI (ver docstring del módulo).
  return {
    status: 'confirmation_required',
    proposed: { title, content, layer },
    question: `¿Creo la tarea "${title}"${layer !== 'general' ? ` (${layer})` : ''}?`,
    options: ['Sí', 'No'],
    message: 'Show the user this proposal and ask them to confirm via the UI buttons. You cannot create this task yourself.',
  };
}

/**
 * Ejecuta de verdad la creación de la tarea — SOLO la llama el código de la UI
 * (`executeConfirmedAction` en `tools/index.js`, desde el click handler de
 * "Sí" sobre un `pendingAction`), nunca el loop de tool-calling que consume la
 * IA (ver docstring del módulo). `toolArgs` es el mismo `proposed` que devolvió
 * `handleCreateTask` (title/content/layer ya saneados) — no hace falta volver
 * a validar nada acá.
 */
async function createTaskConfirmed(toolArgs, toolContext) {
  const { title, content, layer } = toolArgs || {};
  const { scope, recordingId, projectId } = toolContext || {};

  try {
    const savedTask = scope === 'project'
      ? await recordingsService.createProjectTask(projectId, title, content, layer, 'backlog')
      : await recordingsService.addTaskSuggestion(recordingId, title, content, layer, true);

    if (!savedTask) {
      return { error: 'create_failed', message: 'The task could not be created.' };
    }
    return { status: 'created', task: toCompactTask(savedTask) };
  } catch (err) {
    console.error('[taskTools] Error creando tarea:', err);
    return { error: 'create_failed', message: err?.message || 'Unexpected error creating the task.' };
  }
}

async function handleUpdateTask(args, toolContext) {
  const id = normalizeId(args?.id);
  if (id == null) {
    return { error: 'invalid_arguments', message: 'A valid numeric id is required to update a task.' };
  }

  const existingTasks = await fetchExistingTasks(toolContext);
  const existing = existingTasks.find((task) => task.id === id);
  if (!existing) {
    return { error: 'task_not_found', message: `No existing task was found with id ${id}. Call find_tasks first to get a real id.` };
  }

  // Merge parcial: solo se pisan los campos que la IA realmente mandó, el resto
  // conserva el valor existente — mismo criterio que `tasksCommand.js`.
  const title = (args?.title && args.title.trim()) || existing.title;
  const content = args?.content !== undefined ? args.content : (existing.content || '');
  const layer = args?.layer !== undefined
    ? (VALID_TASK_LAYERS.includes(args.layer) ? args.layer : 'general')
    : (existing.layer || 'general');
  const status = args?.status !== undefined && VALID_TASK_STATUSES.includes(args.status)
    ? args.status
    : existing.status;

  // ⚠️ GARANTÍA ESTRUCTURAL (no una convención que dependa de que la IA se porte
  // bien): esta función SIEMPRE devuelve confirmation_required con el merge YA
  // CALCULADO — el schema ya no expone `confirm`. `updateTaskConfirmed` reusa
  // este `proposed` tal cual (no vuelve a mergear ni a re-validar el
  // allowlist, eso ya ocurrió acá).
  return {
    status: 'confirmation_required',
    proposed: { id, title, content, layer, status },
    question: `¿Aplico estos cambios a la tarea "${existing.title}"?`,
    options: ['Sí', 'No'],
    message: 'Show the user this proposal and ask them to confirm via the UI buttons. You cannot apply this update yourself.',
  };
}

/**
 * Ejecuta de verdad la actualización — SOLO la llama el código de la UI (ver
 * docstring del módulo). `toolArgs` es el `proposed` YA MERGEADO que devolvió
 * `handleUpdateTask` (`{id,title,content,layer,status}`) — NO se vuelve a
 * mergear ni a re-validar el id contra el allowlist acá: esa validación ya
 * ocurrió en el único paso que la IA puede disparar (`handleUpdateTask`), y
 * este dato viene de nuestro propio `pendingAction` (generado por el propio
 * sistema), no de un input arbitrario de la IA o del usuario — re-fetchear acá
 * sería una llamada IPC redundante.
 */
async function updateTaskConfirmed(toolArgs, toolContext) {
  const { id, title, content, layer, status } = toolArgs || {};
  try {
    const savedTask = await recordingsService.updateTaskSuggestion(id, title, content, layer, status);
    if (!savedTask) {
      return { error: 'update_failed', message: 'The task could not be updated.' };
    }
    return { status: 'updated', task: toCompactTask(savedTask) };
  } catch (err) {
    console.error('[taskTools] Error actualizando tarea:', err);
    return { error: 'update_failed', message: err?.message || 'Unexpected error updating the task.' };
  }
}

async function handleDeleteTask(args, toolContext) {
  const id = normalizeId(args?.id);
  if (id == null) {
    return { error: 'invalid_arguments', message: 'A valid numeric id is required to delete a task.' };
  }

  const existingTasks = await fetchExistingTasks(toolContext);
  const existing = existingTasks.find((task) => task.id === id);
  if (!existing) {
    return { error: 'task_not_found', message: `No existing task was found with id ${id}. Call find_tasks first to get a real id.` };
  }

  // ⚠️ GARANTÍA ESTRUCTURAL (no una convención que dependa de que la IA se porte
  // bien): esta función SIEMPRE devuelve confirmation_required — el schema ya
  // no expone `confirm`. El borrado real vive en `deleteTaskConfirmed`,
  // invocable SOLO desde el click handler de la UI (ver docstring del módulo).
  return {
    status: 'confirmation_required',
    task: { id: existing.id, title: existing.title },
    question: `¿Elimino la tarea "${existing.title}"?`,
    options: ['Sí', 'No'],
    message: 'Ask the user to explicitly confirm deletion via the UI buttons. You cannot delete this task yourself.',
  };
}

/**
 * Ejecuta de verdad el borrado — SOLO la llama el código de la UI (ver
 * docstring del módulo). `toolArgs` es el `task` que devolvió `handleDeleteTask`
 * (`{id, title}`) — el id ya fue validado contra el allowlist real en ese paso
 * (el único que la IA puede disparar), así que acá no hace falta re-fetchear
 * ni re-validar (mismo razonamiento que `updateTaskConfirmed`).
 */
async function deleteTaskConfirmed(toolArgs, toolContext) {
  const { id, title } = toolArgs || {};
  try {
    const ok = await recordingsService.deleteTaskSuggestion(id);
    if (!ok) {
      return { error: 'delete_failed', message: 'The task could not be deleted.' };
    }
    return { status: 'deleted', task: { id, title } };
  } catch (err) {
    console.error('[taskTools] Error borrando tarea:', err);
    return { error: 'delete_failed', message: err?.message || 'Unexpected error deleting the task.' };
  }
}

/**
 * Mapa de dispatch de este topic — mismo patrón que `CHAT_COMMAND_HANDLERS` en
 * `src/services/chat/commands/index.js`. Lo agrega `./index.js` en
 * `TOOL_HANDLERS` — es el ÚNICO mapa que consume el loop de tool-calling
 * (`_runToolCallingLoop` en `providerRouter.js`), o sea, lo único que la IA
 * puede disparar. Todas las funciones acá SIEMPRE proponen, nunca ejecutan.
 */
export const TASK_TOOL_HANDLERS = {
  find_tasks: handleFindTasks,
  create_task: handleCreateTask,
  update_task: handleUpdateTask,
  delete_task: handleDeleteTask,
};

/**
 * Mapa de ejecutores CONFIRMADOS — mismo patrón que `TASK_TOOL_HANDLERS`, pero
 * este mapa NUNCA lo usa el loop de tool-calling que consume la IA. Solo lo
 * consume `executeConfirmedAction` (`tools/index.js`), llamado directamente
 * por el código de página (`handleResolvePendingAction` en
 * `RecordingDetailWithTranscription.jsx`/`ProjectDetail.jsx`) cuando el
 * usuario hace click en el botón afirmativo de un `pendingAction`. Esta es la
 * separación estructural completa: la IA solo puede llegar a
 * `TASK_TOOL_HANDLERS` (propone), la UI es la única que puede llegar acá
 * (ejecuta).
 */
export const TASK_TOOL_CONFIRMED_EXECUTORS = {
  create_task: createTaskConfirmed,
  update_task: updateTaskConfirmed,
  delete_task: deleteTaskConfirmed,
};
