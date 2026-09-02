import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Onboarding.jsx orquesta ~8 servicios de IA/settings/tema para el wizard
// completo (fuera de alcance de este PR3 refactorizarlo — proposal.md,
// "Out of Scope": "Refactor completo del wizard monolítico Onboarding.jsx").
// Se mockean como límites externos reales (IPC/red), no lógica propia de
// este batch — mismo criterio de excepción documentado ya en
// `SettingsContext.loadModelCatalog.test.jsx` (PR2 fix-pass): el objeto bajo
// prueba es la ORQUESTACIÓN/wiring en sí, no aislable a una función pura.
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
// Stub del step bajo prueba de wiring: lo que nos interesa es SU POSICIÓN en
// el wizard, no su comportamiento interno (ya cubierto por
// useModelDownloadStep.test.jsx y ModelStep.test.jsx).
vi.mock('../../../pages/Onboarding/ModelStep.jsx', () => ({
  default: ({ onNext }) => React.createElement(
    'div',
    { 'data-testid': 'model-step-stub' },
    React.createElement('button', { onClick: onNext }, 'model-step-stub-next')
  ),
}));

const { default: Onboarding, STEPS } = await import('../../../pages/Onboarding/Onboarding.jsx');

function clickButtonWithText(container, text) {
  const button = Array.from(container.querySelectorAll('button')).find((b) => b.textContent.includes(text));
  if (!button) throw new Error(`No se encontró ningún botón con el texto "${text}"`);
  button.click();
}

describe('Onboarding — wiring del paso "Modelo de transcripción" (ONB1, Fase 3)', () => {
  let root;
  let container;

  afterEach(() => {
    root?.unmount();
    container?.remove();
    delete window.electronAPI;
    delete global.Notification;
  });

  it('includes "model" in STEPS, right after "aiInfo"', () => {
    const ids = STEPS.map((step) => step.id);
    expect(ids).toContain('model');
    expect(ids.indexOf('model')).toBe(ids.indexOf('aiInfo') + 1);
  });

  it('renders ModelStep at its position after navigating past welcome and aiInfo', async () => {
    window.electronAPI = {
      getMicrophonePermission: vi.fn().mockResolvedValue('granted'),
      getCodexStatus: vi.fn().mockResolvedValue({ available: false, connected: false }),
      getAppVersion: vi.fn().mockResolvedValue({ success: true, version: '1.0.0' }),
    };

    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    await act(async () => root.render(<Onboarding onComplete={vi.fn()} />));

    expect(container.querySelector('[data-testid=model-step-stub]')).toBeNull();

    await act(async () => clickButtonWithText(container, 'onboarding.welcome.beginBtn'));
    await act(async () => clickButtonWithText(container, 'onboarding.aiInfo.nextStep'));

    expect(container.querySelector('[data-testid=model-step-stub]')).not.toBeNull();
  });

  it('advancing from ModelStep moves the wizard forward (no new state added to Onboarding.jsx for it)', async () => {
    window.electronAPI = {
      getMicrophonePermission: vi.fn().mockResolvedValue('granted'),
      getCodexStatus: vi.fn().mockResolvedValue({ available: false, connected: false }),
      getAppVersion: vi.fn().mockResolvedValue({ success: true, version: '1.0.0' }),
    };

    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    await act(async () => root.render(<Onboarding onComplete={vi.fn()} />));

    await act(async () => clickButtonWithText(container, 'onboarding.welcome.beginBtn'));
    await act(async () => clickButtonWithText(container, 'onboarding.aiInfo.nextStep'));
    expect(container.querySelector('[data-testid=model-step-stub]')).not.toBeNull();

    await act(async () => clickButtonWithText(container, 'model-step-stub-next'));
    expect(container.querySelector('[data-testid=model-step-stub]')).toBeNull();
  });
});
