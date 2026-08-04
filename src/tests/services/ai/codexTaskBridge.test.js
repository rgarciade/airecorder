import { describe, it, expect } from 'vitest';
import {
  CODEX_TASK_OUTPUT_SCHEMA,
  formatExistingTasksForCodex,
  buildCodexTaskInstructions,
} from '../../../services/ai/codexTaskBridge.js';

describe('codexTaskBridge', () => {
  describe('formatExistingTasksForCodex', () => {
    it('returns the empty-list placeholder for no tasks', () => {
      expect(formatExistingTasksForCodex([])).toBe('(no existing tasks)');
      expect(formatExistingTasksForCodex(null)).toBe('(no existing tasks)');
      expect(formatExistingTasksForCodex(undefined)).toBe('(no existing tasks)');
    });

    it('formats tasks with id/title/layer/status', () => {
      const tasks = [
        { id: 1, title: 'Arreglar login', layer: 'backend', status: 'in_progress' },
        { id: 2, title: 'Nueva tarea' },
      ];

      const result = formatExistingTasksForCodex(tasks);

      expect(result).toBe(
        '- [id:1] "Arreglar login" (layer: backend, status: in_progress)\n' +
        '- [id:2] "Nueva tarea" (layer: general, status: backlog)'
      );
    });
  });

  describe('buildCodexTaskInstructions', () => {
    it('embeds the existing-tasks block verbatim', () => {
      const block = '- [id:10] "Arreglar login" (layer: backend, status: backlog)';
      const instructions = buildCodexTaskInstructions(block);

      expect(instructions).toContain(block);
    });

    it('mentions the 3 available proposal actions', () => {
      const instructions = buildCodexTaskInstructions('(no existing tasks)');

      expect(instructions).toContain('create_task');
      expect(instructions).toContain('update_task');
      expect(instructions).toContain('delete_task');
    });

    it('explains the JSON output contract (reply + taskProposal)', () => {
      const instructions = buildCodexTaskInstructions('(no existing tasks)');

      expect(instructions).toContain('"reply"');
      expect(instructions).toContain('"taskProposal"');
    });
  });

  describe('CODEX_TASK_OUTPUT_SCHEMA', () => {
    it('requires reply and taskProposal, with the 3 known actions in the enum', () => {
      expect(CODEX_TASK_OUTPUT_SCHEMA.required).toEqual(['reply', 'taskProposal']);
      expect(CODEX_TASK_OUTPUT_SCHEMA.properties.taskProposal.properties.action.enum).toEqual([
        'create_task',
        'update_task',
        'delete_task',
      ]);
    });

    // Regresión del bug real reportado en producción ("Codex devolvió eventos JSONL
    // inválidos"): en modo estricto de OpenAI Structured Outputs, TODO campo listado
    // en "properties" debe figurar también en "required" — la "opcionalidad" se
    // expresa con un tipo nullable, nunca omitiendo el campo del array `required`.
    it('lists every taskProposal property in required (OpenAI Structured Outputs strict-mode compliance)', () => {
      const { properties, required } = CODEX_TASK_OUTPUT_SCHEMA.properties.taskProposal;
      expect(required.sort()).toEqual(Object.keys(properties).sort());
    });

    it('makes every taskProposal field except "action" nullable (type includes "null")', () => {
      const { properties } = CODEX_TASK_OUTPUT_SCHEMA.properties.taskProposal;
      for (const [key, schema] of Object.entries(properties)) {
        if (key === 'action') {
          expect(schema.type).toBe('string');
        } else {
          expect(schema.type).toEqual(expect.arrayContaining(['null']));
        }
      }
    });
  });
});
