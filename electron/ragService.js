/* global require, module */
const fs = require("fs");
const path = require("path");
const embeddingService = require("./embeddingService");

// Umbral: transcripciones menores a este valor no usan RAG
const MIN_TEXT_LENGTH_FOR_RAG = 8000; // ~2000 tokens

// Configuración de chunking
const DEFAULT_WINDOW_SECONDS = 15; // Reducido de 30s a 15s para mayor granularidad
const DEFAULT_OVERLAP_SECONDS = 5; // Reducido proporcionalmente
const MAX_EMBEDDING_CHARS = 1500; // Límite conservador para no exceder context length del modelo de embeddings

// Cache de conexiones LanceDB por path
const connectionCache = new Map();

/**
 * Parsea el contenido de transcripcion_combinada.txt en líneas estructuradas
 * Formato esperado: [HH:MM:SS - HH:MM:SS] emoji SPEAKER:\n   texto
 * @param {string} txtContent
 * @returns {Array<{ startTime: number, endTime: number, speaker: string, text: string, rawLine: string }>}
 */
function parseTranscriptionTxt(txtContent) {
  const lines = [];
  // Regex mejorado para soportar horas de 1 o 2 dígitos
  const lineRegex =
    /^\[(\d{1,2}):(\d{2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2}):(\d{2})\]\s*[^\s]+\s+(.+?):\s*$/;

  const rawLines = txtContent.split("\n");
  let currentEntry = null;

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const match = line.match(lineRegex);

    if (match) {
      // Guardar entrada anterior si existe
      if (currentEntry && currentEntry.text.trim()) {
        lines.push(currentEntry);
      }

      const startTime =
        parseInt(match[1]) * 3600 +
        parseInt(match[2]) * 60 +
        parseInt(match[3]);
      const endTime =
        parseInt(match[4]) * 3600 +
        parseInt(match[5]) * 60 +
        parseInt(match[6]);
      const speaker = match[7].trim();

      currentEntry = {
        startTime,
        endTime,
        speaker,
        text: "",
        rawLine: line,
      };
    } else if (currentEntry && line.trim()) {
      // Línea de texto del segmento actual
      currentEntry.text += (currentEntry.text ? " " : "") + line.trim();
      currentEntry.rawLine += "\n" + line;
    }
  }

  // No olvidar la última entrada
  if (currentEntry && currentEntry.text.trim()) {
    lines.push(currentEntry);
  }

  return lines;
}

/**
 * Agrupa líneas en chunks temporales con overlap
 * @param {Array} parsedLines - Resultado de parseTranscriptionTxt
 * @param {{ windowSeconds: number, overlapSeconds: number }} options
 * @returns {Array<{ chunkId: number, text: string, textDisplay: string, startTime: number, endTime: number, speakers: string }>}
 */
function createChunks(parsedLines, options = {}) {
  const windowSeconds = options.windowSeconds || DEFAULT_WINDOW_SECONDS;
  const overlapSeconds = options.overlapSeconds || DEFAULT_OVERLAP_SECONDS;

  if (parsedLines.length === 0) return [];

  const chunks = [];
  let chunkId = 0;
  let windowStart = parsedLines[0].startTime;

  while (windowStart < parsedLines[parsedLines.length - 1].endTime) {
    const windowEnd = windowStart + windowSeconds;

    // Seleccionar líneas que caen en esta ventana
    const chunkLines = parsedLines.filter(
      (line) => line.endTime > windowStart && line.startTime < windowEnd,
    );

    if (chunkLines.length > 0) {
      // Texto limpio para embedding (sin timestamps)
      const fullText = chunkLines
        .map((l) => `${l.speaker}: ${l.text}`)
        .join("\n");

      // Truncar texto para embedding si es necesario
      const text =
        fullText.length > MAX_EMBEDDING_CHARS
          ? fullText.substring(0, MAX_EMBEDDING_CHARS) + "..."
          : fullText;

      // Texto con timestamps para mostrar al LLM (completo, no truncado)
      const textDisplay = chunkLines.map((l) => l.rawLine).join("\n");

      // Speakers únicos
      const speakers = [...new Set(chunkLines.map((l) => l.speaker))].join(",");

      chunks.push({
        chunkId,
        text,
        textDisplay,
        startTime: chunkLines[0].startTime,
        endTime: chunkLines[chunkLines.length - 1].endTime,
        speakers,
      });

      chunkId++;
    }

    // Avanzar ventana con overlap
    windowStart += windowSeconds - overlapSeconds;
  }

  return chunks;
}

