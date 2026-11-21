import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { writeSettingsFileAtomic } from '../../../../electron/utils/settingsWriter.js';

let tmpDir;
let settingsPath;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'settings-writer-test-'));
  settingsPath = path.join(tmpDir, 'settings.json');
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('writeSettingsFileAtomic', () => {
  it('escribe el contenido en la ruta final', async () => {
    await writeSettingsFileAtomic(settingsPath, '{"a":1}');

    expect(fs.readFileSync(settingsPath, 'utf8')).toBe('{"a":1}');
  });

  it('crea el directorio si no existe', async () => {
    const nestedPath = path.join(tmpDir, 'sub', 'dir', 'settings.json');

    await writeSettingsFileAtomic(nestedPath, '{"a":1}');

    expect(fs.readFileSync(nestedPath, 'utf8')).toBe('{"a":1}');
  });

  it('serializa escrituras concurrentes: las dos terminan y la última gana', async () => {
    // Con el bug original (tmp de nombre fijo), el segundo rename fallaba con
    // ENOENT porque el primero ya se había llevado el .tmp.
    await Promise.all([
      writeSettingsFileAtomic(settingsPath, '{"n":1}'),
      writeSettingsFileAtomic(settingsPath, '{"n":2}'),
    ]);

    expect(JSON.parse(fs.readFileSync(settingsPath, 'utf8')).n).toBe(2);
  });

  it('una escritura fallida no envenena la cola: la siguiente se ejecuta', async () => {
    // Metemos un error inyectando una ruta imposible (directorio como padre inválido)
    const badPath = path.join(tmpDir, 'file.txt', 'settings.json');
    fs.writeFileSync(path.join(tmpDir, 'file.txt'), 'no es un directorio');

    await expect(writeSettingsFileAtomic(badPath, '{"a":1}')).rejects.toThrow();

    await writeSettingsFileAtomic(settingsPath, '{"a":1}');
    expect(fs.readFileSync(settingsPath, 'utf8')).toBe('{"a":1}');
  });

  it('un fallo en el rename no deja el .tmp huérfano', async () => {
    // rename falla si el destino es un directorio existente
    const dirAsTarget = path.join(tmpDir, 'target-dir');
    fs.mkdirSync(dirAsTarget);

    await expect(writeSettingsFileAtomic(dirAsTarget, '{"a":1}')).rejects.toThrow();

    const leftovers = fs.readdirSync(tmpDir).filter((f) => f.includes('.tmp'));
    expect(leftovers).toEqual([]);
  });
});
