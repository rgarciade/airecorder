const { ipcMain, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const { Document, Packer, Paragraph, TextRun, HeadingLevel } = require('docx');
const { jsPDF } = require('jspdf');

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS: Parser de Markdown en línea (negritas, cursivas, código)
// Devuelve un array de segmentos: [{ text, bold, italic, code }]
// ─────────────────────────────────────────────────────────────────────────────
function parseInlineMarkdown(line) {
  const segments = [];
  // Regex que captura: **bold**, *italic*, __bold__, _italic_, `code`
  const re = /(\*\*|__)(.*?)\1|(\*|_)(.*?)\3|`([^`]+)`|([^*_`]+)/g;
  let match;
  while ((match = re.exec(line)) !== null) {
    if (match[1] && match[2] !== undefined) {
      // **bold** o __bold__
      segments.push({ text: match[2], bold: true, italic: false, code: false });
    } else if (match[3] && match[4] !== undefined) {
      // *italic* o _italic_
      segments.push({ text: match[4], bold: false, italic: true, code: false });
    } else if (match[5] !== undefined) {
      // `code`
      segments.push({ text: match[5], bold: false, italic: false, code: true });
    } else if (match[6] !== undefined) {
      // texto plano
      segments.push({ text: match[6], bold: false, italic: false, code: false });
    }
  }
  return segments.length > 0 ? segments : [{ text: line, bold: false, italic: false, code: false }];
}

