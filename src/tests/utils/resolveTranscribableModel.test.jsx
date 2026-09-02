import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveTranscribableModel } from '../../utils/resolveTranscribableModel.js';

/**
 * resolveTranscribableModel — lógica compartida por los puntos de la app
 * que disparan una transcripción de forma implícita, sin selector propio
 * (Home.jsx L243/478, RecordingOverlay.jsx L228 — INV6): resuelve el modelo
 * Whisper por defecto de `settings.whisperModel` y confirma si está
 * instalado ANTES de encolar nada, replicando en la UI el mismo criterio
 * que ya aplica `transcriptionManager.addTask()` en el backend (PR1).
 *
 * Testeada con inyección de dependencias (Extract-Before-Mock, strict-tdd.md)
 * en vez de montar `Home.jsx`/`RecordingOverlay.jsx` completos, que
 * arrastran 7+ servicios externos (recordingsService, providerRouter,
 * audioService, ai/*, etc.) — violaría la regla de higiene de mocks.
 */
describe('resolveTranscribableModel (INV6)', () => {
  afterEach(() => {
    delete window.electronAPI;
  });

  it('resolves settings.whisperModel and reports installed=true when the resource inventory has it installed', async () => {
    const getSettings = vi.fn().mockResolvedValue({ whisperModel: 'medium' });
    const listResources = vi.fn().mockResolvedValue({
      ok: true,
      items: [{ id: 'medium', state: 'installed' }, { id: 'small', state: 'not-installed' }],
    });

    const result = await resolveTranscribableModel({ getSettings, listResources });
    expect(result).toEqual({ modelId: 'medium', installed: true });
  });

  it('falls back to "small" when settings.whisperModel is unset', async () => {
    const getSettings = vi.fn().mockResolvedValue({});
    const listResources = vi.fn().mockResolvedValue({
      ok: true,
      items: [{ id: 'small', state: 'installed' }],
    });

    const result = await resolveTranscribableModel({ getSettings, listResources });
    expect(result.modelId).toBe('small');
    expect(result.installed).toBe(true);
  });

  it('reports installed=false when the resolved model is not in the installed set (blocks enqueue)', async () => {
    const getSettings = vi.fn().mockResolvedValue({ whisperModel: 'large-v3' });
    const listResources = vi.fn().mockResolvedValue({
      ok: true,
      items: [{ id: 'small', state: 'installed' }],
    });

    const result = await resolveTranscribableModel({ getSettings, listResources });
    expect(result).toEqual({ modelId: 'large-v3', installed: false });
  });

  it('fails closed (installed=false) instead of throwing when the inventory IPC call rejects', async () => {
    const getSettings = vi.fn().mockResolvedValue({ whisperModel: 'small' });
    const listResources = vi.fn().mockRejectedValue(new Error('no ipc'));

    const result = await resolveTranscribableModel({ getSettings, listResources });
    expect(result).toEqual({ modelId: 'small', installed: false });
  });

  it('fails closed (installed=false) when the inventory call returns ok:false', async () => {
    const getSettings = vi.fn().mockResolvedValue({ whisperModel: 'small' });
    const listResources = vi.fn().mockResolvedValue({ ok: false });

    const result = await resolveTranscribableModel({ getSettings, listResources });
    expect(result).toEqual({ modelId: 'small', installed: false });
  });

  it('defaults listResources to window.electronAPI.resources.list when not injected', async () => {
    const getSettings = vi.fn().mockResolvedValue({ whisperModel: 'small' });
    const list = vi.fn().mockResolvedValue({ ok: true, items: [{ id: 'small', state: 'installed' }] });
    window.electronAPI = { resources: { list } };

    const result = await resolveTranscribableModel({ getSettings });
    expect(list).toHaveBeenCalledTimes(1);
    expect(result.installed).toBe(true);
  });
});
