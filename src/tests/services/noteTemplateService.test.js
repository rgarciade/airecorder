import { beforeEach, describe, expect, it, vi } from 'vitest';

const callProvider = vi.fn();
vi.mock('../../services/ai/providerRouter.js', () => ({ callProvider: (...a) => callProvider(...a) }));

const { generateFromTemplate } = await import('../../services/noteTemplateService');

let api;
function setupApi() {
  const electronAPI = {
    templates: {
      getBySlug: vi.fn().mockResolvedValue({ name: 'Daily', sections_json: '[]', expert_id: 'general' }),
      saveNote: vi.fn().mockResolvedValue({ success: true, id: 3 }),
    },
    getTranscriptionTxt: vi.fn().mockResolvedValue({ success: true, text: 'hola' }),
    getAiSummary: vi.fn().mockResolvedValue(null),
  };
  vi.stubGlobal('window', { electronAPI });
  return electronAPI;
}

describe('generateFromTemplate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api = setupApi();
    callProvider.mockResolvedValue({ text: 'nota' });
  });

  it('merges the caller queueMeta into the queue task meta', async () => {
    await generateFromTemplate({ recordingId: 1, templateSlug: 'daily', queueMeta: { type: 'note', ref: 'note:1' } });
    expect(callProvider.mock.calls[0][1].queueMeta).toMatchObject({ type: 'note', ref: 'note:1', name: 'Generar notas: Daily' });
  });

  it('passes the abort signal to the queue so cancelling also works before the task is enqueued', async () => {
    const ac = new AbortController();
    await generateFromTemplate({ recordingId: 1, templateSlug: 'daily', signal: ac.signal });
    expect(callProvider.mock.calls[0][1].queueMeta.signal).toBe(ac.signal);
  });

  it('throws a cancelled error and does not call the provider if already aborted', async () => {
    const ac = new AbortController();
    ac.abort();
    await expect(generateFromTemplate({ recordingId: 1, templateSlug: 'daily', signal: ac.signal }))
      .rejects.toMatchObject({ cancelled: true });
    expect(callProvider).not.toHaveBeenCalled();
  });

  it('does not save the note if aborted while the provider was running', async () => {
    const ac = new AbortController();
    callProvider.mockImplementation(async () => { ac.abort(); return { text: 'nota' }; });
    await expect(generateFromTemplate({ recordingId: 1, templateSlug: 'daily', signal: ac.signal }))
      .rejects.toMatchObject({ cancelled: true });
    expect(api.templates.saveNote).not.toHaveBeenCalled();
  });
});
