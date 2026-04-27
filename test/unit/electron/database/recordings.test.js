/**
 * Tests para RecordingsDbService
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDB, initTestDB } from './dbSetup.js';

describe('RecordingsDbService', () => {
  let db;
  let recordings;

  beforeEach(() => {
    db = createTestDB();
    const services = initTestDB(db);
    recordings = services.recordings;
  });

  describe('saveRecording', () => {
    it('debería guardar una nueva grabación', () => {
      const result = recordings.saveRecording('test/audio1.wav', 120.5, 'recorded', null, 'whisper');
      expect(result.success).toBe(true);
      expect(result.id).toBe(1);
    });

    it('debería actualizar una grabación existente (mismo path)', () => {
      recordings.saveRecording('test/audio1.wav', 120.5, 'recorded', null, 'whisper');
      const result = recordings.saveRecording('test/audio1.wav', 150.0, 'transcribed', null, 'whisper-large');
      expect(result.success).toBe(true);
      const recording = recordings.getRecording('test/audio1.wav');
      expect(recording.duration).toBe(150.0);
      expect(recording.status).toBe('transcribed');
    });

    it('debería usar la fecha actual si no se proporciona createdAt', () => {
      const result = recordings.saveRecording('test/audio1.wav', 120.5);
      expect(result.success).toBe(true);
      const recording = recordings.getRecording('test/audio1.wav');
      expect(recording.created_at).toBeDefined();
    });
  });

  describe('updateStatus', () => {
    it('debería actualizar el estado de una grabación', () => {
      recordings.saveRecording('test/audio1.wav', 120.5, 'recorded');
      const result = recordings.updateStatus('test/audio1.wav', 'transcribed');
      expect(result.success).toBe(true);
      const recording = recordings.getRecording('test/audio1.wav');
      expect(recording.status).toBe('transcribed');
    });
  });

  describe('updateTranscriptionModel', () => {
    it('debería actualizar el modelo de transcripción', () => {
      recordings.saveRecording('test/audio1.wav', 120.5, 'recorded');
      const result = recordings.updateTranscriptionModel('test/audio1.wav', 'whisper-large-v3');
      expect(result.success).toBe(true);
      const recording = recordings.getRecording('test/audio1.wav');
      expect(recording.transcription_model).toBe('whisper-large-v3');
    });
  });

  describe('updateDuration', () => {
    it('debería actualizar la duración', () => {
      recordings.saveRecording('test/audio1.wav', 120.5);
      const result = recordings.updateDuration('test/audio1.wav', 180.0);
      expect(result.success).toBe(true);
      const recording = recordings.getRecording('test/audio1.wav');
      expect(recording.duration).toBe(180.0);
    });
  });

  describe('getRecording', () => {
    it('debería devolver una grabación por path', () => {
      recordings.saveRecording('test/audio1.wav', 120.5, 'recorded', null, 'whisper');
      const recording = recordings.getRecording('test/audio1.wav');
      expect(recording).toBeDefined();
      expect(recording.relative_path).toBe('test/audio1.wav');
      expect(recording.duration).toBe(120.5);
    });

    it('debería devolver null si no existe', () => {
      const recording = recordings.getRecording('nonexistent.wav');
      expect(recording).toBeNull();
    });
  });

  describe('getRecordingById', () => {
    it('debería devolver una grabación por ID', () => {
      recordings.saveRecording('test/audio1.wav', 120.5);
      const recording = recordings.getRecordingById(1);
      expect(recording).toBeDefined();
      expect(recording.id).toBe(1);
    });

    it('debería devolver null si el ID no existe', () => {
      const recording = recordings.getRecordingById(999);
      expect(recording).toBeNull();
    });
  });

  describe('getAllRecordings', () => {
    it('debería devolver todas las grabaciones ordenadas por fecha', () => {
      recordings.saveRecording('test/audio1.wav', 120.5, 'recorded', '2025-01-01T00:00:00Z');
      recordings.saveRecording('test/audio2.wav', 180.0, 'recorded', '2025-01-02T00:00:00Z');
      recordings.saveRecording('test/audio3.wav', 90.0, 'recorded', '2025-01-03T00:00:00Z');
      const all = recordings.getAllRecordings();
      expect(all.length).toBe(3);
      expect(all[0].relative_path).toBe('test/audio3.wav');
    });

    it('debería devolver array vacío si no hay grabaciones', () => {
      const all = recordings.getAllRecordings();
      expect(all).toEqual([]);
    });
  });

  describe('deleteRecording', () => {
    it('debería eliminar una grabación', () => {
      recordings.saveRecording('test/audio1.wav', 120.5);
      recordings.deleteRecording('test/audio1.wav');
      const recording = recordings.getRecording('test/audio1.wav');
      expect(recording).toBeNull();
    });
  });

  describe('getDashboardStats', () => {
    it('debería devolver estadísticas correctas', () => {
      recordings.saveRecording('test/audio1.wav', 3600, 'transcribed');
      recordings.saveRecording('test/audio2.wav', 7200, 'analyzed');
      recordings.saveRecording('test/audio3.wav', 1800, 'recorded');
      const stats = recordings.getDashboardStats();
      expect(stats.totalHours).toBe('3.5');
      expect(stats.totalTranscriptions).toBe(2);
      expect(stats.totalRecordings).toBe(3);
    });

    it('debería devolver ceros si no hay datos', () => {
      const stats = recordings.getDashboardStats();
      expect(stats.totalHours).toBe('0.0');
      expect(stats.totalTranscriptions).toBe(0);
      expect(stats.totalRecordings).toBe(0);
    });
  });

  describe('Queue de transcripción', () => {
    it('debería encolar una tarea', () => {
      recordings.saveRecording('test/audio1.wav', 120.5);
      const taskId = recordings.enqueueTask(1, 'whisper');
      expect(taskId).toBe(1);
      const task = recordings.getTaskById(taskId);
      expect(task.status).toBe('pending');
      expect(task.model).toBe('whisper');
    });

    it('debería obtener la siguiente tarea pendiente', () => {
      recordings.saveRecording('test/audio1.wav', 120.5);
      recordings.saveRecording('test/audio2.wav', 180.0);
      recordings.enqueueTask(1, 'whisper');
      recordings.enqueueTask(2, 'whisper-large');
      const next = recordings.getNextTask();
      expect(next).toBeDefined();
      expect(next.recording_id).toBe(1);
    });

    it('debería actualizar el estado de una tarea', () => {
      recordings.saveRecording('test/audio1.wav', 120.5);
      const taskId = recordings.enqueueTask(1, 'whisper');
      recordings.updateTask(taskId, 'processing', 'transcribing', 50);
      const task = recordings.getTaskById(taskId);
      expect(task.status).toBe('processing');
      expect(task.progress).toBe(50);
    });

    it('debería obtener tareas activas', () => {
      recordings.saveRecording('test/audio1.wav', 120.5);
      recordings.enqueueTask(1, 'whisper');
      recordings.updateTask(1, 'processing', 'transcribing', 50);
      const active = recordings.getActiveQueue();
      expect(active.length).toBe(1);
      expect(active[0].recording_name).toBe('test/audio1.wav');
    });

    it('debería obtener el historial de tareas completadas/fallidas', () => {
      recordings.saveRecording('test/audio1.wav', 120.5);
      recordings.enqueueTask(1, 'whisper');
      recordings.updateTask(1, 'completed', 'analyzed', 100);
      const history = recordings.getQueueHistory();
      expect(history.length).toBe(1);
      expect(history[0].status).toBe('completed');
    });

    it('debería obtener el estado de tarea por recording_id', () => {
      recordings.saveRecording('test/audio1.wav', 120.5);
      recordings.enqueueTask(1, 'whisper');
      const status = recordings.getRecordingTaskStatus(1);
      expect(status).toBeDefined();
      expect(status.status).toBe('pending');
    });

    it('debería resetear tareas atascadas', () => {
      recordings.saveRecording('test/audio1.wav', 120.5);
      recordings.enqueueTask(1, 'whisper');
      recordings.updateTask(1, 'processing', 'transcribing', 50);
      recordings.resetStuckTasks();
      const task = recordings.getTaskById(1);
      expect(task.status).toBe('pending');
      expect(task.step).toBe('queued');
      expect(task.progress).toBe(0);
    });
  });
});