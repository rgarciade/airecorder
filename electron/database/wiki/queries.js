const dbService = require('../dbService');

let testDatabase = null;

function getDatabase() {
  return testDatabase || dbService.db;
}

function __setDatabase(database) {
  testDatabase = database;
}

function listPagesByProject(projectId) {
  return getDatabase()
    .prepare(`
      SELECT id, slug, title, content_md, source_recording_ids, version, is_verified, created_at, updated_at
      FROM project_wiki_pages
      WHERE project_id = ?
      ORDER BY updated_at DESC
    `)
    .all(projectId);
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

  const result = db
    .prepare(`
      INSERT INTO project_wiki_pages (project_id, slug, title, content_md, source_recording_ids, version, is_verified)
      VALUES (?, ?, ?, ?, ?, 1, 0)
    `)
    .run(project_id, slug, title, content_md, source_recording_ids);

  return getPageById(result.lastInsertRowid);
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
  const result = getDatabase()
    .prepare('DELETE FROM project_wiki_pages WHERE id = ?')
    .run(id);

  return result.changes > 0;
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
