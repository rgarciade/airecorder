/**
 * recordingMetadata.test.js
 *
 * Unit tests for electron/utils/recordingMetadata.js —
 * updateRecordingMetadata(folderPath, patch): shallow-merges `patch` into the
 * recording's metadata.json (null values are written as null, not removed).
 * Uses a real temp directory, so assertions are on the file contents on disk.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { updateRecordingMetadata } from '../../../../electron/utils/recordingMetadata.js';

let tmpDir;
let folderPath;
let metadataPath;

function readMetadata() {
  return JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'recording-metadata-test-'));
  folderPath = path.join(tmpDir, 'recording-1');
  fs.mkdirSync(folderPath);
  metadataPath = path.join(folderPath, 'metadata.json');
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('updateRecordingMetadata', () => {
  it('merges the patch into existing metadata, preserving untouched keys', async () => {
    fs.writeFileSync(metadataPath, JSON.stringify({ customName: 'Weekly sync', duration: 120 }));

    await updateRecordingMetadata(folderPath, { projectName: 'Project A' });

    expect(readMetadata()).toEqual({ customName: 'Weekly sync', duration: 120, projectName: 'Project A' });
  });

  it('overwrites an existing key with the patched value', async () => {
    fs.writeFileSync(metadataPath, JSON.stringify({ customName: 'Weekly sync', projectName: 'Project A' }));

    await updateRecordingMetadata(folderPath, { projectName: 'Project B' });

    expect(readMetadata()).toEqual({ customName: 'Weekly sync', projectName: 'Project B' });
  });

  it('creates metadata.json with only the patch when the folder exists but the file does not', async () => {
    await updateRecordingMetadata(folderPath, { projectName: 'Project A' });

    expect(readMetadata()).toEqual({ projectName: 'Project A' });
  });

  it('writes null values as null (keeps the key) and leaves other keys intact', async () => {
    fs.writeFileSync(metadataPath, JSON.stringify({ customName: 'Weekly sync', projectName: 'Project A' }));

    await updateRecordingMetadata(folderPath, { projectName: null });

    const metadata = readMetadata();
    expect(metadata).toEqual({ customName: 'Weekly sync', projectName: null });
    expect(Object.prototype.hasOwnProperty.call(metadata, 'projectName')).toBe(true);
  });

  it('resolves without creating anything when the recording folder does not exist', async () => {
    const missingFolder = path.join(tmpDir, 'missing-recording');

    await updateRecordingMetadata(missingFolder, { projectName: 'Project A' });

    expect(fs.existsSync(missingFolder)).toBe(false);
  });

  it('overwrites a corrupt metadata.json with the patch only', async () => {
    fs.writeFileSync(metadataPath, '{ corrupt json');

    await updateRecordingMetadata(folderPath, { projectName: 'Project A' });

    expect(readMetadata()).toEqual({ projectName: 'Project A' });
  });
});
