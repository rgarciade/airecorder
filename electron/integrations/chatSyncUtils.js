/**
 * Utilidades compartidas para convertir mensajes de chat externo
 * al formato canónico de transcripción de AIRecorder.
 *
 * Formato requerido por el RAG (regex en ragService.js):
 *   [H:MM:SS - H:MM:SS] emoji SPEAKER:
 *      texto del mensaje
 */

const SPEAKER_EMOJIS = ['🟦', '🟩', '🟨', '🟥', '🟪', '🟧', '⬛', '🔵', '🟤', '⚫'];

/**
 * Convierte segundos a formato "H:MM:SS"
 */
function formatTime(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Devuelve un emoji consistente para un speaker dado.
 * @param {string} speaker
 * @param {Map<string, string>} emojiMap  mapa mutable speaker→emoji
 */
function speakerEmoji(speaker, emojiMap) {
  if (!emojiMap.has(speaker)) {
    const idx = emojiMap.size % SPEAKER_EMOJIS.length;
    emojiMap.set(speaker, SPEAKER_EMOJIS[idx]);
  }
  return emojiMap.get(speaker);
}

/**
 * Construye transcripcion_combinada.txt a partir de un array de segmentos normalizados.
 * @param {Array<{start: number, end: number, speaker: string, text: string}>} segments
 * @returns {string}
 */
function buildTranscriptionTxt(segments) {
  const emojiMap = new Map();
  return segments.map(seg => {
    const emoji = speakerEmoji(seg.speaker, emojiMap);
    return `[${formatTime(seg.start)} - ${formatTime(seg.end)}] ${emoji} ${seg.speaker}:\n   ${seg.text}`;
  }).join('\n\n');
}

/**
 * Construye transcripcion_combinada.json (array de objetos compatibles con el sistema).
 * @param {Array<{start: number, end: number, speaker: string, text: string}>} segments
 * @returns {Array}
 */
function buildTranscriptionJson(segments) {
  const emojiMap = new Map();
  return segments.map((seg, i) => ({
    id: i,
    start: seg.start,
    end: seg.end,
    speaker: seg.speaker,
    text: seg.text,
    emoji: speakerEmoji(seg.speaker, emojiMap)
  }));
}

/**
 * Asigna timestamps relativos artificiales (3s por mensaje) a partir del offset dado.
 * @param {Array<{speaker: string, text: string}>} messages  — sin timestamps
 * @param {number} startOffset  segundos de offset inicial (para sync incremental)
 * @returns {Array<{start: number, end: number, speaker: string, text: string}>}
 */
function assignRelativeTimestamps(messages, startOffset = 0) {
  const MSG_DURATION = 3;
  return messages.map((msg, i) => ({
    ...msg,
    start: startOffset + i * MSG_DURATION,
    end: startOffset + i * MSG_DURATION + MSG_DURATION
  }));
}

module.exports = { buildTranscriptionTxt, buildTranscriptionJson, assignRelativeTimestamps, formatTime };
