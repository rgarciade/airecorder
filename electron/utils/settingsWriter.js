/**
 * Escritura atómica y SERIALIZADA de settings.json.
 *
 * Todos los escritores de settings.json (handler 'save-settings', migraciones
 * de 'load-settings', 'change-db-path' y UpdateChecker._ignoreVersion) pasan
 * por esta cola: si dos escrituras se solapan, la segunda espera a que termine
 * la primera. Antes cada writer usaba un `.tmp` de nombre fijo y dos guardados
 * concurrentes se robaban el rename mutuamente (ENOENT en el segundo, settings
 * perdidos).
 */
const fs = require('fs');
const path = require('path');

// Cola global: cada escritura se encadena a la anterior. Un fallo no envenena
// la cola (se traga el error aquí; el error real lo recibe quien llamó).
let writeQueue = Promise.resolve();

/**
 * Escribe `data` en `settingsPath` de forma atómica (write a .tmp único +
 * rename), esperando su turno en la cola de escrituras.
 *
 * Las lecturas NO necesitan pasar por la cola: en POSIX el rename es atómico,
 * así que un lector concurrente ve el archivo viejo o el nuevo, nunca a medias.
 *
 * @param {string} settingsPath Ruta absoluta de settings.json
 * @param {string} data Contenido serializado (JSON.stringify ya aplicado)
 * @returns {Promise<void>} Se resuelve cuando el rename ha terminado
 */
function writeSettingsFileAtomic(settingsPath, data) {
  const run = writeQueue.then(async () => {
    const dir = path.dirname(settingsPath);
    await fs.promises.mkdir(dir, { recursive: true });
    // Nombre único por escritura: aunque alguien escriba fuera de la cola,
    // ningún rename puede consumir el .tmp de otra escritura en curso.
    const tmpPath = `${settingsPath}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    try {
      await fs.promises.writeFile(tmpPath, data);
      await fs.promises.rename(tmpPath, settingsPath);
    } catch (error) {
      // Limpieza best-effort: no dejar .tmp huérfanos si writeFile/rename fallan
      await fs.promises.unlink(tmpPath).catch(() => {});
      throw error;
    }
  });
  writeQueue = run.catch(() => {});
  return run;
}

module.exports = { writeSettingsFileAtomic };
