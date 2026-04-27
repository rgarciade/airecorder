/**
 * Tests para TasksDbService
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDB, initTestDB } from './dbSetup.js';

describe('TasksDbService', () => {
  let db;
  let tasks;
  let projects;
  let recordings;

  beforeEach(() => {
    db = createTestDB();
    const services = initTestDB(db);
    tasks = services.tasks;
    projects = services.projects;
    recordings = services.recordings;
  });

  describe('addTaskSuggestion', () => {
    it('debería añadir una sugerencia de tarea para una grabación', () => {
      recordings.saveRecording('test/audio1.wav', 120.5);
      const task = tasks.addTaskSuggestion(1, 'Tarea de prueba', 'Descripción', 'general', true);
      expect(task).toBeDefined();
      expect(task.id).toBeDefined();
      expect(task.title).toBe('Tarea de prueba');
      expect(task.content).toBe('Descripción');
      expect(task.layer).toBe('general');
      expect(task.created_by_ai).toBe(1);
    });

    it('debería usar valores por defecto', () => {
      recordings.saveRecording('test/audio1.wav', 120.5);
      const task = tasks.addTaskSuggestion(1, 'Tarea');
      expect(task.content).toBe('');
      expect(task.layer).toBe('general');
      expect(task.created_by_ai).toBe(1);
    });

    it('debería permitir crear tarea no generada por IA', () => {
      recordings.saveRecording('test/audio1.wav', 120.5);
      const task = tasks.addTaskSuggestion(1, 'Tarea manual', '', 'general', false);
      expect(task.created_by_ai).toBe(0);
    });
  });

  describe('getTaskSuggestions', () => {
    it('debería devolver tareas de una grabación ordenadas por fecha', () => {
      recordings.saveRecording('test/audio1.wav', 120.5);
      tasks.addTaskSuggestion(1, 'Tarea 1');
      tasks.addTaskSuggestion(1, 'Tarea 2');
      tasks.addTaskSuggestion(1, 'Tarea 3');
      const all = tasks.getTaskSuggestions(1);
      expect(all.length).toBe(3);
      expect(all[0].title).toBe('Tarea 1');
    });

    it('debería devolver array vacío si no hay tareas', () => {
      recordings.saveRecording('test/audio1.wav', 120.5);
      const all = tasks.getTaskSuggestions(1);
      expect(all).toEqual([]);
    });
  });

  describe('updateTaskSuggestion', () => {
    it('debería actualizar una tarea', () => {
      recordings.saveRecording('test/audio1.wav', 120.5);
      const task = tasks.addTaskSuggestion(1, 'Old Title', 'Old Content');
      const updated = tasks.updateTaskSuggestion(task.id, 'New Title', 'New Content', 'planning', 'in_progress');
      expect(updated.title).toBe('New Title');
      expect(updated.content).toBe('New Content');
      expect(updated.layer).toBe('planning');
      expect(updated.status).toBe('in_progress');
    });

    it('debería usar valores por defecto', () => {
      recordings.saveRecording('test/audio1.wav', 120.5);
      const task = tasks.addTaskSuggestion(1, 'Title');
      const updated = tasks.updateTaskSuggestion(task.id, 'Title');
      expect(updated.layer).toBe('general');
      expect(updated.status).toBe('backlog');
    });
  });

  describe('deleteTaskSuggestion', () => {
    it('debería eliminar una tarea', () => {
      recordings.saveRecording('test/audio1.wav', 120.5);
      const task = tasks.addTaskSuggestion(1, 'Tarea');
      tasks.deleteTaskSuggestion(task.id);
      const all = tasks.getTaskSuggestions(1);
      expect(all.length).toBe(0);
    });
  });

  describe('createProjectTask', () => {
    it('debería crear una tarea directa para un proyecto', () => {
      const project = projects.createProject('Test');
      const task = tasks.createProjectTask(project.id, 'Tarea de proyecto', 'Descripción', 'planning', 'todo');
      expect(task).toBeDefined();
      expect(task.project_id).toBe(project.id);
      expect(task.title).toBe('Tarea de proyecto');
      expect(task.created_by_ai).toBe(0);
    });

    it('debería usar valores por defecto', () => {
      const project = projects.createProject('Test');
      const task = tasks.createProjectTask(project.id, 'Tarea');
      expect(task.layer).toBe('general');
      expect(task.status).toBe('backlog');
    });
  });

  describe('getTaskSuggestionsByProject', () => {
    it('debería devolver tareas de un proyecto ordenadas por sort_order y fecha', () => {
      const project = projects.createProject('Test');
      const task1 = tasks.createProjectTask(project.id, 'Tarea 1');
      const task2 = tasks.createProjectTask(project.id, 'Tarea 2');
      const task3 = tasks.createProjectTask(project.id, 'Tarea 3');
      tasks.updateTasksSortOrder([
        { id: task1.id, sort_order: 10 },
        { id: task2.id, sort_order: 5 },
        { id: task3.id, sort_order: 1 }
      ]);
      const all = tasks.getTaskSuggestionsByProject(project.id);
      expect(all.length).toBe(3);
      expect(all[0].id).toBe(task3.id);
      expect(all[1].id).toBe(task2.id);
      expect(all[2].id).toBe(task1.id);
    });

    it('debería incluir recording_db_id si la tarea está vinculada a grabación', () => {
      const project = projects.createProject('Test');
      recordings.saveRecording('test/audio1.wav', 120.5);
      const task = tasks.addTaskSuggestion(1, 'Tarea con recording');
      tasks.addTaskToProject(task.id, project.id);
      const all = tasks.getTaskSuggestionsByProject(project.id);
      expect(all.length).toBe(1);
      expect(all[0]).toHaveProperty('recording_db_id');
    });
  });

  describe('addTaskToProject', () => {
    it('debería añadir una tarea de grabación a un proyecto', () => {
      recordings.saveRecording('test/audio1.wav', 120.5);
      const task = tasks.addTaskSuggestion(1, 'Tarea');
      const project = projects.createProject('Test');
      const updated = tasks.addTaskToProject(task.id, project.id);
      expect(updated.project_id).toBe(project.id);
    });
  });

  describe('removeTaskFromProject', () => {
    it('debería eliminar una tarea de un proyecto (poner project_id a null)', () => {
      recordings.saveRecording('test/audio1.wav', 120.5);
      const task = tasks.addTaskSuggestion(1, 'Tarea');
      const project = projects.createProject('Test');
      tasks.addTaskToProject(task.id, project.id);
      tasks.removeTaskFromProject(task.id);
      const all = tasks.getTaskSuggestionsByProject(project.id);
      expect(all.length).toBe(0);
    });
  });

  describe('updateTasksSortOrder', () => {
    it('debería actualizar el orden de varias tareas', () => {
      const project = projects.createProject('Test');
      const task1 = tasks.createProjectTask(project.id, 'Tarea 1');
      const task2 = tasks.createProjectTask(project.id, 'Tarea 2');
      const task3 = tasks.createProjectTask(project.id, 'Tarea 3');
      tasks.updateTasksSortOrder([
        { id: task1.id, sort_order: 2 },
        { id: task2.id, sort_order: 1 },
        { id: task3.id, sort_order: 0 }
      ]);
      const all = tasks.getTaskSuggestionsByProject(project.id);
      expect(all[0].id).toBe(task3.id);
      expect(all[1].id).toBe(task2.id);
      expect(all[2].id).toBe(task1.id);
    });

    it('debería manejar actualizaciones vacías', () => {
      const project = projects.createProject('Test');
      tasks.createProjectTask(project.id, 'Tarea');
      expect(() => tasks.updateTasksSortOrder([])).not.toThrow();
    });
  });

  describe('Task Comments', () => {
    it('debería añadir un comentario a una tarea', () => {
      recordings.saveRecording('test/audio1.wav', 120.5);
      const task = tasks.addTaskSuggestion(1, 'Tarea');
      const comment = tasks.addTaskComment(task.id, 'Comentario de prueba');
      expect(comment).toBeDefined();
      expect(comment.task_id).toBe(task.id);
      expect(comment.content).toBe('Comentario de prueba');
    });

    it('debería obtener comentarios de una tarea ordenados por fecha', () => {
      recordings.saveRecording('test/audio1.wav', 120.5);
      const task = tasks.addTaskSuggestion(1, 'Tarea');
      tasks.addTaskComment(task.id, 'Comentario 1');
      tasks.addTaskComment(task.id, 'Comentario 2');
      tasks.addTaskComment(task.id, 'Comentario 3');
      const all = tasks.getTaskComments(task.id);
      expect(all.length).toBe(3);
      expect(all[0].content).toBe('Comentario 1');
    });

    it('debería eliminar un comentario', () => {
      recordings.saveRecording('test/audio1.wav', 120.5);
      const task = tasks.addTaskSuggestion(1, 'Tarea');
      const comment = tasks.addTaskComment(task.id, 'Comentario');
      tasks.deleteTaskComment(comment.id);
      const all = tasks.getTaskComments(task.id);
      expect(all.length).toBe(0);
    });
  });
});