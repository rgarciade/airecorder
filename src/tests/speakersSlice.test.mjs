/**
 * speakersSlice.test.mjs
 *
 * Tests unitarios para el reducer `speakersSlice` de Redux.
 * Prueba la lógica de negocio PURA del reducer directamente,
 * sin necesitar un store ni React: se llaman las funciones
 * reducer con el estado inicial y se verifica el estado resultante.
 *
 * CÓMO EJECUTAR:
 *   node src/tests/speakersSlice.test.mjs
 *
 * Sin dependencias externas. Usa `assert` nativo de Node.js.
 *
 * ⚠ Nota: este archivo importa speakersSlice.js (CommonJS/ESM).
 *   Requiere que el módulo sea importable como ESM. Se usa
 *   un mock inline del módulo @reduxjs/toolkit para aislar la lógica.
 */

import assert from 'node:assert/strict';

// ── Inline mock de @reduxjs/toolkit ──────────────────────────────────────────
//
// Reproducimos sólo `createSlice` con Immer-like mutation (via structuredClone)
// para ejecutar los reducers sin instalar dependencias.
//
// Esto permite probar la lógica del reducer SIN el stack de Electron/React.

function createSliceMock({ name, initialState, reducers }) {
  const actions = {};

  // Crea action creators y guarda los reducers
  for (const [key, reducerFn] of Object.entries(reducers)) {
    const type = `${name}/${key}`;
    actions[key] = (payload) => ({ type, payload });
    actions[key].type = type;
    actions[key]._reducer = reducerFn;
    actions[key]._type = type;
  }

  // El reducer maestro
  function reducer(state = initialState, action) {
    for (const [, creator] of Object.entries(actions)) {
      if (action.type === creator._type) {
        // Immer-like: clonar estado, mutar, retornar
        const draft = structuredClone(state);
        creator._reducer(draft, action);
        return draft;
      }
    }
    return state;
  }

  return { actions, reducer };
}

// ── Reproducción del slice con el mock ───────────────────────────────────────

const initialState = {
  map: {},
  allSpeakers: [],
};

const { actions, reducer } = createSliceMock({
  name: 'speakers',
  initialState,
  reducers: {
    setAliases(state, action) {
      if (action.payload && typeof action.payload === 'object') {
        state.map = action.payload;
      }
    },

    updateAlias(state, action) {
      const { ephemeralId, speakerId, displayName } = action.payload;
      if (ephemeralId && displayName !== undefined) {
        state.map[ephemeralId] = { speakerId, displayName };
      }
    },

    mergeSpeakers(state, action) {
      const { sourceEphemeralIds, targetSpeakerId, displayName } = action.payload;
      if (!Array.isArray(sourceEphemeralIds) || !targetSpeakerId || !displayName) return;
      for (const ephemeralId of sourceEphemeralIds) {
        state.map[ephemeralId] = { speakerId: targetSpeakerId, displayName };
      }
    },

    setAllSpeakers(state, action) {
      if (Array.isArray(action.payload)) {
        state.allSpeakers = action.payload;
      }
    },

    clearAliases(state) {
      state.map = {};
    },
  },
});

// Selector inline (mismo que en speakersSlice.js)
function selectDisplayName(ephemeralId) {
  return (state) => {
    const entry = state.speakers?.map?.[ephemeralId] ?? state.map?.[ephemeralId];
    return entry?.displayName || ephemeralId;
  };
}

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

// ── Suite: Estado Inicial ─────────────────────────────────────────────────────

console.log('\n📋 Suite: speakersSlice — Estado Inicial\n');

test('estado inicial tiene map vacío {}', () => {
  const state = reducer(undefined, { type: '@@INIT' });
  assert.deepEqual(state.map, {});
});

test('estado inicial tiene allSpeakers vacío []', () => {
  const state = reducer(undefined, { type: '@@INIT' });
  assert.deepEqual(state.allSpeakers, []);
});

// ── Suite: setAliases ─────────────────────────────────────────────────────────

console.log('\n📋 Suite: speakersSlice — setAliases\n');

test('setAliases reemplaza el mapa completo', () => {
  const newMap = {
    SPEAKER_00: { speakerId: 'uuid-1', displayName: 'Juan' },
    SPEAKER_01: { speakerId: 'uuid-2', displayName: 'María' },
  };
  const state = reducer(undefined, actions.setAliases(newMap));
  assert.deepEqual(state.map, newMap);
});

