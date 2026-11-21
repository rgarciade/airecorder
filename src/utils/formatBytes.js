/**
 * Formato compartido de bytes → GB para la UI de inventario/descargas de
 * modelos Whisper (`DiskSpaceIndicator`, `ModelsSection`). Extraído como
 * función pura reutilizable (Boy Scout Rule / REFACTOR) en vez de
 * duplicarla en cada componente.
 */
const BYTES_PER_GB = 1024 ** 3;

/**
 * @param {number|null|undefined} bytes
 * @returns {string|null} p.ej. "1.5 GB", o `null` si `bytes` es `null`/`undefined`.
 */
export function formatGb(bytes) {
  if (bytes == null) return null;
  return `${(bytes / BYTES_PER_GB).toFixed(1)} GB`;
}
