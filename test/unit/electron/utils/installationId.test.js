import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// installationId.js deriva su ruta de `settingsPath`, importado con
// `require('./paths')`. paths.js real depende de Electron (app.getPath) y de
// dbService (better-sqlite3 nativo) — pero `vi.mock` no puede interceptar ese
// require porque paths.js es CJS puro (sin sintaxis import/export, sin
// "type": "module" en package.json) y Vitest lo carga vía el `require` nativo
// de Node en vez de instrumentarlo, así que los mocks registrados con
// `vi.mock` nunca lo ven (confirmado probándolo). En su lugar, inyectamos
// directamente en `require.cache` de Node (compartido sin importar si el
// require es nativo o instrumentado) un paths.js falso con un settingsPath
// fijo, evitando así arrastrar Electron/SQLite para testear una utilidad que
// solo usa fs/crypto. Guardamos/restauramos la entrada original en
// beforeAll/afterAll para no filtrar el mock a otros archivos de test.
const nodeRequire = createRequire(import.meta.url);
const pathsPath = nodeRequire.resolve('../../../../electron/utils/paths.js');
const FAKE_SETTINGS_PATH = '/fake/userData/settings.json';
let originalPathsEntry;

beforeAll(() => {
  originalPathsEntry = nodeRequire.cache[pathsPath];
  nodeRequire.cache[pathsPath] = {
    id: pathsPath,
    filename: pathsPath,
    loaded: true,
    exports: { settingsPath: FAKE_SETTINGS_PATH },
  };
});

afterAll(() => {
  if (originalPathsEntry) nodeRequire.cache[pathsPath] = originalPathsEntry;
  else delete nodeRequire.cache[pathsPath];
});

describe('installationId', () => {
  let installationIdModule;
  const installationIdPath = path.join('/fake/userData', 'installation-id.json');

  beforeEach(async () => {
    installationIdModule = await import('../../../../electron/utils/installationId.js');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('devuelve el id existente si el archivo ya existe y es válido', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({ id: 'existing-id-123' }));
    const writeSpy = vi.spyOn(fs, 'writeFileSync');

    const id = installationIdModule.getOrCreateInstallationId();

    expect(id).toBe('existing-id-123');
    expect(writeSpy).not.toHaveBeenCalled();
  });

  it('genera y persiste un nuevo id si el archivo no existe', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('new-uuid-1234');
    const mkdirSpy = vi.spyOn(fs, 'mkdirSync').mockImplementation(() => {});
    const writeSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});

    const id = installationIdModule.getOrCreateInstallationId();

    expect(id).toBe('new-uuid-1234');
    expect(mkdirSpy).toHaveBeenCalledWith(path.dirname(installationIdPath), { recursive: true });
    expect(writeSpy).toHaveBeenCalledWith(
      installationIdPath,
      JSON.stringify({ id: 'new-uuid-1234' }, null, 2)
    );
  });

  it('regenera el id si el archivo existe pero el JSON está corrupto', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue('{ esto no es JSON');
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('regenerated-uuid');
    vi.spyOn(fs, 'mkdirSync').mockImplementation(() => {});
    const writeSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const id = installationIdModule.getOrCreateInstallationId();

    expect(id).toBe('regenerated-uuid');
    expect(writeSpy).toHaveBeenCalled();
  });

  it('regenera el id si el archivo existe pero el campo "id" está ausente/vacío', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({}));
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('fallback-uuid');
    vi.spyOn(fs, 'mkdirSync').mockImplementation(() => {});
    vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});

    const id = installationIdModule.getOrCreateInstallationId();

    expect(id).toBe('fallback-uuid');
  });

  it('devuelve el nuevo id igualmente si falla la escritura a disco (no lanza)', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('uuid-write-fails');
    vi.spyOn(fs, 'mkdirSync').mockImplementation(() => {});
    vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {
      throw new Error('ENOSPC');
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const id = installationIdModule.getOrCreateInstallationId();

    expect(id).toBe('uuid-write-fails');
  });

  it('no lanza si mkdirSync falla al crear el directorio de destino', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('uuid-mkdir-fails');
    vi.spyOn(fs, 'mkdirSync').mockImplementation(() => {
      throw new Error('EACCES');
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => installationIdModule.getOrCreateInstallationId()).not.toThrow();
  });
});