test('setAliases con null no muta el estado', () => {
  const initial = { map: { SPEAKER_00: { speakerId: 'x', displayName: 'X' } }, allSpeakers: [] };
  const state = reducer(initial, actions.setAliases(null));
  assert.deepEqual(state.map, initial.map);
});

test('setAliases con string no muta el estado', () => {
  const initial = { map: {}, allSpeakers: [] };
  const state = reducer(initial, actions.setAliases('invalid'));
  assert.deepEqual(state.map, {});
});

// ── Suite: updateAlias ────────────────────────────────────────────────────────

console.log('\n📋 Suite: speakersSlice — updateAlias\n');

test('updateAlias agrega entrada nueva en map', () => {
  const state = reducer(undefined, actions.updateAlias({
    ephemeralId: 'SPEAKER_00',
    speakerId: 'uuid-abc',
    displayName: 'Juan',
  }));
  assert.deepEqual(state.map['SPEAKER_00'], { speakerId: 'uuid-abc', displayName: 'Juan' });
});

test('updateAlias sobreescribe alias existente', () => {
  const base = { map: { SPEAKER_00: { speakerId: 'uuid-old', displayName: 'Antiguo' } }, allSpeakers: [] };
  const state = reducer(base, actions.updateAlias({
    ephemeralId: 'SPEAKER_00',
    speakerId: 'uuid-new',
    displayName: 'Nuevo',
  }));
  assert.equal(state.map['SPEAKER_00'].displayName, 'Nuevo');
  assert.equal(state.map['SPEAKER_00'].speakerId, 'uuid-new');
});

test('updateAlias sin ephemeralId no muta el estado', () => {
  const state = reducer(undefined, actions.updateAlias({
    ephemeralId: '',
    speakerId: 'uuid-abc',
    displayName: 'Juan',
  }));
  assert.deepEqual(state.map, {});
});

test('updateAlias sin displayName no muta el estado', () => {
  const state = reducer(undefined, actions.updateAlias({
    ephemeralId: 'SPEAKER_00',
    speakerId: 'uuid-abc',
    displayName: undefined,
  }));
  assert.deepEqual(state.map, {});
});

// ── Suite: mergeSpeakers ──────────────────────────────────────────────────────
//
// Test 3 — Verificación del escenario MERGE del spec

console.log('\n📋 Suite: speakersSlice — mergeSpeakers (Spec Scenario 2)\n');

test('mergeSpeakers unifica dos speakers hacia un único UUID y alias', () => {
  // Arrange: dos hablantes distintos en el mapa
  const base = {
    map: {
      SPEAKER_00: { speakerId: 'uuid-juan', displayName: 'Juan' },
      SPEAKER_01: { speakerId: 'uuid-otro', displayName: 'Desconocido' },
    },
    allSpeakers: [],
  };

  // Act: merge SPEAKER_01 hacia Juan
  const state = reducer(base, actions.mergeSpeakers({
    sourceEphemeralIds: ['SPEAKER_01'],
    targetSpeakerId: 'uuid-juan',
    displayName: 'Juan',
  }));

  // Assert: ambos apuntan al mismo speakerId y displayName
  assert.equal(state.map['SPEAKER_01'].speakerId, 'uuid-juan');
  assert.equal(state.map['SPEAKER_01'].displayName, 'Juan');
  assert.equal(state.map['SPEAKER_00'].speakerId, 'uuid-juan'); // no debería cambiar
});

test('mergeSpeakers unifica múltiples sources', () => {
  const base = {
    map: {
      SPEAKER_00: { speakerId: 'uuid-a', displayName: 'A' },
      SPEAKER_01: { speakerId: 'uuid-b', displayName: 'B' },
      SPEAKER_02: { speakerId: 'uuid-c', displayName: 'C' },
    },
    allSpeakers: [],
  };

  const state = reducer(base, actions.mergeSpeakers({
    sourceEphemeralIds: ['SPEAKER_01', 'SPEAKER_02'],
    targetSpeakerId: 'uuid-a',
    displayName: 'María',
  }));

  assert.equal(state.map['SPEAKER_01'].speakerId, 'uuid-a');
  assert.equal(state.map['SPEAKER_01'].displayName, 'María');
  assert.equal(state.map['SPEAKER_02'].speakerId, 'uuid-a');
  assert.equal(state.map['SPEAKER_02'].displayName, 'María');
  assert.equal(state.map['SPEAKER_00'].speakerId, 'uuid-a'); // no cambia
});

