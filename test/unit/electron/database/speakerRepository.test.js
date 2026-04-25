/**
 * speakerRepository.test.js
 *
 * Tests unitarios para las funciones de filtrado y promediado de embeddings
 * en speakerRepository.js.
 */

import { describe, test, expect } from 'vitest';
import {
  cosineSimilarity,
  magnitude,
  dotProduct,
  averageEmbeddingPair,
  findMostSimilarPair,
  deserializeEmbedding,
} from '../../../../electron/database/speakerRepository.js';
import { generateAlias, serializeEmbedding } from '../../../../electron/services/speakerManager.js';

describe('speakerRepository — helpers de álgebra vectorial', () => {

  describe('magnitude()', () => {
    test('vector [3, 4] → magnitude 5', () => {
      expect(magnitude([3, 4])).toBeCloseTo(5, 6);
    });

    test('vector [1, 0, 0] → magnitude 1', () => {
      expect(magnitude([1, 0, 0])).toBeCloseTo(1, 6);
    });

    test('vector nulo [0, 0] → magnitude 0', () => {
      expect(magnitude([0, 0])).toBe(0);
    });

    test('vector normalizado [0.6, 0.8] → magnitude 1', () => {
      expect(magnitude([0.6, 0.8])).toBeCloseTo(1, 6);
    });
  });

  describe('cosineSimilarity()', () => {
    test('vectores idénticos [1,0],[1,0] → sim 1', () => {
      expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1, 6);
    });

    test('vectores ortogonales [1,0],[0,1] → sim 0', () => {
      expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 6);
    });

    test('vectores opuestos [1,0],[-1,0] → sim -1', () => {
      expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1, 6);
    });

    test('vector nulo → sim 0', () => {
      expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
    });

    test('embedding real (192 dims) con sim 0.99', () => {
      const a = Array.from({ length: 192 }, (_, i) => Math.sin(i * 0.1));
      const b = a.map((v, i) => (i > 150 ? v * 1.001 : v));
      expect(cosineSimilarity(a, b)).toBeGreaterThan(0.99);
      expect(cosineSimilarity(a, b)).toBeLessThan(1);
    });
  });

  describe('averageEmbeddingPair()', () => {
    test('promedia dos vectores y normaliza a L2=1', () => {
      const a = [1, 0, 0];
      const b = [0, 1, 0];
      const avg = averageEmbeddingPair(a, b);
      expect(avg).toHaveLength(3);
      expect(magnitude(avg)).toBeCloseTo(1, 6);
    });

    test('dos vectores idénticos → devuelve una copia normalizada', () => {
      const a = [0.8, 0.6, 0];
      const b = [0.8, 0.6, 0];
      expect(magnitude(averageEmbeddingPair(a, b))).toBeCloseTo(1, 6);
    });

    test('throws si longitudes distintas', () => {
      expect(() => averageEmbeddingPair([1, 0], [0, 1, 0])).toThrow();
    });

    test('throws si algún vector es null', () => {
      expect(() => averageEmbeddingPair(null, [0, 1])).toThrow();
    });

    test('embedding de 192 dims se normaliza correctamente', () => {
      const a = Array.from({ length: 192 }, () => Math.random() - 0.5);
      const b = Array.from({ length: 192 }, () => Math.random() - 0.5);
      const avg = averageEmbeddingPair(a, b);
      expect(avg).toHaveLength(192);
      expect(magnitude(avg)).toBeCloseTo(1, 4);
    });

    test('vectores de magnitud muy pequeña → no crash', () => {
      const a = [1e-10, 2e-10, -3e-10];
      const b = [2e-10, -1e-10, 1e-10];
      const avg = averageEmbeddingPair(a, b);
      expect(avg).toHaveLength(3);
      expect(Number.isFinite(avg[0])).toBe(true);
    });
  });

  describe('findMostSimilarPair()', () => {
    test('null si menos de 2 embeddings', () => {
      expect(findMostSimilarPair([])).toBeNull();
      expect(findMostSimilarPair([{ id: 1, embedding: [1, 0] }])).toBeNull();
    });

    test('encuentra el par más similar entre 3 embeddings', () => {
      const embeddings = [
        { id: 1, embedding: [1, 0, 0] },
        { id: 2, embedding: [0.99, 0.01, 0] },
        { id: 3, embedding: [0, 1, 0] },
      ];
      const result = findMostSimilarPair(embeddings);
      expect(result).not.toBeNull();
      expect(result.idxA).toBe(0);
      expect(result.idxB).toBe(1);
      expect(result.similarity).toBeGreaterThan(0.999);
    });

    test('par con mayor similitud es el correcto (no el primer par)', () => {
      const embeddings = [
        { id: 1, embedding: [1, 0, 0] },
        { id: 2, embedding: [0.707, 0.707, 0] },
        { id: 3, embedding: [0.71, 0.71, 0] },
      ];
      const result = findMostSimilarPair(embeddings);
      expect(result.similarity).toBeGreaterThan(0.998);
    });

    test('embedding de 192 dims — algoritmo estable', () => {
      const embeddings = [
        { id: 1, embedding: Array.from({ length: 192 }, (_, i) => Math.sin(i * 0.05)) },
        { id: 2, embedding: Array.from({ length: 192 }, (_, i) => Math.sin(i * 0.05) + 0.001) },
        { id: 3, embedding: Array.from({ length: 192 }, (_, i) => Math.cos(i * 0.05)) },
      ];
      const result = findMostSimilarPair(embeddings);
      expect(result).not.toBeNull();
      expect(result.idxA).toBe(0);
      expect(result.idxB).toBe(1);
      expect(result.similarity).toBeGreaterThan(0.99);
    });

    test('todas las similitudes iguales → primer par (idx 0 y 1)', () => {
      const embeddings = [
        { id: 1, embedding: [1, 0, 0] },
        { id: 2, embedding: [0, 1, 0] },
        { id: 3, embedding: [0, 0, 1] },
      ];
      const result = findMostSimilarPair(embeddings);
      expect(result.idxA).toBe(0);
      expect(result.idxB).toBe(1);
    });

    test('similitud -1 (vectores opuestos) → devuelve el par más cercano a 1', () => {
      // Even though sim=-1 is "most similar" in absolute terms among opposites,
      // the pair with the highest cosine similarity value (closest to 1) is selected
      const embeddings = [
        { id: 1, embedding: [1, 0, 0] },
        { id: 2, embedding: [-1, 0, 0] },
        { id: 3, embedding: [0, 1, 0] },
      ];
      const result = findMostSimilarPair(embeddings);
      expect(result.similarity).toBeLessThan(0.5);
    });

    test('40 embeddings (límite real) — rendimiento aceptable', () => {
      const embeddings = Array.from({ length: 40 }, (_, i) => ({
        id: i + 1,
        embedding: Array.from({ length: 192 }, (_, j) => Math.sin((i + 1) * (j + 1) * 0.1)),
      }));
      const result = findMostSimilarPair(embeddings);
      expect(result).not.toBeNull();
      expect(result.idxA).toBeLessThan(40);
      expect(result.idxB).toBeLessThan(40);
      expect(result.similarity).toBeGreaterThan(-1);
      expect(result.similarity).toBeLessThanOrEqual(1);
    });

    test('empate ids distintos → orden estable por índice, no por id', () => {
      const embeddings = [
        { id: 100, embedding: [1, 0, 0] },
        { id: 200, embedding: [0.999, 0.001, 0] },
        { id: 300, embedding: [0.999, 0.001, 0] },
        { id: 400, embedding: [0, 1, 0] },
      ];
      const result = findMostSimilarPair(embeddings);
      expect(result.similarity).toBeGreaterThan(0.99);
      expect(result.idxA).toBe(1);
      expect(result.idxB).toBe(2);
    });
  });

  describe('dotProduct()', () => {
    test('[1,2,3] · [4,5,6] = 32', () => {
      expect(dotProduct([1, 2, 3], [4, 5, 6])).toBe(32);
    });

    test('vectores ortogonales → 0', () => {
      expect(dotProduct([1, 0, 0], [0, 5, 0])).toBe(0);
    });

    test('con valores negativos', () => {
      expect(dotProduct([-1, 2, -3], [4, -5, 6])).toBe(-32);
    });

    test('vector nulo → 0', () => {
      expect(dotProduct([0, 0, 0], [1, 2, 3])).toBe(0);
    });

    test('embedding 192 dims', () => {
      const a = Array.from({ length: 192 }, (_, i) => Math.sin(i * 0.1));
      const b = Array.from({ length: 192 }, (_, i) => Math.cos(i * 0.1));
      expect(Number.isFinite(dotProduct(a, b))).toBe(true);
    });
  });

  describe('deserializeEmbedding()', () => {
    test('Buffer JSON → array', () => {
      const buf = Buffer.from(JSON.stringify([0.1, 0.2, 0.3]), 'utf8');
      expect(deserializeEmbedding(buf)).toEqual([0.1, 0.2, 0.3]);
    });

    test('string JSON → array', () => {
      expect(deserializeEmbedding('[0.1, 0.2, 0.3]')).toEqual([0.1, 0.2, 0.3]);
    });

    test('Float32Array binario little-endian → array', () => {
      const arr = new Float32Array([1.5, -2.25, 0.0]);
      const buf = Buffer.alloc(arr.length * 4);
      for (let i = 0; i < arr.length; i++) buf.writeFloatLE(arr[i], i * 4);
      const result = deserializeEmbedding(buf);
      expect(result).toHaveLength(3);
      expect(result[0]).toBeCloseTo(1.5, 4);
      expect(result[1]).toBeCloseTo(-2.25, 4);
      expect(result[2]).toBeCloseTo(0, 4);
    });

    test('array ya parseado → misma referencia', () => {
      const arr = [0.1, 0.2, 0.3];
      expect(deserializeEmbedding(arr)).toBe(arr);
    });

    test('null → null', () => {
      expect(deserializeEmbedding(null)).toBeNull();
    });

    test('undefined → null', () => {
      expect(deserializeEmbedding(undefined)).toBeNull();
    });

    test('string JSON inválida → null (no crash)', () => {
      expect(deserializeEmbedding('not json')).toBeNull();
    });

    test('Buffer binario longitud no divisible por 4 → null', () => {
      expect(deserializeEmbedding(Buffer.from('abc'))).toBeNull();
    });

    test('array vacío → array vacío', () => {
      expect(deserializeEmbedding([])).toEqual([]);
    });

    test('roundtrip con serializeEmbedding de speakerManager', () => {
      const original = [0.123, -0.456, 0.789];
      const blob = serializeEmbedding(original);
      expect(deserializeEmbedding(blob)).toEqual(original);
    });
  });

  describe('edge cases', () => {
    test('cosineSimilarity 192 dims ortogonales → 0', () => {
      const a = Array.from({ length: 192 }, (_, i) => (i % 2 === 0 ? 1 : 0));
      const b = Array.from({ length: 192 }, (_, i) => (i % 2 === 1 ? 1 : 0));
      expect(cosineSimilarity(a, b)).toBeCloseTo(0, 4);
    });

    test('findMostSimilarPair todos ortogonales → sim cercana a 0', () => {
      const embeddings = [
        { id: 1, embedding: [1, 0, 0] },
        { id: 2, embedding: [0, 1, 0] },
        { id: 3, embedding: [0, 0, 1] },
      ];
      expect(findMostSimilarPair(embeddings).similarity).toBeCloseTo(0, 4);
    });
  });
});

