import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const mockSettings = {
  t: (key) => key,
  aiProvider: 'ollama',
  toggleProvider: vi.fn(),
  embeddingProvider: '',
  toggleEmbeddingProvider: vi.fn(),
  showApiKey: false,
  setShowApiKey: vi.fn(),
  // Cloud provider fields
  geminiFreeApiKey: '',
  setGeminiFreeApiKey: vi.fn(),
  geminiFreeModel: 'gemini-2.0-flash',
  setGeminiFreeModel: vi.fn(),
  geminiFreeModels: [{ name: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' }],
  geminiFreeModelsLoading: false,
  loadGeminiModels: vi.fn(),
  geminiApiKey: '',
  setGeminiApiKey: vi.fn(),
  geminiModel: 'gemini-2.5-pro',
  setGeminiModel: vi.fn(),
  geminiModels: [{ name: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' }],
  geminiModelsLoading: false,
  deepseekApiKey: '',
  setDeepseekApiKey: vi.fn(),
  deepseekModel: 'deepseek-chat',
  setDeepseekModel: vi.fn(),
  deepseekModels: [{ name: 'deepseek-chat', label: 'DeepSeek Chat', description: 'Fast model' }],
  kimiApiKey: '',
  setKimiApiKey: vi.fn(),
  kimiModel: 'moonshot-v1',
  setKimiModel: vi.fn(),
  kimiModels: [{ name: 'moonshot-v1', label: 'Moonshot V1', description: 'Moonshot model' }],
  // Ollama fields
  ollamaHost: 'http://localhost:11434',
  setOllamaHost: vi.fn(),
  ollamaAvailable: true,
  ollamaModel: 'llama3',
  ollamaModels: [{ name: 'llama3' }, { name: 'mistral' }],
  ollamaRagModel: '',
  setOllamaRagModel: vi.fn(),
  ollamaEmbeddingModel: 'nomic-embed-text',
  setOllamaEmbeddingModel: vi.fn(),
  ollamaEmbeddingModels: [{ name: 'nomic-embed-text' }],
  ollamaModelSupportsStreaming: true,
  ollamaContextLengthSaved: '4096',
  setOllamaContextLengthSaved: vi.fn(),
  ollamaCtxStatus: null,
  setOllamaCtxStatus: vi.fn(),
  handleOllamaModelChange: vi.fn(),
  handleDetectOllamaContextLength: vi.fn(),
  checkOllamaConnection: vi.fn(),
  isCheckingModel: false,
  // LM Studio fields
  lmStudioHost: 'http://localhost:1234',
  setLmStudioHost: vi.fn(),
  lmStudioAvailable: true,
  lmStudioModel: 'gemma2',
  lmStudioModels: [{ name: 'gemma2' }],
  lmStudioChatModels: [{ name: 'gemma2' }],
  lmStudioRagModel: '',
  setLmStudioRagModel: vi.fn(),
  lmStudioEmbeddingModel: '',
  setLmStudioEmbeddingModel: vi.fn(),
  lmStudioEmbeddingModels: [],
  lmStudioContextLengthSaved: '4096',
  setLmStudioContextLengthSaved: vi.fn(),
  lmStudioCtxStatus: null,
  setLmStudioCtxStatus: vi.fn(),
  handleLmStudioModelChange: vi.fn(),
  handleDetectLmStudioContextLength: vi.fn(),
  checkLMStudioConnection: vi.fn(),
  isDetectingLmCtx: false,
  // Custom connections
  customConnections: [],
  stagedDeletions: [],
  addCustomConnection: vi.fn(),
  updateCustomConnection: vi.fn(),
  stageDeleteCustomConnection: vi.fn(),
  cancelDeleteCustomConnection: vi.fn(),
  testCustomConnection: vi.fn(),
  testingCustomConnectionId: null,
  customConnectionTestResults: {},
  setAiProvider: vi.fn(),
  setEmbeddingProvider: vi.fn(),
  customChatModel: '',
  setCustomChatModel: vi.fn(),
  embeddingModel: '',
  setEmbeddingModel: vi.fn(),
  lastEmbeddingModelId: null,
  embeddingModelChanged: false,
  isReindexingRag: false,
  reindexRagMessage: '',
  handleReindexAllRag: vi.fn(),
  customConnectionsSaveValidation: { blocked: false, error: null },
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
    i18n: { language: 'es' },
  }),
}));

vi.mock('../../../../../pages/Settings/SettingsContext.jsx', () => ({
  useSettings: () => mockSettings,
}));

const { default: AgentsTab } = await import(
  '../../../../../pages/Settings/components/AgentsTab/AgentsTab.jsx'
);

describe('AgentsTab — sub-tab UI', () => {
  it('renders two sub-tab buttons using i18n keys [RED — hardcoded strings need replacement]', () => {
    const html = renderToStaticMarkup(<AgentsTab />);

    expect(html).toContain('settings.agentsTabs.chat');
    expect(html).toContain('settings.agentsTabs.embeddings');
  });

  it('renders all three section components when Chat tab is active', () => {
    const html = renderToStaticMarkup(<AgentsTab />);

    expect(html).toContain('settings.sections.localProviders');
    expect(html).toContain('settings.sections.cloudProviders');
    expect(html).toContain('settings.customConnections.section');
  });

  it('sub-tab buttons no longer contain hardcoded strings', () => {
    const html = renderToStaticMarkup(<AgentsTab />);

    // After i18n, raw "Chat" and "Embeddings" should NOT appear as standalone text
    expect(html).not.toContain('>Chat<');
    expect(html).not.toContain('>Embeddings<');
  });

  describe('Integration — Phase 8', () => {
    it('when rendered with default chat tab, DeepSeek is present in cloud section', () => {
      const html = renderToStaticMarkup(<AgentsTab />);
      expect(html).toContain('DeepSeek');
    });

    it('when DeepSeek is the active provider, role badge shows Both if also embedding provider', () => {
      mockSettings.aiProvider = 'deepseek';
      mockSettings.embeddingProvider = 'deepseek';
      const html = renderToStaticMarkup(<AgentsTab />);
      expect(html).toContain('settings.roles.both');
    });

    it('when aiProvider and embeddingProvider are different, each section reflects correct active state', () => {
      mockSettings.aiProvider = 'ollama';
      mockSettings.embeddingProvider = 'gemini';
      const html = renderToStaticMarkup(<AgentsTab />);
      // Both providers should appear
      expect(html).toContain('Ollama');
      expect(html).toContain('Gemini Pro');
      // Ollama badge should show "Chat" role
      expect(html).toContain('settings.roles.chat');
      // Gemini badge should show "Embeddings" role
      expect(html).toContain('settings.roles.embeddings');
    });
  });
});
