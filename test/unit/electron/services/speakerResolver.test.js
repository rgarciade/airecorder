/**
 * speakerResolver.test.js
 *
 * Tests unitarios para la función resolveSpeakersInText.
 * Sigue el ciclo RED → GREEN → REFACTOR estricto.
 *
 * DB se inyecta como fake (objeto plano) — sin dependencias de FS ni SQLite.
 */

import { describe, it, expect, vi } from 'vitest';
import { resolveSpeakersInText } from '../../../../electron/services/speakerResolver.js';

// ── Helpers de factory ────────────────────────────────────────────────────────

/**
 * Crea un fake db con getRecordingSpeakerResolutions retornando el map dado.
 * @param {Object|null} map - e.g. { SPEAKER_00: { displayName: 'Alice' }, ... }
 */
function fakeDb(map) {
  return {
    getRecordingSpeakerResolutions: vi.fn().mockReturnValue(map),
  };
}

/**
 * Crea un fake db cuyo getRecordingSpeakerResolutions lanza un error.
 */
function fakeDbThatThrows(errorMsg = 'DB error') {
  return {
    getRecordingSpeakerResolutions: vi.fn().mockImplementation(() => {
      throw new Error(errorMsg);
    }),
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('resolveSpeakersInText', () => {

  // 1.1 — Etiqueta única SPEAKER_00 → "Alice"
  it('1.1 reemplaza una única etiqueta SPEAKER_00 por su nombre', () => {
    const db = fakeDb({ SPEAKER_00: { speakerId: 'uuid-1', displayName: 'Alice' } });
    const input = 'SPEAKER_00: Hola, ¿cómo estás?';
    const result = resolveSpeakersInText(1, input, db);
    expect(result).toBe('Alice: Hola, ¿cómo estás?');
    expect(result).not.toContain('SPEAKER_00');
  });

  // 1.2 — Múltiples etiquetas simultáneamente
  it('1.2 reemplaza múltiples etiquetas SPEAKER_00 y SPEAKER_01 en el mismo texto', () => {
    const db = fakeDb({
      SPEAKER_00: { speakerId: 'uuid-1', displayName: 'Alice' },
      SPEAKER_01: { speakerId: 'uuid-2', displayName: 'Bob' },
    });
    const input = 'SPEAKER_00: Buenos días.\nSPEAKER_01: Buenos días.\nSPEAKER_00: ¿Todo bien?';
    const result = resolveSpeakersInText(1, input, db);
    expect(result).toContain('Alice: Buenos días.');
    expect(result).toContain('Bob: Buenos días.');
    expect(result).not.toContain('SPEAKER_00');
    expect(result).not.toContain('SPEAKER_01');
  });

  // 1.3 — Map null → texto sin cambios, sin lanzar error
  it('1.3 devuelve txtContent sin cambios cuando el map es null', () => {
    const db = fakeDb(null);
    const input = 'SPEAKER_00: texto original';
    const result = resolveSpeakersInText(1, input, db);
    expect(result).toBe(input);
  });

  // 1.4 — Map vacío {} → texto sin cambios
  it('1.4 devuelve txtContent sin cambios cuando el map está vacío', () => {
    const db = fakeDb({});
    const input = 'SPEAKER_00: texto original';
    const result = resolveSpeakersInText(1, input, db);
    expect(result).toBe(input);
  });

  // 1.5 — Map parcial: SPEAKER_00 reemplazado, SPEAKER_01 intacto
  it('1.5 reemplaza solo las etiquetas presentes en el map parcial', () => {
    const db = fakeDb({
      SPEAKER_00: { speakerId: 'uuid-1', displayName: 'Alice' },
    });
    const input = 'SPEAKER_00: Hola.\nSPEAKER_01: Adiós.';
    const result = resolveSpeakersInText(1, input, db);
    expect(result).toContain('Alice: Hola.');
    expect(result).toContain('SPEAKER_01: Adiós.');
    expect(result).not.toContain('SPEAKER_00');
  });

  // 1.6 — Sin corrupción de tokens parciales: SPEAKER_0 NO debe matchear dentro de SPEAKER_01
  it('1.6 no corrompe SPEAKER_01 cuando el map contiene SPEAKER_0 más SPEAKER_01', () => {
    const db = fakeDb({
      SPEAKER_0: { speakerId: 'uuid-0', displayName: 'Zero' },
      SPEAKER_01: { speakerId: 'uuid-1', displayName: 'One' },
    });
    const input = 'SPEAKER_01: texto de One.\nSPEAKER_0: texto de Zero.';
    const result = resolveSpeakersInText(1, input, db);
    // SPEAKER_01 debe resolverse como "One", no como "ZeroOne"
    expect(result).toContain('One: texto de One.');
    expect(result).toContain('Zero: texto de Zero.');
    expect(result).not.toContain('SPEAKER_0');
    expect(result).not.toContain('SPEAKER_01');
    // Asegurar que el reemplazo de SPEAKER_0 no haya mutado la línea de SPEAKER_01
    expect(result).not.toContain('Zero1');
  });

  // 1.7 — Timestamps, emojis y texto multilínea preservados
  it('1.7 preserva timestamps, emojis y formato multilínea excepto la etiqueta resuelta', () => {
    const db = fakeDb({
      SPEAKER_00: { speakerId: 'uuid-1', displayName: 'Juan Pérez' },
    });
    const input = [
      '[0:00:01 - 0:00:05] 🎙️ SPEAKER_00:',
      '   Hola a todos.',
      '[0:00:06 - 0:00:10] 🎙️ SPEAKER_01:',
      '   Gracias por venir.',
    ].join('\n');

    const result = resolveSpeakersInText(1, input, db);

    // Timestamps intactos
    expect(result).toContain('[0:00:01 - 0:00:05]');
    expect(result).toContain('[0:00:06 - 0:00:10]');
    // Emoji intacto
    expect(result).toContain('🎙️');
    // Indentación del texto intacta
    expect(result).toContain('   Hola a todos.');
    expect(result).toContain('   Gracias por venir.');
    // Etiqueta resuelta
    expect(result).toContain('Juan Pérez:');
    expect(result).not.toContain('SPEAKER_00');
    // Etiqueta no resuelta sobrevive
    expect(result).toContain('SPEAKER_01:');
  });

  // 1.8 — Input vacío → "" sin error
  it('1.8 retorna cadena vacía cuando el input es una cadena vacía', () => {
    const db = fakeDb({ SPEAKER_00: { speakerId: 'uuid-1', displayName: 'Alice' } });
    const result = resolveSpeakersInText(1, '', db);
    expect(result).toBe('');
  });

  // 1.9 — DB lanza error → texto original retornado, sin excepción propagada
  it('1.9 retorna el texto original sin lanzar error cuando db.getRecordingSpeakerResolutions lanza', () => {
    const db = fakeDbThatThrows('DB connection failed');
    const input = 'SPEAKER_00: contenido importante';
    expect(() => {
      const result = resolveSpeakersInText(1, input, db);
      expect(result).toBe(input);
    }).not.toThrow();
  });

});
