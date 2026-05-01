/**
 * speakerManager.js
 *
 * Servicio de re-identificación de hablantes.
 *
 * Responsabilidades:
 *   - Recibir el mapa `speaker_embeddings` producido por `diarization_analyzer.py`
 *     (formato: `{ "SPEAKER_00": [float, ...], "SPEAKER_01": [float, ...] }`).
 *   - Para cada hablante efímero, intentar hacer match con un perfil persistente
 *     usando `speakerRepository.findMatchingSpeaker` (similitud coseno).
 *   - Si hay match: retornar el UUID persistente del hablante.
 *   - Si no hay match: crear un nuevo perfil en la BD con alias "Speaker_XX" y
 *     guardar el embedding.
 *   - Devolver un mapa de traducción `{ "SPEAKER_00": { speakerId, displayName, isNew } }`.
 *   - Incluir `pendingSuggestions` con candidatos cercanos al umbral para revisión manual.
 *
 * Este servicio NO modifica el JSON de transcripción directamente; esa responsabilidad
 * recae en el handler IPC que lo consume.
 *
 * IDEMPOTENCIA: la resolución se persiste en `recording_speaker_resolutions`. Las
 * aperturas posteriores de la misma grabación leen de BD sin recalcular embeddings.
 */

const speakerRepository = require('../database/speakerRepository');
const dbService = require('../database/dbService');

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Genera un alias legible para un hablante nuevo basado en el índice de creación.
 * Ejemplo: 0 → "Speaker_01", 1 → "Speaker_02"
 * @param {number} index - Índice de la posición del hablante en la sesión actual (0-based).
 * @returns {string}
 */
function generateAlias(index) {
  const padded = String(index + 1).padStart(2, '0');
  return `Speaker_${padded}`;
}

/**
 * Serializa un array de floats a Buffer JSON para almacenarlo como BLOB en SQLite.
 * @param {number[]} embedding
 * @returns {Buffer}
 */
function serializeEmbedding(embedding) {
  return Buffer.from(JSON.stringify(embedding), 'utf8');
}

// ── Constantes de filtrado de embeddings ───────────────────────────────────────

const MAX_EMBEDDINGS_PER_SPEAKER = 40;
const DUPLICATE_SIMILARITY_THRESHOLD = 0.99;

// ── Helpers de filtrado de calidad ────────────────────────────────────────────

/**
 * Filtra un embedding nuevo aplicando las reglas de calidad.
 *
 * 1. Duplicado: si sim > 0.99 con algún embedding existente → descartar.
 * 2. Límite: si count >= 40 → promediar el par más similar y comprimir.
 *
 * @param {number[]} newEmbedding - Embedding entrante (192 dims).
 * @param {string} speakerId - UUID del hablante.
 * @returns {{ accepted: boolean, reason?: string, averagedEmbedding?: number[] }}
 */
