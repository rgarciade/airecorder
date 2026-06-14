import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryMocks = vi.hoisted(() => ({
  listPagesByProject: vi.fn(),
  createPage: vi.fn(),
  updatePage: vi.fn(),
  deletePage: vi.fn(),
  getPageById: vi.fn(),
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

describe('wiki handlers', () => {
  let registerWikiHandlers;
  let handlers;
  let ipcMain;

  beforeEach(async () => {
    handlers = new Map();
    ipcMain = {
      handle: vi.fn((channel, handler) => {
        handlers.set(channel, handler);
      }),
    };

    Object.values(queryMocks).forEach((mockFn) => mockFn.mockReset());

    ({ registerWikiHandlers } = await import('../../../../electron/ipc-handlers/wiki.js'));
    const { __setWikiQueries } = await import('../../../../electron/ipc-handlers/wiki.js');
    __setWikiQueries(queryMocks);
    registerWikiHandlers(ipcMain);
  });

  it('registra wiki:list-pages y devuelve lista', async () => {
    queryMocks.listPagesByProject.mockReturnValue([{ id: 1, title: 'Page' }]);

    const result = await handlers.get('wiki:list-pages')(null, 42);

    expect(queryMocks.listPagesByProject).toHaveBeenCalledWith(42);
    expect(result).toEqual({ success: true, pages: [{ id: 1, title: 'Page' }] });
  });

  it('registra wiki:create-page y resuelve colisión de slug', async () => {
    queryMocks.getPageBySlug
      .mockReturnValueOnce({ id: 10, slug: 'decisiones-tecnicas' })
      .mockReturnValueOnce({ id: 11, slug: 'decisiones-tecnicas-2' })
      .mockReturnValueOnce(null);
    queryMocks.createPage.mockReturnValue({ id: 12, slug: 'decisiones-tecnicas-3' });

    const result = await handlers.get('wiki:create-page')(null, {
      project_id: 1,
      title: 'Decisiones técnicas',
      slug: 'decisiones-tecnicas',
    });

    expect(queryMocks.createPage).toHaveBeenCalledWith({
      project_id: 1,
      title: 'Decisiones técnicas',
      slug: 'decisiones-tecnicas-3',
    });
    expect(result).toEqual({ success: true, page: { id: 12, slug: 'decisiones-tecnicas-3' } });
  });

  it('registra wiki:update-page y actualiza página', async () => {
    queryMocks.getPageById.mockReturnValue({ id: 4, project_id: 10, slug: 'old', title: 'Old' });
    queryMocks.getPageBySlug.mockReturnValue(null);
    queryMocks.updatePage.mockReturnValue({ id: 4, title: 'Updated' });

    const result = await handlers.get('wiki:update-page')(null, 4, {
      title: 'Updated',
      slug: 'updated',
      content_md: 'new',
    });

    expect(queryMocks.updatePage).toHaveBeenCalledWith(4, {
      title: 'Updated',
      slug: 'updated',
      content_md: 'new',
    });
    expect(result).toEqual({ success: true, page: { id: 4, title: 'Updated' } });
  });

  it('wiki:update-page resuelve colisión de slug y usa sufijo', async () => {
    queryMocks.getPageById.mockReturnValue({ id: 1, project_id: 10, slug: 'a', title: 'A title' });
    queryMocks.getPageBySlug
      .mockReturnValueOnce({ id: 2, project_id: 10, slug: 'b' })
      .mockReturnValueOnce(null);
    queryMocks.updatePage.mockReturnValue({ id: 1, project_id: 10, slug: 'b-2', title: 'A title' });

    const result = await handlers.get('wiki:update-page')(null, 1, {
      slug: 'b',
      title: 'A title',
      content_md: 'body',
    });

    expect(queryMocks.updatePage).toHaveBeenCalledWith(1, {
      slug: 'b-2',
      title: 'A title',
      content_md: 'body',
    });
    expect(result).toEqual({ success: true, page: { id: 1, project_id: 10, slug: 'b-2', title: 'A title' } });
  });

  it('wiki:update-page mantiene slug si no cambió', async () => {
    queryMocks.getPageById.mockReturnValue({ id: 1, project_id: 10, slug: 'a', title: 'A title' });
    queryMocks.updatePage.mockReturnValue({ id: 1, project_id: 10, slug: 'a', title: 'A title' });

    const result = await handlers.get('wiki:update-page')(null, 1, {
      slug: 'a',
      title: 'A title',
      content_md: 'same',
    });

    expect(queryMocks.getPageBySlug).not.toHaveBeenCalled();
    expect(queryMocks.updatePage).toHaveBeenCalledWith(1, {
      slug: 'a',
      title: 'A title',
      content_md: 'same',
    });
    expect(result).toEqual({ success: true, page: { id: 1, project_id: 10, slug: 'a', title: 'A title' } });
  });

  it('wiki:update-page resuelve colisión derivada de title cuando no hay slug explícito', async () => {
    queryMocks.getPageById.mockReturnValue({ id: 1, project_id: 10, slug: 'a', title: 'A title' });
    queryMocks.getPageBySlug
      .mockReturnValueOnce({ id: 2, project_id: 10, slug: 'b-title' })
      .mockReturnValueOnce(null);
    queryMocks.updatePage.mockReturnValue({ id: 1, project_id: 10, slug: 'b-title-2', title: 'B title' });

    const result = await handlers.get('wiki:update-page')(null, 1, {
      title: 'B title',
      content_md: 'body',
    });

    expect(queryMocks.updatePage).toHaveBeenCalledWith(1, {
      title: 'B title',
      content_md: 'body',
      slug: 'b-title-2',
    });
    expect(result).toEqual({ success: true, page: { id: 1, project_id: 10, slug: 'b-title-2', title: 'B title' } });
  });

  it('wiki:update-page deriva slug desde title cuando no hay slug y no hay colisión', async () => {
    queryMocks.getPageById.mockReturnValue({ id: 5, project_id: 10, slug: 'old-slug', title: 'Old title' });
    queryMocks.getPageBySlug.mockReturnValue(null);
    queryMocks.updatePage.mockReturnValue({ id: 5, project_id: 10, slug: 'nuevo-titulo', title: 'Nuevo título' });

    const result = await handlers.get('wiki:update-page')(null, 5, {
      title: 'Nuevo título',
      content_md: 'contenido',
    });

    expect(queryMocks.updatePage).toHaveBeenCalledWith(5, {
      title: 'Nuevo título',
      content_md: 'contenido',
      slug: 'nuevo-titulo',
    });
    expect(result).toEqual({ success: true, page: { id: 5, project_id: 10, slug: 'nuevo-titulo', title: 'Nuevo título' } });
  });

  it('wiki:update-page siempre incluye slug aunque solo cambie content_md (mismo título)', async () => {
    queryMocks.getPageById.mockReturnValue({ id: 1, project_id: 10, slug: 'a-title', title: 'A title' });
    queryMocks.updatePage.mockReturnValue({ id: 1, project_id: 10, slug: 'a-title', title: 'A title', content_md: 'new content' });

    const result = await handlers.get('wiki:update-page')(null, 1, {
      title: 'A title',
      content_md: 'new content',
    });

    // getPageBySlug no debe llamarse porque el slug derivado (a-title) es el mismo que el actual
    expect(queryMocks.getPageBySlug).not.toHaveBeenCalled();
    // slug debe estar presente aunque no se haya cambiado
    expect(queryMocks.updatePage).toHaveBeenCalledWith(1, {
      title: 'A title',
      content_md: 'new content',
      slug: 'a-title',
    });
    expect(result).toEqual({ success: true, page: { id: 1, project_id: 10, slug: 'a-title', title: 'A title', content_md: 'new content' } });
  });

  it('wiki:update-page devuelve page_not_found si id no existe', async () => {
    queryMocks.getPageById.mockReturnValue(null);

    const result = await handlers.get('wiki:update-page')(null, 999, {
      slug: 'b',
      title: 'B title',
      content_md: 'body',
    });

    expect(queryMocks.updatePage).not.toHaveBeenCalled();
    expect(result).toEqual({ success: false, error: 'page_not_found' });
  });

  it('wiki:update-page propaga error cuando updatePage lanza excepción', async () => {
    queryMocks.getPageById.mockReturnValue({ id: 1, project_id: 10, slug: 'a', title: 'A title' });
    queryMocks.updatePage.mockImplementation(() => {
      throw new Error('db exploded');
    });

    const result = await handlers.get('wiki:update-page')(null, 1, {
      slug: 'a',
      title: 'A title',
      content_md: 'body',
    });

    expect(result).toEqual({ success: false, error: 'db exploded' });
  });

  it('registra wiki:delete-page y elimina página', async () => {
    queryMocks.deletePage.mockReturnValue(true);

    const result = await handlers.get('wiki:delete-page')(null, 9);

    expect(queryMocks.deletePage).toHaveBeenCalledWith(9);
    expect(result).toEqual({ success: true });
  });
});
