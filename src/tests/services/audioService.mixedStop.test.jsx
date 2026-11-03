/**
 * audioService.mixedStop.test.jsx
 *
 * Seam S4 of #174: `MixedAudioRecorder.handleSeparateRecordingStop`.
 * After both tracks are saved, the recorder must ask the main process to cancel
 * the mic echo (`window.electronAPI.cancelMicEcho(folderName)`) BEFORE notifying
 * `onStop`, so the main-process echo job is registered before the renderer
 * triggers auto-transcription. The call is fire-and-forget: its failure must
 * never change the recording result.
 *
 * Only the preload bridge (`window.electronAPI`) is mocked; the recorder is real.
 * Recorded audio is injected as already-finished track data (no MediaRecorder).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MixedAudioRecorder } from '../../services/audioService';

const fakeTrack = (duration) => ({
  blob: { arrayBuffer: async () => new ArrayBuffer(8) },
  duration,
});

let events;
let recorder;
let onStop;

function setUpRecorder() {
  recorder = new MixedAudioRecorder();
  recorder.recordingName = 'grabacion_1';
  recorder.microphoneAudioData = fakeTrack(10);
  recorder.systemAudioData = fakeTrack(12);
  onStop = vi.fn((data) => { events.push(['onStop', data]); });
  recorder.onStop(onStop);
}

beforeEach(() => {
  events = [];
  window.electronAPI = {
    saveSeparateAudio: vi.fn(async (_data, folderName, fileName) => {
      events.push(['save', fileName]);
      return { success: true, filePath: `/rec/${folderName}/${fileName}`, recordingId: 42 };
    }),
    cancelMicEcho: vi.fn(async (folderName) => {
      events.push(['cancelMicEcho', folderName]);
      return { success: true, applied: true };
    }),
  };
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  setUpRecorder();
});

afterEach(() => {
  delete window.electronAPI;
  vi.restoreAllMocks();
});

describe('MixedAudioRecorder.handleSeparateRecordingStop — mic echo trigger (S4)', () => {
  it('S4a: requests mic echo cancellation for the folder after both saves and before onStop', async () => {
    await recorder.handleSeparateRecordingStop();

    expect(events.map(([name, arg]) => (name === 'onStop' ? name : `${name}:${arg}`))).toEqual([
      'save:grabacion_1-microphone.webm',
      'save:grabacion_1-system.webm',
      'cancelMicEcho:grabacion_1',
      'onStop',
    ]);
  });

  it('S4a: does not wait for the echo job before notifying onStop', async () => {
    window.electronAPI.cancelMicEcho = vi.fn(() => new Promise(() => {}));

    await recorder.handleSeparateRecordingStop();

    expect(window.electronAPI.cancelMicEcho).toHaveBeenCalledWith('grabacion_1');
    expect(onStop).toHaveBeenCalledWith(expect.objectContaining({ success: true, folderName: 'grabacion_1' }));
  });

  it('S4b: a rejected echo request does not change the successful recording result', async () => {
    window.electronAPI.cancelMicEcho = vi.fn(() => Promise.reject(new Error('ipc down')));

    await recorder.handleSeparateRecordingStop();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(window.electronAPI.cancelMicEcho).toHaveBeenCalledWith('grabacion_1');
    expect(onStop).toHaveBeenCalledTimes(1);
    const data = onStop.mock.calls[0][0];
    expect(data).toMatchObject({ success: true, folderName: 'grabacion_1', dbId: 42 });
    expect(data.error).toBeUndefined();
  });

  it('S4b: an echo request that throws synchronously does not change the successful recording result', async () => {
    window.electronAPI.cancelMicEcho = vi.fn(() => { throw new Error('bridge broken'); });

    await recorder.handleSeparateRecordingStop();

    expect(window.electronAPI.cancelMicEcho).toHaveBeenCalledWith('grabacion_1');
    expect(onStop).toHaveBeenCalledTimes(1);
    expect(onStop.mock.calls[0][0]).toMatchObject({ success: true, folderName: 'grabacion_1' });
    expect(onStop.mock.calls[0][0].error).toBeUndefined();
  });

  it('S4c: a discarded recording never requests mic echo cancellation', async () => {
    recorder.shouldDiscard = true;

    await recorder.handleSeparateRecordingStop();

    expect(window.electronAPI.cancelMicEcho).not.toHaveBeenCalled();
    expect(window.electronAPI.saveSeparateAudio).not.toHaveBeenCalled();
  });
});
