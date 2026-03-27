const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');
const dbService = require('../database/dbService');
const notificationService = require('./notificationService');
const diarizationInstaller = require('./diarizationInstaller');

class TranscriptionManager {
  constructor() {
    this.activeTask = null;
    this.process = null;
    this.onUpdateCallback = null;
    this.basePath = null;
    // Don't check queue here, DB isn't ready. Explicitly call checkQueue() from main.js
  }

  setBasePath(path) {
    this.basePath = path;
  }

  setUpdateCallback(callback) {
    this.onUpdateCallback = callback;
  }

  notifyUpdate() {
    if (this.onUpdateCallback) {
      this.onUpdateCallback(this.getState());
    }
  }

  getState() {
    // Return active + queue combined for the frontend format
    // Fetch from DB
    const activeQueue = dbService.getActiveQueue();
    const history = dbService.getQueueHistory();
    
    return {
      active: activeQueue,
      history: history
    };
  }

  getQueueCount() {
    const queue = dbService.getActiveQueue();
    return queue.length;
  }

  addTask(recordingId, options = {}) {
    console.log(`[Manager] addTask llamado con recordingId=${recordingId} (type: ${typeof recordingId}), options=`, options);

    // Resolve numeric ID if string provided (relative_path)
    let numericId = recordingId;
    let folderName = recordingId;

    if (typeof recordingId === 'string' && isNaN(Number(recordingId))) {
        const rec = dbService.getRecording(recordingId);
        if (rec) {
            numericId = rec.id;
            console.log(`[Manager] Resuelto path "${recordingId}" -> numericId=${numericId}`);
        } else {
            // Try to see if it's already a number in string form
            if (!isNaN(parseInt(recordingId))) {
                numericId = parseInt(recordingId);
                console.log(`[Manager] Parseado como número: ${numericId}`);
            } else {
                console.error(`[Manager] Recording not found in DB for path: ${recordingId}`);
                return { success: false, error: 'Recording not found in DB' };
            }
        }
    } else {
        // It's a number, find the folder name for logging/UI
        const rec = dbService.getRecordingById(recordingId);
        if (rec) folderName = rec.relative_path;
        console.log(`[Manager] ID numérico=${numericId}, folderName=${folderName}`);
    }

    // Check if already in queue or active
    const status = dbService.getRecordingTaskStatus(numericId);
    console.log(`[Manager] Estado actual en cola para recording ${numericId}:`, status);
    if (status && (status.status === 'pending' || status.status === 'processing')) {
        console.log(`[Manager] Ya en cola (${status.status}), no se agrega`);
        return { success: false, error: 'Already queued' };
    }

    const taskId = dbService.enqueueTask(numericId, options.model);
    console.log(`[Manager] Tarea encolada con taskId=${taskId}`);
    this.notifyUpdate();
    this.processQueue();
    return { success: true, taskId };
  }

  checkQueue() {
      // Check periodically or on init if there are pending tasks
      // (in case app restarted while processing)
      // For now, we rely on processQueue calls, but dbService.init resets stuck tasks to pending
      this.processQueue();
  }

  async processQueue() {
    console.log(`[Manager] processQueue: activeTask=${this.activeTask ? this.activeTask.id : 'null'}`);
    if (this.activeTask) {
      console.log('[Manager] processQueue: ocupado, saliendo');
      return;
    }

    const nextTask = dbService.getNextTask();
    console.log(`[Manager] processQueue: nextTask=`, nextTask);
    if (!nextTask) {
      console.log('[Manager] processQueue: cola vacía');
      return;
    }

    this.activeTask = nextTask;

    // Update status to processing in DB
    dbService.updateTask(nextTask.id, 'processing', 'transcribing', 0);
    this.notifyUpdate();

    try {
        await this.runTranscription(this.activeTask);
        
        dbService.updateTask(nextTask.id, 'completed', 'completed', 100);
        this.activeTask = null;
    } catch (error) {
        console.error(`Transcription failed for ${nextTask.id}:`, error);
        // Only mark failed if user didn't cancel it mid-process (which sets activeTask to null)
        // If activeTask is null here, it means it was cancelled
        if (this.activeTask) {
            dbService.updateTask(nextTask.id, 'failed', 'failed', 0, error.message);
            this.activeTask = null;
        }
    }

    this.notifyUpdate();
    this.processQueue(); // Next
  }

