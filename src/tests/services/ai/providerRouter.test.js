import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSettings } from '../../../services/settingsService.js';

const customProviderSendMessage = vi.fn();
const customProviderSendMessageStreaming = vi.fn();
const customProviderChatCompletionStreaming = vi.fn();
const customProviderChatCompletionOnce = vi.fn();
const ollamaGenerate = vi.fn();
const ollamaGenerateStreaming = vi.fn();
const ollamaChatStreaming = vi.fn();
const ollamaChatOnce = vi.fn();
const getOllamaModelInfo = vi.fn();
const sendToGemini = vi.fn();
const sendToGeminiStreaming = vi.fn();
const sendToGeminiChatStreaming = vi.fn();
const sendToGeminiChatOnce = vi.fn();
const sendToDeepseek = vi.fn();
const sendToDeepseekStreaming = vi.fn();
const deepseekChatStreaming = vi.fn();
const deepseekChatOnce = vi.fn();
const getDeepseekAvailableModels = vi.fn();
const sendToKimi = vi.fn();
const sendToKimiStreaming = vi.fn();
const kimiChatStreaming = vi.fn();
const kimiChatOnce = vi.fn();
const getKimiAvailableModels = vi.fn();
const sendToLMStudio = vi.fn();
const sendToLMStudioStreaming = vi.fn();
const lmStudioChatStreaming = vi.fn();
const lmStudioChatOnce = vi.fn();
const getLMStudioModels = vi.fn();
const getLMStudioModelInfo = vi.fn();
const executeTool = vi.fn();

vi.mock('../../../services/ai/customOpenAIProvider.js', () => ({
  CustomOpenAIProvider: vi.fn().mockImplementation(function () {
    return {
      sendMessage: customProviderSendMessage,
      sendMessageStreaming: customProviderSendMessageStreaming,
      chatCompletionStreaming: customProviderChatCompletionStreaming,
      chatCompletionOnce: customProviderChatCompletionOnce,
    };
  }),
}));

vi.mock('../../../services/ai/geminiProvider.js', () => ({
  sendToGemini,
  sendToGeminiStreaming,
  sendToGeminiChatStreaming,
  sendToGeminiChatOnce,
}));

vi.mock('../../../services/ai/deepseekProvider.js', () => ({
  sendToDeepseek,
  sendToDeepseekStreaming,
  getDeepseekAvailableModels,
  chatCompletionStreaming: deepseekChatStreaming,
  chatCompletionOnce: deepseekChatOnce,
}));

vi.mock('../../../services/ai/kimiProvider.js', () => ({
  sendToKimi,
  sendToKimiStreaming,
  getKimiAvailableModels,
  chatCompletionStreaming: kimiChatStreaming,
  chatCompletionOnce: kimiChatOnce,
}));

vi.mock('../../../services/ai/lmStudioProvider.js', () => ({
  sendToLMStudio,
  sendToLMStudioStreaming,
  getLMStudioModels,
  getLMStudioModelInfo,
  chatCompletionStreaming: lmStudioChatStreaming,
  chatCompletionOnce: lmStudioChatOnce,
}));

vi.mock('../../../services/ai/ollamaProvider.js', () => ({
  generateContent: ollamaGenerate,
  generateContentStreaming: ollamaGenerateStreaming,
  chatCompletionStreaming: ollamaChatStreaming,
  chatCompletionOnce: ollamaChatOnce,
  getOllamaModelInfo,
}));

vi.mock('../../../services/ai/tools/index.js', () => ({
  executeTool,
}));

vi.mock('../../../services/settingsService.js', () => ({
  getSettings: vi.fn(),
  addSettingsListener: vi.fn(),
  removeSettingsListener: vi.fn(),
}));

