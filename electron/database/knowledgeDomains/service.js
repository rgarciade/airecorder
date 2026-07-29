const queries = require('./queries');

class KnowledgeDomainsService {
  constructor(db) {
    this.db = db;
  }

  registerItem({ projectId, entityType, entityId }) {
    this.db.prepare('INSERT OR IGNORE INTO knowledge_items (project_id, entity_type, entity_id) VALUES (?, ?, ?)').run(projectId, entityType, String(entityId));
    return queries.getItemBySource(this.db, projectId, entityType, entityId);
  }

  removeItem({ projectId, entityType, entityId }) {
    const item = queries.getItemBySource(this.db, projectId, entityType, entityId);
    if (!item) return null;
    // Memberships and pending proposals cascade-delete via their composite foreign keys.
    this.db.prepare('DELETE FROM knowledge_items WHERE project_id = ? AND id = ?').run(projectId, item.id);
    return item;
  }

  addMembership({ projectId, itemId, domainId, assignedBy = 'human' }) {
    const item = queries.getItemById(this.db, projectId, itemId);
    const domain = queries.getDomainById(this.db, projectId, domainId);
    if (!item || !domain) throw new Error('Knowledge item and domain must belong to the project');
    if (domain.status !== 'active') throw new Error('Only active domains accept new memberships');

    this.db.prepare('INSERT OR IGNORE INTO knowledge_item_domains (project_id, item_id, domain_id, assigned_by) VALUES (?, ?, ?, ?)').run(projectId, itemId, domainId, assignedBy);
    return this.db.prepare('SELECT * FROM knowledge_item_domains WHERE project_id = ? AND item_id = ? AND domain_id = ?').get(projectId, itemId, domainId);
  }

  createProposal({ projectId, itemId, domainId, confidence, origin, provider = null, model = null, runId = null, inputReference = null, expertId = null, idempotencyKey }) {
    const item = queries.getItemById(this.db, projectId, itemId);
    const domain = queries.getDomainById(this.db, projectId, domainId);
    if (!item || !domain) throw new Error('Knowledge item and domain must belong to the project');
    if (!idempotencyKey) throw new Error('Proposal idempotency key is required');

    this.db.prepare('INSERT OR IGNORE INTO knowledge_item_domain_proposals (project_id, idempotency_key, item_id, domain_id, confidence, origin, provider, model, run_id, input_reference, expert_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(projectId, idempotencyKey, itemId, domainId, confidence, origin, provider, model, runId, inputReference, expertId);
    return this.db.prepare('SELECT * FROM knowledge_item_domain_proposals WHERE project_id = ? AND idempotency_key = ?').get(projectId, idempotencyKey);
  }

  confirmProposal({ projectId, proposalId }) {
    return this.db.transaction(() => {
      const proposal = queries.getProposalById(this.db, projectId, proposalId);
      if (!proposal) throw new Error('Proposal does not belong to the project');
      const domain = queries.getDomainById(this.db, projectId, proposal.domain_id);
      if (domain.status !== 'active') throw new Error('Only active domains can be confirmed');

      this.addMembership({ projectId, itemId: proposal.item_id, domainId: proposal.domain_id, assignedBy: 'proposal_confirmation' });
      this.db.prepare("UPDATE knowledge_item_domain_proposals SET status = 'confirmed', reviewed_at = CURRENT_TIMESTAMP WHERE project_id = ? AND id = ?").run(projectId, proposalId);
      return queries.getProposalById(this.db, projectId, proposalId);
    })();
  }

  archiveDomain({ projectId, domainId }) {
    const domain = queries.getDomainById(this.db, projectId, domainId);
    if (!domain) throw new Error('Domain does not belong to the project');
    if (domain.status === 'merged') throw new Error('Merged domains cannot be archived');
    this.db.prepare("UPDATE knowledge_domains SET status = 'archived', updated_at = CURRENT_TIMESTAMP WHERE project_id = ? AND id = ?").run(projectId, domainId);
    return queries.getDomainById(this.db, projectId, domainId);
  }

  mergeDomains({ projectId, sourceDomainId, targetDomainId }) {
    return this.db.transaction(() => {
      if (sourceDomainId === targetDomainId) throw new Error('A domain cannot merge into itself');
      const source = queries.getDomainById(this.db, projectId, sourceDomainId);
      const target = queries.getDomainById(this.db, projectId, targetDomainId);
      if (!source || !target) throw new Error('Both domains must belong to the project');
      if (source.status !== 'active' || target.status !== 'active') throw new Error('Only active domains can be merged');

      this.db.prepare("INSERT OR IGNORE INTO knowledge_item_domains (project_id, item_id, domain_id, assigned_by) SELECT project_id, item_id, ?, 'domain_merge' FROM knowledge_item_domains WHERE project_id = ? AND domain_id = ?").run(targetDomainId, projectId, sourceDomainId);
      this.db.prepare('DELETE FROM knowledge_item_domains WHERE project_id = ? AND domain_id = ?').run(projectId, sourceDomainId);
      this.db.prepare("UPDATE knowledge_item_domain_proposals SET domain_id = ? WHERE project_id = ? AND domain_id = ? AND status = 'pending'").run(targetDomainId, projectId, sourceDomainId);
      this.db.prepare("UPDATE knowledge_domains SET status = 'merged', merged_into_domain_id = ?, updated_at = CURRENT_TIMESTAMP WHERE project_id = ? AND id = ?").run(targetDomainId, projectId, sourceDomainId);
      return queries.getDomainById(this.db, projectId, sourceDomainId);
    })();
  }
}

module.exports = KnowledgeDomainsService;
