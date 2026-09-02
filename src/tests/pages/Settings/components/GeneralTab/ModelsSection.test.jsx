import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const t = (key, opts) => (opts ? `${key}:${JSON.stringify(opts)}` : key);
const mockSettings = { t, whisperModel: 'small' };

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t, i18n: { language: 'es' } }),
}));

vi.mock('../../../../../pages/Settings/SettingsContext.jsx', () => ({
  useSettings: () => mockSettings,
}));

vi.mock('../../../../../components/DiskSpaceIndicator/DiskSpaceIndicator.jsx', () => ({
  default: () => React.createElement('div', { 'data-testid': 'disk-space-indicator-stub' }),
}));

const { default: ModelsSection } = await import(
  '../../../../../pages/Settings/components/GeneralTab/ModelsSection.jsx'
);

function makeSnapshot(overrides = {}) {
  return {
    ok: true,
    cacheDir: '/fake/cache',
    freeBytes: 20 * 1024 ** 3,
    totalBytes: 100 * 1024 ** 3,
    items: [
      { id: 'tiny', repoId: 'Systran/faster-whisper-tiny', estimatedBytes: 78_000_000, state: 'not-installed', installedBytes: null, path: null, recommended: false, error: null },
      { id: 'small', repoId: 'Systran/faster-whisper-small', estimatedBytes: 486_000_000, state: 'installed', installedBytes: 486_000_000, path: '/fake/small', recommended: true, error: null },
    ],
    queue: [],
    active: null,
    ...overrides,
  };
}

async function renderModelsSection({ list, checkSpace, download, cancel, retry, remove, onProgress } = {}) {
  const unsubscribe = vi.fn();
  window.electronAPI = {
    resources: {
      list: list || vi.fn().mockResolvedValue(makeSnapshot()),
      checkSpace: checkSpace || vi.fn(),
      download: download || vi.fn().mockResolvedValue({ ok: true }),
      cancel: cancel || vi.fn().mockResolvedValue({ ok: true }),
      retry: retry || vi.fn().mockResolvedValue({ ok: true }),
      remove: remove || vi.fn().mockResolvedValue({ ok: true }),
      onProgress: onProgress || vi.fn(() => unsubscribe),
    },
  };
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<ModelsSection />));
  return { container, root, unsubscribe };
}

