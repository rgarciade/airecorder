/**
 * micEchoService.test.js
 *
 * Seam S1/S2 of #174: `createMicEchoService({ runEchoCancel, fs?, logger })`
 * from electron/services/micEcho/micEchoService.js.
 *
 * The service swaps the microphone track of a recording for an echo-cancelled
 * version produced by `runEchoCancel` (the Python `echo-cancel` subcommand in
 * production). These tests run the real service against a real temp directory
 * and replace only the system boundary (the Python runner, and `fs` for the
 * Windows file-lock scenario).
 *
 * Naming contract (consumed by audio_sync_analyzer.py mic glob and
 * SpeakerDetail.jsx `/-microphone\.\w+$/`):
 *   - `{base}-microphone.webm`          -> track used by the app (cleaned when applied)
 *   - `{base}-microphone-original.webm` -> untouched original (only when applied)
 *   - `{base}-system.webm`              -> echo reference
 *   - `analysis/echo_cancellation.json` -> report
 *
 * Runner contract (defined here):
 *   runEchoCancel({ micPath, refPath, outPath }) -> Promise<{ applied, reason?, delayMs?, erleDb? }>
 *   When `applied` is true it has written the cleaned track to `outPath`.
 *   It rejects on failure (python error, timeout).
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
  // The module may build a default singleton that touches `electron`; keep it inert.
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
const CLEANED_BYTES = Buffer.from('cleaned-mic-bytes');
const SYSTEM_BYTES = Buffer.from('system-bytes');

let dir;
let logger;

const micPath = () => path.join(dir, `${BASE}-microphone.webm`);
const originalPath = () => path.join(dir, `${BASE}-microphone-original.webm`);
const systemPath = () => path.join(dir, `${BASE}-system.webm`);
const reportPath = () => path.join(dir, 'analysis', 'echo_cancellation.json');
const audioFiles = () => fs.readdirSync(dir).filter((name) => name !== 'analysis').sort();

function writeRecording({ mic = true, original = false, system = true } = {}) {
  if (mic) fs.writeFileSync(micPath(), ORIGINAL_BYTES);
  if (original) fs.writeFileSync(originalPath(), ORIGINAL_BYTES);
  if (system) fs.writeFileSync(systemPath(), SYSTEM_BYTES);
}

const appliedRunner = () => vi.fn(async ({ outPath }) => {
  await fs.promises.writeFile(outPath, CLEANED_BYTES);
  return { applied: true, delayMs: 150, erleDb: 18 };
});

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mic-echo-'));
  logger = { log: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('micEchoService.cancelMicEcho (S1)', () => {
  it('S1a: when echo is cancelled, the mic track holds the cleaned audio and the original is kept aside', async () => {
    writeRecording();
    const runEchoCancel = appliedRunner();
    const service = createMicEchoService({ runEchoCancel, logger });

    const result = await service.cancelMicEcho(dir, BASE);

    expect(result).toMatchObject({ success: true, applied: true });
    expect(fs.readFileSync(micPath())).toEqual(CLEANED_BYTES);
    expect(fs.readFileSync(originalPath())).toEqual(ORIGINAL_BYTES);
    expect(audioFiles()).toEqual([
      `${BASE}-microphone-original.webm`,
      `${BASE}-microphone.webm`,
      `${BASE}-system.webm`,
    ]);
    const report = JSON.parse(fs.readFileSync(reportPath(), 'utf8'));
    expect(report.applied).toBe(true);
  });

  it('S1a: the runner gets the system track as reference and a temp output the mic glob cannot pick', async () => {
    writeRecording();
    const runEchoCancel = appliedRunner();
    const service = createMicEchoService({ runEchoCancel, logger });

    await service.cancelMicEcho(dir, BASE);

    expect(runEchoCancel).toHaveBeenCalledTimes(1);
    const { micPath: source, refPath, outPath } = runEchoCancel.mock.calls[0][0];
    expect(source).toBe(micPath());
    expect(refPath).toBe(systemPath());
    expect(path.dirname(outPath)).toBe(dir);
    expect(path.basename(outPath)).not.toMatch(/-microphone\.\w+$/);
    expect(path.basename(outPath).startsWith(`${BASE}-microphone.`)).toBe(false);
  });

  it('S1b: when no echo is found, the mic track is left byte-identical and no original copy is created', async () => {
    writeRecording();
    const runEchoCancel = vi.fn(async () => ({ applied: false, reason: 'no_echo' }));
    const service = createMicEchoService({ runEchoCancel, logger });

    const result = await service.cancelMicEcho(dir, BASE);

    expect(result).toMatchObject({ success: true, applied: false, reason: 'no_echo' });
    expect(fs.readFileSync(micPath())).toEqual(ORIGINAL_BYTES);
    expect(audioFiles()).toEqual([`${BASE}-microphone.webm`, `${BASE}-system.webm`]);
    const report = JSON.parse(fs.readFileSync(reportPath(), 'utf8'));
    expect(report).toMatchObject({ applied: false, reason: 'no_echo' });
  });

  it('S1c: when the runner throws, the mic track is untouched and the call resolves with an error', async () => {
    writeRecording();
    const runEchoCancel = vi.fn(() => { throw new Error('python crashed'); });
    const service = createMicEchoService({ runEchoCancel, logger });

    const result = await service.cancelMicEcho(dir, BASE);

    expect(result.success).toBe(false);
    expect(result.error).toEqual(expect.any(String));
    expect(fs.readFileSync(micPath())).toEqual(ORIGINAL_BYTES);
    expect(audioFiles()).toEqual([`${BASE}-microphone.webm`, `${BASE}-system.webm`]);
  });

  it('S1c: when the runner rejects (e.g. timeout), the mic track is untouched and the call resolves with an error', async () => {
    writeRecording();
    const runEchoCancel = vi.fn(async ({ outPath }) => {
      await fs.promises.writeFile(outPath, Buffer.from('partial'));
      throw new Error('echo-cancel timed out');
    });
    const service = createMicEchoService({ runEchoCancel, logger });

    const result = await service.cancelMicEcho(dir, BASE);

    expect(result).toMatchObject({ success: false, error: expect.stringContaining('timed out') });
    expect(fs.readFileSync(micPath())).toEqual(ORIGINAL_BYTES);
    expect(audioFiles()).toEqual([`${BASE}-microphone.webm`, `${BASE}-system.webm`]);
  });

  it('S1c: when the runner claims success but wrote no output, the mic track is untouched', async () => {
    writeRecording();
    const runEchoCancel = vi.fn(async () => ({ applied: true, delayMs: 150, erleDb: 18 }));
    const service = createMicEchoService({ runEchoCancel, logger });

    const result = await service.cancelMicEcho(dir, BASE);

    expect(result.success).toBe(false);
    expect(fs.readFileSync(micPath())).toEqual(ORIGINAL_BYTES);
    expect(audioFiles()).toEqual([`${BASE}-microphone.webm`, `${BASE}-system.webm`]);
  });

  it('S1d: re-running on an already cleaned recording processes the original and never overwrites it', async () => {
    writeRecording({ original: true });
    fs.writeFileSync(micPath(), Buffer.from('previously-cleaned'));
    const runEchoCancel = appliedRunner();
    const service = createMicEchoService({ runEchoCancel, logger });

    const result = await service.cancelMicEcho(dir, BASE);

    expect(result).toMatchObject({ success: true, applied: true });
    expect(runEchoCancel.mock.calls[0][0].micPath).toBe(originalPath());
    expect(fs.readFileSync(originalPath())).toEqual(ORIGINAL_BYTES);
    expect(fs.readFileSync(micPath())).toEqual(CLEANED_BYTES);
  });

  it('S1e: if a crash left only the original, it is restored as the mic track before processing', async () => {
    writeRecording({ mic: false, original: true });
    const runEchoCancel = vi.fn(async () => ({ applied: false, reason: 'no_echo' }));
    const service = createMicEchoService({ runEchoCancel, logger });

    const result = await service.cancelMicEcho(dir, BASE);

    expect(result.success).toBe(true);
    expect(fs.existsSync(micPath())).toBe(true);
    expect(fs.readFileSync(micPath())).toEqual(ORIGINAL_BYTES);
  });

  it('S1f: without a system track it skips processing and leaves the mic track untouched', async () => {
    writeRecording({ system: false });
    const runEchoCancel = appliedRunner();
    const service = createMicEchoService({ runEchoCancel, logger });

    const result = await service.cancelMicEcho(dir, BASE);

    expect(result).toEqual({ success: true, applied: false, reason: 'no_reference' });
    expect(runEchoCancel).not.toHaveBeenCalled();
    expect(fs.readFileSync(micPath())).toEqual(ORIGINAL_BYTES);
    expect(audioFiles()).toEqual([`${BASE}-microphone.webm`]);
  });

  describe('S1g: file locks during the swap (Windows EBUSY)', () => {
    function faultyFs(shouldFail) {
      const fail = (src, dst) => {
        if (!shouldFail(String(src), String(dst))) return null;
        const error = new Error(`EBUSY: resource busy or locked, rename '${src}' -> '${dst}'`);
        error.code = 'EBUSY';
        return error;
      };
      return {
        ...fs,
        rename: (src, dst, cb) => {
          const error = fail(src, dst);
          if (error) { process.nextTick(cb, error); return; }
          fs.rename(src, dst, cb);
        },
        renameSync: (src, dst) => {
          const error = fail(src, dst);
          if (error) throw error;
          return fs.renameSync(src, dst);
        },
        promises: {
          ...fs.promises,
          rename: async (src, dst) => {
            const error = fail(src, dst);
            if (error) throw error;
            return fs.promises.rename(src, dst);
          },
        },
      };
    }

    it('if the mic track cannot be moved aside, nothing changes and the mic track is intact', async () => {
      writeRecording();
      const lockedFs = faultyFs((src, dst) => src.endsWith('-microphone.webm') && dst.endsWith('-microphone-original.webm'));
      const service = createMicEchoService({ runEchoCancel: appliedRunner(), fs: lockedFs, logger });

      const result = await service.cancelMicEcho(dir, BASE);

      expect(result.success).toBe(false);
      expect(fs.readFileSync(micPath())).toEqual(ORIGINAL_BYTES);
      expect(audioFiles()).toEqual([`${BASE}-microphone.webm`, `${BASE}-system.webm`]);
    });

    it('if the cleaned track cannot take the mic name, the original is rolled back and no partial state remains', async () => {
      writeRecording();
      const lockedFs = faultyFs((src, dst) => dst.endsWith('-microphone.webm') && !src.endsWith('-microphone-original.webm'));
      const service = createMicEchoService({ runEchoCancel: appliedRunner(), fs: lockedFs, logger });

      const result = await service.cancelMicEcho(dir, BASE);

      expect(result.success).toBe(false);
      expect(fs.readFileSync(micPath())).toEqual(ORIGINAL_BYTES);
      expect(audioFiles()).toEqual([`${BASE}-microphone.webm`, `${BASE}-system.webm`]);
    });
  });
});

describe('micEchoService.waitFor (S2)', () => {
  it('resolves only after the echo job of that recording finishes', async () => {
    writeRecording();
    const gate = deferred();
    const runEchoCancel = vi.fn(() => gate.promise);
    const service = createMicEchoService({ runEchoCancel, logger });

    const job = service.cancelMicEcho(dir, BASE);
    let waited = false;
    const waiting = service.waitFor(BASE).then(() => { waited = true; });

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(waited).toBe(false);

    gate.resolve({ applied: false, reason: 'no_echo' });
    await job;
    await waiting;
    expect(waited).toBe(true);
  });

  it('resolves (never rejects) when the echo job fails', async () => {
    writeRecording();
    const runEchoCancel = vi.fn(async () => { throw new Error('boom'); });
    const service = createMicEchoService({ runEchoCancel, logger });

    service.cancelMicEcho(dir, BASE);

    await expect(service.waitFor(BASE)).resolves.toBeUndefined();
  });

  it('resolves immediately when no job exists for that recording', async () => {
    const service = createMicEchoService({ runEchoCancel: vi.fn(), logger });

    let waited = false;
    service.waitFor('unknown_recording').then(() => { waited = true; });
    await Promise.resolve();
    await Promise.resolve();

    expect(waited).toBe(true);
  });
});
