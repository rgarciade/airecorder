import { describe, it, expect } from 'vitest';
import {
  CHUNK_HEADER_TOKENS,
  estimateChunkTokens,
  computeChunkTokenBudget,
  selectChunksWithinBudget,
} from '../../../services/ai/projectContextBudget.js';
import { CONTEXT_WARNING_RATIO } from '../../../services/chat/chatTokens.js';

// 400 chars = 100 tokens de texto (+ CHUNK_HEADER_TOKENS de cabecera)
const textOfTokens = (tokens) => 'a'.repeat(tokens * 4);

function makeChunk(overrides = {}) {
  return {
    recordingId: 'rec-1',
    recordingTitle: 'Reunión 1',
    chunkId: 0,
    textDisplay: textOfTokens(80), // 80 + 20 = 100 tokens
    startTime: 0,
    endTime: 10,
    score: 0.5,
    ...overrides,
  };
}

describe('estimateChunkTokens()', () => {
  it('usa textDisplay + cabecera fija', () => {
    expect(CHUNK_HEADER_TOKENS).toBe(20);
    expect(estimateChunkTokens({ textDisplay: textOfTokens(80) })).toBe(100);
  });

  it('cae a text si no hay textDisplay, y a 0 de texto si no hay ninguno', () => {
    expect(estimateChunkTokens({ text: textOfTokens(30) })).toBe(50);
    expect(estimateChunkTokens({})).toBe(CHUNK_HEADER_TOKENS);
  });
});

describe('computeChunkTokenBudget()', () => {
  it('C7: límite por defecto 8000 cuando es falsy', () => {
    const expected = Math.max(1000, Math.min(Math.floor(8000 * CONTEXT_WARNING_RATIO) - 1000, 8000));
    expect(computeChunkTokenBudget({ contextTokenLimit: 0, fixedTokens: 1000, ragMode: 'auto' })).toBe(expected);
    expect(computeChunkTokenBudget({ fixedTokens: 1000, ragMode: 'auto' })).toBe(expected);
  });

  it('C8: modo detallado permite hasta 20000, el resto 8000', () => {
    expect(computeChunkTokenBudget({ contextTokenLimit: 200000, fixedTokens: 0, ragMode: 'detallado' })).toBe(20000);
    expect(computeChunkTokenBudget({ contextTokenLimit: 200000, fixedTokens: 0, ragMode: 'auto' })).toBe(8000);
  });

  it('C9: mínimo de 1000 cuando las partes fijas exceden el límite', () => {
    expect(computeChunkTokenBudget({ contextTokenLimit: 8000, fixedTokens: 50000, ragMode: 'auto' })).toBe(1000);
  });
});

describe('selectChunksWithinBudget()', () => {
  it('C1: el recorte por presupuesto conserva los scores más altos entre grabaciones', () => {
    const candidates = [
      makeChunk({ recordingId: 'a', chunkId: 1, score: 0.9 }),
      makeChunk({ recordingId: 'a', chunkId: 2, score: 0.2 }),
      makeChunk({ recordingId: 'b', chunkId: 1, score: 0.8 }),
      makeChunk({ recordingId: 'b', chunkId: 2, score: 0.1 }),
    ];
    const { selected } = selectChunksWithinBudget(candidates, { tokenBudget: 200, minChunks: 1 });
    expect(selected.map((c) => c.score).sort()).toEqual([0.8, 0.9]);
  });

  it('C2: con presupuesto minúsculo se conservan siempre los minChunks mejores', () => {
    const candidates = [1, 2, 3, 4, 5].map((i) =>
      makeChunk({ chunkId: i, score: i / 10, startTime: i * 10, endTime: i * 10 + 5 })
    );
    const { selected } = selectChunksWithinBudget(candidates, { tokenBudget: 1, minChunks: 3 });
    expect(selected.map((c) => c.chunkId).sort()).toEqual([3, 4, 5]);
  });

  it('C2b: minChunks se limita a n cuando hay menos candidatos', () => {
    const { selected } = selectChunksWithinBudget([makeChunk({ chunkId: 1 })], { tokenBudget: 1, minChunks: 3 });
    expect(selected).toHaveLength(1);
  });

  it('C3: máximo maxKeywordOnlyPerRecording chunks solo-keyword por grabación', () => {
    const candidates = [1, 2, 3, 4].map((i) =>
      makeChunk({ chunkId: i, score: 0.8, keywordOnly: true, startTime: i * 100, endTime: i * 100 + 5 })
    );
    candidates.push(makeChunk({ chunkId: 9, score: 0.3, startTime: 900, endTime: 905 }));
    const { selected } = selectChunksWithinBudget(candidates, { tokenBudget: 100000 });
    expect(selected.filter((c) => c.keywordOnly)).toHaveLength(2);
    expect(selected.some((c) => c.chunkId === 9)).toBe(true);
  });

  it('C3b: el tope keyword-only se aplica por grabación, no global', () => {
    const candidates = ['a', 'b'].flatMap((rec) =>
      [1, 2, 3].map((i) => makeChunk({ recordingId: rec, chunkId: i, keywordOnly: true, score: 0.8, startTime: i * 100, endTime: i * 100 + 5 }))
    );
    const { selected } = selectChunksWithinBudget(candidates, { tokenBudget: 100000 });
    expect(selected.filter((c) => c.recordingId === 'a')).toHaveLength(2);
    expect(selected.filter((c) => c.recordingId === 'b')).toHaveLength(2);
  });

  it('C4: orden de salida por primera aparición de la grabación en la entrada y luego startTime asc', () => {
    const candidates = [
      makeChunk({ recordingId: 'b', chunkId: 1, startTime: 50, endTime: 60, score: 0.9 }),
      makeChunk({ recordingId: 'a', chunkId: 1, startTime: 30, endTime: 40, score: 0.8 }),
      makeChunk({ recordingId: 'b', chunkId: 2, startTime: 10, endTime: 20, score: 0.7 }),
      makeChunk({ recordingId: 'a', chunkId: 2, startTime: 5, endTime: 15, score: 0.6 }),
    ];
    const { selected, includedRecordingIds } = selectChunksWithinBudget(candidates, { tokenBudget: 100000 });
    expect(selected.map((c) => `${c.recordingId}:${c.startTime}`)).toEqual(['b:10', 'b:50', 'a:5', 'a:30']);
    expect(includedRecordingIds).toEqual(['b', 'a']);
  });

  it('C5: un chunk grande que no cabe se salta y se continúa con uno menor posterior', () => {
    const candidates = [
      makeChunk({ chunkId: 1, score: 0.9, textDisplay: textOfTokens(80), startTime: 0, endTime: 5 }), // 100
      makeChunk({ chunkId: 2, score: 0.8, textDisplay: textOfTokens(480), startTime: 100, endTime: 105 }), // 500, no cabe
      makeChunk({ chunkId: 3, score: 0.7, textDisplay: textOfTokens(30), startTime: 200, endTime: 205 }), // 50
    ];
    const { selected } = selectChunksWithinBudget(candidates, { tokenBudget: 200, minChunks: 1 });
    expect(selected.map((c) => c.chunkId)).toEqual([1, 3]);
  });

  it('C6: entrada vacía', () => {
    expect(selectChunksWithinBudget([], { tokenBudget: 1000 })).toEqual({ selected: [], includedRecordingIds: [] });
  });
});
