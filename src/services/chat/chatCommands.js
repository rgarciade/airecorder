/**
 * Registro + parser de comandos de chat. Extensible: para añadir un comando
 * nuevo, añade una entrada a CHAT_COMMANDS y su `runFn` en
 * `commands/index.js` (`CHAT_COMMAND_HANDLERS`). ChatInterface no conoce
 * ningún comando concreto — solo usa este registro.
 */

import { MIN_COMPACT_HISTORY_MESSAGES, MIN_SUMMARY_HISTORY_MESSAGES } from './chatTokens';

export const CHAT_COMMANDS = [
  {
    name: 'compact',
    i18nKey: 'chatCommands.compact',
    acceptsArgs: true,
    // Punto único en chatTokens.js: debe coincidir con la guarda real de
    // compactChatHistory (chatCompactService.js) o la UI dejará intentar /compact
    // con historiales que la ejecución real rechazará con HISTORY_TOO_SHORT.
    minHistoryMessages: MIN_COMPACT_HISTORY_MESSAGES,
    blockedWhileLoading: true,
  },
  {
    name: 'clear',
    i18nKey: 'chatCommands.clear',
    acceptsArgs: false,
    // Sin minHistoryMessages a propósito: vaciar un historial ya vacío es un no-op
    // manejado por clearCommand.js, no un error de validación.
    blockedWhileLoading: true,
  },
  {
    name: 'help',
    i18nKey: 'chatCommands.help',
    acceptsArgs: false,
    blockedWhileLoading: true,
  },
  {
    name: 'resumen',
    i18nKey: 'chatCommands.resumen',
    acceptsArgs: true,
    // Punto único en chatTokens.js — igual que /compact, debe coincidir EXACTAMENTE
    // con la guarda real de summaryCommand.js (umbral independiente y más bajo que
    // /compact porque /resumen no descarta nada del historial).
    minHistoryMessages: MIN_SUMMARY_HISTORY_MESSAGES,
    blockedWhileLoading: true,
  },
  {
    name: 'tareas',
    i18nKey: 'chatCommands.tareas',
    acceptsArgs: true,
    // Sin minHistoryMessages a propósito: bloquear aquí, ANTES de intentar el fallback
    // RAG, reproducía el bug reportado ("conversación demasiado corta" en un chat nuevo
    // aunque la grabación tuviera transcripción indexada de sobra). La decisión de "no
    // hay contexto" ahora es responsabilidad del propio comando vía
    // `gatherTaskContext` (commands/_shared.js), que solo cae a `tooShort` cuando NI el
    // chat NI el fallback RAG (scope 'recording') tienen nada que ofrecer.
    // runsInBackground: no bloquea el chat mientras corre — ver useChatCommands.js.
    runsInBackground: true,
    blockedWhileLoading: true,
  },
  {
    name: 'nota',
    i18nKey: 'chatCommands.nota',
    acceptsArgs: true,
    // Mismo razonamiento que /tareas: sin minHistoryMessages (fallback RAG vía
    // gatherTaskContext) y runsInBackground para no bloquear el chat.
    runsInBackground: true,
    blockedWhileLoading: true,
  },
  {
    name: 'buscar',
    i18nKey: 'chatCommands.buscar',
    acceptsArgs: true,
    // Query obligatoria: sin minHistoryMessages (puede ser la primera pregunta del
    // chat) pero SÍ requiere args no vacíos — ver `requiresArgs` en validateChatCommand.
    requiresArgs: true,
    blockedWhileLoading: true,
  },
];

/**
 * Busca un comando registrado por nombre exacto (case-insensitive).
 * @param {string} name
 * @returns {Object|null}
 */
export function findChatCommand(name) {
  if (!name) return null;
  const normalized = name.toLowerCase();
  return CHAT_COMMANDS.find((c) => c.name === normalized) || null;
}

/**
 * Filtra comandos cuyo nombre empieza por `query` (para el menú flotante).
 * Sin query, devuelve todos.
 * @param {string} query
 * @returns {Array}
 */
export function filterChatCommands(query) {
  if (!query) return CHAT_COMMANDS;
  const normalized = query.toLowerCase();
  return CHAT_COMMANDS.filter((c) => c.name.startsWith(normalized));
}

