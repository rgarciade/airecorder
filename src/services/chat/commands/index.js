/**
 * Mapa público `{ [name]: runFn }` de comandos de chat, consumido por
 * `useChatCommands.js` para el dispatch. Cada `runFn` tiene la firma común:
 *
 *   async (ctx, args) => ({ success: boolean, error?: string, cancelled?: boolean })
 *
 * donde `ctx` es el objeto construido una única vez por `useChatCommands`
 * (scope, lang, model, getHistory, replaceHistory, t, y los identificadores
 * específicos de la página: recordingId, ragRecordingId, projectId, chatId).
 *
 * Añadir un comando nuevo:
 * 1. Crear `<nombre>Command.js` en esta carpeta exportando su `runFn`.
 * 2. Registrar su metadata en `../chatCommands.js` (`CHAT_COMMANDS`).
 * 3. Añadir la entrada aquí: `<name>: run<Nombre>`.
 * No hace falta tocar `useChatCommands.js` ni `ChatInterface.jsx`.
 */

import { runCompact } from './compactCommand';
import { runClear } from './clearCommand';
import { runHelp } from './helpCommand';
import { runSummary } from './summaryCommand';
import { runTasks } from './tasksCommand';
import { runNote } from './noteCommand';
import { runSearch } from './searchCommand';

export const CHAT_COMMAND_HANDLERS = {
  compact: runCompact,
  clear: runClear,
  help: runHelp,
  resumen: runSummary,
  tareas: runTasks,
  nota: runNote,
  buscar: runSearch,
};
