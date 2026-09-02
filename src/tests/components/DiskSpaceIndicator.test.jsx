import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import DiskSpaceIndicator from '../../components/DiskSpaceIndicator/DiskSpaceIndicator.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, opts) => (opts ? `${key}:${JSON.stringify(opts)}` : key),
  }),
}));

// INV5 — DiskSpaceIndicator refresca (`resources.refresh()`) en CADA montaje,
// nunca muestra un valor stale heredado de una instancia anterior (design.md D10).

describe('DiskSpaceIndicator', () => {
  let root;
  let container;

  afterEach(() => {
    root?.unmount();
    container?.remove();
    delete window.electronAPI;
  });

  it('calls resources.refresh() on mount and renders free/total space', async () => {
    const refresh = vi.fn().mockResolvedValue({ ok: true, freeBytes: 10 * 1024 ** 3, totalBytes: 100 * 1024 ** 3 });
    window.electronAPI = { resources: { refresh } };

    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    await act(async () => root.render(<DiskSpaceIndicator />));

    expect(refresh).toHaveBeenCalledTimes(1);
    const text = container.querySelector('[data-testid=disk-space-values]').textContent;
    expect(text).toContain('"free":"10.0 GB"');
    expect(text).toContain('"total":"100.0 GB"');
  });

  it('re-fetches on every new mount instead of keeping a stale value from a previous mount', async () => {
    const refresh = vi.fn()
      .mockResolvedValueOnce({ ok: true, freeBytes: 10 * 1024 ** 3, totalBytes: 100 * 1024 ** 3 })
      .mockResolvedValueOnce({ ok: true, freeBytes: 5 * 1024 ** 3, totalBytes: 100 * 1024 ** 3 });
    window.electronAPI = { resources: { refresh } };

    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    await act(async () => root.render(<DiskSpaceIndicator />));
    expect(container.querySelector('[data-testid=disk-space-values]').textContent).toContain('"free":"10.0 GB"');

    // Desmontar y montar una instancia NUEVA (no un simple update) — simula
    // navegar fuera y volver a Ajustes → Modelos y descargas.
    await act(async () => root.unmount());
    root = createRoot(container);
    await act(async () => root.render(<DiskSpaceIndicator />));

    expect(refresh).toHaveBeenCalledTimes(2);
    expect(container.querySelector('[data-testid=disk-space-values]').textContent).toContain('"free":"5.0 GB"');
  });

  it('shows an "unavailable" message instead of crashing when statfsSync degraded to null (freeBytes/totalBytes null)', async () => {
    const refresh = vi.fn().mockResolvedValue({ ok: true, freeBytes: null, totalBytes: null });
    window.electronAPI = { resources: { refresh } };

    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    await act(async () => root.render(<DiskSpaceIndicator />));

    expect(container.querySelector('[data-testid=disk-space-values]')).toBeNull();
    expect(container.textContent).toContain('settings.diskSpace.unavailable');
  });

  it('shows an "unavailable" message when the IPC call rejects', async () => {
    const refresh = vi.fn().mockRejectedValue(new Error('no ipc'));
    window.electronAPI = { resources: { refresh } };

    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    await act(async () => root.render(<DiskSpaceIndicator />));

    expect(container.textContent).toContain('settings.diskSpace.unavailable');
  });
});
