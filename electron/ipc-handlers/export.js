const { ipcMain, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const { Document, Packer, Paragraph, TextRun, HeadingLevel } = require('docx');
const { jsPDF } = require('jspdf');

function registerExportHandlers() {
  ipcMain.handle('export-document', async (event, { data, format }) => {
    try {
      const { title, date, participants, summary, highlights, transcription } = data;
      
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

      if (format === 'md') {
        let mdContent = `# ${title}\n\n**Date:** ${date}\n\n`;
        if (participants && participants.length > 0) {
          mdContent += `## Participants\n${participants.map(p => `- ${p.name} (${p.role})`).join('\n')}\n\n`;
        }
        if (summary) {
          mdContent += `## Summary\n${summary}\n\n`;
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
      else if (format === 'docx') {
        const docChildren = [];
        
        docChildren.push(new Paragraph({ text: title, heading: HeadingLevel.HEADING_1 }));
        docChildren.push(new Paragraph({ text: `Date: ${date}` }));
        docChildren.push(new Paragraph({ text: "" }));
        
        if (participants && participants.length > 0) {
          docChildren.push(new Paragraph({ text: "Participants", heading: HeadingLevel.HEADING_2 }));
          participants.forEach(p => {
            docChildren.push(new Paragraph({ text: `• ${p.name} (${p.role})` }));
          });
          docChildren.push(new Paragraph({ text: "" }));
        }

        if (summary) {
          docChildren.push(new Paragraph({ text: "Summary", heading: HeadingLevel.HEADING_2 }));
          docChildren.push(new Paragraph({ text: summary }));
          docChildren.push(new Paragraph({ text: "" }));
        }

        if (highlights && highlights.length > 0) {
          docChildren.push(new Paragraph({ text: "Key Highlights", heading: HeadingLevel.HEADING_2 }));
          highlights.forEach(h => {
            docChildren.push(new Paragraph({ 
              children: [
                new TextRun({ text: `• ${h}` })
              ]
            }));
          });
          docChildren.push(new Paragraph({ text: "" }));
        }

        if (transcription) {
          docChildren.push(new Paragraph({ text: "Transcription", heading: HeadingLevel.HEADING_2 }));
          transcription.forEach(item => {
            docChildren.push(new Paragraph({
              children: [
                new TextRun({ text: `${item.speaker || 'Speaker'} [${item.timestamp || '0:00'}]: `, bold: true }),
                new TextRun({ text: item.text })
              ]
            }));
            docChildren.push(new Paragraph({ text: "" }));
          });
        }

        const doc = new Document({
          sections: [{
            properties: {},
            children: docChildren
          }]
        });

        const buffer = await Packer.toBuffer(doc);
        fs.writeFileSync(filePath, buffer);
      }
      else if (format === 'pdf') {
        const doc = new jsPDF();
        let y = 20;
        const pageHeight = doc.internal.pageSize.height;
        const margin = 20;
        const maxWidth = 170; // 210 - 2 * 20
        
        const checkPageBreak = (neededSpace) => {
          if (y + neededSpace > pageHeight - margin) {
            doc.addPage();
            y = 20;
          }
        };

        // Title
        doc.setFontSize(20);
        doc.text(title, margin, y);
        y += 10;
        
        // Date
        doc.setFontSize(12);
        doc.text(`Date: ${date}`, margin, y);
        y += 10;
        
        if (participants && participants.length > 0) {
          checkPageBreak(20);
          doc.setFontSize(16);
          doc.text("Participants", margin, y);
          y += 8;
          doc.setFontSize(12);
          participants.forEach(p => {
            checkPageBreak(10);
            doc.text(`• ${p.name} (${p.role})`, margin + 5, y);
            y += 6;
          });
          y += 4;
        }

        if (summary) {
          checkPageBreak(20);
          doc.setFontSize(16);
          doc.text("Summary", margin, y);
          y += 8;
          doc.setFontSize(12);
          const splitSummary = doc.splitTextToSize(summary, maxWidth);
          checkPageBreak(splitSummary.length * 6);
          doc.text(splitSummary, margin, y);
          y += splitSummary.length * 6 + 4;
        }

        if (highlights && highlights.length > 0) {
          checkPageBreak(20);
          doc.setFontSize(16);
          doc.text("Key Highlights", margin, y);
          y += 8;
          doc.setFontSize(12);
          highlights.forEach(h => {
            const text = `• ${h}`;
            const splitText = doc.splitTextToSize(text, maxWidth - 5);
            checkPageBreak(splitText.length * 6);
            doc.text(splitText, margin + 5, y);
            y += splitText.length * 6 + 2;
          });
          y += 4;
        }

        if (transcription) {
          checkPageBreak(20);
          doc.setFontSize(16);
          doc.text("Transcription", margin, y);
          y += 8;
          doc.setFontSize(12);
          transcription.forEach(item => {
            const header = `${item.speaker || 'Speaker'} [${item.timestamp || '0:00'}]:`;
            checkPageBreak(15);
            doc.setFont("helvetica", "bold");
            doc.text(header, margin, y);
            y += 6;
            
            doc.setFont("helvetica", "normal");
            const splitText = doc.splitTextToSize(item.text, maxWidth);
            checkPageBreak(splitText.length * 6);
            doc.text(splitText, margin, y);
            y += splitText.length * 6 + 4;
          });
        }
        
        const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
        fs.writeFileSync(filePath, pdfBuffer);
      }

      return { success: true, filePath };
    } catch (error) {
      console.error("[Export] Error exporting document:", error);
      return { success: false, error: error.message };
    }
  });
}

module.exports = { registerExportHandlers };
