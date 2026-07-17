import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const mockToggleProvider = vi.fn();
const mockToggleEmbeddingProvider = vi.fn();

const mockSettings = {
  t: (key) => key,
  customConnections: [],
  stagedDeletions: [],
  addCustomConnection: vi.fn(),
  updateCustomConnection: vi.fn(),
  stageDeleteCustomConnection: vi.fn(),
  cancelDeleteCustomConnection: vi.fn(),
  testCustomConnection: vi.fn(),
  testingCustomConnectionId: null,
  customConnectionTestResults: {},
  aiProvider: '',
  setAiProvider: vi.fn(),
  toggleProvider: mockToggleProvider,
  embeddingProvider: '',
  setEmbeddingProvider: vi.fn(),
  toggleEmbeddingProvider: mockToggleEmbeddingProvider,
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

const { default: CustomConnectionsSection } = await import(
  '../../../../../pages/Settings/components/AgentsTab/CustomConnectionsSection.jsx'
);

describe('CustomConnectionsSection save validation display', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSettings.customConnections = [
      { id: 'c1', name: 'ChatGPT', baseUrl: 'http://chat.local', apiKey: 'k1' },
      { id: 'c2', name: 'Unused', baseUrl: 'http://unused.local', apiKey: 'k2' },
    ];
    mockSettings.stagedDeletions = [];
    mockSettings.aiProvider = 'custom:c1';
    mockSettings.embeddingProvider = '';
    mockSettings.customChatModel = 'model-chat';
    mockSettings.embeddingModel = '';
    mockSettings.customConnectionTestResults = {};
    mockSettings.customConnectionsSaveValidation = { blocked: false, error: null };
  });

  it('renders the section and connection list', () => {
    const html = renderToStaticMarkup(<CustomConnectionsSection role="chat" />);
    expect(html).toContain('settings.customConnections.section');
    expect(html).toContain('ChatGPT');
    expect(html).toContain('Unused');
  });

  it('shows the validation error when save is blocked by staged deletion', () => {
    mockSettings.customConnectionsSaveValidation = {
      blocked: true,
      error: 'settings.customConnections.errors.deletedConnectionInUse',
    };
    mockSettings.stagedDeletions = ['c1'];

    const html = renderToStaticMarkup(<CustomConnectionsSection role="chat" />);
    expect(html).toContain('settings.customConnections.errors.deletedConnectionInUse');
  });

  it('shows the validation error when no AI provider is assigned', () => {
    mockSettings.customConnectionsSaveValidation = {
      blocked: true,
      error: 'settings.customConnections.errors.noAiProvider',
    };
    mockSettings.aiProvider = '';

    const html = renderToStaticMarkup(<CustomConnectionsSection role="chat" />);
    expect(html).toContain('settings.customConnections.errors.noAiProvider');
  });

  it('renders the model selector for the active connection', () => {
    const html = renderToStaticMarkup(<CustomConnectionsSection role="chat" />);
    // With role="chat", the active connection (c1) shows the chat model label
    expect(html).toContain('settings.fields.generalModel');
  });
});

describe('CustomConnectionsSection — role prop', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSettings.customConnections = [
      { id: 'c1', name: 'ChatGPT', baseUrl: 'http://chat.local', apiKey: 'k1' },
      { id: 'c2', name: 'Unused', baseUrl: 'http://unused.local', apiKey: 'k2' },
    ];
    mockSettings.stagedDeletions = [];
    mockSettings.aiProvider = 'custom:c1';
    mockSettings.embeddingProvider = '';
    mockSettings.customChatModel = 'model-chat';
    mockSettings.embeddingModel = '';
    mockSettings.customConnectionTestResults = {};
    mockSettings.customConnectionsSaveValidation = { blocked: false, error: null };
  });

  it('when role=chat, the chat model selector is shown for the active connection', () => {
    const html = renderToStaticMarkup(<CustomConnectionsSection role="chat" />);
    expect(html).toContain('settings.fields.generalModel');
    expect(html).toContain('ChatGPT');
  });

  it('when role=embeddings, the embedding model selector is shown for the active connection', () => {
    mockSettings.embeddingProvider = 'custom:c1';
    const html = renderToStaticMarkup(<CustomConnectionsSection role="embeddings" />);
    expect(html).toContain('settings.fields.embeddingModel');
  });

  it('when role=embeddings, the chat model selector is not shown', () => {
    mockSettings.embeddingProvider = 'custom:c2';
    const html = renderToStaticMarkup(<CustomConnectionsSection role="embeddings" />);

    // Chat model selector should NOT appear in embeddings tab
    expect(html).not.toContain('settings.fields.generalModel');
  });
});
