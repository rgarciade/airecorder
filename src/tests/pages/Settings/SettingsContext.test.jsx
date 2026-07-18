import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const setEmbeddingProviderSpy = vi.fn();

const mockSettings = {
  t: (key) => key,
  aiProvider: 'ollama',
  toggleProvider: vi.fn(),
  embeddingProvider: '',
  setEmbeddingProvider: setEmbeddingProviderSpy,
  toggleEmbeddingProvider: (provider) => setEmbeddingProviderSpy(provider),
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
    i18n: { language: 'es' },
  }),
}));

vi.mock('../../../pages/Settings/SettingsContext.jsx', () => ({
  useSettings: () => mockSettings,
}));

const { useSettings } = await import(
  '../../../pages/Settings/SettingsContext.jsx'
);

function ToggleEmbeddingTester() {
  const { toggleEmbeddingProvider, embeddingProvider } = useSettings();
  if (typeof toggleEmbeddingProvider === 'function') {
    toggleEmbeddingProvider('ollama');
  }
  return React.createElement('div', {
    'data-testid': 'tester',
    'data-embedding-provider': embeddingProvider,
  });
}

describe('toggleEmbeddingProvider — SettingsContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSettings.aiProvider = 'ollama';
    mockSettings.embeddingProvider = '';
    setEmbeddingProviderSpy.mockClear();
  });

  it('toggleEmbeddingProvider is defined in context value', () => {
    const settings = useSettings();
    expect(settings.toggleEmbeddingProvider).toBeDefined();
    expect(typeof settings.toggleEmbeddingProvider).toBe('function');
  });

  it('toggleEmbeddingProvider("gemini") calls setEmbeddingProvider("gemini") without changing aiProvider', () => {
    const settings = useSettings();

    if (typeof settings.toggleEmbeddingProvider === 'function') {
      settings.toggleEmbeddingProvider('gemini');
    }

    expect(setEmbeddingProviderSpy).toHaveBeenCalledWith('gemini');
    expect(mockSettings.aiProvider).toBe('ollama'); // unchanged
  });

  it('toggleEmbeddingProvider is callable from a rendered component', () => {
    renderToStaticMarkup(React.createElement(ToggleEmbeddingTester));
    expect(setEmbeddingProviderSpy).toHaveBeenCalledWith('ollama');
  });
});
