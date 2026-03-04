const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');
const dbService = require('../database/dbService');
const notificationService = require('./notificationService');

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

        this.process = spawn(executablePath, args, { env: spawnEnv });

        this.process.stdout.on('data', (data) => {
            const message = data.toString().trim();
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
            console.error(`[Transcription ${task.id} ERR]: ${data}`);
        });

        this.process.on('close', (code) => {
            console.log(`[Manager] Proceso Python terminó con código: ${code}`);
            this.process = null;
            if (code === 0) {
                dbService.updateStatus(folderName, 'transcribed');
                // Resetear estado RAG para que se re-indexe con la nueva transcripción
                dbService.updateRagStatus(folderName, null);
                if (task.model) {
                    dbService.updateTranscriptionModel(folderName, task.model);
                }

                // Intentar actualizar duración si es 0
                this.updateDurationIfNeeded(folderName);

                // Notificar al usuario
                notificationService.show(
                  'Transcripción Completada',
                  `La transcripción de "${folderName}" ha finalizado.`,
                  { type: 'transcription-complete', recordingId: folderName }
                );

                resolve();
            } else {
                console.error(`[Manager] Transcripción FALLIDA (código ${code}) para: ${folderName}`);
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
