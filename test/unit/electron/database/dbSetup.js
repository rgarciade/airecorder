/**
 * Setup común para tests de base de datos
 * Crea una DB temporal en memoria para cada test
 */
import Database from 'better-sqlite3';
import RecordingsDbService from '../../../../electron/database/recordings/dbService.js';
import ProjectsDbService from '../../../../electron/database/projects/dbService.js';
import ChatsDbService from '../../../../electron/database/chats/dbService.js';
import TasksDbService from '../../../../electron/database/tasks/dbService.js';
import SpeakersDbService from '../../../../electron/database/speakers/dbService.js';
import IntegrationsDbService from '../../../../electron/database/integrations/dbService.js';
import expertQueries from '../../../../electron/database/experts/queries.js';
import templateQueries from '../../../../electron/database/templates/queries.js';
import { seedBuiltinTemplates } from '../../../../electron/database/templates/builtinTemplates.js';
import { initializeKnowledgeDomains } from '../../../../electron/database/knowledgeDomains/schema.js';

const CREATE_TABLE_PROJECT_WIKI_PAGES = `
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

/**
 * Crea una instancia de DB en memoria para tests
 */
export function createTestDB() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  return db;
}

/**
 * Inicializa todas las tablas en la DB de test
 */
export function initTestDB(db) {
  const recordings = new RecordingsDbService(db);
  const projects = new ProjectsDbService(db);
  const chats = new ChatsDbService(db);
  const tasks = new TasksDbService(db);
  const speakers = new SpeakersDbService(db);
  const integrations = new IntegrationsDbService(db);

  recordings.init();

  const recordingColumns = db.prepare('PRAGMA table_info(recordings)').all();
  if (!recordingColumns.some(column => column.name === 'source')) {
    db.exec('ALTER TABLE recordings ADD COLUMN source TEXT');
  }

  projects.init();
  chats.init();
  tasks.init();
  speakers.init();
  integrations.init();

  db.exec(CREATE_TABLE_PROJECT_WIKI_PAGES);
  db.exec(expertQueries.CREATE_TABLE_EXPERT_CUSTOMIZATIONS);
  db.exec(templateQueries.CREATE_TABLE_NOTE_TEMPLATES);
  db.exec(templateQueries.CREATE_TABLE_RECORDING_NOTES);
  db.exec(templateQueries.CREATE_INDEX_RECORDING_NOTES);
  seedBuiltinTemplates(db);
  initializeKnowledgeDomains(db);

  return { recordings, projects, chats, tasks, speakers, integrations };
}
