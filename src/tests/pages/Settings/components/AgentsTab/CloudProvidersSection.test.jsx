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

const { default: CloudProvidersSection } = await import(
  '../../../../../pages/Settings/components/AgentsTab/CloudProvidersSection.jsx'
);

describe('CloudProvidersSection — role prop', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSettings.aiProvider = 'ollama';
    mockSettings.embeddingProvider = '';
  });

  it('accepts role prop and renders cloud providers', () => {
    const html = renderToStaticMarkup(<CloudProvidersSection role="chat" />);
    expect(html).toContain('Gemini Free');
    expect(html).toContain('Gemini Pro');
    expect(html).toContain('DeepSeek');
    expect(html).toContain('Kimi');
  });

  it('when role=chat, all four providers are shown (including DeepSeek)', () => {
    const html = renderToStaticMarkup(<CloudProvidersSection role="chat" />);
    expect(html).toContain('DeepSeek');
  });

  it('when role=embeddings, DeepSeek is hidden [RED — not implemented]', () => {
    const html = renderToStaticMarkup(<CloudProvidersSection role="embeddings" />);
    // DeepSeek should NOT appear in embeddings tab
    expect(html).not.toContain('DeepSeek');
  });

  it('when role=embeddings, other cloud providers (Gemini, Kimi) are still shown', () => {
    mockSettings.embeddingProvider = 'gemini';
    const html = renderToStaticMarkup(<CloudProvidersSection role="embeddings" />);
    // Other providers should still render
    expect(html).toContain('Gemini Free');
    expect(html).toContain('Gemini Pro');
    expect(html).toContain('Kimi');
    expect(html).not.toContain('DeepSeek');
  });

  it('when role=chat, active toggle belongs to aiProvider (Ollama pre-selected, no cloud active)', () => {
    mockSettings.aiProvider = 'ollama'; // non-cloud provider
    const html = renderToStaticMarkup(<CloudProvidersSection role="chat" />);
    // No cloud toggle should be checked since aiProvider is ollama
    const checkedMatches = html.match(/checked=""/g) || [];
    expect(checkedMatches.length).toBe(0);
  });

  it('when role=chat and aiProvider=geminifree, Gemini Free toggle is checked', () => {
    mockSettings.aiProvider = 'geminifree';
    const html = renderToStaticMarkup(<CloudProvidersSection role="chat" />);
    // Gemini Free's toggle should be checked
    const geminiFreePos = html.indexOf('Gemini Free');
    const afterGeminiFree = html.substring(geminiFreePos, html.indexOf('Gemini Pro'));
    expect(afterGeminiFree).toContain('checked=""');
  });

  describe('Cloud Embedding Models — Phase 6', () => {
    beforeEach(() => {
      mockSettings.aiProvider = 'ollama';
      mockSettings.embeddingProvider = '';
    });

    it('when role=chat, model dropdown is shown for Gemini Free (not read-only text) [RED — not implemented]', () => {
      const html = renderToStaticMarkup(<CloudProvidersSection role="chat" />);
      // Model dropdown should be present, not the embedding model read-only text
      expect(html).toContain('settings.fields.model');
      expect(html).not.toContain('text-embedding-004');
    });

    it('when role=embeddings and Gemini Free active, shows hardcoded embedding model name [RED — not implemented]', () => {
      mockSettings.embeddingProvider = 'geminifree';
      const html = renderToStaticMarkup(<CloudProvidersSection role="embeddings" />);
      // Should show read-only text with the embedding model name
      expect(html).toContain('text-embedding-004');
      // Model dropdown should be hidden
      expect(html).not.toContain('settings.fields.model');
    });

    it('when role=embeddings and Gemini Pro active, shows hardcoded embedding model name [RED — not implemented]', () => {
      mockSettings.embeddingProvider = 'gemini';
      const html = renderToStaticMarkup(<CloudProvidersSection role="embeddings" />);
      expect(html).toContain('text-embedding-004');
      expect(html).not.toContain('settings.fields.model');
    });

    it('when role=embeddings and Kimi active, shows hardcoded embedding model name [RED — not implemented]', () => {
      mockSettings.embeddingProvider = 'kimi';
      const html = renderToStaticMarkup(<CloudProvidersSection role="embeddings" />);
      expect(html).toContain('moonshot-embedding-v1');
      expect(html).not.toContain('settings.fields.model');
    });
  });
});