describe('ModelsSection — Fase 3.1: listado + DiskSpaceIndicator (INV1, INV5)', () => {
  let root; let container;
  afterEach(() => { root?.unmount(); container?.remove(); delete window.electronAPI; });

  it('lists catalog models with their state/size and mounts DiskSpaceIndicator above the list', async () => {
    ({ container, root } = await renderModelsSection());

    const indicator = container.querySelector('[data-testid=disk-space-indicator-stub]');
    const list = container.querySelector('[data-testid=models-list]');
    expect(indicator).not.toBeNull();
    expect(list).not.toBeNull();
    // El indicador debe estar ANTES que la lista en el DOM (D10: "encima de la lista").
    expect(indicator.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    expect(container.querySelector('[data-testid=model-row-tiny]').textContent).toContain('tiny');
    expect(container.querySelector('[data-testid=model-row-small]').textContent).toContain('small');
    expect(container.querySelector('[data-testid=model-state-small]').textContent).toContain('settings.modelsSection.states.installed');
    expect(container.querySelector('[data-testid=model-state-tiny]').textContent).toContain('settings.modelsSection.states.notInstalled');
  });
});

describe('ModelsSection — Fase 3.3/3.4: confirmación de descarga con validación de espacio (DL1, DL2)', () => {
  let root; let container;
  afterEach(() => { root?.unmount(); container?.remove(); delete window.electronAPI; });

  it('checks space, shows purpose/size/free/remaining, and only downloads after explicit confirm', async () => {
    const checkSpace = vi.fn().mockResolvedValue({
      ok: true, sufficient: true, freeBytes: 20 * 1024 ** 3, totalBytes: 100 * 1024 ** 3,
      requiredBytes: 578_000_000, estimatedBytes: 78_000_000, remainingAfterBytes: (20 * 1024 ** 3) - 78_000_000,
    });
    const download = vi.fn().mockResolvedValue({ ok: true });
    ({ container, root } = await renderModelsSection({ checkSpace, download }));

    await act(async () => container.querySelector('[data-testid=download-btn-tiny]').click());
    expect(checkSpace).toHaveBeenCalledWith('tiny');
    expect(download).not.toHaveBeenCalled(); // no descarga hasta confirmar

    const confirmModal = container.querySelector('[data-testid=download-confirm-modal]');
    expect(confirmModal).not.toBeNull();
    expect(confirmModal.textContent).toContain('settings.modelsSection.confirm.purpose');

    await act(async () => container.querySelector('[data-testid=download-confirm-accept]').click());
    expect(download).toHaveBeenCalledWith('tiny');
  });

  it('blocks the download without enqueueing when space is insufficient, and explains why', async () => {
    const checkSpace = vi.fn().mockResolvedValue({
      ok: true, sufficient: false, freeBytes: 10_000_000, totalBytes: 100 * 1024 ** 3,
      requiredBytes: 578_000_000, estimatedBytes: 78_000_000, remainingAfterBytes: 10_000_000 - 78_000_000,
    });
    const download = vi.fn();
    ({ container, root } = await renderModelsSection({ checkSpace, download }));

    await act(async () => container.querySelector('[data-testid=download-btn-tiny]').click());

    expect(checkSpace).toHaveBeenCalledWith('tiny');
    expect(download).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid=download-confirm-modal]')).toBeNull();
    expect(container.querySelector('[data-testid=insufficient-space-tiny]')).not.toBeNull();
  });

  // CRITICAL (fix post-review PR2): `freeBytes: null` (statfsSync falló en
  // el backend) se coaccionaba a `0 >= requiredBytes` -> `sufficient: false`,
  // mostrando "espacio insuficiente" como si el problema fuera falta de
  // espacio, cuando en realidad no se pudo verificar.
  it('shows a "could not verify space" message (not "insufficient space") when freeBytes is null, and lets the user continue anyway', async () => {
    const checkSpace = vi.fn().mockResolvedValue({
      ok: true, sufficient: null, freeBytes: null, totalBytes: null,
      requiredBytes: 578_000_000, estimatedBytes: 78_000_000, remainingAfterBytes: null,
    });
    const download = vi.fn().mockResolvedValue({ ok: true });
    ({ container, root } = await renderModelsSection({ checkSpace, download }));

    await act(async () => container.querySelector('[data-testid=download-btn-tiny]').click());

    expect(checkSpace).toHaveBeenCalledWith('tiny');
    expect(container.querySelector('[data-testid=insufficient-space-tiny]')).toBeNull();
    expect(container.querySelector('[data-testid=download-confirm-modal]')).toBeNull();
    const unavailable = container.querySelector('[data-testid=space-unavailable-tiny]');
    expect(unavailable).not.toBeNull();
    expect(unavailable.textContent).toContain('settings.modelsSection.confirm.spaceUnavailable');
    expect(download).not.toHaveBeenCalled();

    // El usuario tiene una vía explícita para continuar bajo su propio riesgo.
    await act(async () => container.querySelector('[data-testid=space-unavailable-continue-tiny]').click());
    expect(download).toHaveBeenCalledWith('tiny');
  });
});

