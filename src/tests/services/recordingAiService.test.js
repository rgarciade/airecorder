/**
 * recordingAiService.test.js
 *
 * Seam: recording name shown in the AI queue (`queueMeta.name`) when a summary
 * is generated through the public `generateRecordingSummary` flow.
 *
 * Boundaries mocked: the AI provider (`callProvider`), settings, prompt
 * builder, app session, and `window.electronAPI` (IPC). `recordingsService`
 * and `recordingAiService` are the real code under test.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const callProviderMock = vi.fn();

vi.mock('../../services/ai/providerRouter', () => ({
  callProvider: (...args) => callProviderMock(...args),
  getActiveProviderContextWindow: vi.fn(async () => 8192),
  CLOUD_PROVIDERS: ['gemini'],
}));
vi.mock('../../services/settingsService', () => ({
  getSettings: vi.fn(async () => ({ uiLanguage: 'es', aiProvider: 'gemini' })),
}));
vi.mock('../../services/ai/promptBuilder', () => ({
  buildSystemPrompt: vi.fn(async (_feature, prompt) => prompt),
  FEATURE_TYPES: { SHORT_SUMMARY: 'short', KEY_POINTS: 'kp', LONG_SUMMARY: 'long' },
}));
vi.mock('../../services/appSessionService', () => ({
  default: { getSessionId: () => 'session-1' },
}));

import recordingAiService from '../../services/recordingAiService';

const RECORDING_ID = '2024-05-01_10-00-00';

function buildElectronApi(getRecordingName) {
  const base = {};
  // Any other IPC call used by the flow (state files, summaries, instructions)
  // resolves to an empty successful response.
  const api = new Proxy(base, {
    get(target, prop) {
      if (prop in target) return target[prop];
      return vi.fn(async () => ({ success: true }));
    },
  });
  if (getRecordingName !== undefined) base.getRecordingName = getRecordingName;
  return api;
}

async function runAndCollectQueueNames() {
  await recordingAiService.generateRecordingSummary(
    RECORDING_ID,
    'transcription text',
    true,
    { summaries: true, keyTopics: false, detailedSummary: false },
  );
  return callProviderMock.mock.calls.map(([, options]) => options?.queueMeta?.name);
}

describe('recordingAiService queue name', () => {
  beforeEach(() => {
    callProviderMock.mockReset();
    callProviderMock.mockResolvedValue({ text: 'ok', provider: 'gemini', model: 'm' });
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    recordingAiService.generatingPromises?.clear?.();
    recordingAiService.summaryCache?.clear?.();
  });

  it('uses the recording title returned by getRecordingName in queueMeta.name', async () => {
    const getRecordingName = vi.fn(async () => ({ success: true, name: 'Reunión semanal' }));
    global.window = { electronAPI: buildElectronApi(getRecordingName) };

    const names = await runAndCollectQueueNames();

    expect(getRecordingName).toHaveBeenCalledWith(RECORDING_ID);
    expect(names).toEqual(['Resumen breve: Reunión semanal']);
  });

  it('falls back to the recording id when getRecordingName returns success:false', async () => {
    global.window = {
      electronAPI: buildElectronApi(vi.fn(async () => ({ success: false, error: 'boom' }))),
    };

    const names = await runAndCollectQueueNames();

    expect(names).toEqual([`Resumen breve: ${RECORDING_ID}`]);
  });

  it('falls back to the recording id when getRecordingName rejects', async () => {
    global.window = {
      electronAPI: buildElectronApi(vi.fn(async () => { throw new Error('ipc down'); })),
    };

    const names = await runAndCollectQueueNames();

    expect(names).toEqual([`Resumen breve: ${RECORDING_ID}`]);
  });

  it('falls back to the recording id when window.electronAPI.getRecordingName is absent', async () => {
    const api = buildElectronApi();
    // Proxy would fabricate the function; make it genuinely absent.
    global.window = {
      electronAPI: new Proxy(api, {
        get: (t, prop) => (prop === 'getRecordingName' ? undefined : t[prop]),
      }),
    };

    const names = await runAndCollectQueueNames();

    expect(names).toEqual([`Resumen breve: ${RECORDING_ID}`]);
  });

  it('falls back to the recording id when the returned name is empty', async () => {
    global.window = {
      electronAPI: buildElectronApi(vi.fn(async () => ({ success: true, name: '' }))),
    };

    const names = await runAndCollectQueueNames();

    expect(names).toEqual([`Resumen breve: ${RECORDING_ID}`]);
  });
});