  runTranscription(task) {
    return new Promise((resolve, reject) => {
        const isDev = !app.isPackaged;
        let executablePath;
        let execArgs;
        let ffmpegPath = null;
        let ffprobePath = null;

        // ── Archivos de log de depuración (se pisan en cada transcripción) ──
        const projectRoot = path.join(__dirname, '..', '..');
        const pythonLogPath = path.join(projectRoot, 'transcription_python.log');
        const nodeLogPath   = path.join(projectRoot, 'transcription_node.log');
        const pythonLog = fs.createWriteStream(pythonLogPath, { flags: 'w' });
        const nodeLog   = fs.createWriteStream(nodeLogPath,   { flags: 'w' });
        const logNode = (msg) => {
            const line = `[${new Date().toISOString()}] ${msg}\n`;
            process.stdout.write(line);
            nodeLog.write(line);
        };
        // ────────────────────────────────────────────────────────────────────

        if (isDev) {
            // DESARROLLO: usar venv local + script .py directamente
            const pythonPath = '/Users/raul.garciad/Proyectos/personal/airecorder/venv/bin/python';
            const systemPython = process.platform === 'win32' ? 'python' : 'python3';
            executablePath = fs.existsSync(pythonPath) ? pythonPath : systemPython;
            const scriptPath = path.join(__dirname, '../../python/audio_sync_analyzer.py');
            execArgs = [scriptPath];
        } else {
            // PRODUCCION: usar binario PyInstaller + ffmpeg bundled
            const resourcesPath = process.resourcesPath;
            executablePath = path.join(resourcesPath, 'python-bin', 'audio_sync_analyzer');
            execArgs = [];

            // ffmpeg bundled — usar ruta directa al binario desempaquetado
            ffmpegPath = path.join(resourcesPath, 'app.asar.unpacked',
                'node_modules', 'ffmpeg-static', 'ffmpeg');
            if (!fs.existsSync(ffmpegPath)) {
                console.warn(`[Manager] ffmpeg no encontrado en: ${ffmpegPath}`);
                ffmpegPath = null;
            }

            // ffprobe bundled
            ffprobePath = path.join(resourcesPath, 'app.asar.unpacked',
                'node_modules', 'ffprobe-static', 'bin', 'darwin', 'arm64', 'ffprobe');
            if (!fs.existsSync(ffprobePath)) {
                console.warn(`[Manager] ffprobe no encontrado en: ${ffprobePath}`);
                ffprobePath = null;
            }
        }

        console.log(`[Manager] Modo: ${isDev ? 'DESARROLLO' : 'PRODUCCIÓN'}`);
        console.log(`[Manager] Executable: ${executablePath}`);
        if (ffmpegPath) console.log(`[Manager] ffmpeg: ${ffmpegPath}`);
        if (ffprobePath) console.log(`[Manager] ffprobe: ${ffprobePath}`);

      // Fetch recording details to get relative_path
      let folderName = task.recording_id;
      if (task.recording_id) {
            const recording = dbService.getRecordingById(task.recording_id);
            if (recording && recording.relative_path) {
                folderName = recording.relative_path;
            } else {
                console.warn(`[Manager] No se encontró recording para ID ${task.recording_id}, usando ID como folderName: ${folderName}`);
            }
      }

        console.log(`[Manager] Starting transcription for task ${task.id} (recording: ${folderName})`);

        const args = [...execArgs, '--basename', folderName];
        if (this.basePath) {
            args.push('--base_dir', this.basePath);
        }
        if (task.model) {
            args.push('--model', task.model);
        }
        if (ffmpegPath) {
            args.push('--ffmpeg', ffmpegPath);
        }
        if (ffprobePath) {
            args.push('--ffprobe', ffprobePath);
        }

        // Leer cpuThreads de settings si existe
        try {
            const { settingsPath } = require('../utils/paths');
            if (fs.existsSync(settingsPath)) {
                const settingsData = fs.readFileSync(settingsPath, 'utf8');
                const settings = JSON.parse(settingsData);
                if (settings.cpuThreads) {
                    args.push('--threads', settings.cpuThreads.toString());
                }
            }
        } catch (e) {
            console.error('[Manager] Error leyendo settings para cpuThreads', e);
        }

        console.log(`[Manager] Spawn: ${executablePath}`);
        console.log(`[Manager] Args array: ${JSON.stringify(args)}`);
        console.log(`[Manager] Executable exists: ${fs.existsSync(executablePath)}`);

        // Entorno para el proceso Python
        const spawnEnv = { ...process.env };
        spawnEnv.PYTHONUNBUFFERED = '1'; // Forzar stdout sin buffer (garantiza flush inmediato)
        spawnEnv.PYTHONIOENCODING = 'utf-8'; // Forzar UTF-8 en Windows (evita error con emojis)
        if (ffmpegPath) {
            spawnEnv.FFMPEG_PATH = ffmpegPath;
            // Añadir directorio de ffmpeg al PATH para que pydub lo encuentre vía which()
            spawnEnv.PATH = path.dirname(ffmpegPath) + ':' + (spawnEnv.PATH || '');
        }
        if (ffprobePath) {
            spawnEnv.FFPROBE_PATH = ffprobePath;
            // Añadir directorio de ffprobe al PATH para que pydub lo encuentre vía which()
            spawnEnv.PATH = path.dirname(ffprobePath) + ':' + (spawnEnv.PATH || '');
        }
        // HF_HOME NO se sobreescribe: faster_whisper usa ~/.cache/huggingface (estándar)
        // donde el modelo ya está cacheado tras la primera descarga.

        // ── Diarización en paralelo con Whisper ───────────────────────────────
        // Arrancamos pyannote ANTES de lanzar Whisper; ambos solo leen el audio.
        // Diarizamos micrófono Y sistema por separado para detectar todos los interlocutores.
        let diarizationPromise = null;
        try {
            const settingsForDiar = this._readSettings();
            logNode(`[Manager] Settings diarización — enabled:${settingsForDiar.diarizationEnabled}, hfToken:${settingsForDiar.hfToken ? '***' + settingsForDiar.hfToken.slice(-4) : 'VACÍO'}, envInstalled:${diarizationInstaller.isEnvInstalled()}`);
            if (settingsForDiar.diarizationEnabled && diarizationInstaller.isEnvInstalled()) {
                const micPath = this._findAudioFile(folderName, 'microphone');
                const sysPath = this._findAudioFile(folderName, 'system');
                const hfToken = settingsForDiar.hfToken || null;
                logNode(`[Manager] Archivos audio — mic:${micPath ?? 'NO ENCONTRADO'}, sys:${sysPath ?? 'NO ENCONTRADO'}`);
                logNode(`[Manager] hfToken pasado a runDiarization: ${hfToken ? '***' + hfToken.slice(-4) : 'null'}`);
                const runDiar = (p, label) => p
                    ? diarizationInstaller.runDiarization(p, hfToken, (phase) => logNode(`[Diarization:${label}] ${phase}`))
                    : Promise.resolve(null);
                if (micPath || sysPath) {
                    logNode(`[Manager] Iniciando diarización en paralelo — mic:${!!micPath} sys:${!!sysPath}`);
                    diarizationPromise = Promise.all([runDiar(micPath, 'mic'), runDiar(sysPath, 'sys')]);
                }
            } else {
                logNode(`[Manager] Diarización OMITIDA — enabled:${settingsForDiar.diarizationEnabled}, envInstalled:${diarizationInstaller.isEnvInstalled()}`);
            }
        } catch (diarStartErr) {
            logNode(`[Manager] Error arrancando diarización paralela: ${diarStartErr.message}`);
        }
        // ─────────────────────────────────────────────────────────────────────

        this.process = spawn(executablePath, args, { env: spawnEnv });

        this.process.stdout.on('data', (data) => {
            const message = data.toString().trim();
            pythonLog.write(`[stdout] ${message}\n`);
            console.log(`[Transcription ${task.id}]: ${message}`);

            // Leer progreso exacto dictado por Python
            const progressMatch = message.match(/PROGRESS:\s*(\d+)/);
            if (progressMatch) {
                const percent = parseInt(progressMatch[1], 10);
                let step = 'processing';
                if (percent < 20) step = 'preparing';
                else if (percent < 95) step = 'transcribing';
                else step = 'saving';

                this.updateProgress(percent, step);
            }
        });

        this.process.stderr.on('data', (data) => {
            const msg = data.toString().trim();
            pythonLog.write(`[stderr] ${msg}\n`);
            // Los warnings de Python (matplotlib, etc.) no son errores fatales de la app.
            // Usamos console.warn para evitar que lleguen a Sentry vía el override de console.error.
            if (msg.toLowerCase().includes('warning') || msg.toLowerCase().includes('userwarning')) {
                console.warn(`[Transcription ${task.id} WARN]: ${msg}`);
            } else {
                console.error(`[Transcription ${task.id} ERR]: ${msg}`);
            }
        });

        this.process.on('close', (code) => {
            pythonLog.write(`[exit] código: ${code}\n`);
            pythonLog.end();
            logNode(`[Manager] Proceso Python terminó con código: ${code}`);
            console.log(`[Manager] Proceso Python terminó con código: ${code}`);
            this.process = null;
            if (code === 0) {
                (async () => {
                    dbService.updateStatus(folderName, 'transcribed');
                    // Resetear estado RAG para que se re-indexe con la nueva transcripción
                    dbService.updateRagStatus(folderName, null);
                    if (task.model) {
                        dbService.updateTranscriptionModel(folderName, task.model);
                    }

                    // Intentar actualizar duración si es 0
                    this.updateDurationIfNeeded(folderName);

                    // ── Esperar diarización paralela ───────────────────────
                    if (diarizationPromise) {
                        try {
                            this.updateProgress(97, 'diarizing');
                            const [micResult, sysResult] = await diarizationPromise;
                            logNode(`[Manager] micResult: ${JSON.stringify(micResult)?.slice(0, 200)}`);
                            logNode(`[Manager] sysResult: ${JSON.stringify(sysResult)?.slice(0, 200)}`);
                            const micSegs = (!micResult?.error && micResult?.segments?.length > 0) ? micResult.segments : null;
                            const sysSegs = (!sysResult?.error && sysResult?.segments?.length > 0) ? sysResult.segments : null;
                            if (micSegs || sysSegs) {
                                this._applyDiarizationToTranscript(folderName, micSegs, sysSegs);
                                dbService.updateTaskDiarization(this.activeTask.id, true);
                                const micSpeakerCount = micSegs ? new Set(micSegs.map(s => s.speaker)).size : 0;
                                const sysSpeakerCount = sysSegs ? new Set(sysSegs.map(s => s.speaker)).size : 0;
                                logNode(`[Manager] Diarización aplicada — mic:${micSegs?.length ?? 0} seg (${micSpeakerCount} speakers), sys:${sysSegs?.length ?? 0} seg (${sysSpeakerCount} speakers)`);
                                console.log(`[Manager] Diarización aplicada — mic:${micSegs?.length ?? 0} seg (${micSpeakerCount} speakers), sys:${sysSegs?.length ?? 0} seg (${sysSpeakerCount} speakers)`);
                            } else {
                                dbService.updateTaskDiarization(this.activeTask.id, false);
                                const err = micResult?.error || sysResult?.error || 'sin segmentos';
                                logNode(`[Manager] Diarización sin resultados: ${err}`);
                                console.warn('[Manager] Diarización sin resultados:', err);
                            }
                        } catch (diarErr) {
                            logNode(`[Manager] Error en diarización: ${diarErr.message}`);
                            console.warn('[Manager] Error en diarización (no fatal):', diarErr.message);
                        }
                    } else {
                        logNode('[Manager] diarizationPromise era null — diarización no se ejecutó');
                    }
                    // ──────────────────────────────────────────────────────

                    nodeLog.end();

                    // Notificar al usuario
                    notificationService.show(
                      'Transcripción Completada',
                      `La transcripción de "${folderName}" ha finalizado.`,
                      { type: 'transcription-complete', recordingId: folderName }
                    );

                    resolve();
                })().catch(err => {
                    logNode(`[Manager] Error inesperado en post-procesado: ${err.message}`);
                    console.error('[Manager] Error inesperado en post-procesado:', err);
                    nodeLog.end();
                    resolve(); // No bloquear la cola por errores de post-procesado
                });
            } else {
                logNode(`[Manager] Transcripción FALLIDA (código ${code}) para: ${folderName}`);
                console.error(`[Manager] Transcripción FALLIDA (código ${code}) para: ${folderName}`);
                nodeLog.end();
                reject(new Error(`Process exited with code ${code}`));
            }
        });

        this.process.on('error', (err) => {
            this.process = null;
            reject(err);
        });
    });
  }

