const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');
const dbService = require('../database/dbService');
const notificationService = require('./notificationService');
const { getSetting } = require('../utils/paths');

const SUPPORTED_AUDIO_EXTENSIONS = ['webm', 'wav', 'mp3', 'm4a', 'ogg', 'aac', 'flac'];

class TranscriptionManager {
  constructor() {
    this.activeTask = null;
    this.process = null;
    this.onUpdateCallback = null;
    this.onAutoAnalyzeCallback = null;
    this.basePath = null;
    // Don't check queue here, DB isn't ready. Explicitly call checkQueue() from main.js
  }

  setBasePath(path) {
    this.basePath = path;
  }

  setAutoAnalyzeCallback(callback) {
    this.onAutoAnalyzeCallback = callback;
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
        const { settingsPath } = require('../utils/paths');
        let diarizationFile = null;
        
        if (fs.existsSync(settingsPath)) {
            const settingsData = fs.readFileSync(settingsPath, 'utf8');
            const settings = JSON.parse(settingsData);
            
            if (settings.enableDiarization && settings.hfToken) {
                // 1. Obtener ruta del audio de sistema
                const recording = dbService.getRecordingById(this.activeTask.recording_id);
                if (recording) {
                    const sysAudioPath = SUPPORTED_AUDIO_EXTENSIONS
                        .map((ext) => path.join(this.basePath, recording.relative_path, `${recording.relative_path}-system.${ext}`))
                        .find((candidate) => fs.existsSync(candidate));
                    const outputDiarizationPath = path.join(this.basePath, recording.relative_path, 'analysis', 'diarization.json');
                    
                    if (sysAudioPath) {
                        console.log(`[Manager] Diarización habilitada. Ejecutando pre-proceso...`);
                        this.updateProgress(0, 'diarizing');
                        
                        // Obtener rutas de ffmpeg/ffprobe para pasarlas al script
                        let ffmpegPath = null;
                        let ffprobePath = null;
                        
                        if (!app.isPackaged) {
                            // En dev, intentar usar los de node_modules
                            ffmpegPath = path.join(__dirname, '../../node_modules/ffmpeg-static/ffmpeg');
                            ffprobePath = path.join(__dirname, '../../node_modules/ffprobe-static/bin/darwin/arm64/ffprobe'); // Nota: ruta específica mac arm64
                        } else {
                            const resourcesPath = process.resourcesPath;
                            ffmpegPath = path.join(resourcesPath, 'app.asar.unpacked', 'node_modules', 'ffmpeg-static', 'ffmpeg');
                            ffprobePath = path.join(resourcesPath, 'app.asar.unpacked', 'node_modules', 'ffprobe-static', 'bin', 'darwin', 'arm64', 'ffprobe');
                        }

                        const diarizationArgs = [
                            '--audio_file', sysAudioPath,
                            '--hf_token', settings.hfToken,
                            '--output_json', outputDiarizationPath
                        ];
                        if (ffmpegPath && fs.existsSync(ffmpegPath)) diarizationArgs.push('--ffmpeg', ffmpegPath);
                        if (ffprobePath && fs.existsSync(ffprobePath)) diarizationArgs.push('--ffprobe', ffprobePath);

                        // Ejecutar diarización (Paso A: 0% -> 50%)
                        // IMPORTANTE: si diarización falla, seguimos con la transcripción sin diarización.
                        try {
                            await this.runPythonProcess('diarization_analyzer.py', diarizationArgs, (p) => this.updateProgress(Math.floor(p / 2), 'diarizing'));
                            diarizationFile = fs.existsSync(outputDiarizationPath) ? outputDiarizationPath : null;
                            if (!diarizationFile) {
                                console.warn('[Manager] Diarización finalizó sin generar JSON. Continuando sin diarización.');
                            }
                        } catch (diarizationError) {
                            console.warn(`[Manager] Diarización falló: ${diarizationError.message}. Continuando sin diarización.`);
                            diarizationFile = null;
                        }
                    }
                }
            }
        }

        // 2. Ejecutar transcripción principal (Paso B: 50% -> 100% o 0% -> 100%)
        const baseProgress = diarizationFile ? 50 : 0;
        const progressFactor = diarizationFile ? 0.5 : 1.0;

        await this.runTranscriptionProcess(this.activeTask, diarizationFile, (p) => {
            const totalProgress = Math.floor(baseProgress + (p * progressFactor));
            this.updateProgress(totalProgress, 'transcribing');
        });
        
        dbService.updateTask(nextTask.id, 'completed', 'completed', 100);
        this.activeTask = null;
    } catch (error) {
        const errorMsg = error.message || String(error);
        console.error(`Transcription failed for ${nextTask.id}:`, errorMsg);
        if (this.activeTask) {
            dbService.updateTask(nextTask.id, 'failed', 'failed', 0, errorMsg);
            this.activeTask = null;
        }
    }

