import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const t = (key, opts) => (opts ? `${key}:${JSON.stringify(opts)}` : key);

const { default: ModelStep } = await import('../../../pages/Onboarding/ModelStep.jsx');

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

async function renderModelStep({ list, onProgress, download, onNext, onBack, onDownloadStart } = {}) {
  let progressListener;
  window.electronAPI = {
    resources: {
      list: list || vi.fn().mockResolvedValue(makeSnapshot()),
      onProgress: onProgress || vi.fn((listener) => { progressListener = listener; return vi.fn(); }),
      download: download || vi.fn().mockResolvedValue({ ok: true }),
    },
  };
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(
    <ModelStep
      t={t}
      onBack={onBack || vi.fn()}
      onNext={onNext || vi.fn()}
      StepProgressComponent={null}
      onDownloadStart={onDownloadStart}
    />
  ));
  return { container, root, getProgressListener: () => progressListener };
}

describe('ModelStep — Fase 2.1: catálogo visible + preselección (ONB1, ONB2)', () => {
  let root; let container;
  afterEach(() => { root?.unmount(); container?.remove(); delete window.electronAPI; });

  it('shows the model catalog with sizes/states, and "small" is preselected', async () => {
    ({ container, root } = await renderModelStep());

    expect(container.querySelector('[data-testid=model-option-tiny]')).not.toBeNull();
    expect(container.querySelector('[data-testid=model-option-small]')).not.toBeNull();
    expect(container.querySelector('[data-testid=model-option-medium]')).not.toBeNull();

    expect(container.querySelector('[data-testid=model-radio-small]').checked).toBe(true);
    expect(container.querySelector('[data-testid=model-radio-tiny]').checked).toBe(false);

    expect(container.querySelector('[data-testid=model-state-tiny]').textContent)
      .toContain('settings.modelsSection.states.notInstalled');
  });
});

describe('ModelStep — Fase 2.3: cambiar la selección (ONB2)', () => {
  let root; let container;
  afterEach(() => { root?.unmount(); container?.remove(); delete window.electronAPI; });

  it('changing the selection to "medium" updates the active model used by a later download', async () => {
    const download = vi.fn().mockResolvedValue({ ok: true });
    ({ container, root } = await renderModelStep({ download }));

    await act(async () => container.querySelector('[data-testid=model-radio-medium]').click());
    expect(container.querySelector('[data-testid=model-radio-medium]').checked).toBe(true);
    expect(container.querySelector('[data-testid=model-radio-small]').checked).toBe(false);

    await act(async () => container.querySelector('[data-testid=model-download-btn]').click());
    expect(download).toHaveBeenCalledWith('medium');
  });
});

