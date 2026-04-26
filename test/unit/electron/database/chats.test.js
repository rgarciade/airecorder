/**
 * Tests para ChatsDbService
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDB, initTestDB } from './dbSetup.js';

describe('ChatsDbService', () => {
  let db;
  let chats;
  let projects;

  beforeEach(() => {
    db = createTestDB();
    const services = initTestDB(db);
    chats = services.chats;
    projects = services.projects;
  });

  describe('createProjectChat', () => {
    it('debería crear un chat con contexto vacío', () => {
      const project = projects.createProject('Test');
      const chat = chats.createProjectChat('chat-1', project.id, 'Chat Test');
      expect(chat).toBeDefined();
      expect(chat.id).toBe('chat-1');
      expect(chat.project_id).toBe(project.id);
      expect(chat.nombre).toBe('Chat Test');
      expect(chat.contexto).toEqual([]);
    });

    it('debería crear un chat con contexto de grabaciones', () => {
      const project = projects.createProject('Test');
      const context = ['rec1', 'rec2', 'rec3'];
      const chat = chats.createProjectChat('chat-1', project.id, 'Chat Test', context);
      expect(chat.contexto).toEqual(context);
    });
  });

  describe('getProjectChats', () => {
    it('debería devolver todos los chats de un proyecto', () => {
      const project = projects.createProject('Test');
      chats.createProjectChat('chat-1', project.id, 'Chat 1');
      chats.createProjectChat('chat-2', project.id, 'Chat 2');
      chats.createProjectChat('chat-3', project.id, 'Chat 3');
      const all = chats.getProjectChats(project.id);
      expect(all.length).toBe(3);
      expect(all.map(c => c.nombre)).toContain('Chat 1');
      expect(all.map(c => c.nombre)).toContain('Chat 2');
      expect(all.map(c => c.nombre)).toContain('Chat 3');
    });

    it('debería devolver array vacío si no hay chats', () => {
      const project = projects.createProject('Test');
      const all = chats.getProjectChats(project.id);
      expect(all).toEqual([]);
    });

    it('debería parsear contexto como JSON', () => {
      const project = projects.createProject('Test');
      chats.createProjectChat('chat-1', project.id, 'Chat', ['rec1', 'rec2']);
      const all = chats.getProjectChats(project.id);
      expect(Array.isArray(all[0].contexto)).toBe(true);
    });

    it('debería incluir ultimo_mensaje y nombre', () => {
      const project = projects.createProject('Test');
      chats.createProjectChat('chat-1', project.id, 'My Chat');
      const all = chats.getProjectChats(project.id);
      expect(all[0].ultimo_mensaje).toBeDefined();
      expect(all[0].nombre).toBe('My Chat');
    });
  });

  describe('deleteProjectChat', () => {
    it('debería eliminar un chat', () => {
      const project = projects.createProject('Test');
      chats.createProjectChat('chat-1', project.id, 'Chat Test');
      chats.deleteProjectChat('chat-1');
      const all = chats.getProjectChats(project.id);
      expect(all.length).toBe(0);
    });

    it('debería eliminar mensajes en cascada', () => {
      const project = projects.createProject('Test');
      chats.createProjectChat('chat-1', project.id, 'Chat Test');
      chats.saveProjectChatMessage('chat-1', 'usuario', 'Hola');
      chats.deleteProjectChat('chat-1');
      const messages = chats.getChatMessages('chat-1');
      expect(messages).toEqual([]);
    });
  });

  describe('saveProjectChatMessage', () => {
    it('debería guardar un mensaje de usuario', () => {
      const project = projects.createProject('Test');
      chats.createProjectChat('chat-1', project.id, 'Chat Test');
      const message = chats.saveProjectChatMessage('chat-1', 'usuario', 'Hola');
      expect(message).toBeDefined();
      expect(message.tipo).toBe('usuario');
      expect(message.contenido).toBe('Hola');
      expect(message.fecha).toBeDefined();
    });

    it('debería guardar un mensaje de asistente', () => {
      const project = projects.createProject('Test');
      chats.createProjectChat('chat-1', project.id, 'Chat Test');
      const message = chats.saveProjectChatMessage('chat-1', 'asistente', 'Respuesta');
      expect(message.tipo).toBe('asistente');
      expect(message.contenido).toBe('Respuesta');
    });

    it('debería actualizar updated_at del chat', () => {
      const project = projects.createProject('Test');
      chats.createProjectChat('chat-1', project.id, 'Chat Test');
      chats.saveProjectChatMessage('chat-1', 'usuario', 'Hola');
      const updated = chats.getProjectChats(project.id)[0];
      expect(updated.ultimo_mensaje).toBeDefined();
    });
  });

  describe('getChatMessages', () => {
    it('debería devolver mensajes ordenados por fecha', () => {
      const project = projects.createProject('Test');
      chats.createProjectChat('chat-1', project.id, 'Chat Test');
      chats.saveProjectChatMessage('chat-1', 'usuario', 'Hola');
      chats.saveProjectChatMessage('chat-1', 'asistente', 'Hola, ¿en qué puedo ayudar?');
      chats.saveProjectChatMessage('chat-1', 'usuario', 'Necesito ayuda');
      const messages = chats.getChatMessages('chat-1');
      expect(messages.length).toBe(3);
      expect(messages[0].tipo).toBe('usuario');
      expect(messages[0].contenido).toBe('Hola');
      expect(messages[1].tipo).toBe('asistente');
      expect(messages[2].tipo).toBe('usuario');
    });

    it('debería devolver array vacío si no hay mensajes', () => {
      const project = projects.createProject('Test');
      chats.createProjectChat('chat-1', project.id, 'Chat Test');
      const messages = chats.getChatMessages('chat-1');
      expect(messages).toEqual([]);
    });

    it('debería mapear correctamente los campos', () => {
      const project = projects.createProject('Test');
      chats.createProjectChat('chat-1', project.id, 'Chat Test');
      chats.saveProjectChatMessage('chat-1', 'usuario', 'Test');
      const messages = chats.getChatMessages('chat-1');
      expect(messages[0]).toHaveProperty('id');
      expect(messages[0]).toHaveProperty('tipo');
      expect(messages[0]).toHaveProperty('contenido');
      expect(messages[0]).toHaveProperty('fecha');
    });
  });

  describe('clearChatMessages', () => {
    it('debería eliminar todos los mensajes de un chat', () => {
      const project = projects.createProject('Test');
      chats.createProjectChat('chat-1', project.id, 'Chat Test');
      chats.saveProjectChatMessage('chat-1', 'usuario', 'Mensaje 1');
      chats.saveProjectChatMessage('chat-1', 'asistente', 'Mensaje 2');
      chats.clearChatMessages('chat-1');
      const messages = chats.getChatMessages('chat-1');
      expect(messages.length).toBe(0);
    });

    it('no debería eliminar el chat, solo los mensajes', () => {
      const project = projects.createProject('Test');
      chats.createProjectChat('chat-1', project.id, 'Chat Test');
      chats.saveProjectChatMessage('chat-1', 'usuario', 'Test');
      chats.clearChatMessages('chat-1');
      const all = chats.getProjectChats(project.id);
      expect(all.length).toBe(1);
    });
  });
});