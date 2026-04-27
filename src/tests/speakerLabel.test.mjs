/**
 * speakerLabel.test.mjs
 *
 * Tests unitarios para la lógica de negocio de SpeakerLabel.
 *
 * Dado que SpeakerLabel es un componente React que depende del DOM y de Redux,
 * este test aísla y prueba DIRECTAMENTE las reglas de negocio clave:
 *
 *   1. Modo legacy (Test 1 del spec):
 *      Un ephemeralId tipo "SPEAKER_00" sin speakerResolution válida
 *      → canEdit = false → no se muestra UI de edición.
 *
 *   2. Modo nuevo v2.0 (Test 2 del spec):
 *      Un ephemeralId con speakerResolution con UUID válido
 *      → canEdit = true → UI de edición activada.
 *
 *   3. Retro-compatibilidad del selector de displayName:
 *      Legacy sin aliases → displayName fallback al ephemeralId (ej. "SPEAKER_00").
 *      Nuevo con alias → displayName retorna alias (ej. "Juan").
 *
 * CÓMO EJECUTAR:
 *   node src/tests/speakerLabel.test.mjs
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

// ── Extracción de la lógica pura de SpeakerLabel ─────────────────────────────
//
// Replicamos la lógica de SpeakerLabel.jsx sin React ni Redux.
// Estas funciones son exactamente lo que el componente evalúa internamente.

/**
 * Determina si el componente SpeakerLabel puede entrar en modo edición.
 * Reproduce la línea: `const canEdit = hasSpeakerResolution && !readOnly;`
 */
function computeCanEdit(speakerResolution, readOnly = false) {
  const hasSpeakerResolution = hasEditableSpeakerResolution(speakerResolution);
  return hasSpeakerResolution && !readOnly;
}

/**
 * Determina el displayName a mostrar dado el mapa Redux y el ephemeralId.
 * Reproduce el selector `selectDisplayName`.
 */
function computeDisplayName(speakersMap, ephemeralId) {
  const entry = speakersMap[ephemeralId];
  return entry?.displayName || ephemeralId;
}

// ── Suite: Test 1 — Modo Legacy ───────────────────────────────────────────────
//
// Spec Scenario: Render SpeakerLabel con ephemeralId antiguo y sin resolución.
// Expect: canEdit = false → Plain text, no edit/merge UI.

console.log('\n📋 Suite: SpeakerLabel — Test 1: Modo Legacy (sin speakerResolution)\n');

test('canEdit = false cuando speakerResolution es null', () => {
  const canEdit = computeCanEdit(null);
  assert.equal(canEdit, false);
});

test('canEdit = false cuando speakerResolution es undefined', () => {
  const canEdit = computeCanEdit(undefined);
  assert.equal(canEdit, false);
});

test('canEdit = false cuando speakerResolution es {} (objeto vacío)', () => {
  const canEdit = computeCanEdit({});
  assert.equal(canEdit, false);
});

test('canEdit = false con speakerResolution legacy (IDs efímeros, no UUIDs)', () => {
  const legacyResolution = {
    SPEAKER_00: { speakerId: 'SPEAKER_00', displayName: 'SPEAKER_00' },
  };
  const canEdit = computeCanEdit(legacyResolution);
  assert.equal(canEdit, false);
});

test('displayName legacy = ephemeralId cuando no hay alias en Redux', () => {
  const emptyMap = {};
  const displayName = computeDisplayName(emptyMap, 'SPEAKER_00');
  assert.equal(displayName, 'SPEAKER_00');
});

test('displayName legacy = "SISTEMA" cuando ephemeralId es "SISTEMA"', () => {
  const emptyMap = {};
  const displayName = computeDisplayName(emptyMap, 'SISTEMA');
  assert.equal(displayName, 'SISTEMA');
});

test('readOnly=true siempre bloquea edición aunque speakerResolution sea válido', () => {
  const validResolution = {
    SPEAKER_00: {
      speakerId: 'a1b2c3d4-e5f6-4789-ab12-cd3456ef7890',
      displayName: 'Juan',
    },
  };
  const canEdit = computeCanEdit(validResolution, true);
  assert.equal(canEdit, false);
});

// ── Suite: Test 2 — Modo Nuevo v2.0 ──────────────────────────────────────────
//
// Spec Scenario: Render SpeakerLabel con speakerResolution (UUID).
// Expect: canEdit = true → Editable label, trigger edit UI.

console.log('\n📋 Suite: SpeakerLabel — Test 2: Modo Nuevo v2.0 (con speakerResolution UUID)\n');

const validResolutionV2 = {
  SPEAKER_00: {
    speakerId: 'a1b2c3d4-e5f6-4789-ab12-cd3456ef7890',
    displayName: 'Juan',
  },
};

test('canEdit = true con speakerResolution válida con UUID', () => {
  const canEdit = computeCanEdit(validResolutionV2);
  assert.equal(canEdit, true);
});