// El comando puede ir al inicio del mensaje o tras un espacio — el usuario puede escribir
// texto libre antes (ej. "crea /tareas céntrate en..."), misma gramática que
// MENU_QUERY_REGEX (que ya detecta el comando en esa misma posición para abrir el menú;
// si la ejecución no honrara la misma posición, el menú aparecería sugiriendo un comando
// que al enviar viajaría como texto normal al LLM — bug real reportado). Sigue exigiendo
// que la barra no vaya pegada a otra palabra: "/usr/local/bin" no matchea (tras "usr"
// viene otra barra, ni espacio ni fin de cadena, y no hay ningún otro espacio+barra en
// el string donde reintentar) y viaja como mensaje normal al LLM.
const COMMAND_REGEX = /(?:^|\s)\/([a-zA-Z][a-zA-Z0-9-]*)(?:\s+([\s\S]*))?$/;

/**
 * Parsea el texto crudo del input del chat. Si hay texto ANTES del comando (ej. "crea
 * /tareas ..."), ese texto se descarta — el comando se ejecuta con sus propios args,
 * igual que si el usuario lo hubiera seleccionado del menú flotante (que ya reemplaza
 * el input completo por "/nombre ").
 * @param {string} rawText
 * @returns {{ isCommand: boolean, name: string|null, args: string, command: Object|null }}
 */
export function parseChatCommand(rawText) {
  const text = (rawText || '').trim();
  if (!text.includes('/')) {
    return { isCommand: false, name: null, args: '', command: null };
  }

  const match = text.match(COMMAND_REGEX);
  if (!match) {
    return { isCommand: false, name: null, args: '', command: null };
  }

  const name = match[1].toLowerCase();
  const args = (match[2] || '').trim();
  return { isCommand: true, name, args, command: findChatCommand(name) };
}

// Mientras la ÚLTIMA palabra del input encaja con esto (nombre de comando en
// construcción, sin espacio todavía), el menú flotante de comandos permanece abierto.
// La barra debe ir al principio del texto o justo tras un espacio — "hola/tar" no
// abre el menú (barra pegada a la palabra anterior), pero "hola /tar" sí, porque el
// usuario puede escribir texto libre antes de decidirse a usar un comando. Un espacio
// DESPUÉS de la palabra del comando lo cierra (ya no hay "palabra en construcción").
// Misma gramática que COMMAND_REGEX (primer carácter debe ser letra si hay alguno),
// para que el menú no se ofrezca a abrir para entradas que la ejecución real nunca
// resolvería como comando (ej. "/1"). La barra sola ("/") sigue matcheando para abrir
// el menú vacío.
const MENU_QUERY_REGEX = /(?:^|\s)\/([a-zA-Z][a-zA-Z0-9-]*)?$/;

/**
 * Determina si el menú de comandos debe mostrarse para el valor actual del input,
 * y con qué query filtrar. Busca la ÚLTIMA palabra del input (no exige que el "/"
 * esté al principio del texto completo), para soportar comandos escritos después de
 * texto libre (ej. "recuérdame revisar /tar").
 * @param {string} inputValue
 * @returns {string|null} query (puede ser '') o null si el menú no debe mostrarse
 */
export function getCommandMenuQuery(inputValue) {
  if (!inputValue) return null;
  const match = inputValue.match(MENU_QUERY_REGEX);
  if (!match) return null;
  return match[1] || '';
}

/**
 * Valida si un comando puede ejecutarse ahora mismo.
 * @param {Object|null} command - Resultado de `findChatCommand`
 * @param {{ isBusy?: boolean, historyLength?: number, args?: string }} [ctx]
 * @param {string} [ctx.args] - Args ya parseados (`parseChatCommand(...).args`). Solo se
 *   evalúa si `command.requiresArgs` está activo (ej. `/buscar`, que necesita una query).
 * @returns {{ valid: boolean, reason: 'unknown'|'busy'|'tooShort'|'emptyArgs'|null }}
 */
export function validateChatCommand(command, ctx = {}) {
  if (!command) return { valid: false, reason: 'unknown' };
  if (command.blockedWhileLoading && ctx.isBusy) return { valid: false, reason: 'busy' };
  if (command.minHistoryMessages != null && (ctx.historyLength ?? 0) < command.minHistoryMessages) {
    return { valid: false, reason: 'tooShort' };
  }
  if (command.requiresArgs && !(ctx.args ?? '').trim()) {
    return { valid: false, reason: 'emptyArgs' };
  }
  return { valid: true, reason: null };
}
