/**
 * speakerRepository.test.js
 *
 * Tests unitarios para las funciones de filtrado y promediado de embeddings
 * en speakerRepository.js. Los tests de integrate se saltan si no hay BD real.
 */

import { describe, test, expect } from 'vitest';
const { cosineSimilarity, magnitude, averageEmbeddingPair, findMostSimilarPair } = require('../../../../electron/database/speakerRepository');

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
      // Simular un embedding de 192 dims casi idéntico
      const a = Array.from({ length: 192 }, (_, i) => Math.sin(i * 0.1));
      const b = a.map((v, i) => (i > 150 ? v * 1.001 : v)); // slight drift en últimos dims
      const sim = cosineSimilarity(a, b);
      expect(sim).toBeGreaterThan(0.99);
      expect(sim).toBeLessThan(1);
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
      const avg = averageEmbeddingPair(a, b);
      expect(magnitude(avg)).toBeCloseTo(1, 6);
    });

    test('throws si longitudes distintas', () => {
      expect(() => averageEmbeddingPair([1, 0], [0, 1, 0])).toThrow();
    });

    test('throws si algún vector es null', () => {
      expect(() => averageEmbeddingPair(null, [0, 1])).toThrow();
    });

    test('embedding de 192 dims se normaliza correctamente', () => {
      const a = Array.from({ length: 192 }, (_, i) => Math.random() - 0.5);
      const b = Array.from({ length: 192 }, (_, i) => Math.random() - 0.5);
      const avg = averageEmbeddingPair(a, b);
      expect(avg).toHaveLength(192);
      expect(magnitude(avg)).toBeCloseTo(1, 4);
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
        { id: 2, embedding: [0.99, 0.01, 0] }, // sim ~0.9999 con #1
        { id: 3, embedding: [0, 1, 0] },        // sim 0 con #1, sim 0 con #2
      ];
      const result = findMostSimilarPair(embeddings);
      expect(result).not.toBeNull();
      expect(result.idxA).toBe(0);
      expect(result.idxB).toBe(1);
      expect(result.similarity).toBeGreaterThan(0.999);
    });

    test('par con mayor similitud es el correcto (no el primer par)', () => {
      // El par más similar debe ser #2 y #3, no #1 y #2
      const embeddings = [
        { id: 1, embedding: [1, 0, 0] },          // sim ~0.707 con #3
        { id: 2, embedding: [0.707, 0.707, 0] },  // sim ~0.999 con #3
        { id: 3, embedding: [0.71, 0.71, 0] },   // sim ~0.999 con #2
      ];
      const result = findMostSimilarPair(embeddings);
      // Debe detectar que 2 y 3 son más similares entre sí
      expect(result.similarity).toBeGreaterThan(0.998);
    });

    test('embedding de 192 dims — el algoritmo es estable', () => {
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
  });

  describe('edge cases', () => {
    test('cosineSimilarity con vectores de longitud 192 ortogonales', () => {
      const a = Array.from({ length: 192 }, (_, i) => (i % 2 === 0 ? 1 : 0));
      const b = Array.from({ length: 192 }, (_, i) => (i % 2 === 1 ? 1 : 0));
      expect(cosineSimilarity(a, b)).toBeCloseTo(0, 4);
    });

    test('findMostSimilarPair con vectores todos ortogonales → menor similitud cercana a 0', () => {
      const embeddings = [
        { id: 1, embedding: [1, 0, 0] },
        { id: 2, embedding: [0, 1, 0] },
        { id: 3, embedding: [0, 0, 1] },
      ];
      const result = findMostSimilarPair(embeddings);
      expect(result.similarity).toBeCloseTo(0, 4);
    });
  });
});
