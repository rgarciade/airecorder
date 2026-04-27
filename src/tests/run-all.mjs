/**
 * run-all.mjs
 *
 * Runner maestro para todos los tests de AIRecorder.
 * Ejecuta cada suite en secuencia y reporta el resultado global.
 *
 * CÓMO EJECUTAR:
 *   node src/tests/run-all.mjs
 *
 * Sin dependencias externas. Usa child_process nativo de Node.js.
 */

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Lista de suites ───────────────────────────────────────────────────────────

const suites = [
  {
    name: 'speakerCompatibility (hasEditableSpeakerResolution)',
    file: 'speakerCompatibility.test.mjs',
  },
  {
    name: 'speakersSlice (Redux reducer logic)',
    file: 'speakersSlice.test.mjs',
  },
  {
    name: 'speakerLabel (Business logic: canEdit, displayName, retro-compat)',
    file: 'speakerLabel.test.mjs',
  },
];

// ── Ejecución ─────────────────────────────────────────────────────────────────

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║  AIRecorder — Test Runner (Speaker Re-identification)         ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

let totalPassed = 0;
let totalFailed = 0;
const results = [];

for (const suite of suites) {
  const filePath = path.join(__dirname, suite.file);

  console.log(`▶  ${suite.name}`);
  console.log(`   ${suite.file}\n`);

  const result = spawnSync('node', [filePath], {
    stdio: 'inherit',
    encoding: 'utf8',
  });

  if (result.status === 0) {
    results.push({ ...suite, status: 'PASS' });
    totalPassed++;
  } else {
    results.push({ ...suite, status: 'FAIL' });
    totalFailed++;
  }

  console.log('');
}

// ── Resumen global ────────────────────────────────────────────────────────────

console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║  Resumen Global                                              ║');
console.log('╠══════════════════════════════════════════════════════════════╣');
for (const r of results) {
  const icon = r.status === 'PASS' ? '✅' : '❌';
  const label = r.status.padEnd(4);
  console.log(`║  ${icon}  ${label}  ${r.name.substring(0, 52).padEnd(52)} ║`);
}
console.log('╠══════════════════════════════════════════════════════════════╣');
console.log(`║  Suites: ${totalPassed} pasaron, ${totalFailed} fallaron`.padEnd(64) + '║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

if (totalFailed > 0) {
  console.error(`❌ ${totalFailed} suite(s) fallaron.\n`);
  process.exit(1);
} else {
  console.log(`✅ Todos los tests pasaron.\n`);
}