  updateDurationIfNeeded(folderName) {
    if (!this.basePath) return;

    try {
      const recording = dbService.getRecording(folderName);

      // Si la duración es 0, null o no existe, intentamos obtenerla del JSON
      const currentDuration = Number(recording?.duration);
      if (recording && (isNaN(currentDuration) || currentDuration <= 0.1)) {
        const jsonPath = path.join(this.basePath, folderName, 'analysis', 'transcripcion_combinada.json');
        
        if (fs.existsSync(jsonPath)) {
          try {
            const content = fs.readFileSync(jsonPath, 'utf8');
            const data = JSON.parse(content);
            
            if (data.metadata && data.metadata.total_duration !== undefined) {
                const duration = parseFloat(data.metadata.total_duration);
                dbService.updateDuration(folderName, duration);
            }
          } catch (e) {
              console.error(`[Manager] Error reading/parsing JSON: ${e.message}`);
          }
        }
      }
    } catch (error) {
      console.error(`[Manager] Error updating duration: ${error.message}`);
    }
  }

  updateProgress(percent, step) {
      if (this.activeTask) {
          dbService.updateTask(this.activeTask.id, 'processing', step, percent);
          this.notifyUpdate();
      }
  }

  _readSettings() {
      try {
          const { settingsPath } = require('../utils/paths');
          if (fs.existsSync(settingsPath)) {
              return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
          }
      } catch (_) {}
      return {};
  }

