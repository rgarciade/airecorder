import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const { useModelDownloadStep } = await import('../../../pages/Onboarding/useModelDownloadStep.js');

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

let capturedHook;
function HookProbe({ onDownloadStart }) {
  capturedHook = useModelDownloadStep({ onDownloadStart });
  return null;
}

async function renderHook({ list, onProgress, download, onDownloadStart } = {}) {
  let progressListener;
  const unsubscribe = vi.fn();
  window.electronAPI = {
    resources: {
      list: list || vi.fn().mockResolvedValue(makeSnapshot()),
      onProgress: onProgress || vi.fn((listener) => {
        progressListener = listener;
        return unsubscribe;
      }),
      download: download || vi.fn().mockResolvedValue({ ok: true }),
    },
  };
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<HookProbe onDownloadStart={onDownloadStart} />));
  return { container, root, unsubscribe, getProgressListener: () => progressListener };
}

describe('useModelDownloadStep (PR3, Fase 1)', () => {
  let root;
  let container;

  afterEach(() => {
    root?.unmount();
    container?.remove();
    delete window.electronAPI;
    capturedHook = undefined;
    vi.clearAllMocks();
  });

  it('preselects "small" as the initial selected model (ONB2)', async () => {
    ({ container, root } = await renderHook());
    expect(capturedHook.selectedId).toBe('small');
  });

  it('exposes selectModel, startDownload, status and startError', async () => {
    ({ container, root } = await renderHook());
    expect(typeof capturedHook.selectModel).toBe('function');
    expect(typeof capturedHook.startDownload).toBe('function');
    expect(capturedHook.status).toBe('ready');
    expect(capturedHook.startError).toBeNull();
  });

  it('selectModel updates the active selection, and startDownload uses the updated selection (ONB2)', async () => {
    const download = vi.fn().mockResolvedValue({ ok: true });
    ({ container, root } = await renderHook({ download }));

    await act(async () => capturedHook.selectModel('medium'));
    expect(capturedHook.selectedId).toBe('medium');

    await act(async () => capturedHook.startDownload());
    expect(download).toHaveBeenCalledWith('medium');
  });

  // BLOCKER, fix post-review PR3: el tracking de persistencia ONB4 se elevó
  // a `useOnboardingModelPersistence.js` (poseído por `Onboarding.jsx`) para
  // sobrevivir la navegación entre steps del wizard — ver su JSDoc y
  // `Onboarding.modelPersistence.test.jsx` para la cobertura de ese
  // comportamiento. Este hook ya no llama a `updateSettings`: solo notifica
  // que una descarga arrancó con éxito vía `onDownloadStart`.
  describe('onDownloadStart (notifica el arranque exitoso al nivel elevado — ONB4)', () => {
    it('calls onDownloadStart with the selected model id when the download starts successfully', async () => {
      const download = vi.fn().mockResolvedValue({ ok: true });
      const onDownloadStart = vi.fn();
      ({ container, root } = await renderHook({ download, onDownloadStart }));

      await act(async () => capturedHook.startDownload());
      expect(onDownloadStart).toHaveBeenCalledWith('small');
      expect(onDownloadStart).toHaveBeenCalledTimes(1);
    });

    it('does not call onDownloadStart when the download fails to start (ok: false)', async () => {
      const download = vi.fn().mockResolvedValue({ ok: false, error: 'insufficient-space' });
      const onDownloadStart = vi.fn();
      ({ container, root } = await renderHook({ download, onDownloadStart }));

      await act(async () => capturedHook.startDownload());
      expect(onDownloadStart).not.toHaveBeenCalled();
    });
  });

  // BLOCKER, fix post-review PR3: `startDownload()` descartaba en silencio
  // un `{ ok: false }` síncrono de `resources:download` (p. ej.
  // `insufficient-space`, que ocurre ANTES de encolar nada y por lo tanto
  // nunca pasa por el estado de error por ítem que cubre `processQueue()`).
  describe('startError (fallo síncrono de resources:download — BLOCKER, fix post-review PR3)', () => {
    it('sets startError with the error code when resources:download resolves { ok: false }', async () => {
      const download = vi.fn().mockResolvedValue({ ok: false, error: 'insufficient-space' });
      ({ container, root } = await renderHook({ download }));

      await act(async () => capturedHook.startDownload());
      expect(capturedHook.startError).toEqual({ code: 'insufficient-space' });
    });

    it('clears startError on a subsequent successful startDownload (retry)', async () => {
      const download = vi.fn()
        .mockResolvedValueOnce({ ok: false, error: 'insufficient-space' })
        .mockResolvedValueOnce({ ok: true });
      ({ container, root } = await renderHook({ download }));

      await act(async () => capturedHook.startDownload());
      expect(capturedHook.startError).toEqual({ code: 'insufficient-space' });

      await act(async () => capturedHook.startDownload());
      expect(capturedHook.startError).toBeNull();
    });
  });

  // CRITICAL, fix post-review PR3: no había cobertura del path de fallo de
  // carga del catálogo — el hook debía llegar a `status: 'error'` (no
  // quedarse colgado en 'loading') cuando `resources.list()` rechaza.
  describe('catalog load failure (ONB3 — CRITICAL, fix post-review PR3)', () => {
    it('reaches status "error" (not stuck in "loading") when resources.list() rejects', async () => {
      const list = vi.fn().mockRejectedValue(new Error('IPC unavailable'));
      ({ container, root } = await renderHook({ list }));

      expect(capturedHook.status).toBe('error');
    });
  });
});