function filterAndCompressEmbeddings(newEmbedding, speakerId) {
  const existing = speakerRepository.getEmbeddingsBySpeakerId(speakerId);
  const existingCount = existing.length;

  console.log(
    `[EmbeddingFilter] Iniciando filtro: speakerId=${speakerId}, ` +
    `embeddings existentes=${existingCount}, nuevo embedding dims=${newEmbedding.length}`
  );

  // Regla 1: duplicado — descartar sin guardar
  let maxSim = -Infinity;
  let maxSimEmbId = null;
  for (const existingEmb of existing) {
    const sim = speakerRepository.cosineSimilarity(newEmbedding, existingEmb.embedding);
    if (sim > maxSim) {
      maxSim = sim;
      maxSimEmbId = existingEmb.id;
    }
    if (sim > DUPLICATE_SIMILARITY_THRESHOLD) {
      console.log(
        `[EmbeddingFilter] DUPLICADO DESCARTADO: speakerId=${speakerId}, ` +
        `sim=${sim.toFixed(4)} con embedding_id=${existingEmb.id} (umbral=${DUPLICATE_SIMILARITY_THRESHOLD})`
      );
      return {
        accepted: false,
        reason: `sim=${sim.toFixed(4)} > ${DUPLICATE_SIMILARITY_THRESHOLD}`,
      };
    }
  }

  console.log(
    `[EmbeddingFilter] SIN DUPLICADOS: sim máxima=${maxSim.toFixed(4)} con embedding_id=${maxSimEmbId}`
  );

  // Regla 2: límite — comprimir si es necesario
  if (existingCount >= MAX_EMBEDDINGS_PER_SPEAKER) {
    console.log(
      `[EmbeddingFilter] LÍMITE ALCANZADO: ${existingCount} >= ${MAX_EMBEDDINGS_PER_SPEAKER}, ` +
      `buscando par más similar para comprimir...`
    );

    const pair = speakerRepository.findMostSimilarPair(existing);
    if (pair) {
      const [olderEmb, newerEmb] =
        existing[pair.idxA].id < existing[pair.idxB].id
          ? [existing[pair.idxA], existing[pair.idxB]]
          : [existing[pair.idxB], existing[pair.idxA]];

      console.log(
        `[EmbeddingFilter] PAR ENCONTRADO: ids=[${olderEmb.id}, ${newerEmb.id}], ` +
        `sim=${pair.similarity.toFixed(4)}, eliminando id=${olderEmb.id}`
      );

      const averaged = speakerRepository.averageEmbeddingPair(
        existing[pair.idxA].embedding,
        existing[pair.idxB].embedding
      );

      const deleteResult = dbService.deleteSpeakerEmbedding(olderEmb.id);
      if (!deleteResult.success) {
        console.error(
          `[EmbeddingFilter] ERROR eliminando embedding antiguo: ${deleteResult.error}`
        );
      }

      const newBlob = serializeEmbedding(averaged);
      const saveResult = dbService.saveSpeakerEmbedding(speakerId, newBlob, newerEmb.recording_id);
      if (!saveResult.success) {
        console.error(
          `[EmbeddingFilter] ERROR guardando embedding promediado: ${saveResult.error}`
        );
      }

      console.log(
        `[EmbeddingFilter] COMPRESIÓN EXITOSA: id ${olderEmb.id} eliminado, ` +
        `nuevo promedio guardado, count ${existingCount}→${existingCount - 1}`
      );
    } else {
      console.warn(
        `[EmbeddingFilter] No se encontró par similar para comprimir (count=${existingCount})`
      );
    }
  }

  console.log(
    `[EmbeddingFilter] EMBEDDING ACEPTADO: speakerId=${speakerId}, count actual=${existingCount}`
  );
  return { accepted: true };
}

// ── API pública ────────────────────────────────────────────────────────────────

/**
 * Procesa el mapa `speaker_embeddings` de la diarización y devuelve un mapa
 * de resolución que asocia cada ID efímero con un perfil persistente.
 *
 * IDEMPOTENCIA: si la grabación ya fue resuelta anteriormente (existe en
 * `recording_speaker_resolutions`), se devuelve el mapa almacenado sin
 * recalcular embeddings. Esto garantiza que múltiples aperturas de la misma
 * transcripción no creen perfiles duplicados.
 *
 * @param {Object} speakerEmbeddings - Mapa `{ ephemeralId: number[] }`.
 *   Ej: `{ "SPEAKER_00": [0.12, -0.03, ...], "SPEAKER_01": [...] }`
 * @param {number|null} [recordingId=null] - ID numérico de la grabación de origen.
 * @param {number} [threshold=0.85] - Umbral de similitud coseno para considerar match.
 * @returns {{
 *   resolutionMap: Object,
 *   pendingSuggestions: Array<{
 *     ephemeralId: string,
 *     candidateSpeakerId: string,
 *     candidateDisplayName: string,
 *     similarity: number,
 *     firstSegmentStart: number|null
 *   }>
 * }}
 */
