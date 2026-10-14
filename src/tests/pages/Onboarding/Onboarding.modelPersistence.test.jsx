import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Cobertura de la persistencia ONB4 elevada a `Onboarding.jsx`
// (`useOnboardingModelPersistence.js` — BLOCKER, fix post-review PR3).
// A diferencia de `Onboarding.test.jsx` (que stubea `ModelStep.jsx` porque
// solo le interesa el wiring de POSICIÓN en el wizard), acá se necesita el
// `ModelStep` REAL montado y luego desmontado por navegación, para probar
// que el tracking de persistencia sobrevive ese desmontaje porque vive en
// `Onboarding.jsx` (que permanece montado durante todo el wizard) y no en
// el step. `AiConfigStep` (el paso siguiente a "model") sí se stubea, igual
// que `Onboarding.test.jsx` stubea `ModelStep`: no es el objeto bajo
// prueba, solo necesitamos que el wizard pueda avanzar más allá de "model".
const t = (key) => key;

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t }) }));
vi.mock('../../../i18n/index.js', () => ({ default: { language: 'es', changeLanguage: vi.fn() } }));
vi.mock('../../../services/ai/ollamaProvider', () => ({
  getAvailableModels: vi.fn().mockResolvedValue([]),
  checkOllamaAvailability: vi.fn().mockResolvedValue(false),
}));
vi.mock('../../../services/ai/lmStudioProvider', () => ({
  checkLMStudioAvailability: vi.fn().mockResolvedValue(false),
  getLMStudioModels: vi.fn().mockResolvedValue([]),
}));
vi.mock('../../../services/ai/geminiProvider', () => ({ getGeminiAvailableModels: vi.fn().mockResolvedValue([]) }));
vi.mock('../../../services/ai/providerRouter', () => ({
  getKimiAvailableModels: () => [],
  getDeepseekAvailableModels: () => [],
}));
vi.mock('../../../services/ai/customOpenAIProvider', () => ({
  CustomOpenAIProvider: class {},
  OPENAI_BASE_URL: 'https://api.openai.com',
}));
vi.mock('../../../services/settingsService', () => ({ updateSettings: vi.fn().mockResolvedValue({ success: true }) }));
vi.mock('../../../services/themeService', () => ({ applyTheme: vi.fn() }));
vi.mock('../../../services/ai/codexModelSelection', () => ({
  reconcileCodexSelection: vi.fn(() => ({ model: '', reasoningEffort: '' })),
}));
// Stub del paso SIGUIENTE a "model" — no es el objeto bajo prueba, solo
// necesitamos poder navegar más allá de "model" para desmontar `ModelStep`
// sin desmontar `Onboarding`.
vi.mock('../../../pages/Onboarding/AiConfigStep/index.jsx', () => ({
  default: () => React.createElement('div', { 'data-testid': 'ai-config-step-stub' }),
}));

const { default: Onboarding } = await import('../../../pages/Onboarding/Onboarding.jsx');
const { updateSettings } = await import('../../../services/settingsService');

function makeSnapshot(overrides = {}) {
  return {
    ok: true,
    cacheDir: '/fake/cache',
    freeBytes: 20 * 1024 ** 3,
    totalBytes: 100 * 1024 ** 3,
    items: [
      { id: 'tiny', repoId: 'r-tiny', estimatedBytes: 78_000_000, state: 'not-installed', installedBytes: null, path: null, recommended: false, error: null },
      { id: 'small', repoId: 'r-small', estimatedBytes: 486_000_000, state: 'not-installed', installedBytes: null, path: null, recommended: true, error: null },
      { id: 'medium', repoId: 'r-medium', estimatedBytes: 1_500_000_000, state: 'not-installed', installedBytes: null, path: null, recommended: false, error: null },
    ],
    queue: [],
    active: null,
    ...overrides,
  };
}

