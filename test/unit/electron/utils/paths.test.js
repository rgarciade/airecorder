import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'fs';
import path from 'path';

// paths.js hace `require('electron')` y `require('../database/dbService')` a
// nivel de módulo. Ninguno de los dos se puede interceptar con `vi.mock`: este
// proyecto no tiene `"type": "module"` en package.json, así que paths.js es CJS
// puro (sin sintaxis import/export) y Vitest lo carga con el `require` nativo de
// Node en lugar de pasarlo por su graph de módulos instrumentado — por eso los
// requires *dentro* de paths.js no ven los mocks registrados con `vi.mock`
// (confirmado probándolo: `vi.mock('electron', ...)` no tenía efecto aquí).
// Fuera de un proceso Electron real, `require('electron')` devuelve un STRING
// (la ruta al binario), no `{ app, dialog, ... }`, así que sin este workaround
// paths.js explota al importarse con "Cannot read properties of undefined
// (reading 'getPath')".
//
// Workaround: inyectamos directamente en `require.cache` de Node (que SÍ es
// compartido por cualquier `require`, nativo o instrumentado) antes de importar
// paths.js. Guardamos y restauramos las entradas originales en
// beforeAll/afterAll para no filtrar el mock a otros archivos de test que
// corran en el mismo worker.
const nodeRequire = createRequire(import.meta.url);

const getPathMock = vi.fn((name) => (name === 'desktop' ? '/fake/desktop' : '/fake/userData'));
const dbMocks = { prepare: vi.fn() };

const electronPath = nodeRequire.resolve('electron');
const dbServicePath = nodeRequire.resolve('../../../../electron/database/dbService.js');
let originalElectronEntry;
let originalDbServiceEntry;

beforeAll(() => {
  originalElectronEntry = nodeRequire.cache[electronPath];
  nodeRequire.cache[electronPath] = {
    id: electronPath,
    filename: electronPath,
    loaded: true,
    exports: { app: { getPath: getPathMock } },
  };

  originalDbServiceEntry = nodeRequire.cache[dbServicePath];
  nodeRequire.cache[dbServicePath] = {
    id: dbServicePath,
    filename: dbServicePath,
    loaded: true,
    exports: { db: { prepare: dbMocks.prepare } },
  };
});

afterAll(() => {
  if (originalElectronEntry) nodeRequire.cache[electronPath] = originalElectronEntry;
  else delete nodeRequire.cache[electronPath];

  if (originalDbServiceEntry) nodeRequire.cache[dbServicePath] = originalDbServiceEntry;
  else delete nodeRequire.cache[dbServicePath];
});

