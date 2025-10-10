/* global require, module */
const path = require('path');
const fs = require('fs');
const DataFileDatabase = require('data_file_database');

/**
 * Servicio de base de datos para gestión de proyectos y relaciones con grabaciones
 * Utiliza data_file_database para persistencia
 */

// Configuración de la base de datos
const DB_CONFIG = {
  basePath: '/Users/raul.garciad/Desktop/recorder',
  databases: {
    projects: {
      name: 'projects',
      schema: ['id', 'name', 'description', 'createdAt', 'updatedAt']
    },
    recordingProjects: {
      name: 'recording_projects',
      schema: ['id', 'projectId', 'recordingId', 'createdAt', 'updatedAt']
    }
  }
};

/**
 * Inicializa el entorno de base de datos
 * @returns {Object} Directorio de base de datos y archivos inicializados
 */
const initializeDatabaseEnvironment = () => {
  const { basePath } = DB_CONFIG;
  const dataFileDbPath = path.join(basePath, 'dataFileDatabase');

  // Crear directorios necesarios
  [basePath, dataFileDbPath].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  // Crear archivos JSON iniciales si no existen
  Object.values(DB_CONFIG.databases).forEach(({ name }) => {
    const filePath = path.join(dataFileDbPath, `${name}.json`);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify([]), 'utf8');
    }
  });

  return { basePath, dataFileDbPath };
};

/**
 * Ejecuta una operación de base de datos en el directorio correcto
 * @param {Function} operation - Operación a ejecutar
 * @returns {Promise<any>} Resultado de la operación
 */
const executeInDbContext = async (operation) => {
  const originalCwd = process.cwd();
  try {
    process.chdir(DB_CONFIG.basePath);
    return await operation();
  } finally {
    process.chdir(originalCwd);
  }
};

/**
 * Crea instancias de las bases de datos
 * @returns {Object} Instancias de bases de datos de proyectos y relaciones
 */
const createDatabaseInstances = () => {
  initializeDatabaseEnvironment();

  const originalCwd = process.cwd();
  process.chdir(DB_CONFIG.basePath);

  const projectsDb = new DataFileDatabase(
    DB_CONFIG.databases.projects.name,
    DB_CONFIG.databases.projects.schema
  );

  const recordingProjectsDb = new DataFileDatabase(
    DB_CONFIG.databases.recordingProjects.name,
    DB_CONFIG.databases.recordingProjects.schema
  );

  process.chdir(originalCwd);

  console.log(`📁 Base de datos de proyectos inicializada en: ${DB_CONFIG.basePath}/dataFileDatabase/`);

  return { projectsDb, recordingProjectsDb };
};

// Inicializar bases de datos
const { projectsDb, recordingProjectsDb } = createDatabaseInstances();

/**
 * Utilidades de transformación de datos
 */
const DataTransformers = {
  /**
   * Crea timestamp actual en formato ISO
   */
  now: () => new Date().toISOString(),

  /**
   * Genera un ID único basado en timestamp
   */
  generateId: () => Date.now().toString(),

  /**
   * Crea un objeto de proyecto con timestamps
   */
  createProject: (data) => ({
    id: DataTransformers.generateId(),
    name: data.name,
    description: data.description || '',
    createdAt: DataTransformers.now(),
    updatedAt: DataTransformers.now()
  }),

  /**
   * Actualiza un proyecto con nuevo timestamp
   */
  updateProject: (existingData, newData) => ({
    ...existingData,
    ...newData,
    updatedAt: DataTransformers.now()
  }),

  /**
   * Crea una relación proyecto-grabación
   */
  createRecordingRelation: (projectId, recordingId) => ({
    id: DataTransformers.generateId(),
    projectId,
    recordingId,
    createdAt: DataTransformers.now(),
    updatedAt: DataTransformers.now()
  }),

  /**
   * Actualiza una relación existente
   */
  updateRecordingRelation: (existingRelation, projectId) => ({
    ...existingRelation,
    projectId,
    updatedAt: DataTransformers.now()
  })
};

/**
 * Operaciones CRUD para proyectos
 */
