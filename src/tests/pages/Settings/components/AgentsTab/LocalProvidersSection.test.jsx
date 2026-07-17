import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const mockToggleProvider = vi.fn();
const mockToggleEmbeddingProvider = vi.fn();

const mockSettings = {
  t: (key) => key,
  aiProvider: 'ollama',
  toggleProvider: mockToggleProvider,
  embeddingProvider: '',
  toggleEmbeddingProvider: mockToggleEmbeddingProvider,
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

const { default: LocalProvidersSection } = await import(
  '../../../../../pages/Settings/components/AgentsTab/LocalProvidersSection.jsx'
);

describe('LocalProvidersSection — role prop', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSettings.aiProvider = 'ollama';
    mockSettings.embeddingProvider = '';
  });

  it('accepts role prop and renders without error', () => {
    const html = renderToStaticMarkup(<LocalProvidersSection role="chat" />);
    expect(html.length).toBeGreaterThan(0);
    expect(html).toContain('Ollama');
    expect(html).toContain('LM Studio');
  });

  it('when role=chat, renders with toggleProvider used for disabled state', () => {
    mockSettings.aiProvider = 'ollama';
    const html = renderToStaticMarkup(<LocalProvidersSection role="chat" />);

    // LM Studio card should be disabled (not active)
    const cardDisabledCount = (html.match(/cardDisabled/g) || []).length;
    expect(cardDisabledCount).toBeGreaterThanOrEqual(1);
  });

  it('when role=embeddings and embeddingProvider=ollama, Ollama is active', () => {
    mockSettings.aiProvider = 'lmstudio'; // different chat provider
    mockSettings.embeddingProvider = 'ollama';

    const html = renderToStaticMarkup(<LocalProvidersSection role="embeddings" />);

    // Verify Ollama rendered
    expect(html).toContain('Ollama');
    expect(html).toContain('LM Studio');
  });

  it('when role=embeddings and embeddingProvider=ollama, LM Studio is disabled', () => {
    mockSettings.aiProvider = 'lmstudio';
    mockSettings.embeddingProvider = 'ollama';

    const html = renderToStaticMarkup(<LocalProvidersSection role="embeddings" />);

    const cardDisabledCount = (html.match(/cardDisabled/g) || []).length;
    expect(cardDisabledCount).toBeGreaterThanOrEqual(1);
  });

  it('when role=chat and aiProvider=lmstudio, LM Studio toggle is checked', () => {
    mockSettings.aiProvider = 'lmstudio';
    const html = renderToStaticMarkup(<LocalProvidersSection role="chat" />);

    expect(html).toContain('Ollama');
    expect(html).toContain('LM Studio');
  });

  it('when role=chat, toggle checked belongs to Ollama (aiProvider)', () => {
    mockSettings.aiProvider = 'ollama';
    const html = renderToStaticMarkup(<LocalProvidersSection role="chat" />);

    // There should be exactly 1 checked toggle (the active provider)
    const checkedMatches = html.match(/checked=""/g) || [];
    expect(checkedMatches.length).toBe(1);
    // Verify the checked toggle is for Ollama (appears before LM Studio text)
    const lmStudioPos = html.indexOf('LM Studio');
    const ollamaChecked = html.substring(0, lmStudioPos).match(/checked=""/g) || [];
    expect(ollamaChecked.length).toBe(1);
  });

  it('when role=embeddings and embeddingProvider=lmstudio, toggle checked belongs to LM Studio [RED — not implemented]', () => {
    mockSettings.aiProvider = 'ollama';
    mockSettings.embeddingProvider = 'lmstudio';

    const html = renderToStaticMarkup(<LocalProvidersSection role="embeddings" />);

    const checkedMatches = html.match(/checked=""/g) || [];
    expect(checkedMatches.length).toBe(1);
    // With CORRECT implementation: the checked toggle is AFTER LM Studio text
    // With BROKEN implementation: the checked toggle is BEFORE LM Studio text (Ollama's toggle)
    const lmStudioPos = html.indexOf('LM Studio');
    const afterLmStudio = html.substring(lmStudioPos);
    const lmStudioChecked = afterLmStudio.match(/checked=""/g) || [];
    expect(lmStudioChecked.length).toBe(1); // LM Studio should have the checked toggle
  });

  describe('Role Badge', () => {
    it('when provider is active for chat only, badge uses i18n key [RED — hardcoded strings need replacement]', () => {
      mockSettings.aiProvider = 'ollama';
      mockSettings.embeddingProvider = '';
      const html = renderToStaticMarkup(<LocalProvidersSection role="chat" />);
      // Badge should show i18n key for "Chat"
      expect(html).toContain('settings.roles.chat');
      expect(html).not.toContain('>Chat<');
    });

    it('when provider is active for embeddings only, badge uses i18n key [RED]', () => {
      mockSettings.aiProvider = '';
      mockSettings.embeddingProvider = 'ollama';
      const html = renderToStaticMarkup(<LocalProvidersSection role="chat" />);
      expect(html).toContain('settings.roles.embeddings');
      expect(html).not.toContain('>Embeddings<');
    });

    it('when provider is active for both roles, badge uses i18n key [RED]', () => {
      mockSettings.aiProvider = 'ollama';
      mockSettings.embeddingProvider = 'ollama';
      const html = renderToStaticMarkup(<LocalProvidersSection role="chat" />);
      expect(html).toContain('settings.roles.both');
      expect(html).not.toContain('>Both<');
    });
  });

  describe('Model Selectors Per Role — Phase 6', () => {
    beforeEach(() => {
      mockSettings.aiProvider = 'ollama';
      mockSettings.embeddingProvider = '';
    });

    it('when role=chat, general model and chat model selectors are visible for Ollama', () => {
      const html = renderToStaticMarkup(<LocalProvidersSection role="chat" />);
      // General model and chat model selectors should be rendered
      expect(html).toContain('settings.fields.generalModel');
      expect(html).toContain('settings.fields.chatModel');
      expect(html).toContain('settings.fields.embeddingModel');
    });

    it('when role=embeddings, general model and chat model selectors are hidden for Ollama [RED — not implemented]', () => {
      mockSettings.embeddingProvider = 'ollama';
      const html = renderToStaticMarkup(<LocalProvidersSection role="embeddings" />);
      // General model and chat model should be hidden in embeddings tab
      expect(html).not.toContain('settings.fields.generalModel');
      expect(html).not.toContain('settings.fields.chatModel');
      // Embedding model selector should still be visible
      expect(html).toContain('settings.fields.embeddingModel');
    });

    it('when role=embeddings, general model and chat model selectors are hidden for LM Studio [RED — not implemented]', () => {
      mockSettings.aiProvider = 'lmstudio';
      mockSettings.embeddingProvider = 'lmstudio';
      const html = renderToStaticMarkup(<LocalProvidersSection role="embeddings" />);
      // LM Studio section exists but general/chat model should be hidden
      expect(html).toContain('LM Studio');
      expect(html).not.toContain('settings.fields.generalModel');
      expect(html).not.toContain('settings.fields.chatModel');
    });
  });
});
