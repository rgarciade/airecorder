import { describe, it, expect } from 'vitest';
import {
  CHAT_COMMANDS,
  findChatCommand,
  parseChatCommand,
  validateChatCommand,
} from '../../../services/chat/chatCommands.js';
import { MIN_COMPACT_HISTORY_MESSAGES } from '../../../services/chat/chatTokens.js';

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