describe('ModelsSection — Fase 3.5/3.6: progreso en vivo (DL2)', () => {
  let root; let container;
  afterEach(() => { root?.unmount(); container?.remove(); delete window.electronAPI; });

  it('shows live download percent for a downloading model from resources:progress snapshots', async () => {
    let progressListener;
    const onProgress = vi.fn((listener) => { progressListener = listener; return vi.fn(); });
    const list = vi.fn().mockResolvedValue(makeSnapshot({
      items: [
        { id: 'tiny', repoId: 'r', estimatedBytes: 78_000_000, state: 'downloading', installedBytes: null, path: null, recommended: false, error: null },
        { id: 'small', repoId: 'r2', estimatedBytes: 486_000_000, state: 'installed', installedBytes: 486_000_000, path: '/x', recommended: true, error: null },
      ],
      queue: [{ id: 'tiny', state: 'downloading', receivedBytes: 39_000_000, totalBytes: 78_000_000, percent: 50, position: 1, total: 1 }],
      active: { id: 'tiny', state: 'downloading', receivedBytes: 39_000_000, totalBytes: 78_000_000, percent: 50, position: 1, total: 1 },
    }));
    ({ container, root } = await renderModelsSection({ list, onProgress }));

    expect(container.querySelector('[data-testid=model-progress-tiny]').textContent).toContain('50');

    // Nuevo snapshot vía el canal de progreso — debe reflejar el nuevo % sin
    // necesidad de un nuevo pull manual.
    await act(async () => progressListener(makeSnapshot({
      items: [
        { id: 'tiny', repoId: 'r', estimatedBytes: 78_000_000, state: 'downloading', installedBytes: null, path: null, recommended: false, error: null },
        { id: 'small', repoId: 'r2', estimatedBytes: 486_000_000, state: 'installed', installedBytes: 486_000_000, path: '/x', recommended: true, error: null },
      ],
      queue: [{ id: 'tiny', state: 'downloading', receivedBytes: 70_200_000, totalBytes: 78_000_000, percent: 90, position: 1, total: 1 }],
      active: { id: 'tiny', state: 'downloading', receivedBytes: 70_200_000, totalBytes: 78_000_000, percent: 90, position: 1, total: 1 },
    })));

    expect(container.querySelector('[data-testid=model-progress-tiny]').textContent).toContain('90');
  });
});

describe('ModelsSection — Fase 3.7/3.8: cancelar / reintentar (DL3, DL4)', () => {
  let root; let container;
  afterEach(() => { root?.unmount(); container?.remove(); delete window.electronAPI; });

  it('shows a cancel button for a downloading model and calls resources.cancel(id)', async () => {
    const cancel = vi.fn().mockResolvedValue({ ok: true });
    const list = vi.fn().mockResolvedValue(makeSnapshot({
      items: [
        { id: 'tiny', repoId: 'r', estimatedBytes: 78_000_000, state: 'downloading', installedBytes: null, path: null, recommended: false, error: null },
        { id: 'small', repoId: 'r2', estimatedBytes: 486_000_000, state: 'installed', installedBytes: 486_000_000, path: '/x', recommended: true, error: null },
      ],
      queue: [{ id: 'tiny', state: 'downloading', receivedBytes: 1, totalBytes: 78_000_000, percent: 1, position: 1, total: 1 }],
      active: { id: 'tiny', state: 'downloading', receivedBytes: 1, totalBytes: 78_000_000, percent: 1, position: 1, total: 1 },
    }));
    ({ container, root } = await renderModelsSection({ list, cancel }));

    expect(container.querySelector('[data-testid=retry-btn-tiny]')).toBeNull();
    await act(async () => container.querySelector('[data-testid=cancel-btn-tiny]').click());
    expect(cancel).toHaveBeenCalledWith('tiny');
  });

  it('shows a retry button for a failed model and calls resources.retry(id) — not resources.download', async () => {
    const retry = vi.fn().mockResolvedValue({ ok: true });
    const download = vi.fn();
    const list = vi.fn().mockResolvedValue(makeSnapshot({
      items: [
        { id: 'tiny', repoId: 'r', estimatedBytes: 78_000_000, state: 'error', installedBytes: null, path: null, recommended: false, error: { code: 'network', detail: null } },
        { id: 'small', repoId: 'r2', estimatedBytes: 486_000_000, state: 'installed', installedBytes: 486_000_000, path: '/x', recommended: true, error: null },
      ],
    }));
    ({ container, root } = await renderModelsSection({ list, retry, download }));

    expect(container.querySelector('[data-testid=cancel-btn-tiny]')).toBeNull();
    await act(async () => container.querySelector('[data-testid=retry-btn-tiny]').click());
    expect(retry).toHaveBeenCalledWith('tiny');
    expect(download).not.toHaveBeenCalled();
  });
});