function processEmbeddings(speakerEmbeddings, recordingId = null, threshold = 0.85) {
  if (!speakerEmbeddings || typeof speakerEmbeddings !== 'object') {
    console.warn('[SpeakerManager] processEmbeddings: speakerEmbeddings inválido o vacío.');
    return { resolutionMap: {}, pendingSuggestions: [] };
  }

  const entries = Object.entries(speakerEmbeddings);

  if (entries.length === 0) {
    return { resolutionMap: {}, pendingSuggestions: [] };
  }

  // ── Idempotencia: ¿ya resolvimos esta grabación? ──────────────────────────
  if (recordingId != null) {
    const cached = dbService.getRecordingSpeakerResolutions(recordingId);
    if (cached && Object.keys(cached).length === entries.length) {
      // Todas las entradas ya están resueltas — devolver cache sin pendingSuggestions
      console.log(
        `[SpeakerManager] Resolución cargada desde BD para recording=${recordingId}:`,
        Object.entries(cached).map(([k, v]) => `${k} → ${v.displayName}`).join(', ')
      );
      return { resolutionMap: cached, pendingSuggestions: [] };
    }
  }

  // ── Primera vez (o resolución parcial): procesar embeddings ──────────────
  const resolutionMap = {};
  const pendingSuggestions = [];
  let newSpeakerIndex = 0;

  for (const [ephemeralId, embedding] of entries) {
    if (!Array.isArray(embedding) || embedding.length === 0) {
      console.warn(`[SpeakerManager] Embedding inválido para ${ephemeralId}, omitiendo.`);
      continue;
    }

    // Si ya estaba parcialmente cacheado, reutilizar
    if (recordingId != null) {
      const cached = dbService.getRecordingSpeakerResolutions(recordingId);
      if (cached && cached[ephemeralId]) {
        resolutionMap[ephemeralId] = cached[ephemeralId];
        continue;
      }
    }

    try {
      // 1. Intentar encontrar un hablante ya conocido por encima del umbral
      const match = speakerRepository.findMatchingSpeaker(embedding, threshold);

      if (match) {
        const speaker = dbService.db
          ? dbService.db.prepare('SELECT * FROM speakers WHERE id = ?').get(match.speakerId)
          : null;

        if (speaker) {
          resolutionMap[ephemeralId] = {
            speakerId: speaker.id,
            displayName: speaker.display_name,
            isNew: false,
          };
          // Guardar la resolución en BD para futuras aperturas
          if (recordingId != null) {
            dbService.upsertRecordingSpeakerResolution(recordingId, ephemeralId, speaker.id);
            // Enriquecer el perfil con el embedding de esta grabación para mejorar
            // el reconocimiento futuro (el perfil aprende de cada sesión nueva)
            const filterResult = filterAndCompressEmbeddings(embedding, speaker.id);
            if (!filterResult.accepted) {
              console.log(
                `[EmbeddingFilter] Embedding DESCARTADO para "${speaker.display_name}" ` +
                `(speakerId=${speaker.id}): ${filterResult.reason}`
              );
            } else {
              const embeddingBlob = serializeEmbedding(embedding);
              const embedResult = dbService.saveSpeakerEmbedding(speaker.id, embeddingBlob, recordingId);
              if (!embedResult.success) {
                console.warn(
                  `[EmbeddingFilter] ERROR guardando embedding para "${speaker.display_name}": ` +
                  `${embedResult.error}`
                );
              } else {
                console.log(
                  `[EmbeddingFilter] Embedding GUARDADO para "${speaker.display_name}" ` +
                  `(speakerId=${speaker.id}, recordingId=${recordingId})`
                );
              }
            }
          }
          console.log(
            `[SpeakerManager] ${ephemeralId} → hablante conocido "${speaker.display_name}" ` +
            `(UUID: ${speaker.id}, similitud: ${match.similarity.toFixed(3)}) — embedding enriquecido`
          );
        } else {
          // Inconsistencia: match en speaker_embeddings pero sin perfil — crear nuevo
          console.warn(
            `[SpeakerManager] Match encontrado para ${ephemeralId} (${match.speakerId}) ` +
            `pero no existe perfil en speakers. Creando perfil nuevo.`
          );
          const created = _createNewSpeaker(ephemeralId, embedding, recordingId, newSpeakerIndex);
          if (created) {
            resolutionMap[ephemeralId] = created;
            if (recordingId != null) {
              dbService.upsertRecordingSpeakerResolution(recordingId, ephemeralId, created.speakerId);
            }
            newSpeakerIndex++;
          }
        }
      } else {
        // 2. No hay match confirmado — buscar candidatos cercanos para sugerencia
        const candidates = speakerRepository.findCandidateSpeakers(embedding, 0.70, threshold);
        if (candidates.length > 0) {
          const best = candidates[0];
          const candidateSpeaker = dbService.db
            ? dbService.db.prepare('SELECT * FROM speakers WHERE id = ?').get(best.speakerId)
            : null;
          if (candidateSpeaker) {
            pendingSuggestions.push({
              ephemeralId,
              candidateSpeakerId: candidateSpeaker.id,
              candidateDisplayName: candidateSpeaker.display_name,
              similarity: best.similarity,
              firstSegmentStart: null, // se enriquece en recordings.js
            });
            console.log(
              `[SpeakerManager] ${ephemeralId} → sugerencia "${candidateSpeaker.display_name}" ` +
              `(similitud: ${best.similarity.toFixed(3)}, por debajo del umbral ${threshold})`
            );
          }
        }

        // 3. Hablante desconocido: crear perfil nuevo
        const created = _createNewSpeaker(ephemeralId, embedding, recordingId, newSpeakerIndex);
        if (created) {
          resolutionMap[ephemeralId] = created;
          if (recordingId != null) {
            dbService.upsertRecordingSpeakerResolution(recordingId, ephemeralId, created.speakerId);
          }
          newSpeakerIndex++;
        }
      }
    } catch (err) {
      console.error(`[SpeakerManager] Error procesando ${ephemeralId}:`, err);
    }
  }

  return { resolutionMap, pendingSuggestions };
}

