// Platform Connections & Project Integrations — consultas SQL
module.exports = {
  CREATE_TABLE_PLATFORM_CONNECTIONS: `
    CREATE TABLE IF NOT EXISTS platform_connections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform TEXT NOT NULL,
      account_name TEXT,
      account_id TEXT,
      access_token_encrypted BLOB,
      refresh_token_encrypted BLOB,
      token_expires_at DATETIME,
      scopes TEXT DEFAULT '[]',
      connected_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `,

  CREATE_TABLE_PROJECT_INTEGRATIONS: `
    CREATE TABLE IF NOT EXISTS project_integrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      connection_id INTEGER NOT NULL,
      channel_id TEXT NOT NULL,
      channel_name TEXT,
      chat_id TEXT,
      date_from TEXT,
      date_to TEXT,
      recording_id INTEGER,
      last_sync_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (connection_id) REFERENCES platform_connections(id) ON DELETE CASCADE
    );
  `,

  INSERT_PLATFORM_CONNECTION: `
    INSERT INTO platform_connections (platform, account_name, account_id, access_token_encrypted, refresh_token_encrypted, token_expires_at, scopes)
    VALUES (?, ?, ?, ?, ?, ?, ?);
  `,

  UPDATE_PLATFORM_CONNECTION_TOKENS: `
    UPDATE platform_connections
    SET access_token_encrypted = ?, refresh_token_encrypted = ?, token_expires_at = ?
    WHERE id = ?;
  `,

  SELECT_ALL_PLATFORM_CONNECTIONS: `
    SELECT id, platform, account_name, account_id, scopes, connected_at FROM platform_connections;
  `,

  SELECT_PLATFORM_CONNECTION_BY_ID: `
    SELECT * FROM platform_connections WHERE id = ?;
  `,

  DELETE_PLATFORM_CONNECTION: `
    DELETE FROM platform_connections WHERE id = ?;
  `,

  INSERT_PROJECT_INTEGRATION: `
    INSERT INTO project_integrations (project_id, connection_id, channel_id, channel_name, chat_id, date_from, date_to)
    VALUES (?, ?, ?, ?, ?, ?, ?);
  `,

  UPDATE_PROJECT_INTEGRATION_SYNC: `
    UPDATE project_integrations SET recording_id = ?, last_sync_at = ? WHERE id = ?;
  `,

  SELECT_PROJECT_INTEGRATIONS: `
    SELECT pi.*, pc.platform, pc.account_name
    FROM project_integrations pi
    JOIN platform_connections pc ON pi.connection_id = pc.id
    WHERE pi.project_id = ?
    ORDER BY pi.created_at ASC;
  `,

  SELECT_CHAT_INTEGRATIONS: `
    SELECT pi.*, pc.platform, pc.account_name
    FROM project_integrations pi
    JOIN platform_connections pc ON pi.connection_id = pc.id
    WHERE pi.chat_id = ?
    ORDER BY pi.created_at ASC;
  `,

  DELETE_PROJECT_INTEGRATION: `
    DELETE FROM project_integrations WHERE id = ?;
  `
};