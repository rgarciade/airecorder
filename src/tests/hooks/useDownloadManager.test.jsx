import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const { useDownloadManager } = await import('../../hooks/useDownloadManager.js');

function makeSnapshot(overrides = {}) {
  return {
    ok: true,
    cacheDir: '/fake/cache',
    freeBytes: 20 * 1024 ** 3,
    totalBytes: 100 * 1024 ** 3,
    items: [],
    queue: [],
    active: null,
    ...overrides,
  };
}

let capturedHook;
function HookProbe() {
  capturedHook = useDownloadManager();
  return null;
}

async function renderHook({ getQueue, onProgress } = {}) {
  let progressListener;
  const unsubscribe = vi.fn();
  window.electronAPI = {
    resources: {
      getQueue: getQueue || vi.fn().mockResolvedValue(makeSnapshot()),
      onProgress: onProgress || vi.fn((listener) => {
        progressListener = listener;
        return unsubscribe;
      }),
      retry: vi.fn().mockResolvedValue({ ok: true }),
      cancel: vi.fn().mockResolvedValue({ ok: true }),
    },
  };
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<HookProbe />));
  return { container, root, unsubscribe, getProgressListener: () => progressListener };
}

describe('useDownloadManager (PR4, Fase 1)', () => {
  let root;
  let container;

  afterEach(() => {
    root?.unmount();
    container?.remove();
    delete window.electronAPI;
    capturedHook = undefined;
    vi.clearAllMocks();
  });

  it('pulls the initial snapshot via resources.getQueue() on mount (IND1, DL2)', async () => {
    const getQueue = vi.fn().mockResolvedValue(makeSnapshot({
      queue: [{ id: 'small', state: 'downloading', receivedBytes: 1, totalBytes: 100, percent: 42, position: 1, total: 1 }],
      active: { id: 'small', state: 'downloading', receivedBytes: 1, totalBytes: 100, percent: 42, position: 1, total: 1 },
    }));
    ({ container, root } = await renderHook({ getQueue }));

    expect(getQueue).toHaveBeenCalledTimes(1);
    expect(capturedHook.active?.id).toBe('small');
    expect(capturedHook.visible).toBe(true);
  });

  it('subscribes to resources.onProgress() and unsubscribes on unmount (DL2)', async () => {
    let unsub;
    ({ container, root, unsubscribe: unsub } = await renderHook());
    expect(unsub).not.toHaveBeenCalled();

    await act(async () => root.unmount());
    root = null;
    expect(unsub).toHaveBeenCalledTimes(1);
  });

  it('is not visible when there are no active/queued/errored downloads', async () => {
    ({ container, root } = await renderHook());
    expect(capturedHook.visible).toBe(false);
    expect(capturedHook.items).toEqual([]);
    expect(capturedHook.queue).toEqual([]);
  });

  it('close() hides the indicator without calling resources.cancel() (IND4)', async () => {
    const getQueue = vi.fn().mockResolvedValue(makeSnapshot({
      queue: [{ id: 'small', state: 'downloading', receivedBytes: 1, totalBytes: 100, percent: 10, position: 1, total: 1 }],
      active: { id: 'small', state: 'downloading', receivedBytes: 1, totalBytes: 100, percent: 10, position: 1, total: 1 },
    }));
    ({ container, root } = await renderHook({ getQueue }));
    expect(capturedHook.visible).toBe(true);

    await act(async () => capturedHook.close());
    expect(capturedHook.visible).toBe(false);
    expect(window.electronAPI.resources.cancel).not.toHaveBeenCalled();
  });

  it('auto-hides once all tracked downloads finish successfully (IND5)', async () => {
    let listener;
    const onProgress = vi.fn((cb) => { listener = cb; return vi.fn(); });
    const getQueue = vi.fn().mockResolvedValue(makeSnapshot({
      queue: [{ id: 'small', state: 'downloading', receivedBytes: 1, totalBytes: 100, percent: 50, position: 1, total: 1 }],
      active: { id: 'small', state: 'downloading', receivedBytes: 1, totalBytes: 100, percent: 50, position: 1, total: 1 },
    }));
    ({ container, root } = await renderHook({ getQueue, onProgress }));
    expect(capturedHook.visible).toBe(true);

    await act(async () => listener(makeSnapshot({
      items: [{ id: 'small', state: 'installed', repoId: 'r-small', estimatedBytes: 1, installedBytes: 1, path: '/x', recommended: true, error: null }],
      queue: [],
      active: null,
    })));

    expect(capturedHook.visible).toBe(false);
  });

  it('stays visible with an actionable error when one of the tracked downloads fails, even after another one finishes (IND5)', async () => {
    let listener;
    const onProgress = vi.fn((cb) => { listener = cb; return vi.fn(); });
    const getQueue = vi.fn().mockResolvedValue(makeSnapshot({
      queue: [
        { id: 'small', state: 'downloading', receivedBytes: 1, totalBytes: 100, percent: 50, position: 1, total: 2 },
        { id: 'medium', state: 'queued', receivedBytes: 0, totalBytes: null, percent: 0, position: 2, total: 2 },
      ],
      active: { id: 'small', state: 'downloading', receivedBytes: 1, totalBytes: 100, percent: 50, position: 1, total: 2 },
    }));
    ({ container, root } = await renderHook({ getQueue, onProgress }));

    await act(async () => listener(makeSnapshot({
      items: [
        { id: 'small', state: 'installed', repoId: 'r-small', estimatedBytes: 1, installedBytes: 1, path: '/x', recommended: true, error: null },
        { id: 'medium', state: 'error', repoId: 'r-medium', estimatedBytes: 1, installedBytes: null, path: null, recommended: false, error: { code: 'network' } },
      ],
      queue: [],
      active: null,
    })));

    expect(capturedHook.visible).toBe(true);
    expect(capturedHook.items.find((i) => i.id === 'medium')?.state).toBe('error');

    // BUG FIX (post-review): `batchDone` cuenta SOLO éxitos reales
    // (`installed`) — el ítem que terminó en `error` sigue contando en
    // `batchTotal` pero NO en `batchDone`, para que "N de M" no infle el
    // numerador con descargas que en realidad fallaron.
    expect(capturedHook.batchTotal).toBe(2);
    expect(capturedHook.batchDone).toBe(1);
  });

  it('a brand new download re-opens the indicator even after it was closed (IND1 over a previous close)', async () => {
    let listener;
    const onProgress = vi.fn((cb) => { listener = cb; return vi.fn(); });
    const getQueue = vi.fn().mockResolvedValue(makeSnapshot({
      queue: [{ id: 'small', state: 'downloading', receivedBytes: 1, totalBytes: 100, percent: 10, position: 1, total: 1 }],
      active: { id: 'small', state: 'downloading', receivedBytes: 1, totalBytes: 100, percent: 10, position: 1, total: 1 },
    }));
    ({ container, root } = await renderHook({ getQueue, onProgress }));

    await act(async () => capturedHook.close());
    expect(capturedHook.visible).toBe(false);

    await act(async () => listener(makeSnapshot({
      queue: [
        { id: 'small', state: 'downloading', receivedBytes: 2, totalBytes: 100, percent: 20, position: 1, total: 2 },
        { id: 'medium', state: 'queued', receivedBytes: 0, totalBytes: null, percent: 0, position: 2, total: 2 },
      ],
      active: { id: 'small', state: 'downloading', receivedBytes: 2, totalBytes: 100, percent: 20, position: 1, total: 2 },
    })));

    expect(capturedHook.visible).toBe(true);
  });
});
