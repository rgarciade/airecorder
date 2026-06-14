const { ipcMain } = require('electron');
const dbService = require('../database/dbService');

/**
 * Validates sections_json shape
 */
function validateSectionsJson(sections) {
  if (!Array.isArray(sections)) {
    return { valid: false, error: 'sections_json must be an array' };
  }
  for (const section of sections) {
    if (!section.id || typeof section.id !== 'string') {
      return { valid: false, error: 'Each section must have a string id' };
    }
    if (!section.title || typeof section.title !== 'string') {
      return { valid: false, error: 'Each section must have a string title' };
    }
    if (!section.type || typeof section.type !== 'string') {
      return { valid: false, error: 'Each section must have a string type' };
    }
    if (!section.instructions || typeof section.instructions !== 'string') {
      return { valid: false, error: 'Each section must have string instructions' };
    }
    if (typeof section.required !== 'boolean') {
      return { valid: false, error: 'Each section must have a boolean required field' };
    }
  }
  return { valid: true };
}

function registerTemplatesHandlers() {
  // ── Template CRUD ─────────────────────────────────────────────────────────

  // List ALL templates (for settings UI - includes disabled)
  ipcMain.handle('templates:list', () => {
    return dbService.listTemplates();
  });

  // List only enabled templates (for note creation selector)
  ipcMain.handle('templates:listEnabled', () => {
    return dbService.listEnabledTemplates();
  });

  // Get template by slug
  ipcMain.handle('templates:getBySlug', (_event, slug) => {
    return dbService.getTemplateBySlug(slug);
  });

  // Create custom template (is_builtin = 0)
  ipcMain.handle('templates:create', (_event, data) => {
    const { slug, name, icon, description, expert_id, sections_json } = data;

    // Validate required fields
    if (!slug || !name || !sections_json) {
      return { success: false, error: 'Missing required fields: slug, name, sections_json' };
    }

    // Validate sections_json shape
    let sections;
    try {
      sections = typeof sections_json === 'string' ? JSON.parse(sections_json) : sections_json;
    } catch (e) {
      return { success: false, error: 'Invalid JSON in sections_json' };
    }

    const validation = validateSectionsJson(sections);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // Create with is_builtin = 0 (handled in the query)
    return dbService.createUserTemplate(
      slug,
      name,
      icon || '',
      description || '',
      expert_id || 'general',
      JSON.stringify(sections)
    );
  });

  // Update custom template (rejects if is_builtin = 1)
  ipcMain.handle('templates:update', (_event, slug, data) => {
    const template = dbService.getTemplateBySlug(slug);
    if (!template) {
      return { success: false, error: 'Template not found' };
    }
    if (template.is_builtin === 1) {
      return { success: false, error: 'Cannot update built-in templates' };
    }

    const { name, icon, description, expert_id, sections_json } = data;

    // Validate sections_json if provided
    if (sections_json) {
      let sections;
      try {
        sections = typeof sections_json === 'string' ? JSON.parse(sections_json) : sections_json;
      } catch (e) {
        return { success: false, error: 'Invalid JSON in sections_json' };
      }
      const validation = validateSectionsJson(sections);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }
      data.sections_json = JSON.stringify(sections);
    }

    return dbService.updateUserTemplate(
      name || template.name,
      icon !== undefined ? icon : template.icon,
      description !== undefined ? description : template.description,
      expert_id || template.expert_id,
      data.sections_json || template.sections_json,
      slug
    );
  });

  // Delete custom template (rejects if is_builtin = 1)
  ipcMain.handle('templates:delete', (_event, slug) => {
    const template = dbService.getTemplateBySlug(slug);
    if (!template) {
      return { success: false, error: 'Template not found' };
    }
    if (template.is_builtin === 1) {
      return { success: false, error: 'Cannot delete built-in templates' };
    }

    return dbService.deleteUserTemplate(slug);
  });

  // Toggle template enabled/disabled
  ipcMain.handle('templates:toggleEnabled', (_event, slug, enabled) => {
    return dbService.toggleTemplateEnabled(enabled ? 1 : 0, slug);
  });

  // ── Recording Notes CRUD ─────────────────────────────────────────────────

  // Get all notes for a recording
  ipcMain.handle('templates:getNotesForRecording', (_event, recordingId) => {
    return dbService.getNotesForRecording(recordingId);
  });

  // Save a new note
  ipcMain.handle('templates:saveNote', (_event, data) => {
    const { recordingId, templateSlug, contentMd } = data;

    if (!recordingId || !templateSlug || !contentMd) {
      return { success: false, error: 'Missing required fields: recordingId, templateSlug, contentMd' };
    }

    return dbService.saveNote(recordingId, templateSlug, contentMd);
  });

  // Update note content
  ipcMain.handle('templates:updateNote', (_event, id, contentMd) => {
    if (!id || !contentMd) {
      return { success: false, error: 'Missing required fields: id, contentMd' };
    }

    return dbService.updateNoteContent(contentMd, id);
  });

  // Delete a note
  ipcMain.handle('templates:deleteNote', (_event, id) => {
    if (!id) {
      return { success: false, error: 'Missing required field: id' };
    }

    return dbService.deleteNote(id);
  });
}

module.exports = { registerTemplatesHandlers };