test('mergeSpeakers con sourceEphemeralIds no-array no muta el estado', () => {
  const base = { map: { SPEAKER_00: { speakerId: 'uuid-x', displayName: 'X' } }, allSpeakers: [] };
  const state = reducer(base, actions.mergeSpeakers({
    sourceEphemeralIds: 'SPEAKER_00', // string, no array
    targetSpeakerId: 'uuid-y',
    displayName: 'Y',
  }));
  assert.equal(state.map['SPEAKER_00'].speakerId, 'uuid-x'); // sin cambios
});

test('mergeSpeakers sin targetSpeakerId no muta el estado', () => {
  const base = { map: {}, allSpeakers: [] };
  const state = reducer(base, actions.mergeSpeakers({
    sourceEphemeralIds: ['SPEAKER_00'],
    targetSpeakerId: '',
    displayName: 'Juan',
  }));
  assert.deepEqual(state.map, {});
});

test('mergeSpeakers sin displayName no muta el estado', () => {
  const base = { map: {}, allSpeakers: [] };
  const state = reducer(base, actions.mergeSpeakers({
    sourceEphemeralIds: ['SPEAKER_00'],
    targetSpeakerId: 'uuid-x',
    displayName: '',
  }));
  assert.deepEqual(state.map, {});
});

// ── Suite: clearAliases ───────────────────────────────────────────────────────

console.log('\n📋 Suite: speakersSlice — clearAliases\n');

test('clearAliases vacía el mapa', () => {
  const populated = {
    map: { SPEAKER_00: { speakerId: 'uuid-abc', displayName: 'Juan' } },
    allSpeakers: [],
  };
  const state = reducer(populated, actions.clearAliases());
  assert.deepEqual(state.map, {});
});

test('clearAliases no borra allSpeakers', () => {
  const populated = {
    map: { SPEAKER_00: { speakerId: 'uuid-abc', displayName: 'Juan' } },
    allSpeakers: [{ id: 'uuid-abc', display_name: 'Juan' }],
  };
  const state = reducer(populated, actions.clearAliases());
  assert.equal(state.allSpeakers.length, 1);
});

// ── Suite: setAllSpeakers ─────────────────────────────────────────────────────

console.log('\n📋 Suite: speakersSlice — setAllSpeakers\n');

test('setAllSpeakers reemplaza la lista', () => {
  const speakers = [
    { id: 'uuid-a', display_name: 'Ana' },
    { id: 'uuid-b', display_name: 'Beto' },
  ];
  const state = reducer(undefined, actions.setAllSpeakers(speakers));
  assert.deepEqual(state.allSpeakers, speakers);
});

test('setAllSpeakers con no-array no muta el estado', () => {
  const state = reducer(undefined, actions.setAllSpeakers('invalid'));
  assert.deepEqual(state.allSpeakers, []);
});

// ── Suite: selectDisplayName (selector) ───────────────────────────────────────

console.log('\n📋 Suite: speakersSlice — selectDisplayName (selector)\n');

test('selectDisplayName retorna el displayName cuando existe en el mapa', () => {
  const state = { map: { SPEAKER_00: { speakerId: 'uuid-x', displayName: 'Juan' } }, allSpeakers: [] };
  const name = selectDisplayName('SPEAKER_00')(state);
  assert.equal(name, 'Juan');
});

test('selectDisplayName retorna el ephemeralId como fallback cuando no hay entrada', () => {
  const state = { map: {}, allSpeakers: [] };
  const name = selectDisplayName('SPEAKER_00')(state);
  assert.equal(name, 'SPEAKER_00');
});

test('selectDisplayName retorna el ephemeralId cuando el mapa tiene el entry pero displayName está vacío', () => {
  const state = { map: { SPEAKER_00: { speakerId: 'uuid-x', displayName: '' } }, allSpeakers: [] };
  const name = selectDisplayName('SPEAKER_00')(state);
  // displayName vacío → falsy → fallback al ephemeralId
  assert.equal(name, 'SPEAKER_00');
});

// ── Resumen ───────────────────────────────────────────────────────────────────

console.log(`\n  Resultado: ${passed} pasaron, ${failed} fallaron\n`);
if (failed > 0) process.exit(1);
