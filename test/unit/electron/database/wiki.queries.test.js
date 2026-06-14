import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestDB, initTestDB } from './dbSetup.js';
import * as wikiQueries from '../../../../electron/database/wiki/queries.js';

const WIKI_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS project_wiki_pages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    slug TEXT NOT NULL,
    title TEXT NOT NULL,
    content_md TEXT DEFAULT '',
    source_recording_ids TEXT DEFAULT '[]',
    version INTEGER DEFAULT 1,
    is_verified INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
    UNIQUE(project_id, slug)
  );
`;

describe('wikiQueries', () => {
  let db;
  let projects;

  beforeEach(() => {
    db = createTestDB();
    const services = initTestDB(db);
    projects = services.projects;
    db.exec(WIKI_TABLE_SQL);
    wikiQueries.__setDatabase(db);
  });

  it('listPagesByProject devuelve páginas ordenadas por updated_at DESC', async () => {
    const project = projects.createProject('Wiki Project');
    db.prepare("INSERT INTO project_wiki_pages (project_id, slug, title, updated_at) VALUES (?, ?, ?, ?)").run(project.id, 'primera', 'Primera', '2026-01-01 10:00:00');
    db.prepare("INSERT INTO project_wiki_pages (project_id, slug, title, updated_at) VALUES (?, ?, ?, ?)").run(project.id, 'segunda', 'Segunda', '2026-01-02 10:00:00');

    const pages = wikiQueries.listPagesByProject(project.id);

    expect(pages).toHaveLength(2);
    expect(pages[0].slug).toBe('segunda');
    expect(pages[1].slug).toBe('primera');
  });

  it('getPageById devuelve la página o null', () => {
    const project = projects.createProject('Wiki Project');
    const insert = db.prepare("INSERT INTO project_wiki_pages (project_id, slug, title) VALUES (?, ?, ?)").run(project.id, 'pagina-id', 'Página por ID');

    const found = wikiQueries.getPageById(insert.lastInsertRowid);
    const missing = wikiQueries.getPageById(999999);

    expect(found).toBeTruthy();
    expect(found.slug).toBe('pagina-id');
    expect(missing).toBeNull();
  });

  it('getPageBySlug devuelve la página por proyecto+slug o null', () => {
    const project = projects.createProject('Wiki Project');
    db.prepare("INSERT INTO project_wiki_pages (project_id, slug, title) VALUES (?, ?, ?)").run(project.id, 'slug-unico', 'Slug Único');

    const found = wikiQueries.getPageBySlug(project.id, 'slug-unico');
    const missing = wikiQueries.getPageBySlug(project.id, 'no-existe');

    expect(found).toBeTruthy();
    expect(found.title).toBe('Slug Único');
    expect(missing).toBeNull();
  });

  it('createPage crea una página con defaults esperados', () => {
    const project = projects.createProject('Wiki Project');

    const page = wikiQueries.createPage({
      project_id: project.id,
      slug: 'nueva-pagina',
      title: 'Nueva Página',
    });

    expect(page).toBeTruthy();
    expect(page.slug).toBe('nueva-pagina');
    expect(page.title).toBe('Nueva Página');
    expect(page.content_md).toBe('');
    expect(page.version).toBe(1);
    expect(page.is_verified).toBe(0);
  });

  it('updatePage actualiza contenido, incrementa versión y resetea is_verified', () => {
    const project = projects.createProject('Wiki Project');
    const insert = db.prepare("INSERT INTO project_wiki_pages (project_id, slug, title, content_md, version, is_verified) VALUES (?, ?, ?, ?, ?, ?)")
      .run(project.id, 'update-me', 'Update Me', 'contenido viejo', 1, 1);

    const updated = wikiQueries.updatePage(insert.lastInsertRowid, {
      title: 'Update Me 2',
      slug: 'update-me-2',
      content_md: 'contenido nuevo',
    });

    expect(updated.title).toBe('Update Me 2');
    expect(updated.slug).toBe('update-me-2');
    expect(updated.content_md).toBe('contenido nuevo');
    expect(updated.version).toBe(2);
    expect(updated.is_verified).toBe(0);
  });

  it('deletePage hace hard delete', () => {
    const project = projects.createProject('Wiki Project');
    const insert = db.prepare("INSERT INTO project_wiki_pages (project_id, slug, title) VALUES (?, ?, ?)").run(project.id, 'delete-me', 'Delete Me');

    const deleted = wikiQueries.deletePage(insert.lastInsertRowid);
    const found = db.prepare('SELECT * FROM project_wiki_pages WHERE id = ?').get(insert.lastInsertRowid);

    expect(deleted).toBeTruthy();
    expect(found).toBeUndefined();
  });

  it('countPagesByProject devuelve el total por proyecto', () => {
    const projectA = projects.createProject('Project A');
    const projectB = projects.createProject('Project B');

    db.prepare("INSERT INTO project_wiki_pages (project_id, slug, title) VALUES (?, ?, ?)").run(projectA.id, 'a-1', 'A 1');
    db.prepare("INSERT INTO project_wiki_pages (project_id, slug, title) VALUES (?, ?, ?)").run(projectA.id, 'a-2', 'A 2');
    db.prepare("INSERT INTO project_wiki_pages (project_id, slug, title) VALUES (?, ?, ?)").run(projectB.id, 'b-1', 'B 1');

    expect(wikiQueries.countPagesByProject(projectA.id)).toBe(2);
    expect(wikiQueries.countPagesByProject(projectB.id)).toBe(1);
  });

  it('eliminar proyecto hace cascade delete sobre project_wiki_pages (REQ-WIKI-033)', () => {
    const projectA = projects.createProject('Project A');
    const projectB = projects.createProject('Project B');

    db.prepare("INSERT INTO project_wiki_pages (project_id, slug, title) VALUES (?, ?, ?)").run(projectA.id, 'a-1', 'A 1');
    db.prepare("INSERT INTO project_wiki_pages (project_id, slug, title) VALUES (?, ?, ?)").run(projectA.id, 'a-2', 'A 2');
    db.prepare("INSERT INTO project_wiki_pages (project_id, slug, title) VALUES (?, ?, ?)").run(projectA.id, 'a-3', 'A 3');
    db.prepare("INSERT INTO project_wiki_pages (project_id, slug, title) VALUES (?, ?, ?)").run(projectB.id, 'b-1', 'B 1');

    projects.deleteProject(projectA.id);

    const remainingA = db.prepare('SELECT COUNT(*) AS count FROM project_wiki_pages WHERE project_id = ?').get(projectA.id);
    const remainingB = db.prepare('SELECT COUNT(*) AS count FROM project_wiki_pages WHERE project_id = ?').get(projectB.id);

    expect(remainingA.count).toBe(0);
    expect(remainingB.count).toBe(1);
  });
});
