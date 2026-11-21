/**
 * micEchoService.recover.test.js
 *
 * #174: `recoverMic(dir, baseName)` from `createMicEchoService({ runEchoCancel, fs, logger })`.
 * A crash between the renames of an echo-cancel run can leave only
 * `{base}-microphone-original.webm`; recoverMic puts it back as
 * `{base}-microphone.webm`. It is idempotent and never throws.
 *
 * Runs against a real temp directory; `fs` is replaced only to force a
 * rename failure.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'fs';
import os from 'os';
import path from 'path';

const nodeRequire = createRequire(import.meta.url);
const electronPath = nodeRequire.resolve('electron');
let originalElectronEntry;
let createMicEchoService;

beforeAll(async () => {
  originalElectronEntry = nodeRequire.cache[electronPath];
  nodeRequire.cache[electronPath] = {
    id: electronPath, filename: electronPath, loaded: true,
    exports: { app: { isPackaged: false, getPath: () => os.tmpdir() } },
  };
  ({ createMicEchoService } = await import('../../../../electron/services/micEcho/micEchoService.js'));
});

afterAll(() => {
  if (originalElectronEntry) nodeRequire.cache[electronPath] = originalElectronEntry; else delete nodeRequire.cache[electronPath];
});

const BASE = 'grabacion_test';
const ORIGINAL_BYTES = Buffer.from('original-mic-bytes');
const CURRENT_BYTES = Buffer.from('current-mic-bytes');

let dir;
let logger;
let runEchoCancel;

const micPath = () => path.join(dir, `${BASE}-microphone.webm`);
const originalPath = () => path.join(dir, `${BASE}-microphone-original.webm`);
const audioFiles = () => fs.readdirSync(dir).sort();

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mic-echo-recover-'));
  logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), log: vi.fn() };
  runEchoCancel = vi.fn();
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('micEchoService.recoverMic — restores the mic track after a crash (#174)', () => {
  it('renames the original to the mic track when only the original exists', async () => {
    fs.writeFileSync(originalPath(), ORIGINAL_BYTES);
    const service = createMicEchoService({ runEchoCancel, fs, logger });

    await service.recoverMic(dir, BASE);

    expect(audioFiles()).toEqual([`${BASE}-microphone.webm`]);
    expect(fs.readFileSync(micPath())).toEqual(ORIGINAL_BYTES);
    expect(runEchoCancel).not.toHaveBeenCalled();
  });

  it('is a no-op when the mic track exists (original left untouched)', async () => {
    fs.writeFileSync(micPath(), CURRENT_BYTES);
    fs.writeFileSync(originalPath(), ORIGINAL_BYTES);
    const service = createMicEchoService({ runEchoCancel, fs, logger });

    await service.recoverMic(dir, BASE);

    expect(fs.readFileSync(micPath())).toEqual(CURRENT_BYTES);
    expect(fs.readFileSync(originalPath())).toEqual(ORIGINAL_BYTES);
  });

  it('is a no-op and does not throw when neither track exists', async () => {
    const service = createMicEchoService({ runEchoCancel, fs, logger });

    await expect(service.recoverMic(dir, BASE)).resolves.toBeUndefined();
    expect(audioFiles()).toEqual([]);
  });

  it('is idempotent across repeated calls', async () => {
    fs.writeFileSync(originalPath(), ORIGINAL_BYTES);
    const service = createMicEchoService({ runEchoCancel, fs, logger });

    await service.recoverMic(dir, BASE);
    await service.recoverMic(dir, BASE);

    expect(audioFiles()).toEqual([`${BASE}-microphone.webm`]);
    expect(fs.readFileSync(micPath())).toEqual(ORIGINAL_BYTES);
  });

  it('does not throw and logs a warning when the rename fails', async () => {
    fs.writeFileSync(originalPath(), ORIGINAL_BYTES);
    const failingFs = {
      ...fs,
      promises: {
        ...fs.promises,
        access: fs.promises.access,
        rename: vi.fn(() => Promise.reject(Object.assign(new Error('EBUSY: resource busy or locked'), { code: 'EBUSY' }))),
      },
    };
    const service = createMicEchoService({ runEchoCancel, fs: failingFs, logger });

    await expect(service.recoverMic(dir, BASE)).resolves.toBeUndefined();

    expect(failingFs.promises.rename).toHaveBeenCalledWith(originalPath(), micPath());
    expect(logger.warn).toHaveBeenCalled();
    expect(fs.readFileSync(originalPath())).toEqual(ORIGINAL_BYTES);
  });
});
