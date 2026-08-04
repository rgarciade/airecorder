import { describe, it, expect, beforeEach } from 'vitest';

describe('interactionTools (via executeTool)', () => {
  let executeTool;

  beforeEach(async () => {
    ({ executeTool } = await import('../../../../services/ai/tools'));
  });

  describe('ask_user', () => {
    it('returns {status: "ask_user", question, options} for a valid question with 2+ options', async () => {
      const result = await executeTool('ask_user', { question: '¿Qué proveedor usás?', options: ['Ollama', 'Gemini'] }, {});

      expect(result).toEqual({
        status: 'ask_user',
        question: '¿Qué proveedor usás?',
        options: ['Ollama', 'Gemini'],
      });
    });

    it('rejects without a question', async () => {
      const result = await executeTool('ask_user', { options: ['A', 'B'] }, {});

      expect(result).toEqual({ error: 'invalid_arguments', message: expect.any(String) });
    });

    it('rejects with an empty/blank question', async () => {
      const result = await executeTool('ask_user', { question: '   ', options: ['A', 'B'] }, {});

      expect(result).toEqual({ error: 'invalid_arguments', message: expect.any(String) });
    });

    it('rejects with fewer than 2 options', async () => {
      const result = await executeTool('ask_user', { question: '¿Continuar?', options: ['Sí'] }, {});

      expect(result).toEqual({ error: 'invalid_arguments', message: expect.any(String) });
    });

    it('rejects when options is missing entirely', async () => {
      const result = await executeTool('ask_user', { question: '¿Continuar?' }, {});

      expect(result).toEqual({ error: 'invalid_arguments', message: expect.any(String) });
    });

    it('filters out blank/whitespace-only strings from options before counting them', async () => {
      const result = await executeTool('ask_user', { question: '¿Cuál preferís?', options: ['Opción A', '   ', '', 'Opción B'] }, {});

      expect(result).toEqual({
        status: 'ask_user',
        question: '¿Cuál preferís?',
        options: ['Opción A', 'Opción B'],
      });
    });

    it('rejects when options has 2+ entries but fewer than 2 are non-blank after filtering', async () => {
      const result = await executeTool('ask_user', { question: '¿Continuar?', options: ['Sí', '   '] }, {});

      expect(result).toEqual({ error: 'invalid_arguments', message: expect.any(String) });
    });
  });
});
