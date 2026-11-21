import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const t = (key, opts) => (opts ? `${key}:${JSON.stringify(opts)}` : key);

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t, i18n: { language: 'es' } }),
}));

function mockUseSettings(overrides = {}) {
  return {
    t,
    selectedLanguage: 'es',
    setSelectedLanguage: vi.fn(),
    whisperModel: 'small',
    setWhisperModel: vi.fn(),
    modelCatalog: [
      { id: 'tiny', repoId: 'r-tiny', estimatedBytes: 1, state: 'not-installed', installedBytes: null, path: null, recommended: false, error: null },
      { id: 'small', repoId: 'r-small', estimatedBytes: 1, state: 'installed', installedBytes: 1, path: '/x', recommended: true, error: null },
    ],
    cpuThreads: 4,
    setCpuThreads: vi.fn(),
    maxCpuThreads: 8,
    autoTranscribe: true,
    setAutoTranscribe: vi.fn(),
    autoAnalyze: true,
    setAutoAnalyze: vi.fn(),
    autoGenerateSchema: false,
    setAutoGenerateSchema: vi.fn(),
    enableDiarization: false,
    setEnableDiarization: vi.fn(),
    hfToken: '',
    setHfToken: vi.fn(),
    speakerSimilarityThreshold: 0.85,
    setSpeakerSimilarityThreshold: vi.fn(),
    showApiKey: false,
    setShowApiKey: vi.fn(),
    ...overrides,
  };
}

let mockSettings;
vi.mock('../../../../../pages/Settings/SettingsContext.jsx', () => ({
  useSettings: () => mockSettings,
  mockLanguages: [
    { value: 'es', label: 'Español' },
    { value: 'en', label: 'English' },
  ],
}));

const { default: TranscriptionSection } = await import(
  '../../../../../pages/Settings/components/GeneralTab/TranscriptionSection.jsx'
);

async function renderSection(overrides = {}) {
  mockSettings = mockUseSettings(overrides);
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<TranscriptionSection />));
  return { container, root };
}

describe('TranscriptionSection — Fase 4.7: solo instalados + CTA (INV6)', () => {
  let root; let container;
  afterEach(() => { root?.unmount(); container?.remove(); });

  it('renders not-installed models as disabled ("atenuado") options', async () => {
    ({ container, root } = await renderSection());

    const options = Array.from(container.querySelectorAll('[data-testid=whisper-model-select] option'));
    const tinyOption = options.find((o) => o.value === 'tiny');
    const smallOption = options.find((o) => o.value === 'small');

    expect(tinyOption.disabled).toBe(true);
    expect(smallOption.disabled).toBe(false);
    expect(tinyOption.textContent).toContain('settings.whisperModels.notInstalledSuffix');
  });

  it('never triggers a download when the selection changes (INV6 — selector nunca dispara descarga)', async () => {
    const setWhisperModel = vi.fn();
    window.electronAPI = { resources: { download: vi.fn() } };
    ({ container, root } = await renderSection({ setWhisperModel }));

    const select = container.querySelector('[data-testid=whisper-model-select]');
    await act(async () => {
      select.value = 'small';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(setWhisperModel).toHaveBeenCalledWith('small');
    expect(window.electronAPI.resources.download).not.toHaveBeenCalled();
    delete window.electronAPI;
  });

  it('shows a CTA pointing at "Modelos y descargas" when there is no installed model at all', async () => {
    ({ container, root } = await renderSection({
      modelCatalog: [
        { id: 'tiny', repoId: 'r-tiny', estimatedBytes: 1, state: 'not-installed', installedBytes: null, path: null, recommended: false, error: null },
      ],
    }));

    expect(container.querySelector('[data-testid=whisper-model-none-installed-cta]')).not.toBeNull();
  });

  it('does not show the CTA when at least one model is installed', async () => {
    ({ container, root } = await renderSection());
    expect(container.querySelector('[data-testid=whisper-model-none-installed-cta]')).toBeNull();
  });
});
