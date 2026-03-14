const { ipcMain, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const { getRecordingsPath, getFolderPathFromId } = require('../utils/paths');

// Extensiones soportadas
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
const TEXT_EXTENSIONS = ['.txt', '.md'];
const PDF_EXTENSIONS = ['.pdf'];
const EXCEL_EXTENSIONS = ['.xlsx', '.xls'];
const SUPPORTED_EXTENSIONS = [...IMAGE_EXTENSIONS, ...TEXT_EXTENSIONS, ...PDF_EXTENSIONS, ...EXCEL_EXTENSIONS];

function getAttachmentType(filename) {
  const ext = path.extname(filename).toLowerCase();
  if (IMAGE_EXTENSIONS.includes(ext)) return 'image';
  if (PDF_EXTENSIONS.includes(ext)) return 'pdf';
  if (TEXT_EXTENSIONS.includes(ext)) return 'text';
  if (EXCEL_EXTENSIONS.includes(ext)) return 'excel';
  return 'unknown';
}

async function getAttachmentsDir(recordingId) {
  const recordingsBase = await getRecordingsPath();
  const folderName = await getFolderPathFromId(recordingId);
  return path.join(recordingsBase, folderName, 'attachments');
}

module.exports.registerAttachmentsHandlers = () => {

  // Obtener lista de adjuntos de una grabación
  ipcMain.handle('get-attachments', async (_event, recordingId) => {
    try {
      const attachmentsDir = await getAttachmentsDir(recordingId);

      if (!fs.existsSync(attachmentsDir)) {
        return { success: true, attachments: [] };
      }

      const files = await fs.promises.readdir(attachmentsDir);
      const attachments = [];

      for (const filename of files) {
        const ext = path.extname(filename).toLowerCase();
        if (!SUPPORTED_EXTENSIONS.includes(ext)) continue;

        const filePath = path.join(attachmentsDir, filename);
        const stats = await fs.promises.stat(filePath);

        attachments.push({
          filename,
          type: getAttachmentType(filename),
          size: stats.size,
          mimeType: getMimeType(filename),
          createdAt: stats.birthtime.toISOString()
        });
      }

      // Ordenar por fecha de creación descendente
      attachments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      return { success: true, attachments };
    } catch (error) {
      console.error('Error obteniendo adjuntos:', error);
      return { success: false, error: error.message };
    }
  });

  // Abrir file picker y añadir adjunto a la grabación
  ipcMain.handle('pick-and-add-attachment', async (event, recordingId) => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openFile', 'multiSelections'],
        filters: [
          { name: 'Todos los soportados', extensions: SUPPORTED_EXTENSIONS.map(e => e.replace(/^\./, '')) },
          { name: 'Imágenes', extensions: IMAGE_EXTENSIONS.map(e => e.replace(/^\./, '')) },
          { name: 'Documentos', extensions: [...PDF_EXTENSIONS, ...TEXT_EXTENSIONS].map(e => e.replace(/^\./, '')) },
          { name: 'Hojas de cálculo', extensions: EXCEL_EXTENSIONS.map(e => e.replace(/^\./, '')) }
        ]
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: true, attachments: [], canceled: true };
      }

      const attachmentsDir = await getAttachmentsDir(recordingId);
      if (!fs.existsSync(attachmentsDir)) {
        await fs.promises.mkdir(attachmentsDir, { recursive: true });
      }

      const addedAttachments = [];

      for (const srcPath of result.filePaths) {
        const originalFilename = path.basename(srcPath);
        const ext = path.extname(originalFilename).toLowerCase();

        if (!SUPPORTED_EXTENSIONS.includes(ext)) continue;

        // Evitar colisiones de nombre
        let destFilename = originalFilename;
        let destPath = path.join(attachmentsDir, destFilename);
        let counter = 1;
        while (fs.existsSync(destPath)) {
          const nameWithoutExt = path.basename(originalFilename, ext);
          destFilename = `${nameWithoutExt}_${counter}${ext}`;
          destPath = path.join(attachmentsDir, destFilename);
          counter++;
        }

        await fs.promises.copyFile(srcPath, destPath);
        const stats = await fs.promises.stat(destPath);

        addedAttachments.push({
          filename: destFilename,
          type: getAttachmentType(destFilename),
          size: stats.size,
          mimeType: getMimeType(destFilename),
          createdAt: stats.birthtime.toISOString()
        });
      }

      return { success: true, attachments: addedAttachments };
    } catch (error) {
      console.error('Error añadiendo adjunto:', error);
      return { success: false, error: error.message };
    }
  });

  // Eliminar un adjunto
  ipcMain.handle('delete-attachment', async (_event, recordingId, filename) => {
    try {
      const attachmentsDir = await getAttachmentsDir(recordingId);
      const filePath = path.join(attachmentsDir, filename);

      if (!fs.existsSync(filePath)) {
        return { success: false, error: 'Archivo no encontrado' };
      }

      await fs.promises.unlink(filePath);
      return { success: true };
    } catch (error) {
      console.error('Error eliminando adjunto:', error);
      return { success: false, error: error.message };
    }
  });

  // Leer contenido de un adjunto (base64 para imágenes, texto para docs/pdfs)
  ipcMain.handle('read-attachment-content', async (_event, recordingId, filename) => {
    try {
      const attachmentsDir = await getAttachmentsDir(recordingId);
      const filePath = path.join(attachmentsDir, filename);

      if (!fs.existsSync(filePath)) {
        return { success: false, error: 'Archivo no encontrado' };
      }

      const type = getAttachmentType(filename);
      const mimeType = getMimeType(filename);

      if (type === 'image') {
        const buffer = await fs.promises.readFile(filePath);
        const base64 = buffer.toString('base64');
        return { success: true, type: 'image', data: base64, mimeType };
      }

      if (type === 'pdf') {
        try {
          const pdfParse = require('pdf-parse');
          const buffer = await fs.promises.readFile(filePath);
          const pdfData = await pdfParse(buffer);
          return { success: true, type: 'text', data: pdfData.text, mimeType: 'text/plain', originalMimeType: mimeType };
        } catch (pdfError) {
          console.error('Error parseando PDF:', pdfError);
          return { success: false, error: `Error leyendo PDF: ${pdfError.message}` };
        }
      }

      if (type === 'text') {
        const text = await fs.promises.readFile(filePath, 'utf8');
        return { success: true, type: 'text', data: text, mimeType };
      }

      if (type === 'excel') {
        try {
          const xlsx = require('xlsx');
          const workbook = xlsx.readFile(filePath);
          let excelText = '';
          
          workbook.SheetNames.forEach(sheetName => {
            const worksheet = workbook.Sheets[sheetName];
            const csvContent = xlsx.utils.sheet_to_csv(worksheet);
            if (csvContent && csvContent.trim()) {
              excelText += `--- Hoja: ${sheetName} ---\n${csvContent}\n\n`;
            }
          });

          return { success: true, type: 'text', data: excelText.trim(), mimeType: 'text/plain', originalMimeType: mimeType };
        } catch (excelError) {
          console.error('Error parseando Excel:', excelError);
          return { success: false, error: `Error leyendo Excel: ${excelError.message}` };
        }
      }

      return { success: false, error: 'Tipo de archivo no soportado' };
    } catch (error) {
      console.error('Error leyendo contenido de adjunto:', error);
      return { success: false, error: error.message };
    }
  });

  // Obtener thumbnail (base64) de una imagen adjunta
  ipcMain.handle('get-attachment-thumbnail', async (_event, recordingId, filename) => {
    try {
      const attachmentsDir = await getAttachmentsDir(recordingId);
      const filePath = path.join(attachmentsDir, filename);

      if (!fs.existsSync(filePath)) {
        return { success: false, error: 'Archivo no encontrado' };
      }

      const type = getAttachmentType(filename);
      if (type !== 'image') {
        return { success: false, error: 'Solo se pueden obtener thumbnails de imágenes' };
      }

      const buffer = await fs.promises.readFile(filePath);
      const base64 = buffer.toString('base64');
      const mimeType = getMimeType(filename);
      return { success: true, data: `data:${mimeType};base64,${base64}`, mimeType };
    } catch (error) {
      console.error('Error obteniendo thumbnail:', error);
      return { success: false, error: error.message };
    }
  });

};

function getMimeType(filename) {
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.pdf': 'application/pdf',
    '.txt': 'text/plain',
    '.md': 'text/markdown',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.xls': 'application/vnd.ms-excel'
  };
  return mimeTypes[ext] || 'application/octet-stream';
}
