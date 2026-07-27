// Chats & Messages — base de datos
const BaseDbService = require('../baseDbService');
const {
  CREATE_TABLE_CHATS,
  CREATE_TABLE_MESSAGES,
  INSERT_CHAT,
  UPDATE_CHAT_TIME,
  SELECT_PROJECT_CHATS,
  DELETE_CHAT,
  INSERT_MESSAGE,
  SELECT_CHAT_MESSAGES,
  DELETE_CHAT_MESSAGES
} = require('./queries');

class ChatsDbService extends BaseDbService {
  constructor(db) {
    super(db, 'chats');
  }

  // ── Tablas ──────────────────────────────────────────────────────────────────

  init() {
    this.db.prepare(CREATE_TABLE_CHATS).run();
    this.db.prepare(CREATE_TABLE_MESSAGES).run();
  }

  // ── Chats ──────────────────────────────────────────────────────────────────

  getProjectChats(projectId) {
    const chats = this._getMany(SELECT_PROJECT_CHATS, [projectId]);
    return (chats || []).map(c => ({
      ...c,
      contexto: JSON.parse(c.context_recordings || '[]'),
      ultimo_mensaje: c.updated_at,
      nombre: c.name
    }));
  }

  createProjectChat(id, projectId, name, contextRecordings = []) {
    const result = this._run(INSERT_CHAT, [id, projectId, name, JSON.stringify(contextRecordings)]);
    if (!result.success) return null;
    return {
      id,
      project_id: projectId,
      nombre: name,
      contexto: contextRecordings,
      fecha_creacion: new Date().toISOString(),
      ultimo_mensaje: new Date().toISOString()
    };
  }

  deleteProjectChat(chatId) {
    return this._run(DELETE_CHAT, [chatId]);
  }

  // ── Mensajes ───────────────────────────────────────────────────────────────

  getChatMessages(chatId) {
    const messages = this._getMany(SELECT_CHAT_MESSAGES, [chatId]);
    return (messages || []).map(m => ({
      id: m.id,
      tipo: m.type,
      contenido: m.content,
      fecha: m.created_at
    }));
  }

  clearChatMessages(chatId) {
    return this._run(DELETE_CHAT_MESSAGES, [chatId]);
  }

  saveProjectChatMessage(chatId, type, content) {
    const result = this._insert(INSERT_MESSAGE, [chatId, type, content]);
    if (!result.success) return null;
    this._run(UPDATE_CHAT_TIME, [chatId]);
    return {
      id: result.id,
      tipo: type,
      contenido: content,
      fecha: new Date().toISOString()
    };
  }

  /**
   * Reemplaza atómicamente todos los mensajes de un chat (usado por /compact).
   * DELETE + N INSERT dentro de una única transacción de better-sqlite3: o se
   * aplica todo o no se aplica nada, nunca queda el chat a medio borrar.
   * @param {string} chatId
   * @param {Array<{tipo: 'usuario'|'asistente', contenido: string}>} messages
   */
  replaceChatMessages(chatId, messages = []) {
    if (!this.db) return { success: false, error: 'DB no inicializada' };
    try {
      const deleteStmt = this.db.prepare(DELETE_CHAT_MESSAGES);
      const insertStmt = this.db.prepare(INSERT_MESSAGE);
      const updateTimeStmt = this.db.prepare(UPDATE_CHAT_TIME);

      const runReplace = this.db.transaction((id, msgs) => {
        deleteStmt.run(id);
        for (const m of msgs) {
          insertStmt.run(id, m.tipo, m.contenido);
        }
        updateTimeStmt.run(id);
      });

      runReplace(chatId, messages);
      return { success: true };
    } catch (error) {
      this._log(`Error en replaceChatMessages: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
}

module.exports = ChatsDbService;