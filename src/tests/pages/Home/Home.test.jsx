import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// CRITICAL post-review (Fix 2): el wiring de INV6 en `Home.jsx`
// (`handleTranscribe` — `window.confirm` cuando no hay modelo instalado)
// no tenía ningún test de integración; solo la lógica PURA reutilizada
// (`resolveTranscribableModel`, `whisperModelGuard.js`) estaba cubierta.
// Este archivo monta el componente REAL con una grabación "recorded" (la
// única que muestra el botón de transcribir en `RecordingCard`).

const t = (key, opts) => (opts ? `${key}:${JSON.stringify(opts)}` : key);
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t, i18n: { language: 'es' } }) }));

const dispatchMock = vi.fn();
vi.mock('react-redux', () => ({
  useSelector: (fn) => fn({ recording: { isRecording: false } }),
  useDispatch: () => dispatchMock,
}));

// Servicios pesados de IA / audio no relacionados con este fix (INV6) —
// mismo criterio Extract-Before-Mock que el resto de PR4 (ver Deviation #3,
// apply-progress).
vi.mock('../../../services/audioService', () => ({
  MixedAudioRecorder: vi.fn(),
  getSystemMicrophones: vi.fn().mockResolvedValue([]),
}));
vi.mock('../../../services/ai/providerRouter', () => ({
  callProvider: vi.fn(),
  validateProviderConfig: vi.fn().mockResolvedValue({ valid: true }),
}));
vi.mock('../../../services/recordingAiService', () => ({
  default: { isGenerating: vi.fn().mockResolvedValue(false) },
}));
vi.mock('../../../prompts/common/aiPrompts', () => ({
  conversationNormalizationPrompt: vi.fn(),
}));

const { default: Home } = await import('../../../pages/Home/Home.jsx');

function makeFolder(overrides = {}) {
  return {
    id: 1,
    folderName: 'rec-1',
    name: 'Grabación de prueba',
    createdAt: Date.now(),
    path: '/fake/rec-1',
    hasAnalysis: false,
    files: [],
    duration: 120,
    status: undefined, // sin status explícito → RecordingCard lo trata como "recorded"
    ...overrides,
  };
}

function makeElectronAPI({ items, folders } = {}) {
  return {
    getRecordingFolders: vi.fn().mockResolvedValue({ success: true, folders: folders ?? [makeFolder()] }),
    loadSettings: vi.fn().mockResolvedValue({ success: true, settings: { whisperModel: 'small' } }),
    transcribeRecording: vi.fn().mockResolvedValue({ success: true }),
    resources: { list: vi.fn().mockResolvedValue({ ok: true, items: items ?? [] }) },
  };
}

async function renderHome(props = {}) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const onSettings = props.onSettings || vi.fn();
  await act(async () => root.render(
    <Home
      onSettings={onSettings}
      onProjects={vi.fn()}
      onRecordingStart={vi.fn()}
      onRecordingSelect={vi.fn()}
      onNavigateToProject={vi.fn()}
      refreshTrigger={0}
    />
  ));
  return { container, root, onSettings };
}

function findTranscribeButton(container) {
  return Array.from(container.querySelectorAll('button')).find((b) =>
    b.textContent.includes('recordingCard.transcribeLabel')
  );
}

describe('Home — wiring INV6 en handleTranscribe (CRITICAL fix pass PR4)', () => {
  let root; let container;
  afterEach(() => {
    root?.unmount();
    container?.remove();
    delete window.electronAPI;
    vi.clearAllMocks();
  });

  it('camino feliz: modelo instalado → transcribe directamente, sin window.confirm', async () => {
    window.electronAPI = makeElectronAPI({ items: [{ id: 'small', state: 'installed' }] });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { container: c, root: r, onSettings } = await renderHome();
    container = c; root = r;

    const transcribeBtn = findTranscribeButton(container);
    expect(transcribeBtn).not.toBeUndefined();

    await act(async () => {
      transcribeBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(window.electronAPI.transcribeRecording).toHaveBeenCalledWith(1, 'small');
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(onSettings).not.toHaveBeenCalled();
  });

  it('camino sin-modelo-instalado: pide confirmación y navega a Ajustes → Modelos y descargas, sin encolar', async () => {
    window.electronAPI = makeElectronAPI({ items: [{ id: 'small', state: 'not-installed' }] });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { container: c, root: r, onSettings } = await renderHome();
    container = c; root = r;

    const transcribeBtn = findTranscribeButton(container);

    await act(async () => {
      transcribeBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(confirmSpy).toHaveBeenCalledWith('home.noModelInstalledConfirm');
    expect(onSettings).toHaveBeenCalledWith('general', 'models-and-downloads-section');
    expect(window.electronAPI.transcribeRecording).not.toHaveBeenCalled();
  });
});
