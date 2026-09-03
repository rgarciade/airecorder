import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, opts) => (opts ? `${key}:${JSON.stringify(opts)}` : key),
  }),
}));

const { default: DownloadIndicator } = await import('../../components/DownloadIndicator/DownloadIndicator.jsx');

function makeActive(overrides = {}) {
  return { id: 'small', state: 'downloading', receivedBytes: 1, totalBytes: 100, percent: 42, position: 1, total: 1, ...overrides };
}

async function renderIndicator(props = {}) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(
    <DownloadIndicator
      items={props.items || []}
      queue={props.queue || []}
      active={props.active ?? null}
      batchTotal={props.batchTotal ?? 0}
      batchDone={props.batchDone ?? 0}
      onClose={props.onClose || vi.fn()}
      onNavigateToSettings={props.onNavigateToSettings || vi.fn()}
    />
  ));
  return { container, root };
}

describe('DownloadIndicator — Fase 2.1: contraído muestra nombre + % (IND2)', () => {
  let root; let container;
  afterEach(() => { root?.unmount(); container?.remove(); delete window.electronAPI; });

  it('shows the active download name and percent when collapsed', async () => {
    ({ container, root } = await renderIndicator({
      active: makeActive(),
      queue: [makeActive()],
    }));

    const label = container.querySelector('[data-testid=download-indicator-active-label]');
    expect(label).not.toBeNull();
    expect(label.textContent).toContain('"model":"small"');
    expect(label.textContent).toContain('"percent":42');
  });
});

describe('DownloadIndicator — Fase 2.3: expandir (IND2)', () => {
  let root; let container;
  afterEach(() => { root?.unmount(); container?.remove(); delete window.electronAPI; });

  it('clicking the collapsed capsule expands it to show queue detail + "N de M" summary', async () => {
    ({ container, root } = await renderIndicator({
      active: makeActive(),
      queue: [makeActive(), { id: 'medium', state: 'queued', receivedBytes: 0, totalBytes: null, percent: 0, position: 2, total: 2 }],
      batchTotal: 2,
      batchDone: 0,
    }));

    expect(container.querySelector('[data-testid=download-indicator-expanded]')).toBeNull();

    await act(async () => container.querySelector('[data-testid=download-indicator]').click());

    const expanded = container.querySelector('[data-testid=download-indicator-expanded]');
    expect(expanded).not.toBeNull();
    expect(container.querySelector('[data-testid=download-indicator-row-small]')).not.toBeNull();
    expect(container.querySelector('[data-testid=download-indicator-row-medium]')).not.toBeNull();
    const summary = container.querySelector('[data-testid=download-indicator-summary]');
    expect(summary.textContent).toContain('"done":0');
    expect(summary.textContent).toContain('"total":2');
  });
});

describe('DownloadIndicator — Fase 2.5: click navega a Ajustes salvo el botón cerrar (IND3)', () => {
  let root; let container;
  afterEach(() => { root?.unmount(); container?.remove(); delete window.electronAPI; });

  it('clicking the expanded body navigates to Settings', async () => {
    const onNavigateToSettings = vi.fn();
    ({ container, root } = await renderIndicator({ active: makeActive(), queue: [makeActive()], onNavigateToSettings }));

    await act(async () => container.querySelector('[data-testid=download-indicator]').click()); // expand
    await act(async () => container.querySelector('[data-testid=download-indicator-expanded]').click());

    expect(onNavigateToSettings).toHaveBeenCalledTimes(1);
  });

  it('clicking the close button does NOT navigate to Settings', async () => {
    const onNavigateToSettings = vi.fn();
    const onClose = vi.fn();
    ({ container, root } = await renderIndicator({ active: makeActive(), queue: [makeActive()], onNavigateToSettings, onClose }));

    await act(async () => container.querySelector('[data-testid=download-indicator-close]').click());

    expect(onNavigateToSettings).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('DownloadIndicator — Fase 2.7: cerrar oculta sin cancelar (IND4)', () => {
  let root; let container;
  afterEach(() => { root?.unmount(); container?.remove(); delete window.electronAPI; });

  it('calls onClose (parent hides it) and never calls resources.cancel()', async () => {
    window.electronAPI = { resources: { cancel: vi.fn() } };
    const onClose = vi.fn();
    ({ container, root } = await renderIndicator({ active: makeActive(), queue: [makeActive()], onClose }));

    await act(async () => container.querySelector('[data-testid=download-indicator-close]').click());

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(window.electronAPI.resources.cancel).not.toHaveBeenCalled();
  });
});

describe('DownloadIndicator — reintentar descargas en error (transversal, DL4)', () => {
  let root; let container;
  afterEach(() => { root?.unmount(); container?.remove(); delete window.electronAPI; });

  it('shows an error summary when there is no active download but a tracked one failed, and retry calls resources.retry (not download)', async () => {
    const retry = vi.fn().mockResolvedValue({ ok: true });
    const download = vi.fn();
    window.electronAPI = { resources: { retry, download } };

    ({ container, root } = await renderIndicator({
      active: null,
      queue: [],
      items: [{ id: 'medium', state: 'error', repoId: 'r', estimatedBytes: 1, installedBytes: null, path: null, recommended: false, error: { code: 'network' } }],
      batchTotal: 1,
      batchDone: 1,
    }));

    expect(container.querySelector('[data-testid=download-indicator-error-label]')).not.toBeNull();

    await act(async () => container.querySelector('[data-testid=download-indicator]').click()); // expand
    await act(async () => container.querySelector('[data-testid=download-indicator-retry-medium]').click());

    expect(retry).toHaveBeenCalledWith('medium');
    expect(download).not.toHaveBeenCalled();
  });
});