/**
 * Simula el bus real de `resources:progress` (preload.js): cada suscriptor
 * (`useModelDownloadStep` mientras `ModelStep` está montado, y
 * `useOnboardingModelPersistence` en `Onboarding.jsx` durante TODO el
 * wizard) tiene su propio listener independiente, que se da de baja al
 * desmontarse su componente — igual que `ipcRenderer.removeListener`.
 */
function makeResourcesMock({ list, download } = {}) {
  const listeners = new Set();
  const onProgress = vi.fn((listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  });
  const emit = (snapshot) => {
    for (const listener of Array.from(listeners)) listener(snapshot);
  };
  return {
    api: {
      list: list || vi.fn().mockResolvedValue(makeSnapshot()),
      onProgress,
      download: download || vi.fn().mockResolvedValue({ ok: true }),
    },
    emit,
    listeners,
  };
}

function clickButtonWithText(container, text) {
  const button = Array.from(container.querySelectorAll('button')).find((b) => b.textContent.includes(text));
  if (!button) throw new Error(`No se encontró ningún botón con el texto "${text}"`);
  button.click();
}

async function navigateToModelStep(container) {
  await act(async () => clickButtonWithText(container, 'onboarding.welcome.beginBtn'));
  await act(async () => clickButtonWithText(container, 'onboarding.aiInfo.nextStep'));
  expect(container.querySelector('[data-testid=model-catalog]')).not.toBeNull();
}

