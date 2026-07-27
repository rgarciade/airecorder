/**
 * Registro + parser de comandos de chat. Extensible: para añadir un comando
 * nuevo, añade una entrada a CHAT_COMMANDS y su `case` en `useChatCommands.js`.
 * ChatInterface no conoce ningún comando concreto — solo usa este registro.
 */

import { MIN_COMPACT_HISTORY_MESSAGES } from './chatTokens';

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

// Parser estricto: solo el texto COMPLETO encaja. Consecuencia deseada:
// "/usr/local/bin" no matchea (la barra tras el nombre no es espacio) y
// viaja como mensaje normal al LLM.
const COMMAND_REGEX = /^\/([a-zA-Z][a-zA-Z0-9-]*)(?:\s+([\s\S]*))?$/;

/**
 * Parsea el texto crudo del input del chat.
 * @param {string} rawText
 * @returns {{ isCommand: boolean, name: string|null, args: string, command: Object|null }}
 */
export function parseChatCommand(rawText) {
  const text = (rawText || '').trim();
  if (!text.startsWith('/')) {
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

// Mientras el input encaja con esto (nombre de comando en construcción, sin espacio
// todavía), el menú flotante de comandos permanece abierto. Un espacio lo cierra.
// Misma gramática que COMMAND_REGEX (primer carácter debe ser letra si hay alguno),
// para que el menú no se ofrezca a abrir para entradas que la ejecución real nunca
// resolvería como comando (ej. "/1"). La barra sola ("/") sigue matcheando para abrir
// el menú vacío.
const MENU_QUERY_REGEX = /^\/([a-zA-Z][a-zA-Z0-9-]*)?$/;

/**
 * Determina si el menú de comandos debe mostrarse para el valor actual del input,
 * y con qué query filtrar.
 * @param {string} inputValue
 * @returns {string|null} query (puede ser '') o null si el menú no debe mostrarse
 */
export function getCommandMenuQuery(inputValue) {
  if (!inputValue) return null;
  if (!MENU_QUERY_REGEX.test(inputValue)) return null;
  return inputValue.slice(1);
}

/**
 * Valida si un comando puede ejecutarse ahora mismo.
 * @param {Object|null} command - Resultado de `findChatCommand`
 * @param {{ isBusy?: boolean, historyLength?: number }} [ctx]
 * @returns {{ valid: boolean, reason: 'unknown'|'busy'|'tooShort'|null }}
 */
export function validateChatCommand(command, ctx = {}) {
  if (!command) return { valid: false, reason: 'unknown' };
  if (command.blockedWhileLoading && ctx.isBusy) return { valid: false, reason: 'busy' };
  if (command.minHistoryMessages != null && (ctx.historyLength ?? 0) < command.minHistoryMessages) {
    return { valid: false, reason: 'tooShort' };
  }
  return { valid: true, reason: null };
}