/**
 * Obtiene o crea una conexión LanceDB para un recording
 * @param {string} vectordbPath - Path al directorio vectordb/
 * @returns {Promise<object>} Conexión LanceDB
 */
async function getConnection(vectordbPath) {
  if (connectionCache.has(vectordbPath)) {
    return connectionCache.get(vectordbPath);
  }

  const lancedb = require("@lancedb/lancedb");
  const connection = await lancedb.connect(vectordbPath);
  connectionCache.set(vectordbPath, connection);
  return connection;
}

/**
 * Indexa una transcripción para RAG
 * @param {string} recordingPath - Path completo a la carpeta de la grabación
 * @returns {Promise<{ indexed: boolean, skippedRag: boolean, totalChunks: number, error?: string }>}
 */
async function indexRecording(recordingPath) {
  const analysisPath = path.join(recordingPath, "analysis");
  const txtPath = path.join(analysisPath, "transcripcion_combinada.txt");
  const vectordbPath = path.join(analysisPath, "vectordb");

  // Verificar que existe la transcripción
  if (!fs.existsSync(txtPath)) {
    return {
      indexed: false,
      skippedRag: false,
      totalChunks: 0,
      error: "No existe transcripcion_combinada.txt",
    };
  }

  // Leer transcripción
  const txtContent = await fs.promises.readFile(txtPath, "utf8");

  // Verificar longitud mínima
  if (txtContent.length < MIN_TEXT_LENGTH_FOR_RAG) {
    console.log(
      `[RAG] Transcripción corta (${txtContent.length} chars), skip RAG`,
    );
    return { indexed: false, skippedRag: true, totalChunks: 0 };
  }

  // Detectar provider de embeddings
  const provider = await embeddingService.detectEmbeddingProvider();
  if (!provider) {
    return {
      indexed: false,
      skippedRag: false,
      totalChunks: 0,
      error: "No hay provider de embeddings disponible (Ollama/LM Studio)",
    };
  }

  // Verificar/descargar modelo
  const modelReady = await embeddingService.ensureModel(provider);
  if (!modelReady) {
    return {
      indexed: false,
      skippedRag: false,
      totalChunks: 0,
      error: `No se pudo preparar el modelo ${embeddingService.DEFAULT_EMBEDDING_MODEL}`,
    };
  }

  // Parsear y crear chunks
  const parsedLines = parseTranscriptionTxt(txtContent);
  if (parsedLines.length === 0) {
    return {
      indexed: false,
      skippedRag: false,
      totalChunks: 0,
      error: "No se pudieron parsear segmentos de la transcripción",
    };
  }

  const chunks = createChunks(parsedLines);
  console.log(
    `[RAG] Creados ${chunks.length} chunks de ${parsedLines.length} segmentos`,
  );

  // Generar embeddings
  const texts = chunks.map((c) => c.text);
  console.log(`[RAG] Generando embeddings para ${texts.length} chunks...`);
  const vectors = await embeddingService.embedBatch(texts, provider);

  // Limpiar index anterior si existe
  if (fs.existsSync(vectordbPath)) {
    // Invalidar cache ANTES de borrar para evitar conexiones stale
    connectionCache.delete(vectordbPath);
    await fs.promises.rm(vectordbPath, { recursive: true, force: true });
    // Pequeño delay para asegurar que el FS libere los recursos
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  await fs.promises.mkdir(vectordbPath, { recursive: true });

  // Crear tabla en LanceDB con reintentos
  const data = chunks.map((chunk, i) => ({
    chunk_id: chunk.chunkId,
    text: chunk.text,
    text_display: chunk.textDisplay,
    start_time: chunk.startTime,
    end_time: chunk.endTime,
    speakers: chunk.speakers,
    vector: vectors[i],
  }));

  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      // Invalidar cache en cada intento
      connectionCache.delete(vectordbPath);

      const db = await getConnection(vectordbPath);
      await db.createTable("chunks", data, { mode: "overwrite" });

      // Crear índice FTS para búsqueda por palabras clave (no fatal si falla)
      try {
        const lancedb = require("@lancedb/lancedb");
        const tbl = await db.openTable("chunks");
        await tbl.createIndex("text", { config: lancedb.Index.fts() });
        console.log("[RAG] Índice FTS creado correctamente");
      } catch (ftsErr) {
        console.warn(
          "[RAG] No se pudo crear índice FTS (la búsqueda keyword estará deshabilitada):",
          ftsErr.message,
        );
      }

      console.log(
        `[RAG] Indexación completada: ${chunks.length} chunks en ${vectordbPath}`,
      );
      return { indexed: true, skippedRag: false, totalChunks: chunks.length };
    } catch (error) {
      lastError = error;
      console.warn(`[RAG] Intento ${attempt + 1}/3 fallido: ${error.message}`);
      if (attempt < 2) {
        await new Promise((resolve) =>
          setTimeout(resolve, 500 * (attempt + 1)),
        );
      }
    }
  }

  return {
    indexed: false,
    skippedRag: false,
    totalChunks: 0,
    error: lastError.message,
  };
}

