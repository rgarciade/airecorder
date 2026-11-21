import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * #174: processQueue restores a mic track left behind by a crashed echo-cancel
 * run (`micEchoService.recoverMic`) after waiting for the echo job and before
 * transcribing. A recovery failure must not block the transcription.
 *
 * Same mocking approach as transcriptionManager.test.js: the module is pure CJS,
 * so its dependencies are injected straight into Node's `require.cache`
 * (vi.mock cannot intercept `require()` inside pure CJS modules).
 */
const nodeRequire = createRequire(import.meta.url);

const electronPath = nodeRequire.resolve('electron');
const pathsPath = nodeRequire.resolve('../../../../electron/utils/paths.js');
const dbServicePath = nodeRequire.resolve('../../../../electron/database/dbService.js');
const notificationServicePath = nodeRequire.resolve('../../../../electron/services/notificationService.js');
const resourceManagerPath = nodeRequire.resolve('../../../../electron/services/resourceManager.js');
const micEchoServicePath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../electron/services/micEcho/micEchoService.js'
);

const getSettingMock = vi.fn((key, defaultValue) => defaultValue);
const dbServiceMock = {
  getRecording: vi.fn(),
  getRecordingById: vi.fn(),
  getRecordingTaskStatus: vi.fn(),
  setSkipDiarization: vi.fn(),
  enqueueTask: vi.fn(() => 1),
  getNextTask: vi.fn(),
  getActiveQueue: vi.fn(() => []),
  getQueueHistory: vi.fn(() => []),
  updateTask: vi.fn(),
};
const resourceManagerMock = {
  isInstalled: vi.fn(),
  getSnapshot: vi.fn(() => ({ cacheDir: '/fake/hf-cache' })),
  resolveCacheDir: vi.fn(() => '/fake/hf-cache'),
};
const micEchoServiceMock = {
  waitFor: vi.fn(() => Promise.resolve()),
  recoverMic: vi.fn(() => Promise.resolve()),
  cancelMicEcho: vi.fn(),
};

const injected = [
  [electronPath, { app: { isPackaged: false } }],
  [pathsPath, { getSetting: getSettingMock, settingsPath: '/fake/userData/settings.json' }],
  [dbServicePath, dbServiceMock],
  [notificationServicePath, {}],
  [resourceManagerPath, resourceManagerMock],
  [micEchoServicePath, { micEchoService: micEchoServiceMock, createMicEchoService: vi.fn() }],
];
const originalEntries = new Map();

beforeAll(() => {
  for (const [key, exports] of injected) {
    originalEntries.set(key, nodeRequire.cache[key]);
    nodeRequire.cache[key] = { id: key, filename: key, loaded: true, exports };
  }
});

afterAll(() => {
  for (const [key] of injected) {
    const original = originalEntries.get(key);
    if (original) nodeRequire.cache[key] = original; else delete nodeRequire.cache[key];
  }
});

describe('transcriptionManager.processQueue — recovers the mic track before transcribing (#174)', () => {
  let transcriptionManager;
  const task = { id: 55, recording_id: 7, model: 'small' };
  const BASE_PATH = '/fake/recordings';
  const RELATIVE = 'rec/uno';

  beforeEach(async () => {
    transcriptionManager = (await import('../../../../electron/services/transcriptionManager.js')).default;
    transcriptionManager.activeTask = null;
    transcriptionManager.process = null;
    transcriptionManager.basePath = BASE_PATH;

    getSettingMock.mockClear().mockImplementation((key, defaultValue) => defaultValue);
    Object.values(dbServiceMock).forEach((fn) => fn.mockClear && fn.mockClear());
    dbServiceMock.getNextTask.mockReset().mockReturnValueOnce(task).mockReturnValue(null);
    dbServiceMock.getRecordingById.mockReset().mockReturnValue({ id: 7, relative_path: RELATIVE });
    micEchoServiceMock.waitFor.mockReset().mockResolvedValue(undefined);
    micEchoServiceMock.recoverMic.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls recoverMic with the recording dir and base name, after waitFor and before transcribing', async () => {
    const order = [];
    micEchoServiceMock.waitFor.mockImplementation(async () => { order.push('waitFor'); });
    micEchoServiceMock.recoverMic.mockImplementation(async () => { order.push('recoverMic'); });
    const runSpy = vi.spyOn(transcriptionManager, 'runTranscriptionProcess')
      .mockImplementation(async () => { order.push('transcribe'); });

    await transcriptionManager.processQueue();

    expect(micEchoServiceMock.recoverMic).toHaveBeenCalledTimes(1);
    expect(micEchoServiceMock.recoverMic).toHaveBeenCalledWith(path.join(BASE_PATH, RELATIVE), RELATIVE);
    expect(order).toEqual(['waitFor', 'recoverMic', 'transcribe']);
    expect(runSpy).toHaveBeenCalledTimes(1);
  });

  it('waits for recoverMic to settle before transcribing', async () => {
    let finishRecovery;
    micEchoServiceMock.recoverMic.mockReturnValue(new Promise((resolve) => { finishRecovery = resolve; }));
    const runSpy = vi.spyOn(transcriptionManager, 'runTranscriptionProcess').mockResolvedValue();

    const processing = transcriptionManager.processQueue();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(runSpy).not.toHaveBeenCalled();

    finishRecovery();
    await processing;
    expect(runSpy).toHaveBeenCalledTimes(1);
  });

  it('still transcribes when recoverMic rejects', async () => {
    micEchoServiceMock.recoverMic.mockRejectedValue(new Error('rename failed'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const runSpy = vi.spyOn(transcriptionManager, 'runTranscriptionProcess').mockResolvedValue();

    await transcriptionManager.processQueue();

    expect(micEchoServiceMock.recoverMic).toHaveBeenCalled();
    expect(runSpy).toHaveBeenCalledTimes(1);
    expect(dbServiceMock.updateTask).toHaveBeenCalledWith(55, 'completed', 'completed', 100);
  });
});