/**
 * (Interno) Crea un nuevo perfil de hablante en la BD y guarda su embedding.
 *
 * @param {string} ephemeralId - ID efímero (ej. "SPEAKER_00").
 * @param {number[]} embedding - Vector de características.
 * @param {number|null} recordingId - ID de grabación de origen.
 * @param {number} aliasIndex - Índice para generar el alias (0-based).
 * @returns {{ speakerId, displayName, isNew }|null}
 */
function _createNewSpeaker(ephemeralId, embedding, recordingId, aliasIndex) {
  const alias = generateAlias(aliasIndex);

  const speaker = dbService.createSpeaker(alias);
  if (!speaker) {
    console.error(`[SpeakerManager] No se pudo crear el perfil del hablante para ${ephemeralId}.`);
    return null;
  }

  // Aplicar filtro de calidad (duplicados + límite por speaker)
  const filterResult = filterAndCompressEmbeddings(embedding, speaker.id);
  if (!filterResult.accepted) {
    console.log(
      `[EmbeddingFilter] Embedding DESCARTADO para nuevo hablante "${alias}" ` +
      `(speakerId=${speaker.id}): ${filterResult.reason}`
    );
  } else {
    const embeddingBlob = serializeEmbedding(embedding);
    const embedResult = dbService.saveSpeakerEmbedding(speaker.id, embeddingBlob, recordingId);
    if (!embedResult.success) {
      console.error(
        `[EmbeddingFilter] ERROR guardando embedding para nuevo hablante "${alias}": ` +
        `${embedResult.error}`
      );
    } else {
      console.log(
        `[EmbeddingFilter] Embedding GUARDADO para nuevo hablante "${alias}" ` +
        `(speakerId=${speaker.id})`
      );
    }
  }

  console.log(
    `[SpeakerManager] ${ephemeralId} → nuevo hablante "${alias}" (UUID: ${speaker.id})`
  );

  return {
    speakerId: speaker.id,
    displayName: speaker.display_name || alias,
    isNew: true,
  };
}

/**
 * Persiste un alias personalizado para un hablante y opcionalmente asocia un embedding.
 * Se usa cuando el usuario asigna un nombre desde el frontend.
 *
 * @param {string|null} speakerId - UUID actual del hablante en la transcripción.
 * @param {string} alias - Nombre personalizado o nombre de un hablante existente.
 * @param {number[]|null} [embedding=null] - Embedding actualizado (opcional).
 * @param {number|null} [recordingId=null] - ID de grabación de origen del embedding.
 * @param {string|null} [ephemeralId=null] - ID efímero de la transcripción actual.
 * @returns {{ success: boolean, speakerId?: string, displayName?: string, error?: string }}
 */
