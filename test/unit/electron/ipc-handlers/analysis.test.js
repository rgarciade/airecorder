/**
 * analysis.test.js
 *
 * Tests unitarios para electron/ipc-handlers/analysis.js — 30 canales IPC
 * que gestionan el análisis de una grabación: resumen IA, histórico de
 * preguntas, participantes, sugerencias de tareas (Kanban), comentarios de
 * tareas, instrucciones extra, esquema/mind-map, estado de generación y
 * captura de pantalla.
 *
 * analysis.js hace, a nivel de módulo:
 *   const { ipcMain, BrowserWindow } = require('electron');
 *   const dbService = require('../database/dbService');
 *   const notificationService = require('../services/notificationService');
 *   const { getRecordingsPath, getFolderPathFromId } = require('../utils/paths');
 * Todos CJS puro (sin "type":"module" en package.json) → mismo patrón
 * establecido en el resto de la sesión (ver cabecera de export.test.js /
 * integrations-oauth.test.js): mocks inyectados en `require.cache` de Node
 * vía `createRequire(import.meta.url)` en `beforeAll`/`afterAll`, import
 * dinámico del módulo bajo test dentro de `beforeEach`, e `ipcMain.handle`
 * mockeado como `vi.fn((channel, cb) => { handlers[channel] = cb; })` para
 * capturar cada callback registrado.
 *
 * `fs` es un módulo core de Node — no se inyecta en require.cache (rompería
 * el propio test runner), se espía con `vi.spyOn` sobre el mismo objeto de
 * módulo que analysis.js importa (comparten el mismo `require('fs')` cacheado
 * por Node), igual que en integrations-oauth.test.js.
 *
 * ALCANCE: 30 handlers es demasiado para dar profundidad uniforme a todos.
 * Se testea a fondo la pareja save/get representativa (save-question-history
 * / get-question-history: no existe → default, JSON corrupto → no revienta,
 * round-trip), los handlers con lógica real distinta de un simple
 * read/write (update-last-question-history, save/get/clear-generating-state,
 * capture-area-png), y validaciones puntuales del resto. Las parejas
 * CRUD estructuralmente idénticas (save-participants/get-participants,
 * save-extra-instructions/get-extra-instructions,
 * save-recording-schema/get-recording-schema) reciben 1-2 tests de conexión,
 * no la misma profundidad de boundary que la pareja representativa.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'fs';

const nodeRequire = createRequire(import.meta.url);
const electronPath = nodeRequire.resolve('electron');
const dbServicePath = nodeRequire.resolve('../../../../electron/database/dbService.js');
const notificationServicePath = nodeRequire.resolve('../../../../electron/services/notificationService.js');
const pathsPath = nodeRequire.resolve('../../../../electron/utils/paths.js');

let originalElectronEntry;
let originalDbServiceEntry;
let originalNotificationServiceEntry;
let originalPathsEntry;

// ── Mocks de electron ───────────────────────────────────────────────────
const handlers = {};
const ipcMainMock = {
  handle: vi.fn((channel, cb) => {
    handlers[channel] = cb;
  }),
};
const capturePageMock = vi.fn();
const fakeWebContents = { capturePage: capturePageMock };
const BrowserWindowMock = {
  fromWebContents: vi.fn(() => ({ webContents: fakeWebContents })),
};

// ── Mock de dbService ────────────────────────────────────────────────────
const dbServiceMock = {
  updateStatus: vi.fn(),
  getTaskSuggestionsByProject: vi.fn(),
  getTaskSuggestions: vi.fn(),
  addTaskSuggestion: vi.fn(),
  updateTaskSuggestion: vi.fn(),
  getTaskComments: vi.fn(),
  addTaskComment: vi.fn(),
  deleteTaskComment: vi.fn(),
  createProjectTask: vi.fn(),
  addTaskToProject: vi.fn(),
  removeTaskFromProject: vi.fn(),
  updateTasksSortOrder: vi.fn(),
  deleteTaskSuggestion: vi.fn(),
};

// ── Mock de notificationService ─────────────────────────────────────────
const notificationServiceMock = { show: vi.fn() };

// ── Mock de paths.js ────────────────────────────────────────────────────
const pathsMock = {
  getRecordingsPath: vi.fn(),
  getFolderPathFromId: vi.fn(),
};

beforeAll(() => {
  originalElectronEntry = nodeRequire.cache[electronPath];
  nodeRequire.cache[electronPath] = {
    id: electronPath,
    filename: electronPath,
    loaded: true,
    exports: { ipcMain: ipcMainMock, BrowserWindow: BrowserWindowMock },
  };

  originalDbServiceEntry = nodeRequire.cache[dbServicePath];
  nodeRequire.cache[dbServicePath] = {
    id: dbServicePath,
    filename: dbServicePath,
    loaded: true,
    exports: dbServiceMock,
  };

  originalNotificationServiceEntry = nodeRequire.cache[notificationServicePath];
  nodeRequire.cache[notificationServicePath] = {
    id: notificationServicePath,
    filename: notificationServicePath,
    loaded: true,
    exports: notificationServiceMock,
  };

  originalPathsEntry = nodeRequire.cache[pathsPath];
  nodeRequire.cache[pathsPath] = {
    id: pathsPath,
    filename: pathsPath,
    loaded: true,
    exports: pathsMock,
  };
});

afterAll(() => {
  if (originalElectronEntry) nodeRequire.cache[electronPath] = originalElectronEntry;
  else delete nodeRequire.cache[electronPath];
  if (originalDbServiceEntry) nodeRequire.cache[dbServicePath] = originalDbServiceEntry;
  else delete nodeRequire.cache[dbServicePath];
  if (originalNotificationServiceEntry) nodeRequire.cache[notificationServicePath] = originalNotificationServiceEntry;
  else delete nodeRequire.cache[notificationServicePath];
  if (originalPathsEntry) nodeRequire.cache[pathsPath] = originalPathsEntry;
  else delete nodeRequire.cache[pathsPath];
});

let analysisHandlers;

function resetAllMocks() {
  [
    ipcMainMock.handle,
    BrowserWindowMock.fromWebContents,
    capturePageMock,
    ...Object.values(dbServiceMock),
    notificationServiceMock.show,
    ...Object.values(pathsMock),
  ].forEach((fn) => fn.mockReset());

  ipcMainMock.handle.mockImplementation((channel, cb) => {
    handlers[channel] = cb;
  });
  BrowserWindowMock.fromWebContents.mockImplementation(() => ({ webContents: fakeWebContents }));
}

beforeEach(async () => {
  Object.keys(handlers).forEach((k) => delete handlers[k]);
  resetAllMocks();

  vi.restoreAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});

  // Por defecto: nada existe en disco, escrituras no-op.
  vi.spyOn(fs, 'existsSync').mockReturnValue(false);
  vi.spyOn(fs, 'mkdirSync').mockImplementation(() => {});
  vi.spyOn(fs, 'readFileSync').mockImplementation(() => {
    throw new Error('ENOENT (readFileSync no configurado en este test)');
  });
  vi.spyOn(fs.promises, 'writeFile').mockResolvedValue(undefined);
  vi.spyOn(fs.promises, 'readFile').mockRejectedValue(new Error('ENOENT (readFile no configurado en este test)'));
  vi.spyOn(fs.promises, 'unlink').mockResolvedValue(undefined);

  pathsMock.getRecordingsPath.mockResolvedValue('/fake/recordings');
  pathsMock.getFolderPathFromId.mockImplementation(async (id) => `folder-${id}`);

  analysisHandlers = await import('../../../../electron/ipc-handlers/analysis.js');
  analysisHandlers.registerAnalysisHandlers();
});

// ─────────────────────────────────────────────────────────────────────────
// save-question-history / get-question-history — pareja representativa,
// testeada a fondo (patrón save→JSON en disco / get→lee y parsea).
// ─────────────────────────────────────────────────────────────────────────

describe('get-question-history', () => {
  it('archivo no existe → devuelve historial vacío por defecto, sin lanzar', async () => {
    fs.existsSync.mockReturnValue(false);

    const result = await handlers['get-question-history']({}, 1);

    expect(result).toEqual({ success: true, history: [] });
  });

  it('JSON corrupto → capturado por el catch externo, success:false (no revienta el proceso)', async () => {
    fs.existsSync.mockReturnValue(true);
    fs.promises.readFile.mockResolvedValue('{ esto no es JSON válido');

    const result = await handlers['get-question-history']({}, 1);

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('round-trip: lee y parsea el historial persistido', async () => {
    fs.existsSync.mockReturnValue(true);
    const stored = [{ pregunta: '¿Qué pasó?', respuesta: 'Nada', timestamp: 't1' }];
    fs.promises.readFile.mockResolvedValue(JSON.stringify(stored));

    const result = await handlers['get-question-history']({}, 1);

    expect(result).toEqual({ success: true, history: stored });
  });
});

describe('save-question-history', () => {
  it('carpeta analysis no existe → se crea con { recursive: true } antes de escribir', async () => {
    fs.existsSync.mockReturnValue(false);

    await handlers['save-question-history']({}, 1, { pregunta: 'x', respuesta: 'y' });

    expect(fs.mkdirSync).toHaveBeenCalledWith(expect.stringContaining('analysis'), { recursive: true });
  });

  it('carpeta analysis ya existe → NO se vuelve a crear', async () => {
    fs.existsSync.mockImplementation((p) => p.includes('analysis') && !p.includes('.json'));

    await handlers['save-question-history']({}, 1, { pregunta: 'x', respuesta: 'y' });

    expect(fs.mkdirSync).not.toHaveBeenCalled();
  });

  it('archivo no existe aún → arranca de historial vacío y añade la primera entrada con timestamp', async () => {
    fs.existsSync.mockReturnValue(false);

    const result = await handlers['save-question-history']({}, 1, { pregunta: '¿Hola?', respuesta: null });

    expect(result).toEqual({ success: true });
    const written = JSON.parse(fs.promises.writeFile.mock.calls[0][1]);
    expect(written).toHaveLength(1);
    expect(written[0]).toMatchObject({ pregunta: '¿Hola?', respuesta: null });
    expect(typeof written[0].timestamp).toBe('string');
  });

  it('round-trip: historial existente con 2 entradas + 1 nueva → escribe 3 entradas conservando el orden', async () => {
    fs.existsSync.mockReturnValue(true);
    const existing = [
      { pregunta: 'p1', respuesta: 'r1', timestamp: 't1' },
      { pregunta: 'p2', respuesta: 'r2', timestamp: 't2' },
    ];
    fs.promises.readFile.mockResolvedValue(JSON.stringify(existing));

    await handlers['save-question-history']({}, 1, { pregunta: 'p3', respuesta: 'r3' });

    const written = JSON.parse(fs.promises.writeFile.mock.calls[0][1]);
    expect(written).toHaveLength(3);
    expect(written.map((h) => h.pregunta)).toEqual(['p1', 'p2', 'p3']);
  });

  it('JSON existente corrupto → capturado por el catch externo, no escribe nada', async () => {
    fs.existsSync.mockReturnValue(true);
    fs.promises.readFile.mockResolvedValue('no-es-json');

    const result = await handlers['save-question-history']({}, 1, { pregunta: 'x' });

    expect(result.success).toBe(false);
    expect(fs.promises.writeFile).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// get-ai-summary / save-ai-summary — retrocompatibilidad ai_summary.json /
// gemini_summary.json, y efectos colaterales (updateStatus, notificación).
// ─────────────────────────────────────────────────────────────────────────

describe('get-ai-summary', () => {
  it('ni ai_summary.json ni gemini_summary.json existen → error "Resumen no encontrado"', async () => {
    fs.existsSync.mockReturnValue(false);

    const result = await handlers['get-ai-summary']({}, 1);

    expect(result).toEqual({ success: false, error: 'Resumen no encontrado' });
  });

  it('sólo existe ai_summary.json → lo lee directamente', async () => {
    fs.existsSync.mockImplementation((p) => p.endsWith('ai_summary.json'));
    fs.promises.readFile.mockResolvedValue(JSON.stringify({ resumen: 'nuevo' }));

    const result = await handlers['get-ai-summary']({}, 1);

    expect(result).toEqual({ success: true, summary: { resumen: 'nuevo' } });
  });

  it('retrocompatibilidad: sólo existe gemini_summary.json (legacy) → cae a él', async () => {
    fs.existsSync.mockImplementation((p) => p.endsWith('gemini_summary.json'));
    fs.promises.readFile.mockResolvedValue(JSON.stringify({ resumen: 'legacy' }));

    const result = await handlers['get-ai-summary']({}, 1);

    expect(result).toEqual({ success: true, summary: { resumen: 'legacy' } });
    expect(fs.promises.readFile).toHaveBeenCalledWith(expect.stringContaining('gemini_summary.json'), 'utf8');
  });

  it('ambos existen → prioriza ai_summary.json sobre el legacy', async () => {
    fs.existsSync.mockReturnValue(true); // ambos "existen"
    fs.promises.readFile.mockResolvedValue(JSON.stringify({ resumen: 'nuevo' }));

    await handlers['get-ai-summary']({}, 1);

    expect(fs.promises.readFile).toHaveBeenCalledWith(expect.stringContaining('ai_summary.json'), 'utf8');
    expect(fs.promises.readFile).not.toHaveBeenCalledWith(expect.stringContaining('gemini_summary.json'), 'utf8');
  });
});

describe('save-ai-summary', () => {
  it('camino feliz: escribe el JSON, actualiza estado a "analyzed" y dispara notificación', async () => {
    fs.existsSync.mockReturnValue(false);

    const result = await handlers['save-ai-summary']({}, 1, { resumen: 'x' });

    expect(result).toEqual({ success: true });
    expect(dbServiceMock.updateStatus).toHaveBeenCalledWith('folder-1', 'analyzed');
    expect(notificationServiceMock.show).toHaveBeenCalledTimes(1);
    expect(notificationServiceMock.show.mock.calls[0][2]).toMatchObject({
      type: 'analysis-complete',
      recordingId: 'folder-1',
    });
  });

  it('escritura falla → no actualiza estado ni notifica (el catch corta el flujo)', async () => {
    fs.existsSync.mockReturnValue(false);
    fs.promises.writeFile.mockRejectedValue(new Error('disk full'));

    const result = await handlers['save-ai-summary']({}, 1, { resumen: 'x' });

    expect(result).toEqual({ success: false, error: 'disk full' });
    expect(dbServiceMock.updateStatus).not.toHaveBeenCalled();
    expect(notificationServiceMock.show).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// update-last-question-history — lógica real de matching: busca desde el
// final la última entrada con la MISMA pregunta y respuesta:null.
// ─────────────────────────────────────────────────────────────────────────

describe('update-last-question-history', () => {
  it('archivo no existe → error "Historial no encontrado" sin escribir', async () => {
    fs.existsSync.mockReturnValue(false);

    const result = await handlers['update-last-question-history']({}, 1, { pregunta: 'x', respuesta: 'y' });

    expect(result).toEqual({ success: false, error: 'Historial no encontrado' });
    expect(fs.promises.writeFile).not.toHaveBeenCalled();
  });

  it('historial vacío → no encuentra nada, escribe el array vacío tal cual sin lanzar', async () => {
    fs.existsSync.mockReturnValue(true);
    fs.promises.readFile.mockResolvedValue('[]');

    const result = await handlers['update-last-question-history']({}, 1, { pregunta: 'x', respuesta: 'y' });

    expect(result).toEqual({ success: true });
    expect(JSON.parse(fs.promises.writeFile.mock.calls[0][1])).toEqual([]);
  });

  it('encuentra la ÚLTIMA entrada con la pregunta y respuesta:null, y sólo esa se actualiza', async () => {
    fs.existsSync.mockReturnValue(true);
    const stored = [
      { pregunta: '¿P1?', respuesta: null, timestamp: 't0' }, // misma pregunta, más antigua
      { pregunta: '¿P2?', respuesta: 'ya respondida', timestamp: 't1' },
      { pregunta: '¿P1?', respuesta: null, timestamp: 't2' }, // ésta debe actualizarse
    ];
    fs.promises.readFile.mockResolvedValue(JSON.stringify(stored));

    await handlers['update-last-question-history']({}, 1, { pregunta: '¿P1?', respuesta: 'Respuesta real' });

    const written = JSON.parse(fs.promises.writeFile.mock.calls[0][1]);
    expect(written[0]).toMatchObject({ pregunta: '¿P1?', respuesta: null }); // NO tocada
    expect(written[2]).toMatchObject({ pregunta: '¿P1?', respuesta: 'Respuesta real' }); // SÍ tocada
  });

  it('pregunta coincide pero respuesta ya NO es null → no se actualiza ninguna entrada', async () => {
    fs.existsSync.mockReturnValue(true);
    const stored = [{ pregunta: '¿P1?', respuesta: 'ya tiene respuesta', timestamp: 't0' }];
    fs.promises.readFile.mockResolvedValue(JSON.stringify(stored));

    await handlers['update-last-question-history']({}, 1, { pregunta: '¿P1?', respuesta: 'Otra respuesta' });

    const written = JSON.parse(fs.promises.writeFile.mock.calls[0][1]);
    expect(written[0].respuesta).toBe('ya tiene respuesta');
  });

  it('ninguna entrada coincide en pregunta → historial se reescribe sin cambios', async () => {
    fs.existsSync.mockReturnValue(true);
    const stored = [{ pregunta: '¿Otra pregunta?', respuesta: null, timestamp: 't0' }];
    fs.promises.readFile.mockResolvedValue(JSON.stringify(stored));

    await handlers['update-last-question-history']({}, 1, { pregunta: '¿P1?', respuesta: 'x' });

    const written = JSON.parse(fs.promises.writeFile.mock.calls[0][1]);
    expect(written[0]).toEqual(stored[0]);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// clear-question-history / replace-question-history
// ─────────────────────────────────────────────────────────────────────────

describe('clear-question-history', () => {
  it('crea el directorio analysis si no existe, sobreescribe con "[]" y success:true', async () => {
    fs.existsSync.mockReturnValue(false);
    fs.promises.readFile.mockResolvedValue('[]');

    const result = await handlers['clear-question-history']({}, 1);

    expect(fs.mkdirSync).toHaveBeenCalledWith(expect.stringContaining('analysis'), { recursive: true });
    expect(fs.promises.writeFile).toHaveBeenCalledWith(expect.stringContaining('questions_history.json'), '[]', 'utf8');
    expect(result).toEqual({ success: true });
  });

  it('directorio ya existe → no lo vuelve a crear, igual limpia', async () => {
    fs.existsSync.mockReturnValue(true);
    fs.promises.readFile.mockResolvedValue('[]');

    const result = await handlers['clear-question-history']({}, 1);

    expect(fs.mkdirSync).not.toHaveBeenCalled();
    expect(result).toEqual({ success: true });
  });
});

describe('replace-question-history', () => {
  it('history undefined → normaliza a array vacío antes de escribir (boundary del fallback ||)', async () => {
    fs.existsSync.mockReturnValue(true);

    await handlers['replace-question-history']({}, 1, undefined);

    expect(JSON.parse(fs.promises.writeFile.mock.calls[0][1])).toEqual([]);
  });

  it('history provisto → se escribe tal cual, reemplazando por completo', async () => {
    fs.existsSync.mockReturnValue(true);
    const history = [{ pregunta: 'x', respuesta: 'y' }];

    await handlers['replace-question-history']({}, 1, history);

    expect(JSON.parse(fs.promises.writeFile.mock.calls[0][1])).toEqual(history);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Parejas CRUD estructuralmente idénticas a save/get-question-history —
// 1-2 tests cada una, sólo para confirmar que están bien cableadas.
// ─────────────────────────────────────────────────────────────────────────

describe('save-participants / get-participants', () => {
  it('get: archivo no existe → participants: [] por defecto', async () => {
    fs.existsSync.mockReturnValue(false);
    const result = await handlers['get-participants']({}, 1);
    expect(result).toEqual({ success: true, participants: [] });
  });

  it('save→get round-trip', async () => {
    fs.existsSync.mockReturnValue(false);
    const participants = [{ name: 'Ana', role: 'PM' }];

    await handlers['save-participants']({}, 1, participants);
    const written = fs.promises.writeFile.mock.calls[0][1];

    fs.existsSync.mockReturnValue(true);
    fs.promises.readFile.mockResolvedValue(written);
    const result = await handlers['get-participants']({}, 1);

    expect(result).toEqual({ success: true, participants });
  });
});

describe('save-extra-instructions / get-extra-instructions', () => {
  it('get: archivo no existe → text: "" por defecto', async () => {
    fs.existsSync.mockReturnValue(false);
    const result = await handlers['get-extra-instructions']({}, 1);
    expect(result).toEqual({ success: true, text: '' });
  });

  it('save→get round-trip (texto plano, no JSON)', async () => {
    fs.existsSync.mockReturnValue(false);
    await handlers['save-extra-instructions']({}, 1, 'Instrucciones extra');
    const written = fs.promises.writeFile.mock.calls[0][1];

    fs.existsSync.mockReturnValue(true);
    fs.promises.readFile.mockResolvedValue(written);
    const result = await handlers['get-extra-instructions']({}, 1);

    expect(result).toEqual({ success: true, text: 'Instrucciones extra' });
  });
});

describe('save-recording-schema / get-recording-schema', () => {
  it('get: archivo no existe → error "Esquema no encontrado"', async () => {
    fs.existsSync.mockReturnValue(false);
    const result = await handlers['get-recording-schema']({}, 1);
    expect(result).toEqual({ success: false, error: 'Esquema no encontrado' });
  });

  it('save→get round-trip', async () => {
    fs.existsSync.mockReturnValue(false);
    const schema = { nodes: [{ id: 1 }] };
    await handlers['save-recording-schema']({}, 1, schema);
    const written = fs.promises.writeFile.mock.calls[0][1];

    fs.existsSync.mockReturnValue(true);
    fs.promises.readFile.mockResolvedValue(written);
    const result = await handlers['get-recording-schema']({}, 1);

    expect(result).toEqual({ success: true, schema });
  });

  it('BOUNDARY: JSON corrupto tiene un catch INTERNO dedicado — mensaje específico distinto del genérico de otros handlers get-*', async () => {
    // A diferencia de get-question-history / get-participants (donde un JSON
    // corrupto revienta hasta el catch externo con el mensaje crudo de
    // JSON.parse), get-recording-schema envuelve su propio JSON.parse en un
    // try/catch dedicado que devuelve un mensaje amigable y estable.
    fs.existsSync.mockReturnValue(true);
    fs.promises.readFile.mockResolvedValue('{ json invalido');

    const result = await handlers['get-recording-schema']({}, 1);

    expect(result).toEqual({ success: false, error: 'El archivo de esquema está corrupto (JSON inválido)' });
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Sugerencias de tareas — validación de ID numérico (isNaN guard)
// ─────────────────────────────────────────────────────────────────────────

describe('get-project-task-suggestions / get-task-suggestions — validación de ID', () => {
  it('get-project-task-suggestions: projectId no numérico → "ID inválido" sin tocar dbService', async () => {
    const result = await handlers['get-project-task-suggestions']({}, 'abc');
    expect(result).toEqual({ success: false, error: 'ID inválido' });
    expect(dbServiceMock.getTaskSuggestionsByProject).not.toHaveBeenCalled();
  });

  it('get-project-task-suggestions: projectId numérico (string) → parsea y delega', async () => {
    dbServiceMock.getTaskSuggestionsByProject.mockReturnValue([{ id: 1 }]);
    const result = await handlers['get-project-task-suggestions']({}, '42');
    expect(dbServiceMock.getTaskSuggestionsByProject).toHaveBeenCalledWith(42);
    expect(result).toEqual({ success: true, tasks: [{ id: 1 }] });
  });

  it('get-task-suggestions: recordingId no numérico → "ID inválido"', async () => {
    const result = await handlers['get-task-suggestions']({}, 'xyz');
    expect(result).toEqual({ success: false, error: 'ID inválido' });
  });
});

describe('add-task-suggestion — defaults y boundary de createdByAi', () => {
  it('layer ausente → default "general"', async () => {
    dbServiceMock.addTaskSuggestion.mockReturnValue({ id: 1 });
    await handlers['add-task-suggestion']({}, 1, 'Título', 'Contenido', undefined, undefined);
    expect(dbServiceMock.addTaskSuggestion).toHaveBeenCalledWith(1, 'Título', 'Contenido', 'general', 1);
  });

  it('createdByAi === false → se guarda como 0', async () => {
    dbServiceMock.addTaskSuggestion.mockReturnValue({ id: 1 });
    await handlers['add-task-suggestion']({}, 1, 't', 'c', 'general', false);
    expect(dbServiceMock.addTaskSuggestion).toHaveBeenCalledWith(1, 't', 'c', 'general', 0);
  });

  it('BOUNDARY: createdByAi === 0 (falsy pero !== false) → se guarda como 1, no como 0', async () => {
    // El guard es `createdByAi !== false ? 1 : 0`, una comparación estricta
    // contra `false`. Cualquier valor "falsy" que no sea literalmente el
    // booleano `false` (0, '', null, undefined) cae en la rama `1`. Documenta
    // el comportamiento real, no necesariamente el intencionado si el caller
    // alguna vez pasa 0 esperando que se interprete como "no generado por IA".
    dbServiceMock.addTaskSuggestion.mockReturnValue({ id: 1 });
    await handlers['add-task-suggestion']({}, 1, 't', 'c', 'general', 0);
    expect(dbServiceMock.addTaskSuggestion).toHaveBeenCalledWith(1, 't', 'c', 'general', 1);
  });

  it('recordingId no numérico → "ID inválido" sin llamar a dbService', async () => {
    const result = await handlers['add-task-suggestion']({}, 'abc', 't', 'c');
    expect(result).toEqual({ success: false, error: 'ID inválido' });
    expect(dbServiceMock.addTaskSuggestion).not.toHaveBeenCalled();
  });
});

describe('update-task-suggestion — defaults', () => {
  it('layer y status ausentes → defaults "general" / "backlog"', async () => {
    dbServiceMock.updateTaskSuggestion.mockReturnValue({ id: 1 });
    await handlers['update-task-suggestion']({}, 1, 't', 'c', undefined, undefined);
    expect(dbServiceMock.updateTaskSuggestion).toHaveBeenCalledWith(1, 't', 'c', 'general', 'backlog');
  });

  it('layer y status provistos → se respetan tal cual', async () => {
    dbServiceMock.updateTaskSuggestion.mockReturnValue({ id: 1 });
    await handlers['update-task-suggestion']({}, 1, 't', 'c', 'frontend', 'done');
    expect(dbServiceMock.updateTaskSuggestion).toHaveBeenCalledWith(1, 't', 'c', 'frontend', 'done');
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Comentarios de tareas — a diferencia de get-task-suggestions, ESTOS NO
// validan que el ID sea numérico: parseInt(NaN) se pasa tal cual a dbService.
// ─────────────────────────────────────────────────────────────────────────

describe('get-task-comments / add-task-comment — BOUNDARY: sin validación de ID (inconsistente con get-task-suggestions)', () => {
  it('get-task-comments: taskId no numérico → NaN se pasa igual a dbService, sin guard "ID inválido"', async () => {
    dbServiceMock.getTaskComments.mockReturnValue([]);
    const result = await handlers['get-task-comments']({}, 'abc');
    expect(dbServiceMock.getTaskComments).toHaveBeenCalledWith(NaN);
    expect(result).toEqual({ success: true, comments: [] });
  });

  it('add-task-comment: taskId no numérico → mismo comportamiento, NaN pasa sin validar', async () => {
    dbServiceMock.addTaskComment.mockReturnValue({ id: 1 });
    await handlers['add-task-comment']({}, 'xyz', 'contenido');
    expect(dbServiceMock.addTaskComment).toHaveBeenCalledWith(NaN, 'contenido');
  });

  it('add-task-comment: camino feliz con taskId numérico', async () => {
    dbServiceMock.addTaskComment.mockReturnValue({ id: 5, content: 'hola' });
    const result = await handlers['add-task-comment']({}, 3, 'hola');
    expect(dbServiceMock.addTaskComment).toHaveBeenCalledWith(3, 'hola');
    expect(result).toEqual({ success: true, comment: { id: 5, content: 'hola' } });
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Wrappers finos: delete-task-comment, create-project-task,
// add-task-to-project, remove-task-from-project, delete-task-suggestion —
// sin validación propia en el handler, delegan y propagan errores de
// dbService. 1-2 tests cada uno.
// ─────────────────────────────────────────────────────────────────────────

describe('wrappers finos de dbService (tareas)', () => {
  it('delete-task-comment delega en dbService.deleteTaskComment', async () => {
    const result = await handlers['delete-task-comment']({}, 7);
    expect(dbServiceMock.deleteTaskComment).toHaveBeenCalledWith(7);
    expect(result).toEqual({ success: true });
  });

  it('create-project-task delega con todos los argumentos tal cual (sin defaults propios)', async () => {
    dbServiceMock.createProjectTask.mockReturnValue({ id: 9 });
    const result = await handlers['create-project-task']({}, 1, 'Título', 'Contenido', 'backend', 'todo');
    expect(dbServiceMock.createProjectTask).toHaveBeenCalledWith(1, 'Título', 'Contenido', 'backend', 'todo');
    expect(result).toEqual({ success: true, task: { id: 9 } });
  });

  it('add-task-to-project: sin validación de "ya vinculada" en el handler — un error de dbService simplemente se propaga', async () => {
    // La lógica de "tarea ya vinculada a este proyecto" (si existe) vive en
    // dbService/taskRepository, no en este ipc-handler: aquí sólo hay un
    // try/catch alrededor de la llamada. Documentamos la propagación.
    dbServiceMock.addTaskToProject.mockImplementation(() => {
      throw new Error('La tarea ya está vinculada a este proyecto');
    });

    const result = await handlers['add-task-to-project']({}, 1, 2);

    expect(result).toEqual({ success: false, error: 'La tarea ya está vinculada a este proyecto' });
  });

  it('add-task-to-project: camino feliz delega tal cual', async () => {
    dbServiceMock.addTaskToProject.mockReturnValue({ id: 1, projectId: 2 });
    const result = await handlers['add-task-to-project']({}, 1, 2);
    expect(dbServiceMock.addTaskToProject).toHaveBeenCalledWith(1, 2);
    expect(result).toEqual({ success: true, task: { id: 1, projectId: 2 } });
  });

  it('remove-task-from-project delega en dbService.removeTaskFromProject', async () => {
    const result = await handlers['remove-task-from-project']({}, 3);
    expect(dbServiceMock.removeTaskFromProject).toHaveBeenCalledWith(3);
    expect(result).toEqual({ success: true });
  });

  it('delete-task-suggestion delega en dbService.deleteTaskSuggestion', async () => {
    const result = await handlers['delete-task-suggestion']({}, 4);
    expect(dbServiceMock.deleteTaskSuggestion).toHaveBeenCalledWith(4);
    expect(result).toEqual({ success: true });
  });
});

// ─────────────────────────────────────────────────────────────────────────
// update-tasks-sort-order — el handler NO contiene el algoritmo de
// reordenación; es un wrapper directo sobre dbService.updateTasksSortOrder.
// Documentado: la lógica real de renumeración vive en dbService/taskRepository
// (mockeado aquí), no en la capa IPC. Se testea la delegación con boundaries
// de tamaño de lista y la propagación de errores.
// ─────────────────────────────────────────────────────────────────────────

describe('update-tasks-sort-order — wrapper (sin lógica de reordenación en este archivo)', () => {
  it('lista vacía se pasa tal cual, sin lanzar', async () => {
    const result = await handlers['update-tasks-sort-order']({}, []);
    expect(dbServiceMock.updateTasksSortOrder).toHaveBeenCalledWith([]);
    expect(result).toEqual({ success: true });
  });

  it('un único elemento se pasa tal cual', async () => {
    const updates = [{ id: 1, sortOrder: 0 }];
    await handlers['update-tasks-sort-order']({}, updates);
    expect(dbServiceMock.updateTasksSortOrder).toHaveBeenCalledWith(updates);
  });

  it('reordenación de varios elementos (cambio de orden relativo) se pasa intacta a dbService', async () => {
    const updates = [
      { id: 3, sortOrder: 0 },
      { id: 1, sortOrder: 1 },
      { id: 2, sortOrder: 2 },
    ];
    await handlers['update-tasks-sort-order']({}, updates);
    expect(dbServiceMock.updateTasksSortOrder).toHaveBeenCalledWith(updates);
  });

  it('dbService.updateTasksSortOrder lanza → capturado, success:false con el mensaje', async () => {
    dbServiceMock.updateTasksSortOrder.mockImplementation(() => {
      throw new Error('constraint violation');
    });

    const result = await handlers['update-tasks-sort-order']({}, [{ id: 1, sortOrder: 0 }]);

    expect(result).toEqual({ success: false, error: 'constraint violation' });
  });
});

// ─────────────────────────────────────────────────────────────────────────
// save-generating-state / get-generating-state / clear-generating-state —
// máquina de estados de "generación en curso" por grabación.
// ─────────────────────────────────────────────────────────────────────────

describe('estado de generación (save / get / clear)', () => {
  it('get: sin estado guardado → error "No existe estado de generación"', async () => {
    fs.existsSync.mockReturnValue(false);
    const result = await handlers['get-generating-state']({}, 1);
    expect(result).toEqual({ success: false, error: 'No existe estado de generación' });
  });

  it('save→get round-trip', async () => {
    fs.existsSync.mockReturnValue(false);
    const state = { inProgress: true, step: 'summary' };

    await handlers['save-generating-state']({}, 1, state);
    const written = fs.promises.writeFile.mock.calls[0][1];

    fs.existsSync.mockReturnValue(true);
    fs.promises.readFile.mockResolvedValue(written);
    const result = await handlers['get-generating-state']({}, 1);

    expect(result).toEqual({ success: true, state });
  });

  it('clear: estado existente → se elimina con unlink', async () => {
    fs.existsSync.mockReturnValue(true);

    const result = await handlers['clear-generating-state']({}, 1);

    expect(fs.promises.unlink).toHaveBeenCalledWith(expect.stringContaining('.generating.json'));
    expect(result).toEqual({ success: true });
  });

  it('BOUNDARY: clear sobre un estado YA limpiado (archivo no existe) → no llama a unlink, sigue devolviendo success:true (idempotente)', async () => {
    fs.existsSync.mockReturnValue(false);

    const result = await handlers['clear-generating-state']({}, 1);

    expect(fs.promises.unlink).not.toHaveBeenCalled();
    expect(result).toEqual({ success: true });
  });

  it('clear: unlink falla (permiso denegado) → capturado, success:false', async () => {
    fs.existsSync.mockReturnValue(true);
    fs.promises.unlink.mockRejectedValue(new Error('EACCES'));

    const result = await handlers['clear-generating-state']({}, 1);

    expect(result).toEqual({ success: false, error: 'EACCES' });
  });
});

// ─────────────────────────────────────────────────────────────────────────
// capture-area-png — el handler más distinto del archivo: usa BrowserWindow
// en vez de fs/dbService.
// ─────────────────────────────────────────────────────────────────────────

describe('capture-area-png', () => {
  it('sin ventana asociada al webContents → error "No window found" sin llamar a capturePage', async () => {
    BrowserWindowMock.fromWebContents.mockReturnValue(null);

    const result = await handlers['capture-area-png']({ sender: {} }, { x: 0, y: 0, width: 10, height: 10 });

    expect(result).toEqual({ success: false, error: 'No window found' });
    expect(capturePageMock).not.toHaveBeenCalled();
  });

  it('camino feliz: redondea x/y/width/height y devuelve el PNG capturado', async () => {
    const fakePng = Buffer.from('fake-png-bytes');
    capturePageMock.mockResolvedValue({ toPNG: () => fakePng });

    const result = await handlers['capture-area-png'](
      { sender: {} },
      { x: 10.4, y: 10.5, width: 99.6, height: 50.2 }
    );

    expect(capturePageMock).toHaveBeenCalledWith({ x: 10, y: 11, width: 100, height: 50 });
    expect(result).toEqual({ success: true, buffer: fakePng });
  });

  it('capturePage lanza (p.ej. rect fuera de pantalla) → capturado, success:false con el mensaje', async () => {
    capturePageMock.mockRejectedValue(new Error('Invalid capture area'));

    const result = await handlers['capture-area-png']({ sender: {} }, { x: 0, y: 0, width: 10, height: 10 });

    expect(result).toEqual({ success: false, error: 'Invalid capture area' });
  });
});
