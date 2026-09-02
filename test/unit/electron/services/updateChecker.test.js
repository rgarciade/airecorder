import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'fs';
import https from 'https';
import { EventEmitter } from 'events';

// updateChecker.js hace `require('electron')`, `require('https')` y
// `require('../utils/paths')` a nivel de módulo. Los dos primeros no se
// pueden interceptar con `vi.mock`: este proyecto no tiene "type": "module"
// en package.json, así que updateChecker.js es CJS puro (sin sintaxis
// import/export) y Vitest lo carga con el `require` nativo de Node en vez de
// pasarlo por su graph de módulos instrumentado — confirmado probándolo,
// `vi.mock('electron', ...)` no tenía ningún efecto sobre este archivo.
// Dos soluciones distintas según el tipo de dependencia:
//  - 'electron' y '../utils/paths' (no son módulos core, y fuera de un
//    proceso Electron real `require('electron')` devuelve un STRING, no
//    `{ app, dialog, ... }`) → inyectamos directamente en `require.cache` de
//    Node (compartido sin importar si el require es nativo o instrumentado)
//    antes de importar updateChecker.js.
//  - 'https' (módulo core de Node) → `vi.spyOn(https, 'get')` SÍ funciona,
//    porque no depende de interceptar resolución de módulos: muta en sitio el
//    mismo objeto singleton `https` que cualquier `require('https')` devuelve,
//    igual que `fs` ya se mockea en el resto de la suite (ver
//    embeddingService.test.js / ragService.test.js).
// Guardamos/restauramos las entradas originales del cache en
// beforeAll/afterAll para no filtrar el mock a otros archivos de test que
// corran en el mismo worker.
const nodeRequire = createRequire(import.meta.url);
const electronPath = nodeRequire.resolve('electron');
const pathsPath = nodeRequire.resolve('../../../../electron/utils/paths.js');
const SETTINGS_PATH = '/fake/userData/settings.json';

const electronMocks = {
  getVersion: vi.fn(() => '1.0.0'),
  showMessageBox: vi.fn(),
  openExternal: vi.fn(),
  getAllWindows: vi.fn(() => []),
};

let originalElectronEntry;
let originalPathsEntry;

beforeAll(() => {
  originalElectronEntry = nodeRequire.cache[electronPath];
  nodeRequire.cache[electronPath] = {
    id: electronPath,
    filename: electronPath,
    loaded: true,
    exports: {
      app: { getVersion: electronMocks.getVersion },
      dialog: { showMessageBox: electronMocks.showMessageBox },
      shell: { openExternal: electronMocks.openExternal },
      BrowserWindow: { getAllWindows: electronMocks.getAllWindows },
    },
  };

  originalPathsEntry = nodeRequire.cache[pathsPath];
  nodeRequire.cache[pathsPath] = {
    id: pathsPath,
    filename: pathsPath,
    loaded: true,
    exports: { settingsPath: SETTINGS_PATH },
  };
});

afterAll(() => {
  if (originalElectronEntry) nodeRequire.cache[electronPath] = originalElectronEntry;
  else delete nodeRequire.cache[electronPath];

  if (originalPathsEntry) nodeRequire.cache[pathsPath] = originalPathsEntry;
  else delete nodeRequire.cache[pathsPath];
});

const ORIGINAL_PLATFORM = process.platform;

function setPlatform(value) {
  Object.defineProperty(process, 'platform', { value, configurable: true });
}

/** Simula una respuesta HTTP completa de la API de GitHub (status + body). */
function mockHttpsResponse({ statusCode, body }) {
  vi.spyOn(https, 'get').mockImplementation((_options, callback) => {
    const res = new EventEmitter();
    res.statusCode = statusCode;
    const req = { on: vi.fn(), setTimeout: vi.fn(), destroy: vi.fn() };
    callback(res);
    res.emit('data', Buffer.from(body ?? ''));
    res.emit('end');
    return req;
  });
}

/** Simula un fallo de red (evento 'error' en el request, sin respuesta). */
function mockHttpsError(error) {
  vi.spyOn(https, 'get').mockImplementation(() => {
    const req = {
      on: vi.fn((event, handler) => {
        if (event === 'error') handler(error);
      }),
      setTimeout: vi.fn(),
      destroy: vi.fn(),
    };
    return req;
  });
}

