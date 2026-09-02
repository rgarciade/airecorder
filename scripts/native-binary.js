/**
 * Selecciona el binario nativo de better-sqlite3 para el runtime destino.
 *
 * better-sqlite3 es un módulo nativo: el .node compilado sirve para un solo
 * ABI. Este proyecto tiene dos consumidores con ABI distinto:
 *
 *   - Electron (npm run dev / electron:build*)      -> ABI de Electron (140)
 *   - Vitest bajo Node del sistema (npm test)       -> ABI de Node (127)
 *
 * Antes, `pretest` ejecutaba `npm rebuild better-sqlite3` (compila para Node)
 * y `npm run rebuild` compilaba para Electron: cada corrida de tests rompía
 * el dev y viceversa (ping-pong de ERR_DLOPEN_FAILED).
 *
 * Este script guarda una copia cacheada de cada variante en .native-cache/
 * (claveada por versión de better-sqlite3, ABI/versión de Electron y arch)
 * y copia a node_modules la que corresponde. Solo recompila cuando la caché
 * no existe (primera vez, o tras cambiar better-sqlite3/Electron/Node).
 *
 * Uso:
 *   node scripts/native-binary.js electron [--arch=arm64|x64] [--save-only] [--best-effort]
 *   node scripts/native-binary.js node [--save-only] [--best-effort]
 *
 *   --save-only     Solo refrescar la caché con el binario YA presente en
 *                   node_modules (se usa tras `npm run rebuild`).
 *   --best-effort   Si algo falla, avisar y salir con 0 (no romper npm install).
 *   NATIVE_BINARY_FORCE=1  Desactiva el salto automatico en CI (el salto solo
 *                   aplica a la llamada --best-effort del postinstall, porque
 *                   build-release.yml ya hace su propio rebuild explicito).
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SQLITE_DIR = path.join(ROOT, 'node_modules', 'better-sqlite3');
const SQLITE_BIN = path.join(SQLITE_DIR, 'build', 'Release', 'better_sqlite3.node');
const CACHE_ROOT = path.join(ROOT, '.native-cache');

const args = process.argv.slice(2);
const target = args[0];
const saveOnly = args.includes('--save-only');
const bestEffort = args.includes('--best-effort');
const archOverride = (args.find((a) => a.startsWith('--arch=')) || '').split('=')[1] || null;

// Mismo criterio que los scripts rebuild / rebuild:win / rebuild:linux.
function defaultArch() {
  return process.platform === 'darwin' ? 'arm64' : 'x64';
}

function fail(message) {
  if (bestEffort) {
    console.warn(`[native-binary] Aviso: ${message} (best-effort, se continua)`);
    process.exit(0);
  }
  console.error(`[native-binary] Error: ${message}`);
  process.exit(1);
}

if (target !== 'electron' && target !== 'node') {
  console.error('[native-binary] Uso: node scripts/native-binary.js <electron|node> [--arch=...] [--save-only] [--best-effort]');
  process.exit(1);
}

if (!fs.existsSync(SQLITE_BIN)) {
  fail(`no existe ${path.relative(ROOT, SQLITE_BIN)}; corre npm install primero`);
}

const sqliteVersion = require(path.join(SQLITE_DIR, 'package.json')).version;

let electronVersion = null;
let arch = null;
let cacheDir = null;

if (target === 'electron') {
  electronVersion = require(path.join(ROOT, 'node_modules', 'electron', 'package.json')).version;
  arch = archOverride || defaultArch();
  cacheDir = path.join(
    CACHE_ROOT,
    `electron-${electronVersion}`,
    arch,
    `better-sqlite3-v${sqliteVersion}`
  );
} else {
  cacheDir = path.join(
    CACHE_ROOT,
    `node-abi${process.versions.modules}`,
    `better-sqlite3-v${sqliteVersion}`
  );
}

// En CI, el workflow de release (build-release.yml) hace su propio rebuild
// explicito, asi que el postinstall (--best-effort) no debe duplicar ese
// trabajo. El pretest SI corre en CI (test.yml) y es quien garantiza el
// binario de Electron para los tests bajo ELECTRON_RUN_AS_NODE, por eso
// solo se salta la llamada best-effort.
if (
  process.env.CI &&
  target === 'electron' &&
  bestEffort &&
  !saveOnly &&
  process.env.NATIVE_BINARY_FORCE !== '1'
) {
  console.log('[native-binary] Entorno CI detectado: el workflow ya hace el rebuild para Electron; se omite.');
  process.exit(0);
}

const cachedBin = path.join(cacheDir, 'better_sqlite3.node');
const relBin = path.relative(ROOT, SQLITE_BIN);

function saveToCache() {
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.copyFileSync(SQLITE_BIN, cachedBin);
  console.log(`[native-binary] Cache guardada: ${path.relative(ROOT, cachedBin)}`);
}

if (saveOnly) {
  saveToCache();
  process.exit(0);
}

if (fs.existsSync(cachedBin)) {
  fs.copyFileSync(cachedBin, SQLITE_BIN);
  console.log(`[native-binary] ${relBin} restaurado desde cache (${path.relative(CACHE_ROOT, cachedBin)}).`);
  process.exit(0);
}

try {
  if (target === 'electron') {
    const cli = require.resolve('electron-rebuild/lib/src/cli.js');
    console.log(`[native-binary] Sin cache: compilando better-sqlite3 v${sqliteVersion} para Electron ${electronVersion} (${arch})...`);
    execFileSync(process.execPath, [cli, '--arch', arch, '--only', 'better-sqlite3'], {
      cwd: ROOT,
      stdio: 'inherit',
    });
  } else {
    console.log(`[native-binary] Sin cache: compilando better-sqlite3 v${sqliteVersion} para Node ${process.version} (ABI ${process.versions.modules})...`);
    execFileSync('npm', ['rebuild', 'better-sqlite3'], {
      cwd: ROOT,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
  }
  saveToCache();
  console.log(`[native-binary] Listo: ${relBin} quedo compilado para "${target}".`);
} catch (err) {
  fail(`no se pudo compilar better-sqlite3 para "${target}": ${err.message}`);
}
