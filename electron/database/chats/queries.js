// Chats & Messages — consultas SQL
module.exports = {
  CREATE_TABLE_CHATS: `
    CREATE TABLE IF NOT EXISTS project_chats (
      id TEXT PRIMARY KEY,
      project_id INTEGER,
      name TEXT NOT NULL,
      context_recordings TEXT DEFAULT '[]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `,

  CREATE_TABLE_MESSAGES: `
    CREATE TABLE IF NOT EXISTS project_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id TEXT,
      type TEXT NOT NULL, -- 'usuario' | 'asistente'
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (chat_id) REFERENCES project_chats(id) ON DELETE CASCADE
    );
  `,

  INSERT_CHAT: `
    INSERT INTO project_chats (id, project_id, name, context_recordings) VALUES (?, ?, ?, ?);
  `,

  UPDATE_CHAT_TIME: `
    UPDATE project_chats SET updated_at = CURRENT_TIMESTAMP WHERE id = ?;
  `,

  SELECT_PROJECT_CHATS: `
    SELECT * FROM project_chats WHERE project_id = ? ORDER BY updated_at DESC;
  `,

  DELETE_CHAT: `
    DELETE FROM project_chats WHERE id = ?;
  `,

  INSERT_MESSAGE: `
    INSERT INTO project_messages (chat_id, type, content) VALUES (?, ?, ?);
  `,

  SELECT_CHAT_MESSAGES: `
    SELECT * FROM project_messages WHERE chat_id = ? ORDER BY created_at ASC;
  `,

  DELETE_CHAT_MESSAGES: `
    DELETE FROM project_messages WHERE chat_id = ?;
  `
};