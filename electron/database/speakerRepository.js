/**
 * speakerRepository.js
 *
 * Repositorio de hablantes: lógica de búsqueda por similitud coseno.
 * Actúa como capa de acceso a datos para el reconocimiento de hablantes,
 * independiente de la lógica de negocio de speakerManager.
 *
 * No utiliza librerías externas de álgebra (mathjs no está en el stack).
 * Implementa las operaciones vectoriales necesarias con JS puro.
 */

const dbService = require('./dbService');

// ── Helpers de álgebra vectorial ──────────────────────────────────────────────

/**
 * Producto punto entre dos vectores numéricos.
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number}
 */
function dotProduct(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

/**
 * Magnitud (norma L2) de un vector numérico.
 * @param {number[]} v
 * @returns {number}
 */
function magnitude(v) {
  let sumSq = 0;
  for (let i = 0; i < v.length; i++) {
    sumSq += v[i] * v[i];
  }
  return Math.sqrt(sumSq);
}

/**
 * Similitud coseno entre dos vectores numéricos.
 * Retorna un valor entre -1 y 1 (1 = idénticos, 0 = ortogonales, -1 = opuestos).
 * Retorna 0 si alguno de los vectores es el vector nulo.
 *
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number}
 */
function cosineSimilarity(a, b) {
  const magA = magnitude(a);
  const magB = magnitude(b);

  if (magA === 0 || magB === 0) return 0;

  return dotProduct(a, b) / (magA * magB);
}

/**
 * Calcula el promedio elemento a elemento de dos vectores y lo normaliza a longitud unitaria (L2 = 1).
 * Se usa cuando se alcanza el límite de embeddings por speaker y es necesario comprimir
 * dos embeddings muy similares en uno solo.
 *
 * @param {number[]} a - Primer vector.
 * @param {number[]} b - Segundo vector.
 * @returns {number[]} Vector promediado y normalizado.
 */
function averageEmbeddingPair(a, b) {
  if (!a || !b || a.length !== b.length) {
    throw new Error('[SpeakerRepository] averageEmbeddingPair: vectores inválidos o longitudes distintas.');
  }
  const dim = a.length;
  const averaged = new Array(dim);
  for (let i = 0; i < dim; i++) {
    averaged[i] = (a[i] + b[i]) / 2;
  }
  // Normalizar a longitud unitaria
  const mag = magnitude(averaged);
  if (mag > 1e-8) {
    for (let i = 0; i < dim; i++) {
      averaged[i] /= mag;
    }
  }
  return averaged;
}

/**
 * Busca el par de embeddings con la mayor similitud coseno entre sí.
 * Itera O(n²) sobre la lista de embeddings y retorna el par más similar.
 * n ≤ 40 por diseño (límite de embeddings por speaker), así que el coste es aceptable.
 *
 * @param {Array<{id: number, embedding: number[]}>} embeddings - Lista de embeddings con id y vector.
 * @returns {{ idxA: number, idxB: number, similarity: number }|null} Índice del primer embedding,
 *   índice del segundo embedding, y similitud del par. Null si menos de 2 embeddings.
 */
function findMostSimilarPair(embeddings) {
  if (!embeddings || embeddings.length < 2) return null;

  let bestIdxA = 0;
  let bestIdxB = 1;
  let bestSimilarity = -Infinity;

  for (let i = 0; i < embeddings.length; i++) {
    for (let j = i + 1; j < embeddings.length; j++) {
      const sim = cosineSimilarity(embeddings[i].embedding, embeddings[j].embedding);
      if (sim > bestSimilarity) {
        bestSimilarity = sim;
        bestIdxA = i;
        bestIdxB = j;
      }
    }
  }

  return { idxA: bestIdxA, idxB: bestIdxB, similarity: bestSimilarity };
}

// ── Serialización de embeddings ───────────────────────────────────────────────

/**
 * Convierte el valor del campo `embedding` (BLOB de SQLite) a un array de floats.
 *
 * El BLOB puede provenir de dos fuentes:
 *   1. JSON serializado como Buffer (e.g., Buffer de la cadena "[0.1, 0.2, ...]")
 *   2. Buffer binario Float32Array (little-endian, 4 bytes por float)
 *
 * @param {Buffer|Uint8Array|string} raw - Valor crudo del campo embedding.
 * @returns {number[]|null} Array de floats o null si no se puede parsear.
 */
function deserializeEmbedding(raw) {
  if (!raw) return null;

  try {
    // Caso 1: Buffer cuyo contenido es JSON ("[0.1, 0.2, ...]")
    if (Buffer.isBuffer(raw) || raw instanceof Uint8Array) {
      const str = Buffer.from(raw).toString('utf8').trim();
      if (str.startsWith('[')) {
        return JSON.parse(str);
      }

      // Caso 2: Buffer binario Float32Array (4 bytes por float, little-endian)
      if (raw.length % 4 === 0) {
        const floats = [];
        for (let i = 0; i < raw.length; i += 4) {
          floats.push(raw.readFloatLE(i));
        }
        return floats;
      }
    }

    // Caso 3: Ya es un string JSON (ej. columna TEXT en lugar de BLOB)
    if (typeof raw === 'string') {
      return JSON.parse(raw);
    }

    // Caso 4: Ya es un array (deserializado automáticamente por el driver)
    if (Array.isArray(raw)) {
      return raw;
    }
  } catch (e) {
    console.error('[SpeakerRepository] Error deserializando embedding:', e);
  }

  return null;
}

// ── API pública ───────────────────────────────────────────────────────────────

/**
 * Busca el hablante cuyo embedding almacenado es más similar al embedding
 * dado, siempre que la similitud coseno supere el umbral (threshold).
 *
 * Estrategia: se compara el embedding de entrada contra TODOS los embeddings
 * almacenados. Se selecciona el de mayor similitud. Si esa similitud supera
 * el threshold, se devuelve el speakerId correspondiente.
 *
 * Complejidad: O(n * d), donde n = nº de embeddings, d = dimensión del vector.
 * Adecuado para colecciones pequeñas/medianas en entorno desktop local.
 *
 * @param {number[]} embedding - Vector de características del hablante a identificar.
 * @param {number} [threshold=0.85] - Umbral mínimo de similitud (0-1). 
 *   Un valor más alto exige mayor parecido (menos falsos positivos).
 * @returns {{ speakerId: string, similarity: number }|null}
 *   El speakerId del hablante más parecido y su puntuación, o null si no hay match.
 */
function findMatchingSpeaker(embedding, threshold = 0.85) {
  if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
    console.warn('[SpeakerRepository] findMatchingSpeaker: embedding inválido o vacío.');
    return null;
  }

  let storedEmbeddings;
  try {
    storedEmbeddings = dbService.getAllSpeakerEmbeddings();
  } catch (e) {
    console.error('[SpeakerRepository] Error obteniendo embeddings de la BD:', e);
    return null;
  }

  if (!storedEmbeddings || storedEmbeddings.length === 0) {
    return null;
  }

  let bestMatch = null;
  let bestSimilarity = -Infinity;

  for (const row of storedEmbeddings) {
    const storedVector = deserializeEmbedding(row.embedding);

    if (!storedVector || storedVector.length === 0) {
      console.warn(`[SpeakerRepository] Embedding id=${row.id} no es válido, omitiendo.`);
      continue;
    }

    if (storedVector.length !== embedding.length) {
      console.warn(
        `[SpeakerRepository] Dimensión incompatible para embedding id=${row.id}: ` +
        `esperado=${embedding.length}, encontrado=${storedVector.length}. Omitiendo.`
      );
      continue;
    }

    const similarity = cosineSimilarity(embedding, storedVector);

    if (similarity > bestSimilarity) {
      bestSimilarity = similarity;
      bestMatch = { speakerId: row.speaker_id, similarity };
    }
  }

  if (bestMatch === null || bestSimilarity < threshold) {
    return null;
  }

  return bestMatch;
}

