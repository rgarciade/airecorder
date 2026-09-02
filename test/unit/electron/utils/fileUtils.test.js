import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  IMAGE_EXTENSIONS,
  TEXT_EXTENSIONS,
  PDF_EXTENSIONS,
  EXCEL_EXTENSIONS,
  SUPPORTED_EXTENSIONS,
  getAttachmentType,
  sanitizeFilename,
  sanitizeFolderName,
  resolveFilename,
} from '../../../../electron/utils/fileUtils.js';

describe('getAttachmentType', () => {
  it('detecta imágenes (.png, .jpg, .webp)', () => {
    expect(getAttachmentType('foto.png')).toBe('image');
    expect(getAttachmentType('foto.jpg')).toBe('image');
    expect(getAttachmentType('foto.webp')).toBe('image');
  });

  it('detecta PDF', () => {
    expect(getAttachmentType('documento.pdf')).toBe('pdf');
  });

  it('detecta texto plano y markdown', () => {
    expect(getAttachmentType('notas.txt')).toBe('text');
    expect(getAttachmentType('notas.md')).toBe('text');
  });

  it('detecta Excel (.xlsx, .xls)', () => {
    expect(getAttachmentType('reporte.xlsx')).toBe('excel');
    expect(getAttachmentType('reporte.xls')).toBe('excel');
  });

  it('es case-insensitive con la extensión', () => {
    expect(getAttachmentType('FOTO.PNG')).toBe('image');
    expect(getAttachmentType('DOC.PDF')).toBe('pdf');
  });

  it('devuelve "unknown" para extensiones no soportadas', () => {
    expect(getAttachmentType('audio.mp3')).toBe('unknown');
  });

  it('devuelve "unknown" para archivos sin extensión', () => {
    expect(getAttachmentType('README')).toBe('unknown');
  });
});

describe('sanitizeFilename', () => {
  it('elimina caracteres inválidos de sistemas de archivos', () => {
    expect(sanitizeFilename('a<b>c:d"e/f\\g|h?i*j')).toBe('abcdefghij');
  });

  it('recorta espacios al inicio y al final', () => {
    expect(sanitizeFilename('  archivo con espacios  ')).toBe('archivo con espacios');
  });

  it('usa el nombre por defecto cuando el resultado queda vacío tras sanitizar', () => {
    expect(sanitizeFilename('///???', 'sin-nombre')).toBe('sin-nombre');
  });

  it('usa "archivo" como default si no se especifica uno', () => {
    expect(sanitizeFilename('***')).toBe('archivo');
  });

  it('con forcedExt: quita la extensión existente si coincide (case-insensitive) y la vuelve a poner', () => {
    expect(sanitizeFilename('notas.TXT', 'archivo', '.txt')).toBe('notas.txt');
  });

  it('con forcedExt: si la extensión original NO coincide, la concatena en vez de reemplazarla (comportamiento real, no un cambio de extensión)', () => {
    expect(sanitizeFilename('notas.md', 'archivo', '.txt')).toBe('notas.md.txt');
  });

  it('sin forcedExt respeta la extensión original', () => {
    expect(sanitizeFilename('reporte.pdf')).toBe('reporte.pdf');
  });
});

describe('sanitizeFolderName', () => {
  it('reemplaza caracteres no permitidos por guion bajo', () => {
    expect(sanitizeFolderName('Proyecto: Fase 1/2?')).toBe('Proyecto__Fase_1_2_');
  });

  it('conserva letras acentuadas y ñ', () => {
    expect(sanitizeFolderName('Reunión Añón')).toBe('Reunión_Añón');
  });

  it('conserva guiones y guion bajo existentes', () => {
    expect(sanitizeFolderName('mi-carpeta_final')).toBe('mi-carpeta_final');
  });

  it('trunca al maxLength por defecto (200)', () => {
    const longName = 'a'.repeat(250);
    expect(sanitizeFolderName(longName)).toHaveLength(200);
  });

  it('respeta un maxLength personalizado', () => {
    expect(sanitizeFolderName('nombre-muy-largo', 5)).toBe('nombr');
  });
});

describe('resolveFilename', () => {
  const targetDir = '/tmp/fake-dir';

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('devuelve el nombre sanitizado tal cual si no hay colisión', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    expect(resolveFilename('conversacion.txt', targetDir)).toBe('conversacion.txt');
  });

  it('agrega sufijo _1 si el archivo ya existe', () => {
    vi.spyOn(fs, 'existsSync').mockImplementation(
      (p) => p === path.join(targetDir, 'conversacion.txt')
    );
    expect(resolveFilename('conversacion.txt', targetDir)).toBe('conversacion_1.txt');
  });

  it('incrementa el contador hasta encontrar un nombre libre', () => {
    const taken = new Set([
      path.join(targetDir, 'conversacion.txt'),
      path.join(targetDir, 'conversacion_1.txt'),
      path.join(targetDir, 'conversacion_2.txt'),
    ]);
    vi.spyOn(fs, 'existsSync').mockImplementation((p) => taken.has(p));
    expect(resolveFilename('conversacion.txt', targetDir)).toBe('conversacion_3.txt');
  });

  it('usa el nombre y extensión por defecto cuando baseFilename está vacío', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    expect(resolveFilename('', targetDir)).toBe('Conversacion pegada.txt');
  });

  it('respeta una forcedExt y defaultName personalizados', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    expect(resolveFilename('nota', targetDir, 'default', '.md')).toBe('nota.md');
  });
});

describe('constantes de extensiones soportadas', () => {
  it('SUPPORTED_EXTENSIONS es la unión de todas las categorías', () => {
    expect(SUPPORTED_EXTENSIONS).toEqual([
      ...IMAGE_EXTENSIONS,
      ...TEXT_EXTENSIONS,
      ...PDF_EXTENSIONS,
      ...EXCEL_EXTENSIONS,
    ]);
  });
});
