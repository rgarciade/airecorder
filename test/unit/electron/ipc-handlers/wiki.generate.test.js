import { beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';

const queryMocks = vi.hoisted(() => ({
  listPagesByProject: vi.fn(),
  createPage: vi.fn(),
  updatePage: vi.fn(),
  deletePage: vi.fn(),
  getPageBySlug: vi.fn(),
  countPagesByProject: vi.fn(),
}));

vi.mock('../../../../electron/database/wiki/queries.js', () => queryMocks);
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/tmp'),
  },
}));
vi.mock('../../../../electron/utils/paths.js', () => ({
  PROJECTS_PATH: '/tmp/projects',
}));

describe('wiki:generate-starter-page', () => {
  let handlers;
  let registerWikiHandlers;
  let __setWikiQueries;
  let __setStarterGenerator;
  let __setProjectsPath;

  beforeEach(async () => {
    handlers = new Map();
    const ipcMain = {
      handle: vi.fn((channel, handler) => handlers.set(channel, handler)),
    };

    Object.values(queryMocks).forEach((mockFn) => mockFn.mockReset());

    ({
      registerWikiHandlers,
      __setWikiQueries,
      __setStarterGenerator,
      __setProjectsPath,
    } = await import('../../../../electron/ipc-handlers/wiki.js'));

    __setWikiQueries(queryMocks);
    __setProjectsPath('/tmp/projects');
    registerWikiHandlers(ipcMain);
  });

  it('crea página inicial cuando no hay páginas y existe análisis', async () => {
    queryMocks.countPagesByProject.mockReturnValue(0);
    queryMocks.getPageBySlug.mockReturnValue(null);
    queryMocks.createPage.mockReturnValue({ id: 1, project_id: 7, title: 'Resumen del proyecto', slug: 'resumen-del-proyecto' });
    queryMocks.updatePage.mockReturnValue({ id: 1 });

    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs.promises, 'readFile').mockResolvedValue(JSON.stringify({ summary: 'x' }));
    __setStarterGenerator(vi.fn().mockResolvedValue('# Resumen\n\nContenido'));

    const result = await handlers.get('wiki:generate-starter-page')(null, 7, { language: 'es', projectName: 'Proyecto X' });

    expect(result.success).toBe(true);
    expect(queryMocks.createPage).toHaveBeenCalled();
    expect(queryMocks.updatePage).toHaveBeenCalled();
  });

  it('es idempotente: si ya hay páginas devuelve skipped', async () => {
    queryMocks.countPagesByProject.mockReturnValue(2);

    const result = await handlers.get('wiki:generate-starter-page')(null, 7, { language: 'es' });

    expect(result).toEqual({ success: true, skipped: true });
    expect(queryMocks.createPage).not.toHaveBeenCalled();
  });

  it('si falla generación AI, no crea página y devuelve error', async () => {
    queryMocks.countPagesByProject.mockReturnValue(0);
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs.promises, 'readFile').mockResolvedValue(JSON.stringify({ summary: 'x' }));
    __setStarterGenerator(vi.fn().mockRejectedValue(new Error('provider down')));

    const result = await handlers.get('wiki:generate-starter-page')(null, 7, { language: 'es' });

    expect(result.success).toBe(false);
    expect(result.error).toContain('provider down');
    expect(queryMocks.createPage).not.toHaveBeenCalled();
  });
});