describe('ModelsSection — Fase 3.9/3.10: confirmación y guardia de borrado (DL5)', () => {
  let root; let container;
  afterEach(() => { root?.unmount(); container?.remove(); delete window.electronAPI; });

  it('shows freed space in the delete confirmation and deletes when the model is eligible', async () => {
    const remove = vi.fn().mockResolvedValue({ ok: true });
    ({ container, root } = await renderModelsSection({ remove }));

    await act(async () => container.querySelector('[data-testid=delete-btn-small]').click());
    const modal = container.querySelector('[data-testid=delete-confirm-modal]');
    expect(modal).not.toBeNull();
    expect(modal.textContent).toContain('settings.modelsSection.confirm.freedSpace');

    await act(async () => container.querySelector('[data-testid=delete-confirm-accept]').click());
    expect(remove).toHaveBeenCalledWith('small');
  });

  it('blocks deletion and shows the "default model" guard message when reason is default-model', async () => {
    const remove = vi.fn().mockResolvedValue({ ok: false, reason: 'default-model' });
    ({ container, root } = await renderModelsSection({ remove }));

    await act(async () => container.querySelector('[data-testid=delete-btn-small]').click());
    await act(async () => container.querySelector('[data-testid=delete-confirm-accept]').click());

    expect(remove).toHaveBeenCalledWith('small');
    expect(container.querySelector('[data-testid=delete-guard-small]').textContent)
      .toContain('settings.modelsSection.deleteGuard.defaultModel');
  });

  it('blocks deletion and shows the "in queue" guard message when reason is in-queue', async () => {
    const remove = vi.fn().mockResolvedValue({ ok: false, reason: 'in-queue' });
    ({ container, root } = await renderModelsSection({ remove }));

    await act(async () => container.querySelector('[data-testid=delete-btn-small]').click());
    await act(async () => container.querySelector('[data-testid=delete-confirm-accept]').click());

    expect(container.querySelector('[data-testid=delete-guard-small]').textContent)
      .toContain('settings.modelsSection.deleteGuard.inQueue');
  });

  // CRITICAL (fix post-review PR2): antes solo se manejaba `result.reason`
  // (los 2 guard reasons). Un fallo de spawn/proceso/protocolo stdout
  // (`{ ok:false, error }`, sin `reason`) se descartaba en silencio.
  it('shows a generic delete-error message (not silently dropped) when remove() fails without a guard reason', async () => {
    const remove = vi.fn().mockResolvedValue({ ok: false, error: 'spawn-failed' });
    ({ container, root } = await renderModelsSection({ remove }));

    await act(async () => container.querySelector('[data-testid=delete-btn-small]').click());
    await act(async () => container.querySelector('[data-testid=delete-confirm-accept]').click());

    expect(remove).toHaveBeenCalledWith('small');
    expect(container.querySelector('[data-testid=delete-guard-small]')).toBeNull();
    const errorEl = container.querySelector('[data-testid=delete-error-small]');
    expect(errorEl).not.toBeNull();
    expect(errorEl.textContent).toContain('settings.modelsSection.confirm.deleteError');
  });
});

describe('ModelsSection — carga inicial: resources.list() sin manejo de error (CRITICAL, fix post-review PR2)', () => {
  let root; let container;
  afterEach(() => { root?.unmount(); container?.remove(); delete window.electronAPI; });

  it('shows a load-error message with a retry option instead of staying blank forever when resources.list() rejects', async () => {
    const list = vi.fn().mockRejectedValue(new Error('IPC no disponible'));
    ({ container, root } = await renderModelsSection({ list }));

    const errorPanel = container.querySelector('[data-testid=models-list-error]');
    expect(errorPanel).not.toBeNull();
    expect(errorPanel.textContent).toContain('settings.modelsSection.loadError');

    const retryBtn = container.querySelector('[data-testid=models-list-retry]');
    expect(retryBtn).not.toBeNull();

    // Reintentar vuelve a llamar a resources.list(); si esta vez resuelve,
    // el listado se pobla y el panel de error desaparece.
    list.mockResolvedValueOnce(makeSnapshot());
    await act(async () => retryBtn.click());

    expect(list).toHaveBeenCalledTimes(2);
    expect(container.querySelector('[data-testid=models-list-error]')).toBeNull();
    expect(container.querySelector('[data-testid=model-row-tiny]')).not.toBeNull();
  });
});
