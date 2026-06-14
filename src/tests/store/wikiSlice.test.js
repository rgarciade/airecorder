import { describe, expect, it, vi, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';

const serviceMocks = vi.hoisted(() => ({
  listPages: vi.fn(),
  createPage: vi.fn(),
  updatePage: vi.fn(),
  deletePage: vi.fn(),
  generateStarterPage: vi.fn(),
}));

vi.mock('../../services/wikiService.js', () => ({
  listPages: serviceMocks.listPages,
  createPage: serviceMocks.createPage,
  updatePage: serviceMocks.updatePage,
  deletePage: serviceMocks.deletePage,
  generateStarterPage: serviceMocks.generateStarterPage,
}));

import wikiReducer, {
  loadPages,
  createPage,
  updatePage,
  deletePage,
  generateStarterPage,
  setCurrentPage,
  clearCurrentPage,
  clearError,
  selectPagesByProject,
  selectCurrentPage,
  selectIsLoading,
  selectError,
  selectIsGenerating,
} from '../../store/slices/wikiSlice.js';

describe('wikiSlice', () => {
  beforeEach(() => {
    Object.values(serviceMocks).forEach((mockFn) => mockFn.mockReset());
  });

  it('loadPages/fulfilled guarda páginas por projectId', async () => {
    serviceMocks.listPages.mockResolvedValue([{ id: 1, project_id: 10, title: 'A' }]);
    const store = configureStore({ reducer: { wiki: wikiReducer } });

    await store.dispatch(loadPages(10));

    const pages = selectPagesByProject(10)(store.getState());
    expect(pages).toHaveLength(1);
    expect(pages[0].title).toBe('A');
  });

  it('loadPages/rejected guarda error', async () => {
    serviceMocks.listPages.mockRejectedValue(new Error('boom'));
    const store = configureStore({ reducer: { wiki: wikiReducer } });

    await store.dispatch(loadPages(10));

    expect(selectError(store.getState())).toContain('boom');
    expect(selectIsLoading(store.getState())).toBe(false);
  });

  it('createPage/fulfilled agrega página al proyecto', async () => {
    serviceMocks.createPage.mockResolvedValue({ id: 2, project_id: 10, title: 'Nueva' });
    const store = configureStore({ reducer: { wiki: wikiReducer } });

    await store.dispatch(createPage({ project_id: 10, title: 'Nueva' }));

    const pages = selectPagesByProject(10)(store.getState());
    expect(pages).toHaveLength(1);
    expect(pages[0].id).toBe(2);
  });

  it('createPage maneja error de negocio cuando success=false', async () => {
    serviceMocks.createPage.mockResolvedValue({ success: false, error: 'duplicate slug' });
    const store = configureStore({ reducer: { wiki: wikiReducer } });

    await store.dispatch(createPage({ project_id: 10, title: 'Duplicada' }));

    expect(selectError(store.getState())).toContain('duplicate slug');
  });

  it('updatePage/fulfilled actualiza página existente', async () => {
    serviceMocks.createPage.mockResolvedValue({ id: 3, project_id: 10, title: 'Antes' });
    serviceMocks.updatePage.mockResolvedValue({ id: 3, project_id: 10, title: 'Después' });
    const store = configureStore({ reducer: { wiki: wikiReducer } });

    await store.dispatch(createPage({ project_id: 10, title: 'Antes' }));
    await store.dispatch(updatePage({ id: 3, data: { title: 'Después' } }));

    const pages = selectPagesByProject(10)(store.getState());
    expect(pages[0].title).toBe('Después');
  });

  it('updatePage/fulfilled permite content_md vacío (REQ-WIKI-005)', async () => {
    serviceMocks.createPage.mockResolvedValue({ id: 31, project_id: 10, title: 'Test', content_md: 'con texto', version: 1 });
    serviceMocks.updatePage.mockResolvedValue({
      success: true,
      page: {
        id: 31,
        project_id: 10,
        title: 'Test',
        content_md: '',
        version: 2,
      },
    });
    const store = configureStore({ reducer: { wiki: wikiReducer } });

    await store.dispatch(createPage({ project_id: 10, title: 'Test' }));
    await store.dispatch(updatePage({ id: 31, data: { title: 'Test', content_md: '' } }));

    const pages = selectPagesByProject(10)(store.getState());
    expect(pages[0].content_md).toBe('');
    expect(pages[0].version).toBe(2);
  });

  it('updatePage maneja error de negocio cuando success=false', async () => {
    serviceMocks.createPage.mockResolvedValue({ id: 3, project_id: 10, title: 'Antes' });
    serviceMocks.updatePage.mockResolvedValue({ success: false, error: 'duplicate slug' });
    const store = configureStore({ reducer: { wiki: wikiReducer } });

    await store.dispatch(createPage({ project_id: 10, title: 'Antes' }));
    await store.dispatch(updatePage({ id: 3, data: { title: 'Choque slug' } }));

    expect(selectError(store.getState())).toContain('duplicate slug');
  });

  it('deletePage/fulfilled elimina página por id', async () => {
    serviceMocks.createPage.mockResolvedValue({ id: 4, project_id: 10, title: 'X' });
    serviceMocks.deletePage.mockResolvedValue(true);
    const store = configureStore({ reducer: { wiki: wikiReducer } });

    await store.dispatch(createPage({ project_id: 10, title: 'X' }));
    await store.dispatch(deletePage({ id: 4, projectId: 10 }));

    const pages = selectPagesByProject(10)(store.getState());
    expect(pages).toHaveLength(0);
  });

  it('deletePage maneja error de negocio cuando success=false', async () => {
    serviceMocks.createPage.mockResolvedValue({ id: 4, project_id: 10, title: 'X' });
    serviceMocks.deletePage.mockResolvedValue({ success: false, error: 'duplicate slug' });
    const store = configureStore({ reducer: { wiki: wikiReducer } });

    await store.dispatch(createPage({ project_id: 10, title: 'X' }));
    await store.dispatch(deletePage({ id: 4, projectId: 10 }));

    expect(selectError(store.getState())).toContain('duplicate slug');
  });

  it('createPage maneja excepción rechazada', async () => {
    serviceMocks.createPage.mockRejectedValue(new Error('network error'));
    const store = configureStore({ reducer: { wiki: wikiReducer } });

    await store.dispatch(createPage({ project_id: 10, title: 'Nueva' }));

    expect(selectError(store.getState())).toContain('network error');
  });

  it('createPage sin error cuando success=true y agrega página', async () => {
    serviceMocks.createPage.mockResolvedValue({
      success: true,
      page: { id: 22, project_id: 10, title: 'OK' },
    });
    const store = configureStore({ reducer: { wiki: wikiReducer } });

    await store.dispatch(createPage({ project_id: 10, title: 'OK' }));

    const pages = selectPagesByProject(10)(store.getState());
    expect(pages).toHaveLength(1);
    expect(pages[0].id).toBe(22);
    expect(selectError(store.getState())).toBeNull();
  });

  it('generateStarterPage thunk alterna isGenerating', async () => {
    serviceMocks.generateStarterPage.mockResolvedValue({ success: true, page: { id: 5 } });
    const store = configureStore({ reducer: { wiki: wikiReducer } });

    const pending = store.dispatch(generateStarterPage({ projectId: 10, options: { language: 'es' } }));
    expect(selectIsGenerating(store.getState())).toBe(true);
    await pending;
    expect(selectIsGenerating(store.getState())).toBe(false);
  });

  it('selectores y reducers sincrónicos funcionan', () => {
    const state0 = { wiki: wikiReducer(undefined, { type: '@@INIT' }) };
    const state1 = { wiki: wikiReducer(state0.wiki, setCurrentPage({ id: 99 })) };
    const state2 = { wiki: wikiReducer(state1.wiki, clearError()) };
    const state3 = { wiki: wikiReducer(state2.wiki, clearCurrentPage()) };

    expect(selectCurrentPage(state1)).toEqual({ id: 99 });
    expect(selectCurrentPage(state3)).toBeNull();
    expect(selectPagesByProject(123)(state3)).toEqual([]);
  });
});
