import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSettings } from '../../../services/settingsService.js';

const customProviderSendMessage = vi.fn();
const customProviderSendMessageStreaming = vi.fn();
const customProviderChatCompletionStreaming = vi.fn();
const ollamaGenerate = vi.fn();
const ollamaGenerateStreaming = vi.fn();
const ollamaChatStreaming = vi.fn();
const getOllamaModelInfo = vi.fn();
const sendToGemini = vi.fn();
const sendToGeminiStreaming = vi.fn();
const sendToGeminiChatStreaming = vi.fn();
const sendToDeepseek = vi.fn();
const sendToDeepseekStreaming = vi.fn();
const deepseekChatStreaming = vi.fn();
const getDeepseekAvailableModels = vi.fn();
const sendToKimi = vi.fn();
const sendToKimiStreaming = vi.fn();
const kimiChatStreaming = vi.fn();
const getKimiAvailableModels = vi.fn();
const sendToLMStudio = vi.fn();
const sendToLMStudioStreaming = vi.fn();
const lmStudioChatStreaming = vi.fn();
const getLMStudioModels = vi.fn();
const getLMStudioModelInfo = vi.fn();

vi.mock('../../../services/ai/customOpenAIProvider.js', () => ({
  CustomOpenAIProvider: vi.fn().mockImplementation(function () {
    return {
      sendMessage: customProviderSendMessage,
      sendMessageStreaming: customProviderSendMessageStreaming,
      chatCompletionStreaming: customProviderChatCompletionStreaming,
    };
  }),
}));

vi.mock('../../../services/ai/geminiProvider.js', () => ({
  sendToGemini,
  sendToGeminiStreaming,
  sendToGeminiChatStreaming,
}));

vi.mock('../../../services/ai/deepseekProvider.js', () => ({
  sendToDeepseek,
  sendToDeepseekStreaming,
  getDeepseekAvailableModels,
  chatCompletionStreaming: deepseekChatStreaming,
}));

vi.mock('../../../services/ai/kimiProvider.js', () => ({
  sendToKimi,
  sendToKimiStreaming,
  getKimiAvailableModels,
  chatCompletionStreaming: kimiChatStreaming,
}));

vi.mock('../../../services/ai/lmStudioProvider.js', () => ({
  sendToLMStudio,
  sendToLMStudioStreaming,
  getLMStudioModels,
  getLMStudioModelInfo,
  chatCompletionStreaming: lmStudioChatStreaming,
}));

vi.mock('../../../services/ai/ollamaProvider.js', () => ({
  generateContent: ollamaGenerate,
  generateContentStreaming: ollamaGenerateStreaming,
  chatCompletionStreaming: ollamaChatStreaming,
  getOllamaModelInfo,
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

  it('getActiveProviderContextWindow returns null for custom provider', async () => {
    const settings = { aiProvider: 'custom:conn-1', customConnections: [] };

    const result = await getActiveProviderContextWindow(settings);

    expect(result).toBeNull();
  });
});
