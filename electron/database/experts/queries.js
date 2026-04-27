// Expert Customizations — consultas SQL
// (módulo dedicado, sin dbService propio — el main dbService lo maneja directamente)
module.exports = {
  CREATE_TABLE_EXPERT_CUSTOMIZATIONS: `
    CREATE TABLE IF NOT EXISTS expert_customizations (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      expert_id    TEXT NOT NULL,
      feature      TEXT NOT NULL,
      instructions TEXT NOT NULL DEFAULT '',
      updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_expert_customizations
      ON expert_customizations(expert_id, feature);
  `,

  GET_EXPERT_CUSTOMIZATIONS: `
    SELECT feature, instructions FROM expert_customizations WHERE expert_id = ?;
  `,

  UPSERT_EXPERT_CUSTOMIZATION: `
    INSERT INTO expert_customizations (expert_id, feature, instructions, updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(expert_id, feature) DO UPDATE SET
      instructions = excluded.instructions,
      updated_at   = excluded.updated_at;
  `,

  RESET_EXPERT_CUSTOMIZATION: `
    DELETE FROM expert_customizations WHERE expert_id = ? AND feature = ?;
  `
};