import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDB, initTestDB } from '../dbSetup.js';
import KnowledgeDomainsService from '../../../../../electron/database/knowledgeDomains/service.js';

describe('KnowledgeDomainsService', () => {
  let db;
  let projects;
  let service;

  beforeEach(() => {
    db = createTestDB();
    ({ projects } = initTestDB(db));
    service = new KnowledgeDomainsService(db);
  });

  function domain(projectId, slug) {
    return db.prepare('SELECT * FROM knowledge_domains WHERE project_id = ? AND slug = ?').get(projectId, slug);
  }

  it('registers source identities idempotently and keeps memberships unique', () => {
    const project = projects.createProject('Knowledge');
    const first = service.registerItem({ projectId: project.id, entityType: 'wiki_page', entityId: 12 });
    const repeated = service.registerItem({ projectId: project.id, entityType: 'wiki_page', entityId: 12 });
    const technical = domain(project.id, 'technical');

    expect(repeated.id).toBe(first.id);
    expect(service.addMembership({ projectId: project.id, itemId: first.id, domainId: technical.id }).id).toBeTruthy();
    expect(service.addMembership({ projectId: project.id, itemId: first.id, domainId: technical.id }).item_id).toBe(first.id);
    expect(db.prepare('SELECT COUNT(*) AS count FROM knowledge_item_domains WHERE item_id = ?').get(first.id).count).toBe(1);
  });

  it('keeps AI proposals non-authoritative until an explicit confirmation', () => {
    const project = projects.createProject('Proposals');
    const item = service.registerItem({ projectId: project.id, entityType: 'wiki_page', entityId: 'proposal-page' });
    const technical = domain(project.id, 'technical');
    const proposal = service.createProposal({
      projectId: project.id,
      itemId: item.id,
      domainId: technical.id,
      confidence: 0.82,
      origin: 'ai-classification',
      provider: 'test-provider',
      model: 'test-model',
      runId: 'run-1',
      inputReference: 'page:proposal-page',
      idempotencyKey: 'run-1:proposal-page:technical',
    });

    expect(proposal.status).toBe('pending');
    expect(db.prepare('SELECT COUNT(*) AS count FROM knowledge_item_domains WHERE item_id = ?').get(item.id).count).toBe(0);

    service.confirmProposal({ projectId: project.id, proposalId: proposal.id });
    expect(db.prepare('SELECT status FROM knowledge_item_domain_proposals WHERE id = ?').get(proposal.id).status).toBe('confirmed');
    expect(db.prepare('SELECT COUNT(*) AS count FROM knowledge_item_domains WHERE item_id = ?').get(item.id).count).toBe(1);
  });

  it('archives domains and atomically merges memberships and pending proposals without duplicates', () => {
    const project = projects.createProject('Lifecycle');
    const item = service.registerItem({ projectId: project.id, entityType: 'wiki_page', entityId: 'lifecycle' });
    const business = domain(project.id, 'business');
    const technical = domain(project.id, 'technical');

    service.addMembership({ projectId: project.id, itemId: item.id, domainId: business.id });
    service.addMembership({ projectId: project.id, itemId: item.id, domainId: technical.id });
    const proposal = service.createProposal({ projectId: project.id, itemId: item.id, domainId: business.id, confidence: 0.5, origin: 'ai', idempotencyKey: 'merge-proposal' });

    service.mergeDomains({ projectId: project.id, sourceDomainId: business.id, targetDomainId: technical.id });
    expect(db.prepare('SELECT status, merged_into_domain_id FROM knowledge_domains WHERE id = ?').get(business.id)).toMatchObject({ status: 'merged', merged_into_domain_id: technical.id });
    expect(db.prepare('SELECT COUNT(*) AS count FROM knowledge_item_domains WHERE item_id = ?').get(item.id).count).toBe(1);
    expect(db.prepare('SELECT domain_id FROM knowledge_item_domain_proposals WHERE id = ?').get(proposal.id).domain_id).toBe(technical.id);

    service.archiveDomain({ projectId: project.id, domainId: technical.id });
    expect(db.prepare('SELECT status FROM knowledge_domains WHERE id = ?').get(technical.id).status).toBe('archived');
  });

  it('rolls back a merge when the target is invalid', () => {
    const project = projects.createProject('Rollback');
    const item = service.registerItem({ projectId: project.id, entityType: 'wiki_page', entityId: 'rollback' });
    const business = domain(project.id, 'business');

    service.addMembership({ projectId: project.id, itemId: item.id, domainId: business.id });
    expect(() => service.mergeDomains({ projectId: project.id, sourceDomainId: business.id, targetDomainId: 99999 })).toThrow();
    expect(db.prepare('SELECT status FROM knowledge_domains WHERE id = ?').get(business.id).status).toBe('active');
    expect(db.prepare('SELECT COUNT(*) AS count FROM knowledge_item_domains WHERE item_id = ? AND domain_id = ?').get(item.id, business.id).count).toBe(1);
  });
});
