import { describe, it, expect, vi, beforeEach } from 'vitest';

const getSettings = vi.fn();

vi.mock('../../../services/settingsService.js', () => ({ getSettings }));

describe('ollamaProvider chatCompletionOnce', () => {
  let chatCompletionOnce;

  beforeEach(async () => {
    vi.clearAllMocks();
    getSettings.mockResolvedValue({ ollamaHost: 'http://localhost:11434' });
    global.fetch = vi.fn();
    ({ chatCompletionOnce } = await import('../../../services/ai/ollamaProvider.js'));
  });

  it('sends function.arguments as a raw object, NOT re-stringified (bug real: Ollama rejects the stringified form with a 400)', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ message: { role: 'assistant', content: 'listo' } }),
    });

    const toolCallMessage = {
      role: 'assistant',
      content: '',
      toolCalls: [{ id: 'call-1', name: 'find_tasks', arguments: { query: '' } }],
    };
    await chatCompletionOnce('gemma3:4b', [toolCallMessage], {});

    const [, fetchOptions] = global.fetch.mock.calls[0];
    const sentBody = JSON.parse(fetchOptions.body);
    const sentArgs = sentBody.messages[0].tool_calls[0].function.arguments;
    expect(sentArgs).toEqual({ query: '' });
    expect(typeof sentArgs).toBe('object');
  });

  it('regression: on a non-OK response, includes the real error body in the thrown message instead of just the HTTP status', async () => {
    // Bug real reportado: antes solo se veía "Error 400" en el chat, sin ninguna pista
    // de la causa real devuelta por Ollama en el body.
    global.fetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: "Value looks like object, but can't find closing '}' symbol" }),
    });

    await expect(chatCompletionOnce('gemma3:4b', [{ role: 'user', content: 'hola' }], {}))
      .rejects.toThrow("Value looks like object, but can't find closing '}' symbol");
  });

  it('still throws a message with just the status when the error body is not JSON or has no error field', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => { throw new Error('not json'); },
    });

    await expect(chatCompletionOnce('gemma3:4b', [{ role: 'user', content: 'hola' }], {}))
      .rejects.toThrow('Error en la API de Ollama (/api/chat): 500');
  });

  it('parses a successful response into {text, toolCalls}', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        message: {
          role: 'assistant',
          content: '',
          tool_calls: [{ id: 'call-1', function: { name: 'find_tasks', arguments: { query: '' } } }],
        },
      }),
    });

    const result = await chatCompletionOnce('gemma3:4b', [{ role: 'user', content: 'qué tareas hay' }], {});
    expect(result.toolCalls).toEqual([{ id: 'call-1', name: 'find_tasks', arguments: { query: '' } }]);
  });
});
