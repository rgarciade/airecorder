/**
 * audio.echo.test.js
 *
 * Seam S3 of #174: IPC channel `cancel-mic-echo` in electron/ipc-handlers/audio.js.
 * The renderer sends the recording folder name right after both tracks are
 * saved; the handler resolves `<recordingsPath>/<folder>` and delegates to the
 * default micEchoService singleton (`require('../services/micEcho/micEchoService').micEchoService`).
 *
 * audio.js is pure CJS, so its dependencies are injected in Node's
 * `require.cache` (same pattern as recordings.test.js / analysis.test.js).
 * micEchoService does not exist before implementation, so its cache key is
 * built by hand instead of `nodeRequire.resolve`.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const nodeRequire = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const electronPath = nodeRequire.resolve('electron');
const dbServicePath = nodeRequire.resolve('../../../../electron/database/dbService.js');
const pathsPath = nodeRequire.resolve('../../../../electron/utils/paths.js');
const audioRecorderPath = nodeRequire.resolve('../../../../electron/services/audioRecorder.js');
const micEchoServicePath = path.resolve(here, '../../../../electron/services/micEcho/micEchoService.js');
const audioHandlersPath = path.resolve(here, '../../../../electron/ipc-handlers/audio.js');

const RECORDINGS_PATH = '/fake/recordings';

const handlers = {};
const ipcMainMock = { handle: vi.fn((channel, cb) => { handlers[channel] = cb; }) };
const micEchoServiceMock = {
  cancelMicEcho: vi.fn(),
  waitFor: vi.fn(() => Promise.resolve()),
};

const injected = [
  [electronPath, {
    ipcMain: ipcMainMock, systemPreferences: {}, desktopCapturer: {}, shell: {},
    app: { isPackaged: false, getPath: () => os.tmpdir() },
  }],
  [dbServicePath, { saveRecording: vi.fn() }],
  [pathsPath, { getRecordingsPath: vi.fn(async () => RECORDINGS_PATH) }],
  [audioRecorderPath, class FakeAudioManager {}],
  [micEchoServicePath, { micEchoService: micEchoServiceMock, createMicEchoService: vi.fn() }],
];
const originals = new Map();

beforeAll(() => {
  for (const [key, exports] of injected) {
    originals.set(key, nodeRequire.cache[key]);
    nodeRequire.cache[key] = { id: key, filename: key, loaded: true, exports };
  }
  delete nodeRequire.cache[audioHandlersPath];
  nodeRequire(audioHandlersPath).registerAudioHandlers();
});

afterAll(() => {
  for (const [key] of injected) {
    const original = originals.get(key);
    if (original) nodeRequire.cache[key] = original; else delete nodeRequire.cache[key];
  }
  delete nodeRequire.cache[audioHandlersPath];
});

beforeEach(() => {
  micEchoServiceMock.cancelMicEcho.mockReset();
});

describe('IPC cancel-mic-echo (S3)', () => {
  it('S3a: runs the echo job on <recordingsPath>/<folder> and returns its result', async () => {
    micEchoServiceMock.cancelMicEcho.mockResolvedValue({ success: true, applied: true });

    expect(handlers['cancel-mic-echo']).toEqual(expect.any(Function));
    const result = await handlers['cancel-mic-echo']({}, 'grabacion_1');

    expect(micEchoServiceMock.cancelMicEcho).toHaveBeenCalledWith(
      path.join(RECORDINGS_PATH, 'grabacion_1'),
      'grabacion_1'
    );
    expect(result).toEqual({ success: true, applied: true });
  });

  it('S3a: never rejects towards the renderer when the service throws', async () => {
    micEchoServiceMock.cancelMicEcho.mockImplementation(() => { throw new Error('unexpected'); });

    expect(handlers['cancel-mic-echo']).toEqual(expect.any(Function));
    const result = await handlers['cancel-mic-echo']({}, 'grabacion_1');

    expect(result).toMatchObject({ success: false, error: expect.any(String) });
  });
});

/**
 * Race guard (#174, edge case 3): the renderer fires `cancel-mic-echo` and
 * right after `transcribe-recording`. `getRecordingsPath()` is async, so if the
 * handler only registers the echo job after awaiting it, a transcription task
 * handled in that gap calls `micEchoService.waitFor(folder)`, finds no job and
 * transcribes the uncleaned mic track. Here the REAL service (built with
 * `createMicEchoService` and a fake Python runner) backs the handler, and
 * `getRecordingsPath` is held pending to open that gap. The handler is
 * expected to call `micEchoService.reserve?.(folder)` synchronously (optional
 * chaining keeps the S3a mock above valid) and then `cancelMicEcho(dir, folder)`.
 */
describe('IPC cancel-mic-echo — job registered before the first await (S3, race)', () => {
  const FOLDER = 'grabacion_race';
  let recordingsDir;
  let realService;
  let runEchoCancel;

  // Wires audio.js to the real service. Done inside the test (not in a hook)
  // so a missing module fails the test instead of skipping it.
  function wireRealService() {
    delete nodeRequire.cache[micEchoServicePath];
    const { createMicEchoService } = nodeRequire(micEchoServicePath);
    runEchoCancel = vi.fn(async () => ({ applied: false, reason: 'no_echo' }));
    realService = createMicEchoService({
      runEchoCancel,
      logger: { log: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    });
    nodeRequire.cache[micEchoServicePath] = {
      id: micEchoServicePath, filename: micEchoServicePath, loaded: true,
      exports: { micEchoService: realService, createMicEchoService },
    };
    delete nodeRequire.cache[audioHandlersPath];
    nodeRequire(audioHandlersPath).registerAudioHandlers();
  }

  beforeAll(() => {
    recordingsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mic-echo-ipc-'));
    fs.mkdirSync(path.join(recordingsDir, FOLDER));
    fs.writeFileSync(path.join(recordingsDir, FOLDER, `${FOLDER}-microphone.webm`), 'mic');
    fs.writeFileSync(path.join(recordingsDir, FOLDER, `${FOLDER}-system.webm`), 'sys');
  });

  afterAll(() => {
    if (recordingsDir) fs.rmSync(recordingsDir, { recursive: true, force: true });
  });

  it('a transcription that asks waitFor(folder) while the recordings path is still resolving waits for the echo job', async () => {
    wireRealService();
    // The handler reserves the job by folder via `micEchoService.reserve?.(folder)` before its first await.
    expect(realService.reserve).toEqual(expect.any(Function));
    let resolveRecordingsPath;
    const getRecordingsPath = nodeRequire.cache[pathsPath].exports.getRecordingsPath;
    getRecordingsPath.mockImplementationOnce(() => new Promise((resolve) => { resolveRecordingsPath = resolve; }));

    const ipcResult = handlers['cancel-mic-echo']({}, FOLDER);
    // Same tick: the transcription queue reaches waitFor before the path resolves.
    let waited = false;
    const waiting = realService.waitFor(FOLDER).then(() => { waited = true; });

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(waited).toBe(false);

    resolveRecordingsPath(recordingsDir);
    await expect(ipcResult).resolves.toMatchObject({ success: true, applied: false });
    await waiting;
    expect(waited).toBe(true);
    expect(runEchoCancel).toHaveBeenCalledWith(expect.objectContaining({
      micPath: path.join(recordingsDir, FOLDER, `${FOLDER}-microphone.webm`),
    }));
  });
});
