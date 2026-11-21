import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

// BLOCKER (fix post-review PR2): `loadSettings()` llamaba a `loadModelCatalog()`
// "fire-and-forget" (sin `await`), a diferencia de la llamada análoga de
// `getSystemMicrophones()` justo arriba que SÍ se espera. Eso permitía que
// `loadSettings()` terminara (isLoading -> false) ANTES de que el catálogo
// dinámico de modelos Whisper (`modelCatalog`/`whisperModels`) se poblara,
// dejando el selector vacío en una carrera.
//
// Este test SÍ monta el `SettingsProvider` real (a diferencia de
// `whisperModelCatalog.test.js`, que testea la lógica pura extraída) porque
// el bug vive en la orquestación de `loadSettings()` en sí, no en una pieza
// aislable — se mockean el resto de proveedores de IA (Ollama/Gemini/LM
// Studio/OpenAI/Codex/tema) para no depender de sus efectos secundarios
// reales, siguiendo el mismo criterio documentado en whisperModelCatalog.js.

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key, i18n: { language: 'es' } }),
}));

vi.mock('../../../services/ai/ollamaProvider', () => ({
  getAvailableModels: vi.fn().mockResolvedValue([]),
  checkOllamaAvailability: vi.fn().mockResolvedValue(false),
  checkModelSupportsStreaming: vi.fn().mockResolvedValue(false),
  getOllamaModelInfo: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../../services/ai/geminiProvider', () => ({
  getGeminiAvailableModels: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../../services/ai/providerRouter', () => ({
  getDeepseekAvailableModels: vi.fn().mockReturnValue([]),
  getKimiAvailableModels: vi.fn().mockReturnValue([]),
  getLMStudioModels: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../../services/ai/lmStudioProvider', () => ({
  checkLMStudioAvailability: vi.fn().mockResolvedValue(false),
  getLMStudioModelInfo: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../../services/themeService', () => ({
  applyTheme: vi.fn(),
}));

vi.mock('../../../services/ai/customOpenAIProvider', () => ({
  CustomOpenAIProvider: vi.fn(),
  OPENAI_BASE_URL: 'http://fake-openai.local/v1',
}));

vi.mock('../../../services/ai/codexModelSelection', () => ({
  reconcileCodexSelection: vi.fn((_models, model, reasoningEffort) => ({ model, reasoningEffort })),
}));

const { SettingsProvider, useSettings } = await import(
  '../../../pages/Settings/SettingsContext.jsx'
);

function Probe({ onRender }) {
  const ctx = useSettings();
  onRender(ctx);
  return null;
}

async function renderProvider(onRender) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <SettingsProvider>
        <Probe onRender={onRender} />
      </SettingsProvider>
    );
  });
  return { container, root };
}

async function flushMacrotask() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe('SettingsContext — loadSettings() debe esperar loadModelCatalog() (BLOCKER, fix post-review PR2)', () => {
  let root;
  let container;

  afterEach(() => {
    root?.unmount();
    container?.remove();
    delete window.electronAPI;
  });

  it('no termina loadSettings() (isLoading sigue true) hasta que el catálogo de modelos resuelve — sin carrera', async () => {
    let resolveList;
    const listPromise = new Promise((resolve) => { resolveList = resolve; });
    window.electronAPI = {
      resources: { list: vi.fn(() => listPromise) },
      loadSettings: vi.fn().mockResolvedValue({ success: true, settings: null }),
    };

    let latest = null;
    ({ container, root } = await renderProvider((ctx) => { latest = ctx; }));

    // Con el bug original (sin `await`), `loadSettings()` ya habría
    // terminado en este punto porque `getSettings()` no depende del
    // catálogo. Con el fix, debe seguir bloqueada esperando `resources.list()`.
    await flushMacrotask();

    expect(latest.isLoading).toBe(true);
    expect(latest.whisperModels).toEqual([]);
    expect(latest.modelCatalog).toEqual([]);
    expect(window.electronAPI.loadSettings).not.toHaveBeenCalled();

    await act(async () => {
      resolveList({
        ok: true,
        items: [
          { id: 'tiny', repoId: 'Systran/faster-whisper-tiny', estimatedBytes: 78_000_000, state: 'not-installed', recommended: false, error: null },
        ],
      });
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(latest.modelCatalog).toHaveLength(1);
    expect(latest.whisperModels.length).toBeGreaterThan(0);
    expect(window.electronAPI.loadSettings).toHaveBeenCalledTimes(1);
  });

  it('degrada con gracia cuando resources.list() no existe: los ajustes igual terminan de cargar con catálogo vacío', async () => {
    window.electronAPI = {
      // Sin `resources` — simula una ventana/build donde el IPC no está expuesto.
      loadSettings: vi.fn().mockResolvedValue({ success: true, settings: null }),
    };

    let latest = null;
    ({ container, root } = await renderProvider((ctx) => { latest = ctx; }));

    await flushMacrotask();

    expect(latest.isLoading).toBe(false);
    expect(latest.hasLoadedSettings).toBe(true);
    expect(latest.modelCatalog).toEqual([]);
    expect(latest.whisperModels).toEqual([]);
  });

  it('degrada con gracia cuando resources.list() rechaza: los ajustes igual terminan de cargar con catálogo vacío', async () => {
    window.electronAPI = {
      resources: { list: vi.fn().mockRejectedValue(new Error('IPC no disponible')) },
      loadSettings: vi.fn().mockResolvedValue({ success: true, settings: null }),
    };

    let latest = null;
    ({ container, root } = await renderProvider((ctx) => { latest = ctx; }));

    await flushMacrotask();

    expect(latest.isLoading).toBe(false);
    expect(latest.hasLoadedSettings).toBe(true);
    expect(latest.modelCatalog).toEqual([]);
    expect(latest.whisperModels).toEqual([]);
  });
});
