// Projects & Project Recordings — base de datos
const BaseDbService = require('../baseDbService');
const {
  CREATE_TABLE_PROJECTS,
  CREATE_TABLE_PROJECT_RECORDINGS,
  INSERT_PROJECT,
  UPDATE_PROJECT,
  UPDATE_PROJECT_SYNC_STATUS,
  DELETE_PROJECT,
  SELECT_ALL_PROJECTS,
  SELECT_PROJECT_BY_ID,
  INSERT_PROJECT_RECORDING,
  DELETE_PROJECT_RECORDING,
  DELETE_ALL_PROJECT_RECORDINGS,
  SELECT_PROJECT_RECORDING_IDS,
  SELECT_RECORDING_PROJECT,
  GET_PROJECT_TOTAL_DURATION
} = require('./queries');

class ProjectsDbService extends BaseDbService {
  constructor(db) {
    super(db, 'projects');
  }

  // ── Tablas ──────────────────────────────────────────────────────────────────

  init() {
    this.db.prepare(CREATE_TABLE_PROJECTS).run();
    this.db.prepare(CREATE_TABLE_PROJECT_RECORDINGS).run();
  }

  // ── Proyectos ──────────────────────────────────────────────────────────────

  getAllProjects() {
    const projects = this._getMany(SELECT_ALL_PROJECTS);
    return (projects || []).map(p => ({ ...p, members: JSON.parse(p.members || '[]') }));
  }

  getProjectById(id) {
    const project = this._getOne(SELECT_PROJECT_BY_ID, [id], null);
    if (!project) return null;
    return { ...project, members: JSON.parse(project.members || '[]') };
  }

  createProject(name, description = '', members = []) {
    const result = this._insert(INSERT_PROJECT, [name, description, JSON.stringify(members)]);
    if (!result.success) return null;
    return this.getProjectById(result.id);
  }

  updateProject(id, name, description, members) {
    const modified = this._modify(UPDATE_PROJECT, [name, description, JSON.stringify(members), id]);
    if (!modified.success) return null;
    return this.getProjectById(id);
  }

  deleteProject(id) {
    return this._run(DELETE_PROJECT, [id]);
  }

  updateProjectSyncStatus(projectId, status) {
    return this._run(UPDATE_PROJECT_SYNC_STATUS, [status, projectId]);
  }

  // ── Relaciones proyecto-grabación ──────────────────────────────────────────

  addRecordingToProject(projectId, recordingId) {
    const result = this._run(INSERT_PROJECT_RECORDING, [projectId, recordingId]);
    if (result.success) this.updateProjectSyncStatus(projectId, 0);
    return result;
  }

  removeRecordingFromProject(projectId, recordingId) {
    const result = this._run(DELETE_PROJECT_RECORDING, [projectId, recordingId]);
    if (result.success) this.updateProjectSyncStatus(projectId, 0);
    return result;
  }

  getProjectRecordingIds(projectId) {
    const rows = this._getMany(SELECT_PROJECT_RECORDING_IDS, [projectId]);
    return (rows || []).map(r => r.recording_id);
  }

  getRecordingProject(recordingId) {
    let id = recordingId;
    if (typeof recordingId === 'string' && isNaN(Number(recordingId))) {
      const rec = this._getOne('SELECT * FROM recordings WHERE relative_path = ?', [recordingId], null);
      if (!rec) return null;
      id = rec.id;
    }
    const project = this._getOne(SELECT_RECORDING_PROJECT, [id], null);
    if (!project) return null;
    return { ...project, members: JSON.parse(project.members || '[]') };
  }

  getProjectTotalDuration(projectId) {
    const result = this._getOne(GET_PROJECT_TOTAL_DURATION, [projectId], { totalDuration: 0 });
    return result ? result.totalDuration || 0 : 0;
  }
}

module.exports = ProjectsDbService;