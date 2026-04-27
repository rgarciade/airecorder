/**
 * speakerCompatibility.test.mjs
 *
 * Tests unitarios para `hasEditableSpeakerResolution`.
 *
 * CÓMO EJECUTAR:
 *   node src/tests/speakerCompatibility.test.mjs
 *
 * Sin dependencias externas. Usa `assert` nativo de Node.js.
 */

import assert from 'node:assert/strict';
import { hasEditableSpeakerResolution } from '../components/TranscriptionViewer/speakerCompatibility.mjs';

// ── Mini framework de tests ────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅  ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌  ${name}`);
    console.error(`     ${err.message}`);
    failed++;
  }
}

// ── Suite: hasEditableSpeakerResolution ───────────────────────────────────────

console.log('\n📋 Suite: hasEditableSpeakerResolution (speakerCompatibility.mjs)\n');

// ── Casos de grabaciones LEGACY (deben retornar false) ────────────────────────

test('null → false (sin resolución)', () => {
  assert.equal(hasEditableSpeakerResolution(null), false);
});

test('undefined → false', () => {
  assert.equal(hasEditableSpeakerResolution(undefined), false);
});

test('string → false', () => {
  assert.equal(hasEditableSpeakerResolution('SPEAKER_00'), false);
});

test('objeto vacío {} → false (legacy sin UUID)', () => {
  assert.equal(hasEditableSpeakerResolution({}), false);
});

test('valor primitivo (0) → false', () => {
  assert.equal(hasEditableSpeakerResolution(0), false);
});

test('array [] → false', () => {
  assert.equal(hasEditableSpeakerResolution([]), false);
});

test('mapa con speakerId=null → false', () => {
  const legacyResolution = {
    SPEAKER_00: { speakerId: null, displayName: 'SPEAKER_00' },
  };
  assert.equal(hasEditableSpeakerResolution(legacyResolution), false);
});

test('mapa con speakerId vacío "" → false', () => {
  const legacyResolution = {
    SPEAKER_00: { speakerId: '', displayName: 'SPEAKER_00' },
  };
  assert.equal(hasEditableSpeakerResolution(legacyResolution), false);
});

test('mapa con id efímero "SPEAKER_00" como speakerId → false (no es UUID)', () => {
  const legacyResolution = {
    SPEAKER_00: { speakerId: 'SPEAKER_00', displayName: 'SPEAKER_00' },
  };
  assert.equal(hasEditableSpeakerResolution(legacyResolution), false);
});

test('mapa con valor que no es objeto → false', () => {
  const badResolution = {
    SPEAKER_00: 'SPEAKER_00', // string en lugar de objeto
  };
  assert.equal(hasEditableSpeakerResolution(badResolution), false);
});

test('mapa con un entry válido y otro sin UUID → false (regla "all must be valid")', () => {
  const mixedResolution = {
    SPEAKER_00: {
      speakerId: 'a1b2c3d4-e5f6-4789-ab12-cd3456ef7890',
      displayName: 'Juan',
    },
    SPEAKER_01: {
      speakerId: null, // inválido
      displayName: 'María',
    },
  };
  assert.equal(hasEditableSpeakerResolution(mixedResolution), false);
});

// ── Casos de grabaciones NUEVAS v2.0 (deben retornar true) ───────────────────

test('mapa con un speaker UUID v4 válido → true', () => {
  const newResolution = {
    SPEAKER_00: {
      speakerId: 'a1b2c3d4-e5f6-4789-ab12-cd3456ef7890',
      displayName: 'Juan',
    },
  };
  assert.equal(hasEditableSpeakerResolution(newResolution), true);
});

test('mapa con múltiples speakers UUID válidos → true', () => {
  const newResolution = {
    SPEAKER_00: {
      speakerId: 'a1b2c3d4-e5f6-4789-ab12-cd3456ef7890',
      displayName: 'Juan',
    },
    SPEAKER_01: {
      speakerId: 'b2c3d4e5-f6a7-48bc-9012-de3456ef7891',
      displayName: 'María',
    },
    SISTEMA: {
      speakerId: 'c3d4e5f6-a7b8-49cd-a123-ef4567890123',
      displayName: 'Sistema',
    },
  };
  assert.equal(hasEditableSpeakerResolution(newResolution), true);
});

test('UUID v1 válido → true', () => {
  // UUID v1: third group starts with 1
  const newResolution = {
    SPEAKER_00: {
      speakerId: 'aaaaaaaa-bbbb-1ccc-8ddd-eeeeeeeeeeee',
      displayName: 'María',
    },
  };
  assert.equal(hasEditableSpeakerResolution(newResolution), true);
});

// ── Resumen ───────────────────────────────────────────────────────────────────

console.log(`\n  Resultado: ${passed} pasaron, ${failed} fallaron\n`);
if (failed > 0) process.exit(1);
