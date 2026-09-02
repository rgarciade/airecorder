import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDB, initTestDB } from './dbSetup.js';
import templateQueries from '../../../../electron/database/templates/queries.js';

describe('template and note persistence queries', () => {
  let db;
  let recordings;

  beforeEach(() => {
    db = createTestDB();
    ({ recordings } = initTestDB(db));
  });

  it('persiste CRUD de templates personalizados y protege los builtin', () => {
    const builtin = db.prepare(templateQueries.GET_TEMPLATE_BY_SLUG).get('standup');
    const created = db.prepare(templateQueries.CREATE_USER_TEMPLATE).run(
      'custom-review', 'Custom review', '📝', 'Review notes', 'general', '[]'
    );

    const updated = db.prepare(templateQueries.UPDATE_USER_TEMPLATE).run(
      'Updated review', '✅', 'Updated', 'developer', '[{"id":"summary"}]', 'custom-review'
    );
    const protectedUpdate = db.prepare(templateQueries.UPDATE_USER_TEMPLATE).run(
      'Blocked', '⛔', 'Blocked', 'general', '[]', builtin.slug
    );
    const protectedDelete = db.prepare(templateQueries.DELETE_USER_TEMPLATE).run(builtin.slug);

    expect(builtin).toMatchObject({ is_builtin: 1, slug: 'standup' });
    expect(created.changes).toBe(1);
    expect(updated.changes).toBe(1);
    expect(db.prepare(templateQueries.GET_TEMPLATE_BY_SLUG).get('custom-review')).toMatchObject({ name: 'Updated review', expert_id: 'developer' });
    expect(protectedUpdate.changes).toBe(0);
    expect(protectedDelete.changes).toBe(0);
    expect(db.prepare(templateQueries.GET_TEMPLATE_BY_SLUG).get(builtin.slug).name).toBe(builtin.name);
    const deleted = db.prepare(templateQueries.DELETE_USER_TEMPLATE).run('custom-review');
    expect(deleted.changes).toBe(1);
    expect(db.prepare(templateQueries.GET_TEMPLATE_BY_SLUG).get('custom-review')).toBeUndefined();
  });

  it('filtra templates habilitados y ordena notas por timestamp explícito', () => {
    db.prepare(templateQueries.CREATE_USER_TEMPLATE).run('enabled-template', 'Enabled', null, null, 'general', '[]');
    db.prepare(templateQueries.CREATE_USER_TEMPLATE).run('disabled-template', 'Disabled', null, null, 'general', '[]');
    db.prepare(templateQueries.TOGGLE_TEMPLATE_ENABLED).run(0, 'disabled-template');
    const recording = recordings.saveRecording('test/template-notes.wav', 30);
    db.prepare("INSERT INTO recording_notes (recording_id, template_slug, content_md, generated_at) VALUES (?, ?, ?, ?)")
      .run(recording.id, 'enabled-template', 'Older note', '2026-01-01 10:00:00');
    db.prepare("INSERT INTO recording_notes (recording_id, template_slug, content_md, generated_at) VALUES (?, ?, ?, ?)")
      .run(recording.id, 'enabled-template', 'Newer note', '2026-01-02 10:00:00');

    const enabled = db.prepare(templateQueries.LIST_ENABLED_TEMPLATES).all();
    const notes = db.prepare(templateQueries.GET_NOTES_FOR_RECORDING).all(recording.id);

    expect(enabled.map(template => template.slug)).toContain('enabled-template');
    expect(enabled.map(template => template.slug)).not.toContain('disabled-template');
    expect(notes.map(note => note.content_md)).toEqual(['Newer note', 'Older note']);
  });

  it('elimina las notas cuando se elimina su grabación', () => {
    const recording = recordings.saveRecording('test/template-note-cascade.wav', 30);
    db.prepare(templateQueries.INSERT_NOTE).run(recording.id, 'standup', 'Cascade note');

    recordings.deleteRecording('test/template-note-cascade.wav');

    expect(db.prepare(templateQueries.GET_NOTES_FOR_RECORDING).all(recording.id)).toEqual([]);
  });
});
