const fs = require('fs');
const path = require('path');

// Extensiones soportadas para adjuntos
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
const TEXT_EXTENSIONS = ['.txt', '.md', '.yaml', '.yml'];
const PDF_EXTENSIONS = ['.pdf'];
const EXCEL_EXTENSIONS = ['.xlsx', '.xls'];
const SUPPORTED_EXTENSIONS = [...IMAGE_EXTENSIONS, ...TEXT_EXTENSIONS, ...PDF_EXTENSIONS, ...EXCEL_EXTENSIONS];

/**
 * Determina el tipo de archivo según su extensión.
 * @param {string} filename - Nombre del archivo
 * @returns {'image'|'pdf'|'text'|'excel'|'unknown'}
 */
function getAttachmentType(filename) {
  const ext = path.extname(filename).toLowerCase();
  if (IMAGE_EXTENSIONS.includes(ext)) return 'image';
  if (PDF_EXTENSIONS.includes(ext)) return 'pdf';
  if (TEXT_EXTENSIONS.includes(ext)) return 'text';
  if (EXCEL_EXTENSIONS.includes(ext)) return 'excel';
  return 'unknown';
}

/**
 * Sanitiza un nombre de archivo eliminando caracteres inválidos
 * y forzando una extensión específica.
 * @param {string} baseFilename - Nombre original
 * @param {string} [defaultName='archivo'] - Nombre por defecto si el resultado es vacío
 * @param {string} [forcedExt=''] - Extensión a forzar (ej: '.txt'). Si no se pasa, se respeta la original.
 * @returns {string} Nombre sanitizado
 */
function sanitizeFilename(baseFilename, defaultName = 'archivo', forcedExt = '') {
  let sanitized = baseFilename.replace(/[<>:"/\\|?*]/g, '').trim();
  if (!sanitized) {
    sanitized = defaultName;
  }
  if (forcedExt) {
    const extPattern = new RegExp(`${forcedExt.replace('.', '\\.')}$`, 'i');
    sanitized = sanitized.replace(extPattern, '');
    return `${sanitized}${forcedExt}`;
  }
  return sanitized;
}

/**
 * Sanitiza un nombre de carpeta para uso seguro en sistemas de archivos.
 * @param {string} name - Nombre original
 * @param {number} [maxLength=200] - Longitud máxima (por defecto 200 para evitar rutas >255 en ext4)
 * @returns {string} Nombre sanitizado y truncado
 */
function sanitizeFolderName(name, maxLength = 200) {
  return name
    .replace(/[^a-zA-Z0-9_\-áéíóúüñÁÉÍÓÚÜÑ]/g, '_')
    .slice(0, maxLength);
}

/**
 * Sanitiza un nombre de archivo y resuelve colisiones con archivos existentes.
 * @param {string} baseFilename - Nombre original del archivo
 * @param {string} targetDir - Directorio donde se verificarán colisiones
 * @param {string} [defaultName='Conversacion pegada'] - Nombre por defecto si está vacío
 * @param {string} [forcedExt='.txt'] - Extensión a forzar
 * @returns {string} Nombre de archivo final sin colisiones
 */
function resolveFilename(baseFilename, targetDir, defaultName = 'Conversacion pegada', forcedExt = '.txt') {
  const sanitized = sanitizeFilename(baseFilename, defaultName, forcedExt);

  let finalFilename = sanitized;
  let destPath = path.join(targetDir, finalFilename);
  let counter = 1;
  while (fs.existsSync(destPath)) {
    const nameWithoutExt = sanitized.replace(new RegExp(`${forcedExt.replace('.', '\\.')}$`, 'i'), '');
    finalFilename = `${nameWithoutExt}_${counter}${forcedExt}`;
    destPath = path.join(targetDir, finalFilename);
    counter++;
  }
  return finalFilename;
}

module.exports = {
  IMAGE_EXTENSIONS,
  TEXT_EXTENSIONS,
  PDF_EXTENSIONS,
  EXCEL_EXTENSIONS,
  SUPPORTED_EXTENSIONS,
  getAttachmentType,
  sanitizeFilename,
  sanitizeFolderName,
  resolveFilename,
};