const ProjectOperations = {
  /**
   * Obtiene todos los proyectos
   */
  getAll: async () => executeInDbContext(async () => {
    const projects = await projectsDb.data;
    return projects || [];
  }),

  /**
   * Crea un nuevo proyecto
   */
  create: async (projectData) => executeInDbContext(async () => {
    const project = DataTransformers.createProject(projectData);
    await projectsDb.setVal(project);
    return project;
  }),

  /**
   * Actualiza un proyecto existente
   */
  update: async (projectId, projectData) => executeInDbContext(async () => {
    const existingProject = await projectsDb.getVal('id', '=', projectId);
    
    if (!existingProject || existingProject.length === 0) {
      throw new Error('Proyecto no encontrado');
    }

    const updatedProject = DataTransformers.updateProject(
      existingProject[0],
      projectData
    );

    await projectsDb.updateVals('id', '=', projectId, updatedProject);
    return updatedProject;
  }),

  /**
   * Elimina un proyecto
   */
  delete: async (projectId) => executeInDbContext(async () => {
    await projectsDb.deleteteVals('id', '=', projectId);
    return true;
  }),

  /**
   * Busca un proyecto por ID
   */
  findById: async (projectId) => executeInDbContext(async () => {
    const projects = await projectsDb.getVal('id', '=', projectId);
    return projects && projects.length > 0 ? projects[0] : null;
  })
};

/**
 * Operaciones para relaciones proyecto-grabación
 */
const RecordingRelationOperations = {
  /**
   * Obtiene todas las relaciones
   */
  getAll: async () => executeInDbContext(async () => {
    const relations = await recordingProjectsDb.data;
    return relations || [];
  }),

  /**
   * Encuentra relación por grabación
   */
  findByRecording: async (recordingId) => executeInDbContext(async () => {
    const relations = await recordingProjectsDb.getVal('recordingId', '=', recordingId);
    return relations && relations.length > 0 ? relations[0] : null;
  }),

  /**
   * Encuentra relaciones por proyecto
   */
  findByProject: async (projectId) => executeInDbContext(async () => {
    const relations = await recordingProjectsDb.getVal('projectId', '=', projectId);
    return relations || [];
  }),

  /**
   * Crea o actualiza una relación
   */
  upsert: async (projectId, recordingId) => {
    const existing = await RecordingRelationOperations.findByRecording(recordingId);
    
    return executeInDbContext(async () => {
      if (existing) {
        const wasReassigned = existing.projectId !== projectId;
        const previousProject = wasReassigned 
          ? await ProjectOperations.findById(existing.projectId)
          : null;

        const updated = DataTransformers.updateRecordingRelation(existing, projectId);
        await recordingProjectsDb.updateVals('recordingId', '=', recordingId, updated);

        return { wasReassigned, previousProject };
      }

      const relation = DataTransformers.createRecordingRelation(projectId, recordingId);
      await recordingProjectsDb.setVal(relation);
      
      return { wasReassigned: false, previousProject: null };
    });
  },

  /**
   * Elimina una relación
   */
  delete: async (recordingId) => executeInDbContext(async () => {
    await recordingProjectsDb.deleteteVals('recordingId', '=', recordingId);
    return true;
  }),

  /**
   * Elimina todas las relaciones de un proyecto
   */
  deleteByProject: async (projectId) => executeInDbContext(async () => {
    await recordingProjectsDb.deleteteVals('projectId', '=', projectId);
    return true;
  }),

  /**
   * Obtiene IDs de grabaciones de un proyecto
   */
  getRecordingIds: async (projectId) => {
    const relations = await RecordingRelationOperations.findByProject(projectId);
    return relations.map(r => r.recordingId);
  }
};

/**
 * API Pública del servicio
 */
const ProjectsDatabase = {
  // Proyectos
  projects: {
    getAll: ProjectOperations.getAll,
    create: ProjectOperations.create,
    update: ProjectOperations.update,
    delete: ProjectOperations.delete,
    findById: ProjectOperations.findById
  },

  // Relaciones grabación-proyecto
  relations: {
    getAll: RecordingRelationOperations.getAll,
    findByRecording: RecordingRelationOperations.findByRecording,
    findByProject: RecordingRelationOperations.findByProject,
    upsert: RecordingRelationOperations.upsert,
    delete: RecordingRelationOperations.delete,
    deleteByProject: RecordingRelationOperations.deleteByProject,
    getRecordingIds: RecordingRelationOperations.getRecordingIds
  },

  // Operaciones compuestas
  async deleteProjectWithRelations(projectId) {
    await this.relations.deleteByProject(projectId);
    await this.projects.delete(projectId);
    return true;
  },

  async getProjectWithRecordings(projectId) {
    const [project, recordingIds] = await Promise.all([
      this.projects.findById(projectId),
      this.relations.getRecordingIds(projectId)
    ]);

    return { project, recordingIds };
  },

  async getRecordingProject(recordingId) {
    const relation = await this.relations.findByRecording(recordingId);
    if (!relation) return null;

    const project = await this.projects.findById(relation.projectId);
    return project;
  }
};

module.exports = ProjectsDatabase;

