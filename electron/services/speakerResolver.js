/* global require, module */

/**
 * speakerResolver.js
 *
 * Servicio puro de resolución de etiquetas de hablantes.
 * Sustituye los tokens de diarización (`SPEAKER_XX`) por los nombres legibles
 * persistidos en la BD, sin modificar ningún archivo en disco.
 *
 * La función acepta el servicio de BD como parámetro (`db`) para facilitar
 * las pruebas unitarias con dobles de test.
 */

/**
 * Escapa los caracteres especiales de regex en una cadena.
 * @param {string} str
 * @returns {string}
 */
function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Reemplaza todas las etiquetas `SPEAKER_XX` presentes en el mapa de
 * resolución por sus nombres legibles (`display_name`).
 *
 * Contratos de comportamiento:
 * - Si `txtContent` es falsy (null, undefined, cadena vacía) → retorna tal cual.
 * - Si `db.getRecordingSpeakerResolutions` devuelve `null` o un mapa vacío →
 *   retorna `txtContent` sin cambios.
 * - Las claves del mapa se ordenan de mayor a menor longitud (longest-first)
 *   para evitar que una clave corta (ej. `SPEAKER_0`) anule la palabra límite
 *   de una clave más larga (ej. `SPEAKER_01`).
 * - El reemplazo es global y usa límite de palabra `\b` para no corromper
 *   tokens que contengan la clave como subtoken.
 * - Si ocurre cualquier error (ej. la BD lanza), se registra un aviso y se
 *   retorna el texto original sin propagar la excepción.
 * - El archivo en disco nunca es modificado.
 *
 * @param {number|string} recordingId  - ID numérico de la grabación en la BD.
 * @param {string} txtContent          - Contenido crudo de transcripcion_combinada.txt.
 * @param {object} db                  - Instancia de dbService inyectada.
 *   Debe exponer `getRecordingSpeakerResolutions(recordingId)` que retorna
 *   un objeto `{ [ephemeralId]: { speakerId, displayName } }` o `null`.
 * @returns {string} Texto con los tokens SPEAKER_XX sustituidos por sus
 *   nombres legibles; texto original en caso de mapa vacío/null o error.
 */
function resolveSpeakersInText(recordingId, txtContent, db) {
  // Guardia: texto vacío o falsy → devolver tal cual
  if (!txtContent) return txtContent;

  try {
    const resolutionMap = db.getRecordingSpeakerResolutions(recordingId);

    // Mapa nulo o vacío → sin resoluciones disponibles, devolver original
    if (!resolutionMap || Object.keys(resolutionMap).length === 0) {
      return txtContent;
    }

    // Ordenar claves de mayor a menor longitud (longest-first) para prevenir
    // que SPEAKER_0 reemplace el prefijo de SPEAKER_01
    const sortedKeys = Object.keys(resolutionMap).sort(
      (a, b) => b.length - a.length
    );

    let resolved = txtContent;
    for (const key of sortedKeys) {
      const displayName = resolutionMap[key]?.displayName;
      if (!displayName) continue;

      const pattern = new RegExp(escapeRegExp(key) + '\\b', 'g');
      resolved = resolved.replace(pattern, displayName);
    }

    return resolved;
  } catch (err) {
    console.warn(
      `[speakerResolver] No se pudo resolver hablantes para recordingId=${recordingId}:`,
      err.message
    );
    return txtContent;
  }
}

module.exports = { resolveSpeakersInText };
