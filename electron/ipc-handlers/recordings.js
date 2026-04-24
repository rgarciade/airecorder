const { ipcMain, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const dbService = require('../database/dbService');
const speakerManager = require('../services/speakerManager');
const { getRecordingsPath, getFolderPathFromId } = require('../utils/paths');

module.exports.registerRecordingsHandlers = () => {

  // Manejador para obtener grabaciones mezclando FS y DB
  ipcMain.handle('get-recording-folders', async () => {
    try {
      const baseOutputDir = await getRecordingsPath();
      const dbRecordings = dbService.getAllRecordings(); // Array de DB
      const dbMap = new Map(dbRecordings.map(r => [r.relative_path, r]));

      if (!fs.existsSync(baseOutputDir)) {
        return { success: true, folders: [] };
      }
      
      const items = await fs.promises.readdir(baseOutputDir);
      const folders = [];
      
      for (const item of items) {
        const itemPath = path.join(baseOutputDir, item);
        try {
          const stats = await fs.promises.stat(itemPath);
          if (stats.isDirectory()) {
            const folderContents = await fs.promises.readdir(itemPath);
            const audioFiles = folderContents.filter(file => 
              file.endsWith('.webm') || file.endsWith('.wav') || file.endsWith('.mp3') || 
              file.endsWith('.m4a') || file.endsWith('.ogg') || file.endsWith('.aac') || file.endsWith('.flac')
            );
            
            // Incluir la carpeta si tiene audio O si tiene transcripción (ej. importación de Teams)
            const hasTranscriptionJson = fs.existsSync(path.join(itemPath, 'analysis', 'transcripcion_combinada.json'));
            if (audioFiles.length > 0 || hasTranscriptionJson) {
              // Datos de DB
              const dbEntry = dbMap.get(item);

              // Datos calculados/reales
              const hasAnalysis = hasTranscriptionJson;
              
              // Priorizamos DB status, fallback a lógica antigua
              let status = dbEntry ? dbEntry.status : (hasAnalysis ? 'transcribed' : 'recorded');
              
              // Check manual extra por si acaso DB está desfasada en status 'analyzed'
              if (fs.existsSync(path.join(itemPath, 'analysis', 'ai_summary.json'))) {
                status = 'analyzed';
              }

              // Leer nombre personalizado de metadata.json si existe
              let displayName = item;
              const metadataPath = path.join(itemPath, 'metadata.json');
              if (fs.existsSync(metadataPath)) {
                try {
                  const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
                  if (metadata.customName) {
                    displayName = metadata.customName;
                  }
                } catch (e) {
                  console.warn(`Error leyendo metadata para ${item}:`, e);
                }
              }

              // Obtener proyecto asociado
              const project = dbService.getRecordingProject(item);

              // Obtener estado en cola si existe
              const queueStatus = dbService.getRecordingTaskStatus(dbEntry ? dbEntry.id : -1);

              folders.push({
                id: dbEntry ? dbEntry.id : null,
                name: displayName,
                folderName: item,
                path: itemPath,
                createdAt: dbEntry ? dbEntry.created_at : stats.birthtime.toISOString(),
                modifiedAt: stats.mtime.toISOString(),
                files: audioFiles,
                hasAnalysis: status === 'transcribed' || status === 'analyzed',
                status: status,
                duration: dbEntry ? dbEntry.duration : 0,
                transcriptionModel: dbEntry ? dbEntry.transcription_model : null,
                project: project ? { id: project.id, name: project.name } : null,
                queueStatus: queueStatus
              });
            }
          }
        } catch (err) {
          console.warn(`Error leyendo carpeta ${item}:`, err);
        }
      }
      
      // Ordenar por fecha
      folders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
      return { success: true, folders };
    } catch (error) {
      console.error('Error getting recording folders:', error);
      return { success: false, error: error.message };
    }
  });

  // Obtener transcripción de una grabación específica
  ipcMain.handle('get-transcription', async (event, recordingId) => {
    try {
      const folderName = await getFolderPathFromId(recordingId);
      const baseOutputDir = await getRecordingsPath();
      
      const transcriptionPath = path.join(
        baseOutputDir,
        folderName,
        'analysis',
        'transcripcion_combinada.json'
      );
      
      if (!fs.existsSync(transcriptionPath)) {
        return { success: false, error: 'Transcripción no encontrada' };
      }
      
      const transcriptionData = await fs.promises.readFile(transcriptionPath, 'utf8');
      const parsed = JSON.parse(transcriptionData);
      const transcription = Array.isArray(parsed)
        ? { segments: parsed }
        : parsed;

      // ── Phase 5: Resolución de hablantes ──────────────────────────────────
      // Si existe el JSON de diarización v2.0 con embeddings, procesarlos para
      // obtener el mapa ephemeralId → { speakerId (UUID), displayName }.
      // El resultado se incluye como `speakerResolution` en la respuesta para
      // que el frontend pueda inicializar el Redux speakersSlice antes de renderizar.
      let speakerResolution = {};
      try {
        const diarizationPath = path.join(
          baseOutputDir,
          folderName,
          'analysis',
          'diarization.json'
        );
        const dbRecording = dbService.getRecording(folderName);
        const numericRecordingId = dbRecording ? dbRecording.id : null;

        const hasDiarizationFile = fs.existsSync(diarizationPath);

        // Si existe el archivo de diarización (aunque esté vacío o sin embeddings),
        // marcar como origen 'diarization' para habilitar la UI de edición.
        // El frontend verificará si los speakerId son UUIDs válidos.
        if (hasDiarizationFile) {
          const diarizationRaw = fs.readFileSync(diarizationPath, 'utf8');
          const diarizationData = JSON.parse(diarizationRaw);

          // Soportar formato v2.0 ({ version, segments, speaker_embeddings })
          const speakerEmbeddings =
            diarizationData?.speaker_embeddings &&
            typeof diarizationData.speaker_embeddings === 'object' &&
            Object.keys(diarizationData.speaker_embeddings).length > 0
              ? diarizationData.speaker_embeddings
              : null;

          if (speakerEmbeddings) {
            const { resolutionMap, pendingSuggestions } = speakerManager.processEmbeddings(
              speakerEmbeddings,
              numericRecordingId
            );
            speakerResolution = resolutionMap;

            // Enriquecer las sugerencias con el timestamp del primer segmento del hablante
            // para que el frontend pueda reproducir un fragmento de 5 segundos
            if (pendingSuggestions.length > 0 && transcription.segments) {
              const allSegments = diarizationData.segments || transcription.segments;
              for (const suggestion of pendingSuggestions) {
                const firstSeg = allSegments.find(
                  (s) => s.speaker === suggestion.ephemeralId && typeof s.start === 'number'
                );
                suggestion.firstSegmentStart = firstSeg ? firstSeg.start : null;
              }
            }

            speakerResolution._pendingSuggestions = pendingSuggestions;
          } else if (diarizationData?.segments && diarizationData.segments.length > 0) {
            // Fallback: diarización existe pero sin embeddings. Usar los segments
            // del propio diarization.json para generar resolución.
            speakerResolution = speakerManager.resolveFromSegments(
              diarizationData.segments,
              numericRecordingId
            );
          }

          // IMPORTANTE: marcar como 'diarization' SIEMPRE que exista el archivo,
          // independientemente de si hay embeddings o no. El frontend validará
          // los UUIDs. Esto cubre el caso de diarización activa pero sin embeddings.
          speakerResolution._source = 'diarization';
          console.log(
            `[IPC:get-transcription] Speaker resolution para "${folderName}" (source=diarization):`,
            Object.keys(speakerResolution)
              .filter((k) => k !== '_source' && k !== 'displayName')
              .map(
                (k) => `${k} → ${speakerResolution[k]?.displayName || 'sin resolución'}`
              )
          );
        } else {
          // Fallback: NO hay diarization.json → generar a partir de los segmentos.
          // Se marca como 'segments' (solo lectura).
          if (transcription.segments?.length > 0) {
            speakerResolution = speakerManager.resolveFromSegments(
              transcription.segments,
              numericRecordingId
            );
            if (Object.keys(speakerResolution).length > 0) {
              speakerResolution._source = 'segments';
              console.log(
                `[IPC:get-transcription] Speaker resolution (segmentos, solo lectura) para "${folderName}":`,
                Object.keys(speakerResolution)
                  .filter((k) => k !== '_source')
                  .map((k) => `${k} → ${speakerResolution[k].displayName}`)
              );
            }
          }
        }
      } catch (speakerErr) {
        // No abortar la carga de la transcripción si falla la resolución de hablantes
        console.warn(
          `[IPC:get-transcription] Resolución de hablantes falló para "${folderName}":`,
          speakerErr.message
        );
      }
      // ── Fin Phase 5 ────────────────────────────────────────────────────────

      return { success: true, transcription: { ...transcription, speakerResolution } };
    } catch (error) {
      console.error('Error getting transcription:', error);
      return { success: false, error: error.message };
    }
  });

  // Obtener transcripción de una grabación específica (texto plano)
  ipcMain.handle('get-transcription-txt', async (event, recordingId) => {
    try {
      const folderName = await getFolderPathFromId(recordingId);
      const baseOutputDir = await getRecordingsPath();
      const txtPath = path.join(
        baseOutputDir,
        folderName,
        'analysis',
        'transcripcion_combinada.txt'
      );
      if (!fs.existsSync(txtPath)) {
        return { success: false, error: 'Archivo TXT no encontrado' };
      }
      const txtData = await fs.promises.readFile(txtPath, 'utf8');
      return { success: true, text: txtData };
    } catch (error) {
      console.error('Error leyendo TXT de transcripción:', error);
      return { success: false, error: error.message };
    }
  });

  // Eliminar una grabación completa (carpeta y contenido)
  ipcMain.handle('delete-recording', async (event, recordingId) => {
    try {
      const folderName = await getFolderPathFromId(recordingId);
      const baseOutputDir = await getRecordingsPath();
      const recordingPath = path.join(baseOutputDir, folderName);
      
      if (!fs.existsSync(recordingPath)) {
        return { success: false, error: 'Grabación no encontrada' };
      }
      
      // Eliminar recursivamente toda la carpeta
      await fs.promises.rm(recordingPath, { recursive: true, force: true });
      
      // También eliminar de la base de datos si es necesario (migrationService se encargará en el próximo sync, pero mejor hacerlo ahora)
      dbService.deleteRecording(folderName);
      
      console.log(`Grabación eliminada: ${recordingPath}`);
      return { success: true, message: 'Grabación eliminada correctamente' };
    } catch (error) {
      console.error('Error deleting recording:', error);
      return { success: false, error: error.message };
    }
  });

  // Descargar grabación (abrir en finder/explorador)
  ipcMain.handle('download-recording', async (event, recordingId) => {
    try {
      const folderName = await getFolderPathFromId(recordingId);
      const baseOutputDir = await getRecordingsPath();
      const recordingPath = path.join(baseOutputDir, folderName);
      
      if (!fs.existsSync(recordingPath)) {
        return { success: false, error: 'Grabación no encontrada' };
      }
      
      shell.openPath(recordingPath);
      return { success: true };
    } catch (error) {
      console.error('Error downloading recording:', error);
      return { success: false, error: error.message };
    }
  });

  // Renombrar grabación
  ipcMain.handle('rename-recording', async (event, recordingId, newName) => {
    try {
      const folderName = await getFolderPathFromId(recordingId);
      const baseOutputDir = await getRecordingsPath();
      const oldPath = path.join(baseOutputDir, folderName);
      
      // Sanitizar el nuevo nombre para que sea válido como carpeta
      const safeNewName = newName.replace(/[^a-z0-9áéíóúñü \-_]/gi, '_').trim();
      const newPath = path.join(baseOutputDir, safeNewName);

      if (!fs.existsSync(oldPath)) {
        return { success: false, error: 'Grabación no encontrada' };
      }

      if (fs.existsSync(newPath) && oldPath !== newPath) {
        return { success: false, error: 'Ya existe una carpeta con ese nombre' };
      }

      // 1. Renombrar la carpeta física
      await fs.promises.rename(oldPath, newPath);
      console.log(`Carpeta renombrada: ${oldPath} -> ${newPath}`);

      // 2. Renombrar los archivos internos que usan el prefijo antiguo
      const files = await fs.promises.readdir(newPath);
      for (const file of files) {
        if (file.startsWith(folderName)) {
          const newFileName = file.replace(folderName, safeNewName);
          await fs.promises.rename(
            path.join(newPath, file),
            path.join(newPath, newFileName)
          );
        }
      }

      // 3. Actualizar la base de datos (relative_path)
      const dbEntry = dbService.getRecording(folderName);
      if (dbEntry) {
        dbService.db.prepare("UPDATE recordings SET relative_path = ? WHERE id = ?").run(safeNewName, dbEntry.id);
      }

      // 4. Guardar el customName en metadata.json por si acaso (aunque la carpeta ya tenga el nombre)
      const metadataPath = path.join(newPath, 'metadata.json');
      let metadata = {};
      if (fs.existsSync(metadataPath)) {
        try {
          metadata = JSON.parse(await fs.promises.readFile(metadataPath, 'utf8'));
        } catch (e) {}
      }
      metadata.customName = newName;
      await fs.promises.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');
      
      return { success: true, folderName: safeNewName };
    } catch (error) {
      console.error('Error renaming recording:', error);
      return { success: false, error: error.message };
    }
  });

  // Obtener una grabación específica por ID
  ipcMain.handle('get-recording-by-id', async (event, recordingId) => {
    try {
      const recording = dbService.getRecordingById(recordingId);
      if (!recording) {
        return { success: false, error: 'Grabación no encontrada' };
      }
      return { success: true, recording };
    } catch (error) {
      console.error('Error obteniendo grabación por ID:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Confirma una sugerencia de match de hablante para una grabación.
   * Vincula el ephemeralId al hablante confirmado y consolida los embeddings.
   * El frontend puede llamar este handler cuando el usuario acepta una sugerencia.
   *
   * Payload: { recordingId, ephemeralId, confirmedSpeakerId, currentSpeakerId }
   * Respuesta: { success, displayName?, error? }
   */
  ipcMain.handle('confirm-speaker-suggestion', async (event, payload) => {
    try {
      const { recordingId, ephemeralId, confirmedSpeakerId, currentSpeakerId } = payload || {};
      if (!recordingId || !ephemeralId || !confirmedSpeakerId) {
        return { success: false, error: 'Faltan parámetros: recordingId, ephemeralId, confirmedSpeakerId.' };
      }
      const result = speakerManager.confirmSpeakerSuggestion(
        recordingId, ephemeralId, confirmedSpeakerId, currentSpeakerId
      );
      return result;
    } catch (error) {
      console.error('[IPC:confirm-speaker-suggestion] Error:', error);
      return { success: false, error: error.message };
    }
  });

};
