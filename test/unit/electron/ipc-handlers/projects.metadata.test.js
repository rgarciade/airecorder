/**
 * projects.metadata.test.js
 *
 * Tests for the projectName mirror in each recording's metadata.json, kept
 * in sync by the project IPC handlers in electron/ipc-handlers/projects.js
 * (add/remove-recording-to-project, update-project, delete-project).
 *
 * Same harness as projects.test.js (mocks injected in `require.cache`,
 * handlers captured from `ipcMain.handle`), but `fs` is NOT spied here: the
 * recordings folder is a real temp directory, and assertions read the
 * resulting metadata.json files from disk. SQLite stays mocked (dbService):
 * it is the source of truth the handlers sync from.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'fs';
import os from 'os';
import path from 'path';

const nodeRequire = createRequire(import.meta.url);
const electronPath = nodeRequire.resolve('electron');
const dbServicePath = nodeRequire.resolve('../../../../electron/database/dbService.js');
const pathsPath = nodeRequire.resolve('../../../../electron/utils/paths.js');

let originalElectronEntry;
let originalDbServiceEntry;
let originalPathsEntry;

const handlers = {};
const ipcMainMock = {
  handle: vi.fn((channel, cb) => {
    handlers[channel] = cb;
  }),
};

const dbServiceMock = {
  getAllProjects: vi.fn(),
  createProject: vi.fn(),
  updateProject: vi.fn(),
  deleteProject: vi.fn(),
  addRecordingToProject: vi.fn(),
  removeRecordingFromProject: vi.fn(),
  getProjectRecordingIds: vi.fn(),
  getRecordingProject: vi.fn(),
  getProjectTotalDuration: vi.fn(),
  getProjectChats: vi.fn(),
  createProjectChat: vi.fn(),
  deleteProjectChat: vi.fn(),
  getChatMessages: vi.fn(),
  clearChatMessages: vi.fn(),
  saveProjectChatMessage: vi.fn(),
  replaceChatMessages: vi.fn(),
  updateProjectSyncStatus: vi.fn(),
};

let recordingsDir;
const pathsMock = {
  PROJECTS_PATH: '/fake/userData/projects',
  getRecordingsPath: vi.fn(async () => recordingsDir),
  getFolderPathFromId: vi.fn(async (id) => `folder-${id}`),
};

beforeAll(() => {
  originalElectronEntry = nodeRequire.cache[electronPath];
  nodeRequire.cache[electronPath] = {
    id: electronPath,
    filename: electronPath,
    loaded: true,
    exports: { ipcMain: ipcMainMock },
  };

  originalDbServiceEntry = nodeRequire.cache[dbServicePath];
  nodeRequire.cache[dbServicePath] = {
    id: dbServicePath,
    filename: dbServicePath,
    loaded: true,
    exports: dbServiceMock,
  };

  originalPathsEntry = nodeRequire.cache[pathsPath];
  nodeRequire.cache[pathsPath] = {
    id: pathsPath,
    filename: pathsPath,
    loaded: true,
    exports: pathsMock,
  };
});

afterAll(() => {
  if (originalElectronEntry) nodeRequire.cache[electronPath] = originalElectronEntry;
  else delete nodeRequire.cache[electronPath];
  if (originalDbServiceEntry) nodeRequire.cache[dbServicePath] = originalDbServiceEntry;
  else delete nodeRequire.cache[dbServicePath];
  if (originalPathsEntry) nodeRequire.cache[pathsPath] = originalPathsEntry;
  else delete nodeRequire.cache[pathsPath];
});

// ── Disk helpers ─────────────────────────────────────────────────────────
function folderOf(id) {
  return path.join(recordingsDir, `folder-${id}`);
}

function createRecording(id, metadata) {
  fs.mkdirSync(folderOf(id), { recursive: true });
  if (metadata !== undefined) {
    fs.writeFileSync(path.join(folderOf(id), 'metadata.json'), JSON.stringify(metadata, null, 2));
  }
}

function readMetadata(id) {
  return JSON.parse(fs.readFileSync(path.join(folderOf(id), 'metadata.json'), 'utf8'));
}

beforeEach(async () => {
  Object.keys(handlers).forEach((k) => delete handlers[k]);
  [ipcMainMock.handle, ...Object.values(dbServiceMock)].forEach((fn) => fn.mockReset());
  ipcMainMock.handle.mockImplementation((channel, cb) => {
    handlers[channel] = cb;
  });
  dbServiceMock.getRecordingProject.mockReturnValue(null);
  dbServiceMock.getProjectRecordingIds.mockReturnValue([]);

  recordingsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'projects-metadata-test-'));

  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});

  const projectsHandlers = await import('../../../../electron/ipc-handlers/projects.js');
  projectsHandlers.registerProjectsHandlers();
});

afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(recordingsDir, { recursive: true, force: true });
});

describe('add-recording-to-project keeps metadata.json projectName in sync', () => {
  it('writes the project name into metadata.json, preserving existing keys', async () => {
    createRecording(42, { customName: 'Weekly sync' });
    dbServiceMock.getRecordingProject.mockReturnValue({ id: 1, name: 'Project A' });

    const result = await handlers['add-recording-to-project']({}, 1, 42);

    expect(result).toEqual({ success: true });
    expect(readMetadata(42)).toEqual({ customName: 'Weekly sync', projectName: 'Project A' });
  });

  it('moving a recording from project A to project B leaves projectName = B', async () => {
    createRecording(42, { customName: 'Weekly sync', projectName: 'Project A' });
    dbServiceMock.getRecordingProject.mockReturnValue({ id: 2, name: 'Project B' });

    const result = await handlers['add-recording-to-project']({}, 2, 42);

    expect(result).toEqual({ success: true });
    expect(readMetadata(42)).toEqual({ customName: 'Weekly sync', projectName: 'Project B' });
  });

  it('missing recording folder → still succeeds and creates nothing on disk', async () => {
    dbServiceMock.getRecordingProject.mockReturnValue({ id: 1, name: 'Project A' });

    const result = await handlers['add-recording-to-project']({}, 1, 42);

    expect(result).toEqual({ success: true });
    expect(dbServiceMock.addRecordingToProject).toHaveBeenCalledWith(1, 42);
    expect(fs.existsSync(folderOf(42))).toBe(false);
  });

  it('DB operation throws → returns the error and leaves metadata.json untouched', async () => {
    createRecording(42, { customName: 'Weekly sync', projectName: 'Project A' });
    dbServiceMock.addRecordingToProject.mockImplementation(() => {
      throw new Error('already linked');
    });
    dbServiceMock.getRecordingProject.mockReturnValue({ id: 2, name: 'Project B' });

    const result = await handlers['add-recording-to-project']({}, 2, 42);

    expect(result).toEqual({ success: false, error: 'already linked' });
    expect(readMetadata(42)).toEqual({ customName: 'Weekly sync', projectName: 'Project A' });
  });
});

describe('remove-recording-from-project keeps metadata.json projectName in sync', () => {
  it('sets projectName to null when the recording no longer belongs to a project, other keys intact', async () => {
    createRecording(42, { customName: 'Weekly sync', projectName: 'Project A' });
    dbServiceMock.getRecordingProject.mockReturnValue(null);

    const result = await handlers['remove-recording-from-project']({}, 1, 42);

    expect(result).toEqual({ success: true });
    expect(readMetadata(42)).toEqual({ customName: 'Weekly sync', projectName: null });
  });
});

describe('update-project keeps metadata.json projectName in sync', () => {
  it('rewrites projectName with the new name in every recording of the project', async () => {
    createRecording(1, { customName: 'First', projectName: 'Old name' });
    createRecording(2, { customName: 'Second', projectName: 'Old name' });
    dbServiceMock.updateProject.mockReturnValue({ id: 7, name: 'New name' });
    dbServiceMock.getProjectRecordingIds.mockReturnValue([1, 2]);

    const result = await handlers['update-project']({}, 7, { name: 'New name', description: 'd', members: [] });

    expect(result).toEqual({ success: true, project: { id: 7, name: 'New name' } });
    expect(readMetadata(1)).toEqual({ customName: 'First', projectName: 'New name' });
    expect(readMetadata(2)).toEqual({ customName: 'Second', projectName: 'New name' });
  });

  it('a recording whose metadata.json cannot be written does not stop the others nor change the result', async () => {
    // metadata.json is a directory for recording 1 → read/write fails there.
    fs.mkdirSync(path.join(folderOf(1), 'metadata.json'), { recursive: true });
    createRecording(2, { customName: 'Second', projectName: 'Old name' });
    dbServiceMock.updateProject.mockReturnValue({ id: 7, name: 'New name' });
    dbServiceMock.getProjectRecordingIds.mockReturnValue([1, 2]);

    const result = await handlers['update-project']({}, 7, { name: 'New name', description: 'd', members: [] });

    expect(result).toEqual({ success: true, project: { id: 7, name: 'New name' } });
    expect(readMetadata(2)).toEqual({ customName: 'Second', projectName: 'New name' });
  });
});

describe('delete-project keeps metadata.json projectName in sync', () => {
  it('sets projectName to null in every recording that belonged to the deleted project', async () => {
    createRecording(1, { customName: 'First', projectName: 'Project A' });
    createRecording(2, { customName: 'Second', projectName: 'Project A' });
    // ON DELETE CASCADE: once the project is deleted, the DB no longer knows its recordings.
    let deleted = false;
    dbServiceMock.deleteProject.mockImplementation(() => {
      deleted = true;
    });
    dbServiceMock.getProjectRecordingIds.mockImplementation(() => (deleted ? [] : [1, 2]));

    const result = await handlers['delete-project']({}, 7);

    expect(result).toEqual({ success: true });
    expect(dbServiceMock.deleteProject).toHaveBeenCalledWith(7);
    expect(readMetadata(1)).toEqual({ customName: 'First', projectName: null });
    expect(readMetadata(2)).toEqual({ customName: 'Second', projectName: null });
  });
});