/**
 * Busca chunks relevantes para una query
 * @param {string} recordingPath
 * @param {string} query
 * @param {number} topK
 * @returns {Promise<Array<{ chunkId: number, text: string, textDisplay: string, startTime: number, endTime: number, speakers: string, score: number }>>}
 */
async function searchRecording(recordingPath, query, topK = 10) {
  const vectordbPath = path.join(recordingPath, "analysis", "vectordb");

  if (!fs.existsSync(vectordbPath)) {
    return [];
  }
  console.log("[RAG] Buscando en:", vectordbPath);

  // Detectar provider
  const provider = await embeddingService.detectEmbeddingProvider();
  if (!provider) {
    throw new Error("No hay provider de embeddings disponible para búsqueda");
  }

  // Generar embedding de la query
  console.log(
    `[RAG] Buscando: "${query.substring(0, 100)}${query.length > 100 ? "..." : ""}" (topK=${topK})`,
  );
  const queryVector = await embeddingService.embed(query, provider);

  // Buscar en LanceDB
  const db = await getConnection(vectordbPath);

  let table;
  try {
    table = await db.openTable("chunks");
  } catch {
    console.warn("[RAG] Tabla chunks no encontrada");
    return [];
  }

  // --- 1. Búsqueda vectorial (semántica) ---
  const vectorRows = await table
    .search(queryVector)
    .limit(topK * 4)
    .toArray();

  // Construir map chunkId → chunk con score vectorial
  const chunkMap = new Map();
  for (const row of vectorRows) {
    const score = row._distance != null ? 1 / (1 + row._distance) : 0;
    if (score < 0.01) continue; // filtrar irrelevantes
    chunkMap.set(row.chunk_id, {
      chunkId: row.chunk_id,
      text: row.text,
      textDisplay: row.text_display,
      startTime: row.start_time,
      endTime: row.end_time,
      speakers: row.speakers,
      score,
    });
  }

  // --- 2. Búsqueda keyword (FTS) ---
  let keywordMatchCount = 0;
  try {
    const ftsRows = await table
      .search(query, "fts")
      .limit(topK * 2)
      .toArray();
    keywordMatchCount = ftsRows.length;
    for (const row of ftsRows) {
      if (chunkMap.has(row.chunk_id)) {
        // Boost: aparece en ambas búsquedas
        const existing = chunkMap.get(row.chunk_id);
        existing.score = Math.min(1, existing.score * 1.5);
      } else {
        // Match keyword puro (no aparecía en vector search): añadir con score alto
        chunkMap.set(row.chunk_id, {
          chunkId: row.chunk_id,
          text: row.text,
          textDisplay: row.text_display,
          startTime: row.start_time,
          endTime: row.end_time,
          speakers: row.speakers,
          score: 0.8,
        });
      }
    }
  } catch {
    // Si no hay índice FTS (grabaciones indexadas antes de esta versión), ignorar silenciosamente
  }

  // --- 3. Ordenar por score descendente ---
  const scoredResults = [...chunkMap.values()].sort(
    (a, b) => b.score - a.score,
  );

  // --- 4. Deduplicar chunks solapados temporalmente ---
  // Si dos chunks comparten más del 50% de su rango temporal, quedarse solo con el de mayor score
  const deduplicated = [];
  for (const candidate of scoredResults) {
    const overlapWithExisting = deduplicated.some((kept) => {
      const overlapStart = Math.max(candidate.startTime, kept.startTime);
      const overlapEnd = Math.min(candidate.endTime, kept.endTime);
      if (overlapEnd <= overlapStart) return false;
      const overlapDuration = overlapEnd - overlapStart;
      const candidateDuration = candidate.endTime - candidate.startTime || 1;
      return overlapDuration / candidateDuration > 0.5;
    });
    if (!overlapWithExisting) {
      deduplicated.push(candidate);
    }
    if (deduplicated.length >= topK) break;
  }

  const finalResults = deduplicated;

  console.log(
    `[RAG] Vectorial: ${vectorRows.length}, keyword: ${keywordMatchCount}, tras deduplicar: ${finalResults.length}`,
  );
  finalResults.forEach((r, i) => {
    const preview =
      r.text.length > 60 ? r.text.substring(0, 60) + "..." : r.text;
    console.log(
      `   [${i}] Chunk ${r.chunkId} (${formatTime(r.startTime)}-${formatTime(r.endTime)}) Score: ${r.score.toFixed(4)} - "${preview}"`,
    );
  });

  return finalResults;
}