function assignAlias(speakerId, alias, embedding = null, recordingId = null, ephemeralId = null) {
  if (!alias || typeof alias !== 'string' || alias.trim() === '') {
    return { success: false, error: 'El alias es obligatorio.' };
  }

  try {
    if (!dbService.db) {
      return { success: false, error: 'Base de datos no inicializada.' };
    }

    const trimmedAlias = alias.trim();
    const currentSpeaker = speakerId
      ? dbService.db.prepare('SELECT * FROM speakers WHERE id = ?').get(speakerId)
      : null;
    const existingByAlias = dbService.getSpeakerByAlias(trimmedAlias);

    let targetSpeaker = null;

    if (existingByAlias) {
      targetSpeaker = existingByAlias;
    } else if (currentSpeaker) {
      dbService.db
        .prepare('UPDATE speakers SET display_name = ? WHERE id = ?')
        .run(trimmedAlias, currentSpeaker.id);
      targetSpeaker = dbService.db.prepare('SELECT * FROM speakers WHERE id = ?').get(currentSpeaker.id);
    } else {
      targetSpeaker = dbService.createSpeaker(trimmedAlias);
    }

    if (!targetSpeaker) {
      return { success: false, error: 'No se pudo resolver el hablante destino.' };
    }

    const targetSpeakerId = targetSpeaker.id;

    if (recordingId != null) {
      const recordingExists = dbService.db
        .prepare('SELECT 1 FROM recordings WHERE id = ? LIMIT 1')
        .get(recordingId);
      if (!recordingExists) {
        return { success: false, error: `La grabación ${recordingId} no existe en BD.` };
      }
    }

    const targetSpeakerExists = dbService.db
      .prepare('SELECT 1 FROM speakers WHERE id = ? LIMIT 1')
      .get(targetSpeakerId);
    if (!targetSpeakerExists) {
      return { success: false, error: `El speaker destino ${targetSpeakerId} no existe en BD.` };
    }

    const transaction = dbService.db.transaction(() => {
      if (recordingId != null && ephemeralId) {
        const upsert = dbService.upsertRecordingSpeakerResolution(recordingId, ephemeralId, targetSpeakerId);
        if (!upsert.success) {
          throw new Error(upsert.error || 'No se pudo persistir la resolución.');
        }
      }

      if (speakerId && speakerId !== targetSpeakerId) {
        const reassignEmbeddings = dbService.reassignSpeakerEmbeddings(speakerId, targetSpeakerId);
        if (!reassignEmbeddings.success) {
          throw new Error(reassignEmbeddings.error || 'No se pudieron reasignar embeddings.');
        }

        const reassignResolutions = dbService.reassignRecordingSpeakerResolutions(speakerId, targetSpeakerId);
        if (!reassignResolutions.success) {
          throw new Error(reassignResolutions.error || 'No se pudieron reasignar resoluciones.');
        }

        const deleteCurrent = dbService.deleteSpeaker(speakerId);
        if (!deleteCurrent.success) {
          throw new Error(deleteCurrent.error || 'No se pudo eliminar el perfil anterior.');
        }
      }

      if (embedding && Array.isArray(embedding) && embedding.length > 0) {
        const embeddingBlob = serializeEmbedding(embedding);
        const embedResult = dbService.saveSpeakerEmbedding(targetSpeakerId, embeddingBlob, recordingId);
        if (!embedResult.success) {
          console.warn(`[SpeakerManager] Alias guardado pero no el embedding: ${embedResult.error}`);
        }
      }
    });

    transaction();

    console.log(
      `[SpeakerManager] Alias/resolución actualizada: ${ephemeralId || 'sin-ephemeral'} ` +
      `→ "${targetSpeaker.display_name}" (UUID: ${targetSpeakerId})`
    );
    return { success: true, speakerId: targetSpeakerId, displayName: targetSpeaker.display_name };
  } catch (err) {
    console.error('[SpeakerManager] Error en assignAlias:', err);
    return { success: false, error: err.message || String(err) };
  }
}

/**
 * Genera un mapa de resolución de hablantes a partir de los segmentos de la
 * transcripción cuando NO existe un `diarization.json` con embeddings.
 *
 * Esto ocurre cuando la diarización no estaba activa (sin token HF) o cuando
 * los segmentos fueron asignados directamente por `audio_sync_analyzer.py`
 * con nombres fijos como "USUARIO", "SISTEMA" o "SPEAKER_XX".
 *
 * Para cada ID de hablante único en los segmentos:
 *   1. Busca si ya existe un perfil con ese display_name en la BD.
 *   2. Si no existe, crea un perfil nuevo usando el propio ID como alias inicial.
 *   3. Devuelve el mapa de resolución con UUIDs persistentes.
 *
 * @param {Array<{speaker: string}>} segments - Segmentos de la transcripción.
 * @param {number|null} [recordingId=null] - ID numérico de la grabación.
 * @returns {Object} Mapa `{ ephemeralId: { speakerId, displayName, isNew } }`.
 */
