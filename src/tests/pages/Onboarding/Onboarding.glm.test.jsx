import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// GLM (Z.AI Coding Plan) in the onboarding wizard. Same external-boundary
// mocks as `Onboarding.test.jsx` (IPC, settings persistence, i18n); the AI
// step (`AiConfigStep` + `CloudProviderCards`) is the REAL component, so the
// tests drive the GLM card the way a user would. Network is stubbed at
// `fetch` (any GLM model listing goes through it).
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
vi.mock('../../../services/settingsService', () => ({ updateSettings: vi.fn().mockResolvedValue({ success: true }) }));
vi.mock('../../../services/themeService', () => ({ applyTheme: vi.fn() }));
vi.mock('../../../services/ai/codexModelSelection', () => ({
  reconcileCodexSelection: vi.fn(() => ({ model: '', reasoningEffort: '' })),
}));
vi.mock('../../../pages/Onboarding/ModelStep.jsx', () => ({
  default: ({ onNext }) => React.createElement(
    'button',
    { onClick: onNext },
    'model-step-stub-next'
  ),
}));

const { default: Onboarding } = await import('../../../pages/Onboarding/Onboarding.jsx');
const { updateSettings } = await import('../../../services/settingsService');

function findButton(container, text) {
  return Array.from(container.querySelectorAll('button')).find((b) => b.textContent.includes(text));
}

function clickButtonWithText(container, text) {
  const button = findButton(container, text);
  if (!button) throw new Error(`No button with text "${text}"`);
  button.click();
}

function findProviderHeading(container, name) {
  return Array.from(container.querySelectorAll('h3')).find((h) => h.textContent.trim() === name);
}

function setFieldValue(element, value) {
  const proto = element.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(element, value);
  element.dispatchEvent(new Event(element.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
}

async function goToCloudAiStep(container) {
  await act(async () => clickButtonWithText(container, 'onboarding.welcome.beginBtn'));
  await act(async () => clickButtonWithText(container, 'onboarding.aiInfo.nextStep'));
  await act(async () => clickButtonWithText(container, 'model-step-stub-next'));
  await act(async () => clickButtonWithText(container, 'onboarding.ai.cloudTab'));
  // Precondition: the cloud provider cards are on screen.
  expect(findProviderHeading(container, 'Kimi')).toBeDefined();
}

describe('Onboarding — GLM provider card', () => {
  let root;
  let container;

  beforeEach(async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [{ id: 'glm-5.2' }, { id: 'glm-4.7' }] }),
    });
    window.electronAPI = {
      getMicrophonePermission: vi.fn().mockResolvedValue('granted'),
      getCodexStatus: vi.fn().mockResolvedValue({ available: false, connected: false }),
      getAppVersion: vi.fn().mockResolvedValue({ success: true, version: '1.0.0' }),
    };

    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    await act(async () => root.render(<Onboarding onComplete={vi.fn()} />));
  });

  afterEach(() => {
    root?.unmount();
    container?.remove();
    delete window.electronAPI;
    delete global.Notification;
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('shows the GLM card in the chat role and hides it in the embeddings role', async () => {
    await goToCloudAiStep(container);
    expect(findProviderHeading(container, 'GLM')).toBeDefined();

    await act(async () => clickButtonWithText(container, 'settings.agentsTabs.embeddings'));
    await act(async () => clickButtonWithText(container, 'onboarding.ai.cloudTab'));

    expect(findProviderHeading(container, 'Kimi')).toBeDefined();
    expect(findProviderHeading(container, 'GLM')).toBeUndefined();
  });

  it('finishing with GLM saves glmApiKey, glmModel and glmEndpointMode "plan"', async () => {
    await goToCloudAiStep(container);

    const heading = findProviderHeading(container, 'GLM');
    expect(heading).toBeDefined();
    await act(async () => heading.click());

    const card = heading.closest('.rounded-2xl');
    await act(async () => setFieldValue(card.querySelector('input'), 'glm-key'));

    const refresh = findButton(card, 'settings.buttons.refresh');
    if (refresh && !refresh.disabled) await act(async () => refresh.click());
    const select = card.querySelector('select');
    if (select && Array.from(select.options).some((o) => o.value === 'glm-5.2')) {
      await act(async () => setFieldValue(select, 'glm-5.2'));
    }

    await act(async () => clickButtonWithText(container, 'onboarding.ai.nextStep'));
    await act(async () => clickButtonWithText(container, 'onboarding.permissions.finishBtn'));
    await act(async () => clickButtonWithText(container, 'onboarding.storage.nextBtn'));

    // Ready step names the chosen provider.
    const readyHeadings = Array.from(container.querySelectorAll('h3')).map((h) => h.textContent);
    expect(readyHeadings.some((text) => text.includes('GLM'))).toBe(true);

    await act(async () => clickButtonWithText(container, 'onboarding.finish.launchBtn'));

    expect(updateSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        aiProvider: 'glm',
        glmApiKey: 'glm-key',
        glmModel: 'glm-5.2',
        glmEndpointMode: 'plan',
      })
    );
  });
});
