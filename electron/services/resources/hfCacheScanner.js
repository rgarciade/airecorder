/**
 * Lector del layout de caché de Hugging Face Hub (algoritmo D3 — ver design.md).
 *
 * Layout esperado por repo: `models--{org}--{repo}/refs/main` → sha del snapshot
 * activo → `snapshots/{sha}/*` (symlinks a `blobs/{hash}` en macOS/Linux, o
 * copias reales en Windows). Cada archivo se resuelve con `fs.realpathSync`
 * y el tamaño total se calcula deduplicando por realpath (varios repos pueden
 * compartir blobs, y un mismo repo tiene sus 4-5 archivos como symlinks
 * independientes que jamás apuntan al mismo blob entre sí, pero conviene
 * deduplicar igual por robustez).
 *
 * DESVIACIÓN DOCUMENTADA respecto a design.md: la caché real (verificada en
 * ~/.cache/huggingface/hub) muestra que `preprocessor_config.json` NO está
 * presente en todos los repos de Systran/faster-whisper-* (falta en tiny,
 * base, small, medium; solo existe en large-v3). Si se exigiera como
 * requisito, la mayoría de los modelos jamás se detectarían como
 * `installed` aunque estén completos y funcionales — rompería INV3. Por eso
 * se trata como archivo OPCIONAL: se suma a `installedBytes` si existe, pero
 * no es parte de `REQUIRED_FILES`.
 */
const fs = require('fs');
const path = require('path');

const REQUIRED_FILES = ['config.json', 'model.bin', 'tokenizer.json'];
const OPTIONAL_FILES = ['preprocessor_config.json'];
const VOCAB_PATTERN = /^vocabulary\./;

/**
 * Convierte un repoId de HF ('Systran/faster-whisper-small') al nombre de
 * carpeta usado por la caché ('models--Systran--faster-whisper-small').
 * @param {string} repoId
 * @returns {string}
 */
function repoDirName(repoId) {
  return `models--${repoId.split('/').join('--')}`;
}

function readActiveRevision(repoDir) {
  const refPath = path.join(repoDir, 'refs', 'main');
  try {
    const sha = fs.readFileSync(refPath, 'utf8').trim();
    return sha || null;
  } catch {
    return null;
  }
}

function findVocabularyFiles(snapshotDir) {
  try {
    return fs.readdirSync(snapshotDir).filter((name) => VOCAB_PATTERN.test(name));
  } catch {
    return [];
  }
}

function hasIncompleteBlobs(repoDir) {
  const blobsDir = path.join(repoDir, 'blobs');
  try {
    return fs.readdirSync(blobsDir).some((name) => name.endsWith('.incomplete'));
  } catch {
    return false;
  }
}

function resolvedSize(filePath, seenRealpaths) {
  let real;
  try {
    real = fs.realpathSync(filePath);
  } catch {
    return 0;
  }
  if (seenRealpaths.has(real)) return 0;
  seenRealpaths.add(real);
  try {
    return fs.statSync(real).size;
  } catch {
    return 0;
  }
}

/**
 * Escanea un único modelo del catálogo dentro de la caché HF.
 * @param {string} cacheDir - ruta absoluta a la caché HF (…/huggingface/hub)
 * @param {{id: string, repoId: string}} catalogEntry
 * @returns {{installed: boolean, installedBytes: number|null, path: string|null, partial: boolean}}
 */
function scanModel(cacheDir, catalogEntry) {
  const repoDir = path.join(cacheDir, repoDirName(catalogEntry.repoId));
  const partial = hasIncompleteBlobs(repoDir);

  const sha = readActiveRevision(repoDir);
  if (!sha) {
    return { installed: false, installedBytes: null, path: null, partial };
  }

  const snapshotDir = path.join(repoDir, 'snapshots', sha);
  const requiredPresent = REQUIRED_FILES.every((name) => fs.existsSync(path.join(snapshotDir, name)));
  const vocabFiles = findVocabularyFiles(snapshotDir);

  if (!requiredPresent || vocabFiles.length === 0) {
    return { installed: false, installedBytes: null, path: null, partial };
  }

  const filesToSum = [...REQUIRED_FILES, ...OPTIONAL_FILES, ...vocabFiles];
  const seenRealpaths = new Set();
  let installedBytes = 0;
  for (const name of filesToSum) {
    const filePath = path.join(snapshotDir, name);
    if (!fs.existsSync(filePath)) continue;
    installedBytes += resolvedSize(filePath, seenRealpaths);
  }

  return { installed: true, installedBytes, path: snapshotDir, partial: false };
}

/**
 * Escanea todos los modelos del catálogo.
 * @param {string} cacheDir
 * @param {Array<{id: string, repoId: string}>} catalog
 * @returns {Array<{id: string, installed: boolean, installedBytes: number|null, path: string|null, partial: boolean}>}
 */
function scanCache(cacheDir, catalog) {
  return catalog.map((entry) => ({ id: entry.id, ...scanModel(cacheDir, entry) }));
}

module.exports = { scanModel, scanCache, repoDirName };