describe('speakerManager — generateAlias() y serializeEmbedding()', () => {

  describe('generateAlias()', () => {
    test('index 0 → "Speaker_01"', () => {
      expect(generateAlias(0)).toBe('Speaker_01');
    });

    test('index 9 → "Speaker_10"', () => {
      expect(generateAlias(9)).toBe('Speaker_10');
    });

    test('index 99 → "Speaker_100"', () => {
      expect(generateAlias(99)).toBe('Speaker_100');
    });

    test('index 1 → "Speaker_02"', () => {
      expect(generateAlias(1)).toBe('Speaker_02');
    });

    test('index 11 → "Speaker_12"', () => {
      expect(generateAlias(11)).toBe('Speaker_12');
    });
  });

  describe('serializeEmbedding()', () => {
    test('roundtrip: serialize → deserialize da el mismo array', () => {
      const original = [0.1, -0.2, 0.3, 0.4, -0.5];
      const serialized = serializeEmbedding(original);
      expect(Buffer.isBuffer(serialized)).toBe(true);
      expect(deserializeEmbedding(serialized)).toEqual(original);
    });

    test('roundtrip con embedding de 192 dims', () => {
      const original = Array.from({ length: 192 }, (_, i) => Math.sin(i * 0.1));
      const deserialized = deserializeEmbedding(serializeEmbedding(original));
      expect(deserialized).toHaveLength(192);
      deserialized.forEach((v, i) => {
        expect(v).toBeCloseTo(original[i], 10);
      });
    });

    test('serialized es Buffer válido para SQLite', () => {
      expect(Buffer.isBuffer(serializeEmbedding([1, 2, 3]))).toBe(true);
    });
  });
});
