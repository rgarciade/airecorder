import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// CRITICAL post-review (Fix 2): el wiring de INV6 en `RecordingOverlay.jsx`
// (`handleSaveDetails` — auto-transcripción tras "Guardar y salir") no
// tenía ningún test de integración; solo la lógica PURA reutilizada
// (`resolveTranscribableModel`, `whisperModelGuard.js`) estaba cubierta.
// Este archivo monta el componente REAL y ejercita ambos caminos: modelo
// instalado (encola) y no instalado (Deviation #2 — `console.warn`, SIN
// diálogo bloqueante, a diferencia de `Home.jsx`).

const t = (key, opts) => (opts ? `${key}:${JSON.stringify(opts)}` : key);
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t }) }));

const dispatchMock = vi.fn();
vi.mock('react-redux', () => ({ useDispatch: () => dispatchMock }));

let settingsOverrides = {};
vi.mock('../../services/settingsService', () => ({
  getSettings: vi.fn(async () => ({
    enableDiarization: false,
    autoTranscribe: true,
    whisperModel: 'small',
    ...settingsOverrides,
  })),
}));

vi.mock('../../services/recordingsService', () => ({
  default: {
    renameRecording: vi.fn().mockResolvedValue(null),
    saveExtraInstructions: vi.fn().mockResolvedValue(null),
    transcribeRecording: vi.fn().mockResolvedValue({ success: true }),
  },
}));

vi.mock('../../services/projectsService', () => ({
  default: { addRecordingToProject: vi.fn().mockResolvedValue(null) },
}));

const { default: RecordingOverlay } = await import('../../components/RecordingOverlay/RecordingOverlay.jsx');
const recordingOverlayStyles = (await import('../../components/RecordingOverlay/RecordingOverlay.module.css')).default;
const { default: recordingsService } = await import('../../services/recordingsService');

function findByClass(root, className) {
  return Array.from(root.querySelectorAll('*')).find((el) => el.classList.contains(className));
}

async function renderOverlay(props = {}) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const onFinish = props.onFinish || vi.fn();
  const recorder = props.recorder || { stopAndSave: vi.fn().mockResolvedValue({ dbId: 42 }) };
  await act(async () => root.render(<RecordingOverlay recorder={recorder} onFinish={onFinish} />));
  return { container, root, onFinish, recorder };
}

// Lleva el componente desde la cápsula minimizada hasta el modal de
// detalles (`showDetailsDialog`), simulando el flujo real "detener y
// guardar" — usa timers reales (el `setTimeout(1500)` de `handleSave` es
// interno, no configurable por props).
async function stopAndOpenDetailsDialog(container) {
  const stopBtn = findByClass(container, recordingOverlayStyles.btnStopRound);
  await act(async () => {
    stopBtn.click();
    // Flush del `await recorder.stopAndSave(...)` + espera real del
    // `setTimeout(..., 1500)` que abre el modal de detalles.
    await new Promise((resolve) => setTimeout(resolve, 1600));
  });
}

describe('RecordingOverlay — wiring INV6 en handleSaveDetails (CRITICAL fix pass PR4)', () => {
  let root; let container;
  afterEach(() => {
    root?.unmount();
    container?.remove();
    delete window.electronAPI;
    settingsOverrides = {};
    vi.clearAllMocks();
  });

  it('camino feliz: modelo instalado → encola la auto-transcripción al guardar', async () => {
    window.electronAPI = {
      resources: { list: vi.fn().mockResolvedValue({ ok: true, items: [{ id: 'small', state: 'installed' }] }) },
    };
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    ({ container, root } = await renderOverlay());
    await stopAndOpenDetailsDialog(container);

    const saveBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent.includes('recordingOverlay.saveAndExit')
    );
    expect(saveBtn).not.toBeUndefined();

    await act(async () => {
      saveBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(recordingsService.transcribeRecording).toHaveBeenCalledWith(42, 'small', { skipDiarization: false });
    expect(warnSpy).not.toHaveBeenCalled();
  }, 10000);

  it('camino sin-modelo-instalado: omite el encolado con console.warn, SIN diálogo bloqueante (Deviation #2)', async () => {
    window.electronAPI = {
      resources: { list: vi.fn().mockResolvedValue({ ok: true, items: [{ id: 'small', state: 'not-installed' }] }) },
    };
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    ({ container, root } = await renderOverlay());
    await stopAndOpenDetailsDialog(container);

    const saveBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent.includes('recordingOverlay.saveAndExit')
    );

    await act(async () => {
      saveBtn.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(recordingsService.transcribeRecording).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      '[RecordingOverlay] Auto-transcripción omitida: el modelo Whisper por defecto no está instalado.'
    );
    // Deviation #2 (apply-progress): a diferencia de Home.jsx, este disparo
    // automático NUNCA interrumpe el flujo de guardado con un `confirm`.
    expect(confirmSpy).not.toHaveBeenCalled();
  }, 10000);
});
