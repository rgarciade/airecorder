/**
 * micEchoService.concurrent.test.js
 *
 * #174: two concurrent cancelMicEcho calls for the same base must share one run,
 * so the stale-temp sweep never deletes a live run's temp file.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
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

describe('micEchoService concurrent cancelMicEcho (#174)', () => {
  it('joins the running job instead of starting a second run', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mic-echo-conc-'));
    try {
      const base = 'rec';
      fs.writeFileSync(path.join(dir, `${base}-microphone.webm`), 'mic');
      fs.writeFileSync(path.join(dir, `${base}-system.webm`), 'sys');

      let release;
      const gate = new Promise((r) => { release = r; });
      const runEchoCancel = vi.fn(async ({ outPath }) => {
        fs.writeFileSync(outPath, 'clean');
        await gate;
        return { applied: true, delayMs: 10, erleDb: 20 };
      });
      const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), log: vi.fn() };
      const service = createMicEchoService({ runEchoCancel, logger });

      const first = service.cancelMicEcho(dir, base);
      await vi.waitFor(() => expect(runEchoCancel).toHaveBeenCalledTimes(1));
      const second = service.cancelMicEcho(dir, base);
      // Live run's temp must survive the second call.
      expect(fs.existsSync(path.join(dir, `${base}-echo-tmp.webm`))).toBe(true);

      release();
      const [a, b] = await Promise.all([first, second]);
      expect(runEchoCancel).toHaveBeenCalledTimes(1);
      expect(a.applied).toBe(true);
      expect(b).toEqual(a);
      expect(fs.readFileSync(path.join(dir, `${base}-microphone.webm`), 'utf8')).toBe('clean');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
