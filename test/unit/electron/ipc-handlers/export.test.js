/**
 * export.test.js
 *
 * Tests unitarios para electron/ipc-handlers/export.js — el único canal IPC
 * 'export-document' y las tres funciones de parsing de Markdown que lo
 * respaldan (parseInlineMarkdown, parseMarkdownToDocxParagraphs,
 * renderMarkdownToPdf). Ninguna de las tres está exportada
 * (`module.exports = { registerExportHandlers }` es la única exportación),
 * así que se ejercen indirectamente a través del handler 'export-document'
 * con distintos `format` y `data.type` — igual que `_createNewSpeaker` en
 * speakerManager.js o `formatTime` en ragService.js en pases anteriores de
 * esta sesión.
 *
 * export.js hace, a nivel de módulo:
 *   const { ipcMain, dialog } = require('electron');
 *   const { Document, Packer, Paragraph, TextRun, HeadingLevel } = require('docx');
 *   const { jsPDF } = require('jspdf');
 * Los tres son CJS puro cargados con `require()` nativo (este proyecto no
 * tiene "type":"module" en package.json), así que `vi.mock()` no intercepta
 * ninguno de los tres — confirmado repetidamente en pases anteriores (ver
 * cabecera de speakerManager.test.js / speakerRepository.dbLookup.test.js).
 * Se usa el patrón establecido: inyectar mocks directamente en
 * `require.cache` de Node vía `createRequire(import.meta.url)` en
 * `beforeAll`/`afterAll`, e importar export.js dinámicamente (`await
 * import()`) dentro de `beforeEach`, nunca con un `import` estático.
 *
 * NUEVO en esta sesión: además de los requires internos, el propio
 * `ipcMain.handle` se mockea como `vi.fn((channel, cb) => { handlers[channel]
 * = cb; })` para capturar el callback real registrado y poder invocarlo
 * directamente en cada test (`await handlers['export-document'](fakeEvent,
 * args)`), en vez de tener que pasar por IPC real.
 *
 * `docx` (Document/Paragraph/TextRun) se mockea con constructores `vi.fn()`
 * que devuelven un objeto plano con las opciones recibidas — cuando una
 * función mock devuelve un objeto y se invoca con `new`, ese objeto es el
 * resultado (comportamiento estándar de JS), así que `new Paragraph(opts)`
 * produce simplemente `{ ...opts }`, permitiendo inspeccionar exactamente
 * qué construyó el parser sin tocar la librería real (que generaría binarios
 * .docx reales, frágiles de aserear).
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'fs';

const nodeRequire = createRequire(import.meta.url);
const electronPath = nodeRequire.resolve('electron');
const docxPath = nodeRequire.resolve('docx');
const jspdfPath = nodeRequire.resolve('jspdf');

let originalElectronEntry;
let originalDocxEntry;
let originalJspdfEntry;

// ── Mocks de electron ───────────────────────────────────────────────────
const handlers = {};
const ipcMainMock = {
  handle: vi.fn((channel, cb) => {
    handlers[channel] = cb;
  }),
};
const dialogMock = {
  showSaveDialog: vi.fn(),
};

// ── Mocks de docx ────────────────────────────────────────────────────────
// IMPORTANTE: el handler real hace `new Paragraph(...)` / `new Document(...)`.
// vi.fn() sólo puede usarse con `new` si su implementación es una `function`
// tradicional (las arrow functions no son constructibles) — de ahí
// `function (opts) {...}` en vez de `(opts) => ({...})` en los tres mocks.
const ParagraphMock = vi.fn(function (opts) {
  return { __kind: 'Paragraph', ...opts };
});
const TextRunMock = vi.fn(function (opts) {
  return { __kind: 'TextRun', ...opts };
});
const DocumentMock = vi.fn(function (opts) {
  return { __kind: 'Document', ...opts };
});
const PackerMock = { toBuffer: vi.fn() };
const HeadingLevelMock = { HEADING_1: 'HEADING_1', HEADING_2: 'HEADING_2', HEADING_3: 'HEADING_3' };

// ── Mock de jspdf ────────────────────────────────────────────────────────
// pageHeight configurable por test (para forzar/evitar saltos de página).
let pdfPageHeightOverride = null;
let lastPdfDoc = null;

function createFakePdfDoc() {
  return {
    internal: { pageSize: { height: pdfPageHeightOverride ?? 297 } },
    setFont: vi.fn(),
    setFontSize: vi.fn(),
    setDrawColor: vi.fn(),
    setFillColor: vi.fn(),
    line: vi.fn(),
    text: vi.fn(),
    addPage: vi.fn(),
    // Ancho == nº de caracteres: sencillo y predecible para verificar wrapping.
    getTextWidth: vi.fn((s) => (s ? s.length : 0)),
    splitTextToSize: vi.fn((text) => [text]),
    output: vi.fn(() => new ArrayBuffer(8)),
  };
}

const jsPDFMock = vi.fn(function () {
  lastPdfDoc = createFakePdfDoc();
  return lastPdfDoc;
});

beforeAll(() => {
  originalElectronEntry = nodeRequire.cache[electronPath];
  nodeRequire.cache[electronPath] = {
    id: electronPath,
    filename: electronPath,
    loaded: true,
    exports: { ipcMain: ipcMainMock, dialog: dialogMock },
  };

  originalDocxEntry = nodeRequire.cache[docxPath];
  nodeRequire.cache[docxPath] = {
    id: docxPath,
    filename: docxPath,
    loaded: true,
    exports: {
      Document: DocumentMock,
      Packer: PackerMock,
      Paragraph: ParagraphMock,
      TextRun: TextRunMock,
      HeadingLevel: HeadingLevelMock,
    },
  };

  originalJspdfEntry = nodeRequire.cache[jspdfPath];
  nodeRequire.cache[jspdfPath] = {
    id: jspdfPath,
    filename: jspdfPath,
    loaded: true,
    exports: { jsPDF: jsPDFMock },
  };
});

afterAll(() => {
  if (originalElectronEntry) nodeRequire.cache[electronPath] = originalElectronEntry;
  else delete nodeRequire.cache[electronPath];

  if (originalDocxEntry) nodeRequire.cache[docxPath] = originalDocxEntry;
  else delete nodeRequire.cache[docxPath];

  if (originalJspdfEntry) nodeRequire.cache[jspdfPath] = originalJspdfEntry;
  else delete nodeRequire.cache[jspdfPath];
});

let exportHandlers;

beforeEach(async () => {
  ipcMainMock.handle.mockClear();
  Object.keys(handlers).forEach((k) => delete handlers[k]);

  dialogMock.showSaveDialog.mockReset();
  dialogMock.showSaveDialog.mockResolvedValue({ canceled: false, filePath: '/fake/output.docx' });

  ParagraphMock.mockClear();
  TextRunMock.mockClear();
  DocumentMock.mockClear();
  PackerMock.toBuffer.mockReset();
  PackerMock.toBuffer.mockResolvedValue(Buffer.from('fake-docx-bytes'));

  jsPDFMock.mockClear();
  pdfPageHeightOverride = null;
  lastPdfDoc = null;

  vi.restoreAllMocks();
  vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});

  exportHandlers = await import('../../../../electron/ipc-handlers/export.js');
  // Se registra de nuevo en cada test para repoblar `handlers` con un
  // callback fresco; nuestro mock de ipcMain.handle simplemente sobrescribe
  // la entrada del canal, así que llamarlo varias veces no genera warnings
  // de "duplicate handler" (eso sólo pasaría contra un ipcMain real).
  exportHandlers.registerExportHandlers();
});

function docxParagraphs() {
  return DocumentMock.mock.calls[0][0].sections[0].children;
}

// ─────────────────────────────────────────────────────────────────────────
// Tier 1 — parseInlineMarkdown / parseMarkdownToDocxParagraphs / renderMarkdownToPdf
// vía export-document con data.type: 'note' (el paso más directo: paragraphs
// = parseMarkdownToDocxParagraphs(contentMd) sin nada más mezclado).
// ─────────────────────────────────────────────────────────────────────────

describe("export-document (format: 'docx', data.type: 'note') — parseMarkdownToDocxParagraphs", () => {
  async function exportNote(contentMd) {
    return handlers['export-document']({}, { data: { type: 'note', contentMd }, format: 'docx' });
  }

  it('markdown vacío → sin párrafos, Document se construye con children: []', async () => {
    const result = await exportNote('');

    expect(result).toEqual({ success: true, filePath: '/fake/output.docx' });
    expect(docxParagraphs()).toEqual([]);
  });

  it('encabezados #, ##, ### mapean a HEADING_1/2/3 respectivamente', async () => {
    await exportNote('# Título 1\n## Título 2\n### Título 3');

    const paragraphs = docxParagraphs();
    expect(paragraphs[0]).toMatchObject({ text: 'Título 1', heading: HeadingLevelMock.HEADING_1 });
    expect(paragraphs[1]).toMatchObject({ text: 'Título 2', heading: HeadingLevelMock.HEADING_2 });
    expect(paragraphs[2]).toMatchObject({ text: 'Título 3', heading: HeadingLevelMock.HEADING_3 });
  });

  it('negrita, cursiva y código inline en la misma línea se separan en segmentos con el flag correcto', async () => {
    await exportNote('Hola **negrita** y *cursiva* y `codigo` fin.');

    const [paragraph] = docxParagraphs();
    const bold = paragraph.children.find((c) => c.text === 'negrita');
    const italic = paragraph.children.find((c) => c.text === 'cursiva');
    const code = paragraph.children.find((c) => c.text === 'codigo');

    expect(bold).toMatchObject({ bold: true, italics: false, font: undefined });
    expect(italic).toMatchObject({ bold: false, italics: true, font: undefined });
    expect(code).toMatchObject({ bold: false, italics: false, font: 'Courier New' });
  });

  it('__negrita__ y _cursiva_ (delimitadores con guion bajo) también se reconocen', async () => {
    await exportNote('__negrita__ y _cursiva_');

    const [paragraph] = docxParagraphs();
    const bold = paragraph.children.find((c) => c.text === 'negrita');
    const italic = paragraph.children.find((c) => c.text === 'cursiva');

    expect(bold).toMatchObject({ bold: true });
    expect(italic).toMatchObject({ italics: true });
  });

  it('lista con viñetas ("-" y "*") produce párrafos con bullet: {level:0}', async () => {
    await exportNote('- item uno\n* item dos');

    const paragraphs = docxParagraphs();
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0].bullet).toEqual({ level: 0 });
    expect(paragraphs[0].children[0].text).toBe('item uno');
    expect(paragraphs[1].bullet).toEqual({ level: 0 });
    expect(paragraphs[1].children[0].text).toBe('item dos');
  });

  it('lista numerada ("1.", "2.") produce párrafos con numbering: {reference:"default-numbering"}', async () => {
    await exportNote('1. primero\n2. segundo');

    const paragraphs = docxParagraphs();
    expect(paragraphs[0].numbering).toEqual({ reference: 'default-numbering', level: 0 });
    expect(paragraphs[0].children[0].text).toBe('primero');
    expect(paragraphs[1].numbering).toEqual({ reference: 'default-numbering', level: 0 });
  });

  it('blockquote (">") produce un párrafo indentado con color gris', async () => {
    await exportNote('> una cita');

    const [paragraph] = docxParagraphs();
    expect(paragraph.indent).toEqual({ left: 720 });
    expect(paragraph.children[0]).toMatchObject({ text: 'una cita', color: '666666' });
  });

  it('separador horizontal ("---") produce un párrafo vacío con borde inferior', async () => {
    await exportNote('---');

    const [paragraph] = docxParagraphs();
    expect(paragraph.text).toBe('');
    expect(paragraph.border).toEqual({ bottom: { color: 'AAAAAA', space: 1, style: 'single', size: 6 } });
  });

  it('párrafo plano sin ninguna sintaxis Markdown se conserva literal', async () => {
    await exportNote('Un párrafo totalmente plano sin marcas.');

    const [paragraph] = docxParagraphs();
    expect(paragraph.children).toEqual([
      { __kind: 'TextRun', text: 'Un párrafo totalmente plano sin marcas.', bold: false, italics: false, font: undefined },
    ]);
  });

  it('líneas en blanco consecutivas y espacios finales: cada línea vacía es un párrafo {text:""}, el trailing whitespace se recorta', async () => {
    await exportNote('Linea1\n\n\nLinea2   \n');

    const paragraphs = docxParagraphs();
    // split('\n') de 'Linea1\n\n\nLinea2   \n' produce 5 elementos.
    expect(paragraphs).toHaveLength(5);
    expect(paragraphs[0].children[0].text).toBe('Linea1');
    expect(paragraphs[1]).toEqual({ __kind: 'Paragraph', text: '' });
    expect(paragraphs[2]).toEqual({ __kind: 'Paragraph', text: '' });
    // El espacio final se recorta (trim) antes de parsear la línea.
    expect(paragraphs[3].children[0].text).toBe('Linea2');
    expect(paragraphs[4]).toEqual({ __kind: 'Paragraph', text: '' });
  });

  it('BOUNDARY / hallazgo: negrita sin cerrar ("**bold sin cerrar") no lanza, pero genera un segmento cursiva vacío antes del texto plano', async () => {
    // Documenta el comportamiento real (no un fix): el regex de
    // parseInlineMarkdown intenta primero el patrón de negrita (**...**),
    // que falla al no encontrar cierre; al retroceder, el patrón de
    // cursiva (*...*) SÍ encuentra un cierre casual en el segundo asterisco
    // consecutivo, produciendo un segmento {text:'', italic:true} — que al
    // renderizarse como TextRun con texto vacío es efectivamente invisible,
    // así que las "**" simplemente desaparecen sin ningún indicio de que el
    // markdown estaba mal formado.
    await exportNote('**bold sin cerrar');

    const [paragraph] = docxParagraphs();
    expect(paragraph.children[0]).toMatchObject({ text: '', italics: true, bold: false });
    expect(paragraph.children[1]).toMatchObject({ text: 'bold sin cerrar', bold: false, italics: false });
  });
});

describe("export-document (format: 'pdf', data.type: 'note') — renderMarkdownToPdf", () => {
  async function exportNotePdf(contentMd) {
    return handlers['export-document']({}, { data: { type: 'note', contentMd }, format: 'pdf' });
  }

  it('markdown vacío no lanza y devuelve success', async () => {
    const result = await exportNotePdf('');
    expect(result).toEqual({ success: true, filePath: '/fake/output.docx' });
  });

  it('renderiza texto (doc.text llamado) para un párrafo plano', async () => {
    await exportNotePdf('Hola mundo');
    expect(lastPdfDoc.text).toHaveBeenCalled();
  });

  it('paginación: contenido que excede pageHeight dispara doc.addPage()', async () => {
    // pageHeight reducido a propósito para forzar el salto de página con
    // pocas líneas (cada línea normal avanza ~7pt: 6 dentro del wrap-loop + 1
    // fuera; con pageHeight=50 y margin=20 el umbral se cruza en la 2ª línea).
    pdfPageHeightOverride = 50;

    await exportNotePdf('Primera linea de texto\nSegunda linea de texto\nTercera linea de texto');

    expect(lastPdfDoc.addPage).toHaveBeenCalled();
  });

  it('sin forzar pageHeight pequeño, un documento corto NO dispara addPage', async () => {
    await exportNotePdf('Una sola linea corta');
    expect(lastPdfDoc.addPage).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// export-document (data SIN type==='note' → rama "recording/project export")
// Ejercita el otro camino que también usa parseMarkdownToDocxParagraphs /
// parseInlineMarkdown (para summary/detailedSummary/highlights), además de
// su propia lógica de armado de docChildren (participantes, transcripción).
// ─────────────────────────────────────────────────────────────────────────

describe("export-document (rama grabación/proyecto, sin data.type)", () => {
  function baseData(overrides = {}) {
    return {
      title: 'Reunión de equipo',
      date: '2024-01-01',
      ...overrides,
    };
  }

  it("format 'md': arma el markdown con todas las secciones presentes", async () => {
    await handlers['export-document'](
      {},
      {
        format: 'md',
        data: baseData({
          participants: [{ name: 'Ana', role: 'PM' }],
          summary: 'Resumen corto',
          detailedSummary: 'Resumen detallado',
          highlights: ['Punto clave'],
          transcription: [{ speaker: 'Ana', timestamp: '0:05', text: 'Hola' }],
        }),
      }
    );

    const writtenContent = fs.writeFileSync.mock.calls[0][1];
    expect(writtenContent).toContain('# Reunión de equipo');
    expect(writtenContent).toContain('**Date:** 2024-01-01');
    expect(writtenContent).toContain('## Participants');
    expect(writtenContent).toContain('- Ana (PM)');
    expect(writtenContent).toContain('## Summary\nResumen corto');
    expect(writtenContent).toContain('## Detailed Summary\nResumen detallado');
    expect(writtenContent).toContain('## Key Highlights\n- Punto clave');
    expect(writtenContent).toContain('## Transcription');
    expect(writtenContent).toContain('**Ana** [0:05]: Hola');
  });

  it("format 'md': datos mínimos (sin participants/summary/highlights/transcription) sólo incluye título y fecha", async () => {
    await handlers['export-document']({}, { format: 'md', data: baseData() });

    const writtenContent = fs.writeFileSync.mock.calls[0][1];
    expect(writtenContent).toBe('# Reunión de equipo\n\n**Date:** 2024-01-01\n\n');
  });

  it("format 'docx': participantes sin role no añaden paréntesis vacío", async () => {
    await handlers['export-document'](
      {},
      { format: 'docx', data: baseData({ participants: [{ name: 'Sin Rol' }] }) }
    );

    const paragraphs = docxParagraphs();
    const participantParagraph = paragraphs.find((p) => p.bullet && p.children?.some((c) => c.text === 'Sin Rol'));
    const roleRun = participantParagraph.children.find((c) => c.text !== 'Sin Rol');
    expect(roleRun.text).toBe('');
  });

  it("format 'docx': items de transcripción sin speaker/timestamp usan los fallbacks 'Speaker' / '0:00'", async () => {
    await handlers['export-document'](
      {},
      {
        format: 'docx',
        data: baseData({ transcription: [{ text: 'mensaje sin metadata' }] }),
      }
    );

    const paragraphs = docxParagraphs();
    const transcriptionParagraph = paragraphs.find((p) =>
      p.children?.some((c) => typeof c.text === 'string' && c.text.startsWith('Speaker ['))
    );
    expect(transcriptionParagraph.children[0].text).toBe('Speaker [0:00]: ');
  });

  it("format 'pdf': título y fecha se escriben en el documento (smoke test de la rama completa)", async () => {
    await handlers['export-document'](
      {},
      {
        format: 'pdf',
        data: baseData({
          participants: [{ name: 'Ana', role: 'PM' }],
          summary: 'Resumen',
          highlights: ['Uno'],
          transcription: [{ speaker: 'Ana', timestamp: '0:05', text: 'Hola' }],
        }),
      }
    );

    expect(lastPdfDoc.text).toHaveBeenCalledWith('Reunión de equipo', 20, expect.any(Number));
    expect(lastPdfDoc.text).toHaveBeenCalledWith('Date: 2024-01-01', 20, expect.any(Number));
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Tier 2 — validación propia del handler export-document
// ─────────────────────────────────────────────────────────────────────────

describe('export-document — validación y casos límite del handler', () => {
  it('data ausente (undefined) → capturado por el catch externo, success:false con el mensaje del error', async () => {
    const result = await handlers['export-document']({}, { data: undefined, format: 'docx' });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Cannot read propert/);
    expect(console.error).toHaveBeenCalled();
  });

  it('diálogo cancelado (canceled:true) → devuelve {success:true, canceled:true} sin escribir archivo', async () => {
    dialogMock.showSaveDialog.mockResolvedValue({ canceled: true, filePath: undefined });

    const result = await handlers['export-document'](
      {},
      { data: { type: 'note', contentMd: 'x' }, format: 'docx' }
    );

    expect(result).toEqual({ success: true, canceled: true });
    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });

  it('diálogo sin filePath (falsy) aunque canceled sea false → también se trata como cancelado', async () => {
    dialogMock.showSaveDialog.mockResolvedValue({ canceled: false, filePath: '' });

    const result = await handlers['export-document'](
      {},
      { data: { title: 'x', date: 'y' }, format: 'md' }
    );

    expect(result).toEqual({ success: true, canceled: true });
    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });

  it("BOUNDARY / hallazgo: format desconocido (ej. 'txt') no lanza ni escribe archivo, pero igualmente reporta success:true con filePath", async () => {
    // Documenta una inconsistencia real del handler: ninguna de las ramas
    // if/else if (md/docx/pdf) cubre un `format` no soportado, así que el
    // flujo simplemente "cae" hasta el `return { success: true, filePath }`
    // final sin haber escrito nada a disco. La UI recibiría una confirmación
    // de éxito para una exportación que en realidad no ocurrió.
    dialogMock.showSaveDialog.mockResolvedValue({ canceled: false, filePath: '/fake/output.txt' });

    const result = await handlers['export-document'](
      {},
      { data: { type: 'note', contentMd: 'contenido' }, format: 'txt' }
    );

    expect(result).toEqual({ success: true, filePath: '/fake/output.txt' });
    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });
});