describe('updateChecker', () => {
  let updateChecker;

  beforeEach(async () => {
    electronMocks.getVersion.mockReset().mockReturnValue('1.0.0');
    electronMocks.showMessageBox.mockReset().mockResolvedValue({ response: 1 });
    electronMocks.openExternal.mockReset();
    electronMocks.getAllWindows.mockReset().mockReturnValue([]);

    updateChecker = (await import('../../../../electron/services/updateChecker.js')).default;
    updateChecker.mainWindow = null;
    updateChecker.latestRelease = null;
    updateChecker.stopPeriodicCheck();
  });

  afterEach(() => {
    updateChecker.stopPeriodicCheck();
    setPlatform(ORIGINAL_PLATFORM);
    vi.restoreAllMocks();
  });

  describe('getCurrentVersion', () => {
    it('delega en app.getVersion()', () => {
      electronMocks.getVersion.mockReturnValue('2.5.1');
      expect(updateChecker.getCurrentVersion()).toBe('2.5.1');
    });
  });

  describe('_getSettings', () => {
    it('devuelve {} si settings.json no existe', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(false);
      expect(updateChecker._getSettings()).toEqual({});
    });

    it('devuelve el contenido parseado si settings.json existe', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({ theme: 'dark' }));
      expect(updateChecker._getSettings()).toEqual({ theme: 'dark' });
    });

    it('devuelve {} sin lanzar si el JSON está corrupto', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync').mockReturnValue('{ corrupto');
      vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(updateChecker._getSettings()).toEqual({});
    });
  });

  describe('_isVersionIgnored / _ignoreVersion', () => {
    it('_isVersionIgnored devuelve true si coincide con ignoredUpdateVersion', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({ ignoredUpdateVersion: '1.2.3' }));
      expect(updateChecker._isVersionIgnored('1.2.3')).toBe(true);
    });

    it('_isVersionIgnored devuelve false para una versión distinta', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({ ignoredUpdateVersion: '1.2.3' }));
      expect(updateChecker._isVersionIgnored('9.9.9')).toBe(false);
    });

    it('_ignoreVersion persiste ignoredUpdateVersion preservando el resto de settings', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({ theme: 'dark' }));
      const writeSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});

      updateChecker._ignoreVersion('3.0.0');

      expect(writeSpy).toHaveBeenCalledWith(
        SETTINGS_PATH,
        JSON.stringify({ theme: 'dark', ignoredUpdateVersion: '3.0.0' }, null, 2),
        'utf8'
      );
    });

    it('_ignoreVersion no lanza si falla la escritura a disco', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(false);
      vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {
        throw new Error('EACCES');
      });
      vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(() => updateChecker._ignoreVersion('3.0.0')).not.toThrow();
    });
  });

  describe('_isNewerVersion', () => {
    it('detecta un patch más nuevo', () => {
      expect(updateChecker._isNewerVersion('1.2.3', '1.2.2')).toBe(true);
    });

    it('un minor más alto gana aunque el patch actual sea mayor', () => {
      expect(updateChecker._isNewerVersion('1.3.0', '1.2.9')).toBe(true);
    });

    it('un major más alto gana', () => {
      expect(updateChecker._isNewerVersion('2.0.0', '1.9.9')).toBe(true);
    });

    it('devuelve false si latest es más vieja que current', () => {
      expect(updateChecker._isNewerVersion('1.2.2', '1.2.3')).toBe(false);
    });

    it('devuelve false si las versiones son iguales', () => {
      expect(updateChecker._isNewerVersion('1.2.3', '1.2.3')).toBe(false);
    });

    it('trata los segmentos faltantes como 0 ("1.2" equivale a "1.2.0")', () => {
      expect(updateChecker._isNewerVersion('1.2', '1.2.0')).toBe(false);
    });

    it('trata segmentos no numéricos como 0 en vez de lanzar (NaN || 0)', () => {
      expect(updateChecker._isNewerVersion('abc', '1.0.0')).toBe(false);
      expect(updateChecker._isNewerVersion('2.0.0', 'abc')).toBe(true);
    });
  });

  describe('_getPlatformDownloadUrl', () => {
    it('en macOS devuelve el asset .dmg', () => {
      setPlatform('darwin');
      const release = {
        html_url: 'https://github.com/x/releases/tag/v1.0.0',
        assets: [
          { name: 'AIRecorder-1.0.0.exe', browser_download_url: 'https://x/app.exe' },
          { name: 'AIRecorder-1.0.0.dmg', browser_download_url: 'https://x/app.dmg' },
        ],
      };
      expect(updateChecker._getPlatformDownloadUrl(release)).toBe('https://x/app.dmg');
    });

    it('en macOS sin asset .dmg cae al html_url de la release', () => {
      setPlatform('darwin');
      const release = {
        html_url: 'https://x/tag',
        assets: [{ name: 'app.exe', browser_download_url: 'https://x/app.exe' }],
      };
      expect(updateChecker._getPlatformDownloadUrl(release)).toBe('https://x/tag');
    });

    it('en Windows devuelve el asset .exe', () => {
      setPlatform('win32');
      const release = {
        html_url: 'https://x/tag',
        assets: [{ name: 'app.exe', browser_download_url: 'https://x/app.exe' }],
      };
      expect(updateChecker._getPlatformDownloadUrl(release)).toBe('https://x/app.exe');
    });

    it('en una plataforma no soportada (linux) cae al html_url', () => {
      setPlatform('linux');
      const release = {
        html_url: 'https://x/tag',
        assets: [{ name: 'app.AppImage', browser_download_url: 'https://x/app.AppImage' }],
      };
      expect(updateChecker._getPlatformDownloadUrl(release)).toBe('https://x/tag');
    });

    it('si release.assets falta, cae al html_url sin lanzar', () => {
      setPlatform('darwin');
      const release = { html_url: 'https://x/tag' };
      expect(updateChecker._getPlatformDownloadUrl(release)).toBe('https://x/tag');
    });
  });

  describe('_fetchLatestRelease', () => {
    it('resuelve el release parseado cuando GitHub responde 200 con JSON válido', async () => {
      mockHttpsResponse({ statusCode: 200, body: JSON.stringify({ tag_name: 'v1.2.3' }) });

      const release = await updateChecker._fetchLatestRelease();

      expect(release).toEqual({ tag_name: 'v1.2.3' });
      expect(https.get).toHaveBeenCalledWith(
        expect.objectContaining({
          hostname: 'api.github.com',
          path: '/repos/rgarciade/airecorder/releases/latest',
        }),
        expect.any(Function)
      );
    });

    it('resuelve null cuando GitHub responde 404 (sin releases todavía)', async () => {
      mockHttpsResponse({ statusCode: 404, body: '' });

      const release = await updateChecker._fetchLatestRelease();

      expect(release).toBeNull();
    });

    it('rechaza con el código de estado si la respuesta no es 200 ni 404', async () => {
      mockHttpsResponse({ statusCode: 500, body: '' });

      await expect(updateChecker._fetchLatestRelease()).rejects.toThrow(/500/);
    });

    it('rechaza si el body de una respuesta 200 no es JSON válido', async () => {
      mockHttpsResponse({ statusCode: 200, body: 'not-json{{' });

      await expect(updateChecker._fetchLatestRelease()).rejects.toThrow('Respuesta JSON inválida de GitHub');
    });

    it('rechaza si la request emite un error de red', async () => {
      mockHttpsError(new Error('ENOTFOUND'));

      await expect(updateChecker._fetchLatestRelease()).rejects.toThrow('ENOTFOUND');
    });
  });

  describe('checkForUpdates', () => {
    it('devuelve null si no hay versión más nueva', async () => {
      electronMocks.getVersion.mockReturnValue('2.0.0');
      vi.spyOn(updateChecker, '_fetchLatestRelease').mockResolvedValue({ tag_name: 'v2.0.0', assets: [] });

      const result = await updateChecker.checkForUpdates(true);

      expect(result).toBeNull();
    });

    it('devuelve updateInfo y notifica al renderer cuando hay una versión más nueva (modo silencioso)', async () => {
      electronMocks.getVersion.mockReturnValue('1.0.0');
      vi.spyOn(updateChecker, '_fetchLatestRelease').mockResolvedValue({
        tag_name: 'v2.0.0',
        body: 'Notas de la versión',
        published_at: '2026-01-01',
        assets: [],
        html_url: 'https://x/tag',
      });
      vi.spyOn(fs, 'existsSync').mockReturnValue(false); // sin versión ignorada

      const send = vi.fn();
      updateChecker.mainWindow = { webContents: { send } };

      const result = await updateChecker.checkForUpdates(true, false);

      expect(result).toEqual(expect.objectContaining({ currentVersion: '1.0.0', latestVersion: '2.0.0' }));
      expect(send).toHaveBeenCalledWith('update-available', expect.objectContaining({ latestVersion: '2.0.0' }));
      expect(electronMocks.showMessageBox).not.toHaveBeenCalled();
    });

    it('no notifica y devuelve null si la versión ya fue ignorada y no es un chequeo manual', async () => {
      electronMocks.getVersion.mockReturnValue('1.0.0');
      vi.spyOn(updateChecker, '_fetchLatestRelease').mockResolvedValue({ tag_name: 'v2.0.0', assets: [] });
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({ ignoredUpdateVersion: '2.0.0' }));

      const result = await updateChecker.checkForUpdates(true, false);

      expect(result).toBeNull();
    });

    it('sí devuelve la versión ignorada cuando el chequeo es manual', async () => {
      electronMocks.getVersion.mockReturnValue('1.0.0');
      vi.spyOn(updateChecker, '_fetchLatestRelease').mockResolvedValue({
        tag_name: 'v2.0.0',
        assets: [],
        html_url: 'https://x',
      });
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({ ignoredUpdateVersion: '2.0.0' }));

      const result = await updateChecker.checkForUpdates(true, true);

      expect(result).toEqual(expect.objectContaining({ latestVersion: '2.0.0' }));
    });

    it('devuelve null si _fetchLatestRelease resuelve null (ej. 404)', async () => {
      vi.spyOn(updateChecker, '_fetchLatestRelease').mockResolvedValue(null);

      const result = await updateChecker.checkForUpdates(true);

      expect(result).toBeNull();
    });

    it('en modo silencioso, traga el error y devuelve null', async () => {
      vi.spyOn(updateChecker, '_fetchLatestRelease').mockRejectedValue(new Error('network down'));
      vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await updateChecker.checkForUpdates(true);

      expect(result).toBeNull();
    });

    it('en modo no silencioso, relanza el error', async () => {
      vi.spyOn(updateChecker, '_fetchLatestRelease').mockRejectedValue(new Error('network down'));
      vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(updateChecker.checkForUpdates(false)).rejects.toThrow('network down');
    });
  });

  describe('startPeriodicCheck / stopPeriodicCheck', () => {
    const originalEnv = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
      vi.useRealTimers();
    });

    it('no programa ninguna verificación en NODE_ENV=development', () => {
      process.env.NODE_ENV = 'development';
      const setTimeoutSpy = vi.spyOn(global, 'setTimeout');
      const setIntervalSpy = vi.spyOn(global, 'setInterval');

      updateChecker.startPeriodicCheck();

      expect(setTimeoutSpy).not.toHaveBeenCalled();
      expect(setIntervalSpy).not.toHaveBeenCalled();
      expect(updateChecker.checkTimer).toBeNull();
    });

    it('programa un chequeo inicial (no silencioso) fuera de development', () => {
      process.env.NODE_ENV = 'test';
      vi.useFakeTimers();
      vi.spyOn(updateChecker, 'checkForUpdates').mockResolvedValue(null);

      updateChecker.startPeriodicCheck();
      vi.advanceTimersByTime(5000);

      expect(updateChecker.checkForUpdates).toHaveBeenCalledWith(false);
      expect(updateChecker.checkTimer).not.toBeNull();
    });

    it('stopPeriodicCheck limpia el intervalo activo', () => {
      process.env.NODE_ENV = 'test';
      vi.useFakeTimers();
      vi.spyOn(updateChecker, 'checkForUpdates').mockResolvedValue(null);
      updateChecker.startPeriodicCheck();
      expect(updateChecker.checkTimer).not.toBeNull();

      updateChecker.stopPeriodicCheck();

      expect(updateChecker.checkTimer).toBeNull();
    });
  });

  describe('_showUpdateDialog', () => {
    const updateInfo = {
      currentVersion: '1.0.0',
      latestVersion: '2.0.0',
      releaseNotes: 'Mejoras varias',
      downloadUrl: 'https://x/download',
    };

    it('abre el downloadUrl cuando el usuario elige "Entendido y Descargar" (response 0)', async () => {
      updateChecker.mainWindow = { webContents: {} };
      electronMocks.showMessageBox.mockResolvedValue({ response: 0 });

      await updateChecker._showUpdateDialog(updateInfo);

      expect(electronMocks.openExternal).toHaveBeenCalledWith('https://x/download');
    });

    it('ignora la versión cuando el usuario elige "No mostrar para esta versión" (response 2)', async () => {
      updateChecker.mainWindow = { webContents: {} };
      electronMocks.showMessageBox.mockResolvedValue({ response: 2 });
      vi.spyOn(fs, 'existsSync').mockReturnValue(false);
      const writeSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});

      await updateChecker._showUpdateDialog(updateInfo);

      expect(writeSpy).toHaveBeenCalledWith(
        SETTINGS_PATH,
        expect.stringContaining('"ignoredUpdateVersion": "2.0.0"'),
        'utf8'
      );
      expect(electronMocks.openExternal).not.toHaveBeenCalled();
    });

    it('no hace nada si no hay ninguna ventana disponible', async () => {
      updateChecker.mainWindow = null;
      electronMocks.getAllWindows.mockReturnValue([]);

      await updateChecker._showUpdateDialog(updateInfo);

      expect(electronMocks.showMessageBox).not.toHaveBeenCalled();
    });
  });
});