test('canEdit = true con múltiples speakers con UUIDs válidos', () => {
  const multiSpeakerResolution = {
    SPEAKER_00: {
      speakerId: 'a1b2c3d4-e5f6-4789-ab12-cd3456ef7890',
      displayName: 'Juan',
    },
    SPEAKER_01: {
      speakerId: 'b2c3d4e5-f6a7-48bc-9012-de3456ef7891',
      displayName: 'María',
    },
  };
  const canEdit = computeCanEdit(multiSpeakerResolution);
  assert.equal(canEdit, true);
});

test('displayName v2.0 = alias cuando hay entrada en Redux', () => {
  const mapWithAlias = {
    SPEAKER_00: { speakerId: 'a1b2c3d4-e5f6-4789-ab12-cd3456ef7890', displayName: 'Juan' },
  };
  const displayName = computeDisplayName(mapWithAlias, 'SPEAKER_00');
  assert.equal(displayName, 'Juan');
});

test('displayName v2.0 = alias correcto para cada ephemeralId', () => {
  const mapWithAliases = {
    SPEAKER_00: { speakerId: 'uuid-1', displayName: 'Juan' },
    SPEAKER_01: { speakerId: 'uuid-2', displayName: 'María' },
    SISTEMA: { speakerId: 'uuid-3', displayName: 'Sistema' },
  };
  assert.equal(computeDisplayName(mapWithAliases, 'SPEAKER_00'), 'Juan');
  assert.equal(computeDisplayName(mapWithAliases, 'SPEAKER_01'), 'María');
  assert.equal(computeDisplayName(mapWithAliases, 'SISTEMA'), 'Sistema');
});

// ── Suite: Retro-compatibilidad — Comparación Legacy vs v2.0 ─────────────────
//
// Spec Scenario: un recording antiguo y uno nuevo deben comportarse diferente.

console.log('\n📋 Suite: SpeakerLabel — Retro-compatibilidad: legacy vs v2.0\n');

test('Legacy: canEdit=false, displayName=ephemeralId (modo read-only completo)', () => {
  const ephemeralId = 'SPEAKER_00';
  const legacyResolution = null; // vieja grabación
  const legacyMap = {};          // sin aliases en Redux

  const canEdit = computeCanEdit(legacyResolution);
  const displayName = computeDisplayName(legacyMap, ephemeralId);

  assert.equal(canEdit, false, 'legacy debe ser no editable');
  assert.equal(displayName, 'SPEAKER_00', 'legacy debe mostrar ephemeralId');
});

test('v2.0: canEdit=true, displayName=alias (modo interactivo)', () => {
  const ephemeralId = 'SPEAKER_00';
  const speakerResolution = {
    SPEAKER_00: {
      speakerId: 'a1b2c3d4-e5f6-4789-ab12-cd3456ef7890',
      displayName: 'Juan',
    },
  };
  const speakersMap = {
    SPEAKER_00: { speakerId: 'a1b2c3d4-e5f6-4789-ab12-cd3456ef7890', displayName: 'Juan' },
  };

  const canEdit = computeCanEdit(speakerResolution);
  const displayName = computeDisplayName(speakersMap, ephemeralId);

  assert.equal(canEdit, true, 'v2.0 debe ser editable');
  assert.equal(displayName, 'Juan', 'v2.0 debe mostrar alias');
});

test('La diferencia entre legacy y v2.0 es exclusivamente speakerResolution', () => {
  // Mismos datos de Redux, diferente speakerResolution
  const ephemeralId = 'SPEAKER_00';
  const speakersMap = {
    SPEAKER_00: { speakerId: 'a1b2c3d4-e5f6-4789-ab12-cd3456ef7890', displayName: 'Juan' },
  };

  const legacyResolution = null;
  const newResolution = {
    SPEAKER_00: {
      speakerId: 'a1b2c3d4-e5f6-4789-ab12-cd3456ef7890',
      displayName: 'Juan',
    },
  };

  const canEditLegacy = computeCanEdit(legacyResolution);
  const canEditNew = computeCanEdit(newResolution);

  // El displayName es idéntico en ambos (vive en Redux, no en speakerResolution)
  const displayNameLegacy = computeDisplayName(speakersMap, ephemeralId);
  const displayNameNew = computeDisplayName(speakersMap, ephemeralId);

  assert.equal(canEditLegacy, false, 'legacy sin resolución → no editable');
  assert.equal(canEditNew, true, 'nuevo con resolución UUID → editable');
  assert.equal(displayNameLegacy, displayNameNew, 'displayName igual en ambos modos');
});

// ── Suite: Caso borde — speakerResolution parcialmente inválido ───────────────

console.log('\n📋 Suite: SpeakerLabel — Casos borde de speakerResolution\n');

test('speakerResolution con una entry válida y otra no → canEdit=false', () => {
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
  const canEdit = computeCanEdit(mixedResolution);
  assert.equal(canEdit, false);
});

test('speakerResolution con entry sin speakerId → canEdit=false', () => {
  const noIdResolution = {
    SPEAKER_00: {
      displayName: 'Juan',
      // sin speakerId
    },
  };
  const canEdit = computeCanEdit(noIdResolution);
  assert.equal(canEdit, false);
});

// ── Resumen ───────────────────────────────────────────────────────────────────

console.log(`\n  Resultado: ${passed} pasaron, ${failed} fallaron\n`);
if (failed > 0) process.exit(1);
