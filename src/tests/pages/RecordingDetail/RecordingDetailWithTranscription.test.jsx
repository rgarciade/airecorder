import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// CRITICAL post-review (Fix 2): el wiring de INV6 en
// `RecordingDetailWithTranscription.jsx` (modal de re-transcripción —
// `disabled={!selectedInstalled}` + CTA a Ajustes) no tenía ningún test de
// integración; solo la lógica PURA reutilizada (`whisperModelGuard.js`)
// estaba cubierta. Este componente arrastra 15+ dependencias de IA/chat
// pesadas y no relacionadas con este fix — se mockean completas
// (Extract-Before-Mock, mismo criterio que el resto de PR4, ver
// Deviation #3 de apply-progress) y se monta el resto REAL.

const t = (key, opts) => (opts ? `${key}:${JSON.stringify(opts)}` : key);
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t, i18n: { language: 'es' } }) }));
vi.mock('react-redux', () => ({ useSelector: () => ({}) }));

vi.mock('../../../services/ai/ollamaProvider', () => ({
  getAvailableModels: vi.fn().mockResolvedValue([]),
  checkModelSupportsStreaming: vi.fn().mockResolvedValue(false),
  getOllamaModelInfo: vi.fn().mockResolvedValue(null),
}));
vi.mock('../../../services/ai/lmStudioProvider', () => ({
  getLMStudioModels: vi.fn().mockResolvedValue([]),
}));
vi.mock('../../../services/ai/providerRouter', () => ({
  callProvider: vi.fn(),
  callProviderStreaming: vi.fn(),
  callChatProviderStreaming: vi.fn(),
  isCustom: vi.fn(() => false),
}));
vi.mock('../../../services/ai/tools', () => ({ ALL_TOOLS: [], executeConfirmedAction: vi.fn() }));
vi.mock('../../../prompts/aiPrompts', () => ({ chatSystemPrompt: vi.fn() }));
vi.mock('../../../prompts/ragPrompts', () => ({ ragSystemPrompt: vi.fn(), mapHistoryToMessages: vi.fn(() => []) }));
vi.mock('../../../services/ai/promptBuilder', () => ({
  buildSystemPrompt: vi.fn().mockResolvedValue(''),
  FEATURE_TYPES: { CHAT: 'chat' },
}));
vi.mock('../../../services/ragService', () => ({
  default: {
    getStatus: vi.fn().mockResolvedValue({ success: true, indexed: true, totalChunks: 0 }),
    indexRecording: vi.fn().mockResolvedValue({ success: true, indexed: true, totalChunks: 0 }),
    search: vi.fn().mockResolvedValue({ success: true, chunks: [] }),
    deleteIndex: vi.fn().mockResolvedValue(true),
  },
}));
vi.mock('../../../services/recordingAiService', () => ({
  default: {
    getRecordingSummary: vi.fn().mockResolvedValue(null),
    generateRecordingSummary: vi.fn().mockResolvedValue(null),
    extractParticipants: vi.fn().mockResolvedValue([]),
    isGenerating: vi.fn().mockResolvedValue(false),
    cancelGeneration: vi.fn().mockResolvedValue(true),
  },
}));
vi.mock('../../../services/chatPendingService', () => ({
  default: {
    subscribe: vi.fn(() => vi.fn()),
    setPending: vi.fn(),
    clearPending: vi.fn(),
    setError: vi.fn(),
  },
}));
// `chat/chatTokens.js` y `chat/chatHistory.js` son módulos puros (sin I/O,
// sin dependencias pesadas) — se dejan reales, mockearlos rompe el import
// estático de `ChatInterface.jsx` (usado por `TranscriptionChatTab`, que a
// su vez se importa estáticamente aunque no se renderice con
// `activeTab==='overview'`) porque re-exporta constantes concretas
// (`MIN_COMPACT_HISTORY_MESSAGES`, `MIN_SUMMARY_HISTORY_MESSAGES`).
vi.mock('../../../hooks/useChatCommands', () => ({ useChatCommands: () => ({ runCommand: vi.fn() }) }));
vi.mock('../../../services/ai/huggingFaceService', () => ({ checkModelVisionSupport: vi.fn().mockResolvedValue(false) }));
vi.mock('../../../services/noteTemplateService', () => ({ generateFromTemplate: vi.fn() }));
vi.mock('../../../services/ai/regenerationProvider', () => ({
  buildRegenerationProviderOverrides: vi.fn(() => ({})),
  canUseRegenerationProvider: vi.fn(() => false),
  getCodexRegenerationStatus: vi.fn().mockResolvedValue({ available: false }),
}));
vi.mock('../../../services/attachmentsService', () => ({
  getAttachments: vi.fn().mockResolvedValue([]),
  pickAndAddAttachment: vi.fn(),
  readAttachmentContent: vi.fn(),
  estimateAttachmentTokens: vi.fn(() => 0),
  savePastedText: vi.fn(),
}));
vi.mock('../../../services/recordingsService', () => ({
  default: {
    getRecordings: vi.fn().mockResolvedValue([]),
    getTranscription: vi.fn().mockResolvedValue(null),
    getTranscriptionTxt: vi.fn().mockResolvedValue(''),
    getRecordingSchema: vi.fn().mockResolvedValue(null),
    getQuestionHistory: vi.fn().mockResolvedValue([]),
    getTaskSuggestions: vi.fn().mockResolvedValue([]),
    getParticipants: vi.fn().mockResolvedValue([]),
    getExtraInstructions: vi.fn().mockResolvedValue(''),
    saveExtraInstructions: vi.fn().mockResolvedValue(true),
    saveParticipants: vi.fn().mockResolvedValue(true),
    transcribeRecording: vi.fn().mockResolvedValue({ success: true }),
    deleteRecording: vi.fn().mockResolvedValue(true),
    renameRecording: vi.fn().mockResolvedValue(true),
    clearQuestionHistory: vi.fn().mockResolvedValue(true),
    replaceQuestionHistory: vi.fn().mockResolvedValue(true),
    updateLastQuestionHistory: vi.fn().mockResolvedValue(true),
    saveQuestionHistory: vi.fn().mockResolvedValue(true),
  },
}));

