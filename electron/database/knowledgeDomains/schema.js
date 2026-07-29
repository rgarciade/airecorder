const DEFAULT_DOMAINS = [
  ['technical', 'Technical'],
  ['business', 'Business'],
  ['unclassified', 'Unclassified'],
];

const CREATE_SCHEMA = `
  CREATE TABLE IF NOT EXISTS knowledge_domains (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    slug TEXT NOT NULL,
    label TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'merged')),
    merged_into_domain_id INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (merged_into_domain_id) REFERENCES knowledge_domains(id),
    UNIQUE (project_id, id),
    UNIQUE (project_id, slug)
  );

  CREATE TABLE IF NOT EXISTS knowledge_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    UNIQUE (project_id, id),
    UNIQUE (project_id, entity_type, entity_id)
  );

  CREATE TABLE IF NOT EXISTS knowledge_item_domains (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    item_id INTEGER NOT NULL,
    domain_id INTEGER NOT NULL,
    assigned_by TEXT NOT NULL DEFAULT 'system',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id, item_id) REFERENCES knowledge_items(project_id, id) ON DELETE CASCADE,
    FOREIGN KEY (project_id, domain_id) REFERENCES knowledge_domains(project_id, id) ON DELETE CASCADE,
    UNIQUE (project_id, item_id, domain_id)
  );

  CREATE TABLE IF NOT EXISTS knowledge_item_domain_proposals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    idempotency_key TEXT NOT NULL,
    item_id INTEGER NOT NULL,
    domain_id INTEGER NOT NULL,
    confidence REAL NOT NULL,
    origin TEXT NOT NULL,
    provider TEXT,
    model TEXT,
    run_id TEXT,
    input_reference TEXT,
    expert_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected')),
    reviewed_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id, item_id) REFERENCES knowledge_items(project_id, id) ON DELETE CASCADE,
    FOREIGN KEY (project_id, domain_id) REFERENCES knowledge_domains(project_id, id) ON DELETE CASCADE,
    UNIQUE (project_id, id),
    UNIQUE (project_id, idempotency_key)
  );

  CREATE INDEX IF NOT EXISTS idx_knowledge_items_project ON knowledge_items(project_id);
  CREATE INDEX IF NOT EXISTS idx_knowledge_memberships_domain ON knowledge_item_domains(project_id, domain_id);
  CREATE INDEX IF NOT EXISTS idx_knowledge_proposals_status ON knowledge_item_domain_proposals(project_id, status);

  CREATE TRIGGER IF NOT EXISTS seed_knowledge_domains_after_project_insert
  AFTER INSERT ON projects
  BEGIN
    INSERT OR IGNORE INTO knowledge_domains (project_id, slug, label) VALUES (NEW.id, 'technical', 'Technical');
    INSERT OR IGNORE INTO knowledge_domains (project_id, slug, label) VALUES (NEW.id, 'business', 'Business');
    INSERT OR IGNORE INTO knowledge_domains (project_id, slug, label) VALUES (NEW.id, 'unclassified', 'Unclassified');
  END;

  CREATE TRIGGER IF NOT EXISTS prevent_knowledge_domain_slug_update
  BEFORE UPDATE OF slug ON knowledge_domains
  WHEN NEW.slug <> OLD.slug
  BEGIN
    SELECT RAISE(ABORT, 'Knowledge domain slug is immutable');
  END;
`;

function seedDomains(db) {
  const projects = db.prepare('SELECT id FROM projects').all();
  const insert = db.prepare('INSERT OR IGNORE INTO knowledge_domains (project_id, slug, label) VALUES (?, ?, ?)');

  for (const project of projects) {
    for (const [slug, label] of DEFAULT_DOMAINS) insert.run(project.id, slug, label);
  }
}

function backfillWikiPages(db) {
  const hasWikiPages = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'project_wiki_pages'").get();
  if (!hasWikiPages) return;

  db.prepare("INSERT OR IGNORE INTO knowledge_items (project_id, entity_type, entity_id) SELECT project_id, 'wiki_page', CAST(id AS TEXT) FROM project_wiki_pages").run();
  db.prepare("INSERT OR IGNORE INTO knowledge_item_domains (project_id, item_id, domain_id, assigned_by) SELECT item.project_id, item.id, domain.id, 'backfill' FROM knowledge_items item JOIN knowledge_domains domain ON domain.project_id = item.project_id AND domain.slug = 'unclassified' WHERE NOT EXISTS (SELECT 1 FROM knowledge_item_domains membership WHERE membership.project_id = item.project_id AND membership.item_id = item.id)").run();
}

function initializeKnowledgeDomains(db) {
  db.transaction(() => {
    db.exec(CREATE_SCHEMA);
    seedDomains(db);
    backfillWikiPages(db);
  })();
}

module.exports = { DEFAULT_DOMAINS, initializeKnowledgeDomains };
