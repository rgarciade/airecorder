import { describe, it, expect } from 'vitest';
import {
  formatTime,
  buildTranscriptionTxt,
  buildTranscriptionJson,
  assignRelativeTimestamps,
} from '../../../../electron/integrations/chatSyncUtils.js';

describe('formatTime', () => {
  it('formatea 0 segundos', () => {
    expect(formatTime(0)).toBe('0:00:00');
  });

  it('formatea segundos y minutos con padding a 2 dígitos', () => {
    expect(formatTime(65)).toBe('0:01:05');
  });

  it('formatea exactamente 1 hora (3600s) sin arrastrar resto a minutos', () => {
    expect(formatTime(3600)).toBe('1:00:00');
  });

  it('formatea más de 99 horas sin padding en la parte de horas', () => {
    expect(formatTime(100 * 3600)).toBe('100:00:00');
  });

  it('trunca fracciones de segundo con Math.floor', () => {
    expect(formatTime(59.999)).toBe('0:00:59');
  });

  it('no lanza con segundos negativos, aunque el resultado no sea un timestamp válido', () => {
    expect(() => formatTime(-5)).not.toThrow();
  });
});

describe('buildTranscriptionTxt', () => {
  it('devuelve string vacío para un array de segmentos vacío', () => {
    expect(buildTranscriptionTxt([])).toBe('');
  });

  it('formatea un único segmento con el emoji del primer speaker', () => {
    const result = buildTranscriptionTxt([
      { start: 0, end: 3, speaker: 'Ana', text: 'hola' },
    ]);

    expect(result).toBe('[0:00:00 - 0:00:03] 🟦 Ana:\n   hola');
  });

  it('reutiliza el mismo emoji para el mismo speaker en segmentos distintos', () => {
    const result = buildTranscriptionTxt([
      { start: 0, end: 3, speaker: 'Ana', text: 'hola' },
      { start: 3, end: 6, speaker: 'Bruno', text: 'qué tal' },
      { start: 6, end: 9, speaker: 'Ana', text: 'bien' },
    ]);

    const lines = result.split('\n\n');
    expect(lines[0]).toContain('🟦 Ana:');
    expect(lines[2]).toContain('🟦 Ana:');
    expect(lines[1]).toContain('🟩 Bruno:');
  });

  it('BUG LATENTE: con más de 10 speakers distintos, el emoji se repite (colisión módulo 10)', () => {
    const segments = Array.from({ length: 11 }, (_, i) => ({
      start: i * 3,
      end: i * 3 + 3,
      speaker: `Speaker${i}`,
      text: 'msg',
    }));

    const result = buildTranscriptionTxt(segments);
    const lines = result.split('\n\n');
    const firstLineEmoji = lines[0].match(/\] (\S+) Speaker0:/)[1];
    const eleventhLineEmoji = lines[10].match(/\] (\S+) Speaker10:/)[1];

    expect(eleventhLineEmoji).toBe(firstLineEmoji);
  });

  it('no rompe el formato de línea si el texto del mensaje contiene saltos de línea', () => {
    const result = buildTranscriptionTxt([
      { start: 0, end: 3, speaker: 'Ana', text: 'línea 1\nlínea 2' },
    ]);

    expect(result).toBe('[0:00:00 - 0:00:03] 🟦 Ana:\n   línea 1\nlínea 2');
  });
});

describe('buildTranscriptionJson', () => {
  it('devuelve array vacío para segmentos vacíos', () => {
    expect(buildTranscriptionJson([])).toEqual([]);
  });

  it('asigna ids secuenciales empezando en 0 y el emoji correspondiente', () => {
    const result = buildTranscriptionJson([
      { start: 0, end: 3, speaker: 'Ana', text: 'hola' },
      { start: 3, end: 6, speaker: 'Bruno', text: 'chau' },
    ]);

    expect(result).toEqual([
      { id: 0, start: 0, end: 3, speaker: 'Ana', text: 'hola', emoji: '🟦' },
      { id: 1, start: 3, end: 6, speaker: 'Bruno', text: 'chau', emoji: '🟩' },
    ]);
  });

  it('mantiene el mismo emoji para un speaker repetido', () => {
    const result = buildTranscriptionJson([
      { start: 0, end: 3, speaker: 'Ana', text: 'a' },
      { start: 3, end: 6, speaker: 'Ana', text: 'b' },
    ]);

    expect(result[0].emoji).toBe(result[1].emoji);
  });
});

describe('assignRelativeTimestamps', () => {
  it('devuelve array vacío si no hay mensajes', () => {
    expect(assignRelativeTimestamps([])).toEqual([]);
  });

  it('asigna 3s por mensaje empezando en offset 0 por defecto', () => {
    const result = assignRelativeTimestamps([
      { speaker: 'Ana', text: 'hola' },
      { speaker: 'Bruno', text: 'chau' },
    ]);

    expect(result).toEqual([
      { speaker: 'Ana', text: 'hola', start: 0, end: 3 },
      { speaker: 'Bruno', text: 'chau', start: 3, end: 6 },
    ]);
  });

  it('respeta un startOffset positivo (sync incremental)', () => {
    const result = assignRelativeTimestamps([{ speaker: 'Ana', text: 'hola' }], 100);

    expect(result[0]).toMatchObject({ start: 100, end: 103 });
  });

  it('acepta startOffset negativo sin lanzar', () => {
    const result = assignRelativeTimestamps([{ speaker: 'Ana', text: 'hola' }], -10);

    expect(result[0]).toMatchObject({ start: -10, end: -7 });
  });

  it('preserva campos extra del mensaje original', () => {
    const result = assignRelativeTimestamps([{ speaker: 'Ana', text: 'hola', raw: { id: 42 } }]);

    expect(result[0].raw).toEqual({ id: 42 });
  });
});
