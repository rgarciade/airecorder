function getItemBySource(db, projectId, entityType, entityId) {
  return db.prepare('SELECT * FROM knowledge_items WHERE project_id = ? AND entity_type = ? AND entity_id = ?').get(projectId, entityType, String(entityId)) || null;
}

function getItemById(db, projectId, itemId) {
  return db.prepare('SELECT * FROM knowledge_items WHERE project_id = ? AND id = ?').get(projectId, itemId) || null;
}

function getDomainById(db, projectId, domainId) {
  return db.prepare('SELECT * FROM knowledge_domains WHERE project_id = ? AND id = ?').get(projectId, domainId) || null;
}

function getProposalById(db, projectId, proposalId) {
  return db.prepare('SELECT * FROM knowledge_item_domain_proposals WHERE project_id = ? AND id = ?').get(projectId, proposalId) || null;
}

module.exports = { getItemBySource, getItemById, getDomainById, getProposalById };