// ─────────────────────────────────────────────────────────────────────────────
// DOCX: Convierte texto Markdown en array de Paragraph de la librería docx
// Soporta: # H1, ## H2, ### H3, - lista, * lista, 1. lista numerada,
//          > blockquote, negritas, cursivas, código inline, párrafos normales
// ─────────────────────────────────────────────────────────────────────────────
function parseMarkdownToDocxParagraphs(text) {
  if (!text) return [];
  const lines = text.split('\n');
  const paragraphs = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === '') {
      paragraphs.push(new Paragraph({ text: '' }));
      continue;
    }

    // Headings
    if (trimmed.startsWith('### ')) {
      const content = trimmed.slice(4);
      paragraphs.push(new Paragraph({
        text: content,
        heading: HeadingLevel.HEADING_3,
      }));
      continue;
    }
    if (trimmed.startsWith('## ')) {
      const content = trimmed.slice(3);
      paragraphs.push(new Paragraph({
        text: content,
        heading: HeadingLevel.HEADING_2,
      }));
      continue;
    }
    if (trimmed.startsWith('# ')) {
      const content = trimmed.slice(2);
      paragraphs.push(new Paragraph({
        text: content,
        heading: HeadingLevel.HEADING_1,
      }));
      continue;
    }

    // Listas con viñeta (-, *, +)
    const bulletMatch = trimmed.match(/^[-*+]\s+(.*)/);
    if (bulletMatch) {
      const segments = parseInlineMarkdown(bulletMatch[1]);
      paragraphs.push(new Paragraph({
        bullet: { level: 0 },
        children: segments.map(s => new TextRun({
          text: s.text,
          bold: s.bold,
          italics: s.italic,
          font: s.code ? 'Courier New' : undefined,
        })),
      }));
      continue;
    }

    // Listas numeradas (1. 2. etc.)
    const numberedMatch = trimmed.match(/^\d+\.\s+(.*)/);
    if (numberedMatch) {
      const segments = parseInlineMarkdown(numberedMatch[1]);
      paragraphs.push(new Paragraph({
        numbering: { reference: 'default-numbering', level: 0 },
        children: segments.map(s => new TextRun({
          text: s.text,
          bold: s.bold,
          italics: s.italic,
          font: s.code ? 'Courier New' : undefined,
        })),
      }));
      continue;
    }

    // Blockquote (>)
    const blockquoteMatch = trimmed.match(/^>\s*(.*)/);
    if (blockquoteMatch) {
      const segments = parseInlineMarkdown(blockquoteMatch[1]);
      paragraphs.push(new Paragraph({
        indent: { left: 720 },
        children: segments.map(s => new TextRun({
          text: s.text,
          bold: s.bold,
          italics: s.italic,
          color: '666666',
        })),
      }));
      continue;
    }

    // Separador horizontal (---, ___, ***)
    if (/^[-*_]{3,}$/.test(trimmed)) {
      paragraphs.push(new Paragraph({
        border: { bottom: { color: 'AAAAAA', space: 1, style: 'single', size: 6 } },
        text: '',
      }));
      continue;
    }

    // Párrafo normal con formato inline
    const segments = parseInlineMarkdown(trimmed);
    paragraphs.push(new Paragraph({
      children: segments.map(s => new TextRun({
        text: s.text,
        bold: s.bold,
        italics: s.italic,
        font: s.code ? 'Courier New' : undefined,
      })),
    }));
  }

  return paragraphs;
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF: Renderiza texto Markdown en un documento jsPDF
// Devuelve la nueva posición Y tras renderizar
// ─────────────────────────────────────────────────────────────────────────────
function renderMarkdownToPdf(doc, text, margin, maxWidth, startY, pageHeight) {
  if (!text) return startY;
  let y = startY;

  const checkPageBreak = (needed) => {
    if (y + needed > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  // Renderiza una línea con segmentos bold/italic/normal usando jsPDF
  const renderInlineLine = (segments, x, lineY, lineHeight) => {
    let cursorX = x;
    segments.forEach(seg => {
      if (!seg.text) return;
      const fontStyle = seg.bold && seg.italic ? 'bolditalic'
        : seg.bold ? 'bold'
        : seg.italic ? 'italic'
        : 'normal';
      doc.setFont('helvetica', fontStyle);
      doc.text(seg.text, cursorX, lineY);
      cursorX += doc.getTextWidth(seg.text);
    });
    doc.setFont('helvetica', 'normal'); // reset
  };

  // Renderiza texto con posibles negritas/cursivas, haciendo word-wrap
  const renderInlineWrapped = (rawLine, indentX, lineH) => {
    const segments = parseInlineMarkdown(rawLine);
    // Construir palabras con su estilo asignado
    const words = [];
    segments.forEach(seg => {
      const fontStyle = seg.bold && seg.italic ? 'bolditalic'
        : seg.bold ? 'bold'
        : seg.italic ? 'italic'
        : 'normal';
      // Dividir por espacios pero preservar el estilo
      const parts = seg.text.split(/(\s+)/);
      parts.forEach(part => {
        if (part !== '') words.push({ text: part, fontStyle });
      });
    });

    // Agrupar palabras en líneas según maxWidth
    const lines = [];
    let currentLine = [];
    let currentWidth = 0;
    const availableWidth = maxWidth - (indentX - margin);

    words.forEach(word => {
      doc.setFont('helvetica', word.fontStyle);
      const wordWidth = doc.getTextWidth(word.text);
      if (currentWidth + wordWidth > availableWidth && currentLine.length > 0) {
        lines.push(currentLine);
        currentLine = [word];
        currentWidth = wordWidth;
      } else {
        currentLine.push(word);
        currentWidth += wordWidth;
      }
    });
    if (currentLine.length > 0) lines.push(currentLine);

    lines.forEach(lineWords => {
      checkPageBreak(lineH);
      let cursorX = indentX;
      lineWords.forEach(word => {
        if (!word.text) return;
        doc.setFont('helvetica', word.fontStyle);
        doc.text(word.text, cursorX, y);
        cursorX += doc.getTextWidth(word.text);
      });
      y += lineH;
    });

    doc.setFont('helvetica', 'normal');
  };

  const textLines = text.split('\n');

  for (let i = 0; i < textLines.length; i++) {
    const line = textLines[i];
    const trimmed = line.trim();

    if (trimmed === '') {
      y += 3;
      continue;
    }

    // H1
    if (trimmed.startsWith('# ')) {
      checkPageBreak(14);
      doc.setFontSize(15);
      doc.setFont('helvetica', 'bold');
      const content = trimmed.slice(2);
      const wrapped = doc.splitTextToSize(content, maxWidth);
      wrapped.forEach(wl => {
        checkPageBreak(9);
        doc.text(wl, margin, y);
        y += 9;
      });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      y += 2;
      continue;
    }

    // H2
    if (trimmed.startsWith('## ')) {
      checkPageBreak(12);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      const content = trimmed.slice(3);
      const wrapped = doc.splitTextToSize(content, maxWidth);
      wrapped.forEach(wl => {
        checkPageBreak(8);
        doc.text(wl, margin, y);
        y += 8;
      });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      y += 1;
      continue;
    }

    // H3
    if (trimmed.startsWith('### ')) {
      checkPageBreak(10);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      const content = trimmed.slice(4);
      const wrapped = doc.splitTextToSize(content, maxWidth);
      wrapped.forEach(wl => {
        checkPageBreak(7);
        doc.text(wl, margin, y);
        y += 7;
      });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      continue;
    }

    // Separador horizontal
    if (/^[-*_]{3,}$/.test(trimmed)) {
      checkPageBreak(8);
      doc.setDrawColor(180, 180, 180);
      doc.line(margin, y, margin + maxWidth, y);
      doc.setDrawColor(0, 0, 0);
      y += 5;
      continue;
    }

    // Listas con viñeta
    const bulletMatch = trimmed.match(/^[-*+]\s+(.*)/);
    if (bulletMatch) {
      checkPageBreak(7);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text('•', margin + 2, y);
      renderInlineWrapped(bulletMatch[1], margin + 8, 6);
      y += 1;
      continue;
    }

    // Listas numeradas
    const numberedMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
    if (numberedMatch) {
      checkPageBreak(7);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      const numStr = `${numberedMatch[1]}.`;
      doc.text(numStr, margin + 2, y);
      renderInlineWrapped(numberedMatch[2], margin + 10, 6);
      y += 1;
      continue;
    }

    // Blockquote
    const blockquoteMatch = trimmed.match(/^>\s*(.*)/);
    if (blockquoteMatch) {
      doc.setDrawColor(150, 150, 150);
      doc.setFillColor(245, 245, 245);
      doc.setFontSize(11);
      renderInlineWrapped(blockquoteMatch[1], margin + 6, 6);
      doc.setDrawColor(0, 0, 0);
      y += 1;
      continue;
    }

    // Párrafo normal
    doc.setFontSize(11);
    renderInlineWrapped(trimmed, margin, 6);
    y += 1;
  }

  return y;
}

// ─────────────────────────────────────────────────────────────────────────────
// IPC Handler principal
// ─────────────────────────────────────────────────────────────────────────────
function registerExportHandlers() {
  ipcMain.handle('export-document', async (event, { data, format }) => {
    try {
      const { title, date, participants, summary, detailedSummary, highlights, transcription } = data;
      
      const defaultPath = `Export_${title.replace(/[^a-z0-9]/gi, '_')}.${format}`;
      
      const { canceled, filePath } = await dialog.showSaveDialog({
        title: 'Export Document',
        defaultPath: defaultPath,
        filters: [
          { name: format.toUpperCase(), extensions: [format] }
        ]
      });

      if (canceled || !filePath) {
        return { success: true, canceled: true };
      }

      // ── Markdown ────────────────────────────────────────────────────────────
      if (format === 'md') {
        let mdContent = `# ${title}\n\n**Date:** ${date}\n\n`;
        if (participants && participants.length > 0) {
          mdContent += `## Participants\n${participants.map(p => `- ${p.name} (${p.role})`).join('\n')}\n\n`;
        }
        if (summary) {
          mdContent += `## Summary\n${summary}\n\n`;
        }
        if (detailedSummary) {
          mdContent += `## Detailed Summary\n${detailedSummary}\n\n`;
        }
        if (highlights && highlights.length > 0) {
          mdContent += `## Key Highlights\n${highlights.map(h => `- ${h}`).join('\n')}\n\n`;
        }
        if (transcription) {
          mdContent += `## Transcription\n`;
          transcription.forEach(item => {
            mdContent += `**${item.speaker || 'Speaker'}** [${item.timestamp || '0:00'}]: ${item.text}\n\n`;
          });
        }
        fs.writeFileSync(filePath, mdContent, 'utf-8');
      }

      // ── DOCX ────────────────────────────────────────────────────────────────
      else if (format === 'docx') {
        const docChildren = [];
        
        docChildren.push(new Paragraph({ text: title, heading: HeadingLevel.HEADING_1 }));
        docChildren.push(new Paragraph({
          children: [
            new TextRun({ text: 'Date: ', bold: true }),
            new TextRun({ text: date }),
          ]
        }));
        docChildren.push(new Paragraph({ text: '' }));
        
        if (participants && participants.length > 0) {
          docChildren.push(new Paragraph({ text: 'Participants', heading: HeadingLevel.HEADING_2 }));
          participants.forEach(p => {
            docChildren.push(new Paragraph({
              bullet: { level: 0 },
              children: [
                new TextRun({ text: p.name, bold: true }),
                new TextRun({ text: p.role ? ` (${p.role})` : '' }),
              ]
            }));
          });
          docChildren.push(new Paragraph({ text: '' }));
        }

        if (summary) {
          docChildren.push(new Paragraph({ text: 'Summary', heading: HeadingLevel.HEADING_2 }));
          parseMarkdownToDocxParagraphs(summary).forEach(p => docChildren.push(p));
          docChildren.push(new Paragraph({ text: '' }));
        }

        if (detailedSummary) {
          docChildren.push(new Paragraph({ text: 'Detailed Summary', heading: HeadingLevel.HEADING_2 }));
          parseMarkdownToDocxParagraphs(detailedSummary).forEach(p => docChildren.push(p));
          docChildren.push(new Paragraph({ text: '' }));
        }

        if (highlights && highlights.length > 0) {
          docChildren.push(new Paragraph({ text: 'Key Highlights', heading: HeadingLevel.HEADING_2 }));
          highlights.forEach(h => {
            // Cada highlight puede traer Markdown inline
            const segments = parseInlineMarkdown(String(h));
            docChildren.push(new Paragraph({
              bullet: { level: 0 },
              children: segments.map(s => new TextRun({
                text: s.text,
                bold: s.bold,
                italics: s.italic,
              })),
            }));
          });
          docChildren.push(new Paragraph({ text: '' }));
        }

        if (transcription) {
          docChildren.push(new Paragraph({ text: 'Transcription', heading: HeadingLevel.HEADING_2 }));
          transcription.forEach(item => {
            docChildren.push(new Paragraph({
              children: [
                new TextRun({ text: `${item.speaker || 'Speaker'} [${item.timestamp || '0:00'}]: `, bold: true }),
                new TextRun({ text: item.text })
              ]
            }));
            docChildren.push(new Paragraph({ text: '' }));
          });
        }

        const doc = new Document({
          numbering: {
            config: [{
              reference: 'default-numbering',
              levels: [{
                level: 0,
                format: 'decimal',
                text: '%1.',
                alignment: 'start',
              }]
            }]
          },
          sections: [{
            properties: {},
            children: docChildren
          }]
        });

        const buffer = await Packer.toBuffer(doc);
        fs.writeFileSync(filePath, buffer);
      }

      // ── PDF ─────────────────────────────────────────────────────────────────
      else if (format === 'pdf') {
        const doc = new jsPDF();
        let y = 20;
        const pageHeight = doc.internal.pageSize.height;
        const margin = 20;
        const maxWidth = 170;

        const checkPageBreak = (needed) => {
          if (y + needed > pageHeight - margin) {
            doc.addPage();
            y = margin;
          }
        };

        // Título
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        const titleLines = doc.splitTextToSize(title, maxWidth);
        titleLines.forEach(tl => {
          checkPageBreak(12);
          doc.text(tl, margin, y);
          y += 10;
        });

        // Fecha
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        checkPageBreak(8);
        doc.text(`Date: ${date}`, margin, y);
        y += 8;

        // Participantes
        if (participants && participants.length > 0) {
          checkPageBreak(14);
          doc.setFontSize(15);
          doc.setFont('helvetica', 'bold');
          doc.text('Participants', margin, y);
          y += 8;
          doc.setFontSize(11);
          doc.setFont('helvetica', 'normal');
          participants.forEach(p => {
            checkPageBreak(7);
            const label = p.role ? `${p.name} (${p.role})` : p.name;
            doc.text(`• ${label}`, margin + 4, y);
            y += 6;
          });
          y += 3;
        }

        // Summary
        if (summary) {
          checkPageBreak(14);
          doc.setFontSize(15);
          doc.setFont('helvetica', 'bold');
          doc.text('Summary', margin, y);
          y += 8;
          doc.setFontSize(11);
          doc.setFont('helvetica', 'normal');
          y = renderMarkdownToPdf(doc, summary, margin, maxWidth, y, pageHeight);
          y += 4;
        }

        // Detailed Summary
        if (detailedSummary) {
          checkPageBreak(14);
          doc.setFontSize(15);
          doc.setFont('helvetica', 'bold');
          doc.text('Detailed Summary', margin, y);
          y += 8;
          doc.setFontSize(11);
          doc.setFont('helvetica', 'normal');
          y = renderMarkdownToPdf(doc, detailedSummary, margin, maxWidth, y, pageHeight);
          y += 4;
        }

        // Highlights
        if (highlights && highlights.length > 0) {
          checkPageBreak(14);
          doc.setFontSize(15);
          doc.setFont('helvetica', 'bold');
          doc.text('Key Highlights', margin, y);
          y += 8;
          doc.setFontSize(11);
          doc.setFont('helvetica', 'normal');
          highlights.forEach(h => {
            // Cada highlight puede contener Markdown inline
            y = renderMarkdownToPdf(doc, `- ${h}`, margin, maxWidth, y, pageHeight);
          });
          y += 3;
        }

        // Transcripción
        if (transcription) {
          checkPageBreak(14);
          doc.setFontSize(15);
          doc.setFont('helvetica', 'bold');
          doc.text('Transcription', margin, y);
          y += 8;
          doc.setFontSize(11);

          transcription.forEach(item => {
            const header = `${item.speaker || 'Speaker'} [${item.timestamp || '0:00'}]:`;
            checkPageBreak(12);
            doc.setFont('helvetica', 'bold');
            doc.text(header, margin, y);
            y += 6;

            doc.setFont('helvetica', 'normal');
            const splitText = doc.splitTextToSize(item.text, maxWidth);
            splitText.forEach(line => {
              checkPageBreak(6);
              doc.text(line, margin, y);
              y += 6;
            });
            y += 3;
          });
        }

        const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
        fs.writeFileSync(filePath, pdfBuffer);
      }

      return { success: true, filePath };
    } catch (error) {
      console.error('[Export] Error exporting document:', error);
      return { success: false, error: error.message };
    }
  });
}

module.exports = { registerExportHandlers };
