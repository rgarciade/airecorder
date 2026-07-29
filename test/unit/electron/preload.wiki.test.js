import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';

// Foco acotado: solo el boundary `electronAPI.wiki` (Work Unit 3 — Fase 3, tareas 3.1-3.2).
// No existía suite de tests para preload.js antes de este cambio; se agrega esta lo más
// mínima posible en vez de auditar todo el bridge, siguiendo el alcance asignado.
//
// preload.js hace `require('electron')` y `require('@sentry/electron/preload')` a nivel de
// módulo. Ninguno se puede interceptar con `vi.mock`: este proyecto no tiene "type": "module"
// en package.json, así que preload.js es CJS puro (sin sintaxis import/export) y Vitest lo
// carga con el `require` nativo de Node en vez de pasarlo por su graph de módulos
// instrumentado — mismo patrón ya documentado en utils/paths.test.js y
// services/updateChecker.test.js. Workaround: inyectar directamente en `require.cache` de
// Node (compartido sin importar si el require es nativo o instrumentado) antes de importar
// preload.js, restaurando las entradas originales en beforeAll/afterAll.
const nodeRequire = createRequire(import.meta.url);
const electronPath = nodeRequire.resolve('electron');
const sentryPreloadPath = nodeRequire.resolve('@sentry/electron/preload');

const ipcRendererInvoke = vi.fn();
const exposeInMainWorld = vi.fn();

let originalElectronEntry;
let originalSentryPreloadEntry;

beforeAll(() => {
  originalElectronEntry = nodeRequire.cache[electronPath];
  nodeRequire.cache[electronPath] = {
    id: electronPath,
    filename: electronPath,
    loaded: true,
    exports: {
      contextBridge: { exposeInMainWorld },
      ipcRenderer: {
        invoke: ipcRendererInvoke,
        on: vi.fn(),
        send: vi.fn(),
        removeListener: vi.fn(),
        removeAllListeners: vi.fn(),
      },
      shell: { openExternal: vi.fn() },
    },
  };

  originalSentryPreloadEntry = nodeRequire.cache[sentryPreloadPath];
  nodeRequire.cache[sentryPreloadPath] = {
    id: sentryPreloadPath,
    filename: sentryPreloadPath,
    loaded: true,
    exports: {},
  };
});

afterAll(() => {
  if (originalElectronEntry) nodeRequire.cache[electronPath] = originalElectronEntry;
  else delete nodeRequire.cache[electronPath];

  if (originalSentryPreloadEntry) nodeRequire.cache[sentryPreloadPath] = originalSentryPreloadEntry;
  else delete nodeRequire.cache[sentryPreloadPath];
});

describe('preload wiki bridge', () => {
  let wikiAPI;

  // preload.js expone `electronAPI` una única vez al importarse (efecto de módulo top-level,
  // no una función reconstruible). El módulo se importa una sola vez aquí y se reutiliza la
  // misma referencia de `wikiAPI` en cada test; solo se limpian las llamadas grabadas del spy
  // de `ipcRenderer.invoke` entre tests.
  beforeAll(async () => {
    await import('../../../electron/preload.js');
    const electronAPICall = exposeInMainWorld.mock.calls.find(([namespace]) => namespace === 'electronAPI');
    wikiAPI = electronAPICall[1].wiki;
  });

  beforeEach(() => {
    ipcRendererInvoke.mockClear();
  });

  it('wiki.listPages reenvía (projectId, options) igual que generateStarterPage (mismo patrón ya existente para params opcionales)', () => {
    wikiAPI.listPages(42);

    expect(ipcRendererInvoke).toHaveBeenCalledWith('wiki:list-pages', 42, undefined);
  });

  it('wiki.listPages reenvía el filtro opcional de dominios a través del boundary', () => {
    wikiAPI.listPages(42, { domainIds: [1, 2] });

    expect(ipcRendererInvoke).toHaveBeenCalledWith('wiki:list-pages', 42, { domainIds: [1, 2] });
  });

  it('wiki.deletePage sigue reenviando solo el id (comportamiento unificado existente sin cambios)', () => {
    wikiAPI.deletePage(9);

    expect(ipcRendererInvoke).toHaveBeenCalledWith('wiki:delete-page', 9);
  });
});