describe('Onboarding — persistencia ONB4 sobrevive la navegación del wizard (BLOCKER, fix post-review PR3)', () => {
  let root;
  let container;

  afterEach(() => {
    root?.unmount();
    container?.remove();
    delete window.electronAPI;
    delete global.Notification;
    vi.clearAllMocks();
  });

  it('persists whisperModel as default when the download it started completes AFTER ModelStep unmounts (user advanced the wizard)', async () => {
    const resources = makeResourcesMock();
    window.electronAPI = {
      getMicrophonePermission: vi.fn().mockResolvedValue('granted'),
      getCodexStatus: vi.fn().mockResolvedValue({ available: false, connected: false }),
      getAppVersion: vi.fn().mockResolvedValue({ success: true, version: '1.0.0' }),
      resources: resources.api,
    };

    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    await act(async () => root.render(<Onboarding onComplete={vi.fn()} />));

    await navigateToModelStep(container);

    // Arranca la descarga de "small" (preseleccionado) desde ModelStep.
    await act(async () => container.querySelector('[data-testid=model-download-btn]').click());
    expect(resources.api.download).toHaveBeenCalledWith('small');

    // Avanza el wizard: ModelStep se desmonta (su listener de onProgress se
    // da de baja), pero Onboarding sigue montado.
    await act(async () => container.querySelector('[data-testid=model-step-next]').click());
    expect(container.querySelector('[data-testid=model-catalog]')).toBeNull();
    expect(container.querySelector('[data-testid=ai-config-step-stub]')).not.toBeNull();

    // La descarga sigue en curso en segundo plano y finalmente se completa.
    // Solo debería seguir suscripto el listener de `useOnboardingModelPersistence`.
    expect(resources.listeners.size).toBe(1);

    await act(async () => resources.emit(makeSnapshot({
      items: [
        { id: 'tiny', repoId: 'r-tiny', estimatedBytes: 78_000_000, state: 'not-installed', installedBytes: null, path: null, recommended: false, error: null },
        { id: 'small', repoId: 'r-small', estimatedBytes: 486_000_000, state: 'installed', installedBytes: 486_000_000, path: '/fake/small', recommended: true, error: null },
        { id: 'medium', repoId: 'r-medium', estimatedBytes: 1_500_000_000, state: 'not-installed', installedBytes: null, path: null, recommended: false, error: null },
      ],
    })));

    expect(updateSettings).toHaveBeenCalledWith({ whisperModel: 'small' });
  });

  it('tracks more than one download started from onboarding without losing the first when the selection changes mid-download', async () => {
    const resources = makeResourcesMock();
    window.electronAPI = {
      getMicrophonePermission: vi.fn().mockResolvedValue('granted'),
      getCodexStatus: vi.fn().mockResolvedValue({ available: false, connected: false }),
      getAppVersion: vi.fn().mockResolvedValue({ success: true, version: '1.0.0' }),
      resources: resources.api,
    };

    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    await act(async () => root.render(<Onboarding onComplete={vi.fn()} />));

    await navigateToModelStep(container);

    // 1) Arranca "small" (preseleccionado).
    await act(async () => container.querySelector('[data-testid=model-download-btn]').click());
    expect(resources.api.download).toHaveBeenCalledWith('small');

    // El snapshot ahora refleja "small" descargando.
    await act(async () => resources.emit(makeSnapshot({
      items: [
        { id: 'tiny', repoId: 'r-tiny', estimatedBytes: 78_000_000, state: 'not-installed', installedBytes: null, path: null, recommended: false, error: null },
        { id: 'small', repoId: 'r-small', estimatedBytes: 486_000_000, state: 'downloading', installedBytes: null, path: null, recommended: true, error: null },
        { id: 'medium', repoId: 'r-medium', estimatedBytes: 1_500_000_000, state: 'not-installed', installedBytes: null, path: null, recommended: false, error: null },
      ],
      queue: [{ id: 'small', state: 'downloading', receivedBytes: 1, totalBytes: 486_000_000, percent: 1, position: 1, total: 1 }],
      active: { id: 'small', state: 'downloading', receivedBytes: 1, totalBytes: 486_000_000, percent: 1, position: 1, total: 1 },
    })));

    // 2) El usuario cambia la selección a "medium" (mientras "small" sigue
    // descargando) y arranca esa descarga también — antes, el ref de un solo
    // slot (`activeDownloadIdRef`) pisaba el tracking de "small" acá.
    await act(async () => container.querySelector('[data-testid=model-radio-medium]').click());
    await act(async () => container.querySelector('[data-testid=model-download-btn]').click());
    expect(resources.api.download).toHaveBeenCalledWith('medium');

    // "small" termina primero.
    await act(async () => resources.emit(makeSnapshot({
      items: [
        { id: 'tiny', repoId: 'r-tiny', estimatedBytes: 78_000_000, state: 'not-installed', installedBytes: null, path: null, recommended: false, error: null },
        { id: 'small', repoId: 'r-small', estimatedBytes: 486_000_000, state: 'installed', installedBytes: 486_000_000, path: '/fake/small', recommended: true, error: null },
        { id: 'medium', repoId: 'r-medium', estimatedBytes: 1_500_000_000, state: 'downloading', installedBytes: null, path: null, recommended: false, error: null },
      ],
      queue: [{ id: 'medium', state: 'downloading', receivedBytes: 1, totalBytes: 1_500_000_000, percent: 1, position: 1, total: 1 }],
      active: { id: 'medium', state: 'downloading', receivedBytes: 1, totalBytes: 1_500_000_000, percent: 1, position: 1, total: 1 },
    })));

    expect(updateSettings).toHaveBeenCalledWith({ whisperModel: 'small' });
    expect(updateSettings).toHaveBeenCalledTimes(1);

    // "medium" termina después — el tracking de "small" no se perdió antes,
    // y el de "medium" tampoco se pierde ahora: ambos se persistieron.
    await act(async () => resources.emit(makeSnapshot({
      items: [
        { id: 'tiny', repoId: 'r-tiny', estimatedBytes: 78_000_000, state: 'not-installed', installedBytes: null, path: null, recommended: false, error: null },
        { id: 'small', repoId: 'r-small', estimatedBytes: 486_000_000, state: 'installed', installedBytes: 486_000_000, path: '/fake/small', recommended: true, error: null },
        { id: 'medium', repoId: 'r-medium', estimatedBytes: 1_500_000_000, state: 'installed', installedBytes: 1_500_000_000, path: '/fake/medium', recommended: false, error: null },
      ],
    })));

    expect(updateSettings).toHaveBeenCalledWith({ whisperModel: 'medium' });
    expect(updateSettings).toHaveBeenCalledTimes(2);
  });
});