  _findAudioFile(folderName, type) {
      if (!this.basePath) return null;
      const dir = path.join(this.basePath, folderName);
      const extensions = ['wav', 'mp3', 'm4a', 'webm', 'ogg', 'flac', 'aac'];
      for (const ext of extensions) {
          const candidate = path.join(dir, `${folderName}-${type}.${ext}`);
          if (fs.existsSync(candidate)) return candidate;
      }
      return null;
  }

  _findMicAudioFile(folderName) {
      return this._findAudioFile(folderName, 'microphone');
  }

  _assignSpeakersToTranscript(segments, diarSegments, sourceFilter, speakerPrefix) {
      const prefix = speakerPrefix || '';
      return segments.map(seg => {
          if (sourceFilter && seg.source !== sourceFilter) return seg;

          // 1. Buscar el segmento de diarización con mayor overlap temporal
          let bestSpeaker = null;
          let bestOverlap = 0;
          for (const d of diarSegments) {
              const overlap = Math.max(0, Math.min(seg.end, d.end) - Math.max(seg.start, d.start));
              if (overlap > bestOverlap) {
                  bestOverlap = overlap;
                  bestSpeaker = prefix + d.speaker;
              }
          }
          if (bestSpeaker) return { ...seg, speaker: bestSpeaker };

          // 2. Fallback: si el segmento cae en un hueco entre dos segmentos de diarización
          //    (habla rápida → segmentos Whisper cortos sin overlap), asignar el más cercano.
          const segMid = (seg.start + seg.end) / 2;
          let nearestSpeaker = null;
          let nearestDist = Infinity;
          for (const d of diarSegments) {
              const dMid = (d.start + d.end) / 2;
              const dist = Math.abs(segMid - dMid);
              if (dist < nearestDist) {
                  nearestDist = dist;
                  nearestSpeaker = prefix + d.speaker;
              }
          }
          // Solo aplicar si el segmento está dentro de una ventana razonable (5s)
          if (nearestSpeaker && nearestDist < 5) {
              return { ...seg, speaker: nearestSpeaker };
          }

          return seg;
      });
  }

