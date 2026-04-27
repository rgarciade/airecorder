/**
 * Tests para SpeakersDbService
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDB, initTestDB } from './dbSetup.js';

describe('SpeakersDbService', () => {
  let db;
  let speakers;
  let recordings;

  beforeEach(() => {
    db = createTestDB();
    const services = initTestDB(db);
    speakers = services.speakers;
    recordings = services.recordings;
  });

  describe('createSpeaker', () => {
    it('debería crear un hablante con alias y UUID', () => {
      const speaker = speakers.createSpeaker('Juan Pérez');
      expect(speaker).toBeDefined();
      expect(speaker.id).toBeDefined();
      expect(speaker.display_name).toBe('Juan Pérez');
    });

    it('debería generar UUIDs únicos para cada hablante', () => {
      const speaker1 = speakers.createSpeaker('Speaker 1');
      const speaker2 = speakers.createSpeaker('Speaker 2');
      expect(speaker1.id).not.toBe(speaker2.id);
    });
  });

  describe('getSpeakerByAlias', () => {
    it('debería encontrar un hablante por alias', () => {
      speakers.createSpeaker('Juan Pérez');
      const speaker = speakers.getSpeakerByAlias('Juan Pérez');
      expect(speaker).toBeDefined();
      expect(speaker.display_name).toBe('Juan Pérez');
    });

    it('debería devolver null si no existe', () => {
      const speaker = speakers.getSpeakerByAlias('Nonexistent');
      expect(speaker).toBeNull();
    });

    it('debería ser case-sensitive', () => {
      speakers.createSpeaker('Juan Pérez');
      const speaker = speakers.getSpeakerByAlias('juan pérez');
      expect(speaker).toBeNull();
    });
  });

  describe('getAllSpeakers', () => {
    it('debería devolver todos los hablantes ordenados por nombre', () => {
      speakers.createSpeaker('Zoe');
      speakers.createSpeaker('Ana');
      speakers.createSpeaker('Carlos');
      const all = speakers.getAllSpeakers();
      expect(all.length).toBe(3);
      expect(all[0].display_name).toBe('Ana');
      expect(all[1].display_name).toBe('Carlos');
      expect(all[2].display_name).toBe('Zoe');
    });

    it('debería devolver array vacío si no hay hablantes', () => {
      const all = speakers.getAllSpeakers();
      expect(all).toEqual([]);
    });

    it('debería incluir id, display_name y created_at', () => {
      speakers.createSpeaker('Test');
      const all = speakers.getAllSpeakers();
      expect(all[0]).toHaveProperty('id');
      expect(all[0]).toHaveProperty('display_name');
      expect(all[0]).toHaveProperty('created_at');
    });
  });

  describe('deleteSpeaker', () => {
    it('debería eliminar un hablante', () => {
      const speaker = speakers.createSpeaker('Test');
      const result = speakers.deleteSpeaker(speaker.id);
      expect(result.success).toBe(true);
      const found = speakers.getSpeakerByAlias('Test');
      expect(found).toBeNull();
    });

    it('debería eliminar embeddings en cascada', () => {
      const speaker = speakers.createSpeaker('Test');
      const embedding = Buffer.from([0.1, 0.2, 0.3]);
      speakers.saveSpeakerEmbedding(speaker.id, embedding);
      speakers.deleteSpeaker(speaker.id);
      const embeddings = speakers.getEmbeddingsBySpeakerId(speaker.id);
      expect(embeddings.length).toBe(0);
    });
  });

  describe('saveSpeakerEmbedding', () => {
    it('debería guardar un embedding de hablante', () => {
      const speaker = speakers.createSpeaker('Test');
      const embedding = Buffer.from([0.1, 0.2, 0.3, 0.4, 0.5]);
      const result = speakers.saveSpeakerEmbedding(speaker.id, embedding);
      expect(result.success).toBe(true);
      expect(result.id).toBeDefined();
    });

    it('debería guardar embedding con recording_id opcional', () => {
      recordings.saveRecording('test/audio1.wav', 120.5);
      const speaker = speakers.createSpeaker('Test');
      const embedding = Buffer.from([0.1, 0.2, 0.3]);
      const result = speakers.saveSpeakerEmbedding(speaker.id, embedding, 1);
      expect(result.success).toBe(true);
    });

    it('debería permitir guardar múltiples embeddings para el mismo hablante', () => {
      const speaker = speakers.createSpeaker('Test');
      const embedding1 = Buffer.from([0.1, 0.2, 0.3]);
      const embedding2 = Buffer.from([0.4, 0.5, 0.6]);
      speakers.saveSpeakerEmbedding(speaker.id, embedding1);
      speakers.saveSpeakerEmbedding(speaker.id, embedding2);
      const embeddings = speakers.getEmbeddingsBySpeakerId(speaker.id);
      expect(embeddings.length).toBe(2);
    });
  });

  describe('getAllSpeakerEmbeddings', () => {
    it('debería devolver todos los embeddings', () => {
      const speaker1 = speakers.createSpeaker('Speaker 1');
      const speaker2 = speakers.createSpeaker('Speaker 2');
      speakers.saveSpeakerEmbedding(speaker1.id, Buffer.from([0.1, 0.2]));
      speakers.saveSpeakerEmbedding(speaker2.id, Buffer.from([0.3, 0.4]));
      const all = speakers.getAllSpeakerEmbeddings();
      expect(all.length).toBe(2);
    });
  });

  describe('getEmbeddingsBySpeakerId', () => {
    it('debería devolver embeddings de un hablante específico', () => {
      const speaker1 = speakers.createSpeaker('Speaker 1');
      const speaker2 = speakers.createSpeaker('Speaker 2');
      speakers.saveSpeakerEmbedding(speaker1.id, Buffer.from([0.1, 0.2]));
      speakers.saveSpeakerEmbedding(speaker1.id, Buffer.from([0.3, 0.4]));
      speakers.saveSpeakerEmbedding(speaker2.id, Buffer.from([0.5, 0.6]));
      const embeddings1 = speakers.getEmbeddingsBySpeakerId(speaker1.id);
      const embeddings2 = speakers.getEmbeddingsBySpeakerId(speaker2.id);
      expect(embeddings1.length).toBe(2);
      expect(embeddings2.length).toBe(1);
    });

    it('debería devolver array vacío si no hay embeddings', () => {
      const speaker = speakers.createSpeaker('Test');
      const embeddings = speakers.getEmbeddingsBySpeakerId(speaker.id);
      expect(embeddings).toEqual([]);
    });
  });

  describe('deleteSpeakerEmbedding', () => {
    it('debería eliminar un embedding específico', () => {
      const speaker = speakers.createSpeaker('Test');
      const result1 = speakers.saveSpeakerEmbedding(speaker.id, Buffer.from([0.1, 0.2]));
      speakers.saveSpeakerEmbedding(speaker.id, Buffer.from([0.3, 0.4]));
      const deleted = speakers.deleteSpeakerEmbedding(result1.id);
      expect(deleted.success).toBe(true);
      const embeddings = speakers.getEmbeddingsBySpeakerId(speaker.id);
      expect(embeddings.length).toBe(1);
    });
  });

  describe('reassignSpeakerEmbeddings', () => {
    it('debería reasignar embeddings de un hablante a otro', () => {
      const speaker1 = speakers.createSpeaker('Speaker 1');
      const speaker2 = speakers.createSpeaker('Speaker 2');
      speakers.saveSpeakerEmbedding(speaker1.id, Buffer.from([0.1, 0.2]));
      speakers.saveSpeakerEmbedding(speaker1.id, Buffer.from([0.3, 0.4]));
      const result = speakers.reassignSpeakerEmbeddings(speaker1.id, speaker2.id);
      expect(result.success).toBe(true);
      const embeddings1 = speakers.getEmbeddingsBySpeakerId(speaker1.id);
      const embeddings2 = speakers.getEmbeddingsBySpeakerId(speaker2.id);
      expect(embeddings1.length).toBe(0);
      expect(embeddings2.length).toBe(2);
    });
  });

  describe('Resolución persistente de hablantes', () => {
    it('debería guardar resolución de hablante efímero a persistente', () => {
      recordings.saveRecording('test/audio1.wav', 120.5);
      const speaker = speakers.createSpeaker('Juan Pérez');
      const result = speakers.upsertRecordingSpeakerResolution(1, 'SPEAKER_00', speaker.id);
      expect(result.success).toBe(true);
    });

    it('debería obtener resoluciones de una grabación', () => {
      recordings.saveRecording('test/audio1.wav', 120.5);
      const speaker = speakers.createSpeaker('Juan Pérez');
      speakers.upsertRecordingSpeakerResolution(1, 'SPEAKER_00', speaker.id);
      const resolutions = speakers.getRecordingSpeakerResolutions(1);
      expect(resolutions).toBeDefined();
      expect(resolutions['SPEAKER_00']).toBeDefined();
      expect(resolutions['SPEAKER_00'].speakerId).toBe(speaker.id);
      expect(resolutions['SPEAKER_00'].displayName).toBe('Juan Pérez');
    });

    it('debería devolver null si no hay resoluciones', () => {
      recordings.saveRecording('test/audio1.wav', 120.5);
      const resolutions = speakers.getRecordingSpeakerResolutions(1);
      expect(resolutions).toBeNull();
    });

    it('debería actualizar resolución existente (upsert)', () => {
      recordings.saveRecording('test/audio1.wav', 120.5);
      const speaker1 = speakers.createSpeaker('Speaker 1');
      const speaker2 = speakers.createSpeaker('Speaker 2');
      speakers.upsertRecordingSpeakerResolution(1, 'SPEAKER_00', speaker1.id);
      speakers.upsertRecordingSpeakerResolution(1, 'SPEAKER_00', speaker2.id);
      const resolutions = speakers.getRecordingSpeakerResolutions(1);
      expect(resolutions['SPEAKER_00'].speakerId).toBe(speaker2.id);
    });

    it('debería eliminar una resolución', () => {
      recordings.saveRecording('test/audio1.wav', 120.5);
      const speaker = speakers.createSpeaker('Test');
      speakers.upsertRecordingSpeakerResolution(1, 'SPEAKER_00', speaker.id);
      const result = speakers.deleteRecordingSpeakerResolution(1, 'SPEAKER_00');
      expect(result.success).toBe(true);
      const resolutions = speakers.getRecordingSpeakerResolutions(1);
      expect(resolutions).toBeNull();
    });

    it('debería reasignar resoluciones de un speaker a otro', () => {
      recordings.saveRecording('test/audio1.wav', 120.5);
      const speaker1 = speakers.createSpeaker('Speaker 1');
      const speaker2 = speakers.createSpeaker('Speaker 2');
      speakers.upsertRecordingSpeakerResolution(1, 'SPEAKER_00', speaker1.id);
      speakers.upsertRecordingSpeakerResolution(1, 'SPEAKER_01', speaker1.id);
      const result = speakers.reassignRecordingSpeakerResolutions(speaker1.id, speaker2.id);
      expect(result.success).toBe(true);
      const resolutions = speakers.getRecordingSpeakerResolutions(1);
      expect(resolutions['SPEAKER_00'].speakerId).toBe(speaker2.id);
      expect(resolutions['SPEAKER_01'].speakerId).toBe(speaker2.id);
    });
  });
});