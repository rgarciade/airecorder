import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const t = (key, opts) => (opts ? `${key}:${JSON.stringify(opts)}` : key);
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t }) }));

const dispatchMock = vi.fn();
vi.mock('react-redux', () => ({ useDispatch: () => dispatchMock }));

// `RecordingOverlay` llama `getSettings()` en un `useEffect` de montaje —
// mockeado para que el montaje real sea silencioso/determinístico, sin
// necesitar `window.electronAPI` (no relacionado con lo que prueba este
// archivo: la composición del stack, no la lógica interna del overlay).
vi.mock('../../services/settingsService', () => ({
  getSettings: vi.fn().mockResolvedValue({ enableDiarization: false, autoTranscribe: false }),
}));

const { default: BottomLeftStack } = await import('../../components/BottomLeftStack/BottomLeftStack.jsx');
const { default: RecordingOverlay } = await import('../../components/RecordingOverlay/RecordingOverlay.jsx');
const overlayStyles = (await import('../../components/RecordingOverlay/RecordingOverlay.module.css')).default;
const { default: DownloadIndicator } = await import('../../components/DownloadIndicator/DownloadIndicator.jsx');

async function renderStack(children) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<BottomLeftStack>{children}</BottomLeftStack>));
  return { container, root };
}

function findByClass(root, className) {
  return Array.from(root.querySelectorAll('*')).find((el) => el.classList.contains(className));
}

describe('BottomLeftStack — Fase 3.1: contenedor column-reverse compartido (IND6)', () => {
  let root; let container;
  afterEach(() => { root?.unmount(); container?.remove(); });

  it('renders all children simultaneously inside a single shared stack container', async () => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);

    await act(async () => root.render(
      <BottomLeftStack>
        <div data-testid="recording-overlay-stub">overlay</div>
        <div data-testid="download-indicator-stub">bocadillo</div>
      </BottomLeftStack>
    ));

    const stack = container.querySelector('[data-testid=bottom-left-stack]');
    expect(stack).not.toBeNull();
    expect(stack.querySelector('[data-testid=recording-overlay-stub]')).not.toBeNull();
    expect(stack.querySelector('[data-testid=download-indicator-stub]')).not.toBeNull();

    // El bocadillo debe quedar DESPUÉS del overlay en el orden de fuente —
    // con `flex-direction: column-reverse` (D9) eso lo coloca visualmente
    // ENCIMA del overlay (el primer hijo en DOM queda al fondo del stack).
    const children = Array.from(stack.children).map((el) => el.dataset.testid);
    expect(children).toEqual(['recording-overlay-stub', 'download-indicator-stub']);
  });

  it('renders correctly with a single child (no recording in progress)', async () => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);

    await act(async () => root.render(
      <BottomLeftStack>
        <div data-testid="download-indicator-stub">bocadillo</div>
      </BottomLeftStack>
    ));

    const stack = container.querySelector('[data-testid=bottom-left-stack]');
    expect(stack.children.length).toBe(1);
    expect(stack.querySelector('[data-testid=download-indicator-stub]')).not.toBeNull();
  });
});

// CRITICAL post-review (Fix 1): la composición REAL (`RecordingOverlay`
// `inStack` + `DownloadIndicator` como hijos reales de `BottomLeftStack`,
// no stubs genéricos) no tenía ningún test — la coexistencia de IND6
// (design.md D9) solo estaba verificada por lectura manual. Cubre los 3
// escenarios: solo grabación, solo descarga, ambas a la vez.
describe('BottomLeftStack — composición REAL con RecordingOverlay + DownloadIndicator (IND6, CRITICAL fix pass PR4)', () => {
  let root; let container;
  afterEach(() => {
    root?.unmount();
    container?.remove();
    delete window.electronAPI;
    vi.clearAllMocks();
  });

  it('solo grabación activa: RecordingOverlay (inStack) es el único hijo, con la clase inStack neutralizando su posicionamiento propio', async () => {
    ({ container, root } = await renderStack(
      <RecordingOverlay inStack recorder={null} onFinish={vi.fn()} />
    ));

    const stack = container.querySelector('[data-testid=bottom-left-stack]');
    expect(stack.children.length).toBe(1);

    const overlay = findByClass(stack, overlayStyles.overlay);
    expect(overlay).not.toBeUndefined();
    // La clase modificadora `inStack` (RecordingOverlay.module.css) es la
    // que neutraliza `position/bottom/left/z-index` propios para participar
    // del layout flex compartido — sin ella el overlay se superpondría al
    // bocadillo en vez de convivir (D9).
    expect(overlay.classList.contains(overlayStyles.inStack)).toBe(true);

    expect(stack.querySelector('[data-testid=download-indicator]')).toBeNull();
  });

  it('solo descarga activa: DownloadIndicator es el único hijo', async () => {
    ({ container, root } = await renderStack(
      <DownloadIndicator
        items={[]}
        queue={[{ id: 'small', state: 'downloading', receivedBytes: 1, totalBytes: 100, percent: 42, position: 1, total: 1 }]}
        active={{ id: 'small', state: 'downloading', receivedBytes: 1, totalBytes: 100, percent: 42, position: 1, total: 1 }}
        batchTotal={1}
        batchDone={0}
        onClose={vi.fn()}
        onNavigateToSettings={vi.fn()}
      />
    ));

    const stack = container.querySelector('[data-testid=bottom-left-stack]');
    expect(stack.children.length).toBe(1);
    expect(stack.querySelector('[data-testid=download-indicator]')).not.toBeNull();
    expect(findByClass(stack, overlayStyles.overlay)).toBeUndefined();
  });

  it('ambas a la vez: RecordingOverlay (inStack, primero en el DOM) y DownloadIndicator (segundo) conviven sin superponerse', async () => {
    ({ container, root } = await renderStack(
      <>
        <RecordingOverlay inStack recorder={null} onFinish={vi.fn()} />
        <DownloadIndicator
          items={[]}
          queue={[{ id: 'small', state: 'downloading', receivedBytes: 1, totalBytes: 100, percent: 10, position: 1, total: 1 }]}
          active={{ id: 'small', state: 'downloading', receivedBytes: 1, totalBytes: 100, percent: 10, position: 1, total: 1 }}
          batchTotal={1}
          batchDone={0}
          onClose={vi.fn()}
          onNavigateToSettings={vi.fn()}
        />
      </>
    ));

    const stack = container.querySelector('[data-testid=bottom-left-stack]');
    expect(stack.children.length).toBe(2);

    // Orden de fuente (design.md D9): RecordingOverlay PRIMERO — con
    // `column-reverse` eso lo deja al fondo visual y el bocadillo ENCIMA.
    const overlay = stack.children[0];
    const indicator = stack.children[1];
    expect(overlay.classList.contains(overlayStyles.overlay)).toBe(true);
    expect(overlay.classList.contains(overlayStyles.inStack)).toBe(true);
    expect(indicator.dataset.testid).toBe('download-indicator');

    // Ambos montados simultáneamente, sin que uno reemplace al otro.
    expect(findByClass(stack, overlayStyles.overlay)).not.toBeUndefined();
    expect(stack.querySelector('[data-testid=download-indicator]')).not.toBeNull();
  });
});
