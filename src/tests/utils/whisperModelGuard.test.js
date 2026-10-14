import { describe, expect, it } from 'vitest';
import { isModelInstalled, hasAnyInstalledModel, buildSelectableModelOptions } from '../../utils/whisperModelGuard.js';

const t = (key, opts) => (opts ? `${key}:${JSON.stringify(opts)}` : key);

function items(overrides = []) {
  return [
    { id: 'tiny', state: 'not-installed' },
    { id: 'small', state: 'installed' },
    { id: 'medium', state: 'error' },
    ...overrides,
  ];
}

describe('whisperModelGuard — isModelInstalled (INV6)', () => {
  it('returns true when the model exists and its state is installed', () => {
    expect(isModelInstalled(items(), 'small')).toBe(true);
  });

  it('returns false when the model exists but is not installed', () => {
    expect(isModelInstalled(items(), 'tiny')).toBe(false);
  });

  it('returns false when the model exists but errored', () => {
    expect(isModelInstalled(items(), 'medium')).toBe(false);
  });

  it('returns false when the model id is unknown', () => {
    expect(isModelInstalled(items(), 'large-v3')).toBe(false);
  });

  it('degrades to false (never throws) for null/undefined items or id', () => {
    expect(isModelInstalled(null, 'small')).toBe(false);
    expect(isModelInstalled(items(), null)).toBe(false);
    expect(isModelInstalled(undefined, undefined)).toBe(false);
  });
});

describe('whisperModelGuard — hasAnyInstalledModel (INV6)', () => {
  it('returns true when at least one item is installed', () => {
    expect(hasAnyInstalledModel(items())).toBe(true);
  });

  it('returns false when no item is installed', () => {
    expect(hasAnyInstalledModel([{ id: 'tiny', state: 'not-installed' }, { id: 'medium', state: 'error' }])).toBe(false);
  });

  it('returns false for an empty or missing catalog', () => {
    expect(hasAnyInstalledModel([])).toBe(false);
    expect(hasAnyInstalledModel(null)).toBe(false);
  });
});

describe('whisperModelGuard — buildSelectableModelOptions (INV6 — "atenuado" + CTA)', () => {
  it('marks installed models as selectable and not-installed ones as disabled', () => {
    const options = buildSelectableModelOptions(items(), t);
    expect(options.find((o) => o.value === 'small').disabled).toBe(false);
    expect(options.find((o) => o.value === 'tiny').disabled).toBe(true);
    expect(options.find((o) => o.value === 'medium').disabled).toBe(true);
  });

  it('labels not-installed options with a "not installed" hint distinct from the installed label', () => {
    const options = buildSelectableModelOptions(items(), t);
    const installedLabel = options.find((o) => o.value === 'small').label;
    const notInstalledLabel = options.find((o) => o.value === 'tiny').label;
    expect(installedLabel).toBe('settings.whisperModels.small');
    expect(notInstalledLabel).toContain('settings.whisperModels.notInstalledSuffix');
    expect(notInstalledLabel).not.toBe(installedLabel);
  });

  it('returns an empty array for a missing/invalid catalog', () => {
    expect(buildSelectableModelOptions(null, t)).toEqual([]);
    expect(buildSelectableModelOptions(undefined, t)).toEqual([]);
  });
});
