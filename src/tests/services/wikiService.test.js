import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  listPages,
  createPage,
  updatePage,
  deletePage,
  generateStarterPage,
} from '../../services/wikiService.js';

describe('wikiService', () => {
  beforeEach(() => {
    global.window = {
      electronAPI: {
        wiki: {
          listPages: vi.fn(),
          createPage: vi.fn(),
          updatePage: vi.fn(),
          deletePage: vi.fn(),
          generateStarterPage: vi.fn(),
        },
      },
    };
  });

  it('listPages llama electronAPI.wiki.listPages(projectId)', async () => {
    window.electronAPI.wiki.listPages.mockResolvedValue({ success: true, pages: [{ id: 1 }] });
    const pages = await listPages(7);
    expect(window.electronAPI.wiki.listPages).toHaveBeenCalledWith(7);
    expect(pages).toEqual([{ id: 1 }]);
  });

  it('createPage llama electronAPI.wiki.createPage(data)', async () => {
    const payload = { project_id: 7, title: 'Nueva página' };
    window.electronAPI.wiki.createPage.mockResolvedValue({ success: true, page: { id: 2 } });
    const page = await createPage(payload);
    expect(window.electronAPI.wiki.createPage).toHaveBeenCalledWith(payload);
    expect(page).toEqual({ id: 2 });
  });

  it('updatePage llama electronAPI.wiki.updatePage(id, data)', async () => {
    const payload = { title: 'Editada', slug: 'editada', content_md: 'hola' };
    window.electronAPI.wiki.updatePage.mockResolvedValue({ success: true, page: { id: 3, ...payload } });
    const page = await updatePage(3, payload);
    expect(window.electronAPI.wiki.updatePage).toHaveBeenCalledWith(3, payload);
    expect(page.id).toBe(3);
  });

  it('deletePage llama electronAPI.wiki.deletePage(id)', async () => {
    window.electronAPI.wiki.deletePage.mockResolvedValue({ success: true });
    const ok = await deletePage(4);
    expect(window.electronAPI.wiki.deletePage).toHaveBeenCalledWith(4);
    expect(ok).toBe(true);
  });

  it('generateStarterPage llama electronAPI.wiki.generateStarterPage(projectId, options)', async () => {
    window.electronAPI.wiki.generateStarterPage.mockResolvedValue({ success: true, page: { id: 5 } });
    const response = await generateStarterPage(9, { language: 'es' });
    expect(window.electronAPI.wiki.generateStarterPage).toHaveBeenCalledWith(9, { language: 'es' });
    expect(response.page.id).toBe(5);
  });
});
