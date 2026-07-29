/**
 * projects.test.js
 *
 * Tests unitarios para electron/ipc-handlers/projects.js — 18 canales IPC
 * de gestión de proyectos: CRUD de proyecto, vínculo proyecto↔grabación,
 * duración total, chats de proyecto (CRUD + historial + reemplazo atómico
 * para /compact) y análisis de proyecto persistido en disco.
 *
 * projects.js hace, a nivel de módulo:
 *   const { ipcMain } = require('electron');
 *   const fs = require('fs');
 *   const path = require('path');
 *   const dbService = require('../database/dbService');
 *   const { PROJECTS_PATH } = require('../utils/paths');
 * Todos CJS puro → mismo patrón de esta sesión (ver cabecera de
 * recordings.test.js / analysis.test.js): mocks inyectados en
 * `require.cache` vía `createRequire(import.meta.url)` en beforeAll/afterAll,
 * import dinámico del módulo bajo test en beforeEach, e `ipcMain.handle`
 * capturando cada callback en `handlers`. `fs` es un módulo core de Node —
 * se espía con `vi.spyOn` (no se inyecta en require.cache), compartiendo el
 * mismo objeto de módulo que projects.js usa. `path` se usa tal cual (real),
 * igual que en recordings.test.js, para construir las rutas esperadas.
 *
 * ALCANCE: 18 handlers, casi todos wrappers finos try/catch sobre dbService
 * (CRUD estructuralmente idéntico al de analysis.js/recordings.js). Se
 * testean a fondo 2 clusters representativos:
 *   - ciclo CRUD completo de proyecto (create/get/update/delete-project)
 *   - cluster de chats de proyecto (create/get-history/save-message/replace-messages)
 * y con profundidad moderada save-project-analysis/get-project-analysis (el
 * único par con lógica de filesystem real en este archivo, análogo a los
 * pares save/get de analysis.js). El resto (add/remove-recording-to-project,
 * get-project-recordings, get-recording-project, get-project-total-duration,
 * get-project-chats/delete-project-chat/clear-project-chat-messages) recibe
 * 1-2 tests de conectividad, sin repetir profundidad en wrappers casi
 * idénticos.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'fs';
import path from 'path';

const nodeRequire = createRequire(import.meta.url);
const electronPath = nodeRequire.resolve('electron');
const dbServicePath = nodeRequire.resolve('../../../../electron/database/dbService.js');
const pathsPath = nodeRequire.resolve('../../../../electron/utils/paths.js');

let originalElectronEntry;
let originalDbServiceEntry;
let originalPathsEntry;

// ── Mocks de electron ───────────────────────────────────────────────────
const handlers = {};
const ipcMainMock = {
  handle: vi.fn((channel, cb) => {
    handlers[channel] = cb;
  }),
};

// ── Mock de dbService ────────────────────────────────────────────────────
const dbServiceMock = {
  getAllProjects: vi.fn(),
  createProject: vi.fn(),
  updateProject: vi.fn(),
  deleteProject: vi.fn(),
  addRecordingToProject: vi.fn(),
  removeRecordingFromProject: vi.fn(),
  getProjectRecordingIds: vi.fn(),
  getRecordingProject: vi.fn(),
  getProjectTotalDuration: vi.fn(),
  getProjectChats: vi.fn(),
  createProjectChat: vi.fn(),
  deleteProjectChat: vi.fn(),
  getChatMessages: vi.fn(),
  clearChatMessages: vi.fn(),
  saveProjectChatMessage: vi.fn(),
  replaceChatMessages: vi.fn(),
  updateProjectSyncStatus: vi.fn(),
};

// ── Mock de paths.js — PROJECTS_PATH es una constante de string ─────────
const FAKE_PROJECTS_PATH = '/fake/userData/projects';
const pathsMock = { PROJECTS_PATH: FAKE_PROJECTS_PATH };

beforeAll(() => {
  originalElectronEntry = nodeRequire.cache[electronPath];
  nodeRequire.cache[electronPath] = {
    id: electronPath,
    filename: electronPath,
    loaded: true,
    exports: { ipcMain: ipcMainMock },
  };

  originalDbServiceEntry = nodeRequire.cache[dbServicePath];
  nodeRequire.cache[dbServicePath] = {
    id: dbServicePath,
    filename: dbServicePath,
    loaded: true,
    exports: dbServiceMock,
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
  if (originalPathsEntry) nodeRequire.cache[pathsPath] = originalPathsEntry;
  else delete nodeRequire.cache[pathsPath];
});

let projectsHandlers;

function resetAllMocks() {
  [ipcMainMock.handle, ...Object.values(dbServiceMock)].forEach((fn) => fn.mockReset());

  ipcMainMock.handle.mockImplementation((channel, cb) => {
    handlers[channel] = cb;
  });
}

beforeEach(async () => {
  Object.keys(handlers).forEach((k) => delete handlers[k]);
  resetAllMocks();

  vi.restoreAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});

  vi.spyOn(fs, 'existsSync').mockReturnValue(false);
  vi.spyOn(fs, 'mkdirSync').mockImplementation(() => {});
  vi.spyOn(fs.promises, 'writeFile').mockResolvedValue(undefined);
  vi.spyOn(fs.promises, 'readFile').mockRejectedValue(new Error('ENOENT (readFile no configurado en este test)'));

  projectsHandlers = await import('../../../../electron/ipc-handlers/projects.js');
  projectsHandlers.registerProjectsHandlers();
});

// ─────────────────────────────────────────────────────────────────────────
// Ciclo CRUD completo de proyecto.
// ─────────────────────────────────────────────────────────────────────────

describe('get-projects', () => {
  it('camino feliz: devuelve la lista de proyectos tal cual', async () => {
    const projects = [{ id: 1, name: 'Proyecto A' }];
    dbServiceMock.getAllProjects.mockReturnValue(projects);

    const result = await handlers['get-projects']();

    expect(result).toEqual({ success: true, projects });
  });

  it('dbService lanza → capturado, success:false', async () => {
    dbServiceMock.getAllProjects.mockImplementation(() => {
      throw new Error('BD no disponible');
    });

    const result = await handlers['get-projects']();

    expect(result).toEqual({ success: false, error: 'BD no disponible' });
  });
});

describe('create-project', () => {
  it('sin members → default a array vacío', async () => {
    dbServiceMock.createProject.mockReturnValue({ id: 1, name: 'Proyecto A' });

    const result = await handlers['create-project']({}, { name: 'Proyecto A', description: 'desc' });

    expect(dbServiceMock.createProject).toHaveBeenCalledWith('Proyecto A', 'desc', []);
    expect(result).toEqual({ success: true, project: { id: 1, name: 'Proyecto A' } });
  });

  it('con members provisto → se respeta tal cual', async () => {
    dbServiceMock.createProject.mockReturnValue({ id: 1 });
    const members = ['ana@x.com', 'bruno@x.com'];

    await handlers['create-project']({}, { name: 'P', description: 'd', members });

    expect(dbServiceMock.createProject).toHaveBeenCalledWith('P', 'd', members);
  });

  it('dbService lanza → capturado, success:false', async () => {
    dbServiceMock.createProject.mockImplementation(() => {
      throw new Error('nombre duplicado');
    });

    const result = await handlers['create-project']({}, { name: 'P' });

    expect(result).toEqual({ success: false, error: 'nombre duplicado' });
  });

  it('BOUNDARY: projectData ausente (undefined) → TypeError interno al leer .name, capturado igual por el catch genérico', async () => {
    const result = await handlers['create-project']({}, undefined);

    expect(result.success).toBe(false);
    expect(dbServiceMock.createProject).not.toHaveBeenCalled();
  });
});

describe('update-project', () => {
  it('camino feliz: delega los 4 argumentos tal cual', async () => {
    dbServiceMock.updateProject.mockReturnValue({ id: 1, name: 'Nuevo nombre' });

    const result = await handlers['update-project'](
      {},
      1,
      { name: 'Nuevo nombre', description: 'desc', members: ['ana@x.com'] }
    );

    expect(dbServiceMock.updateProject).toHaveBeenCalledWith(1, 'Nuevo nombre', 'desc', ['ana@x.com']);
    expect(result).toEqual({ success: true, project: { id: 1, name: 'Nuevo nombre' } });
  });

  it('DOCUMENTADO (asimetría, no bug confirmado): a diferencia de create-project, aquí `members` NO tiene default `|| []` — si se omite, se pasa `undefined` tal cual a dbService', async () => {
    dbServiceMock.updateProject.mockReturnValue({ id: 1 });

    await handlers['update-project']({}, 1, { name: 'N', description: 'd' });

    expect(dbServiceMock.updateProject).toHaveBeenCalledWith(1, 'N', 'd', undefined);
  });

  it('dbService lanza → capturado, success:false', async () => {
    dbServiceMock.updateProject.mockImplementation(() => {
      throw new Error('proyecto no encontrado');
    });

    const result = await handlers['update-project']({}, 999, { name: 'X' });

    expect(result).toEqual({ success: false, error: 'proyecto no encontrado' });
  });
});

describe('delete-project', () => {
  it('camino feliz', async () => {
    const result = await handlers['delete-project']({}, 1);

    expect(dbServiceMock.deleteProject).toHaveBeenCalledWith(1);
    expect(result).toEqual({ success: true });
  });

  it('dbService lanza → capturado, success:false', async () => {
    dbServiceMock.deleteProject.mockImplementation(() => {
      throw new Error('FK: grabaciones asociadas');
    });

    const result = await handlers['delete-project']({}, 1);

    expect(result).toEqual({ success: false, error: 'FK: grabaciones asociadas' });
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Vínculo proyecto↔grabación y duración — wrappers finos, 1-2 tests c/u.
// ─────────────────────────────────────────────────────────────────────────

describe('add-recording-to-project / remove-recording-from-project', () => {
  it('add: delega y devuelve success:true', async () => {
    const result = await handlers['add-recording-to-project']({}, 1, 42);
    expect(dbServiceMock.addRecordingToProject).toHaveBeenCalledWith(1, 42);
    expect(result).toEqual({ success: true });
  });

  it('add: dbService lanza → capturado, success:false', async () => {
    dbServiceMock.addRecordingToProject.mockImplementation(() => {
      throw new Error('ya vinculada');
    });
    const result = await handlers['add-recording-to-project']({}, 1, 42);
    expect(result).toEqual({ success: false, error: 'ya vinculada' });
  });

  it('remove: delega y devuelve success:true', async () => {
    const result = await handlers['remove-recording-from-project']({}, 1, 42);
    expect(dbServiceMock.removeRecordingFromProject).toHaveBeenCalledWith(1, 42);
    expect(result).toEqual({ success: true });
  });

  it('remove: dbService lanza → capturado, success:false', async () => {
    dbServiceMock.removeRecordingFromProject.mockImplementation(() => {
      throw new Error('no estaba vinculada');
    });
    const result = await handlers['remove-recording-from-project']({}, 1, 42);
    expect(result).toEqual({ success: false, error: 'no estaba vinculada' });
  });
});

describe('get-project-recordings', () => {
  it('camino feliz: devuelve los IDs tal cual', async () => {
    dbServiceMock.getProjectRecordingIds.mockReturnValue([1, 2, 3]);
    const result = await handlers['get-project-recordings']({}, 1);
    expect(result).toEqual({ success: true, recordings: [1, 2, 3] });
  });

  it('dbService lanza → capturado, success:false', async () => {
    dbServiceMock.getProjectRecordingIds.mockImplementation(() => {
      throw new Error('proyecto no encontrado');
    });
    const result = await handlers['get-project-recordings']({}, 1);
    expect(result).toEqual({ success: false, error: 'proyecto no encontrado' });
  });
});

describe('get-recording-project', () => {
  it('sin proyecto asociado (dbService devuelve null/falsy) → error "Sin proyecto"', async () => {
    dbServiceMock.getRecordingProject.mockReturnValue(null);
    const result = await handlers['get-recording-project']({}, 1);
    expect(result).toEqual({ success: false, error: 'Sin proyecto' });
  });

  it('camino feliz: devuelve el proyecto', async () => {
    dbServiceMock.getRecordingProject.mockReturnValue({ id: 5, name: 'P' });
    const result = await handlers['get-recording-project']({}, 1);
    expect(result).toEqual({ success: true, project: { id: 5, name: 'P' } });
  });

  it('dbService lanza → capturado, success:false', async () => {
    dbServiceMock.getRecordingProject.mockImplementation(() => {
      throw new Error('error de consulta');
    });
    const result = await handlers['get-recording-project']({}, 1);
    expect(result).toEqual({ success: false, error: 'error de consulta' });
  });
});

describe('get-project-total-duration', () => {
  it('camino feliz', async () => {
    dbServiceMock.getProjectTotalDuration.mockReturnValue(3600);
    const result = await handlers['get-project-total-duration']({}, 1);
    expect(result).toEqual({ success: true, duration: 3600 });
  });

  it('dbService lanza → capturado, success:false', async () => {
    dbServiceMock.getProjectTotalDuration.mockImplementation(() => {
      throw new Error('proyecto no encontrado');
    });
    const result = await handlers['get-project-total-duration']({}, 1);
    expect(result).toEqual({ success: false, error: 'proyecto no encontrado' });
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Cluster de chats de proyecto — testeado a fondo como pareja
// representativa (creación con id generado, historial, mensaje individual,
// reemplazo atómico para /compact).
// ─────────────────────────────────────────────────────────────────────────

describe('get-project-chats', () => {
  it('camino feliz: delega y devuelve la lista', async () => {
    dbServiceMock.getProjectChats.mockReturnValue([{ id: 'chat_1' }]);
    const result = await handlers['get-project-chats']({}, 1);
    expect(dbServiceMock.getProjectChats).toHaveBeenCalledWith(1);
    expect(result).toEqual({ success: true, chats: [{ id: 'chat_1' }] });
  });

  it('dbService lanza → capturado, success:false', async () => {
    dbServiceMock.getProjectChats.mockImplementation(() => {
      throw new Error('proyecto no encontrado');
    });
    const result = await handlers['get-project-chats']({}, 1);
    expect(result).toEqual({ success: false, error: 'proyecto no encontrado' });
  });
});

describe('create-project-chat', () => {
  it('genera el id con el prefijo "chat_" + Date.now() y delega los demás argumentos', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1700000000000);
    dbServiceMock.createProjectChat.mockImplementation((id, projectId, name, contextRecordings) => ({
      id, projectId, name, contextRecordings,
    }));

    const result = await handlers['create-project-chat']({}, 1, 'Chat 1', [10, 20]);

    expect(dbServiceMock.createProjectChat).toHaveBeenCalledWith('chat_1700000000000', 1, 'Chat 1', [10, 20]);
    expect(result).toEqual({
      success: true,
      chat: { id: 'chat_1700000000000', projectId: 1, name: 'Chat 1', contextRecordings: [10, 20] },
    });
  });

  it('dbService lanza → capturado, success:false', async () => {
    dbServiceMock.createProjectChat.mockImplementation(() => {
      throw new Error('proyecto no encontrado');
    });

    const result = await handlers['create-project-chat']({}, 1, 'Chat 1', []);

    expect(result).toEqual({ success: false, error: 'proyecto no encontrado' });
  });
});

describe('delete-project-chat', () => {
  it('camino feliz: delega en dbService.deleteProjectChat', async () => {
    const result = await handlers['delete-project-chat']({}, 'chat_1');
    expect(dbServiceMock.deleteProjectChat).toHaveBeenCalledWith('chat_1');
    expect(result).toEqual({ success: true });
  });

  it('dbService lanza → capturado, success:false', async () => {
    dbServiceMock.deleteProjectChat.mockImplementation(() => {
      throw new Error('chat no encontrado');
    });
    const result = await handlers['delete-project-chat']({}, 'chat_1');
    expect(result).toEqual({ success: false, error: 'chat no encontrado' });
  });
});

describe('get-project-chat-history', () => {
  it('camino feliz: devuelve el historial tal cual', async () => {
    dbServiceMock.getChatMessages.mockReturnValue([{ tipo: 'user', contenido: 'hola' }]);
    const result = await handlers['get-project-chat-history']({}, 'chat_1');
    expect(result).toEqual({ success: true, history: [{ tipo: 'user', contenido: 'hola' }] });
  });

  it('dbService lanza → capturado, success:false', async () => {
    dbServiceMock.getChatMessages.mockImplementation(() => {
      throw new Error('chat no encontrado');
    });
    const result = await handlers['get-project-chat-history']({}, 'chat_1');
    expect(result).toEqual({ success: false, error: 'chat no encontrado' });
  });
});

describe('clear-project-chat-messages', () => {
  it('camino feliz: delega en dbService.clearChatMessages', async () => {
    const result = await handlers['clear-project-chat-messages']({}, 'chat_1');
    expect(dbServiceMock.clearChatMessages).toHaveBeenCalledWith('chat_1');
    expect(result).toEqual({ success: true });
  });

  it('dbService lanza → capturado, success:false', async () => {
    dbServiceMock.clearChatMessages.mockImplementation(() => {
      throw new Error('chat no encontrado');
    });
    const result = await handlers['clear-project-chat-messages']({}, 'chat_1');
    expect(result).toEqual({ success: false, error: 'chat no encontrado' });
  });
});

describe('save-project-chat-message', () => {
  it('camino feliz: destructura message.tipo/contenido y delega', async () => {
    dbServiceMock.saveProjectChatMessage.mockReturnValue({ id: 1, tipo: 'user', contenido: 'hola' });

    const result = await handlers['save-project-chat-message']({}, 'chat_1', { tipo: 'user', contenido: 'hola' });

    expect(dbServiceMock.saveProjectChatMessage).toHaveBeenCalledWith('chat_1', 'user', 'hola');
    expect(result).toEqual({ success: true, message: { id: 1, tipo: 'user', contenido: 'hola' } });
  });

  it('DOCUMENTADO (no bug confirmado): message ausente (undefined) → TypeError leyendo .tipo se filtra crudo al usuario en vez de un mensaje de validación amigable (a diferencia de otros handlers de este mismo repo que validan explícitamente campos requeridos)', async () => {
    const result = await handlers['save-project-chat-message']({}, 'chat_1', undefined);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/tipo/); // mensaje crudo de TypeError, no una validación dedicada
    expect(dbServiceMock.saveProjectChatMessage).not.toHaveBeenCalled();
  });

  it('dbService lanza → capturado, success:false', async () => {
    dbServiceMock.saveProjectChatMessage.mockImplementation(() => {
      throw new Error('chat no encontrado');
    });

    const result = await handlers['save-project-chat-message']({}, 'chat_1', { tipo: 'user', contenido: 'x' });

    expect(result).toEqual({ success: false, error: 'chat no encontrado' });
  });
});

describe('replace-project-chat-messages', () => {
  it('BOUNDARY: messages undefined → normaliza a array vacío antes de delegar', async () => {
    dbServiceMock.replaceChatMessages.mockReturnValue({ success: true });

    await handlers['replace-project-chat-messages']({}, 'chat_1', undefined);

    expect(dbServiceMock.replaceChatMessages).toHaveBeenCalledWith('chat_1', []);
  });

  it('camino feliz: messages provisto se pasa tal cual', async () => {
    dbServiceMock.replaceChatMessages.mockReturnValue({ success: true });
    const messages = [{ tipo: 'user', contenido: 'hola' }];

    const result = await handlers['replace-project-chat-messages']({}, 'chat_1', messages);

    expect(dbServiceMock.replaceChatMessages).toHaveBeenCalledWith('chat_1', messages);
    expect(result).toEqual({ success: true });
  });

  it('dbService.replaceChatMessages devuelve {success:false} → se relanza como Error y se captura, propagando el mensaje', async () => {
    dbServiceMock.replaceChatMessages.mockReturnValue({ success: false, error: 'transacción abortada' });

    const result = await handlers['replace-project-chat-messages']({}, 'chat_1', []);

    expect(result).toEqual({ success: false, error: 'transacción abortada' });
  });

  it('dbService lanza directamente (excepción, no {success:false}) → capturado igual', async () => {
    dbServiceMock.replaceChatMessages.mockImplementation(() => {
      throw new Error('BD bloqueada');
    });

    const result = await handlers['replace-project-chat-messages']({}, 'chat_1', []);

    expect(result).toEqual({ success: false, error: 'BD bloqueada' });
  });
});

// ─────────────────────────────────────────────────────────────────────────
// save-project-analysis / get-project-analysis — único par con lógica de
// filesystem real en este archivo (análogo a los pares save/get de
// analysis.js): crea el directorio si falta, escribe/lee JSON, y marca el
// proyecto como sincronizado tras guardar.
// ─────────────────────────────────────────────────────────────────────────

describe('save-project-analysis', () => {
  const analysisDir = path.join(FAKE_PROJECTS_PATH, 'projects_analysis');
  const filePath = path.join(analysisDir, '1.json');

  it('directorio projects_analysis no existe → se crea con { recursive: true } antes de escribir', async () => {
    fs.existsSync.mockReturnValue(false);

    await handlers['save-project-analysis']({}, 1, { resumen: 'x' });

    expect(fs.mkdirSync).toHaveBeenCalledWith(analysisDir, { recursive: true });
  });

  it('directorio ya existe → NO se vuelve a crear', async () => {
    fs.existsSync.mockReturnValue(true);

    await handlers['save-project-analysis']({}, 1, { resumen: 'x' });

    expect(fs.mkdirSync).not.toHaveBeenCalled();
  });

  it('camino feliz: escribe el JSON y marca el proyecto como sincronizado (syncStatus 1)', async () => {
    fs.existsSync.mockReturnValue(true);

    const result = await handlers['save-project-analysis']({}, 1, { resumen: 'x' });

    expect(fs.promises.writeFile).toHaveBeenCalledWith(filePath, JSON.stringify({ resumen: 'x' }, null, 2), 'utf8');
    expect(dbServiceMock.updateProjectSyncStatus).toHaveBeenCalledWith(1, 1);
    expect(result).toEqual({ success: true });
  });

  it('la escritura falla → capturado, NO se marca el proyecto como sincronizado', async () => {
    fs.existsSync.mockReturnValue(true);
    fs.promises.writeFile.mockRejectedValue(new Error('disk full'));

    const result = await handlers['save-project-analysis']({}, 1, { resumen: 'x' });

    expect(result).toEqual({ success: false, error: 'disk full' });
    expect(dbServiceMock.updateProjectSyncStatus).not.toHaveBeenCalled();
  });
});

describe('get-project-analysis', () => {
  const filePath = path.join(FAKE_PROJECTS_PATH, 'projects_analysis', '1.json');

  it('archivo no existe → error "Análisis no encontrado"', async () => {
    fs.existsSync.mockReturnValue(false);

    const result = await handlers['get-project-analysis']({}, 1);

    expect(result).toEqual({ success: false, error: 'Análisis no encontrado' });
  });

  it('round-trip: lee y parsea el análisis persistido', async () => {
    fs.existsSync.mockReturnValue(true);
    const analysis = { resumen: 'x', tareas: [{ id: 1 }] };
    fs.promises.readFile.mockResolvedValue(JSON.stringify(analysis));

    const result = await handlers['get-project-analysis']({}, 1);

    expect(fs.promises.readFile).toHaveBeenCalledWith(filePath, 'utf8');
    expect(result).toEqual({ success: true, analysis });
  });

  it('DOCUMENTADO: JSON corrupto NO tiene un catch interno dedicado (a diferencia de get-recording-schema en analysis.js) — cae al catch externo genérico con el mensaje crudo de JSON.parse', async () => {
    fs.existsSync.mockReturnValue(true);
    fs.promises.readFile.mockResolvedValue('{ json invalido');

    const result = await handlers['get-project-analysis']({}, 1);

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });
});