  _applyDiarizationToTranscript(folderName, micDiarSegments, sysDiarSegments) {
      if (!this.basePath) return;
      const jsonPath = path.join(this.basePath, folderName, 'analysis', 'transcripcion_combinada.json');
      if (!fs.existsSync(jsonPath)) return;
      try {
          const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

          // 1. Asignar speakers raw de pyannote por overlap temporal
          const applyBoth = (segs) => {
              let result = segs;
              if (micDiarSegments?.length) {
                  result = this._assignSpeakersToTranscript(result, micDiarSegments, 'micrófono', 'MIC_');
              }
              if (sysDiarSegments?.length) {
                  result = this._assignSpeakersToTranscript(result, sysDiarSegments, 'sistema', 'SYS_');
              }
              return result;
          };

          if (Array.isArray(data.segments)) {
              data.segments = applyBoth(data.segments);
          }

          // 2. Mapear labels raw → legibles (USUARIO, INTERLOCUTOR-N)
          const speakerMap = {};
          // Mic: todos → USUARIO (el micrófono captura al usuario local)
          const micRawSpeakers = [...new Set(
              (data.segments || [])
                  .filter(s => s.source === 'micrófono' && s.speaker?.startsWith('MIC_'))
                  .map(s => s.speaker)
          )];
          for (const raw of micRawSpeakers) {
              speakerMap[raw] = 'USUARIO';
          }
          // Sistema: cada speaker distinto → INTERLOCUTOR-N
          const sysRawSpeakers = [...new Set(
              (data.segments || [])
                  .filter(s => s.source === 'sistema' && s.speaker?.startsWith('SYS_'))
                  .map(s => s.speaker)
          )].sort();
          sysRawSpeakers.forEach((raw, i) => {
              speakerMap[raw] = sysRawSpeakers.length === 1
                  ? 'INTERLOCUTOR'
                  : `INTERLOCUTOR-${i + 1}`;
          });

          // 3. Reemplazar labels raw por legibles en todos los segmentos
          if (Array.isArray(data.segments)) {
              data.segments = data.segments.map(seg => {
                  if (seg.speaker && speakerMap[seg.speaker]) {
                      return { ...seg, speaker: speakerMap[seg.speaker] };
                  }
                  return seg;
              });
          }

          // 4. Actualizar metadata
          const sysSpeakers = [...new Set(
              (data.segments || []).filter(s => s.source === 'sistema').map(s => s.speaker)
          )].sort();
          const allSpeakers = [...new Set(
              (data.segments || []).map(s => s.speaker)
          )].sort();

          data.diarization_applied = true;
          data.diarization_speakers = allSpeakers;
          if (data.metadata) {
              data.metadata.diarization_method = 'pyannote-3.1';
              data.metadata.detected_speakers = sysSpeakers;
          }

          // 5. Guardar JSON
          fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), 'utf8');

