/**
 * Corre Vitest usando el Node embebido de Electron (ELECTRON_RUN_AS_NODE=1).
 *
 * Motivo: better-sqlite3 es un módulo nativo con un solo binario por ABI, y el
 * ABI de Electron no coincide con el de ningún Node oficial (Electron 39 = 140,
 * Node 22 = 127). Ejecutar los tests con el runtime de Electron permite:
 *
 *   - Usar el MISMO binario nativo que la app (el que compilan postinstall y
 *     predev), sin recompilaciones ni swaps para correr tests.
 *   - Probar electron/database y servicios contra el runtime EXACTO de
 *     producción, no una aproximación con el Node del sistema.
 *
 * Uso: node scripts/vitest-electron.js [args de vitest...]
 *   npm test                     -> vitest run (suite completa)
 *   npm test -- test/foo.test.js -> vitest run con filtro de archivo
 *
 * Nota: correr `npx vitest` directo (Node del sistema) falla con
 * ERR_DLOPEN_FAILED si el binario nativo está compilado para Electron; usar
 * siempre los npm scripts.
 */
'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

// `require('electron')` desde un proceso Node devuelve la ruta al binario.
const electronBin = require('electron');
const vitestEntry = path.join(__dirname, '..', 'node_modules', 'vitest', 'vitest.mjs');

const result = spawnSync(electronBin, [vitestEntry, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
});

if (result.error) {
  console.error(`[vitest-electron] No se pudo ejecutar Electron: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
