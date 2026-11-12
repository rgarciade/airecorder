/**
 * micEchoService.timeout.test.js
 *
 * #174: `computeTimeoutMs(durationSec)` exported from
 * electron/services/micEcho/micEchoService.js.
 *
 * Rule: max(5 min, ceil(3x audio duration)); 30 min fallback when the duration
 * is unknown (non-finite, null or <= 0).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createRequire } from 'node:module';
import os from 'os';

const nodeRequire = createRequire(import.meta.url);
const electronPath = nodeRequire.resolve('electron');
let originalElectronEntry;
let micEchoModule;

beforeAll(async () => {
  // The module builds a default singleton that may touch `electron`; keep it inert.
  originalElectronEntry = nodeRequire.cache[electronPath];
  nodeRequire.cache[electronPath] = {
    id: electronPath, filename: electronPath, loaded: true,
    exports: { app: { isPackaged: false, getPath: () => os.tmpdir() } },
  };
  micEchoModule = await import('../../../../electron/services/micEcho/micEchoService.js');
});

afterAll(() => {
  if (originalElectronEntry) nodeRequire.cache[electronPath] = originalElectronEntry; else delete nodeRequire.cache[electronPath];
});

const MIN = 60 * 1000;
const computeTimeoutMs = (...args) => micEchoModule.computeTimeoutMs(...args);

describe('micEchoService.computeTimeoutMs — echo-cancel timeout scales with audio duration (#174)', () => {
  it('is exported by the module', () => {
    expect(typeof micEchoModule.computeTimeoutMs).toBe('function');
  });

  it.each([
    ['NaN', NaN],
    ['Infinity', Infinity],
    ['null', null],
    ['undefined', undefined],
    ['zero', 0],
    ['negative', -10],
  ])('falls back to 30 min when the duration is unknown (%s)', (_label, value) => {
    expect(computeTimeoutMs(value)).toBe(30 * MIN);
  });

  it('uses the 5 min floor for short recordings (60 s)', () => {
    expect(computeTimeoutMs(60)).toBe(5 * MIN);
  });

  it('uses 3x the duration for long recordings (1 h -> 3 h)', () => {
    expect(computeTimeoutMs(3600)).toBe(3 * 60 * MIN);
  });

  it('boundary: 100 s gives exactly the 5 min floor', () => {
    expect(computeTimeoutMs(100)).toBe(5 * MIN);
  });

  it('boundary: 101 s gives 3x the duration (303000 ms)', () => {
    expect(computeTimeoutMs(101)).toBe(303000);
  });

  it('rounds fractional durations up to a whole millisecond', () => {
    expect(computeTimeoutMs(100.0001)).toBe(Math.ceil(100.0001 * 1000 * 3));
    expect(Number.isInteger(computeTimeoutMs(1234.5677))).toBe(true);
  });
});