describe('ModelStep — Fase 2.5: avance no bloqueante (ONB3)', () => {
  let root; let container;
  afterEach(() => { root?.unmount(); container?.remove(); delete window.electronAPI; });

  it('never disables the "next" button, regardless of download state', async () => {
    const onNext = vi.fn();
    ({ container, root } = await renderModelStep({ onNext }));

    const nextBtn = container.querySelector('[data-testid=model-step-next]');
    expect(nextBtn.disabled).toBe(false);

    await act(async () => nextBtn.click());
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('allows advancing even while a download is actively in progress', async () => {
    const list = vi.fn().mockResolvedValue(makeSnapshot({
      items: [
        { id: 'tiny', repoId: 'r-tiny', estimatedBytes: 78_000_000, state: 'not-installed', installedBytes: null, path: null, recommended: false, error: null },
        { id: 'small', repoId: 'r-small', estimatedBytes: 486_000_000, state: 'downloading', installedBytes: null, path: null, recommended: true, error: null },
        { id: 'medium', repoId: 'r-medium', estimatedBytes: 1_500_000_000, state: 'not-installed', installedBytes: null, path: null, recommended: false, error: null },
      ],
      queue: [{ id: 'small', state: 'downloading', receivedBytes: 1, totalBytes: 486_000_000, percent: 42, position: 1, total: 1 }],
      active: { id: 'small', state: 'downloading', receivedBytes: 1, totalBytes: 486_000_000, percent: 42, position: 1, total: 1 },
    }));
    const onNext = vi.fn();
    ({ container, root } = await renderModelStep({ list, onNext }));

    expect(container.querySelector('[data-testid=model-progress-small]').textContent).toContain('42');
    const nextBtn = container.querySelector('[data-testid=model-step-next]');
    expect(nextBtn.disabled).toBe(false);
    await act(async () => nextBtn.click());
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});

// BLOCKER, fix post-review PR3: `startDownload()` descartaba en silencio un
// `{ ok: false }` síncrono de `resources:download` (p. ej.
// `insufficient-space`) — el usuario no se enteraba de que la descarga
// nunca arrancó.
describe('ModelStep — fallo síncrono de resources:download (BLOCKER, fix post-review PR3)', () => {
  let root; let container;
  afterEach(() => { root?.unmount(); container?.remove(); delete window.electronAPI; });

  it('shows an actionable error message (not silent) and keeps the download button available to retry', async () => {
    const download = vi.fn().mockResolvedValue({ ok: false, error: 'insufficient-space' });
    ({ container, root } = await renderModelStep({ download }));

    expect(container.querySelector('[data-testid=model-start-error]')).toBeNull();

    await act(async () => container.querySelector('[data-testid=model-download-btn]').click());

    const errorEl = container.querySelector('[data-testid=model-start-error]');
    expect(errorEl).not.toBeNull();
    expect(errorEl.textContent).toContain('settings.modelsSection.errors.insufficientSpace');

    // El botón de descarga sigue disponible: el ítem nunca salió de
    // 'not-installed' porque `download()` nunca llegó a encolar nada.
    const retryBtn = container.querySelector('[data-testid=model-download-btn]');
    expect(retryBtn).not.toBeNull();

    await act(async () => retryBtn.click());
    expect(download).toHaveBeenCalledTimes(2);
  });

  it('does not call onDownloadStart when the download fails to start', async () => {
    const download = vi.fn().mockResolvedValue({ ok: false, error: 'unknown-model' });
    const onDownloadStart = vi.fn();
    ({ container, root } = await renderModelStep({ download, onDownloadStart }));

    await act(async () => container.querySelector('[data-testid=model-download-btn]').click());
    expect(onDownloadStart).not.toHaveBeenCalled();
  });
});

// BLOCKER, fix post-review PR3 (ONB4): `ModelStep` reenvía `onDownloadStart`
// al hook — la cobertura de que efectivamente sobrevive el desmontaje del
// step al navegar el wizard vive en `Onboarding.modelPersistence.test.jsx`
// (necesita `Onboarding.jsx` real montado, no solo `ModelStep` aislado).
describe('ModelStep — wiring de onDownloadStart hacia el nivel elevado (ONB4)', () => {
  let root; let container;
  afterEach(() => { root?.unmount(); container?.remove(); delete window.electronAPI; });

  it('calls onDownloadStart with the selected model id when a download starts successfully', async () => {
    const download = vi.fn().mockResolvedValue({ ok: true });
    const onDownloadStart = vi.fn();
    ({ container, root } = await renderModelStep({ download, onDownloadStart }));

    await act(async () => container.querySelector('[data-testid=model-download-btn]').click());
    expect(onDownloadStart).toHaveBeenCalledWith('small');
  });
});

// CRITICAL, fix post-review PR3: faltaba cobertura del path de fallo de
// carga del catálogo — ni el hook ni el componente tenían un test que
// ejerciera `resources.list()` rechazando.
describe('ModelStep — fallo de carga del catálogo (ONB3 — CRITICAL, fix post-review PR3)', () => {
  let root; let container;
  afterEach(() => { root?.unmount(); container?.remove(); delete window.electronAPI; });

  it('renders model-step-load-error and keeps the "next" button enabled when resources.list() rejects', async () => {
    const list = vi.fn().mockRejectedValue(new Error('IPC unavailable'));
    const onNext = vi.fn();
    ({ container, root } = await renderModelStep({ list, onNext }));

    const errorEl = container.querySelector('[data-testid=model-step-load-error]');
    expect(errorEl).not.toBeNull();
    expect(errorEl.textContent).toBe('onboarding.model.loadError');
    expect(container.querySelector('[data-testid=model-step-loading]')).toBeNull();

    const nextBtn = container.querySelector('[data-testid=model-step-next]');
    expect(nextBtn.disabled).toBe(false);
    await act(async () => nextBtn.click());
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});