/**
 * Busca candidatos cuya similitud está entre `minThreshold` (inclusive) y
 * `maxThreshold` (exclusivo). Se usa para mostrar sugerencias de match al usuario.
 *
 * Devuelve los candidatos ordenados por similitud descendente, agrupados por
 * speaker_id (toma el mejor embedding de cada hablante).
 *
 * @param {number[]} embedding     - Vector del hablante a identificar.
 * @param {number}   [minThreshold=0.70] - Similitud mínima para ser sugerencia.
 * @param {number}   [maxThreshold=0.85] - Umbral a partir del cual ya sería match confirmado.
 * @returns {Array<{ speakerId: string, similarity: number }>}
 */
function findCandidateSpeakers(embedding, minThreshold = 0.70, maxThreshold = 0.85) {
  if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
    return [];
  }

  let storedEmbeddings;
  try {
    storedEmbeddings = dbService.getAllSpeakerEmbeddings();
  } catch (e) {
    console.error('[SpeakerRepository] Error en findCandidateSpeakers:', e);
    return [];
  }

  if (!storedEmbeddings || storedEmbeddings.length === 0) {
    return [];
  }

  // Mapa speakerId → mejor similitud encontrada
  const bestBySpeaker = new Map();

  for (const row of storedEmbeddings) {
    const storedVector = deserializeEmbedding(row.embedding);
    if (!storedVector || storedVector.length !== embedding.length) continue;

    const similarity = cosineSimilarity(embedding, storedVector);

    if (similarity >= minThreshold && similarity < maxThreshold) {
      const current = bestBySpeaker.get(row.speaker_id);
      if (current === undefined || similarity > current) {
        bestBySpeaker.set(row.speaker_id, similarity);
      }
    }
  }

  return Array.from(bestBySpeaker.entries())
    .map(([speakerId, similarity]) => ({ speakerId, similarity }))
    .sort((a, b) => b.similarity - a.similarity);
}

/**
 * Obtiene todos los embeddings de un hablante concreto, deserializados y listos para usar.
 *
 * @param {string} speakerId - UUID del hablante.
 * @returns {Array<{ id: number, speaker_id: string, embedding: number[], recording_id: number|null, created_at: string }>}
 */
function getEmbeddingsBySpeakerId(speakerId) {
  const rows = dbService.getEmbeddingsBySpeakerId(speakerId);
  return rows.map((row) => ({
    id: row.id,
    speaker_id: row.speaker_id,
    embedding: deserializeEmbedding(row.embedding),
    recording_id: row.recording_id,
    created_at: row.created_at,
  }));
}

module.exports = {
  findMatchingSpeaker,
  findCandidateSpeakers,
  getEmbeddingsBySpeakerId,
  averageEmbeddingPair,
  findMostSimilarPair,
  // Expuestos para pruebas unitarias o uso externo
  cosineSimilarity,
  dotProduct,
  magnitude,
  deserializeEmbedding,
};
