import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import {
  getPackagedPythonBinaryPath,
  getFfmpegStaticPath,
  getBinarySuffix,
} from '../../../../electron/utils/packagedBinaries.js';

// packagedBinaries.js no depende de electron: solo lee process.platform y
// process.resourcesPath en cada llamada, así que se pueden mockear por test.
const ORIGINAL_PLATFORM = process.platform;
const ORIGINAL_RESOURCES_PATH = process.resourcesPath;

function mockProcess(platform, resourcesPath) {
  Object.defineProperty(process, 'platform', { value: platform, configurable: true });
  Object.defineProperty(process, 'resourcesPath', { value: resourcesPath, configurable: true });
}

afterEach(() => {
  Object.defineProperty(process, 'platform', { value: ORIGINAL_PLATFORM, configurable: true });
  if (ORIGINAL_RESOURCES_PATH === undefined) {
    delete process.resourcesPath;
  } else {
    Object.defineProperty(process, 'resourcesPath', { value: ORIGINAL_RESOURCES_PATH, configurable: true });
  }
});

describe('packagedBinaries', () => {
  describe('win32', () => {
    beforeEach(() => {
      mockProcess('win32', path.join('/fake', 'resources'));
    });

    it('getBinarySuffix devuelve ".exe"', () => {
      expect(getBinarySuffix()).toBe('.exe');
    });

    it('getPackagedPythonBinaryPath agrega el sufijo .exe al binario de python-bin', () => {
      const result = getPackagedPythonBinaryPath('audio_sync_analyzer');
      expect(result.endsWith('audio_sync_analyzer.exe')).toBe(true);
      expect(result).toBe(path.join('/fake', 'resources', 'python-bin', 'audio_sync_analyzer.exe'));
    });

    it('getFfmpegStaticPath(false) resuelve ffmpeg.exe dentro de app.asar.unpacked', () => {
      const result = getFfmpegStaticPath(false);
      expect(result.endsWith('ffmpeg.exe')).toBe(true);
      expect(result).toContain('app.asar.unpacked');
      expect(result).toContain('ffmpeg-static');
    });

    it('getFfmpegStaticPath(true) resuelve ffmpeg.exe en el node_modules del proyecto', () => {
      const result = getFfmpegStaticPath(true);
      expect(result.endsWith(path.join('node_modules', 'ffmpeg-static', 'ffmpeg.exe'))).toBe(true);
    });
  });

  describe('darwin', () => {
    beforeEach(() => {
      mockProcess('darwin', path.join('/fake', 'resources'));
    });

    it('getBinarySuffix devuelve cadena vacía', () => {
      expect(getBinarySuffix()).toBe('');
    });

    it('getPackagedPythonBinaryPath no agrega .exe', () => {
      const result = getPackagedPythonBinaryPath('audio_sync_analyzer');
      expect(result.endsWith('audio_sync_analyzer')).toBe(true);
      expect(result).not.toContain('.exe');
      expect(result).toBe(path.join('/fake', 'resources', 'python-bin', 'audio_sync_analyzer'));
    });

    it('getFfmpegStaticPath no agrega .exe ni en producción ni en dev', () => {
      expect(getFfmpegStaticPath(false).endsWith('ffmpeg')).toBe(true);
      expect(getFfmpegStaticPath(true).endsWith('ffmpeg')).toBe(true);
      expect(getFfmpegStaticPath(false)).not.toContain('.exe');
      expect(getFfmpegStaticPath(true)).not.toContain('.exe');
    });
  });
});