describe('providerRouter custom dispatch', () => {
  let callProvider;
  let callProviderStreaming;
  let callChatProviderStreaming;
  let validateProviderConfig;
  let getActiveProviderContextWindow;

  beforeEach(async () => {
    vi.clearAllMocks();
    getSettings.mockReset();
    globalThis.window ||= {};
    delete globalThis.window.electronAPI;

    const router = await import('../../../services/ai/providerRouter.js');
    callProvider = router.callProvider;
    callProviderStreaming = router.callProviderStreaming;
    callChatProviderStreaming = router.callChatProviderStreaming;
    validateProviderConfig = router.validateProviderConfig;
    getActiveProviderContextWindow = router.getActiveProviderContextWindow;
  });

  it('dispatches custom:{id} to CustomOpenAIProvider for analysis', async () => {
    getSettings.mockResolvedValue({
      aiProvider: 'custom:conn-1',
      customConnections: [{ id: 'conn-1', name: 'MyGPT', baseUrl: 'http://gpt.local', apiKey: 'k1' }],
      customGeneralModel: 'model-x',
    });
    customProviderSendMessage.mockResolvedValue('custom response');

    const result = await callProvider('prompt', { systemPrompt: 'sys' });

    expect(result).toEqual({ text: 'custom response', provider: 'custom:conn-1', model: 'model-x' });
    expect(customProviderSendMessage).toHaveBeenCalledWith('prompt', 'sys', expect.any(AbortSignal));
  });

  it('returns a safe error for unknown custom id', async () => {
    getSettings.mockResolvedValue({
      aiProvider: 'custom:missing',
      customConnections: [],
    });

    await expect(callProvider('prompt')).rejects.toThrow(/Conexión personalizada no encontrada/);
  });

  it('does not affect built-in ollama provider', async () => {
    getSettings.mockResolvedValue({
      aiProvider: 'ollama',
      ollamaModel: 'llama3',
      customConnections: [],
    });
    ollamaGenerate.mockResolvedValue('ollama answer');

    const result = await callProvider('prompt');
    expect(result).toEqual({ text: 'ollama answer', provider: 'ollama', model: 'llama3' });
    expect(customProviderSendMessage).not.toHaveBeenCalled();
  });

  it('dispatches custom:{id} to streaming chat', async () => {
    getSettings.mockResolvedValue({
      aiProvider: 'custom:conn-1',
      customConnections: [{ id: 'conn-1', name: 'MyGPT', baseUrl: 'http://gpt.local', apiKey: 'k1' }],
      customGeneralModel: 'model-x',
    });
    customProviderChatCompletionStreaming.mockResolvedValue('stream response');

    const result = await callChatProviderStreaming([{ role: 'user', content: 'hi' }], () => {});

    expect(result).toEqual({
      text: 'stream response',
      provider: 'custom:conn-1',
      model: 'model-x',
      streaming: true,
    });
    expect(customProviderChatCompletionStreaming).toHaveBeenCalledWith(
      [{ role: 'user', content: 'hi' }],
      expect.any(Function),
      expect.any(AbortSignal)
    );
  });

  it('validateProviderConfig returns false for custom provider without id', async () => {
    getSettings.mockResolvedValue({
      aiProvider: 'custom:',
      customConnections: [],
    });

    const result = await validateProviderConfig();

    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('validateProviderConfig returns false for unknown custom id', async () => {
    getSettings.mockResolvedValue({
      aiProvider: 'custom:missing',
      customConnections: [{ id: 'conn-1', name: 'Other', baseUrl: 'http://x', apiKey: 'k' }],
    });

    const result = await validateProviderConfig();

    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/no encontrada/);
  });

  it('getActiveProviderContextWindow returns standard 250000 window for custom provider', async () => {
    const settings = { aiProvider: 'custom:conn-1', customConnections: [] };

    const result = await getActiveProviderContextWindow(settings);

    expect(result).toBe(250000);
  });

  it('propagates the saved Codex reasoning effort through all three generative routes', async () => {
    getSettings.mockResolvedValue({ aiProvider: 'codex', codexModel: 'gpt-a', codexReasoningEffort: 'high' });
    const runCodex = vi.fn().mockResolvedValue({ success: true, text: 'answer' });
    window.electronAPI = { runCodex, cancelCodex: vi.fn().mockResolvedValue({ success: true }), onCodexChunk: vi.fn(() => vi.fn()) };

    await callProvider('analysis');
    await callProviderStreaming('stream', vi.fn());
    await callChatProviderStreaming([{ role: 'user', content: 'chat' }], vi.fn());

    expect(runCodex).toHaveBeenCalledTimes(3);
    for (const [request] of runCodex.mock.calls) {
      expect(request).toMatchObject({ model: 'gpt-a', reasoningEffort: 'high' });
    }
  });

  it.each(['none', 'max'])('rejects unsupported Codex reasoning effort %s before IPC', async (reasoningEffort) => {
    getSettings.mockResolvedValue({ aiProvider: 'codex', codexModel: 'gpt-a', codexReasoningEffort: reasoningEffort });
    const runCodex = vi.fn();
    window.electronAPI = { runCodex, cancelCodex: vi.fn().mockResolvedValue({ success: true }), onCodexChunk: vi.fn(() => vi.fn()) };
    await expect(callProvider('analysis')).rejects.toThrow(/razonamiento.*no es válido/i);
    expect(runCodex).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Function-calling nativo (options.tools) — ronda de detección no-streaming +
// loop de ejecución local (ver tools/taskTools.js / tools/index.js).
// ---------------------------------------------------------------------------
describe('providerRouter tool-calling loop (function-calling nativo)', () => {
  let callChatProviderStreaming;

  // Catálogo mínimo — el contenido real vive en tools/taskTools.js, acá solo hace
  // falta que `options.tools` sea un array no vacío para activar la ronda.
  const TOOLS = [{ name: 'find_tasks', description: 'x', parameters: { type: 'object', properties: {} } }];

  beforeEach(async () => {
    vi.clearAllMocks();
    getSettings.mockReset();
    globalThis.window ||= {};
    delete globalThis.window.electronAPI;

    const router = await import('../../../services/ai/providerRouter.js');
    callChatProviderStreaming = router.callChatProviderStreaming;
  });

  it('without options.tools: behaves exactly as before — no detection round, direct streaming', async () => {
    getSettings.mockResolvedValue({ aiProvider: 'ollama', ollamaModel: 'llama3.1' });
    ollamaChatStreaming.mockResolvedValue('respuesta normal');

    const result = await callChatProviderStreaming([{ role: 'user', content: 'hola' }], vi.fn(), {});

    expect(ollamaChatOnce).not.toHaveBeenCalled();
    expect(ollamaChatStreaming).toHaveBeenCalledTimes(1);
    expect(result.text).toBe('respuesta normal');
    expect(result.toolCallsExecuted).toBeUndefined();
  });

  it('without tool_calls in the response: a single non-streaming call, no executeTool, text sent once to onChunk', async () => {
    getSettings.mockResolvedValue({ aiProvider: 'ollama', ollamaModel: 'llama3.1' });
    ollamaChatOnce.mockResolvedValue({ text: 'Hola, en qué te ayudo', toolCalls: null });

    const onChunk = vi.fn();
    const result = await callChatProviderStreaming([{ role: 'user', content: 'hola' }], onChunk, { tools: TOOLS });

    expect(ollamaChatOnce).toHaveBeenCalledTimes(1);
    expect(ollamaChatStreaming).not.toHaveBeenCalled();
    expect(executeTool).not.toHaveBeenCalled();
    expect(onChunk).toHaveBeenCalledWith('Hola, en qué te ayudo');
    expect(result).toMatchObject({
      text: 'Hola, en qué te ayudo',
      provider: 'ollama',
      streaming: true,
      toolCallsExecuted: [],
    });
  });

  it('with a tool_call: executes the function locally, re-calls the provider with the result, and returns the final text', async () => {
    getSettings.mockResolvedValue({ aiProvider: 'ollama', ollamaModel: 'llama3.1' });
    ollamaChatOnce
      .mockResolvedValueOnce({
        text: '',
        toolCalls: [{ id: 'call-1', name: 'find_tasks', arguments: { query: 'login' } }],
      })
      .mockResolvedValueOnce({ text: 'Encontré la tarea de login', toolCalls: null });
    executeTool.mockResolvedValue({ tasks: [{ id: 10, title: 'Arreglar login' }] });

    const onChunk = vi.fn();
    const toolContext = { scope: 'recording', recordingId: 42 };
    const result = await callChatProviderStreaming(
      [{ role: 'user', content: 'busca la tarea de login' }],
      onChunk,
      { tools: TOOLS, toolContext }
    );

    expect(ollamaChatOnce).toHaveBeenCalledTimes(2);
    expect(executeTool).toHaveBeenCalledWith('find_tasks', { query: 'login' }, toolContext);
    expect(onChunk).toHaveBeenCalledWith('Encontré la tarea de login');
    expect(onChunk).not.toHaveBeenCalledWith('');
    expect(result.text).toBe('Encontré la tarea de login');
    expect(result.toolCallsExecuted).toEqual([
      { name: 'find_tasks', args: { query: 'login' }, result: { tasks: [{ id: 10, title: 'Arreglar login' }] } },
    ]);

    // El segundo round-trip debe incluir el turno assistant con tool_calls y el
    // resultado de la función como mensaje de rol 'tool'.
    const secondCallMessages = ollamaChatOnce.mock.calls[1][1];
    expect(secondCallMessages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: 'assistant', toolCalls: expect.any(Array) }),
        expect.objectContaining({ role: 'tool', toolCallId: 'call-1', name: 'find_tasks' }),
      ])
    );
  });

  it('cuts at the 4-iteration hard limit if it never converges, without hanging the conversation', async () => {
    getSettings.mockResolvedValue({ aiProvider: 'ollama', ollamaModel: 'llama3.1' });
    ollamaChatOnce.mockResolvedValue({
      text: '',
      toolCalls: [{ id: 'call-x', name: 'find_tasks', arguments: {} }],
    });
    executeTool.mockResolvedValue({ tasks: [] });

    const onChunk = vi.fn();
    const result = await callChatProviderStreaming([{ role: 'user', content: 'busca algo' }], onChunk, { tools: TOOLS });

    expect(ollamaChatOnce).toHaveBeenCalledTimes(4);
    expect(executeTool).toHaveBeenCalledTimes(4);
    expect(result.toolCallsExecuted).toHaveLength(4);
    expect(onChunk).toHaveBeenCalled(); // nunca cuelga: manda un texto (de fallback) igual
  });

  it('cuts the loop immediately when executeTool returns {question, options} (pending UI action), without re-calling the provider', async () => {
    getSettings.mockResolvedValue({ aiProvider: 'ollama', ollamaModel: 'llama3.1' });
    // El schema real de create_task ya no expone `confirm` (ver taskTools.js) —
    // el modelo solo puede mandar title/content/layer. `layer` viene inválido
    // acá a propósito, para poder distinguir `call.arguments` (crudo) de
    // `execResult.proposed` (ya saneado) en la aserción de abajo.
    ollamaChatOnce.mockResolvedValueOnce({
      text: 'Antes de crearla, confirmá por favor.',
      toolCalls: [{ id: 'call-1', name: 'create_task', arguments: { title: 'Nueva tarea', layer: 'not-a-real-layer' } }],
    });
    executeTool.mockResolvedValue({
      status: 'confirmation_required',
      proposed: { title: 'Nueva tarea', content: '', layer: 'general' },
      question: '¿Creo la tarea "Nueva tarea"?',
      options: ['Sí', 'No'],
      message: 'Ask the user to confirm.',
    });

    const onChunk = vi.fn();
    const toolContext = { scope: 'recording', recordingId: 42 };
    const result = await callChatProviderStreaming(
      [{ role: 'user', content: 'creá una tarea' }],
      onChunk,
      { tools: TOOLS, toolContext }
    );

    // Un único round-trip: el loop corta apenas ve {question, options}, nunca vuelve
    // a llamar al proveedor para "leer" ese resultado.
    expect(ollamaChatOnce).toHaveBeenCalledTimes(1);
    expect(onChunk).toHaveBeenCalledWith('Antes de crearla, confirmá por favor.');
    expect(result).toMatchObject({
      text: 'Antes de crearla, confirmá por favor.',
      provider: 'ollama',
      streaming: true,
      pendingAction: {
        // `id` es el id de tool_call que asigna el proveedor ("call-1" acá), no un
        // id de mensaje/entrada de historial — es lo único ESTABLE que la UI puede
        // usar para volver a encontrar este `pendingAction` después de un click,
        // sin importar si en ese momento el historial lo tiene como mensaje
        // individual o como par pregunta/respuesta recargado desde disco (bug real
        // corregido: buscar por id de mensaje fallaba silenciosamente en ese
        // segundo caso, porque `normalizeChatHistory` le asigna un id sintético
        // distinto en cada render — ver chatHistory.js/ChatInterface.jsx).
        id: 'call-1',
        toolName: 'create_task',
        // `toolArgs` viene de `execResult.proposed` (dato YA RESUELTO/saneado),
        // NUNCA de `call.arguments` crudo — así el click de confirmación en la
        // UI opera siempre sobre datos ya validados por el paso de proponer.
        toolArgs: { title: 'Nueva tarea', content: '', layer: 'general' },
        question: '¿Creo la tarea "Nueva tarea"?',
        options: ['Sí', 'No'],
      },
    });
    expect(result.toolCallsExecuted).toEqual([
      { name: 'create_task', args: { title: 'Nueva tarea', layer: 'not-a-real-layer' }, result: expect.objectContaining({ status: 'confirmation_required' }) },
    ]);
  });

  it('without a pending UI action in the result: behaves exactly as before, no pendingAction field', async () => {
    getSettings.mockResolvedValue({ aiProvider: 'ollama', ollamaModel: 'llama3.1' });
    ollamaChatOnce
      .mockResolvedValueOnce({
        text: '',
        toolCalls: [{ id: 'call-1', name: 'find_tasks', arguments: {} }],
      })
      .mockResolvedValueOnce({ text: 'No encontré tareas.', toolCalls: null });
    executeTool.mockResolvedValue({ tasks: [] });

    const result = await callChatProviderStreaming(
      [{ role: 'user', content: 'busca tareas' }],
      vi.fn(),
      { tools: TOOLS }
    );

    expect(ollamaChatOnce).toHaveBeenCalledTimes(2);
    expect(result.pendingAction).toBeUndefined();
    expect(result.text).toBe('No encontré tareas.');
  });

});

// ---------------------------------------------------------------------------
// Codex + options.tools — camino EXCLUSIVO de propuesta única vía `outputSchema`
// estructurado (`_runCodexTaskAwareChat`, ver codexTaskBridge.js). A diferencia
// de los otros 6 providers, Codex NO pasa por `_runToolCallingLoop`: reusa
// `executeTool` para fetchear tareas existentes y proponer la acción, pero hace
// UNA sola llamada no incremental a Main (sin streaming en vivo — tradeoff
// aceptado, ver README §6).
// ---------------------------------------------------------------------------
describe('providerRouter codex task-aware chat (outputSchema)', () => {
  let callChatProviderStreaming;

  const TOOLS = [{ name: 'find_tasks', description: 'x', parameters: { type: 'object', properties: {} } }];

  beforeEach(async () => {
    vi.clearAllMocks();
    getSettings.mockReset();
    globalThis.window ||= {};
    delete globalThis.window.electronAPI;

    const router = await import('../../../services/ai/providerRouter.js');
    callChatProviderStreaming = router.callChatProviderStreaming;
  });

  // El mock de `runCodex` hace eco del `requestId` que le mandó el router — el
  // código real usa ESE mismo id como `pendingAction.id` (ver
  // `_runCodexTaskAwareChat`), así que hace falta reproducir esa relación acá
  // para poder asertarla, en vez de hardcodear un id fijo.
  function mockRunCodex(text) {
    const runCodex = vi.fn().mockImplementation(async (request) => ({ success: true, requestId: request.requestId, text }));
    window.electronAPI = { runCodex, cancelCodex: vi.fn().mockResolvedValue({ success: true }), onCodexChunk: vi.fn(() => vi.fn()) };
    return runCodex;
  }

  it('taskProposal:null → no pendingAction, text is the reply, executeTool only fetches find_tasks once', async () => {
    getSettings.mockResolvedValue({ aiProvider: 'codex', codexModel: 'gpt-a' });
    const runCodex = mockRunCodex(JSON.stringify({ reply: 'Hola, en qué te ayudo', taskProposal: null }));
    executeTool.mockResolvedValue({ tasks: [] });

    const onChunk = vi.fn();
    const result = await callChatProviderStreaming([{ role: 'user', content: 'hola' }], onChunk, { tools: TOOLS });

    expect(runCodex).toHaveBeenCalledTimes(1);
    expect(runCodex.mock.calls[0][0]).toMatchObject({ outputSchema: expect.any(Object) });
    expect(executeTool).toHaveBeenCalledTimes(1);
    expect(executeTool).toHaveBeenCalledWith('find_tasks', {}, undefined);
    expect(result).toMatchObject({ text: 'Hola, en qué te ayudo', provider: 'codex', streaming: true });
    expect(result.pendingAction).toBeUndefined();
  });

  it('taskProposal with create_task → proposes via executeTool (same dispatcher as the other providers) and returns pendingAction', async () => {
    getSettings.mockResolvedValue({ aiProvider: 'codex', codexModel: 'gpt-a' });
    const runCodex = mockRunCodex(JSON.stringify({
      reply: 'Antes de crearla, confirmá por favor.',
      taskProposal: { action: 'create_task', title: 'X' },
    }));
    executeTool.mockImplementation(async (name) => {
      if (name === 'find_tasks') return { tasks: [] };
      if (name === 'create_task') {
        return {
          status: 'confirmation_required',
          proposed: { title: 'X', content: '', layer: 'general' },
          question: '¿Creo la tarea "X"?',
          options: ['Sí', 'No'],
          message: 'Ask the user to confirm.',
        };
      }
      throw new Error(`unexpected tool ${name}`);
    });

    const onChunk = vi.fn();
    const toolContext = { scope: 'recording', recordingId: 42 };
    const result = await callChatProviderStreaming(
      [{ role: 'user', content: 'creá una tarea' }],
      onChunk,
      { tools: TOOLS, toolContext }
    );

    expect(executeTool).toHaveBeenCalledWith('find_tasks', {}, toolContext);
    expect(executeTool).toHaveBeenCalledWith('create_task', { title: 'X' }, toolContext);
    expect(onChunk).toHaveBeenCalledTimes(1);
    expect(onChunk).toHaveBeenCalledWith('Antes de crearla, confirmá por favor.');

    const [[sentRequest]] = runCodex.mock.calls;
    expect(result).toMatchObject({
      text: 'Antes de crearla, confirmá por favor.',
      provider: 'codex',
      streaming: true,
      pendingAction: {
        id: sentRequest.requestId,
        toolName: 'create_task',
        // `toolArgs` viene de `execResult.proposed` (dato ya saneado), nunca del
        // `taskProposal` crudo que devolvió Codex — mismo criterio que
        // `_runToolCallingLoop` para los otros 6 providers.
        toolArgs: { title: 'X', content: '', layer: 'general' },
        question: '¿Creo la tarea "X"?',
        options: ['Sí', 'No'],
      },
    });
  });

  // Regresión del bug real: el schema estricto de Codex (ver codexTaskBridge.js)
  // obliga a mandar TODOS los campos de taskProposal, usando `null` para "no
  // aplica" — si esos `null` se pasaran tal cual a `executeTool`, un `update_task`
  // borraría campos existentes (`content`/`layer`/`status`) en vez de preservarlos
  // (taskTools.js distingue "campo ausente" de "campo null" para el merge parcial).
  it('strips null fields from taskProposal before calling executeTool, so update_task preserves existing fields instead of nulling them out', async () => {
    getSettings.mockResolvedValue({ aiProvider: 'codex', codexModel: 'gpt-a' });
    mockRunCodex(JSON.stringify({
      reply: 'Marco la tarea como hecha.',
      taskProposal: { action: 'update_task', id: 10, title: null, content: null, layer: null, status: 'done' },
    }));
    executeTool.mockImplementation(async (name) => {
      if (name === 'find_tasks') return { tasks: [{ id: 10, title: 'Arreglar login', layer: 'backend', status: 'backlog' }] };
      if (name === 'update_task') {
        return {
          status: 'confirmation_required',
          proposed: { id: 10, title: 'Arreglar login', content: 'Detalle', layer: 'backend', status: 'done' },
          question: '¿Aplico estos cambios?',
          options: ['Sí', 'No'],
          message: 'Ask the user to confirm.',
        };
      }
      throw new Error(`unexpected tool ${name}`);
    });

    const toolContext = { scope: 'recording', recordingId: 42 };
    await callChatProviderStreaming([{ role: 'user', content: 'marcá la 10 como hecha' }], vi.fn(), { tools: TOOLS, toolContext });

    // Ninguno de los campos `null` llega a executeTool — solo `id` y `status`
    // (los únicos que Codex realmente quería cambiar).
    expect(executeTool).toHaveBeenCalledWith('update_task', { id: 10, status: 'done' }, toolContext);
  });

  it('invalid JSON from Codex → degrades gracefully to plain text, no pendingAction, never throws', async () => {
    getSettings.mockResolvedValue({ aiProvider: 'codex', codexModel: 'gpt-a' });
    mockRunCodex('esto no es JSON válido');
    executeTool.mockResolvedValue({ tasks: [] });

    const onChunk = vi.fn();
    const result = await callChatProviderStreaming([{ role: 'user', content: 'hola' }], onChunk, { tools: TOOLS });

    expect(result).toMatchObject({ text: 'esto no es JSON válido', provider: 'codex', streaming: true });
    expect(result.pendingAction).toBeUndefined();
    expect(onChunk).toHaveBeenCalledTimes(1);
    expect(onChunk).toHaveBeenCalledWith('esto no es JSON válido');
  });

  it('onChunk is called at most once with the full reply — no incremental deltas in this mode', async () => {
    getSettings.mockResolvedValue({ aiProvider: 'codex', codexModel: 'gpt-a' });
    mockRunCodex(JSON.stringify({ reply: 'Respuesta completa de una sola vez', taskProposal: null }));
    executeTool.mockResolvedValue({ tasks: [] });

    const onChunk = vi.fn();
    await callChatProviderStreaming([{ role: 'user', content: 'hola' }], onChunk, { tools: TOOLS });

    expect(onChunk.mock.calls.length).toBeLessThanOrEqual(1);
    expect(onChunk).toHaveBeenCalledWith('Respuesta completa de una sola vez');
  });

  it('without options.tools: identical to the pre-existing codex case — task-aware path never activates', async () => {
    getSettings.mockResolvedValue({ aiProvider: 'codex', codexModel: 'gpt-a' });
    const runCodex = mockRunCodex('respuesta codex normal');

    const result = await callChatProviderStreaming([{ role: 'user', content: 'hola' }], vi.fn(), {});

    expect(executeTool).not.toHaveBeenCalled();
    expect(runCodex).toHaveBeenCalledTimes(1);
    expect(runCodex.mock.calls[0][0]).not.toHaveProperty('outputSchema');
    expect(result).toMatchObject({ text: 'respuesta codex normal', provider: 'codex', streaming: true });
  });
});