/**
 * Formatea segundos a formato HH:MM:SS
 * @param {number} seconds
 * @returns {string}
 */
function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Obtiene el estado de indexación de un recording
 * @param {string} recordingPath
 * @returns {Promise<{ indexed: boolean, totalChunks: number }>}
 */
async function getStatus(recordingPath) {
  const vectordbPath = path.join(recordingPath, "analysis", "vectordb");

  if (!fs.existsSync(vectordbPath)) {
    return { indexed: false, totalChunks: 0 };
  }

  try {
    const db = await getConnection(vectordbPath);
    const table = await db.openTable("chunks");
    const count = await table.countRows();
    return { indexed: true, totalChunks: count };
  } catch {
    return { indexed: false, totalChunks: 0 };
  }
}

/**
 * Elimina el índice RAG de un recording
 * @param {string} recordingPath
 */
async function deleteIndex(recordingPath) {
  const vectordbPath = path.join(recordingPath, "analysis", "vectordb");
  connectionCache.delete(vectordbPath);

  if (fs.existsSync(vectordbPath)) {
    await fs.promises.rm(vectordbPath, { recursive: true, force: true });
    console.log(`[RAG] Índice eliminado: ${vectordbPath}`);
  }
}

module.exports = {
  parseTranscriptionTxt,
  createChunks,
  indexRecording,
  searchRecording,
  getStatus,
  deleteIndex,
};
