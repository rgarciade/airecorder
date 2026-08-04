import { describe, it, expect } from 'vitest';
import {
  CHAT_COMMANDS,
  findChatCommand,
  parseChatCommand,
  validateChatCommand,
  getCommandMenuQuery,
} from '../../../services/chat/chatCommands.js';
import { MIN_COMPACT_HISTORY_MESSAGES, MIN_SUMMARY_HISTORY_MESSAGES } from '../../../services/chat/chatTokens.js';
import { CHAT_COMMAND_HANDLERS } from '../../../services/chat/commands/index.js';

describe('chatCommands registry', () => {
  it('registers /compact with minHistoryMessages derived from the single source of truth', () => {
    // Regresión del bug #2: el umbral de la UI (registro) debe coincidir EXACTAMENTE
    // con el umbral real que exige compactChatHistory (chatCompactService.js), y ambos
    // se derivan de la misma constante en chatTokens.js.
    const compact = findChatCommand('compact');
    expect(compact).not.toBeNull();
    expect(compact.minHistoryMessages).toBe(MIN_COMPACT_HISTORY_MESSAGES);
    expect(MIN_COMPACT_HISTORY_MESSAGES).toBe(6);
  });

  it.each(['compact', 'clear', 'help', 'resumen', 'tareas', 'nota', 'buscar'])(
    'registers "%s" with a matching i18nKey ("chatCommands.<name>") and a resolvable handler',
    (name) => {
      const cmd = findChatCommand(name);
      expect(cmd).not.toBeNull();
      expect(cmd.i18nKey).toBe(`chatCommands.${name}`);
      // Todo comando registrado DEBE tener un runFn en el mapa de dispatch —
      // de lo contrario la UI lo ofrece en el menú pero runCommand no sabría ejecutarlo.
      expect(typeof CHAT_COMMAND_HANDLERS[name]).toBe('function');
    }
  );

  it('registers exactly 7 commands (no leftovers, no accidental duplicates)', () => {
    expect(CHAT_COMMANDS).toHaveLength(7);
    const names = CHAT_COMMANDS.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('registers /resumen with minHistoryMessages derived from MIN_SUMMARY_HISTORY_MESSAGES', () => {
    // /resumen sigue dependiendo 100% del chat (sin fallback RAG) — a diferencia de
    // /tareas y /nota, que ya no bloquean en el registro (ver el test siguiente).
    const cmd = findChatCommand('resumen');
    expect(cmd.minHistoryMessages).toBe(MIN_SUMMARY_HISTORY_MESSAGES);
  });

  it('registers /tareas and /nota WITHOUT minHistoryMessages (fallback RAG vía gatherTaskContext, no bloqueo preventivo en el registro)', () => {
    // Regresión del bug reportado: bloquear aquí ANTES de intentar el fallback RAG
    // hacía que un chat nuevo/corto diera "conversación demasiado corta" aunque la
    // grabación tuviera transcripción indexada de sobra. Ahora la decisión de "no hay
    // contexto" es responsabilidad del propio comando (gatherTaskContext).
    for (const name of ['tareas', 'nota']) {
      const cmd = findChatCommand(name);
      expect(cmd.minHistoryMessages).toBeUndefined();
    }
  });

  it('registers /tareas and /nota with runsInBackground:true, and every other command WITHOUT it', () => {
    for (const name of ['tareas', 'nota']) {
      expect(findChatCommand(name).runsInBackground).toBe(true);
    }
    for (const name of ['compact', 'clear', 'help', 'resumen', 'buscar']) {
      expect(findChatCommand(name).runsInBackground).toBeUndefined();
    }
  });

  it('registers /buscar with requiresArgs:true and no minHistoryMessages (puede ser la primera pregunta)', () => {
    const buscar = findChatCommand('buscar');
    expect(buscar.requiresArgs).toBe(true);
    expect(buscar.minHistoryMessages).toBeUndefined();
  });

  it('registers /clear and /help without minHistoryMessages nor requiresArgs', () => {
    for (const name of ['clear', 'help']) {
      const cmd = findChatCommand(name);
      expect(cmd.minHistoryMessages).toBeUndefined();
      expect(cmd.requiresArgs).toBeUndefined();
    }
  });
});

describe('parseChatCommand', () => {
  it('parses "/compact" as the compact command with no args', () => {
    const result = parseChatCommand('/compact');
    expect(result.isCommand).toBe(true);
    expect(result.name).toBe('compact');
    expect(result.args).toBe('');
    expect(result.command).toEqual(CHAT_COMMANDS.find((c) => c.name === 'compact'));
  });

  it('parses "/compact <args>" preserving interior whitespace verbatim (only trims the edges)', () => {
    const result = parseChatCommand('/compact algo de texto con  varios   espacios');
    expect(result.isCommand).toBe(true);
    expect(result.name).toBe('compact');
    // Solo se recorta el espacio ÚNICO que separa el nombre del comando de los args;
    // los espacios interiores del texto del usuario deben llegar intactos (no se colapsan).
    expect(result.args).toBe('algo de texto con  varios   espacios');
  });

  it('does not resolve a bare "/" as a command', () => {
    const result = parseChatCommand('/');
    expect(result.isCommand).toBe(false);
    expect(result.name).toBeNull();
    expect(result.command).toBeNull();
  });

  it('does not resolve "/1" as a command (must start with a letter)', () => {
    const result = parseChatCommand('/1');
    expect(result.isCommand).toBe(false);
    expect(result.command).toBeNull();
  });

  it('does not interpret a filesystem-like path "/usr/local/bin" as a command', () => {
    // La barra tras "usr" no es un espacio, así que el regex estricto no matchea
    // completo (^...$) y el texto viaja como mensaje normal al LLM.
    const result = parseChatCommand('/usr/local/bin');
    expect(result.isCommand).toBe(false);
    expect(result.name).toBeNull();
    expect(result.command).toBeNull();
  });

  it('resolves the command even with free text before it (regression: menu opened but execution silently sent it as a normal message)', () => {
    // Bug real reportado: el usuario escribió "crea /tareas ..." — el menú flotante ya
    // detectaba el comando en esa posición (getCommandMenuQuery), pero parseChatCommand
    // seguía exigiendo "/" en la posición 0, así que el mensaje viajaba entero al LLM
    // como texto libre en vez de ejecutar /tareas.
    const result = parseChatCommand('crea /tareas solo de front, indicando lo que ya esta hecho');
    expect(result.isCommand).toBe(true);
    expect(result.name).toBe('tareas');
    expect(result.args).toBe('solo de front, indicando lo que ya esta hecho');
    expect(result.command).not.toBeNull();
  });

  it('still does not resolve when the slash is glued to the previous word (no space before it)', () => {
    const result = parseChatCommand('hola/tareas');
    expect(result.isCommand).toBe(false);
    expect(result.command).toBeNull();
  });

  it('is case-insensitive when resolving the command name ("/COMPACT" resolves to compact)', () => {
    // Comportamiento REAL documentado aquí (no se modificó a propósito): el parser
    // normaliza a minúsculas antes de resolver contra el registro.
    const result = parseChatCommand('/COMPACT');
    expect(result.isCommand).toBe(true);
    expect(result.name).toBe('compact');
    expect(result.command).not.toBeNull();
    expect(result.command.name).toBe('compact');
  });

  it('parses an unknown command name as isCommand:true with command:null', () => {
    const result = parseChatCommand('/foo');
    expect(result.isCommand).toBe(true);
    expect(result.name).toBe('foo');
    expect(result.command).toBeNull();
  });
});

describe('getCommandMenuQuery', () => {
  it('opens the menu for a command-in-progress at the start of the input', () => {
    expect(getCommandMenuQuery('/tar')).toBe('tar');
  });

  it('opens the menu for a command-in-progress AFTER free text (bug fix: no longer requires "/" at position 0)', () => {
    expect(getCommandMenuQuery('recuérdame revisar /tar')).toBe('tar');
  });

  it('does not open when the slash is glued to the previous word (no space before it)', () => {
    expect(getCommandMenuQuery('hola/tar')).toBeNull();
  });

  it('closes once a space follows the command word (no longer "in construction")', () => {
    expect(getCommandMenuQuery('/tar algo')).toBeNull();
    expect(getCommandMenuQuery('hola /tar algo')).toBeNull();
  });

  it('opens the empty menu for a bare trailing "/"', () => {
    expect(getCommandMenuQuery('/')).toBe('');
    expect(getCommandMenuQuery('hola /')).toBe('');
  });

  it('returns null for empty input or plain text with no trailing "/"', () => {
    expect(getCommandMenuQuery('')).toBeNull();
    expect(getCommandMenuQuery('hola que tal')).toBeNull();
  });
});

describe('validateChatCommand', () => {
  const compact = findChatCommand('compact');

  it('rejects as unknown when command is null', () => {
    const result = validateChatCommand(null, { historyLength: 10 });
    expect(result).toEqual({ valid: false, reason: 'unknown' });
  });

  it('rejects as busy when blockedWhileLoading and isBusy is true', () => {
    const result = validateChatCommand(compact, { isBusy: true, historyLength: 10 });
    expect(result).toEqual({ valid: false, reason: 'busy' });
  });

  // Umbral real tras el fix del bug #2: MIN_COMPACT_HISTORY_MESSAGES === 6.
  it.each([
    [3, false],
    [4, false], // Antes del fix, 4 pasaba la validación de UI pero fallaba en la ejecución real.
    [5, false],
    [6, true],
  ])('with historyLength=%i, valid=%s', (historyLength, expectedValid) => {
    const result = validateChatCommand(compact, { isBusy: false, historyLength });
    expect(result.valid).toBe(expectedValid);
    if (!expectedValid) {
      expect(result.reason).toBe('tooShort');
    } else {
      expect(result.reason).toBeNull();
    }
  });
});
