import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { scanModel, scanCache, repoDirName } from '../../../../../electron/services/resources/hfCacheScanner.js';

/**
 * Crea el layout real de una caché HF para un repo dado:
 *   models--{org}--{repo}/
 *     blobs/{sha256}          <- contenido real
 *     refs/main                <- contiene el sha del snapshot activo
 *     snapshots/{sha}/*         <- symlinks a blobs/
 */
function createInstalledRepo(cacheDir, repoId, { withPreprocessor = false, vocabExt = 'txt' } = {}) {
  const dirName = repoDirName(repoId);
  const repoDir = path.join(cacheDir, dirName);
  const blobsDir = path.join(repoDir, 'blobs');
  const sha = 'abc123fakerevision';
  const snapshotDir = path.join(repoDir, 'snapshots', sha);

  fs.mkdirSync(blobsDir, { recursive: true });
  fs.mkdirSync(path.join(repoDir, 'refs'), { recursive: true });
  fs.mkdirSync(snapshotDir, { recursive: true });

  const files = {
    'config.json': 'blob-config',
    'model.bin': 'blob-model-content-bytes',
    'tokenizer.json': 'blob-tokenizer',
    [`vocabulary.${vocabExt}`]: 'blob-vocab',
  };
  if (withPreprocessor) {
    files['preprocessor_config.json'] = 'blob-preprocessor';
  }

  for (const [fileName, content] of Object.entries(files)) {
    const blobName = `blob-${fileName.replace(/[^a-z0-9]/gi, '')}`;
    const blobPath = path.join(blobsDir, blobName);
    fs.writeFileSync(blobPath, content);
    fs.symlinkSync(path.join('..', '..', 'blobs', blobName), path.join(snapshotDir, fileName));
  }

  fs.writeFileSync(path.join(repoDir, 'refs', 'main'), sha);

  return { repoDir, snapshotDir, sha };
}

function createIncompleteOnlyRepo(cacheDir, repoId) {
  const dirName = repoDirName(repoId);
  const repoDir = path.join(cacheDir, dirName);
  const blobsDir = path.join(repoDir, 'blobs');
  fs.mkdirSync(blobsDir, { recursive: true });
  fs.mkdirSync(path.join(repoDir, 'refs'), { recursive: true });
  // No refs/main escrito, no snapshots — solo un blob parcial huérfano
  fs.writeFileSync(path.join(blobsDir, 'partial-download.incomplete'), 'half-bytes');
  return { repoDir };
}

describe('hfCacheScanner — lectura del layout de caché de Hugging Face', () => {
  let cacheDir;

  beforeEach(() => {
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hf-cache-test-'));
  });

  afterEach(() => {
    fs.rmSync(cacheDir, { recursive: true, force: true });
  });

  it('detecta un modelo instalado y calcula el tamaño real (dedupe por realpath)', () => {
    createInstalledRepo(cacheDir, 'Systran/faster-whisper-small');

    const result = scanModel(cacheDir, { id: 'small', repoId: 'Systran/faster-whisper-small' });

    expect(result.installed).toBe(true);
    expect(result.path).toContain('snapshots');
    // 4 blobs: config(11) + model(25) + tokenizer(14) + vocab(9) = 59 bytes exactos
    expect(result.installedBytes).toBe('blob-config'.length + 'blob-model-content-bytes'.length + 'blob-tokenizer'.length + 'blob-vocab'.length);
  });

  it('modelo real sin preprocessor_config.json (caso Systran/faster-whisper-small real) igual cuenta como instalado', () => {
    createInstalledRepo(cacheDir, 'Systran/faster-whisper-tiny', { withPreprocessor: false });

    const result = scanModel(cacheDir, { id: 'tiny', repoId: 'Systran/faster-whisper-tiny' });

    expect(result.installed).toBe(true);
  });

  it('acepta vocabulary.json además de vocabulary.txt (patrón vocabulary.*)', () => {
    createInstalledRepo(cacheDir, 'Systran/faster-whisper-large-v3', { withPreprocessor: true, vocabExt: 'json' });

    const result = scanModel(cacheDir, { id: 'large-v3', repoId: 'Systran/faster-whisper-large-v3' });

    expect(result.installed).toBe(true);
  });

  it('un repo con solo blobs .incomplete (descarga interrumpida) NO se marca instalado', () => {
    createIncompleteOnlyRepo(cacheDir, 'Systran/faster-whisper-medium');

    const result = scanModel(cacheDir, { id: 'medium', repoId: 'Systran/faster-whisper-medium' });

    expect(result.installed).toBe(false);
    expect(result.installedBytes).toBeNull();
  });

  it('un repo inexistente en la caché no se marca instalado', () => {
    const result = scanModel(cacheDir, { id: 'base', repoId: 'Systran/faster-whisper-base' });

    expect(result.installed).toBe(false);
    expect(result.path).toBeNull();
  });

  it('scanCache escanea el catálogo completo y devuelve un resultado por modelo', () => {
    createInstalledRepo(cacheDir, 'Systran/faster-whisper-small');

    const catalog = [
      { id: 'small', repoId: 'Systran/faster-whisper-small' },
      { id: 'base', repoId: 'Systran/faster-whisper-base' },
    ];
    const results = scanCache(cacheDir, catalog);

    expect(results).toHaveLength(2);
    expect(results.find((r) => r.id === 'small').installed).toBe(true);
    expect(results.find((r) => r.id === 'base').installed).toBe(false);
  });
});