function resolveFromSegments(segments, recordingId = null) {
  if (!Array.isArray(segments) || segments.length === 0) {
    return {};
  }

  // Si la grabación ya tiene resoluciones persistidas, la BD es la fuente de verdad.
  // Esto es especialmente importante para grabaciones sin speaker_embeddings donde
  // el usuario pudo haber remapeado "SISTEMA" / "SPEAKER_03" a un hablante real.
  if (recordingId != null) {
    const cached = dbService.getRecordingSpeakerResolutions(recordingId);
    if (cached && Object.keys(cached).length > 0) {
      return cached;
    }
  }

  // Recopilar IDs únicos de hablante que aparecen en los segmentos.
  // Filtrar labels placeholder que no representan hablantes reales:
  //   - "SISTEMA": marcador de canal de audio, no un hablante.
  //   - "USUARIO": se mantiene porque puede ser útil para el micrófono.
  const PLACEHOLDER_SPEAKERS = new Set(['SISTEMA', 'sistema', 'SYSTEM', 'system']);
  const uniqueSpeakerIds = [...new Set(
    segments
      .map((s) => s.speaker)
      .filter((id) => typeof id === 'string' && id.trim() !== '' && !PLACEHOLDER_SPEAKERS.has(id))
  )];

  if (uniqueSpeakerIds.length === 0) {
    return {};
  }

  const resolutionMap = {};

  for (const ephemeralId of uniqueSpeakerIds) {
    try {
      // 1. Buscar por alias exacto en BD
      const existing = dbService.getSpeakerByAlias(ephemeralId);

      if (existing) {
        resolutionMap[ephemeralId] = {
          speakerId: existing.id,
          displayName: existing.display_name,
          isNew: false,
        };

        // Persistir relación recording↔speaker también en flujos sin embeddings
        // (p. ej. conversation-import) para que aparezca en el detalle de grabaciones.
        if (recordingId != null) {
          dbService.upsertRecordingSpeakerResolution(recordingId, ephemeralId, existing.id);
        }

        console.log(
          `[SpeakerManager] ${ephemeralId} → perfil existente "${existing.display_name}" (UUID: ${existing.id})`
        );
      } else {
        // 2. Crear perfil nuevo usando el ephemeralId como alias inicial
        const speaker = dbService.createSpeaker(ephemeralId);
        if (!speaker) {
          console.error(`[SpeakerManager] No se pudo crear perfil para "${ephemeralId}".`);
          continue;
        }

        resolutionMap[ephemeralId] = {
          speakerId: speaker.id,
          displayName: speaker.display_name || ephemeralId,
          isNew: true,
        };

        // Persistir relación recording↔speaker también en flujos sin embeddings.
        if (recordingId != null) {
          dbService.upsertRecordingSpeakerResolution(recordingId, ephemeralId, speaker.id);
        }

        console.log(
          `[SpeakerManager] ${ephemeralId} → nuevo perfil creado (UUID: ${speaker.id})`
        );
      }
    } catch (err) {
      console.error(`[SpeakerManager] Error resolviendo "${ephemeralId}" desde segmentos:`, err);
    }
  }

  return resolutionMap;
}

/**
 * Fusiona múltiples perfiles de hablante en uno solo.
 *
 * Flujo:
 *   1. Obtiene los speakerIds de cada ephemeralId desde el mapa de resolución.
 *   2. Elige el "ganador" (primer speakerId válido encontrado, o crea uno nuevo).
 *   3. Actualiza el alias del ganador.
 *   4. Reasigna todos los embeddings de los perfiles "perdedores" al ganador.
 *   5. Elimina los perfiles perdedores (sus embeddings ya fueron reasignados).
 *
 * @param {string[]} sourceEphemeralIds  - IDs efímeros seleccionados para fusionar.
 * @param {Object}   speakersMap         - Mapa Redux ephemeralId → { speakerId, displayName }.
 * @param {string}   targetAlias         - Nombre unificado del hablante resultante.
 * @returns {{ success: boolean, targetSpeakerId?: string, displayName?: string, error?: string }}
 */
