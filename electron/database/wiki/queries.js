const dbService = require('../dbService');
const KnowledgeDomainsService = require('../knowledgeDomains/service');

const WIKI_PAGE_ENTITY_TYPE = 'wiki_page';
const PAGE_LIST_COLUMNS = 'id, slug, title, content_md, source_recording_ids, version, is_verified, created_at, updated_at';

let testDatabase = null;

function getDatabase() {
  return testDatabase || dbService.db;
}

function __setDatabase(database) {
  testDatabase = database;
}

function withAlias(alias, columns) {
  return columns.split(', ').map((column) => `${alias}.${column}`).join(', ');
}

function knowledgeDomainsService(db) {
  return new KnowledgeDomainsService(db);
}

function listPagesByProject(projectId, { domainIds = [] } = {}) {
  const db = getDatabase();

  if (!Array.isArray(domainIds) || domainIds.length === 0) {
    return db
      .prepare(`
        SELECT ${PAGE_LIST_COLUMNS}
        FROM project_wiki_pages
        WHERE project_id = ?
        ORDER BY updated_at DESC
      `)
      .all(projectId);
  }

  const domainPlaceholders = domainIds.map(() => '?').join(', ');

  return db
    .prepare(`
      SELECT ${withAlias('page', PAGE_LIST_COLUMNS)}
      FROM project_wiki_pages page
      WHERE page.project_id = ?
        AND EXISTS (
          SELECT 1
          FROM knowledge_items item
          JOIN knowledge_item_domains membership
            ON membership.project_id = item.project_id AND membership.item_id = item.id
          WHERE item.project_id = page.project_id
            AND item.entity_type = ?
            AND item.entity_id = CAST(page.id AS TEXT)
            AND membership.domain_id IN (${domainPlaceholders})
        )
      ORDER BY page.updated_at DESC
    `)
    .all(projectId, WIKI_PAGE_ENTITY_TYPE, ...domainIds);
}

function getPageById(id) {
  return getDatabase()
    .prepare(`
      SELECT id, project_id, slug, title, content_md, source_recording_ids, version, is_verified, created_at, updated_at
      FROM project_wiki_pages
      WHERE id = ?
    `)
    .get(id) || null;
}

function getPageBySlug(projectId, slug) {
  return getDatabase()
    .prepare(`
      SELECT id, project_id, slug, title, content_md, source_recording_ids, version, is_verified, created_at, updated_at
      FROM project_wiki_pages
      WHERE project_id = ? AND slug = ?
    `)
    .get(projectId, slug) || null;
}

function createPage({ project_id, slug, title, content_md = '', source_recording_ids = '[]' }) {
  const db = getDatabase();

  const newPageId = db.transaction(() => {
    const result = db
      .prepare(`
        INSERT INTO project_wiki_pages (project_id, slug, title, content_md, source_recording_ids, version, is_verified)
        VALUES (?, ?, ?, ?, ?, 1, 0)
      `)
      .run(project_id, slug, title, content_md, source_recording_ids);

    knowledgeDomainsService(db).registerItem({
      projectId: project_id,
      entityType: WIKI_PAGE_ENTITY_TYPE,
      entityId: result.lastInsertRowid,
    });

    return result.lastInsertRowid;
  })();

  return getPageById(newPageId);
}

function updatePage(id, { title, slug, content_md }) {
  const db = getDatabase();

  db.prepare(`
    UPDATE project_wiki_pages
    SET title = ?,
        slug = ?,
        content_md = ?,
        version = version + 1,
        is_verified = 0,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(title, slug, content_md ?? '', id);

  return getPageById(id);
}

function deletePage(id) {
  const db = getDatabase();

  return db.transaction(() => {
    const page = getPageById(id);
    if (!page) return false;

    const result = db.prepare('DELETE FROM project_wiki_pages WHERE id = ?').run(id);
    if (result.changes === 0) return false;

    knowledgeDomainsService(db).removeItem({
      projectId: page.project_id,
      entityType: WIKI_PAGE_ENTITY_TYPE,
      entityId: id,
    });

    return true;
  })();
}

function countPagesByProject(projectId) {
  const row = getDatabase()
    .prepare('SELECT COUNT(*) AS total FROM project_wiki_pages WHERE project_id = ?')
    .get(projectId);

  return row?.total ?? 0;
}

module.exports = {
  __setDatabase,
  listPagesByProject,
  getPageById,
  getPageBySlug,
  createPage,
  updatePage,
  deletePage,
  countPagesByProject,
};
