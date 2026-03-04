const { ipcMain, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const dbService = require('../database/dbService');
const { getRecordingsPath } = require('../utils/paths');

module.exports.registerIntegrationsHandlers = () => {

  // Importar archivo de audio externo como nueva grabación
  ipcMain.handle('import-audio-file', async () => {
    try {
      // 1. Diálogo de selección de archivo
      const { canceled, filePaths } = await dialog.showOpenDialog({
        title: 'Seleccionar archivo de audio',
        filters: [{ name: 'Archivos de Audio', extensions: ['mp3', 'm4a', 'wav', 'webm', 'ogg', 'aac', 'flac'] }],
        properties: ['openFile'],
      });
      if (canceled || !filePaths[0]) return { success: false, canceled: true };

      const inputFile = filePaths[0];
      const ext = path.extname(inputFile).toLowerCase();

      // 2. Nombre de carpeta único basado en el nombre del archivo + timestamp
      const baseName = path.basename(inputFile, ext).replace(/[^a-zA-Z0-9_\-áéíóúüñÁÉÍÓÚÜÑ]/g, '_').slice(0, 60);
      const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const folderName = `imported_audio_${baseName}_${ts}`;

      // 3. Crear carpeta
      const recordingsDir = await getRecordingsPath();
      const folderPath = path.join(recordingsDir, folderName);
      await fs.promises.mkdir(folderPath, { recursive: true });

      // 4. Copiar y renombrar el archivo a {folderName}-system{ext} para que el script Python lo reconozca
      const targetFileName = `${folderName}-system${ext}`;
      const targetFilePath = path.join(folderPath, targetFileName);
      await fs.promises.copyFile(inputFile, targetFilePath);

      // 5. Guardar metadata.json con nombre legible del archivo original
      const originalName = path.basename(inputFile);
      const metadataPath = path.join(folderPath, 'metadata.json');
      await fs.promises.writeFile(metadataPath, JSON.stringify({ customName: originalName }, null, 2), 'utf8');

      // 6. Registrar en la base de datos con estado 'recorded' (listo para transcribir)
      const createdAt = new Date().toISOString();
      const dbResult = dbService.saveRecording(folderName, 0, 'recorded', createdAt, 'audio-import');
      if (!dbResult.success) {
        return { success: false, error: 'Error guardando la grabación en la base de datos' };
      }

      console.log(`[Audio Import] Archivo importado: ${folderName}`);
      return { success: true, recording: { id: dbResult.id, relative_path: folderName } };

    } catch (error) {
      console.error('[Audio Import] Error:', error);
      return { success: false, error: error.message };
    }
  });

  // Importar transcripción de Microsoft Teams (.docx) como nueva grabación
  ipcMain.handle('import-teams-transcript', async () => {
    try {
      // 1. Diálogo de selección de archivo
      const { canceled, filePaths } = await dialog.showOpenDialog({
        title: 'Seleccionar transcripción de Teams',
        filters: [{ name: 'Transcripción de Teams (Word)', extensions: ['docx'] }],
        properties: ['openFile'],
      });
      if (canceled || !filePaths[0]) return { success: false, canceled: true };

      const inputFile = filePaths[0];

      // 2. Nombre de carpeta único basado en el nombre del archivo + timestamp
      const baseName = path.basename(inputFile, '.docx').replace(/[^a-zA-Z0-9_\-áéíóúüñÁÉÍÓÚÜÑ]/g, '_').slice(0, 60);
      const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const folderName = `teams_${baseName}_${ts}`;

      // 3. Crear carpeta y subdirectorio analysis/
      const recordingsDir = await getRecordingsPath();
      const analysisDir = path.join(recordingsDir, folderName, 'analysis');
      await fs.promises.mkdir(analysisDir, { recursive: true });

      // 4. Ejecutar el script Python conversor (stdlib, cero installs)
      // Usando el __dirname actual que ahora será electron/ipc-handlers/
      // por lo tanto tenemos que subir dos niveles para llegar al root
      const pythonPath = path.join(__dirname, '..', '..', 'venv', 'bin', 'python');
      const scriptPath = path.join(__dirname, '..', '..', 'python', 'teams_converter.py');

      const result = await new Promise((resolve) => {
        let stdout = '';
        let stderr = '';
        const proc = spawn(pythonPath, [scriptPath, inputFile, analysisDir]);
        proc.stdout.on('data', (d) => { stdout += d.toString(); });
        proc.stderr.on('data', (d) => { stderr += d.toString(); });
        proc.on('close', (code) => resolve({ code, stdout, stderr }));
      });

      if (result.code !== 0) {
        // Limpiar carpeta creada si falla la conversión
        await fs.promises.rm(path.join(recordingsDir, folderName), { recursive: true, force: true });
        return { success: false, error: result.stderr || 'Error en la conversión del archivo' };
      }

      // 5. Parsear metadata del stdout (línea "METADATA:{...}")
      const metaLine = result.stdout.split('\n').find(l => l.startsWith('METADATA:'));
      const meta = metaLine ? JSON.parse(metaLine.replace('METADATA:', '')) : { duration: 0 };

      // 6. Guardar metadata.json con nombre legible del archivo original
      const originalName = path.basename(inputFile, '.docx');
      const metadataPath = path.join(recordingsDir, folderName, 'metadata.json');
      await fs.promises.writeFile(metadataPath, JSON.stringify({ customName: originalName }, null, 2), 'utf8');

      // 7. Registrar en la base de datos
      const createdAt = new Date().toISOString();
      const dbResult = dbService.saveRecording(folderName, meta.duration || 0, 'transcribed', createdAt, 'teams-import');
      if (!dbResult.success) {
        return { success: false, error: 'Error guardando la grabación en la base de datos' };
      }

      console.log(`[Teams Import] Grabación importada: ${folderName} (${meta.segments} segmentos, ${meta.speakers} hablantes)`);
      return { success: true, recording: { id: dbResult.id, relative_path: folderName } };

    } catch (error) {
      console.error('[Teams Import] Error:', error);
      return { success: false, error: error.message };
    }
  });

};