    this.notifyUpdate();
    this.processQueue(); // Siguiente tarea en la cola
  }

  runPythonProcess(scriptName, scriptArgs, onProgress) {
    return new Promise((resolve, reject) => {
        const isDev = !app.isPackaged;
        let executablePath;
        let execArgs;

        if (isDev) {
            const pythonPath = '/Users/raul.garciad/Proyectos/personal/airecorder/venv/bin/python';
            const systemPython = process.platform === 'win32' ? 'python' : 'python3';
            executablePath = fs.existsSync(pythonPath) ? pythonPath : systemPython;
            const scriptPath = path.join(__dirname, `../../python/${scriptName}`);
            execArgs = [scriptPath];
        } else {
            const resourcesPath = process.resourcesPath;
            // En producción, asumimos que diarization_analyzer también está compilado o empaquetado
            // Pero como es nuevo y experimental, quizás lo ejecutamos vía python si está disponible, 
            // o lo agregamos al build. Por ahora, asumimos la misma lógica que el principal.
            executablePath = path.join(resourcesPath, 'python-bin', scriptName.replace('.py', ''));
            execArgs = [];
            if (!fs.existsSync(executablePath)) {
                // Fallback a script si no está el binario (ej. en desarrollo o si no se compiló)
                const pythonPath = '/usr/bin/python3';
                executablePath = fs.existsSync(pythonPath) ? pythonPath : 'python3';
                execArgs = [path.join(resourcesPath, 'python', scriptName)];
            }
        }

        const args = [...execArgs, ...scriptArgs];
        this.process = spawn(executablePath, args, { env: { ...process.env, PYTHONUNBUFFERED: '1' } });

        this.process.stdout.on('data', (data) => {
            const message = data.toString().trim();
            console.log(`[${scriptName}]: ${message}`);
            const progressMatch = message.match(/PROGRESS:\s*(\d+)/);
            if (progressMatch && onProgress) {
                onProgress(parseInt(progressMatch[1], 10));
            }
        });

        this.process.stderr.on('data', (data) => {
            console.error(`[${scriptName} ERR]: ${data.toString()}`);
        });

        this.process.on('close', (code) => {
            this.process = null;
            if (code === 0) resolve();
            else reject(new Error(`${scriptName} exited with code ${code}`));
        });

        this.process.on('error', (err) => {
            this.process = null;
            reject(err);
        });
    });
}

runTranscriptionProcess(task, diarizationFile, onProgress) {
    return new Promise((resolve, reject) => {
        const isDev = !app.isPackaged;
        let executablePath;
        let execArgs;
        let ffmpegPath = null;
        let ffprobePath = null;

        if (isDev) {
            const pythonPath = '/Users/raul.garciad/Proyectos/personal/airecorder/venv/bin/python';
            const systemPython = process.platform === 'win32' ? 'python' : 'python3';
            executablePath = fs.existsSync(pythonPath) ? pythonPath : systemPython;
            const scriptPath = path.join(__dirname, '../../python/audio_sync_analyzer.py');
            execArgs = [scriptPath];
        } else {
            const resourcesPath = process.resourcesPath;
            executablePath = path.join(resourcesPath, 'python-bin', 'audio_sync_analyzer');
            execArgs = [];
            ffmpegPath = path.join(resourcesPath, 'app.asar.unpacked', 'node_modules', 'ffmpeg-static', 'ffmpeg');
            ffprobePath = path.join(resourcesPath, 'app.asar.unpacked', 'node_modules', 'ffprobe-static', 'bin', 'darwin', 'arm64', 'ffprobe');
        }

        let folderName = task.recording_id;
        const recording = dbService.getRecordingById(task.recording_id);
        if (recording && recording.relative_path) folderName = recording.relative_path;

        const args = [...execArgs, '--basename', folderName];
        if (this.basePath) args.push('--base_dir', this.basePath);
        if (task.model) args.push('--model', task.model);
        if (ffmpegPath && fs.existsSync(ffmpegPath)) args.push('--ffmpeg', ffmpegPath);
        if (ffprobePath && fs.existsSync(ffprobePath)) args.push('--ffprobe', ffprobePath);
        if (diarizationFile) args.push('--diarization_file', diarizationFile);

        try {
            const { settingsPath } = require('../utils/paths');
            if (fs.existsSync(settingsPath)) {
                const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
                if (settings.cpuThreads) args.push('--threads', settings.cpuThreads.toString());
            }
        } catch (e) {}

        const spawnEnv = { ...process.env, PYTHONUNBUFFERED: '1', PYTHONIOENCODING: 'utf-8' };
        if (ffmpegPath && fs.existsSync(ffmpegPath)) {
            spawnEnv.FFMPEG_PATH = ffmpegPath;
            spawnEnv.PATH = path.dirname(ffmpegPath) + ':' + (spawnEnv.PATH || '');
        }

        this.process = spawn(executablePath, args, { env: spawnEnv });

        this.process.stdout.on('data', (data) => {
            const message = data.toString().trim();
            const progressMatch = message.match(/PROGRESS:\s*(\d+)/);
            if (progressMatch && onProgress) {
                onProgress(parseInt(progressMatch[1], 10));
            }
        });

        this.process.stderr.on('data', (data) => {
            const msg = data.toString().trim();
            if (msg.toLowerCase().includes('warning')) console.warn(`[Transcription ${task.id} WARN]: ${msg}`);
            else console.error(`[Transcription ${task.id} ERR]: ${msg}`);
        });

        this.process.on('close', (code) => {
            this.process = null;
            if (code === 0) {
                dbService.updateStatus(folderName, 'transcribed');
                dbService.updateRagStatus(folderName, null);
                if (task.model) dbService.updateTranscriptionModel(folderName, task.model);
                this.updateDurationIfNeeded(folderName);
                notificationService.show('Transcripción Completada', `La transcripción de "${folderName}" ha finalizado.`);
                if (getSetting('autoAnalyze', true) !== false && this.onAutoAnalyzeCallback) {
                    this.onAutoAnalyzeCallback(task.recording_id);
                }
                resolve();
            } else {
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
