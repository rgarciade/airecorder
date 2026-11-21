import React from 'react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const generateFromTemplate = vi.fn();
vi.mock('../../services/noteTemplateService', () => ({ generateFromTemplate: (...a) => generateFromTemplate(...a) }));

const { noteGenerationStore } = await import('../../services/noteGenerationStore');
const { useNoteGeneration } = await import('../../hooks/useNoteGeneration.js');

describe('useNoteGeneration', () => {
  let root, container, api;

  function Harness({ recordingId }) {
    api = useNoteGeneration(recordingId);
    return null;
  }
  async function mount(recordingId) {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    await act(async () => root.render(<Harness recordingId={recordingId} />));
  }

  beforeEach(() => {
    vi.clearAllMocks();
    noteGenerationStore.reset();
  });
  afterEach(() => { root?.unmount(); container?.remove(); });

  it('reflects a generation started elsewhere (survives remount)', async () => {
    let resolve;
    generateFromTemplate.mockImplementation(() => new Promise((r) => { resolve = r; }));
    await mount(1);
    await act(async () => { noteGenerationStore.start({ recordingId: 1, templateSlug: 'a' }); });
    expect(api.isGenerating).toBe(true);

    // navegar fuera y volver: nuevo montaje, la generación sigue
    root.unmount();
    await mount(1);
    expect(api.isGenerating).toBe(true);

    await act(async () => { resolve({ noteId: 1 }); });
    expect(api.isGenerating).toBe(false);
    expect(api.completedCount).toBe(1);
  });

  it('start/cancel/dismissError delegate to the store for this recording', async () => {
    generateFromTemplate.mockRejectedValue(new Error('boom'));
    await mount(2);
    await act(async () => { await api.start('a'); });
    expect(api.error).toBe('boom');
    await act(async () => { api.dismissError(); });
    expect(api.error).toBeNull();
  });

  it('does not leak state between recordings', async () => {
    generateFromTemplate.mockImplementation(() => new Promise(() => {}));
    await mount(3);
    await act(async () => { noteGenerationStore.start({ recordingId: 99, templateSlug: 'a' }); });
    expect(api.isGenerating).toBe(false);
  });
});