function mergeSpeakers(sourceEphemeralIds, speakersMap, targetAlias) {
  if (!Array.isArray(sourceEphemeralIds) || sourceEphemeralIds.length < 2) {
    return { success: false, error: 'Se necesitan al menos 2 hablantes para fusionar.' };
  }
  if (!targetAlias || typeof targetAlias !== 'string' || !targetAlias.trim()) {
    return { success: false, error: 'El alias destino es obligatorio.' };
  }

  const trimmedAlias = targetAlias.trim();

  // Recopilar speakerIds válidos (únicos) de los ephemeralIds seleccionados
  const allSpeakerIds = [...new Set(
    sourceEphemeralIds
      .map((id) => speakersMap?.[id]?.speakerId)
      .filter((sid) => typeof sid === 'string' && sid.trim() !== '')
  )];

  if (allSpeakerIds.length === 0) {
    return { success: false, error: 'No se encontraron perfiles persistentes para los hablantes seleccionados.' };
  }

  // El primer speakerId es el "ganador"; el resto son "perdedores"
  const [winnerId, ...loserIds] = allSpeakerIds;

  try {
    // 1. Actualizar alias del ganador
    if (!dbService.db) {
      return { success: false, error: 'Base de datos no inicializada.' };
    }
    dbService.db
      .prepare('UPDATE speakers SET display_name = ? WHERE id = ?')
      .run(trimmedAlias, winnerId);

    // 2. Reasignar embeddings de cada perdedor al ganador y eliminar el perfil
    for (const loserId of loserIds) {
      const reassign = dbService.reassignSpeakerEmbeddings(loserId, winnerId);
      if (!reassign.success) {
        console.warn(`[SpeakerManager] No se pudieron reasignar embeddings de ${loserId}: ${reassign.error}`);
      } else {
        console.log(`[SpeakerManager] Embeddings reasignados: ${loserId} → ${winnerId} (${reassign.changes} filas)`);
      }

      const del = dbService.deleteSpeaker(loserId);
      if (!del.success) {
        console.warn(`[SpeakerManager] No se pudo eliminar perfil ${loserId}: ${del.error}`);
      } else {
        console.log(`[SpeakerManager] Perfil eliminado: ${loserId}`);
      }
    }

    console.log(`[SpeakerManager] Fusión completada → ganador "${trimmedAlias}" (${winnerId}), absorbidos: [${loserIds.join(', ')}]`);
    return { success: true, targetSpeakerId: winnerId, displayName: trimmedAlias };
  } catch (err) {
    console.error('[SpeakerManager] Error en mergeSpeakers:', err);
    return { success: false, error: err.message || String(err) };
  }
}

/**
 * Confirma una sugerencia de match de hablante.
 * Actualiza la tabla recording_speaker_resolutions y reasigna el embedding
 * del hablante nuevo al perfil confirmado, eliminando el perfil temporal.
 *
 * @param {number} recordingId
 * @param {string} ephemeralId         - ID efímero (ej. "SPEAKER_00")
 * @param {string} confirmedSpeakerId  - UUID del hablante confirmado por el usuario
 * @param {string} currentSpeakerId    - UUID temporal asignado al crear el perfil nuevo
 * @returns {{ success: boolean, displayName?: string, error?: string }}
 */
function confirmSpeakerSuggestion(recordingId, ephemeralId, confirmedSpeakerId, currentSpeakerId) {
  try {
    if (!dbService.db) return { success: false, error: 'DB no inicializada.' };

    // 1. Obtener el display_name del hablante confirmado
    const confirmedSpeaker = dbService.db
      .prepare('SELECT * FROM speakers WHERE id = ?')
      .get(confirmedSpeakerId);
    if (!confirmedSpeaker) {
      return { success: false, error: `No existe el hablante confirmado: ${confirmedSpeakerId}` };
    }

    // 2. Reasignar embeddings del perfil temporal al confirmado (si son distintos)
    if (currentSpeakerId && currentSpeakerId !== confirmedSpeakerId) {
      dbService.reassignSpeakerEmbeddings(currentSpeakerId, confirmedSpeakerId);
      dbService.reassignRecordingSpeakerResolutions(currentSpeakerId, confirmedSpeakerId);
      dbService.deleteSpeaker(currentSpeakerId);
    }

    // 3. Actualizar la tabla de resolución persistente
    dbService.upsertRecordingSpeakerResolution(recordingId, ephemeralId, confirmedSpeakerId);

    console.log(
      `[SpeakerManager] Sugerencia confirmada: ${ephemeralId} → "${confirmedSpeaker.display_name}" ` +
      `(UUID: ${confirmedSpeakerId})`
    );
    return { success: true, displayName: confirmedSpeaker.display_name };
  } catch (err) {
    console.error('[SpeakerManager] Error en confirmSpeakerSuggestion:', err);
    return { success: false, error: err.message || String(err) };
  }
}

module.exports = {
  processEmbeddings,
  resolveFromSegments,
  assignAlias,
  mergeSpeakers,
  confirmSpeakerSuggestion,
  // Expuesto para pruebas unitarias
  generateAlias,
  serializeEmbedding,
};
