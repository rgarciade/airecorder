import { describe, expect, it, vi } from 'vitest';
import { fetchModelCatalog, computeWhisperModelOptions } from '../../../pages/Settings/whisperModelCatalog.js';

// INV1/INV6 — el catálogo de modelos Whisper debe venir del IPC `resources.list()`,
// no de una lista estática hardcodeada (design.md D10, tasks.md PR2 Fase 1).

describe('fetchModelCatalog', () => {
  it('returns the items from a successful resources.list() IPC call', async () => {
    const items = [
      { id: 'small', repoId: 'Systran/faster-whisper-small', estimatedBytes: 486_212_372, state: 'installed', recommended: true },
      { id: 'tiny', repoId: 'Systran/faster-whisper-tiny', estimatedBytes: 78_203_619, state: 'not-installed', recommended: false },
    ];
    const electronAPI = { resources: { list: vi.fn().mockResolvedValue({ ok: true, items }) } };

    const result = await fetchModelCatalog(electronAPI);

    expect(electronAPI.resources.list).toHaveBeenCalledTimes(1);
    expect(result).toEqual(items);
  });

  it('degrades to an empty array when the IPC call fails (not available in this window/context)', async () => {
    const electronAPI = { resources: { list: vi.fn().mockRejectedValue(new Error('no ipc')) } };

    const result = await fetchModelCatalog(electronAPI);

    expect(result).toEqual([]);
  });

  it('degrades to an empty array when window.electronAPI.resources is not exposed', async () => {
    const result = await fetchModelCatalog(undefined);
    expect(result).toEqual([]);
  });

  it('degrades to an empty array when the handler responds ok:false', async () => {
    const electronAPI = { resources: { list: vi.fn().mockResolvedValue({ ok: false, error: 'boom' }) } };

    const result = await fetchModelCatalog(electronAPI);

    expect(result).toEqual([]);
  });
});

describe('computeWhisperModelOptions', () => {
  const t = (key) => `translated:${key}`;

  it('maps catalog items to {value,label} options using the catalog id, not a hardcoded list', () => {
    const catalogItems = [
      { id: 'small', recommended: true },
      { id: 'medium', recommended: false },
    ];

    const options = computeWhisperModelOptions(catalogItems, t);

    expect(options).toEqual([
      { value: 'small', label: 'translated:settings.whisperModels.small' },
      { value: 'medium', label: 'translated:settings.whisperModels.medium' },
    ]);
  });

  it('returns an empty array for an empty or missing catalog', () => {
    expect(computeWhisperModelOptions([], t)).toEqual([]);
    expect(computeWhisperModelOptions(undefined, t)).toEqual([]);
  });
});
