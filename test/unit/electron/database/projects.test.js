/**
 * Tests para ProjectsDbService
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDB, initTestDB } from './dbSetup.js';

describe('ProjectsDbService', () => {
  let db;
  let projects;
  let recordings;

  beforeEach(() => {
    db = createTestDB();
    const services = initTestDB(db);
    projects = services.projects;
    recordings = services.recordings;
  });

  describe('createProject', () => {
    it('debería crear un proyecto con nombre y descripción', () => {
      const project = projects.createProject('Test Project', 'Descripción de prueba', ['member1', 'member2']);
      expect(project).toBeDefined();
      expect(project.id).toBe(1);
      expect(project.name).toBe('Test Project');
      expect(project.description).toBe('Descripción de prueba');
      expect(project.members).toEqual(['member1', 'member2']);
      expect(project.is_updated).toBe(1);
    });

    it('debería crear un proyecto con valores por defecto', () => {
      const project = projects.createProject('Test Project');
      expect(project.description).toBe('');
      expect(project.members).toEqual([]);
    });
  });

  describe('getAllProjects', () => {
    it('debería devolver todos los proyectos ordenados por updated_at', () => {
      projects.createProject('Project 1');
      projects.createProject('Project 2');
      projects.createProject('Project 3');
      const all = projects.getAllProjects();
      expect(all.length).toBe(3);
      expect(all.map(p => p.name)).toContain('Project 1');
      expect(all.map(p => p.name)).toContain('Project 2');
      expect(all.map(p => p.name)).toContain('Project 3');
    });

    it('debería devolver array vacío si no hay proyectos', () => {
      const all = projects.getAllProjects();
      expect(all).toEqual([]);
    });

    it('debería parsear el campo members como JSON', () => {
      projects.createProject('Test', '', ['user1', 'user2']);
      const all = projects.getAllProjects();
      expect(Array.isArray(all[0].members)).toBe(true);
      expect(all[0].members).toEqual(['user1', 'user2']);
    });
  });

  describe('getProjectById', () => {
    it('debería devolver un proyecto por ID', () => {
      const created = projects.createProject('Test Project', 'Description');
      const project = projects.getProjectById(created.id);
      expect(project).toBeDefined();
      expect(project.name).toBe('Test Project');
    });

    it('debería devolver null si el ID no existe', () => {
      const project = projects.getProjectById(999);
      expect(project).toBeNull();
    });
  });

  describe('updateProject', () => {
    it('debería actualizar un proyecto', () => {
      const created = projects.createProject('Old Name', 'Old Desc');
      const updated = projects.updateProject(created.id, 'New Name', 'New Desc', ['member1']);
      expect(updated.name).toBe('New Name');
      expect(updated.description).toBe('New Desc');
      expect(updated.members).toEqual(['member1']);
    });

    it('debería actualizar updated_at', () => {
      const created = projects.createProject('Test');
      const before = new Date(created.updated_at).getTime();
      const updated = projects.updateProject(created.id, 'Test', 'Test', []);
      const after = new Date(updated.updated_at).getTime();
      expect(after).toBeGreaterThanOrEqual(before);
    });
  });

  describe('deleteProject', () => {
    it('debería eliminar un proyecto', () => {
      const created = projects.createProject('Test');
      projects.deleteProject(created.id);
      const project = projects.getProjectById(created.id);
      expect(project).toBeNull();
    });
  });

  describe('updateProjectSyncStatus', () => {
    it('debería actualizar el estado de sincronización', () => {
      const created = projects.createProject('Test');
      projects.updateProjectSyncStatus(created.id, 0);
      const project = projects.getProjectById(created.id);
      expect(project.is_updated).toBe(0);
    });
  });

  describe('Relaciones proyecto-grabación', () => {
    it('debería añadir una grabación a un proyecto', () => {
      const project = projects.createProject('Test');
      recordings.saveRecording('test/audio1.wav', 120.5);
      projects.addRecordingToProject(project.id, 1);
      const ids = projects.getProjectRecordingIds(project.id);
      expect(ids).toContain(1);
    });

    it('debería marcar proyecto como desactualizado al añadir grabación', () => {
      const project = projects.createProject('Test');
      recordings.saveRecording('test/audio1.wav', 120.5);
      projects.addRecordingToProject(project.id, 1);
      const updated = projects.getProjectById(project.id);
      expect(updated.is_updated).toBe(0);
    });

    it('debería eliminar una grabación de un proyecto', () => {
      const project = projects.createProject('Test');
      recordings.saveRecording('test/audio1.wav', 120.5);
      projects.addRecordingToProject(project.id, 1);
      projects.removeRecordingFromProject(project.id, 1);
      const ids = projects.getProjectRecordingIds(project.id);
      expect(ids).not.toContain(1);
    });

    it('debería obtener el proyecto de una grabación', () => {
      const project = projects.createProject('Test');
      recordings.saveRecording('test/audio1.wav', 120.5);
      projects.addRecordingToProject(project.id, 1);
      const found = projects.getRecordingProject(1);
      expect(found).toBeDefined();
      expect(found.id).toBe(project.id);
    });

    it('debería obtener el proyecto de una grabación por path (retrocompatibilidad)', () => {
      const project = projects.createProject('Test');
      recordings.saveRecording('test/audio1.wav', 120.5);
      projects.addRecordingToProject(project.id, 1);
      const found = projects.getRecordingProject('test/audio1.wav');
      expect(found).toBeDefined();
      expect(found.id).toBe(project.id);
    });

    it('debería obtener la duración total de un proyecto', () => {
      const project = projects.createProject('Test');
      recordings.saveRecording('test/audio1.wav', 3600);
      recordings.saveRecording('test/audio2.wav', 7200);
      projects.addRecordingToProject(project.id, 1);
      projects.addRecordingToProject(project.id, 2);
      const duration = projects.getProjectTotalDuration(project.id);
      expect(duration).toBe(10800);
    });

    it('debería devolver 0 si el proyecto no tiene grabaciones', () => {
      const project = projects.createProject('Test');
      const duration = projects.getProjectTotalDuration(project.id);
      expect(duration).toBe(0);
    });
  });
});