import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDB, initTestDB } from '../dbSetup.js';
import { initializeKnowledgeDomains } from '../../../../../electron/database/knowledgeDomains/schema.js';

describe('knowledge domain schema', () => {
  let db;
  let projects;

  beforeEach(() => {
    db = createTestDB();
    ({ projects } = initTestDB(db));
  });

  it('registers one canonical item per project/source pair without copying source content', () => {
    const project = projects.createProject('Canonical');
    const page = db.prepare('INSERT INTO project_wiki_pages (project_id, slug, title, content_md) VALUES (?, ?, ?, ?)').run(project.id, 'source', 'Source', 'Authoritative content');

    initializeKnowledgeDomains(db);

    const items = db.prepare('SELECT * FROM knowledge_items WHERE project_id = ? AND entity_type = ? AND entity_id = ?').all(project.id, 'wiki_page', String(page.lastInsertRowid));
    expect(items).toHaveLength(1);
    expect(() => db.prepare('INSERT INTO knowledge_items (project_id, entity_type, entity_id) VALUES (?, ?, ?)').run(project.id, 'wiki_page', String(page.lastInsertRowid))).toThrow();
    expect(db.prepare('SELECT content_md FROM project_wiki_pages WHERE id = ?').get(page.lastInsertRowid).content_md).toBe('Authoritative content');
  });

  it('seeds project-local ordinary domains on creation and preserves lifecycle state', () => {
    const project = projects.createProject('Domains');
    const domains = db.prepare('SELECT slug, status FROM knowledge_domains WHERE project_id = ? ORDER BY slug').all(project.id);

    expect(domains).toEqual([
      { slug: 'business', status: 'active' },
      { slug: 'technical', status: 'active' },
      { slug: 'unclassified', status: 'active' },
    ]);

    db.prepare("UPDATE knowledge_domains SET status = 'archived' WHERE project_id = ? AND slug = 'business'").run(project.id);
    initializeKnowledgeDomains(db);
    expect(db.prepare("SELECT status FROM knowledge_domains WHERE project_id = ? AND slug = 'business'").get(project.id).status).toBe('archived');
  });

  it('rejects changes to a domain slug while allowing its label to be edited', () => {
    const project = projects.createProject('Immutable slug');
    const technical = db.prepare("SELECT * FROM knowledge_domains WHERE project_id = ? AND slug = 'technical'").get(project.id);

    expect(() => db.prepare('UPDATE knowledge_domains SET slug = ? WHERE id = ?').run('renamed', technical.id)).toThrow();
    db.prepare('UPDATE knowledge_domains SET label = ? WHERE id = ?').run('Engineering', technical.id);
    expect(db.prepare('SELECT slug, label FROM knowledge_domains WHERE id = ?').get(technical.id)).toEqual({ slug: 'technical', label: 'Engineering' });
  });

  it('rejects memberships that cross project ownership', () => {
    const first = projects.createProject('First');
    const second = projects.createProject('Second');
    const item = db.prepare('INSERT INTO knowledge_items (project_id, entity_type, entity_id) VALUES (?, ?, ?)').run(first.id, 'wiki_page', 'one');
    const domain = db.prepare("SELECT id FROM knowledge_domains WHERE project_id = ? AND slug = 'technical'").get(second.id);

    expect(() => db.prepare('INSERT INTO knowledge_item_domains (project_id, item_id, domain_id) VALUES (?, ?, ?)').run(first.id, item.lastInsertRowid, domain.id)).toThrow();
  });

  it('backfills only unclassified memberships and remains repeat-safe', () => {
    const project = projects.createProject('Backfill');
    const first = db.prepare('INSERT INTO project_wiki_pages (project_id, slug, title) VALUES (?, ?, ?)').run(project.id, 'first', 'First');
    const second = db.prepare('INSERT INTO project_wiki_pages (project_id, slug, title) VALUES (?, ?, ?)').run(project.id, 'second', 'Second');

    initializeKnowledgeDomains(db);
    initializeKnowledgeDomains(db);

    const memberships = db.prepare(`
      SELECT item.entity_id, domain.slug
      FROM knowledge_item_domains membership
      JOIN knowledge_items item ON item.id = membership.item_id
      JOIN knowledge_domains domain ON domain.id = membership.domain_id
      WHERE membership.project_id = ?
      ORDER BY item.entity_id
    `).all(project.id);

    expect(memberships).toEqual([
      { entity_id: String(first.lastInsertRowid), slug: 'unclassified' },
      { entity_id: String(second.lastInsertRowid), slug: 'unclassified' },
    ]);
    expect(db.prepare('SELECT COUNT(*) AS count FROM knowledge_items WHERE project_id = ?').get(project.id).count).toBe(2);
  });
});
