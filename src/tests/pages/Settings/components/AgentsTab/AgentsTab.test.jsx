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
  openaiApiKey: '',
  setOpenaiApiKey: vi.fn(),
  openaiModel: 'gpt-4o',
  setOpenaiModel: vi.fn(),
  openaiModels: [{ name: 'gpt-4o', label: 'GPT-4o' }],
  openaiModelsLoading: false,
  loadOpenaiModels: vi.fn(),
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

    expect(html).toContain('settings.agentsTabs.general');
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
    // Los 3 acordeones arrancan colapsados por defecto (ver *Section.test.jsx para
    // la cobertura de contenido interno de cada card vía defaultOpen). Acá solo se
    // verifica la composición: headers/badges visibles sin abrir nada.

    it('all three sections render collapsed by default regardless of active provider', () => {
      mockSettings.aiProvider = 'gemini';
      mockSettings.embeddingProvider = 'deepseek';
      const html = renderToStaticMarkup(<AgentsTab />);
      // Card-only content should not leak into the collapsed view
      expect(html).not.toContain('DeepSeek');
      expect(html.match(/aria-label="settings.buttons.expand"/g) || []).toHaveLength(3);
    });

    it('when DeepSeek is the active provider for both roles, the cloud badge reflects it', () => {
      mockSettings.aiProvider = 'deepseek';
      mockSettings.embeddingProvider = 'deepseek';
      const html = renderToStaticMarkup(<AgentsTab />);
      expect(html).toContain('settings.providers.deepseekName');
    });

    it('when aiProvider and embeddingProvider are different, the cloud header badge reflects the chat role provider', () => {
      mockSettings.aiProvider = 'ollama';
      mockSettings.embeddingProvider = 'gemini';
      const html = renderToStaticMarkup(<AgentsTab />);
      // AgentsTab defaults to the chat sub-tab: local badge shows Ollama, cloud badge shows inactive
      // (aiProvider drives the chat-tab badges; embeddingProvider only matters on the embeddings sub-tab)
      expect(html).toContain('settings.providers.ollamaActive');
      expect(html).toContain('settings.providers.inactive');
    });
  });
});