          // 6. Regenerar .txt con los speakers correctos
          this._regenerateTranscriptTxt(folderName, data);
      } catch (e) {
          console.error('[Manager] Error aplicando diarización al JSON:', e.message);
      }
  }

  _regenerateTranscriptTxt(folderName, data) {
      const txtPath = path.join(this.basePath, folderName, 'analysis', 'transcripcion_combinada.txt');
      const segments = data.segments || [];
      const micSegs = segments.filter(s => s.source === 'micrófono');
      const sysSegs = segments.filter(s => s.source === 'sistema');
      const sysSpeakers = [...new Set(sysSegs.map(s => s.speaker))].sort();

      const formatTime = (seconds) => {
          const h = Math.floor(seconds / 3600);
          const m = Math.floor((seconds % 3600) / 60);
          const s = Math.floor(seconds % 60);
          return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      };

      let txt = 'TRANSCRIPCIÓN COMBINADA DE AUDIO DUAL\n';
      txt += '='.repeat(60) + '\n';
      txt += '🗣️  Diarización: pyannote speaker-diarization-3.1\n\n';
      if (micSegs.length > 0) {
          txt += `🎤 Usuario: ${micSegs.length} segmentos\n`;
      }
      txt += `🔊 Sistema: ${sysSegs.length} segmentos\n`;
      txt += `👥 Interlocutores detectados: ${sysSpeakers.length} en canal sistema`;
      txt += ` (${sysSpeakers.join(', ')})\n`;
      txt += `📝 Total: ${segments.length} segmentos únicos\n\n`;
      txt += 'TIMELINE:\n';
      txt += '-'.repeat(40) + '\n\n';

      for (const seg of segments) {
          const start = formatTime(seg.start);
          const end = formatTime(seg.end);
          const emoji = seg.emoji || (seg.source === 'micrófono' ? '🎤' : '🔊');
          txt += `[${start} - ${end}] ${emoji} ${seg.speaker}:\n`;
          txt += `   ${seg.text}\n\n`;
      }

      fs.writeFileSync(txtPath, txt, 'utf8');
  }

  cancelTask(taskIdOrRecordingId) {
      console.log(`[Manager] Request to cancel ID: ${taskIdOrRecordingId}`);
      
      let task = null;

      // 1. Try to find by Task ID directly (most likely case from UI)
      if (!isNaN(Number(taskIdOrRecordingId))) {
          task = dbService.getTaskById(Number(taskIdOrRecordingId));
      }

      // 2. If not found, maybe it was a recording ID (backward compat or diff source)
      if (!task) {
          // If string path, resolve to recording ID first
          let recordingId = taskIdOrRecordingId;
          if (typeof taskIdOrRecordingId === 'string' && isNaN(Number(taskIdOrRecordingId))) {
              const rec = dbService.getRecording(taskIdOrRecordingId);
              if (rec) recordingId = rec.id;
          }
          
          if (!isNaN(Number(recordingId))) {
             const status = dbService.getRecordingTaskStatus(Number(recordingId));
             if (status) {
                 task = dbService.getTaskById(status.id);
             }
          }
      }

      if (!task) {
          console.log(`[Manager] Task not found for ID: ${taskIdOrRecordingId}`);
          return { success: false, error: 'Task not found' };
      }

      const taskId = task.id;
      console.log(`[Manager] Cancelling task ${taskId} (status: ${task.status})`);

      // If active
      if (this.activeTask && this.activeTask.id === taskId) {
          if (this.process) {
              console.log('[Manager] Killing active process');
              this.process.kill(); // SIGTERM
              this.process = null;
          }
          
          dbService.updateTask(taskId, 'failed', 'cancelled', 0, 'Cancelled by user');
          
          this.activeTask = null;
          this.notifyUpdate();
          
          setTimeout(() => this.processQueue(), 1000);
          return { success: true };
      }

      // If pending
      dbService.updateTask(taskId, 'failed', 'cancelled', 0, 'Cancelled by user');
      this.notifyUpdate();
      return { success: true };
  }
}

module.exports = new TranscriptionManager();