describe('paths', () => {
  let pathsModule;
  let settingsPath;
  const desktopBase = path.join('/fake/desktop', 'recorder');

  beforeEach(async () => {
    dbMocks.prepare.mockReset();
    pathsModule = await import('../../../../electron/utils/paths.js');
    settingsPath = pathsModule.settingsPath;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calcula DEFAULT_BASE_RECORDER_PATH, PROJECTS_PATH y settingsPath a partir de app.getPath', () => {
    expect(pathsModule.DEFAULT_BASE_RECORDER_PATH).toBe(desktopBase);
    expect(pathsModule.PROJECTS_PATH).toBe(path.join(desktopBase, 'projects'));
    expect(settingsPath).toBe(path.join('/fake/userData', 'settings.json'));
  });

  describe('getRecordingsPath', () => {
    it('usa la ruta por defecto "grabaciones" si settings.json no existe', async () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(false);

      const result = await pathsModule.getRecordingsPath();

      expect(result).toBe(path.join(desktopBase, 'grabaciones'));
    });

    it('usa settings.outputDirectory cuando está presente', async () => {
      vi.spyOn(fs, 'existsSync').mockImplementation((p) => p === settingsPath);
      vi.spyOn(fs.promises, 'readFile').mockResolvedValue(
        JSON.stringify({ outputDirectory: '/custom/output' })
      );

      const result = await pathsModule.getRecordingsPath();

      expect(result).toBe('/custom/output');
    });

    it('COMPATIBILIDAD: devuelve <outputDirectory>/grabaciones si esa subcarpeta existe', async () => {
      vi.spyOn(fs, 'existsSync').mockImplementation((p) => {
        if (p === settingsPath) return true;
        if (p === path.join('/custom/output', 'grabaciones')) return true;
        return false;
      });
      vi.spyOn(fs.promises, 'readFile').mockResolvedValue(
        JSON.stringify({ outputDirectory: '/custom/output' })
      );

      const result = await pathsModule.getRecordingsPath();

      expect(result).toBe(path.join('/custom/output', 'grabaciones'));
    });

    it('ignora settings.json sin outputDirectory y usa el default', async () => {
      vi.spyOn(fs, 'existsSync').mockImplementation((p) => p === settingsPath);
      vi.spyOn(fs.promises, 'readFile').mockResolvedValue(JSON.stringify({ theme: 'dark' }));

      const result = await pathsModule.getRecordingsPath();

      expect(result).toBe(path.join(desktopBase, 'grabaciones'));
    });

    it('si settings.json está corrupto, lo renombra a .corrupt.bak y cae al default sin lanzar', async () => {
      vi.spyOn(fs, 'existsSync').mockImplementation((p) => p === settingsPath);
      vi.spyOn(fs.promises, 'readFile').mockResolvedValue('{ esto no es JSON');
      const renameSpy = vi.spyOn(fs, 'renameSync').mockImplementation(() => {});
      vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await pathsModule.getRecordingsPath();

      expect(renameSpy).toHaveBeenCalledWith(settingsPath, `${settingsPath}.corrupt.bak`);
      expect(result).toBe(path.join(desktopBase, 'grabaciones'));
    });

    it('no lanza si el propio renameSync de recuperación también falla', async () => {
      vi.spyOn(fs, 'existsSync').mockImplementation((p) => p === settingsPath);
      vi.spyOn(fs.promises, 'readFile').mockResolvedValue('{ esto no es JSON');
      vi.spyOn(fs, 'renameSync').mockImplementation(() => {
        throw new Error('EBUSY');
      });
      vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(console, 'warn').mockImplementation(() => {});

      await expect(pathsModule.getRecordingsPath()).resolves.toBe(
        path.join(desktopBase, 'grabaciones')
      );
    });
  });

  describe('getFolderPathFromId', () => {
    it('consulta la DB y devuelve relative_path para un id numérico existente', async () => {
      dbMocks.prepare.mockReturnValue({ get: vi.fn().mockReturnValue({ relative_path: 'foo/bar' }) });

      const result = await pathsModule.getFolderPathFromId(42);

      expect(result).toBe('foo/bar');
    });

    it('acepta un id numérico expresado como string', async () => {
      dbMocks.prepare.mockReturnValue({ get: vi.fn().mockReturnValue({ relative_path: 'foo/bar' }) });

      const result = await pathsModule.getFolderPathFromId('42');

      expect(result).toBe('foo/bar');
    });

    it('devuelve recordingId.toString() si la DB no encuentra el registro', async () => {
      dbMocks.prepare.mockReturnValue({ get: vi.fn().mockReturnValue(undefined) });

      const result = await pathsModule.getFolderPathFromId(99);

      expect(result).toBe('99');
    });

    it('devuelve recordingId.toString() si relative_path está vacío', async () => {
      dbMocks.prepare.mockReturnValue({ get: vi.fn().mockReturnValue({ relative_path: '' }) });

      const result = await pathsModule.getFolderPathFromId(7);

      expect(result).toBe('7');
    });

    it('para un id no numérico, devuelve el valor tal cual sin consultar la DB', async () => {
      const result = await pathsModule.getFolderPathFromId('proyecto/reunion-2024');

      expect(result).toBe('proyecto/reunion-2024');
      expect(dbMocks.prepare).not.toHaveBeenCalled();
    });

    it('edge case: un string vacío se trata como id numérico porque Number("") === 0', async () => {
      dbMocks.prepare.mockReturnValue({ get: vi.fn().mockReturnValue(undefined) });

      const result = await pathsModule.getFolderPathFromId('');

      expect(dbMocks.prepare).toHaveBeenCalled();
      expect(result).toBe('');
    });
  });

  describe('getSetting', () => {
    it('devuelve el defaultValue si settings.json no existe', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(false);
      expect(pathsModule.getSetting('theme', 'system')).toBe('system');
    });

    it('devuelve null como default implícito si no se pasa defaultValue', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(false);
      expect(pathsModule.getSetting('theme')).toBeNull();
    });

    it('devuelve el valor del setting si existe', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({ theme: 'dark' }));

      expect(pathsModule.getSetting('theme', 'system')).toBe('dark');
    });

    it('devuelve el defaultValue si la clave no está presente en settings.json', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({ other: 1 }));

      expect(pathsModule.getSetting('theme', 'system')).toBe('system');
    });

    it('devuelve el defaultValue y no lanza si el JSON está corrupto', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync').mockReturnValue('{ corrupto');
      vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(pathsModule.getSetting('theme', 'system')).toBe('system');
    });
  });
});
