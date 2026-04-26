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
  projects.init();
  chats.init();
  tasks.init();
  speakers.init();
  integrations.init();

  db.exec(expertQueries.CREATE_TABLE_EXPERT_CUSTOMIZATIONS);

  return { recordings, projects, chats, tasks, speakers, integrations };
}