const { default: RecordingDetailWithTranscription } = await import(
  '../../../pages/RecordingDetail/RecordingDetailWithTranscription.jsx'
);
const { default: recordingsService } = await import('../../../services/recordingsService');

function makeRecording(overrides = {}) {
  return {
    id: 'rec-1',
    dbId: 1,
    name: 'Grabación de prueba',
    duration: 120,
    createdAt: new Date().toISOString(),
    transcriptionModel: 'app-recording',
    ...overrides,
  };
}

function makeElectronAPI(items) {
  return {
    loadSettings: vi.fn().mockResolvedValue({ success: true, settings: { whisperModel: 'small', aiProvider: 'gemini' } }),
    resources: { list: vi.fn().mockResolvedValue({ ok: true, items }) },
  };
}

async function renderDetail(props = {}) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const onNavigateToSettings = props.onNavigateToSettings || vi.fn();
  await act(async () => root.render(
    <RecordingDetailWithTranscription
      recording={props.recording || makeRecording()}
      onBack={vi.fn()}
      onNavigateToProject={vi.fn()}
      onNavigateToSettings={onNavigateToSettings}
    />
  ));
  return { container, root, onNavigateToSettings };
}

async function openReTranscribeModal(container) {
  const menuBtn = container.querySelector('button[title="Más acciones"]');
  await act(async () => menuBtn.click());
  const reTranscribeBtn = Array.from(container.querySelectorAll('button')).find((b) =>
    b.textContent.includes('Re-transcribir')
  );
  await act(async () => {
    reTranscribeBtn.click();
    // Flush del `.then()` de `window.electronAPI.resources.list()` dentro
    // de `handleReTranscribeClick`.
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe('RecordingDetailWithTranscription — wiring INV6 en el modal de re-transcripción (CRITICAL fix pass PR4)', () => {
  let root; let container;
  afterEach(() => {
    root?.unmount();
    container?.remove();
    delete window.electronAPI;
    vi.clearAllMocks();
  });

  it('camino feliz: modelo instalado → botón "Start Transcription" habilitado y encola al hacer click', async () => {
    window.electronAPI = makeElectronAPI([{ id: 'small', state: 'installed' }]);
    vi.stubGlobal('alert', vi.fn());

    ({ container, root } = await renderDetail());
    await openReTranscribeModal(container);

    const startBtn = container.querySelector('[data-testid=retranscribe-start-btn]');
    expect(startBtn).not.toBeNull();
    expect(startBtn.disabled).toBe(false);
    expect(container.querySelector('[data-testid=retranscribe-no-model-cta]')).toBeNull();

    await act(async () => {
      startBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(recordingsService.transcribeRecording).toHaveBeenCalledWith(1, 'small');
    vi.unstubAllGlobals();
  });

  it('camino sin-modelo-instalado: deshabilita "Start Transcription" y el CTA cierra el modal y navega a Ajustes', async () => {
    window.electronAPI = makeElectronAPI([{ id: 'small', state: 'not-installed' }]);
    const { container: c, root: r, onNavigateToSettings } = await renderDetail();
    container = c; root = r;
    await openReTranscribeModal(container);

    const startBtn = container.querySelector('[data-testid=retranscribe-start-btn]');
    expect(startBtn.disabled).toBe(true);

    const cta = container.querySelector('[data-testid=retranscribe-no-model-cta]');
    expect(cta).not.toBeNull();

    await act(async () => cta.click());

    expect(onNavigateToSettings).toHaveBeenCalledWith('general', 'models-and-downloads-section');
    // El CTA cierra el modal al navegar.
    expect(container.querySelector('[data-testid=retranscribe-start-btn]')).toBeNull();
    expect(recordingsService.transcribeRecording).not.toHaveBeenCalled();
  });
});
