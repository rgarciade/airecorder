import { afterEach, describe, expect, it, vi } from 'vitest';
import { getSettings } from '../../services/settingsService.js';

/**
 * PR4, Fase 5.1: `whisperModel: 'small'` en los defaults de `getSettings()`
 * (INV6 — con la migración `large`→`large-v3` de PR1 y el hardening de los
 * 4 selectores de PR4, el fallback ya no puede quedar `undefined`: los
 * puntos que resuelven el modelo implícitamente — `Home.jsx`,
 * `RecordingOverlay.jsx` — necesitan un id concreto para poder consultar el
 * inventario).
 */
describe('settingsService.getSettings — defaults (PR4, Fase 5.1)', () => {
  afterEach(() => {
    delete window.electronAPI;
  });

  it('defaults whisperModel to "small" when window.electronAPI.loadSettings resolves without saved settings', async () => {
    window.electronAPI = {
      loadSettings: vi.fn().mockResolvedValue({ success: true, settings: null }),
    };

    const settings = await getSettings();
    expect(settings.whisperModel).toBe('small');
  });
});
