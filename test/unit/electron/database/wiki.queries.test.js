import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestDB, initTestDB } from './dbSetup.js';
import * as wikiQueries from '../../../../electron/database/wiki/queries.js';
import KnowledgeDomainsService from '../../../../electron/database/knowledgeDomains/service.js';

describe('wikiQueries', () => {
  let db;
  let projects;

  beforeEach(() => {
    db = createTestDB();
    const services = initTestDB(db);
    projects = services.projects;
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

  it('rechaza slugs repetidos dentro de un proyecto y permite reutilizarlos entre proyectos', () => {
    const projectA = projects.createProject('Project A');
    const projectB = projects.createProject('Project B');
    wikiQueries.createPage({ project_id: projectA.id, slug: 'shared-slug', title: 'A' });

    expect(() => wikiQueries.createPage({ project_id: projectA.id, slug: 'shared-slug', title: 'Duplicate' })).toThrow();
    const reused = wikiQueries.createPage({ project_id: projectB.id, slug: 'shared-slug', title: 'B' });

    expect(reused).toMatchObject({ project_id: projectB.id, slug: 'shared-slug', title: 'B' });
    expect(wikiQueries.countPagesByProject(projectA.id)).toBe(1);
  });

  it('preserva source_recording_ids y devuelve null o false para mutaciones inexistentes', () => {
    const project = projects.createProject('Source IDs');
    const created = wikiQueries.createPage({
      project_id: project.id,
      slug: 'sources',
      title: 'Sources',
      source_recording_ids: '[10,20]'
    });

    expect(wikiQueries.getPageById(created.id).source_recording_ids).toBe('[10,20]');
    expect(wikiQueries.updatePage(999999, { title: 'Missing', slug: 'missing', content_md: '' })).toBeNull();
    expect(wikiQueries.deletePage(999999)).toBe(false);
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

  describe('integración con dominios de conocimiento', () => {
    let service;

    beforeEach(() => {
      service = new KnowledgeDomainsService(db);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    function knowledgeItemFor(projectId, pageId) {
      return db
        .prepare('SELECT * FROM knowledge_items WHERE project_id = ? AND entity_type = ? AND entity_id = ?')
        .get(projectId, 'wiki_page', String(pageId));
    }

    function domain(projectId, slug) {
      return db.prepare('SELECT * FROM knowledge_domains WHERE project_id = ? AND slug = ?').get(projectId, slug);
    }

    it('createPage registra atómicamente un ítem de conocimiento canónico sin membresías', () => {
      const project = projects.createProject('Atomic Create');

      const page = wikiQueries.createPage({ project_id: project.id, slug: 'atomic-create', title: 'Atomic Create' });

      const item = knowledgeItemFor(project.id, page.id);
      expect(item).toBeTruthy();
      expect(db.prepare('SELECT COUNT(*) AS count FROM knowledge_item_domains WHERE item_id = ?').get(item.id).count).toBe(0);
    });

    it('deletePage elimina atómicamente el ítem de conocimiento y sus membresías', () => {
      const project = projects.createProject('Atomic Delete');
      const page = wikiQueries.createPage({ project_id: project.id, slug: 'atomic-delete', title: 'Atomic Delete' });
      const item = knowledgeItemFor(project.id, page.id);
      const technical = domain(project.id, 'technical');
      service.addMembership({ projectId: project.id, itemId: item.id, domainId: technical.id });

      const deleted = wikiQueries.deletePage(page.id);

      expect(deleted).toBe(true);
      expect(knowledgeItemFor(project.id, page.id)).toBeUndefined();
      expect(db.prepare('SELECT COUNT(*) AS count FROM knowledge_item_domains WHERE item_id = ?').get(item.id).count).toBe(0);
    });

    it('listPagesByProject sin filtro conserva el comportamiento actual (todas las páginas del proyecto)', () => {
      const project = projects.createProject('Unfiltered Reads');
      const classifiedPage = wikiQueries.createPage({ project_id: project.id, slug: 'classified', title: 'Classified' });
      wikiQueries.createPage({ project_id: project.id, slug: 'unclassified-page', title: 'Unclassified Page' });
      const technical = domain(project.id, 'technical');
      const classifiedItem = knowledgeItemFor(project.id, classifiedPage.id);
      service.addMembership({ projectId: project.id, itemId: classifiedItem.id, domainId: technical.id });

      const pages = wikiQueries.listPagesByProject(project.id);

      expect(pages.map(p => p.slug).sort()).toEqual(['classified', 'unclassified-page']);
    });

    it('un ítem con cero membresías permanece alcanzable en una lectura sin filtro', () => {
      const project = projects.createProject('Zero Membership');
      wikiQueries.createPage({ project_id: project.id, slug: 'no-domain', title: 'No Domain' });

      const pages = wikiQueries.listPagesByProject(project.id);

      expect(pages.map(p => p.slug)).toContain('no-domain');
    });

    it('filtra por múltiples dominios con semántica OR/ANY', () => {
      const project = projects.createProject('OR Filter');
      const technical = domain(project.id, 'technical');
      const business = domain(project.id, 'business');
      const techPage = wikiQueries.createPage({ project_id: project.id, slug: 'tech-page', title: 'Tech' });
      const bizPage = wikiQueries.createPage({ project_id: project.id, slug: 'biz-page', title: 'Biz' });
      wikiQueries.createPage({ project_id: project.id, slug: 'unrelated-page', title: 'Unrelated' });
      service.addMembership({ projectId: project.id, itemId: knowledgeItemFor(project.id, techPage.id).id, domainId: technical.id });
      service.addMembership({ projectId: project.id, itemId: knowledgeItemFor(project.id, bizPage.id).id, domainId: business.id });

      const filtered = wikiQueries.listPagesByProject(project.id, { domainIds: [technical.id, business.id] });

      expect(filtered.map(p => p.slug).sort()).toEqual(['biz-page', 'tech-page']);
    });

    it('no duplica la fila fuente cuando un ítem coincide con más de un dominio filtrado', () => {
      const project = projects.createProject('No Duplicate Rows');
      const technical = domain(project.id, 'technical');
      const business = domain(project.id, 'business');
      const page = wikiQueries.createPage({ project_id: project.id, slug: 'multi-domain', title: 'Multi Domain' });
      const item = knowledgeItemFor(project.id, page.id);
      service.addMembership({ projectId: project.id, itemId: item.id, domainId: technical.id });
      service.addMembership({ projectId: project.id, itemId: item.id, domainId: business.id });

      const filtered = wikiQueries.listPagesByProject(project.id, { domainIds: [technical.id, business.id] });

      expect(filtered).toHaveLength(1);
      expect(filtered[0].slug).toBe('multi-domain');
    });

    it('un dominio filtrado sin coincidencias no devuelve ese ítem, aunque tenga otras membresías', () => {
      const project = projects.createProject('Non-matching Domain');
      const technical = domain(project.id, 'technical');
      const business = domain(project.id, 'business');
      const page = wikiQueries.createPage({ project_id: project.id, slug: 'only-technical', title: 'Only Technical' });
      service.addMembership({ projectId: project.id, itemId: knowledgeItemFor(project.id, page.id).id, domainId: technical.id });

      const filtered = wikiQueries.listPagesByProject(project.id, { domainIds: [business.id] });

      expect(filtered).toEqual([]);
    });

    it('domainIds vacío se comporta igual que una lectura sin filtro', () => {
      const project = projects.createProject('Empty Filter');
      wikiQueries.createPage({ project_id: project.id, slug: 'empty-filter-page', title: 'Empty Filter Page' });

      const unfiltered = wikiQueries.listPagesByProject(project.id);
      const emptyFiltered = wikiQueries.listPagesByProject(project.id, { domainIds: [] });

      expect(emptyFiltered).toEqual(unfiltered);
    });

    it('createPage revierte la inserción de la página si registerItem falla dentro de la transacción compartida', () => {
      const project = projects.createProject('Rollback Create');
      // `wiki/queries.js` resuelve `KnowledgeDomainsService` con `require()` nativo de Node
      // (CommonJS), mientras que este archivo de test lo importa con ESM `import`. Bajo
      // Vitest/vite-node ambos caminos no comparten el mismo cache de módulo (son instancias
      // de clase distintas), así que `vi.spyOn` sobre el `import` de arriba NO intercepta la
      // instancia que usa `queries.js` internamente. Para espiar el prototipo correcto hay que
      // resolver la clase con el mismo `require()` nativo que usa el código bajo prueba.
      const InternalKnowledgeDomainsService = require('../../../../electron/database/knowledgeDomains/service.js');
      vi.spyOn(InternalKnowledgeDomainsService.prototype, 'registerItem').mockImplementation(() => {
        throw new Error('simulated registerItem failure');
      });

      expect(() => wikiQueries.createPage({ project_id: project.id, slug: 'rollback-create', title: 'Rollback Create' })).toThrow('simulated registerItem failure');

      const page = db.prepare('SELECT * FROM project_wiki_pages WHERE project_id = ? AND slug = ?').get(project.id, 'rollback-create');
      expect(page).toBeUndefined();
      expect(db.prepare('SELECT COUNT(*) AS count FROM knowledge_items WHERE project_id = ?').get(project.id).count).toBe(0);
    });

    it('deletePage revierte el borrado de la página si removeItem falla dentro de la transacción compartida', () => {
      const project = projects.createProject('Rollback Delete');
      const page = wikiQueries.createPage({ project_id: project.id, slug: 'rollback-delete', title: 'Rollback Delete' });
      const item = knowledgeItemFor(project.id, page.id);
      // Ver comentario del test anterior: hay que espiar la clase resuelta vía `require()`
      // nativo, no la importada por ESM, para interceptar la instancia que usa `queries.js`.
      const InternalKnowledgeDomainsService = require('../../../../electron/database/knowledgeDomains/service.js');
      vi.spyOn(InternalKnowledgeDomainsService.prototype, 'removeItem').mockImplementation(() => {
        throw new Error('simulated removeItem failure');
      });

      expect(() => wikiQueries.deletePage(page.id)).toThrow('simulated removeItem failure');

      const survivingPage = db.prepare('SELECT * FROM project_wiki_pages WHERE id = ?').get(page.id);
      expect(survivingPage).toBeTruthy();
      expect(survivingPage.slug).toBe('rollback-delete');
      expect(knowledgeItemFor(project.id, page.id)).toEqual(item);
    });

    it('una propuesta de IA pendiente sin confirmar no aparece en el filtro OR/ANY por dominio', () => {
      const project = projects.createProject('Pending Proposal Filter');
      const technical = domain(project.id, 'technical');
      const page = wikiQueries.createPage({ project_id: project.id, slug: 'proposed-only', title: 'Proposed Only' });
      const item = knowledgeItemFor(project.id, page.id);

      service.createProposal({
        projectId: project.id,
        itemId: item.id,
        domainId: technical.id,
        confidence: 0.9,
        origin: 'ai-classification',
        idempotencyKey: 'proposed-only:technical',
      });

      const filtered = wikiQueries.listPagesByProject(project.id, { domainIds: [technical.id] });

      expect(filtered).toEqual([]);
      expect(db.prepare('SELECT COUNT(*) AS count FROM knowledge_item_domains WHERE item_id = ?').get(item.id).count).toBe(0);
    });
  });
});
