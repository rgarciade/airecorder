export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Determina si un `speakerResolution` permite edición de nombres y fusión de hablantes.
 *
 * Condiciones necesarias:
 *   1. El objeto existe y tiene entradas.
 *   2. El campo `_source` vale exactamente `'diarization'` — garantiza que los datos
 *      provienen de un `diarization.json` real con embeddings, no del fallback de segmentos.
 *   3. Todos los `speakerId` son UUIDs válidos (defensa en profundidad).
 *
 * Las grabaciones sin diarización activa reciben `_source: 'segments'` y se muestran
 * en modo solo lectura.
 *
 * @param {Object} speakerResolution
 * @returns {boolean}
 */
export function hasEditableSpeakerResolution(speakerResolution) {
  if (!speakerResolution || typeof speakerResolution !== 'object') {
    return false;
  }

  // Condición principal: el backend debe haber marcado explícitamente el origen
  if (speakerResolution._source !== 'diarization') {
    return false;
  }

  // Filtrar todas las claves de metadatos (prefijo '_')
  const entries = Object.entries(speakerResolution).filter(([key]) => !key.startsWith('_'));
  if (entries.length === 0) {
    return false;
  }

  // Defensa en profundidad: todos los speakerId deben ser UUIDs válidos
  return entries.every(([, resolution]) => {
    if (!resolution || typeof resolution !== 'object') {
      return false;
    }

    return typeof resolution.speakerId === 'string' && UUID_REGEX.test(resolution.speakerId);
  });
}
