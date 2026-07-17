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
  // OpenAI
  openaiApiKey: '',
  setOpenaiApiKey: vi.fn(),
  openaiModel: 'gpt-4o',
  setOpenaiModel: vi.fn(),
  openaiModels: [{ name: 'gpt-4o', label: 'GPT-4o' }],
  openaiModelsLoading: false,
  loadOpenaiModels: vi.fn(),
  // Gemini
  geminiApiKey: '',
  setGeminiApiKey: vi.fn(),
  geminiModel: 'gemini-2.5-pro',
  setGeminiModel: vi.fn(),
  geminiModels: [{ name: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' }],
  geminiModelsLoading: false,
  loadGeminiModels: vi.fn(),
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
    mockSettings.aiProvider = 'gemini'; // group active → section open by default
    const html = renderToStaticMarkup(<CloudProvidersSection role="chat" />);
    expect(html).toContain('OpenAI');
    expect(html).toContain('Gemini');
    expect(html).toContain('DeepSeek');
    expect(html).toContain('Kimi');
  });

  it('renders OpenAI before Gemini in the DOM order', () => {
    mockSettings.aiProvider = 'gemini'; // group active → section open by default
    const html = renderToStaticMarkup(<CloudProvidersSection role="chat" />);
    expect(html.indexOf('>OpenAI<')).toBeLessThan(html.indexOf('>Gemini<'));
  });

  it('when role=chat, all providers are shown (including DeepSeek)', () => {
    mockSettings.aiProvider = 'gemini'; // group active → section open by default
    const html = renderToStaticMarkup(<CloudProvidersSection role="chat" />);
    expect(html).toContain('DeepSeek');
  });

  it('when role=embeddings, DeepSeek is hidden', () => {
    const html = renderToStaticMarkup(<CloudProvidersSection role="embeddings" />);
    // DeepSeek should NOT appear in embeddings tab
    expect(html).not.toContain('DeepSeek');
  });

  it('when role=embeddings, other cloud providers (OpenAI, Gemini, Kimi) are still shown', () => {
    mockSettings.embeddingProvider = 'gemini';
    const html = renderToStaticMarkup(<CloudProvidersSection role="embeddings" />);
    // Other providers should still render
    expect(html).toContain('OpenAI');
    expect(html).toContain('Gemini');
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

  it('when role=chat and aiProvider=gemini, Gemini toggle is checked', () => {
    mockSettings.aiProvider = 'gemini';
    const html = renderToStaticMarkup(<CloudProvidersSection role="chat" />);
    const geminiPos = html.indexOf('>Gemini<');
    const afterGemini = html.substring(geminiPos, html.indexOf('DeepSeek'));
    expect(afterGemini).toContain('checked=""');
  });

  it('when role=chat and aiProvider=openai, OpenAI toggle is checked', () => {
    mockSettings.aiProvider = 'openai';
    const html = renderToStaticMarkup(<CloudProvidersSection role="chat" />);
    const openaiPos = html.indexOf('>OpenAI<');
    const afterOpenai = html.substring(openaiPos, html.indexOf('>Gemini<'));
    expect(afterOpenai).toContain('checked=""');
  });

  describe('Cloud Embedding Models — Phase 6', () => {
    beforeEach(() => {
      mockSettings.aiProvider = 'ollama';
      mockSettings.embeddingProvider = '';
    });

    it('when role=chat, model dropdown is shown for Gemini (not read-only text)', () => {
      mockSettings.aiProvider = 'gemini'; // group active → section open by default
      const html = renderToStaticMarkup(<CloudProvidersSection role="chat" />);
      // Model dropdown should be present, not the embedding model read-only text
      expect(html).toContain('settings.fields.model');
      expect(html).not.toContain('text-embedding-004');
    });

    it('when role=embeddings and Gemini active, shows hardcoded embedding model name', () => {
      mockSettings.embeddingProvider = 'gemini';
      const html = renderToStaticMarkup(<CloudProvidersSection role="embeddings" />);
      expect(html).toContain('text-embedding-004');
      expect(html).not.toContain('settings.fields.model');
    });

    it('when role=embeddings and OpenAI active, shows hardcoded embedding model name', () => {
      mockSettings.embeddingProvider = 'openai';
      const html = renderToStaticMarkup(<CloudProvidersSection role="embeddings" />);
      expect(html).toContain('text-embedding-3-small');
      expect(html).not.toContain('settings.fields.model');
    });

    it('when role=embeddings and Kimi active, shows hardcoded embedding model name', () => {
      mockSettings.embeddingProvider = 'kimi';
      const html = renderToStaticMarkup(<CloudProvidersSection role="embeddings" />);
      expect(html).toContain('moonshot-embedding-v1');
      expect(html).not.toContain('settings.fields.model');
    });
  });
});
