/**
 * speakerRepository.dbLookup.test.js
 *
 * Tests para las funciones de speakerRepository.js que dependen de dbService
 * (findMatchingSpeaker, findCandidateSpeakers, getEmbeddingsBySpeakerId).
 *
 * Separado de speakerRepository.test.js porque ese archivo importa
 * speakerRepository.js estáticamente al inicio (para las funciones puras de
 * álgebra vectorial), y ese import estático se resuelve ANTES de que
 * cualquier beforeAll pueda inyectar un mock de dbService en require.cache —
 * para cuando el mock se instala, speakerRepository.js ya capturó la
 * instancia REAL de dbService en su `const dbService = require('./dbService')`
 * de nivel de módulo. Este archivo evita el import estático y usa `import()`
 * dinámico dentro de beforeEach, después de instalar el mock.
 */
import { describe, test, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { createRequire } from 'node:module';

const nodeRequire = createRequire(import.meta.url);
const dbServicePath = nodeRequire.resolve('../../../../electron/database/dbService.js');
let originalDbServiceEntry;

const dbServiceMock = {
  getAllSpeakerEmbeddings: vi.fn(),
  getEmbeddingsBySpeakerId: vi.fn(),
};

beforeAll(() => {
  originalDbServiceEntry = nodeRequire.cache[dbServicePath];
  nodeRequire.cache[dbServicePath] = {
    id: dbServicePath,
    filename: dbServicePath,
    loaded: true,
    exports: dbServiceMock,
  };
});

afterAll(() => {
  if (originalDbServiceEntry) nodeRequire.cache[dbServicePath] = originalDbServiceEntry;
  else delete nodeRequire.cache[dbServicePath];
});

// Vector unitario 2D cuya similitud coseno con [1, 0] es exactamente `sim`
// (ambos vectores de magnitud 1 → dot product = cos(theta) = sim).
function vecAtSimilarity(sim) {
  return [sim, Math.sqrt(1 - sim * sim)];
}

describe('speakerRepository — funciones dependientes de dbService', () => {
  let repo;

  beforeEach(async () => {
    dbServiceMock.getAllSpeakerEmbeddings.mockReset();
    dbServiceMock.getEmbeddingsBySpeakerId.mockReset();
    vi.restoreAllMocks();
    repo = await import('../../../../electron/database/speakerRepository.js');
  });

  describe('findMatchingSpeaker()', () => {
    test('embedding null → null, sin consultar la DB', () => {
      expect(repo.findMatchingSpeaker(null)).toBeNull();
      expect(dbServiceMock.getAllSpeakerEmbeddings).not.toHaveBeenCalled();
    });

    test('embedding no-array → null', () => {
      expect(repo.findMatchingSpeaker('not-an-array')).toBeNull();
    });

    test('embedding array vacío → null', () => {
      expect(repo.findMatchingSpeaker([])).toBeNull();
    });

    test('dbService lanza → catch, devuelve null', () => {
      dbServiceMock.getAllSpeakerEmbeddings.mockImplementation(() => {
        throw new Error('DB corrupta');
      });
      vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(repo.findMatchingSpeaker([1, 0])).toBeNull();
    });

    test('sin embeddings almacenados → null', () => {
      dbServiceMock.getAllSpeakerEmbeddings.mockReturnValue([]);
      expect(repo.findMatchingSpeaker([1, 0])).toBeNull();
    });

    test('similitud exacta = threshold por defecto (0.85) → cuenta como match (>=)', () => {
      dbServiceMock.getAllSpeakerEmbeddings.mockReturnValue([
        { id: 1, speaker_id: 'sp-A', embedding: vecAtSimilarity(0.85) },
      ]);

      const result = repo.findMatchingSpeaker([1, 0]);

      expect(result.speakerId).toBe('sp-A');
      expect(result.similarity).toBeCloseTo(0.85, 10);
    });

    test('similitud justo debajo del threshold → null', () => {
      dbServiceMock.getAllSpeakerEmbeddings.mockReturnValue([
        { id: 1, speaker_id: 'sp-A', embedding: vecAtSimilarity(0.84) },
      ]);

      expect(repo.findMatchingSpeaker([1, 0])).toBeNull();
    });

    test('threshold personalizado más bajo permite un match que el default rechazaría', () => {
      dbServiceMock.getAllSpeakerEmbeddings.mockReturnValue([
        { id: 1, speaker_id: 'sp-A', embedding: vecAtSimilarity(0.5) },
      ]);

      expect(repo.findMatchingSpeaker([1, 0])).toBeNull();
      const match = repo.findMatchingSpeaker([1, 0], 0.3);
      expect(match.speakerId).toBe('sp-A');
      expect(match.similarity).toBeCloseTo(0.5, 10);
    });

    test('elige el mejor match entre varios, no el primero', () => {
      dbServiceMock.getAllSpeakerEmbeddings.mockReturnValue([
        { id: 1, speaker_id: 'sp-A', embedding: vecAtSimilarity(0.9) },
        { id: 2, speaker_id: 'sp-B', embedding: vecAtSimilarity(0.99) },
        { id: 3, speaker_id: 'sp-C', embedding: vecAtSimilarity(0.86) },
      ]);

      expect(repo.findMatchingSpeaker([1, 0]).speakerId).toBe('sp-B');
    });

    test('omite (sin lanzar) una fila cuyo embedding no se puede deserializar', () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      dbServiceMock.getAllSpeakerEmbeddings.mockReturnValue([
        { id: 1, speaker_id: 'sp-bad', embedding: 'esto no es JSON' },
        { id: 2, speaker_id: 'sp-good', embedding: vecAtSimilarity(0.95) },
      ]);

      expect(repo.findMatchingSpeaker([1, 0]).speakerId).toBe('sp-good');
    });

    test('omite (sin lanzar) una fila con dimensión distinta a la del embedding buscado', () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      dbServiceMock.getAllSpeakerEmbeddings.mockReturnValue([
        { id: 1, speaker_id: 'sp-3d', embedding: [1, 0, 0] },
        { id: 2, speaker_id: 'sp-2d', embedding: vecAtSimilarity(0.95) },
      ]);

      expect(repo.findMatchingSpeaker([1, 0]).speakerId).toBe('sp-2d');
    });
  });

  describe('findCandidateSpeakers()', () => {
    test('embedding inválido → [] sin consultar la DB', () => {
      expect(repo.findCandidateSpeakers(null)).toEqual([]);
      expect(repo.findCandidateSpeakers([])).toEqual([]);
      expect(dbServiceMock.getAllSpeakerEmbeddings).not.toHaveBeenCalled();
    });

    test('dbService lanza → catch, devuelve []', () => {
      dbServiceMock.getAllSpeakerEmbeddings.mockImplementation(() => {
        throw new Error('DB corrupta');
      });
      vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(repo.findCandidateSpeakers([1, 0])).toEqual([]);
    });

    test('sin embeddings almacenados → []', () => {
      dbServiceMock.getAllSpeakerEmbeddings.mockReturnValue([]);
      expect(repo.findCandidateSpeakers([1, 0])).toEqual([]);
    });

    test('filtra por rango [min, max): min inclusive, max exclusive', () => {
      dbServiceMock.getAllSpeakerEmbeddings.mockReturnValue([
        { id: 1, speaker_id: 'sp-below', embedding: vecAtSimilarity(0.69) },
        { id: 2, speaker_id: 'sp-at-min', embedding: vecAtSimilarity(0.70) },
        { id: 3, speaker_id: 'sp-mid', embedding: vecAtSimilarity(0.75) },
        { id: 4, speaker_id: 'sp-at-max', embedding: vecAtSimilarity(0.85) },
        { id: 5, speaker_id: 'sp-above', embedding: vecAtSimilarity(0.90) },
      ]);

      const result = repo.findCandidateSpeakers([1, 0]);
      const ids = result.map((c) => c.speakerId).sort();

      expect(ids).toEqual(['sp-at-min', 'sp-mid']);
    });

    test('agrupa por speakerId quedándose con la mejor similitud de cada uno', () => {
      dbServiceMock.getAllSpeakerEmbeddings.mockReturnValue([
        { id: 1, speaker_id: 'sp-A', embedding: vecAtSimilarity(0.72) },
        { id: 2, speaker_id: 'sp-A', embedding: vecAtSimilarity(0.80) },
        { id: 3, speaker_id: 'sp-A', embedding: vecAtSimilarity(0.75) },
      ]);

      const result = repo.findCandidateSpeakers([1, 0]);

      expect(result).toHaveLength(1);
      expect(result[0].speakerId).toBe('sp-A');
      expect(result[0].similarity).toBeCloseTo(0.80, 10);
    });

    test('devuelve los resultados ordenados por similitud descendente', () => {
      dbServiceMock.getAllSpeakerEmbeddings.mockReturnValue([
        { id: 1, speaker_id: 'sp-low', embedding: vecAtSimilarity(0.71) },
        { id: 2, speaker_id: 'sp-high', embedding: vecAtSimilarity(0.84) },
        { id: 3, speaker_id: 'sp-mid', embedding: vecAtSimilarity(0.78) },
      ]);

      const result = repo.findCandidateSpeakers([1, 0]);

      expect(result.map((c) => c.speakerId)).toEqual(['sp-high', 'sp-mid', 'sp-low']);
    });

    test('respeta minThreshold/maxThreshold personalizados', () => {
      dbServiceMock.getAllSpeakerEmbeddings.mockReturnValue([
        { id: 1, speaker_id: 'sp-A', embedding: vecAtSimilarity(0.5) },
      ]);

      expect(repo.findCandidateSpeakers([1, 0])).toEqual([]);
      const candidates = repo.findCandidateSpeakers([1, 0], 0.4, 0.6);
      expect(candidates).toHaveLength(1);
      expect(candidates[0].speakerId).toBe('sp-A');
      expect(candidates[0].similarity).toBeCloseTo(0.5, 10);
    });

    test('omite en silencio filas con dimensión distinta (sin console.warn)', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      dbServiceMock.getAllSpeakerEmbeddings.mockReturnValue([
        { id: 1, speaker_id: 'sp-3d', embedding: [0.75, 0, 0] },
        { id: 2, speaker_id: 'sp-2d', embedding: vecAtSimilarity(0.75) },
      ]);

      const result = repo.findCandidateSpeakers([1, 0]);

      expect(result).toEqual([{ speakerId: 'sp-2d', similarity: 0.75 }]);
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });

  describe('getEmbeddingsBySpeakerId()', () => {
    test('array vacío si el speaker no tiene embeddings', () => {
      dbServiceMock.getEmbeddingsBySpeakerId.mockReturnValue([]);
      expect(repo.getEmbeddingsBySpeakerId('sp-none')).toEqual([]);
    });

    test('deserializa embedding y preserva el resto de campos de cada fila', () => {
      dbServiceMock.getEmbeddingsBySpeakerId.mockReturnValue([
        {
          id: 1,
          speaker_id: 'sp-A',
          embedding: '[0.1, 0.2, 0.3]',
          recording_id: 42,
          created_at: '2026-01-01T00:00:00.000Z',
        },
      ]);

      const result = repo.getEmbeddingsBySpeakerId('sp-A');

      expect(result).toEqual([
        {
          id: 1,
          speaker_id: 'sp-A',
          embedding: [0.1, 0.2, 0.3],
          recording_id: 42,
          created_at: '2026-01-01T00:00:00.000Z',
        },
      ]);
    });

    test('propaga null en embedding si la fila trae un valor no parseable', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      dbServiceMock.getEmbeddingsBySpeakerId.mockReturnValue([
        { id: 1, speaker_id: 'sp-A', embedding: 'no es json', recording_id: null, created_at: null },
      ]);

      const result = repo.getEmbeddingsBySpeakerId('sp-A');

      expect(result[0].embedding).toBeNull();
    });
  });
});
